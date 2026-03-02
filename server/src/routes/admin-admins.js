const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

function requireSuperadmin(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
  next();
}

router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'superadmin') {
      query = `SELECT a.id, a.email, a.name, a.role, a.active, a.tenant_id, a.created_at, a.updated_at,
                      t.name as tenant_name
               FROM admins a LEFT JOIN tenants t ON t.id = a.tenant_id
               ORDER BY a.role DESC, a.name`;
      params = [];
    } else {
      query = `SELECT a.id, a.email, a.name, a.role, a.active, a.tenant_id, a.created_at, a.updated_at,
                      t.name as tenant_name
               FROM admins a LEFT JOIN tenants t ON t.id = a.tenant_id
               WHERE a.tenant_id = $1
               ORDER BY a.name`;
      params = [req.user.tenant_id];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.email, a.name, a.role, a.active, a.tenant_id, a.created_at,
              t.name as tenant_name
       FROM admins a LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireSuperadmin, async (req, res) => {
  try {
    const { email, password, name, role, tenant_id } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });

    const validRole = role === 'superadmin' ? 'superadmin' : 'admin';
    const hash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO admins (email, password_hash, name, role, tenant_id, active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, name, role, tenant_id, active, created_at`,
      [email.toLowerCase(), hash, name, validRole, tenant_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const target = await db.query('SELECT * FROM admins WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

    // Non-superadmins can only edit themselves
    if (req.user.role !== 'superadmin' && req.params.id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own profile' });
    }

    const { email, password, name, role, tenant_id, active } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (email) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (password) { updates.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, 12)); }
    if (name) { updates.push(`name = $${idx++}`); params.push(name); }
    if (role !== undefined && req.user.role === 'superadmin') { updates.push(`role = $${idx++}`); params.push(role === 'superadmin' ? 'superadmin' : 'admin'); }
    if (tenant_id !== undefined && req.user.role === 'superadmin') { updates.push(`tenant_id = $${idx++}`); params.push(tenant_id || null); }
    if (active !== undefined && req.user.role === 'superadmin') { updates.push(`active = $${idx++}`); params.push(!!active); }
    updates.push('updated_at = NOW()');

    if (updates.length <= 1) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const result = await db.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, tenant_id, active, updated_at`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireSuperadmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await db.query('DELETE FROM admins WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current admin profile
router.get('/me/profile', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.email, a.name, a.role, a.tenant_id, t.name as tenant_name
       FROM admins a LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
