import React from 'react';
import { useStore, setState } from '../lib/store';

const titles = { speeddial: 'Speed dial', users: 'Users', contacts: 'Contacts', chats: 'Chats', calls: 'Calls', keypad: 'Keypad' };

export default function TopBar() {
  const { section } = useStore();

  return (
    <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
      <h1 className="text-sm font-semibold text-gray-900">{titles[section] || 'Speed dial'}</h1>
      <div className="flex items-center gap-0.5">
        <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" title="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
        <button
          onClick={() => setState({ section: section === 'keypad' ? 'speeddial' : 'keypad' })}
          className={`p-1.5 rounded-md transition-colors ${section === 'keypad' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Keypad"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="2" width="4" height="4" rx="1"/><rect x="10" y="2" width="4" height="4" rx="1"/><rect x="16" y="2" width="4" height="4" rx="1"/><rect x="4" y="8" width="4" height="4" rx="1"/><rect x="10" y="8" width="4" height="4" rx="1"/><rect x="16" y="8" width="4" height="4" rx="1"/><rect x="4" y="14" width="4" height="4" rx="1"/><rect x="10" y="14" width="4" height="4" rx="1"/><rect x="16" y="14" width="4" height="4" rx="1"/></svg>
        </button>
        <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" title="Add">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
}
