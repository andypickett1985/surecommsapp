const WebSocket = require('ws');
const EventEmitter = require('events');
const os = require('os');
const { app } = require('electron');

const APP_VERSION = '1.5.0';

class WsClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.reconnectTimer = null;
    this.token = null;
    this.sipLogBuffer = '';
    this.capturingSipLog = false;
  }

  connect(token) {
    this.token = token;
    this._connect();
  }

  _connect() {
    if (!this.token) return;
    try {
      const osVer = `${os.platform()} ${os.release()}`;
      const deviceName = os.hostname();
      const url = `wss://appmanager.hyperclouduk.com/ws?token=${this.token}&v=${APP_VERSION}&os=${encodeURIComponent(osVer)}&device=${encodeURIComponent(deviceName)}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.emit('event', { event: 'wsConnected' });
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.event === 'ping') {
            this.send({ event: 'pong' });
            return;
          }

          if (msg.event === 'requestSipLog') {
            this._handleSipLogRequest(msg);
            return;
          }

          this.emit('event', msg);
        } catch {}
      });

      this.ws.on('close', () => {
        this._scheduleReconnect();
      });

      this.ws.on('error', () => {
        this._scheduleReconnect();
      });
    } catch {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, 5000);
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  _handleSipLogRequest(msg) {
    this.emit('event', { event: 'sipLogRequested', duration: msg.duration || 30 });
  }

  uploadSipLog(logData) {
    this.send({ event: 'sipLogUpload', logData });
  }
}

module.exports = { WsClient };
