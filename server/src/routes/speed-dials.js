const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sd.*, u.display_name as target_name, u.email as target_email,
              s.sip_username as target_extension,
              COALESCE(p.status, 'offline') as target_presence
       FROM speed_dials sd
       LEFT JOIN users u ON u.id = sd.target_user_id
       LEFT JOIN sip_accounts s ON s.user_id = sd.target_user_id AND s.active = true
       LEFT JOIN user_presence p ON p.user_id = sd.target_user_id
       WHERE sd.user_id = $1 ORDER BY sd.position`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { target_user_id, target_number, label, position, blf } = req.body;
    const result = await db.query(
      'INSERT INTO speed_dials (user_id, target_user_id, target_number, label, position, blf) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, target_user_id || null, target_number || null, label, position || 0, blf || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM speed_dials WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
