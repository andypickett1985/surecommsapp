import React, { useState, useEffect } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';
import SearchBar from '../components/SearchBar';

export default function Calls() {
  const { calls, users, contacts } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [transcriptions, setTranscriptions] = useState([]);
  const [viewingTranscript, setViewingTranscript] = useState(null);

  useEffect(() => {
    ipc.fetchTranscriptions().then(t => setTranscriptions(t || [])).catch(() => {});
  }, []);

  let filtered = calls;
  if (filter === 'missed') filtered = calls.filter(c => c.direction === 'miss');
  if (filter === 'outgoing') filtered = calls.filter(c => c.direction === 'out');
  if (filter === 'incoming') filtered = calls.filter(c => c.direction === 'in');
  if (search) filtered = filtered.filter(c => (c.name + c.number).toLowerCase().includes(search.toLowerCase()));

  const grouped = {};
  filtered.forEach(c => {
    const d = new Date(c.timestamp);
    const key = d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  function handleCall(number) {
    if (!number) return;
    ipc.makeCall(number);
    setState({ callState: { state: 'calling', number, name: '', direction: 'out' } });
  }

  function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function formatDuration(s) { if (!s) return ''; const m = Math.floor(s / 60), sec = s % 60; return `(${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')})`; }

  function cleanNumber(raw) {
    if (!raw) return '';
    let n = raw;
    // Remove SIP URI wrapper: "Name" <sip:123@domain> or sip:123@domain
    const sipMatch = n.match(/(?:<)?sip:([^@>]+)@[^>]*/i);
    if (sipMatch) n = sipMatch[1];
    // Remove quotes around name
    n = n.replace(/^["']|["']$/g, '').trim();
    // If it's just digits/+/*, return as-is
    return n;
  }

  function getDisplayName(call) {
    if (call.name && !call.name.includes('sip:') && !call.name.includes('@')) return call.name;
    const num = cleanNumber(call.number || call.name);
    // Check if this matches a known user
    const matchedUser = users.find(u => u.extension === num);
    if (matchedUser) return matchedUser.display_name || matchedUser.email;
    // Check contacts
    const matchedContact = contacts.find(c => c.number === num);
    if (matchedContact) return matchedContact.name;
    return num || 'Unknown';
  }

  function findTranscription(call) {
    return transcriptions.find(t => {
      const tTime = new Date(t.created_at).getTime();
      const cTime = new Date(call.timestamp).getTime();
      return Math.abs(tTime - cTime) < 120000 && (t.call_number === call.number || !t.call_number);
    });
  }

  const dirIcon = {
    out: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5"><path d="M7 17L17 7m0 0h-8m8 0v8"/></svg>,
    in: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M17 7L7 17m0 0h8m-8 0V9"/></svg>,
    miss: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><path d="M17 7L7 17m0 0h8m-8 0V9"/></svg>,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar value={search} onChange={setSearch} placeholder="Search calls..." />

      <div className="flex items-center gap-2 px-3 mb-2">
        <span className="text-xs text-gray-500">Show:</span>
        {['all','outgoing','incoming','missed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 text-xs rounded-md ${filter === f ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <div className="flex justify-center my-2">
              <span className="px-3 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 font-medium">{date} ({items.length})</span>
            </div>
            {items.map((c, i) => {
              const transcript = findTranscription(c);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group">
                  <button onClick={() => handleCall(cleanNumber(c.number))} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Avatar name={getDisplayName(c)} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {dirIcon[c.direction] || dirIcon.out}
                        <span className={`text-sm font-medium ${c.direction === 'miss' ? 'text-red-600' : 'text-gray-900'} truncate`}>
                          {getDisplayName(c)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 ml-5">
                        {c.direction === 'miss' ? `missed call` : c.direction === 'in' ? 'incoming call' : 'outgoing call'}
                        {cleanNumber(c.number) !== getDisplayName(c) ? ` · ${cleanNumber(c.number)}` : ''}
                      </div>
                    </div>
                  </button>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {transcript && (
                      <button onClick={() => setViewingTranscript(transcript)} className="p-1 text-blue-500 hover:bg-blue-50 rounded-md" title="View transcript">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      </button>
                    )}
                    <div>
                      <div className="text-xs text-gray-500">{formatTime(c.timestamp)}</div>
                      {c.duration > 0 && <div className="text-[10px] text-gray-400">{formatDuration(c.duration)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && <p className="text-center text-gray-400 text-sm py-8">No call history</p>}

        {/* Transcription history section */}
        {transcriptions.length > 0 && (
          <div className="border-t border-gray-200 mt-4 pt-2">
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase">Saved Transcriptions ({transcriptions.length})</h3>
            </div>
            {transcriptions.map(t => (
              <button key={t.id} onClick={() => setViewingTranscript(t)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{cleanNumber(t.call_number) || 'Call transcript'}</div>
                  <div className="text-xs text-gray-500 truncate">{t.summary?.substring(0, 60) || t.transcript?.substring(0, 60) || 'No summary'}</div>
                </div>
                <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transcript viewer modal */}
      {viewingTranscript && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setViewingTranscript(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Transcript</h3>
                <p className="text-xs text-gray-500">{cleanNumber(viewingTranscript.call_number) || 'Call'} - {new Date(viewingTranscript.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setViewingTranscript(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {viewingTranscript.summary && (
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-[10px] font-semibold text-blue-500 uppercase mb-1">Summary</div>
                  <div className="text-sm text-blue-900 whitespace-pre-wrap">{viewingTranscript.summary}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Transcript</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{viewingTranscript.transcript || 'No transcript'}</div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { navigator.clipboard.writeText(viewingTranscript.transcript || ''); }} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-md">Copy</button>
              <button onClick={async () => {
                const emails = prompt('Email to (comma separated):');
                if (emails) {
                  const list = emails.split(',').map(e => e.trim());
                  await ipc.emailTranscription(viewingTranscript.id, list);
                }
              }} className="px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md">Email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
