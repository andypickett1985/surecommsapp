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

async function getStatusOptions() {
  try {
    const result = await fpbx.query(
      `SELECT DISTINCT agent_status
       FROM v_call_center_agents
       WHERE agent_status IS NOT NULL AND agent_status <> ''
       ORDER BY agent_status`
    );
    const fromDb = result.rows.map(r => r.agent_status);
    const merged = Array.from(new Set([...DEFAULT_STATUSES, ...fromDb]));
    return merged;
  } catch {
    return DEFAULT_STATUSES;
  }
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    const enabled = settings.call_center_enabled === 'true';
    if (!enabled) {
      return res.json({ enabled: false, statuses: await getStatusOptions() });
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
      statuses: await getStatusOptions(),
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

module.exports = router;

