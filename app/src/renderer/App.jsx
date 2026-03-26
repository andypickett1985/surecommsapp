import React, { useEffect, useState } from 'react';
import { useStore, setState } from './lib/store';
import * as ipc from './lib/ipc';
import Login from './pages/Login';
import InCall from './pages/InCall';
import IncomingCall from './components/IncomingCall';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import SpeedDial from './pages/SpeedDial';
import Users from './pages/Users';
import Contacts from './pages/Contacts';
import Chats from './pages/Chats';
import Calls from './pages/Calls';
import KeypadPanel from './pages/KeypadPanel';
import CallCenterAdmin from './pages/CallCenterAdmin';
import DetailPanel from './pages/DetailPanel';
import Settings from './pages/Settings';
import PostCallReview from './pages/PostCallReview';

export default function App() {
  const { view, section, callState, incomingCall, showSettings, postCallTranscript, updateAvailable } = useStore();

  useEffect(() => {
    ipc.onSipEvent((data) => {
      switch (data.event) {
        case 'regState': setState({ regStatus: { code: data.code, reason: data.reason || '' } }); break;
        case 'callState':
          if (data.state === 'disconnected') {
            addCallToHistory(data);
            const hadTranscript = !!localStorage.getItem('scv_active_transcript');
            setState({
              callState: null,
              incomingCall: null,
              postCallTranscript: hadTranscript ? { number: cleanSipUri(data.number), name: cleanSipUri(data.name), direction: data.direction } : null,
            });
            localStorage.removeItem('scv_active_transcript');
          } else {
            setState({ callState: data });
          }
          break;
        case 'incomingCall': setState({ incomingCall: data }); break;
        case 'warmTransferState': setState({ warmTransferState: data }); break;
        case 'engineStopped': setState({ regStatus: { code: -1, reason: 'Engine stopped' } }); break;
      }
    });
    ipc.onWsEvent((data) => {
      switch (data.event) {
        case 'newMessage': {
          const cid = data.conversationId;
          setState(prev => {
            const msgs = { ...prev.messages };
            if (msgs[cid]) { const dup = msgs[cid].some(m => m.id && data.message.id && m.id === data.message.id); if (!dup) msgs[cid] = [...msgs[cid], data.message]; } else { msgs[cid] = [data.message]; }
            const convos = prev.conversations.map(c => c.id === cid ? { ...c, last_message: data.message.body, last_message_at: data.message.created_at, unread_count: String((parseInt(c.unread_count) || 0) + 1) } : c);
            return { messages: msgs, conversations: convos };
          });
          break;
        }
        case 'userCallState': {
          const uid = data.userId;
          setState(prev => {
            const active = { ...prev.activeCalls };
            if (data.state && data.state !== 'disconnected') {
              active[uid] = { state: data.state, number: data.number, direction: data.direction, since: Date.now() };
            } else {
              delete active[uid];
            }
            return { activeCalls: active };
          });
          break;
        }
        case 'ccStatusChange': {
          setState(prev => ({
            callCenter: {
              ...prev.callCenter,
              agent: prev.callCenter?.agent?.agent_id && data.userId === prev.user?.id
                ? { ...prev.callCenter.agent, agent_status: data.ccStatus }
                : prev.callCenter?.agent,
            },
          }));
          break;
        }
        case 'presenceChange':
          setState(prev => ({ presence: { ...prev.presence, [data.userId]: data.status } }));
          break;
        case 'forceLogout':
          ipc.logout();
          setState({ view: 'login', user: null, token: null, sipAccounts: [], regStatus: { code: 0, reason: 'Logged out by admin' } });
          break;
        case 'wipeConfig':
          ipc.logout();
          localStorage.clear();
          setState({ view: 'login', user: null, token: null, sipAccounts: [], calls: [], contacts: [], conversations: [], messages: {}, regStatus: { code: 0, reason: 'Device wiped by admin' } });
          break;
        case 'forceRestart':
          window.location.reload();
          break;
        case 'updateAvailable':
          setState({ updateAvailable: data });
          break;
        case 'pushConfig':
          if (data.settings) setState({ orgSettings: data.settings });
          break;
        case 'requestNetworkTest':
          runRemoteNetworkTest();
          break;
      }
    });
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const session = await ipc.getSavedSession();
      if (session?.token && session?.sipAccounts?.length) {
        setState({ view: 'main', user: session.user, token: session.token, sipAccounts: session.sipAccounts });
        startSip(session.sipAccounts);

        // Refresh token before loading data (token may have expired)
        await ipc.refreshConfig().catch(() => null);

        // Get the fresh token after refresh
        const freshSession = await ipc.getSavedSession();
        const activeToken = freshSession?.token || session.token;
        setState({ token: activeToken });

        loadData(activeToken);
      } else setState({ view: 'login' });
    } catch { setState({ view: 'login' }); }
  }

  function startSip(accounts) {
    if (accounts?.[0]) {
      const a = accounts[0];
      ipc.sipStart({ server: a.server, username: a.username, password: a.password, domain: a.domain || a.server, transport: a.transport || 'udp', displayName: a.displayName || '' });
    }
  }

  async function loadData(token) {
    setState({ token });
    try {
      const [users, convos, speedDials, pbxContacts, callCenter] = await Promise.all([
        ipc.fetchUsers().catch(e => { console.error('fetchUsers failed:', e.message); return []; }),
        ipc.fetchConversations().catch(e => { console.error('fetchConvos failed:', e.message); return []; }),
        ipc.fetchSpeedDials().catch(e => { console.error('fetchSpeedDials failed:', e.message); return []; }),
        ipc.fetchContacts().catch(e => { console.error('fetchContacts failed:', e.message); return []; }),
        ipc.getCallCenterMe().catch(() => null),
      ]);
      console.log('loadData results:', { users: users.length, convos: convos.length, contacts: pbxContacts.length });
      const presence = {};
      users.forEach(u => { presence[u.id] = u.presence || 'offline'; });
      const contacts = pbxContacts.map(c => ({
        id: c.id,
        name: c.name,
        number: c.phones?.[0]?.number || '',
        email: c.emails?.[0]?.email || '',
        organization: c.organization,
        source: 'PBX',
        phones: c.phones || [],
      }));
      setState({
        users,
        conversations: convos,
        speedDials,
        presence,
        contacts,
        callCenter: {
          loading: false,
          enabled: !!callCenter?.enabled,
          admin: !!callCenter?.admin,
          linked: !!callCenter?.linked,
          agent: callCenter?.agent || null,
          statuses: callCenter?.statuses || [],
        },
      });
    } catch {}
    ipc.updatePresence('online').catch(() => {});
  }

  function cleanSipUri(raw) {
    if (!raw) return '';
    const m = raw.match(/(?:<)?sip:([^@>]+)@[^>]*/i);
    return m ? m[1] : raw.replace(/^["']|["']$/g, '').trim();
  }

  async function runRemoteNetworkTest() {
    try {
      const r = {};
      const PROV = 'https://communicator.surecloudvoice.com';
      // Latency
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await fetch(PROV + '/api/health', { cache: 'no-store' });
        times.push(Math.round(performance.now() - t0));
      }
      r.latency = { min: Math.min(...times), max: Math.max(...times), avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length) };
      // Download
      try {
        const t0 = performance.now();
        const res = await fetch(PROV + '/speedtest.bin?r=' + Date.now(), { cache: 'no-store' });
        const blob = await res.blob();
        const elapsed = (performance.now() - t0) / 1000;
        r.download = { mbps: parseFloat(((blob.size / (1024 * 1024)) / elapsed * 8).toFixed(1)) };
      } catch { r.download = { error: 'failed' }; }
      // NAT
      try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        const candidates = [];
        pc.createDataChannel('test');
        pc.onicecandidate = (e) => { if (e.candidate) candidates.push(e.candidate.candidate); };
        await pc.createOffer().then(o => pc.setLocalDescription(o));
        await new Promise(res => setTimeout(res, 3000));
        pc.close();
        r.nat = { type: candidates.some(c => c.includes('relay')) ? 'Symmetric' : candidates.some(c => c.includes('srflx')) ? 'NAT (OK)' : 'Open', candidates: candidates.length };
      } catch { r.nat = { type: 'unknown' }; }
      r.timestamp = new Date().toISOString();
      r.userAgent = navigator.userAgent;
      localStorage.setItem('scv_last_nettest', JSON.stringify(r));
      window.electronAPI?.uploadNetworkTestResults?.(r);
    } catch {}
  }

  function addCallToHistory(data) {
    setState(prev => {
      const num = cleanSipUri(data.number || '');
      if (!num || num.length < 2) return prev; // Ghost call guard
      const dir = (data.direction === 'in' && (!data.duration || data.duration === 0)) ? 'miss' : (data.direction || 'out');
      const entry = { name: cleanSipUri(data.name || ''), number: num, direction: dir, duration: data.duration || 0, timestamp: new Date().toISOString() };
      const calls = [entry, ...prev.calls].slice(0, 300);
      localStorage.setItem('scv_calls', JSON.stringify(calls));
      return { calls };
    });
  }

  const [updateProgress, setUpdateProgress] = useState(null);

  useEffect(() => {
    const handler = (data) => setUpdateProgress(data);
    window.electronAPI?.onUpdateProgress?.(handler);
  }, []);

  if (view === 'loading') return <div className="flex items-center justify-center h-screen bg-navy"><div className="text-white/40 text-sm">Loading...</div></div>;
  if (view === 'login') return <Login onSuccess={(data) => { setState({ view: 'main', user: data.user, token: data.token, sipAccounts: data.sipAccounts }); startSip(data.sipAccounts); loadData(data.token); }} />;

  const leftPanels = {
    speeddial: <SpeedDial />,
    users: <Users />,
    contacts: <Contacts />,
    chats: <Chats />,
    calls: <Calls />,
    keypad: <KeypadPanel />,
    callcenter: <CallCenterAdmin />,
  };

  function doUpdateNow() {
    if (!updateAvailable?.downloadUrl) return;
    setUpdateProgress({ percent: 0, status: 'downloading' });
    window.electronAPI?.downloadAndInstall?.(updateAvailable.downloadUrl);
  }

  if (updateAvailable?.force) {
    return (
      <div className="flex items-center justify-center h-screen bg-navy text-white">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Update Required</h2>
          <p className="text-white/60 text-sm mb-1">Version {updateAvailable.version} is available</p>
          <p className="text-white/40 text-xs mb-6">This update is required to continue using the app.</p>
          {updateProgress ? (
            <div className="w-64 mx-auto">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${updateProgress.percent}%` }} />
              </div>
              <p className="text-white/50 text-xs">{updateProgress.status === 'installing' ? 'Installing... app will restart' : `Downloading ${updateProgress.percent}%`}</p>
            </div>
          ) : (
            <button onClick={doUpdateNow} className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors">
              Update Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white relative select-none">
      {/* Update banner */}
      {updateAvailable && !updateAvailable.force && (
        <div className="h-9 bg-blue-600 flex items-center justify-center gap-3 px-4 shrink-0">
          {updateProgress ? (
            <>
              <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${updateProgress.percent}%` }} />
              </div>
              <span className="text-white text-xs">{updateProgress.status === 'installing' ? 'Installing... restarting shortly' : `Downloading ${updateProgress.percent}%`}</span>
            </>
          ) : (
            <>
              <span className="text-white text-xs">Version {updateAvailable.version} is available</span>
              <button onClick={doUpdateNow}
                className="px-3 py-0.5 bg-white text-blue-600 text-xs font-semibold rounded-md hover:bg-blue-50 transition-colors">
                Update Now
              </button>
              <button onClick={() => setState({ updateAvailable: null })}
                className="text-white/60 hover:text-white ml-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar nav */}
        <Sidebar />

        {/* Left column - switches based on active section */}
        <div className="w-80 flex flex-col min-h-0 border-r border-gray-200 bg-white shrink-0">
          <TopBar />
          <div className="flex-1 overflow-hidden flex flex-col">
            {leftPanels[section] || <SpeedDial />}
          </div>
        </div>

        {/* Right column - persistent detail/context panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50">
          <DetailPanel />
        </div>
      </div>

      {/* Overlays */}
      {callState && <InCall />}
      {!callState && postCallTranscript && <PostCallReview />}
      {incomingCall && !callState && <IncomingCall />}
      {showSettings && <Settings />}
    </div>
  );
}
