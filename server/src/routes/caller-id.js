const router = require('express').Router();
const db = require('../db');
const fpbx = require('../fpbx-db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// App user: get available caller IDs for their org
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, label, number, is_default FROM caller_ids
       WHERE tenant_id = $1 AND active = true
       ORDER BY is_default DESC, label`,
      [req.user.tenant_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App user: get their currently selected caller ID
router.get('/selected', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'selected_caller_id'`,
      [req.user.id]
    );
    const selectedId = result.rows[0]?.setting_value || null;
    if (selectedId) {
      const cid = await db.query('SELECT id, label, number FROM caller_ids WHERE id = $1', [selectedId]);
      return res.json(cid.rows[0] || null);
    }
    // Fall back to org default
    const def = await db.query(
      `SELECT id, label, number FROM caller_ids WHERE tenant_id = $1 AND is_default = true AND active = true LIMIT 1`,
      [req.user.tenant_id]
    );
    res.json(def.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App user: set their preferred caller ID
router.put('/selected', authenticateToken, async (req, res) => {
  try {
    const { caller_id } = req.body;
    if (caller_id) {
      // Verify it belongs to their org
      const check = await db.query(
        'SELECT id FROM caller_ids WHERE id = $1 AND tenant_id = $2 AND active = true',
        [caller_id, req.user.tenant_id]
      );
      if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid caller ID' });
    }
    await db.query(
      `INSERT INTO user_settings (user_id, setting_key, setting_value)
       VALUES ($1, 'selected_caller_id', $2)
       ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $2`,
      [req.user.id, caller_id || null]
    );

    // Sync to FusionPBX: update outbound_caller_id_number on the extension
    try {
      const userResult = await db.query(
        'SELECT fpbx_extension_uuid FROM users WHERE id = $1',
        [req.user.id]
      );
      const extUuid = userResult.rows[0]?.fpbx_extension_uuid;
      if (extUuid && caller_id) {
        const cidResult = await db.query('SELECT number, label FROM caller_ids WHERE id = $1', [caller_id]);
        const cidNumber = cidResult.rows[0]?.number || '';
        const cidName = cidResult.rows[0]?.label || '';
        if (cidNumber) {
          await fpbx.query(
            `UPDATE v_extensions SET outbound_caller_id_number = $1, outbound_caller_id_name = $2 WHERE extension_uuid = $3`,
            [cidNumber, cidName, extUuid]
          );
        }
      }
    } catch (syncErr) {
      console.error('FusionPBX caller ID sync error:', syncErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all caller IDs for an org
router.get('/org/:orgId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM caller_ids WHERE tenant_id = $1 ORDER BY is_default DESC, label',
      [req.params.orgId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: add a caller ID to an org
router.post('/org/:orgId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { label, number, is_default } = req.body;
    if (!label || !number) return res.status(400).json({ error: 'label and number required' });

    if (is_default) {
      await db.query('UPDATE caller_ids SET is_default = false WHERE tenant_id = $1', [req.params.orgId]);
    }

    const result = await db.query(
      `INSERT INTO caller_ids (id, tenant_id, label, number, is_default, active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW()) RETURNING *`,
      [req.params.orgId, label, number, !!is_default]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update a caller ID
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { label, number, is_default, active } = req.body;
    const cid = await db.query('SELECT tenant_id FROM caller_ids WHERE id = $1', [req.params.id]);
    if (cid.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (is_default) {
      await db.query('UPDATE caller_ids SET is_default = false WHERE tenant_id = $1', [cid.rows[0].tenant_id]);
    }

    const updates = [];
    const params = [];
    let idx = 1;
    if (label !== undefined) { updates.push(`label = $${idx++}`); params.push(label); }
    if (number !== undefined) { updates.push(`number = $${idx++}`); params.push(number); }
    if (is_default !== undefined) { updates.push(`is_default = $${idx++}`); params.push(!!is_default); }
    if (active !== undefined) { updates.push(`active = $${idx++}`); params.push(!!active); }
    params.push(req.params.id);

    const result = await db.query(
      `UPDATE caller_ids SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete a caller ID
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM caller_ids WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
