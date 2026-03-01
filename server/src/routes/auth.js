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
      `SELECT u.*, u.avatar_url, t.name as tenant_name, t.domain as tenant_domain, t.sip_domain as org_sip_domain, t.sip_protocol as org_protocol
       FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = $1 AND u.active = true AND t.active = true`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const sipResult = await db.query('SELECT * FROM sip_accounts WHERE user_id = $1 AND active = true ORDER BY created_at ASC', [user.id]);

    const tokenPayload = { id: user.id, email: user.email, tenant_id: user.tenant_id, role: 'user' };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY });

    const sipAccounts = sipResult.rows.map(a => ({
      label: a.label, server: a.sip_server || user.org_sip_domain || '', proxy: a.sip_proxy || '',
      domain: a.sip_domain || user.org_sip_domain || '', username: a.sip_username, password: a.sip_password,
      authID: a.auth_id || '', displayName: a.display_name || user.display_name || '',
      voicemailNumber: a.voicemail_number || '', dialingPrefix: a.dialing_prefix || '', dialPlan: a.dial_plan || '',
      transport: a.transport || user.org_protocol || 'udp', srtp: a.srtp || 'disabled', publicAddr: a.public_addr || '',
      registerRefresh: a.register_refresh || 300, keepAlive: a.keep_alive || 15,
      publish: a.publish || false, ice: a.ice || false, allowRewrite: a.allow_rewrite !== false,
      disableSessionTimer: a.disable_session_timer || false, hideCID: a.hide_cid || false, configVersion: a.config_version || 1,
    }));

    res.json({
      token, refreshToken,
      user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url || null, tenant: user.tenant_name },
      sipAccounts,
    });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await db.query('SELECT id, email, tenant_id FROM users WHERE id = $1 AND active = true', [payload.id]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = result.rows[0];
    const tokenPayload = { id: user.id, email: user.email, tenant_id: user.tenant_id, role: 'user' };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY });
    const newRefresh = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY });
    res.json({ token, refreshToken: newRefresh });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(403).json({ error: 'Invalid token' });
    console.error('Refresh error:', err); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
