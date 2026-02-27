import React from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Quick Search or dial' }) {
  return (
    <div className="flex items-center gap-2 mx-3 my-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
      />
    </div>
  );
}
