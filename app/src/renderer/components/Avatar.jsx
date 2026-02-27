import React from 'react';

const colors = ['bg-rose-200 text-rose-700', 'bg-blue-200 text-blue-700', 'bg-green-200 text-green-700', 'bg-purple-200 text-purple-700', 'bg-amber-200 text-amber-700', 'bg-cyan-200 text-cyan-700', 'bg-pink-200 text-pink-700', 'bg-indigo-200 text-indigo-700', 'bg-teal-200 text-teal-700', 'bg-orange-200 text-orange-700'];

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

export default function Avatar({ name, size = 'md', presence, image }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  const dotSz = size === 'sm' ? 'w-2.5 h-2.5 -bottom-0 -right-0' : 'w-3 h-3 -bottom-0.5 -right-0.5';
  const presenceColor = { online: 'bg-green-500', away: 'bg-yellow-400', busy: 'bg-red-500', dnd: 'bg-red-600', offline: 'bg-gray-300' };

  return (
    <div className="relative shrink-0">
      {image ? (
        <img src={image} className={`${sz} rounded-full object-cover`} />
      ) : (
        <div className={`${sz} rounded-full ${hashColor(name)} flex items-center justify-center font-semibold`}>
          {getInitials(name)}
        </div>
      )}
      {presence && (
        <div className={`absolute ${dotSz} ${presenceColor[presence] || presenceColor.offline} rounded-full border-2 border-white`} />
      )}
    </div>
  );
}
