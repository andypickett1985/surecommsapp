const router = require('express').Router();
const db = require('../db');
const fpbx = require('../fpbx-db');
const { authenticateToken } = require('../middleware/auth');
const { execFile } = require('child_process');

const SETTING_KEYS = ['call_center_enabled', 'call_center_mode', 'call_center_agent_uuid', 'call_center_agent_id', 'call_center_admin'];
const DEFAULT_STATUSES = ['Available', 'On Break', 'Logged Out'];

const FPBX_SSH_HOST = process.env.FPBX_SSH_HOST || 'master.hyperclouduk.com';
const FPBX_SSH_USER = process.env.FPBX_SSH_USER || 'root';

function syncAgentStatusToFreeSWITCH(agentUuid, status) {
  const fsCmd = `callcenter_config agent set status ${agentUuid} '${status}'`;
  const sshArgs = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=5',
    `${FPBX_SSH_USER}@${FPBX_SSH_HOST}`,
    `fs_cli -x "${fsCmd}"`,
  ];
  return new Promise((resolve) => {
    execFile('ssh', sshArgs, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('FreeSWITCH sync error:', err.message, stderr);
        resolve(false);
      } else {
        console.log('FreeSWITCH sync OK:', stdout.trim());
        resolve(true);
      }
    });
  });
}

async function getUserSettings(userId) {
  const result = await db.query(
    `SELECT setting_key, setting_value
     FROM user_settings
     WHERE user_id = $1 AND setting_key = ANY($2::text[])`,
    [userId, SETTING_KEYS]
  );
  const map = {};
  for (const row of result.rows) map[row.setting_key] = row.setting_value;
  return map;
}

async function getStatusOptions(domainUuid) {
  try {
    const [globalResult, domainResult] = await Promise.all([
      fpbx.query(
        `SELECT default_setting_value
         FROM v_default_settings
         WHERE default_setting_category = 'call_center'
           AND default_setting_subcategory = 'agent_status'
           AND default_setting_name = 'array'
           AND default_setting_enabled = 'true'
         ORDER BY default_setting_order, default_setting_value`
      ),
      domainUuid ? fpbx.query(
        `SELECT domain_setting_value
         FROM v_domain_settings
         WHERE domain_uuid = $1
           AND domain_setting_category = 'call_center'
           AND domain_setting_subcategory = 'agent_status'
           AND domain_setting_name = 'array'
           AND domain_setting_enabled = 'true'
         ORDER BY domain_setting_order, domain_setting_value`,
        [domainUuid]
      ) : Promise.resolve({ rows: [] }),
    ]);
    const globalStatuses = globalResult.rows.map(r => r.default_setting_value);
    const domainStatuses = domainResult.rows.map(r => r.domain_setting_value);
    const merged = Array.from(new Set([...globalStatuses, ...domainStatuses]));
    return merged.length > 0 ? merged : DEFAULT_STATUSES;
  } catch {
    return DEFAULT_STATUSES;
  }
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    const enabled = settings.call_center_enabled === 'true';
    const domainUuid = await getUserDomainUuid(req.user.id);

    if (!enabled) {
      return res.json({ enabled: false, statuses: await getStatusOptions(domainUuid) });
    }

    const agentUuid = settings.call_center_agent_uuid;
    let agent = null;
    if (agentUuid) {
      const agentResult = await fpbx.query(
        `SELECT call_center_agent_uuid, agent_name, agent_id, agent_status, domain_uuid
         FROM v_call_center_agents
         WHERE call_center_agent_uuid = $1`,
        [agentUuid]
      );
      agent = agentResult.rows[0] || null;
    }

    res.json({
      enabled: true,
      admin: settings.call_center_admin === 'true',
      mode: settings.call_center_mode || 'manual',
      linked: !!agent,
      agent,
      statuses: await getStatusOptions(domainUuid),
    });
  } catch (err) {
    console.error('Call center /me error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const settings = await getUserSettings(req.user.id);
    if (settings.call_center_enabled !== 'true') {
      return res.status(400).json({ error: 'Call center mode is not enabled for this user' });
    }
    if (!settings.call_center_agent_uuid) {
      return res.status(400).json({ error: 'No call center agent is linked to this user' });
    }

    const agentUuid = settings.call_center_agent_uuid;

    // 1. Update FusionPBX database
    await fpbx.query(
      `UPDATE v_call_center_agents
       SET agent_status = $1, update_date = NOW()
       WHERE call_center_agent_uuid = $2`,
      [status, agentUuid]
    );

    // 2. Sync to FreeSWITCH runtime so live call routing updates immediately
    const fsSynced = await syncAgentStatusToFreeSWITCH(agentUuid, status);

    // 3. Reflect status in app presence model
    const mappedPresence =
      status === 'Available' || status === 'Available (On Demand)' ? 'online' :
      status === 'On Break' ? 'away' :
      status === 'Logged Out' ? 'offline' : 'busy';
    await db.query(
      `INSERT INTO user_presence (user_id, status, status_text, last_seen, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET status = $2, status_text = $3, last_seen = NOW(), updated_at = NOW()`,
      [req.user.id, mappedPresence, `Call center: ${status}`]
    ).catch(() => {});

    // Broadcast presence change to other users in the org
    try {
      const { broadcastToTenant } = require('../ws');
      broadcastToTenant(req.user.tenant_id, {
        event: 'presenceChange',
        userId: req.user.id,
        status: mappedPresence,
        statusText: `Call center: ${status}`,
      }, req.user.id);
    } catch {}

    res.json({ success: true, status, fsSynced });
  } catch (err) {
    console.error('Call center status update error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function getUserDomainUuid(userId) {
  const r = await db.query(
    `SELECT t.fpbx_domain_uuid FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`,
    [userId]
  );
  return r.rows[0]?.fpbx_domain_uuid || null;
}

function runFsCli(cmd) {
  const sshArgs = [
    '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=5',
    `${FPBX_SSH_USER}@${FPBX_SSH_HOST}`,
    `fs_cli -x "${cmd}"`,
  ];
  return new Promise((resolve) => {
    execFile('ssh', sshArgs, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) { console.error('fs_cli error:', err.message); resolve(''); }
      else resolve(stdout.trim());
    });
  });
}

