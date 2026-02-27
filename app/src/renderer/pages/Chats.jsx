import React, { useState } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';
import SearchBar from '../components/SearchBar';

export default function Chats() {
  const { conversations, user, selectedItem, users } = useStore();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  const filtered = search
    ? conversations.filter(c => getChatTitle(c, user).toLowerCase().includes(search.toLowerCase()))
    : conversations;

  function getChatTitle(conv, currentUser) {
    if (conv.title) return conv.title;
    const others = (conv.participants || []).filter(p => p.id !== currentUser?.id);
    return others.map(p => p.display_name || p.email).join(', ') || 'Chat';
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function selectChat(conv) {
    setState({ selectedItem: conv.id, selectedType: 'chat' });
  }

  async function startChat(targetUser) {
    setShowNewChat(false);
    try {
      const result = await ipc.createConversation([targetUser.id], null, 'direct');
      const convId = result.id || result.conversation_id;
      if (convId) {
        // Refresh conversations list
        const convos = await ipc.fetchConversations().catch(() => []);
        setState({ conversations: convos, selectedItem: convId, selectedType: 'chat' });
      }
    } catch (err) {
      console.error('Create chat error:', err);
    }
  }

  const availableUsers = users.filter(u => u.id !== user?.id);
  const filteredUsers = newChatSearch
    ? availableUsers.filter(u => (u.display_name || u.email || '').toLowerCase().includes(newChatSearch.toLowerCase()))
    : availableUsers;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search chats..." />
      </div>

      {/* New chat button */}
      <div className="px-3 pb-2">
        <button onClick={() => setShowNewChat(!showNewChat)} className="w-full py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Chat
        </button>
      </div>

      {/* New chat user picker */}
      {showNewChat && (
        <div className="mx-3 mb-2 border border-blue-200 rounded-lg bg-blue-50/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-blue-100">
            <input type="text" value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} placeholder="Search users..." autoFocus
              className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredUsers.length === 0 && <p className="text-xs text-gray-400 p-3 text-center">No users found</p>}
            {filteredUsers.map(u => (
              <button key={u.id} onClick={() => startChat(u)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-100 text-left transition-colors">
                <Avatar name={u.display_name || u.email} size="sm" presence={u.presence || 'offline'} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{u.display_name || u.email}</div>
                  <div className="text-[11px] text-gray-500">{u.extension || u.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(c => {
          const title = getChatTitle(c, user);
          const unread = parseInt(c.unread_count) || 0;
          const isSelected = selectedItem === c.id;

          return (
            <button key={c.id} onClick={() => selectChat(c)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <Avatar name={title} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatTime(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500 truncate">{c.last_message || 'No messages yet'}</span>
                  {unread > 0 && (
                    <span className="w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 ml-2">{unread}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && !showNewChat && (
          <div className="text-center py-12 text-gray-400">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-30"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Click "New Chat" to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
