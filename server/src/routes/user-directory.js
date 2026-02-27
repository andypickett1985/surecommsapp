const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.display_name, s.sip_username as extension, s.display_name as sip_display_name,
              COALESCE(p.status, 'offline') as presence, p.status_text, p.last_seen
       FROM users u
       LEFT JOIN sip_accounts s ON s.user_id = u.id AND s.active = true
       LEFT JOIN user_presence p ON p.user_id = u.id
       WHERE u.tenant_id = $1 AND u.active = true
       ORDER BY u.display_name, u.email`,
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Directory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/presence', authenticateToken, async (req, res) => {
  try {
    const { status, status_text } = req.body;
    await db.query(
      `INSERT INTO user_presence (user_id, status, status_text, last_seen, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET status = $2, status_text = $3, last_seen = NOW(), updated_at = NOW()`,
      [req.user.id, status || 'online', status_text || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Presence error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
