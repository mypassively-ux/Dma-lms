import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

interface SignInPageProps {
  onLogin: (email: string, password: string, remember: boolean) => Promise<{ success: boolean; error?: string }>;
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', icon: '👑', email: 'pandoratecllc@gmail.com',                   password: 'Dmamfg.2026' },
  { label: 'Admin',       icon: '🛡️', email: 'digitalmfg.2026@gmail.com',                  password: 'Dmamfg.2026' },
  { label: 'Student',     icon: '🎓', email: 'student@digitalmanufacturing.academy',        password: 'demo' },
  { label: 'Instructor',  icon: '👨‍🏫', email: 'instructor@digitalmanufacturing.academy',    password: 'demo' },
];

export default function SignInPage({ onLogin, onNavigateRegister, onNavigateHome }: SignInPageProps) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [remember, setRemember]     = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await onLogin(email, password, remember);
    if (!result.success) setError(result.error || 'Login failed. Please check your credentials.');
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 py-16 relative">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">

        {/* Logo + heading */}
        <div className="text-center mb-8">
          <button onClick={onNavigateHome} className="inline-flex items-center gap-2.5 mb-5 cursor-pointer group">
            <img
              src="/dma-logo.png"
              alt="DMA Academy"
              className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(37,99,235,0.7)] group-hover:drop-shadow-[0_0_16px_rgba(37,99,235,0.9)] transition-all"
            />
            <span className="text-lg font-extrabold text-white group-hover:text-blue-300 transition-colors">DMA Academy</span>
          </button>
          <h1 className="text-2xl font-extrabold text-white mb-1.5">Welcome Back</h1>
          <p className="text-slate-400 text-sm">Sign in to continue your learning journey</p>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl bg-[#0d1526]/90 border border-slate-800/80 shadow-2xl backdrop-blur-sm space-y-5">

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="your@email.com"
                className="w-full text-sm p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full text-sm p-3 pr-10 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRemember(r => !r)}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${remember ? 'bg-blue-600 border-blue-500' : 'border-slate-600 bg-white/5 hover:border-slate-400'}`}>
                {remember && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs text-slate-400 hover:text-slate-300 transition-colors">Remember me for 30 days</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-extrabold text-sm cursor-pointer transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">demo access</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Demo Accounts quick-fill */}
          <div className="p-3 rounded-xl bg-white/3 border border-white/6 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-blue-400" />
              <span className="text-[9px] uppercase font-bold text-[#00aaff] font-mono tracking-widest">Quick-fill demo accounts</span>
            </div>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left group"
                >
                  <span className="text-sm">{acc.icon}</span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">{acc.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono block leading-none">{acc.email}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Register link */}
          <div className="text-center border-t border-slate-800 pt-4">
            <p className="text-xs text-slate-500">
              Don't have an account?{' '}
              <button onClick={onNavigateRegister} className="text-[#00aaff] hover:text-[#00ddff] font-extrabold cursor-pointer transition-colors">
                Create one free →
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
