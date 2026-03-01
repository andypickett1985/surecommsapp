import React, { useState, useEffect, useRef } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';

export default function InCall() {
  const { callState, users, contacts, user, sipAccounts, presence } = useStore();
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const [transcribing, setTranscribing] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [subject, setSubject] = useState('');
  const [aiLoading, setAiLoading] = useState('');
  const transcriptRef = useRef(null);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [recording, setRecording] = useState(true);
  const [maskActive, setMaskActive] = useState(false);

  useEffect(() => {
    if (callState?.state === 'confirmed') {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callState?.state]);

  useEffect(() => {
    ipc.onTranscriptionUpdate((data) => {
      const speakerPrefix = data.speaker ? `[${data.speaker}]: ` : '';
      setLiveText(data.isFinal ? '' : speakerPrefix + (data.text || ''));
      if (data.fullTranscript) setFullTranscript(data.fullTranscript);
      if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    });
    ipc.onTranscriptionStatus((data) => {
      if (data.status === 'error') setTranscribing(false);
    });
  }, []);

  const isConnected = callState?.state === 'confirmed';
  const statusText = { calling: 'Calling...', early: 'Ringing...', connecting: 'Connecting...', confirmed: 'Connected' }[callState?.state] || 'Calling...';
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function doHangup() {
    if (transcribing) stopTranscription();
    ipc.hangup();
    setState({ callState: null });
  }

  function doMute() { const next = !muted; setMuted(next); ipc.toggleMute(next); }
  function doHold() { const next = !held; setHeld(next); ipc.toggleHold(next); }
  function getTransferTarget(value) {
    const domain = sipAccounts?.[0]?.domain || sipAccounts?.[0]?.server || '';
    const raw = (value || '').trim().replace(/^sip:/i, '');
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    return domain ? `${raw}@${domain}` : raw;
  }

  async function doTransfer(value) {
    const target = getTransferTarget(value);
    if (!target) return;
    setTransferring(true);
    setTransferStatus('');
    const res = await ipc.transfer(target);
    if (res?.success === false) {
      setTransferStatus(res.error || 'Transfer failed');
    } else {
      setTransferStatus(`Transfer requested to ${target}`);
      setTimeout(() => setShowTransferPanel(false), 900);
    }
    setTransferring(false);
  }

  const localContacts = JSON.parse(localStorage.getItem('scv_local_contacts') || '[]');
  const transferCandidates = [
    ...users
      .filter(u => u.id !== user?.id)
      .map(u => ({
        id: `user-${u.id}`,
        kind: 'user',
        name: u.display_name || u.email || 'User',
        number: u.extension || u.sip_username || '',
        subtitle: u.email || '',
        presence: (presence?.[u.id] || u.presence || 'offline').toLowerCase(),
      }))
      .filter(c => c.number),
    ...contacts
      .map(c => ({
        id: `contact-${c.id}`,
        kind: 'contact',
        name: c.name || 'Contact',
        number: c.number || c.phones?.[0]?.number || '',
        subtitle: c.organization || c.source || '',
        presence: 'unknown',
      }))
      .filter(c => c.number),
    ...localContacts
      .map(c => ({
        id: `local-${c.id}`,
        kind: 'local',
        name: c.name || 'Local contact',
        number: c.number || '',
        subtitle: c.organization || 'Local',
        presence: 'unknown',
      }))
      .filter(c => c.number),
  ];
  const filteredTransferCandidates = transferQuery.trim()
    ? transferCandidates.filter(c =>
        `${c.name} ${c.number} ${c.subtitle || ''}`.toLowerCase().includes(transferQuery.toLowerCase()))
    : transferCandidates;

  function presenceBadge(p) {
    if (['in_call', 'on_call', 'busy'].includes(p)) {
      return { text: 'On Call', dot: 'bg-orange-400', textClass: 'text-orange-200' };
    }
    if (p === 'dnd') return { text: 'DND', dot: 'bg-red-400', textClass: 'text-red-200' };
    if (p === 'online') return { text: 'Available', dot: 'bg-emerald-400', textClass: 'text-emerald-200' };
    if (p === 'away') return { text: 'Away', dot: 'bg-yellow-300', textClass: 'text-yellow-200' };
    if (p === 'offline') return { text: 'Offline', dot: 'bg-gray-400', textClass: 'text-gray-300' };
    return { text: 'Unknown', dot: 'bg-gray-500', textClass: 'text-gray-300' };
  }

  async function startTranscription() {
    setTranscribing(true);
    setLiveText('');
    setFullTranscript('');
    setShowTranscript(true);
    const callerName = callState?.name || callState?.number || 'Other';
    await ipc.transcriptionStart({ callerName, userName: 'You' });
  }

  async function stopTranscription() {
    const result = await ipc.transcriptionStop();
    setTranscribing(false);
    if (result?.transcript) setFullTranscript(result.transcript);
  }

  async function saveTranscript() {
    try {
      const result = await ipc.saveTranscription({
        call_number: callState?.number || '',
        call_direction: callState?.direction || 'out',
        call_duration: seconds,
        transcript: fullTranscript,
        summary: [subject && `Subject: ${subject}`, summary, actionItems && `Action Items:\n${actionItems}`].filter(Boolean).join('\n\n'),
      });
      setSavedId(result.id);
    } catch {}
  }

  async function emailTranscript() {
    const emails = prompt('Email addresses (comma separated):');
    if (!emails) return;
    const list = emails.split(',').map(e => e.trim()).filter(Boolean);
    if (!savedId) {
      const result = await ipc.saveTranscription({ call_number: callState?.number || '', call_direction: callState?.direction || 'out', call_duration: seconds, transcript: fullTranscript });
      if (result?.id) await ipc.emailTranscription(result.id, list);
    } else {
      await ipc.emailTranscription(savedId, list);
    }
  }

  function copyTranscript() {
    const all = [subject && `Subject: ${subject}`, summary && `Summary:\n${summary}`, actionItems && `Action Items:\n${actionItems}`, `Transcript:\n${fullTranscript}`].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(all);
  }

  async function generateSummary() {
    if (!fullTranscript) return;
    setAiLoading('summary');
    const r = await ipc.aiSummarize(fullTranscript, 'summary');
    if (r?.result) setSummary(r.result);
    setAiLoading('');
  }

  async function generateActions() {
    if (!fullTranscript) return;
    setAiLoading('actions');
    const r = await ipc.aiSummarize(fullTranscript, 'actions');
    if (r?.result) setActionItems(r.result);
    setAiLoading('');
  }

  async function generateSubjectLine() {
    if (!fullTranscript) return;
    setAiLoading('subject');
    const r = await ipc.aiSummarize(fullTranscript, 'subject');
    if (r?.result) setSubject(r.result);
    setAiLoading('');
  }

  async function autoSummarizeAll() {
    if (!fullTranscript) return;
    setAiLoading('all');
    const [sumR, actR, subR] = await Promise.all([
      ipc.aiSummarize(fullTranscript, 'summary'),
      ipc.aiSummarize(fullTranscript, 'actions'),
      ipc.aiSummarize(fullTranscript, 'subject'),
    ]);
    if (sumR?.result) setSummary(sumR.result);
    if (actR?.result) setActionItems(actR.result);
    if (subR?.result) setSubject(subR.result);
    setAiLoading('');
  }

  return (
    <div className="absolute inset-0 z-50 bg-linear-to-b from-navy via-navy-dark to-navy-dark flex text-white animate-fade-in">
      {/* Left side - call info */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 className="text-2xl font-semibold">{callState?.name || callState?.number || 'Unknown'}</h2>
          {callState?.name && <p className="text-white/50 text-sm mt-1">{callState?.number}</p>}
          <p className="text-white/60 text-sm mt-2">{statusText}</p>
          {isConnected && <p className="text-3xl font-light tabular-nums mt-2 text-white/90">{formatTime(seconds)}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 mb-8 flex-wrap justify-center">
            {[
            { label: 'Mute', active: muted, onClick: doMute, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg> },
            { label: 'Hold', active: held, onClick: doHold, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> },
            { label: 'Transfer', active: showTransferPanel, onClick: () => { setShowTransferPanel(true); setTransferStatus(''); }, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg> },
            { label: maskActive ? 'Unmask' : 'Mask', active: maskActive, onClick: () => {
              if (maskActive) { ipc.sendDtmf('*'); ipc.sendDtmf('6'); setMaskActive(false); }
              else { ipc.sendDtmf('*'); ipc.sendDtmf('5'); setMaskActive(true); }
            }, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{maskActive ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}</svg> },
            { label: transcribing ? 'Stop AI' : 'Transcribe', active: transcribing, onClick: transcribing ? stopTranscription : startTranscription, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> },
          ].map(({ label, active, onClick, icon }) => (
            <button key={label} onClick={onClick} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${active ? 'bg-electric/30 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              {icon}
              <span className="text-[11px]">{label}</span>
            </button>
          ))}
        </div>

        <button onClick={doHangup} className="flex items-center gap-3 px-12 py-4 bg-brand-red hover:bg-brand-red-dark rounded-full text-white font-semibold text-lg shadow-lg shadow-brand-red/30 active:scale-95 transition-all">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0124 20.31v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 014.12 7.56 2 2 0 016.11 5.5h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          End Call
        </button>
      </div>

      {/* Transfer picker */}
      {showTransferPanel && (
        <div className="absolute inset-0 z-20 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f1f37] border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">Transfer Call</h3>
                <p className="text-[11px] text-white/50">Search users/extensions and transfer quickly</p>
              </div>
              <button onClick={() => setShowTransferPanel(false)} className="text-white/50 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-3 border-b border-white/10">
              <input
                value={transferQuery}
                onChange={(e) => setTransferQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doTransfer(transferQuery); }}
                placeholder="Type extension or search name..."
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg bg-white/95 text-gray-900 text-sm outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => doTransfer(transferQuery)}
                  disabled={transferring || !transferQuery.trim()}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium"
                >
                  {transferring ? 'Transferring...' : 'Transfer'}
                </button>
                <button
                  onClick={() => setShowTransferPanel(false)}
                  className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/15 text-white/80"
                >
                  Cancel
                </button>
              </div>
              {transferStatus && <div className="mt-2 text-[11px] text-blue-200">{transferStatus}</div>}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filteredTransferCandidates.length === 0 ? (
                <div className="px-4 py-6 text-xs text-white/45 text-center">No matching users/contacts</div>
              ) : (
                filteredTransferCandidates.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setTransferQuery(c.number); doTransfer(c.number); }}
                    className="w-full text-left px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-white">{c.name}</div>
                      {c.kind === 'user' && (
                        <div className={`inline-flex items-center gap-1 text-[10px] ${presenceBadge(c.presence).textClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${presenceBadge(c.presence).dot}`} />
                          {presenceBadge(c.presence).text}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-white/60">{c.number}{c.subtitle ? ` · ${c.subtitle}` : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right side - live transcription panel */}
      {showTranscript && (
        <div className="w-80 bg-white/5 backdrop-blur border-l border-white/10 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Live Transcription</h3>
              {transcribing && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </div>
            <button onClick={() => setShowTranscript(false)} className="text-white/40 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-white/80">
            {/* Subject line */}
            {subject && (
              <div className="mb-3 px-3 py-2 bg-electric/20 rounded-lg">
                <div className="text-[10px] font-semibold text-electric/60 uppercase mb-0.5">Subject</div>
                <div className="text-white font-medium">{subject}</div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="mb-3 px-3 py-2 bg-blue-500/15 rounded-lg">
                <div className="text-[10px] font-semibold text-blue-300/60 uppercase mb-0.5">Summary</div>
                <div className="text-white/90 whitespace-pre-wrap">{summary}</div>
              </div>
            )}

            {/* Action Items */}
            {actionItems && (
              <div className="mb-3 px-3 py-2 bg-green-500/15 rounded-lg">
                <div className="text-[10px] font-semibold text-green-300/60 uppercase mb-0.5">Action Items</div>
                <div className="text-white/90 whitespace-pre-wrap">{actionItems}</div>
              </div>
            )}

            {/* Transcript with speaker labels */}
            {fullTranscript ? (
              <div className="space-y-1">
                {fullTranscript.split('\n').map((line, i) => {
                  const isYou = line.startsWith('[You]:');
                  const isOther = line.match(/^\[.+\]:/);
                  return (
                    <div key={i} className="leading-relaxed">
                      {isYou ? (
                        <><span className="text-blue-400 font-semibold text-xs">[You]</span><span className="text-white/90"> {line.replace(/^\[You\]:\s*/, '')}</span></>
                      ) : isOther ? (
                        <><span className="text-orange-400 font-semibold text-xs">{line.match(/^\[(.+?)\]/)?.[0]}</span><span className="text-white/90"> {line.replace(/^\[.+?\]:\s*/, '')}</span></>
                      ) : (
                        <span className="text-white/80">{line}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-white/30 italic">{transcribing ? 'Listening...' : 'Click "Transcribe" to start AI transcription'}</span>
            )}
            {transcribing && liveText && (
              <div className="text-electric/80 mt-1 text-xs italic">{liveText}</div>
            )}
          </div>

          {/* AI Summary buttons */}
          {fullTranscript && !transcribing && (
            <div className="px-3 py-2 border-t border-white/10">
              <div className="text-[10px] text-white/40 font-semibold uppercase mb-1.5">AI Analysis</div>
              <div className="flex gap-1">
                <button onClick={autoSummarizeAll} disabled={!!aiLoading} className="flex-1 py-1.5 text-[11px] font-medium bg-electric/20 hover:bg-electric/30 text-electric rounded-md transition-colors disabled:opacity-50">
                  {aiLoading === 'all' ? 'Analyzing...' : 'Auto Summary'}
                </button>
                <button onClick={generateSummary} disabled={!!aiLoading} className="flex-1 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50">
                  {aiLoading === 'summary' ? '...' : 'Summary'}
                </button>
                <button onClick={generateActions} disabled={!!aiLoading} className="flex-1 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50">
                  {aiLoading === 'actions' ? '...' : 'Actions'}
                </button>
                <button onClick={generateSubjectLine} disabled={!!aiLoading} className="flex-1 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50">
                  {aiLoading === 'subject' ? '...' : 'Subject'}
                </button>
              </div>
            </div>
          )}

          {/* Save/Email/Copy actions */}
          {fullTranscript && (
            <div className="flex gap-1 p-3 border-t border-white/10">
              <button onClick={saveTranscript} className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                {savedId ? 'Saved' : 'Save'}
              </button>
              <button onClick={emailTranscript} className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                Email
              </button>
              <button onClick={copyTranscript} className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                Copy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