// ---- Call Center Admin: Queues ----

router.get('/queues', authenticateToken, async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    if (settings.call_center_admin !== 'true' && settings.call_center_enabled !== 'true') {
      return res.status(403).json({ error: 'Call center access not enabled' });
    }
    const domainUuid = await getUserDomainUuid(req.user.id);
    if (!domainUuid) return res.status(400).json({ error: 'No FusionPBX domain linked' });

    const result = await fpbx.query(
      `SELECT q.call_center_queue_uuid, q.queue_name, q.queue_extension, q.queue_strategy,
              q.queue_description, q.domain_uuid, d.domain_name,
              (SELECT COUNT(*) FROM v_call_center_tiers t WHERE t.call_center_queue_uuid = q.call_center_queue_uuid) as agent_count
       FROM v_call_center_queues q
       JOIN v_domains d ON d.domain_uuid = q.domain_uuid
       WHERE q.domain_uuid = $1
       ORDER BY q.queue_name`,
      [domainUuid]
    );
    res.json(result.rows.map(r => ({ ...r, agent_count: parseInt(r.agent_count) })));
  } catch (err) {
    console.error('CC queues error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/queues/:queueId/agents', authenticateToken, async (req, res) => {
  try {
    const result = await fpbx.query(
      `SELECT t.call_center_tier_uuid, t.call_center_agent_uuid, t.tier_level, t.tier_position,
              a.agent_name, a.agent_id, a.agent_status, a.agent_contact
       FROM v_call_center_tiers t
       JOIN v_call_center_agents a ON a.call_center_agent_uuid = t.call_center_agent_uuid
       WHERE t.call_center_queue_uuid = $1
       ORDER BY t.tier_level, t.tier_position, a.agent_name`,
      [req.params.queueId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('CC queue agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/queues/:queueId/live', authenticateToken, async (req, res) => {
  try {
    const qRow = await fpbx.query(
      `SELECT q.queue_extension, d.domain_name
       FROM v_call_center_queues q JOIN v_domains d ON d.domain_uuid = q.domain_uuid
       WHERE q.call_center_queue_uuid = $1`,
      [req.params.queueId]
    );
    if (qRow.rows.length === 0) return res.status(404).json({ error: 'Queue not found' });
    const { queue_extension, domain_name } = qRow.rows[0];
    const queueKey = `${queue_extension}@${domain_name}`;

    const [agentsRaw, membersRaw] = await Promise.all([
      runFsCli(`callcenter_config queue list agents ${queueKey}`),
      runFsCli(`callcenter_config queue list members ${queueKey}`),
    ]);

    const agentsParsed = [];
    if (agentsRaw && agentsRaw !== '+OK') {
      const lines = agentsRaw.split('\n');
      const header = lines[0]?.split('|') || [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split('|');
        const obj = {};
        header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').trim(); });
        agentsParsed.push(obj);
      }
    }

    // Enrich with human-readable names from DB
    const agentUuids = agentsParsed.map(a => a.name).filter(Boolean);
    let nameMap = {};
    if (agentUuids.length > 0) {
      try {
        const nameResult = await fpbx.query(
          `SELECT call_center_agent_uuid, agent_name, agent_id
           FROM v_call_center_agents
           WHERE call_center_agent_uuid = ANY($1::uuid[])`,
          [agentUuids]
        );
        for (const r of nameResult.rows) {
          nameMap[r.call_center_agent_uuid] = { agent_name: r.agent_name, agent_id: r.agent_id };
        }
      } catch {}
    }

    const agents = agentsParsed.map(a => ({
      ...a,
      display_name: nameMap[a.name]?.agent_name || a.name,
      agent_id: nameMap[a.name]?.agent_id || '',
    }));

    const members = [];
    if (membersRaw && membersRaw !== '+OK') {
      const lines = membersRaw.split('\n');
      const header = lines[0]?.split('|') || [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split('|');
        const obj = {};
        header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').trim(); });
        members.push(obj);
      }
    }

    res.json({ queueKey, agents, members, waitingCount: members.length });
  } catch (err) {
    console.error('CC queue live error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/queues/:queueId/available-agents', authenticateToken, async (req, res) => {
  try {
    const qRow = await fpbx.query(
      `SELECT domain_uuid FROM v_call_center_queues WHERE call_center_queue_uuid = $1`,
      [req.params.queueId]
    );
    if (qRow.rows.length === 0) return res.status(404).json({ error: 'Queue not found' });
    const domainUuid = qRow.rows[0].domain_uuid;

    const existing = await fpbx.query(
      `SELECT call_center_agent_uuid FROM v_call_center_tiers WHERE call_center_queue_uuid = $1`,
      [req.params.queueId]
    );
    const existingSet = new Set(existing.rows.map(r => r.call_center_agent_uuid));

    const all = await fpbx.query(
      `SELECT call_center_agent_uuid, agent_name, agent_id, agent_status
       FROM v_call_center_agents WHERE domain_uuid = $1 ORDER BY agent_name`,
      [domainUuid]
    );
    res.json(all.rows.filter(a => !existingSet.has(a.call_center_agent_uuid)));
  } catch (err) {
    console.error('CC available agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/queues/:queueId/agents', authenticateToken, async (req, res) => {
  try {
    const { call_center_agent_uuid, tier_level, tier_position } = req.body;
    if (!call_center_agent_uuid) return res.status(400).json({ error: 'call_center_agent_uuid required' });

    const qRow = await fpbx.query(
      `SELECT q.domain_uuid, q.queue_extension, d.domain_name
       FROM v_call_center_queues q JOIN v_domains d ON d.domain_uuid = q.domain_uuid
       WHERE q.call_center_queue_uuid = $1`,
      [req.params.queueId]
    );
    if (qRow.rows.length === 0) return res.status(404).json({ error: 'Queue not found' });

    const tierUuid = require('crypto').randomUUID();
    await fpbx.query(
      `INSERT INTO v_call_center_tiers (call_center_tier_uuid, domain_uuid, call_center_queue_uuid, call_center_agent_uuid, tier_level, tier_position, insert_date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [tierUuid, qRow.rows[0].domain_uuid, req.params.queueId, call_center_agent_uuid, tier_level || 0, tier_position || 0]
    );

    const queueKey = `${qRow.rows[0].queue_extension}@${qRow.rows[0].domain_name}`;
    await runFsCli(`callcenter_config tier add ${queueKey} ${call_center_agent_uuid} ${tier_level || 0} ${tier_position || 0}`);

    res.json({ success: true, call_center_tier_uuid: tierUuid });
  } catch (err) {
    console.error('CC add agent error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/queues/:queueId/agents/:agentUuid', authenticateToken, async (req, res) => {
  try {
    const qRow = await fpbx.query(
      `SELECT q.queue_extension, d.domain_name
       FROM v_call_center_queues q JOIN v_domains d ON d.domain_uuid = q.domain_uuid
       WHERE q.call_center_queue_uuid = $1`,
      [req.params.queueId]
    );

    await fpbx.query(
      `DELETE FROM v_call_center_tiers WHERE call_center_queue_uuid = $1 AND call_center_agent_uuid = $2`,
      [req.params.queueId, req.params.agentUuid]
    );

    if (qRow.rows.length > 0) {
      const queueKey = `${qRow.rows[0].queue_extension}@${qRow.rows[0].domain_name}`;
      await runFsCli(`callcenter_config tier del ${queueKey} ${req.params.agentUuid}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('CC remove agent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Pre-Recorded Messages ----

router.get('/prerecorded', authenticateToken, async (req, res) => {
  try {
    const domainUuid = await getUserDomainUuid(req.user.id);
    if (!domainUuid) return res.status(400).json({ error: 'No domain linked' });

    const result = await fpbx.query(
      `SELECT r.recording_uuid, r.recording_name, r.recording_filename, r.recording_description,
              d.domain_name
       FROM v_recordings r
       JOIN v_domains d ON d.domain_uuid = r.domain_uuid
       WHERE r.domain_uuid = $1 AND r.recording_prerecorded = 'true'
       ORDER BY r.recording_name`,
      [domainUuid]
    );

    const messages = result.rows.map(r => ({
      id: r.recording_uuid,
      name: r.recording_name,
      filename: r.recording_filename,
      description: r.recording_description,
      path: `/var/lib/freeswitch/recordings/${r.domain_name}/${r.recording_filename}`,
    }));

    res.json(messages);
  } catch (err) {
    console.error('Pre-recorded messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/prerecorded/play', authenticateToken, async (req, res) => {
  try {
    const { recording_id, call_uuid, target } = req.body;
    if (!recording_id) return res.status(400).json({ error: 'recording_id required' });

    const domainUuid = await getUserDomainUuid(req.user.id);
    if (!domainUuid) return res.status(400).json({ error: 'No domain linked' });

    const recResult = await fpbx.query(
      `SELECT r.recording_filename, d.domain_name
       FROM v_recordings r
       JOIN v_domains d ON d.domain_uuid = r.domain_uuid
       WHERE r.recording_uuid = $1 AND r.domain_uuid = $2 AND r.recording_prerecorded = 'true'`,
      [recording_id, domainUuid]
    );
    if (recResult.rows.length === 0) return res.status(404).json({ error: 'Recording not found' });

    const { recording_filename, domain_name } = recResult.rows[0];
    const filePath = `/var/lib/freeswitch/recordings/${domain_name}/${recording_filename}`;

    // Find the active FS channel UUID for this user's extension
    let fsUuid = call_uuid;
    if (!fsUuid || fsUuid === 'undefined' || fsUuid === 'null') {
      // Look up the user's SIP extension and find their active channel
      const sipResult = await db.query(
        `SELECT s.sip_username, t.sip_domain FROM sip_accounts s
         JOIN users u ON u.id = s.user_id JOIN tenants t ON t.id = u.tenant_id
         WHERE s.user_id = $1 LIMIT 1`,
        [req.user.id]
      );
      if (sipResult.rows.length > 0) {
        const { sip_username, sip_domain } = sipResult.rows[0];
        const channelsRaw = await runFsCli('show channels');
        const lines = channelsRaw.split('\n');
        for (const line of lines) {
          if (line.includes(`${sip_username}@${sip_domain}`) || line.includes(`/${sip_username}@`)) {
            const uuid = line.split(',')[0];
            if (uuid && uuid.length > 30) { fsUuid = uuid; break; }
          }
        }
      }
    }

    if (!fsUuid) {
      return res.status(400).json({ error: 'No active call found for your extension' });
    }

    const leg = target === 'bleg' ? 'bleg' : target === 'aleg' ? 'aleg' : 'both';
    const result = await runFsCli(`uuid_broadcast ${fsUuid} ${filePath} ${leg}`);
    console.log(`[PRERECORDED] uuid_broadcast ${fsUuid} ${filePath} ${leg} -> ${result}`);

    // Log the event
    try {
      await db.query(
        `INSERT INTO prerecorded_events (id, tenant_id, user_id, recording_id, call_uuid, played_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [req.user.tenant_id, req.user.id, recording_id, fsUuid]
      ).catch(() => {});
    } catch {}

    res.json({ success: true, result: result.trim(), file: filePath, uuid: fsUuid });
  } catch (err) {
    console.error('Pre-recorded play error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/prerecorded/stop', authenticateToken, async (req, res) => {
  try {
    let { call_uuid } = req.body;

    if (!call_uuid || call_uuid === 'undefined' || call_uuid === 'null') {
      const sipResult = await db.query(
        `SELECT s.sip_username, t.sip_domain FROM sip_accounts s
         JOIN users u ON u.id = s.user_id JOIN tenants t ON t.id = u.tenant_id
         WHERE s.user_id = $1 LIMIT 1`,
        [req.user.id]
      );
      if (sipResult.rows.length > 0) {
        const { sip_username, sip_domain } = sipResult.rows[0];
        const channelsRaw = await runFsCli('show channels');
        for (const line of channelsRaw.split('\n')) {
          if (line.includes(`${sip_username}@${sip_domain}`) || line.includes(`/${sip_username}@`)) {
            const uuid = line.split(',')[0];
            if (uuid && uuid.length > 30) { call_uuid = uuid; break; }
          }
        }
      }
    }

    if (!call_uuid) return res.status(400).json({ error: 'No active call found' });
    const result = await runFsCli(`uuid_break ${call_uuid}`);
    res.json({ success: true, result: result.trim() });
  } catch (err) {
    console.error('Pre-recorded play error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/prerecorded/stop', authenticateToken, async (req, res) => {
  try {
    const { call_uuid } = req.body;
    if (!call_uuid) return res.status(400).json({ error: 'call_uuid required' });
    const result = await runFsCli(`uuid_break ${call_uuid}`);
    res.json({ success: true, result: result.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Recording Mask/Unmask with audio notification ----

async function findUserChannelUuid(userId) {
  const sipResult = await db.query(
    `SELECT s.sip_username, t.sip_domain FROM sip_accounts s
     JOIN users u ON u.id = s.user_id JOIN tenants t ON t.id = u.tenant_id
     WHERE s.user_id = $1 LIMIT 1`,
    [userId]
  );
  if (sipResult.rows.length === 0) return null;
  const { sip_username, sip_domain } = sipResult.rows[0];
  const channelsRaw = await runFsCli('show channels');
  for (const line of channelsRaw.split('\n')) {
    if (line.includes(`${sip_username}@${sip_domain}`) || line.includes(`/${sip_username}@`)) {
      const uuid = line.split(',')[0];
      if (uuid && uuid.length > 30) return { uuid, sip_username, sip_domain };
    }
  }
  return null;
}

router.post('/recording/mask', authenticateToken, async (req, res) => {
  try {
    const ch = await findUserChannelUuid(req.user.id);
    if (!ch) return res.status(400).json({ error: 'No active call found' });

    const domainUuid = await getUserDomainUuid(req.user.id);
    let domainName = ch.sip_domain;
    if (domainUuid) {
      const d = await fpbx.query('SELECT domain_name FROM v_domains WHERE domain_uuid = $1', [domainUuid]);
      if (d.rows.length > 0) domainName = d.rows[0].domain_name;
    }

    const recPath = `/var/lib/freeswitch/recordings/${domainName}/archive/\${strftime(%Y)}/\${strftime(%b)}/\${strftime(%d)}/${ch.uuid}.\${record_ext}`;
    const maskResult = await runFsCli(`uuid_record ${ch.uuid} mask ${recPath}`);
    console.log(`[MASK] uuid_record mask: ${maskResult}`);

    // Play "Call Recording Paused" notification to both parties
    const pausedAudio = `/var/lib/freeswitch/recordings/${domainName}/Call_Recording_Paused.mp3`;
    const playResult = await runFsCli(`uuid_broadcast ${ch.uuid} ${pausedAudio} both`);
    console.log(`[MASK] Played paused notification: ${playResult}`);

    res.json({ success: true, masked: true, uuid: ch.uuid });
  } catch (err) {
    console.error('Recording mask error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/recording/unmask', authenticateToken, async (req, res) => {
  try {
    const ch = await findUserChannelUuid(req.user.id);
    if (!ch) return res.status(400).json({ error: 'No active call found' });

    const domainUuid = await getUserDomainUuid(req.user.id);
    let domainName = ch.sip_domain;
    if (domainUuid) {
      const d = await fpbx.query('SELECT domain_name FROM v_domains WHERE domain_uuid = $1', [domainUuid]);
      if (d.rows.length > 0) domainName = d.rows[0].domain_name;
    }

    const recPath = `/var/lib/freeswitch/recordings/${domainName}/archive/\${strftime(%Y)}/\${strftime(%b)}/\${strftime(%d)}/${ch.uuid}.\${record_ext}`;
    const unmaskResult = await runFsCli(`uuid_record ${ch.uuid} unmask ${recPath}`);
    console.log(`[UNMASK] uuid_record unmask: ${unmaskResult}`);

    // Play "Call Recording Unpaused" notification to both parties
    const unpausedAudio = `/var/lib/freeswitch/recordings/${domainName}/Call_Recording_Unpaused.mp3`;
    const playResult = await runFsCli(`uuid_broadcast ${ch.uuid} ${unpausedAudio} both`);
    console.log(`[UNMASK] Played unpaused notification: ${playResult}`);

    res.json({ success: true, masked: false, uuid: ch.uuid });
  } catch (err) {
    console.error('Recording unmask error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Transfer Destinations: Ring Groups + Call Center Queues ----

router.get('/transfer-destinations', authenticateToken, async (req, res) => {
  try {
    const domainUuid = await getUserDomainUuid(req.user.id);
    if (!domainUuid) return res.json({ ringGroups: [], callCenterQueues: [] });

    const [rgResult, ccResult, extResult, agentResult] = await Promise.all([
      fpbx.query(
        `SELECT ring_group_uuid, ring_group_name, ring_group_extension, ring_group_strategy
         FROM v_ring_groups
         WHERE domain_uuid = $1 AND ring_group_enabled = 'true'
         ORDER BY ring_group_name`,
        [domainUuid]
      ),
      fpbx.query(
        `SELECT call_center_queue_uuid, queue_name, queue_extension, queue_strategy
         FROM v_call_center_queues
         WHERE domain_uuid = $1
         ORDER BY queue_name`,
        [domainUuid]
      ),
      fpbx.query(
        `SELECT extension_uuid, extension, effective_caller_id_name, description, enabled
         FROM v_extensions
         WHERE domain_uuid = $1 AND enabled = 'true'
         ORDER BY extension`,
        [domainUuid]
      ),
      fpbx.query(
        `SELECT a.call_center_agent_uuid, a.agent_name, a.agent_id, a.agent_status
         FROM v_call_center_agents a
         WHERE a.domain_uuid = $1
         ORDER BY a.agent_name`,
        [domainUuid]
      ),
    ]);

    res.json({
      ringGroups: rgResult.rows.map(r => ({
        id: r.ring_group_uuid,
        name: r.ring_group_name,
        extension: r.ring_group_extension,
        strategy: r.ring_group_strategy,
      })),
      callCenterQueues: ccResult.rows.map(q => ({
        id: q.call_center_queue_uuid,
        name: q.queue_name,
        extension: q.queue_extension,
        strategy: q.queue_strategy,
      })),
      extensions: extResult.rows.map(e => ({
        id: e.extension_uuid,
        extension: e.extension,
        name: e.effective_caller_id_name || e.description || `Ext ${e.extension}`,
      })),
      agents: agentResult.rows.map(a => ({
        id: a.call_center_agent_uuid,
        name: a.agent_name,
        agentId: a.agent_id,
        status: a.agent_status,
      })),
    });
  } catch (err) {
    console.error('Transfer destinations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- BLF Board: preferences + bulk live ----

router.get('/blf/prefs', authenticateToken, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'blf_queues'`,
      [req.user.id]
    );
    const queueIds = r.rows[0]?.setting_value ? JSON.parse(r.rows[0].setting_value) : [];
    res.json({ queueIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/blf/prefs', authenticateToken, async (req, res) => {
  try {
    const { queueIds } = req.body;
    if (!Array.isArray(queueIds)) return res.status(400).json({ error: 'queueIds must be an array' });
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value)
       VALUES ($1, 'blf_queues', $2)
       ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $2`,
      [req.user.id, JSON.stringify(queueIds)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/blf/live', authenticateToken, async (req, res) => {
  try {
    const { queueIds } = req.body;
    if (!Array.isArray(queueIds) || queueIds.length === 0) return res.json({ queues: [] });

    const qRows = await fpbx.query(
      `SELECT q.call_center_queue_uuid, q.queue_name, q.queue_extension, q.queue_strategy,
              d.domain_name
       FROM v_call_center_queues q
       JOIN v_domains d ON d.domain_uuid = q.domain_uuid
       WHERE q.call_center_queue_uuid = ANY($1::uuid[])`,
      [queueIds]
    );

    const results = await Promise.all(qRows.rows.map(async (q) => {
      const queueKey = `${q.queue_extension}@${q.domain_name}`;
      const [agentsRaw, membersRaw] = await Promise.all([
        runFsCli(`callcenter_config queue list agents ${queueKey}`),
        runFsCli(`callcenter_config queue list members ${queueKey}`),
      ]);

      const agentsParsed = [];
      if (agentsRaw && !agentsRaw.startsWith('+OK')) {
        const lines = agentsRaw.split('\n').filter(l => l.trim() && !l.startsWith('+OK'));
        const header = lines[0]?.split('|') || [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim() || lines[i].startsWith('+OK')) continue;
          const cols = lines[i].split('|');
          if (cols.length < 3) continue;
          const obj = {};
          header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').trim(); });
          agentsParsed.push(obj);
        }
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const agentUuids = agentsParsed.map(a => a.name).filter(n => n && uuidRegex.test(n));
      let nameMap = {};
      if (agentUuids.length > 0) {
        try {
          const nameResult = await fpbx.query(
            `SELECT call_center_agent_uuid, agent_name, agent_id
             FROM v_call_center_agents WHERE call_center_agent_uuid = ANY($1::uuid[])`,
            [agentUuids]
          );
          for (const r of nameResult.rows) nameMap[r.call_center_agent_uuid] = { agent_name: r.agent_name, agent_id: r.agent_id };
        } catch {}
      }

      const extensions = Object.values(nameMap).map(n => n.agent_id?.split('@')[0]).filter(Boolean);
      let emailMap = {};
      if (extensions.length > 0) {
        try {
          const emailResult = await db.query(
            `SELECT u.email, s.sip_username FROM users u JOIN sip_accounts s ON s.user_id = u.id WHERE s.sip_username = ANY($1::text[])`,
            [extensions]
          );
          for (const r of emailResult.rows) emailMap[r.sip_username] = r.email;
        } catch {}
      }

      const agents = agentsParsed
        .filter(a => a.name && uuidRegex.test(a.name))
        .map(a => {
          const ext = nameMap[a.name]?.agent_id?.split('@')[0] || '';
          return {
            uuid: a.name,
            display_name: nameMap[a.name]?.agent_name || ext || 'Agent',
            agent_id: nameMap[a.name]?.agent_id || '',
            extension: ext,
            email: emailMap[ext] || '',
            status: a.status || 'Unknown',
            state: a.state || 'Idle',
          };
        });

      const members = [];
      if (membersRaw && membersRaw !== '+OK') {
        const lines = membersRaw.split('\n');
        const header = lines[0]?.split('|') || [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = lines[i].split('|');
          const obj = {};
          header.forEach((h, idx) => { obj[h.trim()] = (cols[idx] || '').trim(); });
          members.push(obj);
        }
      }

      return {
        id: q.call_center_queue_uuid,
        name: q.queue_name,
        extension: q.queue_extension,
        strategy: q.queue_strategy,
        agents,
        waitingCount: members.length,
        members,
      };
    }));

    res.json({ queues: results });
  } catch (err) {
    console.error('BLF live error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- BLF Ping: send alert to agent ----

router.post('/blf/ping', authenticateToken, async (req, res) => {
  try {
    const { extension } = req.body;
    if (!extension) return res.status(400).json({ error: 'extension required' });

    const senderResult = await db.query('SELECT display_name, email FROM users WHERE id = $1', [req.user.id]);
    const senderName = senderResult.rows[0]?.display_name || senderResult.rows[0]?.email || 'Someone';

    const targetResult = await db.query(
      `SELECT u.id FROM users u JOIN sip_accounts s ON s.user_id = u.id WHERE s.sip_username = $1 AND u.tenant_id = $2`,
      [extension, req.user.tenant_id]
    );

    if (targetResult.rows.length === 0) return res.status(404).json({ error: 'Agent not found in app' });

    const { sendCommandToUser } = require('../ws');
    const sent = sendCommandToUser(targetResult.rows[0].id, {
      event: 'agentPing',
      from: senderName,
      fromExtension: req.body.fromExtension || '',
      message: req.body.message || `${senderName} is trying to reach you`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, delivered: sent });
  } catch (err) {
    console.error('BLF ping error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

