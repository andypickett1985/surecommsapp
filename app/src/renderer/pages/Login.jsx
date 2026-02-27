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

      {/* Background with light printed pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-[#f8f7fa] via-[#f0eff4] to-[#e8e6ed]" />

        {/* Subtle brand watermark pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 20C30 14 34 10 40 10h0c4 0 7 2 9 5l-13 15H30V20z' fill='%23CE0037' opacity='0.03'/%3E%3Ccircle cx='50' cy='18' r='10' fill='%23CE0037' opacity='0.03'/%3E%3Cpath d='M30 55C30 49 34 45 40 45h0c4 0 7 2 9 5l-13 15H30V55z' fill='%23CE0037' opacity='0.03'/%3E%3Ccircle cx='50' cy='53' r='10' fill='%23CE0037' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: '120px 120px',
        }} />

        {/* Floating gradient orbs - very subtle on light bg */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* Soft glow behind logo area */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/60 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 animate-fade-in">
        {/* Sure Logo */}
        <div className="mb-8">
          <img src={sureLogo} alt="Sure by Beyon" className="h-28 w-auto drop-shadow-2xl" />
        </div>

        <h1 className="text-xl font-bold text-navy tracking-tight mb-1">SureCloudVoice</h1>
        <p className="text-gray-400 text-xs mb-8">Enterprise Communications</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-72 space-y-3.5">
          {error && (
            <div className="bg-brand-red/15 border border-brand-red/30 text-[#ff6b8a] rounded-lg px-3 py-2 text-xs animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-electric focus:bg-white focus:ring-2 focus:ring-electric/15 transition-all backdrop-blur-sm shadow-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-electric focus:bg-white focus:ring-2 focus:ring-electric/15 transition-all backdrop-blur-sm shadow-sm"
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

        <p className="text-gray-300 text-[10px] mt-10">SureCloudVoice by Sure</p>
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
          background: #CE0037;
          opacity: 0.04;
          top: -15%; left: -10%;
          animation-duration: 25s;
        }
        .orb-2 {
          width: 350px; height: 350px;
          background: #4C00FF;
          opacity: 0.04;
          bottom: -10%; right: -10%;
          animation-duration: 30s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: #202A44;
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
