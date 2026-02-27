const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.active = true) as active_users
       FROM tenants t ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const org = await db.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    if (org.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const users = await db.query(
      `SELECT u.id, u.email, u.display_name, u.active, u.created_at,
              s.sip_username, s.sip_server, s.display_name as sip_display_name, s.sip_password, s.auth_id,
              COALESCE(p.status, 'offline') as presence
       FROM users u
       LEFT JOIN sip_accounts s ON s.user_id = u.id AND s.active = true
       LEFT JOIN user_presence p ON p.user_id = u.id
       WHERE u.tenant_id = $1 ORDER BY u.display_name, u.email`,
      [req.params.id]
    );

    const settings = await db.query('SELECT setting_key, setting_value FROM org_settings WHERE tenant_id = $1', [req.params.id]);
    const settingsMap = {};
    settings.rows.forEach(s => { settingsMap[s.setting_key] = s.setting_value; });

    const blf = await db.query('SELECT * FROM blf_buttons WHERE tenant_id = $1 ORDER BY position', [req.params.id]);

    res.json({ ...org.rows[0], users: users.rows, settings: settingsMap, blf_buttons: blf.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, domain, region, package: pkg, sip_domain, sip_port, sip_protocol, country_code } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const result = await db.query(
      `INSERT INTO tenants (name, domain, region, package, sip_domain, sip_port, sip_protocol, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, domain||null, region||'Europe (London)', pkg||'essentials', sip_domain||null, sip_port||5060, sip_protocol||'udp', country_code||'+44']
    );
    // Seed default settings
    const tid = result.rows[0].id;
    await db.query(`INSERT INTO org_settings (tenant_id, setting_key, setting_value)
      SELECT $1, s.key, s.val FROM (VALUES
        ('enable_sms','false'),('allow_video','true'),('allow_chat','true'),('allow_recording','false'),
        ('allow_state_change','true'),('allow_call_settings','true'),('allow_block_numbers','true'),
        ('allow_password_change','true'),('screenshot_prevention','false'),('auto_answer','false'),
        ('ai_enabled','false')
      ) AS s(key,val) ON CONFLICT DO NOTHING`, [tid]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const fields = ['name','domain','region','package','sip_domain','sip_port','sip_protocol','country_code',
                     'connection_name','sip_proxy','ringback_tone','max_registrations','multi_tenant_mode',
                     'opus_codec','https_proxy','active'];
    const updates = []; const params = []; let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${idx++}`); params.push(req.body[f]); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    params.push(req.params.id);
    const result = await db.query(`UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// Settings
router.get('/:id/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT setting_key, setting_value FROM org_settings WHERE tenant_id = $1', [req.params.id]);
    const map = {};
    result.rows.forEach(s => { map[s.setting_key] = s.setting_value; });
    res.json(map);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await db.query(
        `INSERT INTO org_settings (tenant_id, setting_key, setting_value) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = $3`,
        [req.params.id, key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// BLF Buttons
router.get('/:id/blf', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM blf_buttons WHERE tenant_id = $1 ORDER BY position', [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/blf', async (req, res) => {
  try {
    const { label, number, btn_type, position, url } = req.body;
    const result = await db.query(
      'INSERT INTO blf_buttons (tenant_id, label, number, btn_type, position, url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id, label, number||null, btn_type||'speeddial', position||0, url||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id/blf/:btnId', async (req, res) => {
  try {
    await db.query('DELETE FROM blf_buttons WHERE id = $1 AND tenant_id = $2', [req.params.btnId, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
