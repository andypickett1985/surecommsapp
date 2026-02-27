import React, { useEffect } from 'react';
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
import DetailPanel from './pages/DetailPanel';
import Settings from './pages/Settings';
import PostCallReview from './pages/PostCallReview';

export default function App() {
  const { view, section, callState, incomingCall, showSettings, postCallTranscript } = useStore();

  useEffect(() => {
    ipc.onSipEvent((data) => {
      switch (data.event) {
        case 'regState': setState({ regStatus: { code: data.code, reason: data.reason || '' } }); break;
        case 'callState':
          if (data.state === 'disconnected') { addCallToHistory(data); setState({ callState: null, postCallTranscript: { number: cleanSipUri(data.number), name: cleanSipUri(data.name), direction: data.direction } }); }
          else setState({ callState: data });
          break;
        case 'incomingCall': setState({ incomingCall: data }); break;
        case 'engineStopped': setState({ regStatus: { code: -1, reason: 'Engine stopped' } }); break;
      }
    });
    ipc.onWsEvent((data) => {
      switch (data.event) {
        case 'newMessage': {
          const cid = data.conversationId;
          setState(prev => {
            const msgs = { ...prev.messages };
            if (msgs[cid]) msgs[cid] = [...msgs[cid], data.message];
            const convos = prev.conversations.map(c => c.id === cid ? { ...c, last_message: data.message.body, last_message_at: data.message.created_at, unread_count: String((parseInt(c.unread_count) || 0) + 1) } : c);
            return { messages: msgs, conversations: convos };
          });
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
      const [users, convos, speedDials, pbxContacts] = await Promise.all([
        ipc.fetchUsers().catch(e => { console.error('fetchUsers failed:', e.message); return []; }),
        ipc.fetchConversations().catch(e => { console.error('fetchConvos failed:', e.message); return []; }),
        ipc.fetchSpeedDials().catch(e => { console.error('fetchSpeedDials failed:', e.message); return []; }),
        ipc.fetchContacts().catch(e => { console.error('fetchContacts failed:', e.message); return []; }),
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
      setState({ users, conversations: convos, speedDials, presence, contacts });
    } catch {}
    ipc.updatePresence('online').catch(() => {});
  }

  function cleanSipUri(raw) {
    if (!raw) return '';
    const m = raw.match(/(?:<)?sip:([^@>]+)@[^>]*/i);
    return m ? m[1] : raw.replace(/^["']|["']$/g, '').trim();
  }

  function addCallToHistory(data) {
    setState(prev => {
      const entry = { name: cleanSipUri(data.name || ''), number: cleanSipUri(data.number || ''), direction: data.direction || 'out', duration: data.duration || 0, timestamp: new Date().toISOString() };
      const calls = [entry, ...prev.calls].slice(0, 300);
      localStorage.setItem('scv_calls', JSON.stringify(calls));
      return { calls };
    });
  }

  if (view === 'loading') return <div className="flex items-center justify-center h-screen bg-navy"><div className="text-white/40 text-sm">Loading...</div></div>;
  if (view === 'login') return <Login onSuccess={(data) => { setState({ view: 'main', user: data.user, token: data.token, sipAccounts: data.sipAccounts }); startSip(data.sipAccounts); loadData(data.token); }} />;

  const leftPanels = {
    speeddial: <SpeedDial />,
    users: <Users />,
    contacts: <Contacts />,
    chats: <Chats />,
    calls: <Calls />,
    keypad: <KeypadPanel />,
  };

  return (
    <div className="flex h-screen bg-white relative select-none">
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

      {/* Overlays */}
      {callState && <InCall />}
      {!callState && postCallTranscript && <PostCallReview />}
      {incomingCall && !callState && <IncomingCall />}
      {showSettings && <Settings />}
    </div>
  );
}
