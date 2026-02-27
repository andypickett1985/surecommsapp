const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOWNLOADS_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

router.post('/', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    name: req.file.originalname,
    size: req.file.size,
    url: `/downloads/${encodeURIComponent(req.file.originalname)}`,
  });
});

module.exports = router;
