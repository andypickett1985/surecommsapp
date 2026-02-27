import React, { useState, useEffect, useRef } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';

export default function DetailPanel() {
  const { selectedItem, selectedType, messages, user, conversations, users, regStatus } = useStore();

  if (selectedType === 'user' && selectedItem) return <UserDetail />;
  if (selectedType === 'chat' && selectedItem) return <ChatThread />;

  return <DefaultPanel />;
}

function DefaultPanel() {
  const { regStatus, user, sipAccounts } = useStore();
  const account = sipAccounts?.[0];

  return (
    <div className="flex flex-col h-full">
      {/* Title bar area */}
      <div className="h-11 border-b border-gray-200 flex items-center justify-between px-4 shrink-0 bg-white" style={{ WebkitAppRegion: 'drag' }}>
        <span className="text-xs font-semibold text-navy">SureCloudVoice</span>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="flex items-center gap-1.5 mr-2">
            <div className={`w-2 h-2 rounded-full ${regStatus.code === 200 ? 'bg-green-500' : regStatus.code === 0 ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-[11px] text-gray-500">{regStatus.code === 200 ? 'Connected' : 'Offline'}</span>
          </div>
          <button onClick={ipc.windowMinimize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg></button>
          <button onClick={ipc.windowMaximize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg></button>
          <button onClick={ipc.windowClose} className="p-1 text-gray-400 hover:text-red-500"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-2 bg-gray-50/50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'15\' fill=\'none\' stroke=\'%23e5e7eb\' stroke-width=\'0.4\'/%3E%3C/svg%3E")', backgroundSize: '40px 40px' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.2"><path d="M14 18C14 16.9 14.9 16 16 16H20L23 20H16V32H32V25L36 28V32C36 33.1 35.1 34 34 34H14C12.9 34 12 33.1 12 32V20C12 18.9 12.9 18 14 18Z" fill="#4C00FF"/><circle cx="30" cy="20" r="6" fill="#CE0037" opacity="0.9"/></svg>
        <p className="text-sm">Select a user or conversation</p>
      </div>

      {/* Bottom input bar */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-gray-400">
          <input placeholder="Type something" className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-300" disabled />
          <button className="p-1 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>
          <button className="p-1 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button>
          <button className="p-1 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg></button>
          <button className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
      </div>
    </div>
  );
}

function UserDetail() {
  const { selectedItem, users, presence } = useStore();
  const u = users.find(usr => usr.id === selectedItem);
  if (!u) return <DefaultPanel />;

  const name = u.display_name || u.sip_display_name || u.email;
  const pres = presence[u.id] || 'offline';
  const presLabel = pres === 'online' ? 'Available' : pres === 'busy' ? 'Busy' : pres === 'away' ? 'Away' : 'Offline';

  function handleCall() { if (u.extension) ipc.makeCall(u.extension); }
  function handleVideo() { if (u.extension) ipc.makeCall(u.extension, true); }

  return (
    <div className="flex flex-col h-full">
      {/* Header with user info */}
      <div className="h-11 border-b border-gray-200 flex items-center justify-between px-4 shrink-0 bg-white" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
          <Avatar name={name} size="sm" presence={pres} />
          <div>
            <span className="text-sm font-medium text-gray-900">{name}</span>
            <span className="text-xs text-green-600 ml-2">{presLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={handleVideo} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></button>
          <button onClick={handleCall} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg></button>
          <button onClick={() => setState({ selectedItem: null, selectedType: null })} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>

          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={ipc.windowMinimize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg></button>
          <button onClick={ipc.windowMaximize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg></button>
          <button onClick={ipc.windowClose} className="p-1 text-gray-400 hover:text-red-500"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg></button>
        </div>
      </div>

      {/* User detail card */}
      <div className="p-6 bg-white border-b border-gray-100">
        <div className="flex items-start gap-4">
          <Avatar name={name} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
            <span className="text-xs text-gray-400">&#9734;</span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
              Phone Numbers
            </div>
            {u.extension && <div className="text-sm ml-6">Extensions: <a className="text-blue-600 hover:underline cursor-pointer" onClick={handleCall}>{u.extension}</a></div>}
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Emails
            </div>
            <div className="text-sm ml-6"><a className="text-blue-600 hover:underline">{u.email}</a></div>
          </div>
        </div>
      </div>

      {/* Chat/message area */}
      <div className="flex-1 bg-gray-50/50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'15\' fill=\'none\' stroke=\'%23e5e7eb\' stroke-width=\'0.4\'/%3E%3C/svg%3E")', backgroundSize: '40px 40px' }} />

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <input placeholder="Type something" className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400 text-gray-900" />
          <button className="p-1 text-gray-400 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>
          <button className="p-1 text-gray-400 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button>
          <button className="p-1 text-gray-400 hover:text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg></button>
          <button className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </div>
      </div>
    </div>
  );
}

function ChatThread() {
  const { selectedItem, messages, user, conversations } = useStore();
  const [input, setInput] = useState('');
  const [tab, setTab] = useState('message');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const conv = conversations.find(c => c.id === selectedItem);
  const convMessages = messages[selectedItem] || [];
  const participants = conv?.participants || [];
  const others = participants.filter(p => p.id !== user?.id);
  const title = conv?.title || others.map(p => p.display_name || p.email).join(', ') || 'Chat';

  useEffect(() => {
    if (selectedItem) {
      ipc.fetchMessages(selectedItem).then(msgs => {
        setState(prev => ({ messages: { ...prev.messages, [selectedItem]: msgs } }));
      }).catch(() => {});
      ipc.markRead(selectedItem).catch(() => {});
    }
  }, [selectedItem]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [convMessages.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const msg = await ipc.sendMessage(selectedItem, input.trim());
      setState(prev => ({ messages: { ...prev.messages, [selectedItem]: [...(prev.messages[selectedItem] || []), msg] } }));
      setInput('');
    } catch {}
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedItem) return;
    setUploading(true);
    try {
      const uploaded = await ipc.uploadChatFile(file);
      const body = uploaded.type?.startsWith('image/')
        ? `[Image: ${uploaded.name}](${uploaded.url})`
        : `[File: ${uploaded.name}](${uploaded.url})`;
      const msg = await ipc.sendMessage(selectedItem, body);
      setState(prev => ({ messages: { ...prev.messages, [selectedItem]: [...(prev.messages[selectedItem] || []), msg] } }));
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function formatDate(ts) { return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }); }

  function renderMessageBody(body) {
    if (!body) return null;
    // Check for image attachment: [Image: name](url)
    const imgMatch = body.match(/^\[Image: (.+?)\]\((.+?)\)$/);
    if (imgMatch) {
      const fullUrl = `https://communicator.surecloudvoice.com${imgMatch[2]}`;
      return (
        <div>
          <img src={fullUrl} alt={imgMatch[1]} className="max-w-48 max-h-48 rounded-lg cursor-pointer" onClick={() => window.open(fullUrl, '_blank')} />
          <div className="text-[10px] text-gray-400 mt-1">{imgMatch[1]}</div>
        </div>
      );
    }
    // Check for file attachment: [File: name](url)
    const fileMatch = body.match(/^\[File: (.+?)\]\((.+?)\)$/);
    if (fileMatch) {
      const fullUrl = `https://communicator.surecloudvoice.com${fileMatch[2]}`;
      return (
        <a href={fullUrl} target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors no-underline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div>
            <div className="text-sm font-medium">{fileMatch[1]}</div>
            <div className="text-[10px] opacity-60">Click to download</div>
          </div>
        </a>
      );
    }
    return body;
  }

  let lastDate = '';

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="h-11 border-b border-gray-200 flex items-center justify-between px-4 shrink-0 bg-white" style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
          <Avatar name={title} size="sm" />
          <div>
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <span className="text-xs text-gray-400 ml-2">{participants.length} participants</span>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={() => setState({ selectedItem: null, selectedType: null })} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={ipc.windowMinimize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor"/></svg></button>
          <button onClick={ipc.windowMaximize} className="p-1 text-gray-400 hover:text-gray-600"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg></button>
          <button onClick={ipc.windowClose} className="p-1 text-gray-400 hover:text-red-500"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50/50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'15\' fill=\'none\' stroke=\'%23e5e7eb\' stroke-width=\'0.4\'/%3E%3C/svg%3E")', backgroundSize: '40px 40px' }}>
        {convMessages.map((m, i) => {
          const isMe = m.sender_id === user?.id;
          const dateStr = formatDate(m.created_at);
          let showDate = dateStr !== lastDate;
          if (showDate) lastDate = dateStr;
          return (
            <React.Fragment key={m.id || i}>
              {showDate && <div className="flex justify-center my-3"><span className="px-3 py-1 bg-gray-200/80 rounded-full text-[10px] text-gray-500 font-medium">{dateStr}</span></div>}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <Avatar name={m.sender_name} size="sm" />}
                <div className={`max-w-[70%] mx-2 px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm'}`}>
                  {!isMe && <div className="text-[10px] font-medium text-gray-500 mb-0.5">{m.sender_name}</div>}
                    <div className="whitespace-pre-wrap">{renderMessageBody(m.body)}</div>
                  <div className={`text-[9px] mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'} text-right`}>{formatTime(m.created_at)}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {convMessages.length === 0 && <p className="text-center text-gray-400 text-sm py-12">No messages yet</p>}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-3">
        <div className="flex gap-1 mb-2">
          <button className={`px-3 py-1 rounded-md text-xs font-medium ${tab === 'message' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setTab('message')}>Message</button>
          <button className={`px-3 py-1 rounded-md text-xs font-medium ${tab === 'comment' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setTab('comment')}>Comment</button>
        </div>
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 flex items-center border border-gray-200 rounded-lg px-3 py-2 focus-within:border-blue-400">
            <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-medium mr-2 shrink-0">sms</span>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type something" className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400" />
          </div>
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
          <button type="button" className="p-1 text-gray-400 hover:text-gray-500" title="Emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/></svg></button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-50" title="Attach file">
            {uploading
              ? <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>}
          </button>
          <button type="button" className="p-1 text-gray-400 hover:text-gray-500" title="Voice message"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/></svg></button>
          <button type="submit" disabled={!input.trim() && !uploading} className="p-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-md"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
        </form>
      </div>
    </div>
  );
}
