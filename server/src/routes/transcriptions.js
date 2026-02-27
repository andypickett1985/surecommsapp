const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../email');

router.use(authenticateToken);

// Save a transcription
router.post('/', async (req, res) => {
  try {
    const { call_number, call_direction, call_duration, transcript, summary, language } = req.body;
    const result = await db.query(
      `INSERT INTO transcriptions (user_id, tenant_id, call_number, call_direction, call_duration, transcript, summary, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, req.user.tenant_id, call_number||'', call_direction||'out', call_duration||0, transcript||'', summary||'', language||'en']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List user's transcriptions
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, call_number, call_direction, call_duration, summary, language, status, created_at FROM transcriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get a specific transcription
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM transcriptions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email a transcription
router.post('/:id/email', async (req, res) => {
  try {
    const { to_emails } = req.body;
    if (!to_emails || !to_emails.length) return res.status(400).json({ error: 'to_emails required' });

    const result = await db.query('SELECT * FROM transcriptions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const t = result.rows[0];
    const userResult = await db.query('SELECT display_name, email FROM users WHERE id = $1', [t.user_id]);
    const userName = userResult.rows[0]?.display_name || 'User';

    const date = new Date(t.created_at).toLocaleString();
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#f4f4f5">
<div style="max-width:640px;margin:0 auto;padding:40px 20px">
<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:#202A44;padding:24px 32px;color:#fff">
    <h1 style="margin:0;font-size:18px;font-weight:600">Call Transcription</h1>
    <p style="margin:4px 0 0;opacity:0.7;font-size:13px">${date} | ${t.call_direction === 'in' ? 'Incoming' : 'Outgoing'} call ${t.call_number ? 'with ' + t.call_number : ''}</p>
  </div>
  <div style="padding:24px 32px">
    ${t.summary ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin-bottom:20px"><h3 style="margin:0 0 8px;font-size:14px;color:#1D4ED8">Summary</h3><p style="margin:0;font-size:14px;color:#1E40AF;line-height:1.6">${t.summary}</p></div>` : ''}
    <h3 style="font-size:14px;color:#52525B;margin:0 0 12px">Full Transcript</h3>
    <div style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.8;color:#18181b">${t.transcript || 'No transcript available'}</div>
    <p style="color:#a1a1aa;font-size:11px;margin-top:16px">Duration: ${Math.floor((t.call_duration||0)/60)}:${String((t.call_duration||0)%60).padStart(2,'0')} | Transcribed by ${userName} via SureCloudVoice</p>
  </div>
  <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e4e4e7;text-align:center">
    <p style="color:#a1a1aa;font-size:11px;margin:0">SureCloudVoice by Sure &copy; 2026</p>
  </div>
</div></div></body></html>`;

    for (const email of to_emails) {
      await sendEmail(email, `Call Transcription - ${t.call_number || 'Unknown'} - ${date}`, html, t.transcript);
    }

    res.json({ success: true, sent_to: to_emails });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: list all transcriptions for an org
router.get('/admin/org/:orgId', async (req, res) => {
  try {
    if (!['admin','superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Admin required' });
    const result = await db.query(
      `SELECT t.*, u.display_name, u.email FROM transcriptions t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.tenant_id = $1 ORDER BY t.created_at DESC LIMIT 100`,
      [req.params.orgId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
