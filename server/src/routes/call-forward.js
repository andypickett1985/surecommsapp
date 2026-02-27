const router = require('express').Router();
const fpbx = require('../fpbx-db');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/call-forward - Get current call forward settings for the logged-in user
router.get('/', async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT u.fpbx_extension_uuid FROM users u WHERE u.id = $1', [req.user.id]
    );
    const extUuid = userResult.rows[0]?.fpbx_extension_uuid;
    if (!extUuid) return res.json({ error: 'No PBX extension linked' });

    const result = await fpbx.query(`
      SELECT extension, forward_all_enabled, forward_all_destination,
             forward_busy_enabled, forward_busy_destination,
             forward_no_answer_enabled, forward_no_answer_destination,
             forward_user_not_registered_enabled, forward_user_not_registered_destination,
             do_not_disturb
      FROM v_extensions WHERE extension_uuid = $1
    `, [extUuid]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Extension not found' });
    const e = result.rows[0];

    res.json({
      extension: e.extension,
      forwardAll: { enabled: e.forward_all_enabled === 'true', destination: e.forward_all_destination || '' },
      forwardBusy: { enabled: e.forward_busy_enabled === 'true', destination: e.forward_busy_destination || '' },
      forwardNoAnswer: { enabled: e.forward_no_answer_enabled === 'true', destination: e.forward_no_answer_destination || '' },
      forwardNotRegistered: { enabled: e.forward_user_not_registered_enabled === 'true', destination: e.forward_user_not_registered_destination || '' },
      dnd: e.do_not_disturb === 'true',
    });
  } catch (err) { console.error('Get CF error:', err); res.status(500).json({ error: err.message }); }
});

// PUT /api/call-forward - Update call forward settings (writes to FusionPBX DB)
router.put('/', async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT u.fpbx_extension_uuid FROM users u WHERE u.id = $1', [req.user.id]
    );
    const extUuid = userResult.rows[0]?.fpbx_extension_uuid;
    if (!extUuid) return res.status(400).json({ error: 'No PBX extension linked' });

    const { forwardAll, forwardBusy, forwardNoAnswer, forwardNotRegistered, dnd } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (forwardAll !== undefined) {
      updates.push(`forward_all_enabled = $${idx++}`); params.push(forwardAll.enabled ? 'true' : 'false');
      updates.push(`forward_all_destination = $${idx++}`); params.push(forwardAll.destination || '');
    }
    if (forwardBusy !== undefined) {
      updates.push(`forward_busy_enabled = $${idx++}`); params.push(forwardBusy.enabled ? 'true' : 'false');
      updates.push(`forward_busy_destination = $${idx++}`); params.push(forwardBusy.destination || '');
    }
    if (forwardNoAnswer !== undefined) {
      updates.push(`forward_no_answer_enabled = $${idx++}`); params.push(forwardNoAnswer.enabled ? 'true' : 'false');
      updates.push(`forward_no_answer_destination = $${idx++}`); params.push(forwardNoAnswer.destination || '');
    }
    if (forwardNotRegistered !== undefined) {
      updates.push(`forward_user_not_registered_enabled = $${idx++}`); params.push(forwardNotRegistered.enabled ? 'true' : 'false');
      updates.push(`forward_user_not_registered_destination = $${idx++}`); params.push(forwardNotRegistered.destination || '');
    }
    if (dnd !== undefined) {
      updates.push(`do_not_disturb = $${idx++}`); params.push(dnd ? 'true' : 'false');
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(extUuid);
    await fpbx.query(`UPDATE v_extensions SET ${updates.join(', ')} WHERE extension_uuid = $${idx}`, params);

    // FusionPBX needs a SIP profile reload for changes to take effect
    // This is typically done via fs_cli, but we'll let the PBX pick it up on next registration

    res.json({ success: true, message: 'Call forward settings updated' });
  } catch (err) { console.error('Update CF error:', err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
