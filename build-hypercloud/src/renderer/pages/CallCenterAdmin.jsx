import React, { useState, useEffect, useCallback } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';

export default function CallCenterAdmin() {
  const { ccSelectedQueue } = useStore();
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadQueues(); }, []);

  async function loadQueues() {
    setLoading(true);
    try {
      const data = await ipc.fetchCallCenterQueues();
      setQueues(data || []);
    } catch { setQueues([]); }
    setLoading(false);
  }

  function selectQueue(q) {
    setState({ ccSelectedQueue: q });
  }

  if (ccSelectedQueue) {
    return <QueueAgents queue={ccSelectedQueue} onBack={() => { setState({ ccSelectedQueue: null }); loadQueues(); }} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Call Center Queues</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{queues.length} queue{queues.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={loadQueues} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading queues...</div>
      ) : queues.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No queues found for your organization</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {queues.map(q => (
            <button key={q.call_center_queue_uuid} onClick={() => selectQueue(q)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${ccSelectedQueue?.call_center_queue_uuid === q.call_center_queue_uuid ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}>
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{q.queue_name}</div>
                <div className="text-[11px] text-gray-400">Ext {q.queue_extension} &middot; {q.queue_strategy} &middot; {q.agent_count} agent{q.agent_count !== 1 ? 's' : ''}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QueueAgents({ queue, onBack }) {
  const [agents, setAgents] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const qId = queue.call_center_queue_uuid;

  const loadAgents = useCallback(async () => {
    try {
      const data = await ipc.fetchCallCenterQueueAgents(qId);
      setAgents(data || []);
    } catch { setAgents([]); }
  }, [qId]);

  useEffect(() => {
    setLoading(true);
    loadAgents().then(() => setLoading(false));
  }, [loadAgents]);

  async function handleRemoveAgent(agentUuid) {
    if (!confirm('Remove this agent from the queue?')) return;
    try {
      await ipc.removeCallCenterQueueAgent(qId, agentUuid);
      await loadAgents();
    } catch (err) { alert(err.message); }
  }

  async function handleAddAgent(agentUuid) {
    try {
      await ipc.addCallCenterQueueAgent(qId, agentUuid);
      setShowAdd(false);
      await loadAgents();
    } catch (err) { alert(err.message); }
  }

  async function openAddPanel() {
    setShowAdd(true);
    try {
      const data = await ipc.fetchCallCenterAvailableAgents(qId);
      setAvailableAgents(data || []);
    } catch { setAvailableAgents([]); }
  }

  const statusDot = (s) => {
    if (s === 'Available') return 'bg-green-500';
    if (s === 'On Break') return 'bg-yellow-400';
    if (s === 'Logged Out') return 'bg-gray-300';
    return 'bg-blue-400';
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{queue.queue_name}</h2>
            <p className="text-[11px] text-gray-400">Ext {queue.queue_extension} &middot; Agents</p>
          </div>
          <button onClick={loadAgents} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">{agents.length} agent{agents.length !== 1 ? 's' : ''} assigned</span>
            <button onClick={openAddPanel}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Agent
            </button>
          </div>
          {agents.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No agents assigned to this queue</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agents.map(a => (
                <div key={a.call_center_tier_uuid} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot(a.agent_status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{a.agent_name || `Agent ${a.agent_id}`}</div>
                    <div className="text-[11px] text-gray-400">Ext {a.agent_id} &middot; {a.agent_status}</div>
                  </div>
                  <button onClick={() => handleRemoveAgent(a.call_center_agent_uuid)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded" title="Remove from queue">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAdd && (
            <div className="border-t border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Add Agent to Queue</span>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
              </div>
              {availableAgents.length === 0 ? (
                <p className="text-[11px] text-gray-400">No available agents to add</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {availableAgents.map(a => (
                    <button key={a.call_center_agent_uuid} onClick={() => handleAddAgent(a.call_center_agent_uuid)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-blue-50 text-left transition-colors">
                      <div className={`w-2 h-2 rounded-full ${statusDot(a.agent_status)}`} />
                      <span className="text-sm text-gray-700 flex-1">{a.agent_name || `Agent ${a.agent_id}`}</span>
                      <span className="text-[10px] text-gray-400">Ext {a.agent_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
