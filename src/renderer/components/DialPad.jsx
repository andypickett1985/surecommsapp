import React from 'react';

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

export default function DialPad({ onPress }) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-64">
      {keys.map(({ num, letters }) => (
        <button
          key={num}
          onClick={() => onPress(num)}
          onContextMenu={(e) => { if (num === '0') { e.preventDefault(); onPress('+'); } }}
          className="aspect-square rounded-full bg-white border border-gray-200 hover:bg-cloud active:bg-electric active:border-electric active:text-white flex flex-col items-center justify-center transition-all active:scale-93 select-none"
        >
          <span className="text-xl font-medium leading-none text-navy">{num}</span>
          <span className="text-[9px] font-semibold tracking-widest text-gray-400 mt-0.5 min-h-3">{letters}</span>
        </button>
      ))}
    </div>
  );
}
