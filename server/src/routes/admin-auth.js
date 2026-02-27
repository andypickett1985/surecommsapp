const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config({ path: __dirname + '/../../.env' });

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await db.query(
      'SELECT a.*, t.name as tenant_name FROM admins a LEFT JOIN tenants t ON a.tenant_id = t.id WHERE a.email = $1 AND a.active = true',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      tenant_id: admin.tenant_id,
      role: admin.role,
      name: admin.name,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, tenant: admin.tenant_name },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
