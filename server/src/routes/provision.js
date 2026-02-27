const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const sipResult = await db.query(
      'SELECT s.*, t.sip_domain as org_sip_domain, t.sip_protocol as org_protocol FROM sip_accounts s JOIN users u ON s.user_id = u.id JOIN tenants t ON u.tenant_id = t.id WHERE s.user_id = $1 AND s.active = true ORDER BY s.created_at ASC',
      [req.user.id]
    );
    const userResult = await db.query(
      'SELECT u.display_name, t.name as tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0] || {};
    const sipAccounts = sipResult.rows.map(a => ({
      label: a.label, server: a.sip_server || a.org_sip_domain || '', proxy: a.sip_proxy || '',
      domain: a.sip_domain || a.org_sip_domain || '', username: a.sip_username, password: a.sip_password,
      authID: a.auth_id || '', displayName: a.display_name || user.display_name || '',
      voicemailNumber: a.voicemail_number || '', dialingPrefix: a.dialing_prefix || '', dialPlan: a.dial_plan || '',
      transport: a.transport || a.org_protocol || 'udp', srtp: a.srtp || 'disabled', publicAddr: a.public_addr || '',
      registerRefresh: a.register_refresh || 300, keepAlive: a.keep_alive || 15,
      publish: a.publish || false, ice: a.ice || false, allowRewrite: a.allow_rewrite !== false,
      disableSessionTimer: a.disable_session_timer || false, hideCID: a.hide_cid || false, configVersion: a.config_version || 1,
    }));
    res.json({ user: { displayName: user.display_name, tenant: user.tenant_name }, sipAccounts });
  } catch (err) { console.error('Provision error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/check-update', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT COALESCE(MAX(config_version), 0) as version FROM sip_accounts WHERE user_id = $1 AND active = true', [req.user.id]);
    res.json({ configVersion: result.rows[0].version });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
