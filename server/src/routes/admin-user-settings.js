const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/:userId', async (req, res) => {
  try {
    const result = await db.query('SELECT setting_key, setting_value FROM user_settings WHERE user_id = $1', [req.params.userId]);
    const map = {};
    result.rows.forEach(s => { map[s.setting_key] = s.setting_value; });
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:userId', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (value === null || value === '') {
        await db.query('DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2', [req.params.userId, key]);
      } else {
        await db.query(
          `INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3`,
          [req.params.userId, key, String(value)]
        );
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
