const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { passwordResetEmail, inviteEmail } = require('../email');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function getLoginUrl(req) {
  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  if (!host) return 'https://appmanager.hyperclouduk.com/download';
  return `${proto}://${host}/download`;
}

// Reset password and email the user
router.post('/reset-password', async (req, res) => {
  try {
    const { user_id, custom_email } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const userResult = await db.query(
      `SELECT u.id, u.email, u.display_name, t.name as org_name
       FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1`, [user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const newPassword = generatePassword();
    const hash = await bcrypt.hash(newPassword, 12);

    if (custom_email && custom_email.trim()) {
      await db.query(
        'UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE id = $3',
        [custom_email.trim().toLowerCase(), hash, user_id]
      );
    } else {
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user_id]);
    }

    const sendTo = custom_email || user.email;
    const loginUrl = getLoginUrl(req);

    await passwordResetEmail(sendTo, user.display_name, newPassword, loginUrl);

    res.json({ success: true, sent_to: sendTo, message: `Password reset email sent to ${sendTo}` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send invite email to a user
router.post('/invite', async (req, res) => {
  try {
    const { user_id, custom_email } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const userResult = await db.query(
      `SELECT u.id, u.email, u.display_name, t.name as org_name
       FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1`, [user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const newPassword = generatePassword();
    const hash = await bcrypt.hash(newPassword, 12);

    if (custom_email && custom_email.trim()) {
      await db.query(
        'UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE id = $3',
        [custom_email.trim().toLowerCase(), hash, user_id]
      );
    } else {
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user_id]);
    }

    const sendTo = custom_email || user.email;
    const loginUrl = getLoginUrl(req);

    await inviteEmail(sendTo, user.display_name, newPassword, loginUrl, user.org_name);

    res.json({ success: true, sent_to: sendTo, message: `Invite email sent to ${sendTo}` });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
