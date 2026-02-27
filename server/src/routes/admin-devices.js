const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendCommandToUser, sendCommandToTenant, getOnlineUsers } = require('../ws');

router.use(authenticateToken, requireAdmin);

// List devices for an org
router.get('/org/:orgId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.email, u.display_name FROM devices d
       JOIN users u ON u.id = d.user_id
       WHERE u.tenant_id = $1 ORDER BY d.last_seen DESC`,
      [req.params.orgId]
    );
    const online = getOnlineUsers();
    const devices = result.rows.map(d => ({
      ...d,
      online: !!online[d.user_id],
    }));
    res.json(devices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force logout a user
router.post('/force-logout/:userId', async (req, res) => {
  try {
    const sent = sendCommandToUser(req.params.userId, { event: 'forceLogout' });
    res.json({ success: true, delivered: sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Wipe device config for a user
router.post('/wipe/:userId', async (req, res) => {
  try {
    const sent = sendCommandToUser(req.params.userId, { event: 'wipeConfig' });
    res.json({ success: true, delivered: sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force logout all users in an org
router.post('/force-logout-all/:orgId', async (req, res) => {
  try {
    const count = sendCommandToTenant(req.params.orgId, { event: 'forceLogout' });
    res.json({ success: true, devices_notified: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Push config update to all org users
router.post('/push-config/:orgId', async (req, res) => {
  try {
    const settings = await db.query('SELECT setting_key, setting_value FROM org_settings WHERE tenant_id = $1', [req.params.orgId]);
    const map = {};
    settings.rows.forEach(s => { map[s.setting_key] = s.setting_value; });
    const count = sendCommandToTenant(req.params.orgId, { event: 'pushConfig', settings: map });
    res.json({ success: true, devices_notified: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force restart a user's app
router.post('/restart/:userId', async (req, res) => {
  try {
    const sent = sendCommandToUser(req.params.userId, { event: 'forceRestart' });
    res.json({ success: true, delivered: sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get online status summary
router.get('/online', async (req, res) => {
  try {
    const online = getOnlineUsers();
    res.json({ online_users: Object.keys(online).length, details: online });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
