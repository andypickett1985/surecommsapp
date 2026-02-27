const router = require('express').Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

router.get('/user/:userId', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sip_accounts WHERE user_id = $1 ORDER BY created_at', [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('List SIP accounts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      user_id, label, sip_server, sip_proxy, sip_domain, sip_username, sip_password,
      auth_id, display_name, voicemail_number, dialing_prefix, dial_plan,
      transport, srtp, public_addr, register_refresh, keep_alive,
      publish, ice, allow_rewrite, disable_session_timer, hide_cid
    } = req.body;

    if (!user_id || !sip_server || !sip_username || !sip_password) {
      return res.status(400).json({ error: 'user_id, sip_server, sip_username, and sip_password required' });
    }

    const result = await db.query(
      `INSERT INTO sip_accounts (
        user_id, label, sip_server, sip_proxy, sip_domain, sip_username, sip_password,
        auth_id, display_name, voicemail_number, dialing_prefix, dial_plan,
        transport, srtp, public_addr, register_refresh, keep_alive,
        publish, ice, allow_rewrite, disable_session_timer, hide_cid
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [user_id, label||null, sip_server, sip_proxy||null, sip_domain||null,
       sip_username, sip_password, auth_id||null, display_name||null,
       voicemail_number||null, dialing_prefix||null, dial_plan||null,
       transport||'udp', srtp||'disabled', public_addr||null,
       register_refresh||300, keep_alive||15,
       publish||false, ice||false, allow_rewrite!==false, disable_session_timer||false, hide_cid||false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create SIP account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const fields = [
      'label', 'sip_server', 'sip_proxy', 'sip_domain', 'sip_username', 'sip_password',
      'auth_id', 'display_name', 'voicemail_number', 'dialing_prefix', 'dial_plan',
      'transport', 'srtp', 'public_addr', 'register_refresh', 'keep_alive',
      'publish', 'ice', 'allow_rewrite', 'disable_session_timer', 'hide_cid', 'active'
    ];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push('config_version = config_version + 1');
    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await db.query(
      `UPDATE sip_accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'SIP account not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update SIP account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM sip_accounts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete SIP account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
