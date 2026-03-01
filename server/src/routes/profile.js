const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const AVATAR_DIR = path.join(__dirname, '..', '..', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, display_name, avatar_url FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    const chunks = [];
    let totalSize = 0;
    const MAX_SIZE = 2 * 1024 * 1024;

    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > MAX_SIZE) return res.status(413).json({ error: 'File too large (max 2MB)' });
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    if (buffer.length < 100) return res.status(400).json({ error: 'No file data received' });

    let ext = '.jpg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) ext = '.png';
    else if (buffer[0] === 0x47 && buffer[1] === 0x49) ext = '.gif';
    else if (buffer[0] === 0x52 && buffer[1] === 0x49) ext = '.webp';

    const filename = `${req.user.id}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filepath = path.join(AVATAR_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    const avatarUrl = `/avatars/${filename}`;

    // Remove old avatar file if exists
    const old = await db.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    if (old.rows[0]?.avatar_url) {
      const oldFile = path.join(AVATAR_DIR, path.basename(old.rows[0].avatar_url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);

    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    const old = await db.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    if (old.rows[0]?.avatar_url) {
      const oldFile = path.join(AVATAR_DIR, path.basename(old.rows[0].avatar_url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }
    await db.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
