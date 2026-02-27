const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendCommandToTenant, clients } = require('../ws');

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM app_versions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { version, platform, download_url, release_notes, force_update } = req.body;
    if (!version) return res.status(400).json({ error: 'Version required' });
    const result = await db.query(
      'INSERT INTO app_versions (version, platform, download_url, release_notes, force_update, published) VALUES ($1,$2,$3,$4,$5,true) RETURNING *',
      [version, platform || 'windows', download_url || `https://communicator.surecloudvoice.com/downloads/SureCloudVoice-Setup-${version}.exe`, release_notes || '', force_update || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/push', async (req, res) => {
  try {
    const ver = await db.query('SELECT * FROM app_versions WHERE id = $1', [req.params.id]);
    if (ver.rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    const v = ver.rows[0];
    let count = 0;
    clients.forEach((sockets) => {
      sockets.forEach(ws => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ event: 'updateAvailable', version: v.version, downloadUrl: v.download_url, force: v.force_update, releaseNotes: v.release_notes }));
          count++;
        }
      });
    });
    res.json({ success: true, notified: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM app_versions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public endpoint for apps to check updates
router.get('/check', async (req, res) => {
  try {
    const result = await db.query("SELECT version, download_url, force_update, release_notes FROM app_versions WHERE published=true ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length === 0) return res.json({ update: false });
    res.json({ update: true, ...result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
