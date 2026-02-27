const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, cp.last_read_at,
        (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > cp.last_read_at AND m.sender_id != $1) as unread_count,
        (SELECT json_agg(json_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email))
         FROM conversation_participants cp2 JOIN users u ON u.id = cp2.user_id
         WHERE cp2.conversation_id = c.id) as participants
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       ORDER BY COALESCE((SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), c.created_at) DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { participant_ids, title, type } = req.body;
    if (!participant_ids || !participant_ids.length) return res.status(400).json({ error: 'Participants required' });

    if (type === 'direct' && participant_ids.length === 1) {
      const existing = await db.query(
        `SELECT c.id FROM conversations c
         WHERE c.type = 'direct' AND c.tenant_id = $1
         AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $2)
         AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $3)
         AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2`,
        [req.user.tenant_id, req.user.id, participant_ids[0]]
      );
      if (existing.rows.length > 0) return res.json({ id: existing.rows[0].id, existing: true });
    }

    const conv = await db.query(
      'INSERT INTO conversations (tenant_id, title, type) VALUES ($1, $2, $3) RETURNING *',
      [req.user.tenant_id, title || null, type || 'direct']
    );
    const convId = conv.rows[0].id;

    const allParticipants = [req.user.id, ...participant_ids.filter(id => id !== req.user.id)];
    for (const uid of allParticipants) {
      await db.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [convId, uid]);
    }

    res.status(201).json(conv.rows[0]);
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before || null;

    let query = `SELECT m.*, u.display_name as sender_name, u.email as sender_email
                 FROM messages m LEFT JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = $1`;
    const params = [req.params.id];

    if (before) {
      query += ` AND m.created_at < $2 ORDER BY m.created_at DESC LIMIT $3`;
      params.push(before, limit);
    } else {
      query += ` ORDER BY m.created_at DESC LIMIT $2`;
      params.push(limit);
    }

    const result = await db.query(query, params);
    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const { body, msg_type } = req.body;
    if (!body) return res.status(400).json({ error: 'Message body required' });

    const result = await db.query(
      'INSERT INTO messages (conversation_id, sender_id, body, msg_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, req.user.id, body, msg_type || 'text']
    );

    await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    const msg = result.rows[0];
    const userResult = await db.query('SELECT display_name, email FROM users WHERE id = $1', [req.user.id]);
    msg.sender_name = userResult.rows[0]?.display_name;
    msg.sender_email = userResult.rows[0]?.email;

    const { broadcast } = require('../ws');
    const participants = await db.query('SELECT user_id FROM conversation_participants WHERE conversation_id = $1', [req.params.id]);
    participants.rows.forEach(p => {
      broadcast(p.user_id, { event: 'newMessage', conversationId: req.params.id, message: msg });
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
