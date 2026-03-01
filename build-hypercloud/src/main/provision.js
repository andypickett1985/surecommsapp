const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const PROVISION_SERVER = 'https://appmanager.hyperclouduk.com';

class ProvisionClient {
  constructor() {
    this.tokenFile = path.join(app.getPath('userData'), 'session.json');
  }

  async login(email, password) {
    const data = await this._post('/api/auth/login', {
      email,
      password,
    }, { 'X-Device-Name': 'Hypercloud-Windows' });

    this._saveSession({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
      sipAccounts: data.sipAccounts,
    });

    return data;
  }

  async refreshConfig() {
    const session = this.getSavedSession();
    if (!session?.token) return null;

    try {
      const data = await this._get('/api/provision', {
        Authorization: `Bearer ${session.token}`,
      });
      if (data.sipAccounts) {
        session.sipAccounts = data.sipAccounts;
        this._saveSession(session);
      }
      return data;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        return this._tryRefreshToken(session);
      }
      return null;
    }
  }

  async _tryRefreshToken(session) {
    if (!session.refreshToken) return null;
    try {
      const data = await this._post('/api/auth/refresh', {
        refreshToken: session.refreshToken,
      });
      session.token = data.token;
      session.refreshToken = data.refreshToken;
      this._saveSession(session);
      return this.refreshConfig();
    } catch {
      this.clearTokens();
      return null;
    }
  }

  getSavedSession() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        return JSON.parse(fs.readFileSync(this.tokenFile, 'utf-8'));
      }
    } catch {}
    return null;
  }

  _saveSession(session) {
    fs.writeFileSync(this.tokenFile, JSON.stringify(session, null, 2));
  }

  clearTokens() {
    try { fs.unlinkSync(this.tokenFile); } catch {}
  }

  _request(method, urlPath, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, PROVISION_SERVER);
      const isHttps = url.protocol === 'https:';
      const mod = isHttps ? https : http;

      const headers = { 'Content-Type': 'application/json', ...extraHeaders };
      const payload = body ? JSON.stringify(body) : null;
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

      const req = mod.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method,
        headers,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(json.error || 'Request failed');
              err.status = res.statusCode;
              reject(err);
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error('Invalid response'));
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  _post(urlPath, body, extraHeaders) {
    return this._request('POST', urlPath, body, extraHeaders);
  }

  _get(urlPath, extraHeaders) {
    return this._request('GET', urlPath, null, extraHeaders);
  }
}

module.exports = { ProvisionClient };
