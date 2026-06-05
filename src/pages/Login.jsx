import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('E-posta veya şifre hatalı.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-900 mb-6">
            <Lock size={28} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Navy Blue</h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Finance & Quotation</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4 shadow-2xl">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">E-posta</label>
            <div className="flex bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-11 focus-within:border-blue-600 transition-colors">
              <div className="px-3 flex items-center"><Mail size={14} className="text-slate-500"/></div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ornek@email.com" required
                className="flex-1 bg-transparent outline-none text-sm font-bold text-white placeholder-slate-600"/>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Şifre</label>
            <div className="flex bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-11 focus-within:border-blue-600 transition-colors">
              <div className="px-3 flex items-center"><Lock size={14} className="text-slate-500"/></div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="flex-1 bg-transparent outline-none text-sm font-bold text-white placeholder-slate-600"/>
            </div>
          </div>

          {error && <p className="text-[10px] font-black text-red-500 uppercase tracking-wide">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900 flex items-center justify-center gap-2 mt-2">
            {loading ? <Loader2 size={16} className="animate-spin"/> : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
