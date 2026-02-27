const https = require('https');

const SMTP2GO_API_KEY = 'api-3E400A868D944A4AAD18B4B43DAAF09D';
const FROM_EMAIL = 'noreply@surecloudvoice.com';
const FROM_NAME = 'SureCloudVoice';

function sendEmail(to, subject, htmlBody, textBody) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      api_key: SMTP2GO_API_KEY,
      to: [to],
      sender: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject,
      html_body: htmlBody,
      text_body: textBody || '',
    });

    const req = https.request({
      hostname: 'api.smtp2go.com',
      path: '/v3/email/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data?.succeeded > 0) resolve(json);
          else reject(new Error(json.data?.error || 'Send failed'));
        } catch { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function passwordResetEmail(toEmail, displayName, newPassword, loginUrl) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',-apple-system,sans-serif;background:#f4f4f5">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
      <div style="background:#202A44;padding:32px;text-align:center">
        <img src="https://communicator.surecloudvoice.com/img/logo-horizontal.png" alt="SureCloudVoice" style="height:36px;filter:brightness(0) invert(1)">
      </div>
      <div style="padding:32px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;font-weight:600">Password Reset</h1>
        <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px">
          Hi ${displayName || 'there'},<br><br>
          Your SureCloudVoice app password has been reset. Use the credentials below to sign in:
        </p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px">
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Email</div>
            <div style="font-size:15px;color:#18181b;font-weight:500;margin-top:2px">${toEmail}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">New Password</div>
            <div style="font-size:15px;color:#18181b;font-weight:600;font-family:monospace;margin-top:2px;letter-spacing:1px">${newPassword}</div>
          </div>
        </div>
        <a href="${loginUrl}" style="display:inline-block;padding:12px 32px;background:#CE0037;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Open SureCloudVoice</a>
        <p style="color:#a1a1aa;font-size:12px;margin-top:24px;line-height:1.5">
          If you didn't request this reset, please contact your administrator.<br>
          For security, we recommend changing your password after signing in.
        </p>
      </div>
      <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center">
        <p style="color:#a1a1aa;font-size:11px;margin:0">SureCloudVoice by Sure &copy; 2026</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${displayName || 'there'},\n\nYour SureCloudVoice password has been reset.\n\nEmail: ${toEmail}\nNew Password: ${newPassword}\n\nSign in at: ${loginUrl}\n\n- SureCloudVoice`;

  return sendEmail(toEmail, 'Your SureCloudVoice password has been reset', html, text);
}

function inviteEmail(toEmail, displayName, password, loginUrl, orgName) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',-apple-system,sans-serif;background:#f4f4f5">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
      <div style="background:#202A44;padding:32px;text-align:center">
        <img src="https://communicator.surecloudvoice.com/img/logo-horizontal.png" alt="SureCloudVoice" style="height:36px;filter:brightness(0) invert(1)">
      </div>
      <div style="padding:32px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;font-weight:600">Welcome to SureCloudVoice</h1>
        <p style="color:#71717a;font-size:14px;line-height:1.6;margin:0 0 24px">
          Hi ${displayName || 'there'},<br><br>
          You've been invited to use SureCloudVoice${orgName ? ' for <strong>' + orgName + '</strong>' : ''}. Download the app and sign in with your credentials below:
        </p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px">
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Email</div>
            <div style="font-size:15px;color:#18181b;font-weight:500;margin-top:2px">${toEmail}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px">Password</div>
            <div style="font-size:15px;color:#18181b;font-weight:600;font-family:monospace;margin-top:2px;letter-spacing:1px">${password}</div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:24px">
          <a href="https://communicator.surecloudvoice.com/download" style="display:inline-block;padding:12px 32px;background:#CE0037;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Download App</a>
        </div>
        <p style="color:#a1a1aa;font-size:12px;line-height:1.5">
          Need help? Contact your administrator or visit our support page.
        </p>
      </div>
      <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center">
        <p style="color:#a1a1aa;font-size:11px;margin:0">SureCloudVoice by Sure &copy; 2026</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${displayName || 'there'},\n\nYou've been invited to use SureCloudVoice${orgName ? ' for ' + orgName : ''}.\n\nEmail: ${toEmail}\nPassword: ${password}\n\nDownload: https://communicator.surecloudvoice.com/download\n\n- SureCloudVoice`;

  return sendEmail(toEmail, `You're invited to SureCloudVoice${orgName ? ' - ' + orgName : ''}`, html, text);
}

module.exports = { sendEmail, passwordResetEmail, inviteEmail };
