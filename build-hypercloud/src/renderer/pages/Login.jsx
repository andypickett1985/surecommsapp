import React, { useState } from 'react';
import * as ipc from '../lib/ipc';
import sureLogo from '../assets/sure-logo.png';

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await ipc.login(email, password);
      if (data?.token) {
        onSuccess(data);
      } else {
        setError(data?.error || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-navy-dark">
      {/* Draggable title bar */}
      <div className="h-8 flex items-center justify-end px-2 shrink-0 relative z-20" style={{ WebkitAppRegion: 'drag' }}>
        <button onClick={ipc.windowClose} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded" style={{ WebkitAppRegion: 'no-drag' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Brand background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-dark) 55%, #091828 100%)',
          }}
        />

        {/* Subtle mesh pattern */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.16,
            backgroundImage:
              'radial-gradient(circle at 24% 20%, rgba(109,180,214,0.28) 0, rgba(109,180,214,0) 34%), radial-gradient(circle at 76% 78%, rgba(74,138,170,0.22) 0, rgba(74,138,170,0) 36%)',
          }}
        />

        {/* Floating gradient orbs - very subtle on light bg */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* Soft logo glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/6 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 animate-fade-in">
        {/* Sure Logo */}
        <div className="mb-8">
          <img src={sureLogo} alt="Connection Technologies" className="h-28 w-auto drop-shadow-2xl" />
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight mb-1">Hypercloud</h1>
        <p className="text-blue-100/70 text-xs mb-8">Enterprise Communications</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-72 space-y-3.5">
          {error && (
            <div className="bg-blue-900/35 border border-blue-300/20 text-blue-100 rounded-lg px-3 py-2 text-xs animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-blue-100/70 uppercase tracking-widest mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full px-4 py-3 bg-white/96 border border-white/35 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-electric focus:bg-white focus:ring-2 focus:ring-electric/20 transition-all backdrop-blur-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-blue-100/70 uppercase tracking-widest mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-3 bg-white/96 border border-white/35 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-electric focus:bg-white focus:ring-2 focus:ring-electric/20 transition-all backdrop-blur-sm shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-red hover:bg-brand-red-dark active:scale-[0.98] text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-blue-100/55 text-[10px] mt-10">Hypercloud powered by Connection Technologies</p>
      </div>

      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: float linear infinite;
        }
        .orb-1 {
          width: 400px; height: 400px;
          background: #6db4d6;
          opacity: 0.04;
          top: -15%; left: -10%;
          animation-duration: 25s;
        }
        .orb-2 {
          width: 350px; height: 350px;
          background: #4a8aaa;
          opacity: 0.04;
          bottom: -10%; right: -10%;
          animation-duration: 30s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: #1a3a5c;
          opacity: 0.03;
          top: 50%; left: 30%;
          animation-duration: 22s;
          animation-delay: -4s;
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(40px, 30px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
