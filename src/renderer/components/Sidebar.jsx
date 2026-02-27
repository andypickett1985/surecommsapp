import React from 'react';
import { useStore, setState } from '../lib/store';
import sureIcon from '../assets/sure-icon.png';

const sections = [
  { id: 'speeddial', label: 'Speed dial', icon: <><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/></> },
  { id: 'users', label: 'Users', icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></> },
  { id: 'contacts', label: 'Contacts', icon: <><path d="M16 21v-2a4 4 0 00-3-3.87"/><path d="M2 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="8.5" cy="7" r="4"/></> },
  { id: 'chats', label: 'Chats', icon: <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></> },
  { id: 'calls', label: 'Calls', icon: <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></> },
];

export default function Sidebar() {
  const { section, conversations, orgSettings } = useStore();
  const chatEnabled = orgSettings?.allow_chat !== 'false';
  const unread = conversations?.filter(c => parseInt(c.unread_count) > 0).length || 0;

  return (
    <div className="w-[68px] bg-gray-50 border-r border-gray-200 flex flex-col items-center py-2 shrink-0">
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 mt-1 overflow-hidden">
        <img src={sureIcon} alt="Sure" className="w-10 h-10 object-contain" />
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-0.5 w-full px-1.5">
        {sections.filter(s => s.id !== 'chats' || chatEnabled).map(s => (
          <button
            key={s.id}
            onClick={() => setState({ section: s.id })}
            className={`relative flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all text-[10px] font-medium ${
              section === s.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {section === s.id && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-600 rounded-r" />}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
            <span>{s.label}</span>
            {s.id === 'chats' && unread > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Menu */}
      <button onClick={() => setState({ showSettings: true })} className="flex flex-col items-center gap-0.5 py-2 text-gray-500 hover:text-gray-700 text-[10px] font-medium mb-1">
        <div className="relative">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-50" />
        </div>
        <span>Menu</span>
      </button>
    </div>
  );
}
