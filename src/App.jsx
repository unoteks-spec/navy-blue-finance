import React, { useEffect, useState } from 'react';
import { supabase } from './api/supabaseClient';
import Login from './pages/Login';
import Quotation from './pages/Quotation';
import QuotationHistory from './pages/QuotationHistory';
import ExpenseTracker from './pages/ExpenseTracker';
import ProfitLoss from './pages/ProfitLoss';

import { Calculator, Clock, Receipt, TrendingUp, LogOut } from 'lucide-react';

function App() {
  const [session, setSession]       = useState(null);
  const [activePage, setActivePage] = useState('quotation');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
      await supabase.auth.signOut();
    }
  };

  if (!session) return <Login/>;

  const navItems = [
    { key: 'quotation',         label: 'Yeni Teklif',      icon: Calculator },
    { key: 'quotation-history', label: 'Teklif Geçmişi',   icon: Clock },
    { key: 'expenses',          label: 'Gider Girişi',      icon: Receipt },
    { key: 'profit-loss',       label: 'Kar / Zarar',       icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <main>
        {activePage === 'quotation'         && <Quotation/>}
        {activePage === 'quotation-history' && <QuotationHistory/>}
        {activePage === 'expenses'          && <ExpenseTracker/>}
        {activePage === 'profit-loss'       && <ProfitLoss/>}
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-5 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-5 z-50 border border-white/10">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = activePage === item.key;
          return (
            <React.Fragment key={item.key}>
              <button onClick={() => setActivePage(item.key)}
                className={`flex flex-col items-center gap-1 transition-all duration-300 shrink-0 ${isActive ? 'text-blue-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2}/>
                <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
              </button>
              {i < navItems.length - 1 && <div className="w-px h-5 bg-slate-800 shrink-0"></div>}
            </React.Fragment>
          );
        })}
        <div className="w-px h-5 bg-slate-800/50 shrink-0"></div>
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-red-500 hover:text-red-400 transition-all shrink-0">
          <LogOut size={18}/>
          <span className="text-[8px] font-black uppercase tracking-tighter">Çıkış</span>
        </button>
      </div>
    </div>
  );
}

export default App;
