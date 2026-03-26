const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const { app } = require('electron');

class SipEngine extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.running = false;
    this.buffer = '';
    this.logCapture = null;
    this.logCaptureTimer = null;
  }

  _tryFixJson(raw) {
    try {
      const numStart = raw.indexOf('"number":"');
      if (numStart < 0) return null;
      const valStart = numStart + 10;
      let boundary = raw.lastIndexOf('","name":"');
      if (boundary < valStart) boundary = raw.lastIndexOf('"}');
      if (boundary < valStart) return null;
      const numVal = raw.substring(valStart, boundary);
      const escaped = numVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return JSON.parse(raw.substring(0, valStart) + escaped + raw.substring(boundary));
    } catch { return null; }
  }

  startLogCapture(durationSec) {
    this.logCapture = [];
    if (this.logCaptureTimer) clearTimeout(this.logCaptureTimer);
    this.logCaptureTimer = setTimeout(() => this.stopLogCapture(), (durationSec || 30) * 1000);
    this.sendCommand({ cmd: 'enableLogging', level: 5 });
  }

  stopLogCapture() {
    if (this.logCaptureTimer) { clearTimeout(this.logCaptureTimer); this.logCaptureTimer = null; }
    this.sendCommand({ cmd: 'enableLogging', level: 0 });
    const logData = (this.logCapture || []).join('\n');
    this.logCapture = null;
    return logData;
  }

  start(config) {
    if (this.running) this.stop();

    const isDev = !app.isPackaged;
    const pjsuaPath = isDev
      ? path.join(__dirname, '../pjsip/scc-sip-engine.exe')
      : path.join(process.resourcesPath, 'pjsip', 'scc-sip-engine.exe');

    try {
      this.process = spawn(pjsuaPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.running = true;

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop();
        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line.trim());
              if (event.event === 'audioData') {
                this.emit('event', event);
              } else {
                console.log('[SIP EVENT]', event.event, event.state || event.code || '');
                this.emit('event', event);
              }
            } catch (e) {
              const fixed = this._tryFixJson(line.trim());
              if (fixed) {
                console.log('[SIP EVENT fixed]', fixed.event, fixed.state || fixed.code || '');
                this.emit('event', fixed);
              } else {
                console.log('[SIP RAW]', line.trim().substring(0, 100));
                if (this.logCapture) this.logCapture.push(line.trim());
              }
            }
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        const txt = data.toString();
        console.error('[SIP STDERR]', txt.substring(0, 200));
        if (this.logCapture) this.logCapture.push(txt);
      });

      this.process.on('exit', (code, signal) => {
        console.error('[SIP ENGINE] Process exited! code:', code, 'signal:', signal);
        this.running = false;
        this.process = null;
        this.emit('event', { event: 'engineStopped', code });
      });

      if (config) {
        this.sendCommand({ cmd: 'configure', ...config });
      }

      return { success: true };
    } catch (err) {
      this.emit('event', { event: 'regState', code: -1, reason: 'SIP engine not available: ' + err.message });
      return { success: false, error: err.message };
    }
  }

  stop() {
    if (this.process) {
      try {
        this.sendCommand({ cmd: 'quit' });
        setTimeout(() => {
          if (this.process) {
            this.process.kill();
            this.process = null;
          }
        }, 2000);
      } catch {
        this.process?.kill();
        this.process = null;
      }
    }
    this.running = false;
  }

  sendCommand(cmd) {
    if (!this.process?.stdin?.writable) {
      console.warn('[SIP] sendCommand failed: engine not running, cmd:', cmd.cmd);
      return { success: false, error: 'SIP engine not running' };
    }
    try {
      if (cmd.cmd === 'warmTransferCall' && cmd.number && cmd.number.includes('@')) {
        const original = cmd.number;
        cmd = { ...cmd, number: cmd.number.split('@')[0] };
        console.log(`[SIP] warmTransferCall domain strip: "${original}" -> "${cmd.number}"`);
      }
      const json = JSON.stringify(cmd);
      if (cmd.cmd !== 'enableAudioCapture' && cmd.cmd !== 'enableLogging') {
        console.log(`[SIP] sendCommand: ${json.substring(0, 200)}`);
      }
      this.process.stdin.write(json + '\n');
      return { success: true };
    } catch (err) {
      console.error('[SIP] sendCommand error:', err.message, 'cmd:', cmd.cmd);
      return { success: false, error: err.message };
    }
  }
}

module.exports = { SipEngine };
