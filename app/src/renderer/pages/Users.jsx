import React, { useState } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';
import SearchBar from '../components/SearchBar';

export default function Users() {
  const { users, presence } = useStore();
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState(null);

  const filtered = search
    ? users.filter(u => (u.display_name || u.email || '').toLowerCase().includes(search.toLowerCase()))
    : users;

  function handleCall(number, hasVideo = false) {
    if (!number) return;
    ipc.makeCall(number, hasVideo);
    setState({ callState: { state: 'calling', number, name: '', direction: 'out' } });
  }

  async function startChatWith(targetUser) {
    try {
      const result = await ipc.createConversation([targetUser.id], null, 'direct');
      const convId = result.id || result.conversation_id;
      if (convId) {
        const convos = await ipc.fetchConversations().catch(() => []);
        setState({ conversations: convos, section: 'chats', selectedItem: convId, selectedType: 'chat' });
      }
    } catch (err) {
      console.error('Start chat error:', err);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar value={search} onChange={setSearch} />

      <div className="px-3 mb-1">
        <h3 className="text-xs font-medium text-gray-500">Users</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(u => {
          const pres = presence[u.id] || 'offline';
          const name = u.display_name || u.sip_display_name || u.email;
          const ext = u.extension || '';
          const isHovered = hoveredId === u.id;

          return (
            <div
              key={u.id}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isHovered ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => setState({ selectedItem: u.id, selectedType: 'user' })}
              onMouseEnter={() => setHoveredId(u.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Avatar name={name} presence={pres} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                <div className="text-xs text-gray-500">{ext}</div>
              </div>
              {isHovered && (
                <div className="flex gap-1 animate-fade-in">
                  <button onClick={(e) => { e.stopPropagation(); startChatWith(u); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Chat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  </button>
                  {ext && <button onClick={(e) => { e.stopPropagation(); handleCall(ext, true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Video call">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  </button>}
                  {ext && <button onClick={(e) => { e.stopPropagation(); handleCall(ext); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Call">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                  </button>}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No users found</p>}
      </div>
    </div>
  );
}
