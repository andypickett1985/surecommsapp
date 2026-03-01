const router = require('express').Router();
const db = require('../db');
const fpbx = require('../fpbx-db');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

const CALL_CENTER_SETTING_KEYS = ['call_center_enabled', 'call_center_mode', 'call_center_agent_uuid', 'call_center_agent_id'];

// Stats
router.get('/stats', async (req, res) => {
  try {
    const [domains, extensions, imported] = await Promise.all([
      fpbx.query('SELECT COUNT(*) as count FROM v_domains WHERE domain_enabled = $1', ['true']),
      fpbx.query('SELECT COUNT(*) as count FROM v_extensions WHERE enabled = $1', ['true']),
      db.query('SELECT COUNT(*) as count FROM tenants WHERE fpbx_domain_uuid IS NOT NULL'),
    ]);
    res.json({
      fpbx_domains: parseInt(domains.rows[0].count),
      fpbx_extensions: parseInt(extensions.rows[0].count),
      imported_orgs: parseInt(imported.rows[0].count),
    });
  } catch (err) { console.error('FPBX stats error:', err); res.status(500).json({ error: err.message }); }
});

// List all FusionPBX domains with extension counts + import status
router.get('/domains', async (req, res) => {
  try {
    const result = await fpbx.query(`
      SELECT d.domain_uuid, d.domain_name, d.domain_enabled,
        (SELECT COUNT(*) FROM v_extensions e WHERE e.domain_uuid = d.domain_uuid AND e.enabled = 'true') as extension_count
      FROM v_domains d
      WHERE d.domain_enabled = 'true'
      ORDER BY d.domain_name
    `);

    // Check which are already imported
    const imported = await db.query('SELECT fpbx_domain_uuid FROM tenants WHERE fpbx_domain_uuid IS NOT NULL');
    const importedSet = new Set(imported.rows.map(r => r.fpbx_domain_uuid));

    const domains = result.rows.map(d => ({
      ...d,
      extension_count: parseInt(d.extension_count),
      imported: importedSet.has(d.domain_uuid),
      display_name: d.domain_name.replace('.surecloudvoice.com', ''),
    }));

    res.json(domains);
  } catch (err) { console.error('FPBX domains error:', err); res.status(500).json({ error: err.message }); }
});

// List extensions for a specific FusionPBX domain
router.get('/domains/:uuid/extensions', async (req, res) => {
  try {
    const result = await fpbx.query(`
      SELECT e.extension_uuid, e.extension, e.password, e.effective_caller_id_name,
             e.effective_caller_id_number, e.enabled, e.description,
             e.directory_first_name, e.directory_last_name
      FROM v_extensions e
      WHERE e.domain_uuid = $1 AND e.enabled = 'true'
      ORDER BY e.extension
    `, [req.params.uuid]);

    // Check which are already imported
    const imported = await db.query('SELECT fpbx_extension_uuid FROM users WHERE fpbx_extension_uuid IS NOT NULL');
    const importedSet = new Set(imported.rows.map(r => r.fpbx_extension_uuid));

    const extensions = result.rows.map(e => ({
      ...e,
      display_name: e.effective_caller_id_name || [e.directory_first_name, e.directory_last_name].filter(Boolean).join(' ') || `Ext ${e.extension}`,
      imported: importedSet.has(e.extension_uuid),
    }));

    res.json(extensions);
  } catch (err) { console.error('FPBX extensions error:', err); res.status(500).json({ error: err.message }); }
});

