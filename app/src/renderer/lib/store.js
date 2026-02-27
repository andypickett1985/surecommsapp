import { useSyncExternalStore } from 'react';

let state = {
  view: 'loading',
  section: 'speeddial',
  selectedItem: null,
  selectedType: null,
  showSettings: false,
  dialNumber: '',

  user: null,
  token: null,
  sipAccounts: [],
  regStatus: { code: 0, reason: 'Disconnected' },

  callState: null,
  incomingCall: null,
  postCallTranscript: null,

  users: [],
  contacts: JSON.parse(localStorage.getItem('scv_contacts') || '[]'),
  calls: JSON.parse(localStorage.getItem('scv_calls') || '[]'),
  conversations: [],
  messages: {},
  speedDials: [],
  presence: {},
  orgSettings: {},
};

const listeners = new Set();
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
function getState() { return state; }

export function setState(partial) {
  state = typeof partial === 'function' ? { ...state, ...partial(state) } : { ...state, ...partial };
  listeners.forEach(l => l());
}

export function useStore() { return useSyncExternalStore(subscribe, getState); }
export { getState };
