const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (email, password) => ipcRenderer.invoke('app:login', { email, password }),
  logout: () => ipcRenderer.invoke('app:logout'),
  getSavedSession: () => ipcRenderer.invoke('app:getSavedSession'),
  refreshConfig: () => ipcRenderer.invoke('app:refreshConfig'),

  sipStart: (config) => ipcRenderer.invoke('sip:start', config),
  sipStop: () => ipcRenderer.invoke('sip:stop'),
  makeCall: (number, hasVideo) => ipcRenderer.invoke('sip:makeCall', { number, hasVideo }),
  hangup: () => ipcRenderer.invoke('sip:hangup'),
  answer: (hasVideo) => ipcRenderer.invoke('sip:answer', { hasVideo }),
  decline: () => ipcRenderer.invoke('sip:decline'),
  toggleMute: (muted) => ipcRenderer.invoke('sip:toggleMute', { muted }),
  toggleHold: (held) => ipcRenderer.invoke('sip:toggleHold', { held }),
  sendDtmf: (digit) => ipcRenderer.invoke('sip:sendDtmf', { digit }),
  transfer: (number) => ipcRenderer.invoke('sip:transfer', { number }),
  warmTransferCall: (number) => ipcRenderer.invoke('sip:warmTransferCall', { number }),
  warmTransferComplete: () => ipcRenderer.invoke('sip:warmTransferComplete'),
  warmTransferCancel: () => ipcRenderer.invoke('sip:warmTransferCancel'),

  onSipEvent: (callback) => {
    ipcRenderer.on('sip:event', (_, data) => callback(data));
  },

  onWsEvent: (callback) => {
    ipcRenderer.on('ws:event', (_, data) => callback(data));
  },

  aiSummarize: (transcript, type) => ipcRenderer.invoke('ai:summarize', { transcript, type }),
  transcriptionStart: (opts) => ipcRenderer.invoke('transcription:start', opts),
  transcriptionStop: () => ipcRenderer.invoke('transcription:stop'),
  transcriptionGetTranscript: () => ipcRenderer.invoke('transcription:getTranscript'),
  onTranscriptionUpdate: (callback) => {
    ipcRenderer.on('transcription:update', (_, data) => callback(data));
  },
  onTranscriptionStatus: (callback) => {
    ipcRenderer.on('transcription:status', (_, data) => callback(data));
  },

  uploadNetworkTestResults: (results) => ipcRenderer.invoke('ws:uploadNetworkTest', results),
  uploadSipLog: (logData) => ipcRenderer.invoke('ws:uploadSipLog', logData),

  downloadAndInstall: (url) => ipcRenderer.invoke('app:downloadAndInstall', { downloadUrl: url }),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update:progress', (_, data) => callback(data));
  },

  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
});
