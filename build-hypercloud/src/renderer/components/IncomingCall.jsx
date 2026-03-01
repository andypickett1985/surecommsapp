import React, { useEffect } from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';
import { playRingtone, stopRingtone } from '../lib/ringtone';

export default function IncomingCall() {
  const { incomingCall } = useStore();

  useEffect(() => {
    if (incomingCall) playRingtone();
    return () => stopRingtone();
  }, [incomingCall]);

  function doAnswer() {
    stopRingtone();
    ipc.answer(false);
    setState({
      callState: { state: 'connecting', number: incomingCall.number, name: incomingCall.name, direction: 'in', callId: incomingCall.callId },
      incomingCall: null,
    });
  }

  function doDecline() {
    stopRingtone();
    ipc.decline();
    setState({ incomingCall: null });
  }

  return (
    <div className="absolute inset-0 z-[60] bg-linear-to-b from-navy via-navy-dark to-navy-dark flex flex-col items-center justify-center text-white animate-fade-in">
      {/* Pulse ring */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-electric/10 animate-pulse-ring" />

      <div className="text-center mb-16 relative z-10">
        <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-electric/20">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h2 className="text-2xl font-semibold">{incomingCall?.name || 'Unknown'}</h2>
        <p className="text-white/50 text-sm mt-1">{incomingCall?.number}</p>
        <p className="text-white/60 text-sm mt-2 flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Incoming call...
        </p>
      </div>

      <div className="flex gap-12">
        <button onClick={doAnswer} className="w-16 h-16 bg-success hover:shadow-lg hover:shadow-success/40 rounded-full flex items-center justify-center text-white active:scale-93 transition-all">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
        </button>
        <button onClick={doDecline} className="w-16 h-16 bg-brand-red hover:shadow-lg hover:shadow-brand-red/40 rounded-full flex items-center justify-center text-white active:scale-93 transition-all">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0124 20.31v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 014.12 7.56 2 2 0 016.11 5.5h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
      <div className="flex gap-12 mt-2 text-xs text-white/50">
        <span className="w-16 text-center">Answer</span>
        <span className="w-16 text-center">Decline</span>
      </div>
    </div>
  );
}
