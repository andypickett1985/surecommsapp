const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'superadmin') {
      query = `SELECT t.*, (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count FROM tenants t ORDER BY t.name`;
      params = [];
    } else {
      query = `SELECT t.*, (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count FROM tenants t WHERE t.id = $1`;
      params = [req.user.tenant_id];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List tenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Super admin required' });
    const { name, domain } = req.body;
    if (!name) return res.status(400).json({ error: 'Tenant name required' });

    const result = await db.query(
      'INSERT INTO tenants (name, domain) VALUES ($1, $2) RETURNING *',
      [name, domain || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, domain, active } = req.body;
    if (req.user.role !== 'superadmin' && req.user.tenant_id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await db.query(
      'UPDATE tenants SET name = COALESCE($1, name), domain = COALESCE($2, domain), active = COALESCE($3, active), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, domain, active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Super admin required' });
    await db.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
