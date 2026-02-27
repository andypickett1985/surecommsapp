import React from 'react';
import { useStore, setState } from '../lib/store';
import * as ipc from '../lib/ipc';

const keys = [
  { num: '1', letters: '' },
  { num: '2', letters: 'ABC' },
  { num: '3', letters: 'DEF' },
  { num: '4', letters: 'GHI' },
  { num: '5', letters: 'JKL' },
  { num: '6', letters: 'MNO' },
  { num: '7', letters: 'PQRS' },
  { num: '8', letters: 'TUV' },
  { num: '9', letters: 'WXYZ' },
  { num: '*', letters: '' },
  { num: '0', letters: '+' },
  { num: '#', letters: '' },
];

export default function KeypadPanel() {
  const { dialNumber } = useStore();

  function press(key) {
    setState({ dialNumber: dialNumber + key });
  }

  function handleCall() {
    const num = dialNumber.trim();
    if (!num) return;
    ipc.makeCall(num);
    setState({ callState: { state: 'calling', number: num, name: '', direction: 'out' } });
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Similar phone numbers hint */}
      <div className="px-4 pt-3 pb-0">
        <span className="text-xs text-gray-400">Similar phone numbers</span>
      </div>

      {/* Spacer - matching the screenshot's large gap */}
      <div className="flex-1 min-h-20" />

      {/* Number input */}
      <div className="px-8 mb-5">
        <input
          type="text"
          value={dialNumber}
          onChange={e => setState({ dialNumber: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && handleCall()}
          placeholder="Enter number"
          className="w-full text-center text-xl font-light text-gray-800 border-b-2 border-gray-300 pb-2 outline-none placeholder:text-gray-300 bg-transparent focus:border-blue-400 transition-colors"
          autoFocus
        />
      </div>

      {/* Dialpad grid */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-3 px-10 mb-5">
        {keys.map(({ num, letters }) => (
          <button
            key={num}
            onClick={() => press(num)}
            onContextMenu={e => { if (num === '0') { e.preventDefault(); press('+'); } }}
            className="flex flex-col items-center justify-center w-16 h-16 mx-auto rounded-full border-2 border-gray-300 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 active:border-blue-500 active:scale-95 transition-all select-none"
          >
            <span className="text-2xl font-normal leading-none text-gray-700">{num}</span>
            {letters && <span className="text-[8px] font-semibold tracking-[2px] text-gray-400 mt-0.5">{letters}</span>}
          </button>
        ))}
      </div>

      {/* Call button */}
      <div className="flex justify-center pb-6 pt-2">
        <button
          onClick={handleCall}
          className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 active:scale-93 transition-all"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
