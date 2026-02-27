const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'superadmin') {
      query = `SELECT u.id, u.email, u.display_name, u.active, u.created_at, u.tenant_id, t.name as tenant_name,
               (SELECT COUNT(*) FROM sip_accounts s WHERE s.user_id = u.id) as sip_count
               FROM users u JOIN tenants t ON u.tenant_id = t.id ORDER BY t.name, u.email`;
      params = [];
    } else {
      query = `SELECT u.id, u.email, u.display_name, u.active, u.created_at, u.tenant_id, t.name as tenant_name,
               (SELECT COUNT(*) FROM sip_accounts s WHERE s.user_id = u.id) as sip_count
               FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = $1 ORDER BY u.email`;
      params = [req.user.tenant_id];
    }
    res.json((await db.query(query, params)).rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.display_name, u.active, u.tenant_id, u.created_at, t.name as tenant_name
       FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const sipResult = await db.query('SELECT * FROM sip_accounts WHERE user_id = $1 ORDER BY created_at', [req.params.id]);
    res.json({ ...result.rows[0], sipAccounts: sipResult.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { email, password, display_name, tenant_id, sip_extension, sip_password, sip_username, auth_id } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
    if (!tid) return res.status(400).json({ error: 'Tenant ID required' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, display_name, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [email.toLowerCase(), hash, display_name || null, tid]
    );
    const user = result.rows[0];

    // Auto-create SIP account using org connection settings
    if (sip_extension || sip_username) {
      const org = await db.query('SELECT sip_domain, sip_port, sip_protocol, name FROM tenants WHERE id = $1', [tid]);
      const orgData = org.rows[0] || {};
      const sipServer = orgData.sip_domain || '';
      await db.query(
        `INSERT INTO sip_accounts (user_id, sip_server, sip_username, sip_password, sip_domain, auth_id, display_name, label, transport)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [user.id, sipServer, sip_username || sip_extension, sip_password || '', sipServer, auth_id || sip_username || sip_extension, display_name || '', 'Main', orgData.sip_protocol || 'udp']
      );
    }

    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err); res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { email, password, display_name, active, sip_extension, sip_password, sip_username, auth_id } = req.body;
    const updates = []; const params = []; let idx = 1;
    if (email) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (password) { updates.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, 12)); }
    if (display_name !== undefined) { updates.push(`display_name = $${idx++}`); params.push(display_name); }
    if (active !== undefined) { updates.push(`active = $${idx++}`); params.push(active); }
    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);
    const result = await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Update SIP account if SIP fields provided
    if (sip_extension || sip_username || sip_password) {
      const user = result.rows[0];
      const org = await db.query('SELECT sip_domain, sip_protocol FROM tenants WHERE id = $1', [user.tenant_id]);
      const orgData = org.rows[0] || {};
      const sipServer = orgData.sip_domain || '';

      const existing = await db.query('SELECT id FROM sip_accounts WHERE user_id = $1 LIMIT 1', [req.params.id]);
      if (existing.rows.length > 0) {
        const sipUpdates = []; const sipParams = []; let si = 1;
        if (sip_username || sip_extension) { sipUpdates.push(`sip_username = $${si++}`); sipParams.push(sip_username || sip_extension); }
        if (sip_password) { sipUpdates.push(`sip_password = $${si++}`); sipParams.push(sip_password); }
        if (auth_id) { sipUpdates.push(`auth_id = $${si++}`); sipParams.push(auth_id); }
        if (sipServer) { sipUpdates.push(`sip_server = $${si++}`); sipParams.push(sipServer); sipUpdates.push(`sip_domain = $${si++}`); sipParams.push(sipServer); }
        sipUpdates.push(`updated_at = NOW()`);
        sipUpdates.push(`config_version = config_version + 1`);
        sipParams.push(existing.rows[0].id);
        await db.query(`UPDATE sip_accounts SET ${sipUpdates.join(', ')} WHERE id = $${si}`, sipParams);
      } else {
        await db.query(
          `INSERT INTO sip_accounts (user_id, sip_server, sip_username, sip_password, sip_domain, auth_id, display_name, label, transport)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.params.id, sipServer, sip_username || sip_extension, sip_password || '', sipServer, auth_id || '', display_name || '', 'Main', orgData.sip_protocol || 'udp']
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
