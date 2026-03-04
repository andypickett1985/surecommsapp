const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { SipEngine } = require('./sip-engine');
const { ProvisionClient } = require('./provision');
const { WsClient } = require('./ws-client');
const { TranscriptionService } = require('./transcription');
const { summarizeTranscript, generateActionItems, generateSubject } = require('./summarize');

const isDev = !app.isPackaged;
let mainWindow = null;
let tray = null;
let sipEngine = null;
let provisionClient = null;
let wsClient = null;
let transcriptionService = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 380,
    minHeight: 500,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#202A44',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.ico'),
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Hypercloud');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => mainWindow?.show());
}

function setupIPC() {
  provisionClient = new ProvisionClient();
  sipEngine = new SipEngine();

  // SIP events are forwarded in the transcription section below

  wsClient = new WsClient();
  wsClient.on('event', (data) => {
    if (data.event === 'sipLogRequested') {
      const duration = data.duration || 30;
      console.log(`[DIAG] SIP log capture requested for ${duration}s`);
      sipEngine.startLogCapture(duration);
      setTimeout(() => {
        const logData = sipEngine.stopLogCapture();
        console.log(`[DIAG] SIP log captured: ${logData.length} chars`);
        wsClient.uploadSipLog(logData);
      }, duration * 1000);
      return;
    }
    if (data.event === 'requestNetworkTest') {
      mainWindow?.webContents.send('ws:event', data);
      return;
    }
    mainWindow?.webContents.send('ws:event', data);
  });

  ipcMain.on('app:getVersion', (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle('app:login', async (_, { email, password }) => {
    const fs = require('fs');
    const os = require('os');
    const logFile = path.join(os.tmpdir(), 'hypercloud-login-debug.txt');
    try {
      fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] Login attempt: ${email}\n`);
      const result = await provisionClient.login(email, password);
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] Login OK: token=${!!result?.token}\n`);
      if (result?.token) wsClient.connect(result.token);
      return result;
    } catch (err) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] Login FAILED: ${err.message} status=${err.status} stack=${err.stack}\n`);
      return { error: err.message || 'Login failed', status: err.status };
    }
  });

  ipcMain.handle('app:logout', async () => {
    sipEngine.stop();
    wsClient.disconnect();
    provisionClient.clearTokens();
    return { success: true };
  });

  ipcMain.handle('app:getSavedSession', async () => {
    const session = provisionClient.getSavedSession();
    if (session?.token) wsClient.connect(session.token);
    return session;
  });

  ipcMain.handle('app:refreshConfig', async () => {
    return provisionClient.refreshConfig();
  });

  ipcMain.handle('sip:start', async (_, config) => {
    return sipEngine.start(config);
  });

  ipcMain.handle('sip:stop', async () => {
    return sipEngine.stop();
  });

  ipcMain.handle('sip:makeCall', async (_, { number, hasVideo }) => {
    return sipEngine.sendCommand({ cmd: 'makeCall', number, hasVideo: hasVideo || false });
  });

  ipcMain.handle('sip:hangup', async () => {
    return sipEngine.sendCommand({ cmd: 'hangup' });
  });

  ipcMain.handle('sip:answer', async (_, { hasVideo }) => {
    return sipEngine.sendCommand({ cmd: 'answer', hasVideo: hasVideo || false });
  });

  ipcMain.handle('sip:decline', async () => {
    return sipEngine.sendCommand({ cmd: 'decline' });
  });

  ipcMain.handle('sip:toggleMute', async (_, { muted }) => {
    return sipEngine.sendCommand({ cmd: 'toggleMute', muted });
  });

  ipcMain.handle('sip:toggleHold', async (_, { held }) => {
    return sipEngine.sendCommand({ cmd: 'toggleHold', held });
  });

  ipcMain.handle('sip:sendDtmf', async (_, { digit }) => {
    return sipEngine.sendCommand({ cmd: 'dtmf', digit });
  });

  ipcMain.handle('sip:transfer', async (_, { number }) => {
    return sipEngine.sendCommand({ cmd: 'transfer', number });
  });

  ipcMain.handle('sip:warmTransferCall', async (_, { number }) => {
    return sipEngine.sendCommand({ cmd: 'warmTransferCall', number });
  });

  ipcMain.handle('sip:warmTransferComplete', async () => {
    return sipEngine.sendCommand({ cmd: 'warmTransferComplete' });
  });

  ipcMain.handle('sip:warmTransferCancel', async () => {
    return sipEngine.sendCommand({ cmd: 'warmTransferCancel' });
  });

  // Transcription
  transcriptionService = new TranscriptionService();
  transcriptionService.on('transcript', (data) => {
    mainWindow?.webContents.send('transcription:update', data);
  });
  transcriptionService.on('status', (data) => {
    mainWindow?.webContents.send('transcription:status', data);
  });

  ipcMain.handle('transcription:start', async (_, opts) => {
    console.log('[TRANSCRIBE] Starting transcription...');
    const callerName = opts?.callerName || 'Other';
    const userName = opts?.userName || 'You';
    transcriptionService.start(16000, callerName, userName);
    const r = sipEngine.sendCommand({ cmd: 'enableAudioCapture', enabled: true });
    console.log('[TRANSCRIBE] Audio capture command sent:', r);
    return { success: true };
  });

  ipcMain.handle('transcription:stop', async () => {
    console.log('[TRANSCRIBE] Stopping transcription...');
    sipEngine.sendCommand({ cmd: 'enableAudioCapture', enabled: false });
    const result = transcriptionService.stop();
    console.log('[TRANSCRIBE] Final transcript length:', result?.transcript?.length || 0);
    return result;
  });

  ipcMain.handle('transcription:getTranscript', async () => {
    return transcriptionService.getTranscript();
  });

  ipcMain.handle('ai:summarize', async (_, { transcript, type }) => {
    try {
      if (type === 'actions') return { result: await generateActionItems(transcript) };
      if (type === 'subject') return { result: await generateSubject(transcript) };
      return { result: await summarizeTranscript(transcript) };
    } catch (err) { return { error: err.message }; }
  });

  // Forward audio data from SIP engine to transcription
  let audioFrameCount = 0;
  sipEngine.on('event', (data) => {
    if (data.event === 'audioData') {
      audioFrameCount++;
      if (audioFrameCount % 100 === 1) console.log(`[AUDIO] Frame #${audioFrameCount}, speaker: ${data.speaker}, active: ${transcriptionService.active}`);
      if (transcriptionService.active) {
        transcriptionService.sendAudio(Buffer.from(data.pcm, 'base64'), data.speaker || 'remote');
      }
    } else if (data.event === 'audioCaptureState') {
      console.log('[AUDIO] Capture state:', data.enabled);
    } else {
      mainWindow?.webContents.send('sip:event', data);

      // Report call state changes to server for admin portal visibility
      if (data.event === 'callState') {
        const state = data.state || 'idle';
        const number = data.number || '';
        const direction = data.direction || '';
        wsClient?.reportCallState(state, number, direction);
        if (state === 'disconnected') {
          wsClient?.reportCallState(null, null, null);
        }
      } else if (data.event === 'incomingCall') {
        wsClient?.reportCallState('ringing', data.number || '', 'in');
      }

      if (data.event === 'incomingCall') {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
          mainWindow.flashFrame(true);
          mainWindow.setAlwaysOnTop(true);
          setTimeout(() => mainWindow?.setAlwaysOnTop(false), 3000);
        }

        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          const callerName = data.name || data.number || 'Unknown';
          const notif = new Notification({
            title: 'Incoming Call',
            body: callerName,
            icon: path.join(__dirname, '../../assets/icon.ico'),
            urgency: 'critical',
            silent: true,
          });
          notif.on('click', () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          });
          notif.show();
        }
      }

      if (data.event === 'agentPing') {
        if (mainWindow) {
          mainWindow.flashFrame(true);
          if (!mainWindow.isVisible()) mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Agent Ping',
            body: data.message || `${data.from || 'Someone'} is trying to reach you`,
            icon: path.join(__dirname, '../../assets/icon.ico'),
            urgency: 'critical',
          });
          notif.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
          notif.show();
        }
        mainWindow?.webContents.send('agent-ping', data);
      }
    }
  });

  ipcMain.handle('ws:uploadNetworkTest', (_, results) => {
    wsClient?.uploadNetworkTestResults(results);
    return { success: true };
  });

  ipcMain.handle('ws:uploadSipLog', (_, logData) => {
    wsClient?.uploadSipLog(logData);
    return { success: true };
  });

  ipcMain.handle('app:downloadAndInstall', async (_, { downloadUrl }) => {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const os = require('os');
    const { spawn } = require('child_process');

    const tempPath = path.join(os.tmpdir(), 'hypercloud-update.exe');
    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `https://appmanager.hyperclouduk.com${downloadUrl}`;

    return new Promise((resolve, reject) => {
      const client = fullUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(tempPath);

      mainWindow?.webContents.send('update:progress', { percent: 0, status: 'downloading' });

      const request = client.get(fullUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(tempPath);
          const redirectUrl = response.headers.location;
          const rClient = redirectUrl.startsWith('https') ? https : http;
          const rFile = fs.createWriteStream(tempPath);
          rClient.get(redirectUrl, (rRes) => handleResponse(rRes, rFile));
          return;
        }
        handleResponse(response, file);
      });

      function handleResponse(response, fileStream) {
        const totalSize = parseInt(response.headers['content-length'] || '0');
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize > 0) {
            const percent = Math.round((downloaded / totalSize) * 100);
            mainWindow?.webContents.send('update:progress', { percent, status: 'downloading', downloaded, totalSize });
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          mainWindow?.webContents.send('update:progress', { percent: 100, status: 'installing' });

          setTimeout(() => {
            try {
              const appExePath = process.execPath;
              const batPath = path.join(os.tmpdir(), 'hypercloud-update.bat');
              const batContent = `@echo off\r\n"${tempPath}" /S\r\ntimeout /t 3 /nobreak >nul\r\nstart "" "${appExePath}"\r\ndel "%~f0"\r\n`;
              fs.writeFileSync(batPath, batContent);
              spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
              app.isQuitting = true;
              app.quit();
            } catch (err) {
              mainWindow?.webContents.send('update:progress', { percent: 0, status: 'error', error: err.message });
              resolve({ success: false, error: err.message });
            }
          }, 1000);

          resolve({ success: true });
        });
      }

      request.on('error', (err) => {
        fs.unlink(tempPath, () => {});
        mainWindow?.webContents.send('update:progress', { percent: 0, status: 'error', error: err.message });
        resolve({ success: false, error: err.message });
      });
    });
  });

  ipcMain.handle('app:openExternal', (_, url) => {
    const { shell } = require('electron');
    if (url && (url.startsWith('mailto:') || url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.hide());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  sipEngine?.stop();
});
