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
    mainWindow?.webContents.send('ws:event', data);
  });

  ipcMain.handle('app:login', async (_, { email, password }) => {
    const result = await provisionClient.login(email, password);
    if (result?.token) wsClient.connect(result.token);
    return result;
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
