const router = require('express').Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const WEBEX_SMS_URL = 'https://api.webexinteract.com/v1/sms';

async function getOrgSmsConfig(tenantId) {
  const result = await db.query(
    `SELECT setting_key, setting_value FROM org_settings
     WHERE tenant_id = $1 AND setting_key IN ('sms_enabled', 'sms_api_key', 'sms_sender_id', 'sms_country_code')`,
    [tenantId]
  );
  const config = {};
  for (const r of result.rows) config[r.setting_key] = r.setting_value;
  return {
    enabled: config.sms_enabled === 'true',
    apiKey: config.sms_api_key || '',
    senderId: config.sms_sender_id || '',
    countryCode: config.sms_country_code || 'GB',
  };
}

router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });

    const smsConfig = await getOrgSmsConfig(req.user.tenant_id);
    if (!smsConfig.enabled) return res.status(403).json({ error: 'SMS is not enabled for your organization' });
    if (!smsConfig.apiKey) return res.status(400).json({ error: 'SMS API key not configured' });
    if (!smsConfig.senderId) return res.status(400).json({ error: 'SMS sender ID not configured' });

    let phoneNumber = to.replace(/\s+/g, '');
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) phoneNumber = phoneNumber.slice(1);
      const countryPrefix = smsConfig.countryCode === 'GB' ? '+44' : smsConfig.countryCode === 'US' ? '+1' : '+44';
      phoneNumber = countryPrefix + phoneNumber;
    }

    const payload = {
      message_body: message,
      from: smsConfig.senderId,
      to: [{ phone: [phoneNumber] }],
    };

    const response = await fetch(WEBEX_SMS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${smsConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    await db.query(
      `INSERT INTO sms_messages (id, tenant_id, user_id, direction, phone_number, message_body, status, provider_response, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'outbound', $3, $4, $5, $6, NOW())`,
      [req.user.tenant_id, req.user.id, phoneNumber, message,
       response.ok ? 'sent' : 'failed',
       JSON.stringify(data)]
    );

    if (!response.ok) {
      const errMsg = data.errors?.[0]?.message || 'SMS send failed';
      return res.status(400).json({ error: errMsg, details: data });
    }

    // If there's a conversation for this number, add the message to it
    const transactionId = data.messages?.[0]?.transaction_id || null;

    res.json({
      success: true,
      to: phoneNumber,
      transaction_id: transactionId,
      request_id: data.request_id,
    });
  } catch (err) {
    console.error('SMS send error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { phone, limit } = req.query;
    let query, params;
    if (phone) {
      query = `SELECT * FROM sms_messages WHERE tenant_id = $1 AND phone_number = $2 ORDER BY created_at DESC LIMIT $3`;
      params = [req.user.tenant_id, phone, parseInt(limit) || 50];
    } else {
      query = `SELECT * FROM sms_messages WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3`;
      params = [req.user.tenant_id, req.user.id, parseInt(limit) || 50];
    }
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook for inbound SMS and delivery receipts from Webex Interact
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('[SMS WEBHOOK]', JSON.stringify(event).slice(0, 500));

    if (event.type === 'inbound' || event.direction === 'inbound' || event.inbound_message) {
      const from = event.from || event.source_address || event.msisdn || '';
      const to = event.to || event.destination_address || '';
      const body = event.message_body || event.body || event.text || event.content || '';

      if (from && body) {
        // Find which tenant owns this sender ID / number
        const tenantResult = await db.query(
          `SELECT tenant_id FROM org_settings WHERE setting_key = 'sms_sender_id' AND setting_value = $1 LIMIT 1`,
          [to]
        );
        const tenantId = tenantResult.rows[0]?.tenant_id || null;

        await db.query(
          `INSERT INTO sms_messages (id, tenant_id, user_id, direction, phone_number, message_body, status, provider_response, created_at)
           VALUES (gen_random_uuid(), $1, NULL, 'inbound', $2, $3, 'received', $4, NOW())`,
          [tenantId, from, body, JSON.stringify(event)]
        );

        // Notify connected apps via WebSocket
        if (tenantId) {
          const { getWsBroadcast } = require('../ws');
          if (getWsBroadcast) {
            getWsBroadcast()(tenantId, {
              event: 'smsInbound',
              from,
              to,
              body,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    if (event.type === 'delivery_receipt' || event.status) {
      const transactionId = event.transaction_id || event.tid || '';
      const status = event.status || event.delivery_status || '';
      if (transactionId && status) {
        await db.query(
          `UPDATE sms_messages SET status = $1 WHERE provider_response::text LIKE $2`,
          [status, `%${transactionId}%`]
        ).catch(() => {});
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('SMS webhook error:', err);
    res.status(200).json({ ok: true });
  }
});

// Admin: test SMS config
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to number required' });

    const smsConfig = await getOrgSmsConfig(req.user.tenant_id);
    if (!smsConfig.apiKey || !smsConfig.senderId) {
      return res.status(400).json({ error: 'SMS not fully configured (need API key and sender ID)' });
    }

    let phoneNumber = to.replace(/\s+/g, '');
    if (!phoneNumber.startsWith('+')) {
      if (phoneNumber.startsWith('0')) phoneNumber = phoneNumber.slice(1);
      phoneNumber = '+44' + phoneNumber;
    }

    const response = await fetch(WEBEX_SMS_URL + '/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${smsConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_body: 'Test SMS from Hypercloud',
        from: smsConfig.senderId,
        to: [{ phone: [phoneNumber] }],
      }),
    });

    const data = await response.json();
    res.json({ success: response.ok, response: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
