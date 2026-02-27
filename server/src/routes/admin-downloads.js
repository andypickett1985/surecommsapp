const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

router.get('/list', authenticateToken, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }
    const files = fs.readdirSync(DOWNLOADS_DIR).map(name => {
      const stat = fs.statSync(path.join(DOWNLOADS_DIR, name));
      return {
        name,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        url: `/downloads/${encodeURIComponent(name)}`,
      };
    });
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(files);
  } catch (err) {
    console.error('List downloads error:', err);
    res.status(500).json({ error: 'Failed to list downloads' });
  }
});

router.delete('/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('Delete download error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Public download page data (no auth required)
router.get('/public', (req, res) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(DOWNLOADS_DIR).map(name => {
      const stat = fs.statSync(path.join(DOWNLOADS_DIR, name));
      return {
        name,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        url: `/downloads/${encodeURIComponent(name)}`,
      };
    });
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list downloads' });
  }
});

module.exports = router;
