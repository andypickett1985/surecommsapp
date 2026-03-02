const api = window.electronAPI || {};

export const login = (e, p) => api.login?.(e, p);
export const logout = () => api.logout?.();
export const getSavedSession = () => api.getSavedSession?.();
export const refreshConfig = () => api.refreshConfig?.();

export const sipStart = (c) => api.sipStart?.(c);
export const sipStop = () => api.sipStop?.();
export const makeCall = (n, v) => api.makeCall?.(n, v);
export const hangup = () => api.hangup?.();
export const answer = (v) => api.answer?.(v);
export const decline = () => api.decline?.();
export const toggleMute = (m) => api.toggleMute?.(m);
export const toggleHold = (h) => api.toggleHold?.(h);
export const sendDtmf = (d) => api.sendDtmf?.(d);
export const transfer = (n) => api.transfer?.(n);
export const onSipEvent = (cb) => api.onSipEvent?.(cb);

export const onWsEvent = (cb) => api.onWsEvent?.(cb);

export const aiSummarize = (transcript, type) => api.aiSummarize?.(transcript, type);
export const transcriptionStart = (opts) => api.transcriptionStart?.(opts);
export const transcriptionStop = () => api.transcriptionStop?.();
export const transcriptionGetTranscript = () => api.transcriptionGetTranscript?.();
export const onTranscriptionUpdate = (cb) => api.onTranscriptionUpdate?.(cb);
export const onTranscriptionStatus = (cb) => api.onTranscriptionStatus?.(cb);
export const saveTranscription = (data) => apiFetch('/api/transcriptions', { method: 'POST', body: JSON.stringify(data) });
export const emailTranscription = (id, emails) => apiFetch(`/api/transcriptions/${id}/email`, { method: 'POST', body: JSON.stringify({ to_emails: emails }) });
export const fetchTranscriptions = () => apiFetch('/api/transcriptions');

export async function uploadChatFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const t = _getState().token;
  const res = await fetch('https://appmanager.hyperclouduk.com/api/chat-upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${t}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export const windowMinimize = () => api.windowMinimize?.();
export const windowMaximize = () => api.windowMaximize?.();
export const windowClose = () => api.windowClose?.();

const PROV = 'https://appmanager.hyperclouduk.com';

import { getState as _getState } from './store.js';

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = _getState().token;
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(PROV + path, { ...opts, headers });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
  return res.json();
}

export const fetchUsers = () => apiFetch('/api/users');
export const fetchConversations = () => apiFetch('/api/conversations');
export const fetchMessages = (id) => apiFetch(`/api/conversations/${id}/messages`);
export const sendMessage = (id, body) => apiFetch(`/api/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
export const createConversation = (ids, title, type) => apiFetch('/api/conversations', { method: 'POST', body: JSON.stringify({ participant_ids: ids, title, type }) });
export const markRead = (id) => apiFetch(`/api/conversations/${id}/read`, { method: 'PUT' });
export const fetchSpeedDials = () => apiFetch('/api/speed-dials');
export const fetchContacts = () => apiFetch('/api/contacts');
export const getCallForward = () => apiFetch('/api/call-forward');
export const setCallForward = (settings) => apiFetch('/api/call-forward', { method: 'PUT', body: JSON.stringify(settings) });
export const getCallCenterMe = () => apiFetch('/api/call-center/me');
export const setCallCenterStatus = (status) => apiFetch('/api/call-center/status', { method: 'PUT', body: JSON.stringify({ status }) });
export const fetchCallCenterQueues = () => apiFetch('/api/call-center/queues');
export const fetchCallCenterQueueAgents = (qId) => apiFetch(`/api/call-center/queues/${qId}/agents`);
export const fetchCallCenterQueueLive = (qId) => apiFetch(`/api/call-center/queues/${qId}/live`);
export const fetchCallCenterAvailableAgents = (qId) => apiFetch(`/api/call-center/queues/${qId}/available-agents`);
export const addCallCenterQueueAgent = (qId, agentUuid, level, pos) => apiFetch(`/api/call-center/queues/${qId}/agents`, { method: 'POST', body: JSON.stringify({ call_center_agent_uuid: agentUuid, tier_level: level || 0, tier_position: pos || 0 }) });
export const removeCallCenterQueueAgent = (qId, agentUuid) => apiFetch(`/api/call-center/queues/${qId}/agents/${agentUuid}`, { method: 'DELETE' });
export const getProfile = () => apiFetch('/api/profile/me');
export const sendSms = (to, message) => apiFetch('/api/sms/send', { method: 'POST', body: JSON.stringify({ to, message }) });
export const getSmsHistory = (phone) => apiFetch(`/api/sms/history${phone ? '?phone=' + encodeURIComponent(phone) : ''}`);
export async function uploadAvatar(file) {
  const t = _getState().token;
  const res = await fetch(PROV + '/api/profile/avatar', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
  return res.json();
}
export const deleteAvatar = () => apiFetch('/api/profile/avatar', { method: 'DELETE' });
export const updatePresence = (status) => apiFetch('/api/users/presence', { method: 'PUT', body: JSON.stringify({ status }) });
