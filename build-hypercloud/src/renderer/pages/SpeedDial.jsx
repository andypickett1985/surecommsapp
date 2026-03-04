import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import SearchBar from '../components/SearchBar';

function statusColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'available' || s === 'available (on demand)') return { bg: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-emerald-700', label: 'Available' };
  if (s === 'on break') return { bg: 'bg-amber-400', ring: 'ring-amber-200', text: 'text-amber-700', label: 'On Break' };
  if (s === 'logged out') return { bg: 'bg-gray-400', ring: 'ring-gray-200', text: 'text-gray-500', label: 'Logged Out' };
  if (s === 'do not disturb') return { bg: 'bg-red-500', ring: 'ring-red-300', text: 'text-red-600', label: 'DND' };
  return { bg: 'bg-blue-400', ring: 'ring-blue-200', text: 'text-blue-600', label: status || 'Unknown' };
}

const PhoneIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const ChatIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const MailIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
const InfoIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
const PingIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const PickupIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;

function ActionPopup({ agent, onClose, onCall, onChat, onPing, sipAccounts, tileRef }) {
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });
  const isAvailable = (agent.status || '').toLowerCase() === 'available' || (agent.status || '').toLowerCase() === 'available (on demand)';
  const isOnCall = (agent.state || '').toLowerCase() === 'in a queue call';
  const isRinging = (agent.state || '').toLowerCase() === 'receiving';
  const isOnline = isAvailable || isOnCall || isRinging;
  const ext = agent.extension || agent.agent_id?.split('@')[0] || '';
  const sc = statusColor(agent.status);

  useEffect(() => {
    function handleClick(e) { if (popupRef.current && !popupRef.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    if (tileRef?.current) {
      const rect = tileRef.current.getBoundingClientRect();
      const popupH = 220;
      const openUp = rect.bottom + popupH > window.innerHeight;
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - 70, window.innerWidth - 156));
      setPos({
        top: openUp ? rect.top - 4 : rect.bottom + 4,
        left,
        openUp,
      });
    }
  }, [tileRef]);

  function handleEmail() {
    if (agent.email) ipc.openExternal(`mailto:${agent.email}`);
    onClose();
  }

  function handlePickup() {
    if (!ext) return;
    const domain = sipAccounts?.[0]?.domain || sipAccounts?.[0]?.server || '';
    const pickupTarget = domain ? `**${ext}@${domain}` : `**${ext}`;
    ipc.makeCall(pickupTarget);
    setState({ callState: { state: 'calling', number: `**${ext}`, name: `Pickup: ${agent.display_name}`, direction: 'out' } });
    onClose();
  }

  const actions = [];

  if (isRinging) {
    actions.push({ icon: <PickupIcon />, label: 'Pickup', color: 'text-green-600 hover:bg-green-50', onClick: handlePickup });
  }
  if (isOnline && !isOnCall) {
    actions.push({ icon: <PhoneIcon />, label: 'Call', color: 'text-blue-600 hover:bg-blue-50', onClick: () => { onCall(ext); onClose(); } });
  }
  if (isOnline) {
    actions.push({ icon: <ChatIcon />, label: 'Send Chat', color: 'text-purple-600 hover:bg-purple-50', onClick: () => { onChat(agent); onClose(); } });
  }
  actions.push({ icon: <PingIcon />, label: 'Ping', color: 'text-amber-600 hover:bg-amber-50', onClick: () => { onPing(ext); onClose(); } });
  if (agent.email) {
    actions.push({ icon: <MailIcon />, label: 'Send Email', color: 'text-rose-600 hover:bg-rose-50', onClick: handleEmail });
  }
  actions.push({ icon: <InfoIcon />, label: 'Info', color: 'text-gray-600 hover:bg-gray-50', onClick: () => { onClose(); } });

  const style = pos.openUp
    ? { position: 'fixed', bottom: window.innerHeight - pos.top, left: pos.left, zIndex: 9999 }
    : { position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 };

  return (
    <div ref={popupRef} style={style} className="bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[140px]">
      <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
        <p className="text-[10px] font-bold text-gray-800 truncate">{agent.display_name}</p>
        <p className="text-[9px] text-gray-400">{ext ? `Ext ${ext}` : ''} &middot; <span className={sc.text}>{isOnCall ? 'On Call' : isRinging ? 'Ringing' : sc.label}</span></p>
      </div>
      {actions.map((a, i) => (
        <button key={i} onClick={a.onClick}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium transition-colors ${a.color}`}>
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function AgentTile({ agent, onCall, onChat, onPing, sipAccounts }) {
  const [showActions, setShowActions] = useState(false);
  const tileRef = useRef(null);
  const sc = statusColor(agent.status);
  const isOnCall = (agent.state || '').toLowerCase() === 'in a queue call';
  const isRinging = (agent.state || '').toLowerCase() === 'receiving';
  const ext = agent.extension || agent.agent_id?.split('@')[0] || '';

  return (
    <div className="relative" ref={tileRef}>
      <button onClick={() => setShowActions(!showActions)} className={`w-full flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all cursor-pointer ${
        isOnCall ? 'border-orange-300 bg-orange-50' : isRinging ? 'border-blue-300 bg-blue-50 animate-pulse' : 'border-gray-100 bg-white hover:shadow-sm hover:border-gray-200'
      }`}>
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
            {(agent.display_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${sc.bg}`} />
        </div>
        <span className="text-[10px] font-semibold text-gray-800 truncate max-w-full leading-tight text-center">
          {agent.display_name?.split(' ').slice(0, 2).join(' ') || 'Agent'}
        </span>
        {ext && <span className="text-[9px] text-gray-400 -mt-0.5">{ext}</span>}
        <span className={`text-[9px] font-medium ${isOnCall ? 'text-orange-600' : isRinging ? 'text-blue-600' : sc.text}`}>
          {isOnCall ? 'On Call' : isRinging ? 'Ringing' : sc.label}
        </span>
      </button>
      {showActions && (
        <ActionPopup
          agent={agent}
          sipAccounts={sipAccounts}
          tileRef={tileRef}
          onClose={() => setShowActions(false)}
          onCall={onCall}
          onChat={onChat}
          onPing={onPing}
        />
      )}
    </div>
  );
}

function QueueGroup({ queue, onCall, onChat, onPing, sipAccounts }) {
  const available = queue.agents.filter(a => (a.status || '').toLowerCase() === 'available' || (a.status || '').toLowerCase() === 'available (on demand)');
  const onCallAgents = queue.agents.filter(a => (a.state || '').toLowerCase() === 'in a queue call');

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-gray-700">{queue.name}</span>
          <span className="text-[10px] text-gray-400">ext {queue.extension}</span>
        </div>
        <div className="flex items-center gap-2">
          {queue.waitingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded-full">
              {queue.waitingCount} waiting
            </span>
          )}
          <span className="text-[9px] text-gray-400">{available.length}/{queue.agents.length} avail</span>
          {onCallAgents.length > 0 && (
            <span className="text-[9px] text-orange-500 font-medium">{onCallAgents.length} on call</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {queue.agents.map(a => (
          <AgentTile key={a.uuid} agent={a} onCall={onCall} onChat={onChat} onPing={onPing} sipAccounts={sipAccounts} />
        ))}
      </div>
      {queue.agents.length === 0 && (
        <p className="text-center text-gray-300 text-[10px] py-3">No agents in this queue</p>
      )}
    </div>
  );
}

function QueuePickerModal({ allQueues, selectedIds, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(selectedIds));

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Select Queues for BLF Board</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Choose which call center queues to monitor</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {allQueues.length === 0 && <p className="text-center text-gray-400 text-xs py-6">No queues available</p>}
          {allQueues.map(q => (
            <label key={q.call_center_queue_uuid} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(q.call_center_queue_uuid)}
                onChange={() => toggle(q.call_center_queue_uuid)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{q.queue_name}</div>
                <div className="text-[10px] text-gray-400">Ext {q.queue_extension} &middot; {q.agent_count} agents &middot; {q.queue_strategy}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={() => onSave([...selected])} className="flex-1 py-2 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600">Save</button>
        </div>
      </div>
    </div>
  );
}

function PingToast({ ping, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-xl shadow-2xl border border-amber-200 p-3 max-w-[260px] animate-in slide-in-from-top-2">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <PingIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800">Agent Ping</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{ping.message || `${ping.from} is trying to reach you`}</p>
        </div>
        <button onClick={onDismiss} className="text-gray-300 hover:text-gray-500 text-sm leading-none">&times;</button>
      </div>
    </div>
  );
}

export default function SpeedDial() {
  const { users, presence, callCenter, sipAccounts, user } = useStore();
  const [search, setSearch] = useState('');
  const [blfQueueIds, setBlfQueueIds] = useState([]);
  const [blfLive, setBlfLive] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loadingBlf, setLoadingBlf] = useState(false);
  const [pingToast, setPingToast] = useState(null);
  const [pingSending, setPingSending] = useState(null);
  const refreshRef = useRef(null);

  const displayUsers = users.filter(u => !search || (u.display_name || u.email).toLowerCase().includes(search.toLowerCase())).slice(0, 20);

  useEffect(() => {
    ipc.getBlfPrefs().then(d => {
      if (d?.queueIds?.length) setBlfQueueIds(d.queueIds);
    }).catch(() => {});
    ipc.onAgentPing((data) => setPingToast(data));
  }, []);

  useEffect(() => {
    if (blfQueueIds.length === 0) { setBlfLive([]); return; }
    let active = true;
    async function poll() {
      try {
        const d = await ipc.fetchBlfLive(blfQueueIds);
        if (active && d?.queues) setBlfLive(d.queues);
      } catch {}
      if (active) refreshRef.current = setTimeout(poll, 5000);
    }
    poll();
    return () => { active = false; clearTimeout(refreshRef.current); };
  }, [blfQueueIds]);

  async function openPicker() {
    try {
      const qs = await ipc.fetchCallCenterQueues();
      setAllQueues(qs || []);
    } catch { setAllQueues([]); }
    setShowPicker(true);
  }

  async function saveBlfSelection(ids) {
    setShowPicker(false);
    setBlfQueueIds(ids);
    setLoadingBlf(true);
    try {
      await ipc.saveBlfPrefs(ids);
      if (ids.length > 0) {
        const d = await ipc.fetchBlfLive(ids);
        if (d?.queues) setBlfLive(d.queues);
      } else {
        setBlfLive([]);
      }
    } catch {}
    setLoadingBlf(false);
  }

  function handleCall(number) {
    if (!number) return;
    ipc.makeCall(number);
    setState({ callState: { state: 'calling', number, name: '', direction: 'out' } });
  }

  function handleChat(agent) {
    const ext = agent.extension || agent.agent_id?.split('@')[0] || '';
    const matchedUser = users.find(u => u.extension === ext || u.sip_username === ext);
    if (matchedUser) {
      setState({ section: 'chats', chatTarget: matchedUser });
    }
  }

  async function handlePing(ext) {
    if (pingSending === ext) return;
    setPingSending(ext);
    try {
      const myExt = sipAccounts?.[0]?.username || '';
      await ipc.sendBlfPing(ext, myExt);
    } catch {}
    setTimeout(() => setPingSending(null), 2000);
  }

  const filteredBlfLive = useMemo(() => {
    if (!search.trim()) return blfLive;
    const q = search.toLowerCase();
    return blfLive.map(queue => ({
      ...queue,
      agents: queue.agents.filter(a =>
        (a.display_name || '').toLowerCase().includes(q) ||
        (a.agent_id || '').toLowerCase().includes(q)
      ),
    })).filter(queue => queue.agents.length > 0 || queue.name.toLowerCase().includes(q));
  }, [blfLive, search]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SearchBar value={search} onChange={setSearch} />

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* BLF Board Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <button className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              BLF Board
            </button>
            <button onClick={openPicker} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Configure
            </button>
          </div>

          {blfQueueIds.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <svg className="mx-auto mb-2 text-gray-300" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <p className="text-xs text-gray-400">No queues selected</p>
              <button onClick={openPicker} className="mt-2 text-[10px] font-medium text-blue-500 hover:text-blue-600">
                Add call center queues to monitor
              </button>
            </div>
          )}

          {loadingBlf && blfQueueIds.length > 0 && (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-gray-400 mt-2">Loading live data...</p>
            </div>
          )}

          {filteredBlfLive.map(q => (
            <QueueGroup key={q.id} queue={q} onCall={handleCall} onChat={handleChat} onPing={handlePing} sipAccounts={sipAccounts} />
          ))}
        </div>

        {/* User BLF section */}
        <div className="mb-4">
          <button className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2 hover:text-gray-700">
            Users
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div className="grid grid-cols-3 gap-2">
            {displayUsers.slice(0, 12).map(u => {
              const pres = (presence[u.id] || 'offline').toLowerCase();
              const isOnCall = ['in_call', 'on_call', 'busy'].includes(pres);
              const presColor = pres === 'online' ? 'bg-green-100 text-green-700 border-green-200'
                : isOnCall ? 'bg-orange-100 text-orange-600 border-orange-200'
                : pres === 'dnd' ? 'bg-red-100 text-red-600 border-red-200'
                : pres === 'away' ? 'bg-amber-100 text-amber-600 border-amber-200'
                : 'bg-gray-100 text-gray-500 border-gray-200';
              const presLabel = pres === 'online' ? 'Avail' : isOnCall ? 'On Call' : pres === 'dnd' ? 'DND' : pres === 'away' ? 'Away' : 'Off';
              return (
                <button key={u.id} onClick={() => handleCall(u.extension)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all group">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-medium border ${presColor}`}>{presLabel}</span>
                  <span className="text-[10px] text-gray-700 font-medium truncate max-w-full">
                    {u.display_name?.split(' ')[0] || u.email?.split('@')[0]}
                  </span>
                  {u.extension && <span className="text-[9px] text-gray-400">{u.extension}</span>}
                </button>
              );
            })}
          </div>
          {displayUsers.length === 0 && (
            <p className="text-center text-gray-400 text-[10px] py-4">No users found</p>
          )}
        </div>
      </div>

      {showPicker && (
        <QueuePickerModal
          allQueues={allQueues}
          selectedIds={blfQueueIds}
          onSave={saveBlfSelection}
          onClose={() => setShowPicker(false)}
        />
      )}

      {pingToast && <PingToast ping={pingToast} onDismiss={() => setPingToast(null)} />}
    </div>
  );
}