// List call center agents (optionally by domain)
router.get('/call-center/agents', async (req, res) => {
  try {
    const { domain_uuid } = req.query;
    let result;
    if (domain_uuid) {
      result = await fpbx.query(
        `SELECT call_center_agent_uuid, domain_uuid, agent_name, agent_id, agent_contact, agent_status
         FROM v_call_center_agents
         WHERE domain_uuid = $1
         ORDER BY agent_id`,
        [domain_uuid]
      );
    } else {
      result = await fpbx.query(
        `SELECT call_center_agent_uuid, domain_uuid, agent_name, agent_id, agent_contact, agent_status
         FROM v_call_center_agents
         ORDER BY domain_uuid, agent_id`
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('FPBX call center agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get call center link state for a specific app user
router.get('/call-center/user-link/:userId', async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.display_name, u.tenant_id, t.fpbx_domain_uuid, s.sip_username
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN LATERAL (
        SELECT sip_username
        FROM sip_accounts
        WHERE user_id = u.id
        ORDER BY created_at
        LIMIT 1
      ) s ON true
       WHERE u.id = $1`,
      [req.params.userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    const settingsResult = await db.query(
      `SELECT setting_key, setting_value FROM user_settings
       WHERE user_id = $1 AND setting_key = ANY($2::text[])`,
      [req.params.userId, CALL_CENTER_SETTING_KEYS]
    );
    const settings = {};
    settingsResult.rows.forEach(r => { settings[r.setting_key] = r.setting_value; });

    let linkedAgent = null;
    if (settings.call_center_agent_uuid) {
      const agentResult = await fpbx.query(
        `SELECT call_center_agent_uuid, domain_uuid, agent_name, agent_id, agent_contact, agent_status
         FROM v_call_center_agents
         WHERE call_center_agent_uuid = $1`,
        [settings.call_center_agent_uuid]
      );
      linkedAgent = agentResult.rows[0] || null;
    }

    let autoDetectedAgent = null;
    if (user.fpbx_domain_uuid && user.sip_username) {
      const autoResult = await fpbx.query(
        `SELECT call_center_agent_uuid, domain_uuid, agent_name, agent_id, agent_contact, agent_status
         FROM v_call_center_agents
         WHERE domain_uuid = $1 AND agent_id = $2
         LIMIT 1`,
        [user.fpbx_domain_uuid, String(user.sip_username)]
      );
      autoDetectedAgent = autoResult.rows[0] || null;
    }

    res.json({
      enabled: settings.call_center_enabled === 'true',
      mode: settings.call_center_mode || 'auto',
      linkedAgent,
      autoDetectedAgent,
      sip_username: user.sip_username || '',
      fpbx_domain_uuid: user.fpbx_domain_uuid || null,
    });
  } catch (err) {
    console.error('FPBX call center user-link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Link/unlink app user to a FusionPBX call center agent
router.put('/call-center/user-link/:userId', async (req, res) => {
  try {
    const { enabled, mode, call_center_agent_uuid } = req.body;
    const userId = req.params.userId;

    const userResult = await db.query(
      `SELECT u.id, u.tenant_id, s.sip_username, t.fpbx_domain_uuid
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN LATERAL (
        SELECT sip_username
        FROM sip_accounts
        WHERE user_id = u.id
        ORDER BY created_at
        LIMIT 1
      ) s ON true
       WHERE u.id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    if (!enabled) {
      await db.query(
        `DELETE FROM user_settings
         WHERE user_id = $1 AND setting_key = ANY($2::text[])`,
        [userId, CALL_CENTER_SETTING_KEYS]
      );
      return res.json({ success: true, enabled: false });
    }

    let agent = null;
    const selectedMode = mode === 'manual' ? 'manual' : 'auto';
    if (selectedMode === 'manual') {
      if (!call_center_agent_uuid) return res.status(400).json({ error: 'call_center_agent_uuid required in manual mode' });
      const agentResult = await fpbx.query(
        `SELECT call_center_agent_uuid, agent_id, agent_name, domain_uuid
         FROM v_call_center_agents
         WHERE call_center_agent_uuid = $1`,
        [call_center_agent_uuid]
      );
      if (agentResult.rows.length === 0) return res.status(404).json({ error: 'Call center agent not found' });
      agent = agentResult.rows[0];
    } else {
      if (!user.fpbx_domain_uuid || !user.sip_username) {
        return res.status(400).json({ error: 'Auto mode requires linked FusionPBX domain and SIP username' });
      }
      const autoResult = await fpbx.query(
        `SELECT call_center_agent_uuid, agent_id, agent_name, domain_uuid
         FROM v_call_center_agents
         WHERE domain_uuid = $1 AND agent_id = $2
         LIMIT 1`,
        [user.fpbx_domain_uuid, String(user.sip_username)]
      );
      if (autoResult.rows.length === 0) {
        return res.status(404).json({ error: `No call center agent found for extension ${user.sip_username}` });
      }
      agent = autoResult.rows[0];
    }

    const kv = [
      ['call_center_enabled', 'true'],
      ['call_center_mode', selectedMode],
      ['call_center_agent_uuid', agent.call_center_agent_uuid],
      ['call_center_agent_id', agent.agent_id || ''],
    ];
    for (const [key, value] of kv) {
      await db.query(
        `INSERT INTO user_settings (user_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3`,
        [userId, key, String(value)]
      );
    }

    res.json({
      success: true,
      enabled: true,
      mode: selectedMode,
      linkedAgent: agent,
    });
  } catch (err) {
    console.error('FPBX call center user-link update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import a FusionPBX domain as a SureCloudVoice organization
router.post('/import-org', async (req, res) => {
  try {
    const { domain_uuid } = req.body;
    if (!domain_uuid) return res.status(400).json({ error: 'domain_uuid required' });

    // Check not already imported
    const existing = await db.query('SELECT id FROM tenants WHERE fpbx_domain_uuid = $1', [domain_uuid]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Domain already imported', org_id: existing.rows[0].id });

    // Get domain info from FusionPBX
    const domainResult = await fpbx.query('SELECT domain_name, domain_enabled FROM v_domains WHERE domain_uuid = $1', [domain_uuid]);
    if (domainResult.rows.length === 0) return res.status(404).json({ error: 'Domain not found in FusionPBX' });

    const domain = domainResult.rows[0];
    const displayName = domain.domain_name.replace('.surecloudvoice.com', '');
    const sipDomain = domain.domain_name;

    // Create organization in SureCloudVoice
    const orgResult = await db.query(
      `INSERT INTO tenants (name, domain, sip_domain, sip_port, sip_protocol, fpbx_domain_uuid, fpbx_synced_at, region, active)
       VALUES ($1, $2, $3, 5060, 'udp', $4, NOW(), 'Europe (London)', true) RETURNING *`,
      [displayName, sipDomain, sipDomain, domain_uuid]
    );
    const org = orgResult.rows[0];

    // Seed default feature settings
    await db.query(`INSERT INTO org_settings (tenant_id, setting_key, setting_value)
      SELECT $1, s.key, s.val FROM (VALUES
        ('enable_sms','false'),('allow_video','true'),('allow_chat','true'),('allow_recording','false'),
        ('allow_state_change','true'),('allow_call_settings','true'),('allow_block_numbers','true'),
        ('allow_password_change','true'),('screenshot_prevention','false'),('auto_answer','false'),('ai_enabled','false')
      ) AS s(key,val) ON CONFLICT DO NOTHING`, [org.id]);

    // Get all enabled extensions for this domain
    const extResult = await fpbx.query(`
      SELECT extension_uuid, extension, password, effective_caller_id_name,
             directory_first_name, directory_last_name, description
      FROM v_extensions
      WHERE domain_uuid = $1 AND enabled = 'true'
      ORDER BY extension
    `, [domain_uuid]);

    let importedCount = 0;
    let skippedCount = 0;

    for (const ext of extResult.rows) {
      const name = ext.effective_caller_id_name || [ext.directory_first_name, ext.directory_last_name].filter(Boolean).join(' ') || `Extension ${ext.extension}`;
      const email = `${ext.extension}@${sipDomain}`;
      const appPassword = generatePassword();

      try {
        // Create user
        const hash = await bcrypt.hash(appPassword, 10);
        const userResult = await db.query(
          `INSERT INTO users (email, password_hash, display_name, tenant_id, fpbx_extension_uuid)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [email.toLowerCase(), hash, name, org.id, ext.extension_uuid]
        );

        // Create SIP account
        await db.query(
          `INSERT INTO sip_accounts (user_id, sip_server, sip_username, sip_password, sip_domain, auth_id, display_name, label, transport)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userResult.rows[0].id, sipDomain, ext.extension, ext.password, sipDomain, ext.extension, name, 'Main', 'udp']
        );

        importedCount++;
      } catch (e) {
        if (e.code === '23505') skippedCount++; // duplicate email
        else console.error(`Import ext ${ext.extension} error:`, e.message);
      }
    }

    res.status(201).json({
      org_id: org.id,
      org_name: displayName,
      domain: sipDomain,
      extensions_imported: importedCount,
      extensions_skipped: skippedCount,
      total_extensions: extResult.rows.length,
    });
  } catch (err) { console.error('Import org error:', err); res.status(500).json({ error: err.message }); }
});

// Re-sync an existing org with FusionPBX
router.post('/sync-org/:orgId', async (req, res) => {
  try {
    const orgResult = await db.query('SELECT * FROM tenants WHERE id = $1', [req.params.orgId]);
    if (orgResult.rows.length === 0) return res.status(404).json({ error: 'Org not found' });
    const org = orgResult.rows[0];
    if (!org.fpbx_domain_uuid) return res.status(400).json({ error: 'Org not linked to FusionPBX' });

    // Get current extensions from FusionPBX
    const fpbxExts = await fpbx.query(
      `SELECT extension_uuid, extension, password, effective_caller_id_name, directory_first_name, directory_last_name
       FROM v_extensions WHERE domain_uuid = $1 AND enabled = 'true'`,
      [org.fpbx_domain_uuid]
    );

    // Get existing imported users
    const existingUsers = await db.query(
      'SELECT fpbx_extension_uuid FROM users WHERE tenant_id = $1 AND fpbx_extension_uuid IS NOT NULL',
      [org.id]
    );
    const existingSet = new Set(existingUsers.rows.map(r => r.fpbx_extension_uuid));

    let added = 0, skipped = 0;

    for (const ext of fpbxExts.rows) {
      if (existingSet.has(ext.extension_uuid)) { skipped++; continue; }

      const name = ext.effective_caller_id_name || [ext.directory_first_name, ext.directory_last_name].filter(Boolean).join(' ') || `Extension ${ext.extension}`;
      const email = `${ext.extension}@${org.domain || org.sip_domain}`;
      const appPassword = generatePassword();

      try {
        const hash = await bcrypt.hash(appPassword, 10);
        const userResult = await db.query(
          `INSERT INTO users (email, password_hash, display_name, tenant_id, fpbx_extension_uuid)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [email.toLowerCase(), hash, name, org.id, ext.extension_uuid]
        );
        await db.query(
          `INSERT INTO sip_accounts (user_id, sip_server, sip_username, sip_password, sip_domain, auth_id, display_name, label, transport)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [userResult.rows[0].id, org.sip_domain, ext.extension, ext.password, org.sip_domain, ext.extension, name, 'Main', 'udp']
        );
        added++;
      } catch (e) {
        if (e.code !== '23505') console.error(`Sync ext ${ext.extension}:`, e.message);
      }
    }

    await db.query('UPDATE tenants SET fpbx_synced_at = NOW() WHERE id = $1', [org.id]);

    res.json({ added, skipped, total_fpbx: fpbxExts.rows.length });
  } catch (err) { console.error('Sync error:', err); res.status(500).json({ error: err.message }); }
});

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

module.exports = router;
