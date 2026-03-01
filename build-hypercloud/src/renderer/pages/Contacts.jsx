import React, { useState } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import Avatar from '../components/Avatar';
import SearchBar from '../components/SearchBar';

export default function Contacts() {
  const { contacts, users, user } = useStore();
  const [search, setSearch] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [hoveredId, setHoveredId] = useState(null);

  const allContacts = [
    ...users.filter(u => u.id !== user?.id).map(u => ({ id: u.id, name: u.display_name || u.email, number: u.extension, email: u.email, source: 'Users', type: 'user', userId: u.id })),
    ...contacts.map(c => ({ ...c, source: c.source === 'PBX' ? 'Hypercloud' : c.source, type: c.source === 'local' ? 'local' : 'pbx' })),
  ];

  const localContacts = JSON.parse(localStorage.getItem('scv_local_contacts') || '[]');
  const allWithLocal = [
    ...allContacts,
    ...localContacts.map(c => ({ ...c, source: 'Local', type: 'local' })),
  ];

  const filtered = search
    ? allWithLocal.filter(c => (c.name + (c.number || '') + (c.email || '') + (c.organization || '')).toLowerCase().includes(search.toLowerCase()))
    : allWithLocal;

  const grouped = {};
  filtered.forEach(c => {
    const src = c.source || 'Other';
    if (!grouped[src]) grouped[src] = [];
    grouped[src].push(c);
  });

  function handleCall(number) {
    if (!number) return;
    ipc.makeCall(number);
    setState({ callState: { state: 'calling', number, name: '', direction: 'out' } });
  }

  async function startChat(targetUserId) {
    try {
      const result = await ipc.createConversation([targetUserId], null, 'direct');
      const convId = result.id;
      if (convId) {
        const convos = await ipc.fetchConversations().catch(() => []);
        setState({ conversations: convos, section: 'chats', selectedItem: convId, selectedType: 'chat' });
      }
    } catch {}
  }

  function selectContact(c) {
    if (c.type === 'user') {
      setState({ selectedItem: c.userId || c.id, selectedType: 'user' });
    }
  }

  function addLocalContact() {
    if (!newName.trim()) return;
    const contact = {
      id: 'local_' + Date.now(),
      name: newName.trim(),
      number: newNumber.trim(),
      email: newEmail.trim(),
      organization: newOrg.trim(),
      source: 'Local',
      type: 'local',
    };
    const updated = [...localContacts, contact];
    localStorage.setItem('scv_local_contacts', JSON.stringify(updated));
    setShowAddContact(false);
    setNewName(''); setNewNumber(''); setNewEmail(''); setNewOrg('');
    setState({}); // force re-render
  }

  function deleteLocalContact(id) {
    const updated = localContacts.filter(c => c.id !== id);
    localStorage.setItem('scv_local_contacts', JSON.stringify(updated));
    setState({});
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar value={search} onChange={setSearch} placeholder="Search contacts..." />

      {/* Add contact button */}
      <div className="px-3 pb-2">
        <button onClick={() => setShowAddContact(!showAddContact)} className="w-full py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Contact
        </button>
      </div>

      {/* Add contact form */}
      {showAddContact && (
        <div className="mx-3 mb-2 border border-blue-200 rounded-lg bg-blue-50/50 p-3 space-y-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name *" className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-400" autoFocus />
          <div className="flex gap-2">
            <input type="text" value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="Phone number" className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-400" />
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-400" />
          </div>
          <input type="text" value={newOrg} onChange={e => setNewOrg(e.target.value)} placeholder="Organization" className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 outline-none focus:border-blue-400" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddContact(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={addLocalContact} className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600">Save Contact</button>
          </div>
        </div>
      )}

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([source, items]) => (
          <div key={source}>
            <div className="flex items-center justify-between px-4 py-2">
              <h3 className="text-xs font-medium text-gray-500">{source} ({items.length})</h3>
            </div>
            {items.map((c, i) => {
              const isHovered = hoveredId === (c.id || i);
              return (
                <div
                  key={c.id || i}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${isHovered ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => selectContact(c)}
                  onMouseEnter={() => setHoveredId(c.id || i)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <Avatar name={c.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.number && <span>{c.number}</span>}
                      {c.number && c.organization && <span> &middot; </span>}
                      {c.organization && <span>{c.organization}</span>}
                    </div>
                  </div>

                  {/* Action buttons on hover */}
                  {isHovered && (
                    <div className="flex gap-0.5 animate-fade-in">
                      {c.number && (
                        <button onClick={(e) => { e.stopPropagation(); handleCall(c.number); }} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Call">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                        </button>
                      )}
                      {c.type === 'user' && (
                        <button onClick={(e) => { e.stopPropagation(); startChat(c.userId || c.id); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Chat">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        </button>
                      )}
                      {c.number && (
                        <button onClick={(e) => { e.stopPropagation(); handleCall(c.number); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Video call">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        </button>
                      )}
                      {c.type === 'local' && (
                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete contact?')) deleteLocalContact(c.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && !showAddContact && (
          <div className="text-center py-12 text-gray-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-30"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <p className="text-sm">No contacts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
