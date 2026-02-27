import React, { useState } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import SearchBar from '../components/SearchBar';

export default function SpeedDial() {
  const { users, presence, speedDials } = useStore();
  const [search, setSearch] = useState('');

  const displayUsers = users.filter(u => !search || (u.display_name || u.email).toLowerCase().includes(search.toLowerCase())).slice(0, 20);

  function handleCall(number) {
    if (!number) return;
    ipc.makeCall(number);
    setState({ callState: { state: 'calling', number, name: '', direction: 'out' } });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar value={search} onChange={setSearch} />

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Feature BLF section */}
        <div className="mb-4">
          <button className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2 hover:text-gray-700">
            Feature BLF
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div className="grid grid-cols-3 gap-2">
            {displayUsers.slice(0, 9).map(u => {
              const pres = presence[u.id] || 'offline';
              const presColor = pres === 'online' ? 'bg-green-100 text-green-700 border-green-200' : pres === 'busy' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200';
              return (
                <button key={u.id} onClick={() => handleCall(u.extension)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all group">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${presColor}`}>
                    {pres === 'online' ? 'on' : 'off'}
                  </span>
                  <span className="text-xs text-gray-700 font-medium truncate max-w-full">
                    {u.display_name?.split(' ')[0] || u.email?.split('@')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contacts section */}
        <div>
          <button className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2 hover:text-gray-700">
            Contacts
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {displayUsers.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No speed dials configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
