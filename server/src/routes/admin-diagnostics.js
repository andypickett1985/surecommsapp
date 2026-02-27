const router = require('express').Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendCommandToUser } = require('../ws');

router.use(authenticateToken, requireAdmin);

const PBX_NODES = [
  { id: 'edge1', name: 'Edge1', ip: '13.41.211.239' },
  { id: 'edge2', name: 'Edge2', ip: '13.41.98.214' },
  { id: 'edge3', name: 'Edge3', ip: '18.169.36.148' },
  { id: 'edge4', name: 'Edge4', ip: '3.9.212.87' },
  { id: 'edge5', name: 'Edge5', ip: '3.11.44.219' },
];

router.get('/nodes', (req, res) => res.json(PBX_NODES));

// Request app SIP log from a user's device
router.post('/request-log/:userId', async (req, res) => {
  try {
    const sent = sendCommandToUser(req.params.userId, { event: 'requestSipLog', duration: req.body.duration || 30 });
    if (sent) {
      await db.query(
        "INSERT INTO diagnostic_logs (user_id, tenant_id, log_type, status) VALUES ($1, (SELECT tenant_id FROM users WHERE id=$1), 'sip_log', 'pending')",
        [req.params.userId]
      );
      res.json({ success: true, message: 'Log request sent to device' });
    } else {
      res.json({ success: false, message: 'Device not online' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start SIP capture on a PBX node via SSH
router.post('/sip-capture', async (req, res) => {
  try {
    const { node_id, extension, duration } = req.body;
    const node = PBX_NODES.find(n => n.id === node_id);
    if (!node) return res.status(400).json({ error: 'Invalid node' });
    if (!extension) return res.status(400).json({ error: 'Extension required' });
    const dur = Math.min(parseInt(duration) || 10, 60);

    const logEntry = await db.query(
      "INSERT INTO diagnostic_logs (tenant_id, log_type, node, extension, duration, status) VALUES ($1, 'sip_capture', $2, $3, $4, 'capturing') RETURNING id",
      [req.user.tenant_id || null, node.name, extension, dur]
    );
    const logId = logEntry.rows[0].id;

    // Run tcpdump via SSH in background
    const { Client } = require('ssh2');
    const ssh = new Client();
    const captureFile = `/tmp/sip-capture-${logId}.pcap`;

    ssh.on('ready', () => {
      const cmd = `timeout ${dur} tcpdump -i any -s 0 -w ${captureFile} 'port 5060 or port 5061' 2>/dev/null; echo DONE`;
      ssh.exec(cmd, (err, stream) => {
        if (err) { ssh.end(); return; }
        stream.on('close', async () => {
          // Download the capture
          ssh.sftp((err, sftp) => {
            if (err) { ssh.end(); return; }
            const localDir = path.join(__dirname, '..', '..', 'diagnostic-logs');
            if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
            const localFile = path.join(localDir, `sip-capture-${logId}.pcap`);

            sftp.fastGet(captureFile, localFile, async (err) => {
              if (!err) {
                const stat = fs.statSync(localFile);
                await db.query(
                  "UPDATE diagnostic_logs SET status='complete', filename=$1, file_path=$2, file_size=$3 WHERE id=$4",
                  [`sip-capture-${logId}.pcap`, localFile, stat.size, logId]
                );
              } else {
                await db.query("UPDATE diagnostic_logs SET status='failed' WHERE id=$1", [logId]);
              }
              ssh.exec(`rm -f ${captureFile}`, () => ssh.end());
            });
          });
        });
      });
    });

    ssh.on('error', async () => {
      await db.query("UPDATE diagnostic_logs SET status='failed' WHERE id=$1", [logId]);
    });

    ssh.connect({ host: node.ip, port: 22, username: 'root', password: 'RedSpoon2022!!' });

    res.json({ success: true, log_id: logId, message: `Capturing SIP traffic on ${node.name} for ${dur}s` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List diagnostic logs
router.get('/logs', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.display_name, u.email FROM diagnostic_logs d
       LEFT JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Download a log file
router.get('/logs/:id/download', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM diagnostic_logs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0 || !result.rows[0].file_path) return res.status(404).json({ error: 'Not found' });
    const log = result.rows[0];
    if (fs.existsSync(log.file_path)) {
      res.download(log.file_path, log.filename);
    } else {
      res.status(404).json({ error: 'File not found on disk' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
