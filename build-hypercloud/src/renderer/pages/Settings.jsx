import React, { useState, useEffect, useRef } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';
import { RINGTONES, previewRingtone, stopRingtone } from '../lib/ringtone';

export default function Settings() {
  const { user, sipAccounts, regStatus } = useStore();
  const account = sipAccounts?.[0];
  const [cf, setCf] = useState(null);
  const [saving, setSaving] = useState(false);
  const [audioDevices, setAudioDevices] = useState({ speakers: [], mics: [] });
  const [selectedSpeaker, setSelectedSpeaker] = useState(localStorage.getItem('scv_speaker') || 'default');
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('scv_mic') || 'default');
  const [selectedRingtone, setSelectedRingtone] = useState(localStorage.getItem('scv_ringtone') || 'modern');
  const [ringtoneVolume, setRingtoneVolume] = useState(parseFloat(localStorage.getItem('scv_ringtone_volume') || '0.8'));
  const [customRingtoneName, setCustomRingtoneName] = useState(localStorage.getItem('scv_ringtone_custom_name') || '');
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const [debugMode, setDebugMode] = useState(localStorage.getItem('scv_debug') === 'true');
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [callCenter, setCallCenter] = useState({ loading: true, enabled: false, linked: false, agent: null, statuses: [] });
  const [ccStatus, setCcStatus] = useState('');
  const [ccSaving, setCcSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    ipc.getCallForward().then(data => {
      if (data && !data.error) setCf(data);
    }).catch(() => {});

    // Enumerate audio devices
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices({ speakers, mics });
    }).catch(() => {});

    ipc.getCallCenterMe().then(data => {
      const next = {
        loading: false,
        enabled: !!data?.enabled,
        linked: !!data?.linked,
        agent: data?.agent || null,
        statuses: data?.statuses || [],
      };
      setCallCenter(next);
      setCcStatus((data?.agent?.agent_status || data?.statuses?.[0] || '').trim());
    }).catch(() => {
      setCallCenter({ loading: false, enabled: false, linked: false, agent: null, statuses: [] });
    });
  }, []);

  function handleLogout() {
    ipc.logout();
    ipc.updatePresence('offline').catch(() => {});
    setState({ view: 'login', user: null, token: null, sipAccounts: [], showSettings: false, regStatus: { code: 0, reason: 'Disconnected' }, users: [], conversations: [], messages: {} });
  }

  async function saveCf(updates) {
    setSaving(true);
    try {
      await ipc.setCallForward(updates);
      const fresh = await ipc.getCallForward();
      if (fresh && !fresh.error) setCf(fresh);
    } catch {}
    setSaving(false);
  }

  function toggleForward(type, field) {
    const current = cf[type];
    saveCf({ [type]: { ...current, [field]: !current[field] } });
  }

  function setDestination(type, value) {
    const current = cf[type];
    saveCf({ [type]: { ...current, destination: value } });
  }

  function handleSpeakerChange(deviceId) {
    setSelectedSpeaker(deviceId);
    localStorage.setItem('scv_speaker', deviceId);
  }

  function handleMicChange(deviceId) {
    setSelectedMic(deviceId);
    localStorage.setItem('scv_mic', deviceId);
  }

  function handleRingtoneChange(id) {
    setSelectedRingtone(id);
    localStorage.setItem('scv_ringtone', id);
    const tone = RINGTONES.find(r => r.id === id);
    if (tone?.url) {
      setPreviewPlaying(id);
      previewRingtone(tone.url, selectedSpeaker).then(() => {
        setTimeout(() => setPreviewPlaying(null), 4000);
      });
    } else {
      stopRingtone();
      setPreviewPlaying(null);
    }
  }

  function handleVolumeChange(vol) {
    setRingtoneVolume(vol);
    localStorage.setItem('scv_ringtone_volume', vol.toString());
  }

  function handleCustomRingtone(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File too large. Maximum size is 2 MB.');
      return;
    }
    const allowed = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/x-wav'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|webm|aac|m4a)$/i)) {
      alert('Unsupported format. Please use WAV, MP3, OGG, or AAC.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      localStorage.setItem('scv_ringtone_custom', dataUrl);
      localStorage.setItem('scv_ringtone_custom_name', file.name);
      localStorage.setItem('scv_ringtone', 'custom');
      setSelectedRingtone('custom');
      setCustomRingtoneName(file.name);
      setPreviewPlaying('custom');
      previewRingtone(dataUrl, selectedSpeaker).then(() => {
        setTimeout(() => setPreviewPlaying(null), 4000);
      });
    };
    reader.readAsDataURL(file);
  }

  function handlePreviewClick(id) {
    if (previewPlaying === id) {
      stopRingtone();
      setPreviewPlaying(null);
      return;
    }
    let url;
    if (id === 'custom') {
      url = localStorage.getItem('scv_ringtone_custom');
    } else {
      url = RINGTONES.find(r => r.id === id)?.url;
    }
    if (!url) return;
    setPreviewPlaying(id);
    previewRingtone(url, selectedSpeaker).then(() => {
      setTimeout(() => setPreviewPlaying(null), 5000);
    });
  }

  function toggleDebug() {
    const next = !debugMode;
    setDebugMode(next);
    localStorage.setItem('scv_debug', String(next));
    if (next) {
      // Enable SIP engine verbose logging
      ipc.sipStart && console.log('[DEBUG] Debug mode enabled');
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('File too large. Max 2 MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    setAvatarUploading(true);
    try {
      const result = await ipc.uploadAvatar(file);
      if (result?.avatar_url) {
        setAvatarUrl(result.avatar_url);
        setState(prev => ({ user: { ...prev.user, avatarUrl: result.avatar_url } }));
      }
    } catch (err) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    }
    setAvatarUploading(false);
  }

  async function handleAvatarRemove() {
    try {
      await ipc.deleteAvatar();
      setAvatarUrl(null);
      setState(prev => ({ user: { ...prev.user, avatarUrl: null } }));
    } catch {}
  }

  function openDevTools() {
    // In dev mode this opens devtools
    window.electronAPI?.windowMaximize?.();
    try { require('electron').remote?.getCurrentWindow()?.webContents?.openDevTools(); } catch {}
  }

  async function saveCallCenterStatus() {
    if (!ccStatus || !callCenter.enabled || !callCenter.linked) return;
    setCcSaving(true);
    try {
      await ipc.setCallCenterStatus(ccStatus);
      setCallCenter(prev => ({
        ...prev,
        agent: prev.agent ? { ...prev.agent, agent_status: ccStatus } : prev.agent,
      }));
    } catch (err) {
      alert(err.message || 'Failed to set call center status');
    }
    setCcSaving(false);
  }

  return (
    <div className="absolute inset-0 z-40 bg-black/30 flex justify-end animate-fade-in" onClick={e => { if (e.target === e.currentTarget) setState({ showSettings: false }); }}>
      <div className="w-96 h-full bg-white shadow-2xl flex flex-col" style={{ animation: 'slideInRight 0.2s ease' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button onClick={() => setState({ showSettings: false })} className="p-1 text-gray-400 hover:text-gray-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Profile */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <Avatar name={user?.displayName || user?.email} size="lg" presence="online" image={avatarUrl ? `https://appmanager.hyperclouduk.com${avatarUrl}` : undefined} />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              {avatarUploading && <div className="absolute inset-0 rounded-full bg-white/60 flex items-center justify-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarUpload} className="hidden" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">{user?.displayName || 'User'}</div>
              <div className="text-xs text-gray-500">{user?.email}</div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => avatarInputRef.current?.click()} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
                  {avatarUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {avatarUrl && (
                  <button onClick={handleAvatarRemove} className="text-[10px] text-gray-400 hover:text-red-500 font-medium">Remove</button>
                )}
              </div>
            </div>
          </div>

          {/* Audio Devices */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Audio Devices</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Speaker / Output</label>
                <select value={selectedSpeaker} onChange={e => handleSpeakerChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white">
                  <option value="default">System Default</option>
                  {audioDevices.speakers.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,8)}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Microphone / Input</label>
                <select value={selectedMic} onChange={e => handleMicChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white">
                  <option value="default">System Default</option>
                  {audioDevices.mics.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0,8)}`}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Ringtone */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Ringtone</h3>
            <div className="space-y-3">
              {/* Preset ringtones */}
              <div className="space-y-1">
                {RINGTONES.map(tone => (
                  <label key={tone.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedRingtone === tone.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                    <input type="radio" name="ringtone" value={tone.id} checked={selectedRingtone === tone.id}
                      onChange={() => handleRingtoneChange(tone.id)}
                      className="w-3.5 h-3.5 text-blue-500 accent-blue-500" />
                    <span className="flex-1 text-sm text-gray-700">{tone.name}</span>
                    {tone.url && (
                      <button onClick={(e) => { e.preventDefault(); handlePreviewClick(tone.id); }}
                        className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                        {previewPlaying === tone.id
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        }
                      </button>
                    )}
                  </label>
                ))}

                {/* Custom ringtone row */}
                <label
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedRingtone === 'custom' ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <input type="radio" name="ringtone" value="custom" checked={selectedRingtone === 'custom'}
                    onChange={() => { if (localStorage.getItem('scv_ringtone_custom')) { handleRingtoneChange('custom'); } else { fileInputRef.current?.click(); } }}
                    className="w-3.5 h-3.5 text-blue-500 accent-blue-500" />
                  <span className="flex-1 text-sm text-gray-700">
                    {customRingtoneName ? `Custom: ${customRingtoneName}` : 'Custom...'}
                  </span>
                  {selectedRingtone === 'custom' && customRingtoneName && (
                    <button onClick={(e) => { e.preventDefault(); handlePreviewClick('custom'); }}
                      className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                      {previewPlaying === 'custom'
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      }
                    </button>
                  )}
                </label>
              </div>

              {/* Upload button */}
              <input ref={fileInputRef} type="file" accept=".wav,.mp3,.ogg,.aac,.m4a,audio/*" onChange={handleCustomRingtone} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Custom Ringtone
              </button>

              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Ringtone Volume</label>
                  <span className="text-xs text-gray-400">{Math.round(ringtoneVolume * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={ringtoneVolume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
            </div>
          </section>

          {/* Call Center */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Call Center</h3>
            {callCenter.loading ? (
              <div className="text-xs text-gray-500">Loading call center profile...</div>
            ) : !callCenter.enabled ? (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Call center mode is not enabled for your extension.
              </div>
            ) : !callCenter.linked ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Call center mode is enabled, but no FusionPBX call-center agent is linked yet. Ask your admin to map your user in the portal.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-500">
                  Linked agent: <span className="font-medium text-gray-700">{callCenter.agent?.agent_name || callCenter.agent?.agent_id || 'Agent'}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Agent status</label>
                  <select
                    value={ccStatus}
                    onChange={e => setCcStatus(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
                  >
                    {(callCenter.statuses || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={saveCallCenterStatus}
                  disabled={ccSaving || !ccStatus}
                  className="w-full py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                >
                  {ccSaving ? 'Updating...' : 'Set Agent Status'}
                </button>
              </div>
            )}
          </section>

          {/* Call Forward Settings */}
          {cf && (
            <section>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Call Forwarding</h3>
              <div className="space-y-3">
                <ForwardRow label="Forward All Calls" desc="Redirect all incoming calls" enabled={cf.forwardAll.enabled} destination={cf.forwardAll.destination}
                  onToggle={() => toggleForward('forwardAll', 'enabled')} onDestChange={v => setDestination('forwardAll', v)} />
                <ForwardRow label="Forward When Busy" desc="When extension is busy" enabled={cf.forwardBusy.enabled} destination={cf.forwardBusy.destination}
                  onToggle={() => toggleForward('forwardBusy', 'enabled')} onDestChange={v => setDestination('forwardBusy', v)} />
                <ForwardRow label="Forward No Answer" desc="When call is not answered" enabled={cf.forwardNoAnswer.enabled} destination={cf.forwardNoAnswer.destination}
                  onToggle={() => toggleForward('forwardNoAnswer', 'enabled')} onDestChange={v => setDestination('forwardNoAnswer', v)} />
                <ForwardRow label="Forward Not Registered" desc="When device is offline" enabled={cf.forwardNotRegistered.enabled} destination={cf.forwardNotRegistered.destination}
                  onToggle={() => toggleForward('forwardNotRegistered', 'enabled')} onDestChange={v => setDestination('forwardNotRegistered', v)} />

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Do Not Disturb</div>
                    <div className="text-[11px] text-gray-400">Reject all incoming calls</div>
                  </div>
                  <button onClick={() => saveCf({ dnd: !cf.dnd })}
                    className={`w-10 h-6 rounded-full transition-colors relative ${cf.dnd ? 'bg-red-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${cf.dnd ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              {saving && <p className="text-[10px] text-blue-500 mt-2">Saving...</p>}
            </section>
          )}

          {/* Connection */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Connection</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Status</span><span className={regStatus.code === 200 ? 'text-green-600 font-medium' : 'text-gray-400'}>{regStatus.code === 200 ? 'Registered' : (regStatus.reason || 'Offline')}</span></div>
              {account && <>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Server</span><span className="text-gray-900 text-xs">{account.server}</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Extension</span><span className="text-gray-900">{account.username}</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-500">Transport</span><span className="text-gray-900 uppercase">{account.transport || 'UDP'}</span></div>
              </>}
            </div>
          </section>

          {/* Network Diagnostics */}
          <NetworkDiagnostics account={account} user={user} />

          {/* Debug / Advanced */}
          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Advanced</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">Debug Mode</div>
                  <div className="text-[11px] text-gray-400">Enable verbose SIP logging and diagnostics</div>
                </div>
                <button onClick={toggleDebug}
                  className={`w-10 h-6 rounded-full transition-colors relative ${debugMode ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${debugMode ? 'left-5' : 'left-1'}`} />
                </button>
              </div>

              {debugMode && (
                <div className="space-y-2 pt-1">
                  <button onClick={() => setShowDebugLog(!showDebugLog)} className="w-full text-left px-3 py-2 text-xs bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors">
                    {showDebugLog ? 'Hide' : 'Show'} Debug Info
                  </button>
                  {showDebugLog && (
                    <div className="px-3 py-2 bg-gray-900 rounded-lg text-[10px] font-mono text-green-400 max-h-40 overflow-y-auto space-y-0.5">
                      <div>App: SureCloudVoice v1.5.0</div>
                      <div>SIP: {regStatus.code === 200 ? 'Registered' : `Error ${regStatus.code}`} {regStatus.reason}</div>
                      <div>Server: {account?.server || 'none'}</div>
                      <div>Ext: {account?.username || 'none'}</div>
                      <div>Transport: {account?.transport || 'udp'}</div>
                      <div>User ID: {user?.id?.slice(0,8) || '?'}</div>
                      <div>Token: {useStore().token?.slice(0,20) || 'none'}...</div>
                      <div>Speaker: {selectedSpeaker}</div>
                      <div>Mic: {selectedMic}</div>
                      <div>Debug: {debugMode ? 'ON' : 'OFF'}</div>
                      <div>Platform: {navigator.platform}</div>
                      <div>UserAgent: {navigator.userAgent.slice(0,60)}</div>
                    </div>
                  )}
                  <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="w-full text-left px-3 py-2 text-xs bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                    Clear All Local Data & Restart
                  </button>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">About</h3>
            <p className="text-sm text-gray-500">SureCloudVoice v1.5.0</p>
            <p className="text-xs text-gray-400 mt-1">Powered by Sure by Beyon</p>
          </section>
        </div>

        <div className="p-5 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm">Sign Out</button>
        </div>
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}

function NetworkDiagnostics({ account, user }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [testPhase, setTestPhase] = useState('');

  async function runAllTests() {
    setRunning(true);
    setResults(null);
    setEmailSent(false);
    const r = { timestamp: new Date().toISOString(), server: account?.server || 'unknown', extension: account?.username || '?' };

    setTestPhase('Testing latency...');
    try {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await fetch('https://appmanager.hyperclouduk.com/api/health', { cache: 'no-store' });
        times.push(Math.round(performance.now() - t0));
      }
      r.latency = { min: Math.min(...times), max: Math.max(...times), avg: Math.round(times.reduce((a,b) => a+b, 0) / times.length), samples: times };
      r.latencyStatus = r.latency.avg < 100 ? 'good' : r.latency.avg < 300 ? 'fair' : 'poor';
    } catch (e) { r.latency = { error: e.message }; r.latencyStatus = 'fail'; }

    setTestPhase('Checking SIP connectivity...');
    try {
      const sipServer = account?.server || '';
      if (sipServer) {
        const t0 = performance.now();
        // We can't do raw UDP from browser, so test TCP connectivity to the SIP domain
        const testUrl = `https://${sipServer.replace(/:\d+$/, '')}:443`;
        try {
          await Promise.race([
            fetch(testUrl, { mode: 'no-cors', cache: 'no-store' }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          r.sipConnectivity = { reachable: true, time: Math.round(performance.now() - t0) };
        } catch {
          r.sipConnectivity = { reachable: false, time: Math.round(performance.now() - t0) };
        }
        // SIP ALG heuristic: if registered OK but latency is high or we see issues, flag it
        r.sipAlg = r.latencyStatus === 'poor' ? 'possible' : 'unlikely';
        r.sipAlgNote = 'SIP ALG detection is heuristic. If you experience one-way audio, dropped calls, or registration issues, SIP ALG may be active on your router. Disable it in router settings.';
      } else {
        r.sipConnectivity = { error: 'No SIP server configured' };
        r.sipAlg = 'unknown';
      }
    } catch (e) { r.sipConnectivity = { error: e.message }; }

    setTestPhase('Testing gateway...');
    try {
      const t0 = performance.now();
      const res = await fetch('https://appmanager.hyperclouduk.com/api/health', { cache: 'no-store' });
      const data = await res.json();
      r.gateway = { reachable: true, time: Math.round(performance.now() - t0), version: data.version };
      r.gatewayStatus = 'connected';
    } catch (e) { r.gateway = { reachable: false, error: e.message }; r.gatewayStatus = 'failed'; }

    setTestPhase('Download speed (pass 1 of 3)...');
    try {
      const speeds = [];
      for (let i = 0; i < 3; i++) {
        setTestPhase(`Download speed (pass ${i + 1} of 3)...`);
        const t0 = performance.now();
        const res = await fetch(`https://appmanager.hyperclouduk.com/speedtest.bin?r=${Date.now()}`, { cache: 'no-store' });
        const blob = await res.blob();
        const elapsed = (performance.now() - t0) / 1000;
        const mbps = (blob.size / (1024 * 1024)) / elapsed * 8;
        speeds.push({ mbps: parseFloat(mbps.toFixed(1)), timeMs: Math.round(elapsed * 1000), sizeKb: Math.round(blob.size / 1024) });
      }
      speeds.sort((a, b) => b.mbps - a.mbps);
      r.downloadSpeed = {
        best: speeds[0].mbps,
        avg: parseFloat((speeds.reduce((a, b) => a + b.mbps, 0) / speeds.length).toFixed(1)),
        worst: speeds[speeds.length - 1].mbps,
        passes: speeds,
      };
      r.speedStatus = r.downloadSpeed.avg > 10 ? 'good' : r.downloadSpeed.avg > 2 ? 'fair' : 'poor';
    } catch { r.downloadSpeed = { error: 'Could not test' }; r.speedStatus = 'fail'; }

    setTestPhase('Upload speed (pass 1 of 3)...');
    try {
      const upSpeeds = [];
      for (let i = 0; i < 3; i++) {
        setTestPhase(`Upload speed (pass ${i + 1} of 3)...`);
        const payload = new Uint8Array(512 * 1024);
        crypto.getRandomValues(payload);
        const t0 = performance.now();
        await fetch('https://appmanager.hyperclouduk.com/api/speedtest/upload', {
          method: 'POST', body: payload, cache: 'no-store',
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        const elapsed = (performance.now() - t0) / 1000;
        upSpeeds.push(parseFloat(((512 / 1024) / elapsed * 8).toFixed(1)));
      }
      upSpeeds.sort((a, b) => b - a);
      r.uploadSpeed = {
        best: upSpeeds[0],
        avg: parseFloat((upSpeeds.reduce((a, b) => a + b, 0) / upSpeeds.length).toFixed(1)),
        worst: upSpeeds[upSpeeds.length - 1],
      };
      r.uploadStatus = r.uploadSpeed.avg > 5 ? 'good' : r.uploadSpeed.avg > 1 ? 'fair' : 'poor';
    } catch { r.uploadSpeed = { error: 'Could not test' }; r.uploadStatus = 'fail'; }

    setTestPhase('Detecting NAT type...');
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const candidates = [];
      pc.createDataChannel('test');
      pc.onicecandidate = (e) => { if (e.candidate) candidates.push(e.candidate.candidate); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise(res => setTimeout(res, 3000));
      pc.close();
      const hasRelay = candidates.some(c => c.includes('relay'));
      const hasSrflx = candidates.some(c => c.includes('srflx'));
      r.nat = { type: hasRelay ? 'Symmetric (restrictive)' : hasSrflx ? 'NAT detected (OK)' : 'Open/Direct', candidates: candidates.length };
      r.natStatus = hasRelay ? 'warning' : 'good';
    } catch { r.nat = { type: 'Could not detect' }; r.natStatus = 'unknown'; }

    setTestPhase('');
    setResults(r);
    setRunning(false);
  }

  async function emailResults() {
    if (!emailAddr.trim() || !results) return;
    setEmailing(true);
    try {
      const badge = (status) => {
        const colors = { good: '#16a34a', connected: '#16a34a', fair: '#ca8a04', warning: '#ca8a04', possible: '#ca8a04' };
        const bg = { good: '#f0fdf4', connected: '#f0fdf4', fair: '#fefce8', warning: '#fefce8', possible: '#fefce8' };
        const label = (status || 'unknown').toUpperCase();
        return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${bg[status] || '#fef2f2'};color:${colors[status] || '#dc2626'}">${label}</span>`;
      };

      const row = (label, value, status) =>
        `<tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:500;color:#374151;width:180px">${label}</td><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#4b5563">${value}</td>${status ? `<td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right">${badge(status)}</td>` : '<td style="padding:10px 16px;border-bottom:1px solid #f0f0f0"></td>'}</tr>`;

      const report_html = `
        <p style="color:#71717a;font-size:13px;margin:0 0 20px">
          <strong>Date:</strong> ${new Date(results.timestamp).toLocaleString()}<br>
          <strong>User:</strong> ${user?.displayName || user?.email || '?'}<br>
          <strong>Extension:</strong> ${results.extension}<br>
          <strong>Server:</strong> ${results.server}
        </p>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;font-size:13px">
          <thead><tr style="background:#f9fafb"><th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px" colspan="3">Test Results</th></tr></thead>
          <tbody>
            ${row('Latency', results.latency?.error || `Avg: ${results.latency?.avg}ms &nbsp;|&nbsp; Min: ${results.latency?.min}ms &nbsp;|&nbsp; Max: ${results.latency?.max}ms`, results.latencyStatus)}
            ${row('Download Speed', results.downloadSpeed?.error || `Best: ${results.downloadSpeed?.best} Mbps &nbsp;|&nbsp; Avg: ${results.downloadSpeed?.avg} Mbps &nbsp;|&nbsp; Worst: ${results.downloadSpeed?.worst} Mbps<br><span style="color:#9ca3af;font-size:11px">3 passes &middot; 2 MB test file</span>`, results.speedStatus)}
            ${row('Upload Speed', results.uploadSpeed?.error || `Best: ${results.uploadSpeed?.best} Mbps &nbsp;|&nbsp; Avg: ${results.uploadSpeed?.avg} Mbps &nbsp;|&nbsp; Worst: ${results.uploadSpeed?.worst} Mbps<br><span style="color:#9ca3af;font-size:11px">3 passes &middot; 512 KB payload</span>`, results.uploadStatus)}
            ${row('Gateway', results.gateway?.reachable ? `Connected in ${results.gateway.time}ms (v${results.gateway.version})` : (results.gateway?.error || 'Failed'), results.gatewayStatus)}
            ${row('SIP ALG', results.sipAlg === 'unlikely' ? 'No SIP ALG detected' : results.sipAlg === 'possible' ? 'SIP ALG may be active' : 'Unknown', results.sipAlg === 'unlikely' ? 'good' : results.sipAlg === 'possible' ? 'warning' : 'fail')}
            ${row('SIP Server', results.sipConnectivity?.reachable ? `Reachable (${results.sipConnectivity.time}ms)` : 'Unreachable', results.sipConnectivity?.reachable ? 'good' : 'fail')}
            ${row('NAT Type', `${results.nat?.type || '?'} (${results.nat?.candidates || 0} ICE candidates)`, results.natStatus)}
          </tbody>
        </table>`;

      const report_text = `SureCloudVoice Network Diagnostics Report
Date: ${new Date(results.timestamp).toLocaleString()}
User: ${user?.displayName || user?.email || '?'}
Extension: ${results.extension}
Server: ${results.server}

--- Latency ---
Min: ${results.latency?.min || '?'}ms | Max: ${results.latency?.max || '?'}ms | Avg: ${results.latency?.avg || '?'}ms
Status: ${(results.latencyStatus || '?').toUpperCase()}

--- Download Speed ---
Best: ${results.downloadSpeed?.best || '?'} Mbps | Avg: ${results.downloadSpeed?.avg || '?'} Mbps | Worst: ${results.downloadSpeed?.worst || '?'} Mbps (3 passes x 2 MB)

--- Upload Speed ---
Best: ${results.uploadSpeed?.best || '?'} Mbps | Avg: ${results.uploadSpeed?.avg || '?'} Mbps | Worst: ${results.uploadSpeed?.worst || '?'} Mbps (3 passes x 512 KB)

--- Gateway ---
Reachable: ${results.gateway?.reachable ? 'Yes' : 'No'} | Time: ${results.gateway?.time || '?'}ms | Version: ${results.gateway?.version || '?'}

--- SIP ---
Server Reachable: ${results.sipConnectivity?.reachable ? 'Yes' : 'No'} | Time: ${results.sipConnectivity?.time || '?'}ms
SIP ALG: ${results.sipAlg || '?'}

--- NAT ---
Type: ${results.nat?.type || '?'} | ICE Candidates: ${results.nat?.candidates || '?'}`;

      const resp = await fetch('https://appmanager.hyperclouduk.com/api/diagnostics/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: emailAddr.trim(), report_text, report_html }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Send failed');
      setEmailSent(true);
    } catch (err) {
      console.error('Email send failed:', err);
      alert('Failed to send email: ' + (err.message || 'Unknown error'));
    }
    setEmailing(false);
  }

  const statusIcon = (status) => {
    if (status === 'good' || status === 'connected') return <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>;
    if (status === 'fair' || status === 'warning' || status === 'possible') return <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-xs">!</span>;
    return <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">✕</span>;
  };

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Network Diagnostics</h3>
      <button onClick={runAllTests} disabled={running}
        className="w-full py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
        {running ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {testPhase || 'Running Tests...'}</> : 'Run Network Tests'}
      </button>

      {results && (
        <div className="mt-3 space-y-2">
          {/* Latency */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.latencyStatus)}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">Latency</div>
              <div className="text-[11px] text-gray-500">
                {results.latency?.error || `Avg: ${results.latency?.avg}ms | Min: ${results.latency?.min}ms | Max: ${results.latency?.max}ms`}
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${results.latencyStatus === 'good' ? 'bg-green-100 text-green-700' : results.latencyStatus === 'fair' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {results.latencyStatus?.toUpperCase()}
            </span>
          </div>

          {/* Download Speed */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.speedStatus || 'good')}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">Download Speed</div>
              {results.downloadSpeed?.error
                ? <div className="text-[11px] text-gray-500">{results.downloadSpeed.error}</div>
                : <>
                    <div className="text-[11px] text-gray-500">
                      Best: {results.downloadSpeed?.best} Mbps | Avg: {results.downloadSpeed?.avg} Mbps | Worst: {results.downloadSpeed?.worst} Mbps
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">3 passes &middot; 2 MB test file</div>
                  </>
              }
            </div>
            {results.downloadSpeed?.avg && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${results.speedStatus === 'good' ? 'bg-green-100 text-green-700' : results.speedStatus === 'fair' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {results.downloadSpeed.avg} Mbps
              </span>
            )}
          </div>

          {/* Upload Speed */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.uploadStatus || 'good')}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">Upload Speed</div>
              {results.uploadSpeed?.error
                ? <div className="text-[11px] text-gray-500">{results.uploadSpeed.error}</div>
                : <>
                    <div className="text-[11px] text-gray-500">
                      Best: {results.uploadSpeed?.best} Mbps | Avg: {results.uploadSpeed?.avg} Mbps | Worst: {results.uploadSpeed?.worst} Mbps
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">3 passes &middot; 512 KB payload</div>
                  </>
              }
            </div>
            {results.uploadSpeed?.avg && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${results.uploadStatus === 'good' ? 'bg-green-100 text-green-700' : results.uploadStatus === 'fair' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {results.uploadSpeed.avg} Mbps
              </span>
            )}
          </div>

          {/* Gateway */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.gatewayStatus)}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">Gateway Connection</div>
              <div className="text-[11px] text-gray-500">
                {results.gateway?.reachable ? `Connected in ${results.gateway.time}ms (v${results.gateway.version})` : results.gateway?.error || 'Failed'}
              </div>
            </div>
          </div>

          {/* SIP ALG */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.sipAlg === 'unlikely' ? 'good' : results.sipAlg === 'possible' ? 'warning' : 'fail')}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">SIP ALG Detection</div>
              <div className="text-[11px] text-gray-500">
                {results.sipAlg === 'unlikely' ? 'No SIP ALG detected' : results.sipAlg === 'possible' ? 'SIP ALG may be active - check router settings' : 'Could not test'}
              </div>
              {results.sipConnectivity && <div className="text-[11px] text-gray-500">SIP server: {results.sipConnectivity.reachable ? `reachable (${results.sipConnectivity.time}ms)` : 'unreachable'}</div>}
            </div>
          </div>

          {/* NAT */}
          <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
            {statusIcon(results.natStatus)}
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-700">NAT Type</div>
              <div className="text-[11px] text-gray-500">{results.nat?.type} ({results.nat?.candidates} candidates)</div>
            </div>
          </div>

          {/* Email results */}
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-600 mb-1.5">Email results to:</div>
            <div className="flex gap-2">
              <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} placeholder="support@company.com"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400" />
              <button onClick={emailResults} disabled={emailing || !emailAddr.trim() || emailSent}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg transition-colors">
                {emailSent ? 'Sent!' : emailing ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ForwardRow({ label, desc, enabled, destination, onToggle, onDestChange }) {
  const [editing, setEditing] = useState(false);
  const [tempDest, setTempDest] = useState(destination);

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">{label}</div>
          <div className="text-[11px] text-gray-400">{desc}</div>
        </div>
        <button onClick={onToggle}
          className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>
      {enabled && (
        <div className="mt-2 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3"/></svg>
          {editing ? (
            <input type="text" value={tempDest} onChange={e => setTempDest(e.target.value)}
              onBlur={() => { onDestChange(tempDest); setEditing(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onDestChange(tempDest); setEditing(false); } }}
              className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-200" autoFocus />
          ) : (
            <button onClick={() => { setTempDest(destination); setEditing(true); }}
              className="flex-1 text-left text-sm text-blue-600 hover:text-blue-800 truncate">
              {destination || 'Set destination...'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
