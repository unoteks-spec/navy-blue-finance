import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../api/supabaseClient';
import { TrendingUp, TrendingDown, Search, ChevronDown, ChevronUp } from 'lucide-react';

const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const fmtTRY = (n) => (isNaN(n) || !n) ? '—' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sym = { USD: '$', EUR: '€', TRY: '₺' };

export default function ProfitLoss() {
  const [quotations, setQuotations] = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expandedModel, setExpandedModel] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState('TRY'); // ✅ Varsayılan TRY

  const [salesOrders, setSalesOrders] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [qRes, eRes, soRes] = await Promise.all([
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
      ]);
      setQuotations(qRes.data || []);
      setExpenses(eRes.data || []);
      setSalesOrders(soRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  // USD'den seçili dövize çevir
  const convertFromUSD = (usd, r) => {
    if (displayCurrency === 'USD') return usd;
    if (displayCurrency === 'EUR') return usd * (r?.EUR || 1);
    return usd * (r?.TRY || 1);
  };

  const displaySym = displayCurrency === 'TRY' ? '₺' : displayCurrency === 'USD' ? '$' : '€';
  const displayFmt = (n) => {
    if (displayCurrency === 'TRY') return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Number(n).toFixed(2);
  };

  // Order bazlı kar/zarar hesabı
  const orderSummaries = useMemo(() => {
    return salesOrders.map(order => {
      const r = { USD: 1, EUR: 1, TRY: 1 }; // kur için quotation'dan alacağız

      // Gelir: her artikel için birim fiyat × sipariş adedi
      let revenueUSD = 0;
      const articleKeys = [];

      (order.items || []).forEach(item => {
        const qty = Number(item.orderQty || 0);
        const price = Number(item.unitPrice || 0);
        const currency = item.currency || 'USD';
        // Kuru quotation'dan al
        const q = quotations.find(q => q.id === item.quotationId);
        const qr = q?.rates || { USD: 1, EUR: 1, TRY: 1 };
        let usd = 0;
        if (currency === 'USD') usd = price * qty;
        else if (currency === 'EUR') usd = (price / qr.EUR) * qty;
        else usd = (price / qr.TRY) * qty;
        revenueUSD += usd;
        if (item.model) articleKeys.push((item.model || '').toLocaleLowerCase('tr-TR').trim());
      });

      // Gider: bu siparişin artikellerine ait tüm expense'ler
      const relatedExpenses = expenses.filter(exp => {
        const expKey = (exp.model || '').toLocaleLowerCase('tr-TR').trim();
        return articleKeys.includes(expKey);
      });

      // Kur için ilk quotation'ın kurunu al
      const firstQ = quotations.find(q => q.id === order.items?.[0]?.quotationId);
      const orderRates = firstQ?.rates || { USD: 1, EUR: 1, TRY: 1 };

      const expenseUSD = relatedExpenses.reduce((sum, exp) => {
        return sum + (exp.items || []).reduce((s, i) => {
          const amt = Number(i.amount || 0);
          // Giderler TL cinsinden
          return s + amt / orderRates.TRY;
        }, 0);
      }, 0);

      const profitUSD = revenueUSD - expenseUSD;
      const profitPct = revenueUSD > 0 ? (profitUSD / revenueUSD) * 100 : 0;

      return { order, revenueUSD, expenseUSD, profitUSD, profitPct, rates: orderRates };
    });
  }, [salesOrders, quotations, expenses]);

  // Model bazlı grupla
  const models = useMemo(() => {
    const map = {};

    // Quotation'ları ekle
    quotations.forEach(q => {
      const key = (q.model || '').toLocaleLowerCase('tr-TR').trim();
      if (!key) return;
      if (!map[key]) map[key] = { model: q.model, article: q.article, quotations: [], expenses: [] };
      map[key].quotations.push(q);
    });

    // Expense'leri ekle
    expenses.forEach(e => {
      const key = (e.model || '').toLocaleLowerCase('tr-TR').trim();
      if (!key) return;
      if (!map[key]) map[key] = { model: e.model, article: e.article, quotations: [], expenses: [] };
      map[key].expenses.push(e);
    });

    return Object.values(map);
  }, [quotations, expenses]);

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLocaleLowerCase('tr-TR');
    return models.filter(m =>
      (m.model || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (m.article || '').toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [models, search]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Yükleniyor</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-32 space-y-5">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><TrendingUp size={20}/></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Kar / Zarar</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">Model Bazlı Analiz</p>
          </div>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {['TRY', 'USD', 'EUR'].map(c => (
            <button key={c} onClick={() => setDisplayCurrency(c)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${displayCurrency === c ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'}`}>
              {c === 'TRY' ? '₺' : c === 'USD' ? '$' : '€'} {c}
            </button>
          ))}
        </div>
      </div>

      {/* ORDER BAZLI ÖZET */}
      {orderSummaries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Sipariş Bazlı Özet</h2>
          </div>
          <div className="grid gap-3">
            {orderSummaries.map(({ order, revenueUSD, expenseUSD, profitUSD, profitPct, rates }) => {
              const isProfit = profitUSD >= 0;
              const totalQty = (order.items || []).reduce((s, i) => s + Number(i.orderQty || 0), 0);
              return (
                <div key={order.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 ${isProfit ? 'border-emerald-100' : 'border-red-100'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-sm uppercase">{order.customer}</span>
                      {order.season && <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">{order.season}</span>}
                      <span className="text-[9px] font-bold text-slate-300">{(order.items || []).length} artikel · {totalQty.toLocaleString()} adet</span>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(order.items || []).map((item, i) => (
                        <span key={i} className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">{item.article}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {revenueUSD > 0 && (
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gelir</div>
                        <div className="text-sm font-black text-blue-600">{displaySym}{displayFmt(convertFromUSD(revenueUSD, rates))}</div>
                      </div>
                    )}
                    {expenseUSD > 0 && (
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gider</div>
                        <div className="text-sm font-black text-slate-700">{displaySym}{displayFmt(convertFromUSD(expenseUSD, rates))}</div>
                      </div>
                    )}
                    <div className={`text-right px-4 py-2 rounded-2xl border ${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kar/Zarar</div>
                      <div className={`text-sm font-black ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : '-'}{displaySym}{displayFmt(convertFromUSD(Math.abs(profitUSD), rates))}
                      </div>
                      <div className={`text-[9px] font-black ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                        {profitPct >= 0 ? '+' : ''}{fmtC(profitPct, 1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AYRAÇ */}
      {orderSummaries.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-100"></div>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Artikel Bazlı Detay</span>
          <div className="flex-1 h-px bg-slate-100"></div>
        </div>
      )}

      {/* ARAMA */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm relative">
        <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Model veya artikel ara..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-[11px] font-bold"/>
      </div>

      {/* MODEL LİSTESİ */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-200 font-black text-[10px] uppercase">Kayıt bulunamadı</div>
        ) : filtered.map(m => {
          const isOpen = expandedModel === m.model;

          // En güncel quotation'ı al
          const latestQ = m.quotations[0];
          const r = latestQ?.rates || { USD: 1, EUR: 1, TRY: 1 };

          // Teklif edilen fiyat (USD bazında)
          const quotedUSD = latestQ ? (() => {
            const p = Number(latestQ.quoted_price || 0);
            if (!p) return 0;
            if (latestQ.quoted_currency === 'USD') return p;
            if (latestQ.quoted_currency === 'EUR') return p / r.EUR;
            return p / r.TRY;
          })() : 0;

          const totalPcs = Number(latestQ?.total_pcs || 0);
          const totalRevenueUSD = quotedUSD * totalPcs;

          // Gerçekleşen giderler — kur hesabı
          const totalExpenseUSD = m.expenses.reduce((sum, exp) => {
            return sum + (exp.items || []).reduce((s, item) => {
              const amt = Number(item.amount || 0);
              if (item.currency === 'USD') return s + amt;
              if (item.currency === 'EUR') return s + amt / r.EUR;
              return s + amt / r.TRY;
            }, 0);
          }, 0);

          const profitUSD = totalRevenueUSD - totalExpenseUSD;
          const profitPct = totalRevenueUSD > 0 ? (profitUSD / totalRevenueUSD) * 100 : 0;
          const isProfit  = profitUSD >= 0;

          return (
            <div key={m.model} className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <button onClick={() => setExpandedModel(isOpen ? null : m.model)}
                className="w-full p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-slate-900 text-base uppercase">{m.model}</span>
                    {m.article && <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 uppercase">{m.article}</span>}
                    <span className="text-[9px] font-bold text-slate-300">{m.quotations.length} teklif · {m.expenses.length} fatura</span>
                  </div>
                  {totalPcs > 0 && <div className="text-[9px] text-slate-400 font-bold uppercase">{totalPcs.toLocaleString()} adet</div>}
                </div>

                <div className="flex items-center gap-6 shrink-0 ml-4">
                  {totalRevenueUSD > 0 && (
                    <div className="text-right">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gelir ({displayCurrency})</div>
                      <div className="text-sm font-black text-blue-600">{displaySym}{displayFmt(convertFromUSD(totalRevenueUSD, r))}</div>
                    </div>
                  )}
                  {totalExpenseUSD > 0 && (
                    <div className="text-right">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gider ({displayCurrency})</div>
                      <div className="text-sm font-black text-slate-700">{displaySym}{displayFmt(convertFromUSD(totalExpenseUSD, r))}</div>
                    </div>
                  )}
                  {(totalRevenueUSD > 0 || totalExpenseUSD > 0) && (
                    <div className={`text-right px-4 py-2 rounded-2xl border ${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kar/Zarar</div>
                      <div className={`text-sm font-black ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : '-'}{displaySym}{displayFmt(convertFromUSD(Math.abs(profitUSD), r))}
                      </div>
                      <div className={`text-[9px] font-black ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                        {profitPct >= 0 ? '+' : ''}{fmtC(profitPct, 1)}%
                      </div>
                    </div>
                  )}
                  {isOpen ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-50 space-y-4 mt-2">

                  {/* Teklifler */}
                  {m.quotations.length > 0 && (
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Teklifler</div>
                      <div className="space-y-2">
                        {m.quotations.map((q, i) => {
                          const r = q.rates || { USD: 1, EUR: 1, TRY: 1 };
                          const displayUSD = q.delivery_type === 'FOB' ? q.fob_usd : q.cif_usd;
                          return (
                            <div key={q.id} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-blue-700 uppercase">{q.customer || 'Müşteri belirtilmemiş'}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${q.delivery_type === 'FOB' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{q.delivery_type}</span>
                                    {i === 0 && <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded">GÜNCEL</span>}
                                  </div>
                                  <div className="text-[9px] text-blue-400 font-bold mt-0.5">
                                    {new Date(q.created_at).toLocaleDateString('tr-TR')}
                                    {q.season && ` · ${q.season}`}
                                  </div>
                                </div>
                                <div className="flex gap-4">
                                  <div className="text-right">
                                    <div className="text-[8px] font-black text-slate-400 uppercase">Maliyet</div>
                                    <div className="text-xs font-black text-slate-700">${fmtC(displayUSD)}</div>
                                  </div>
                                  {q.quoted_price > 0 && (
                                    <div className="text-right">
                                      <div className="text-[8px] font-black text-slate-400 uppercase">Verilen Fiyat</div>
                                      <div className="text-xs font-black text-blue-600">{sym[q.quoted_currency]}{fmtC(q.quoted_price)}</div>
                                    </div>
                                  )}
                                  {q.total_pcs > 0 && (
                                    <div className="text-right">
                                      <div className="text-[8px] font-black text-slate-400 uppercase">Adet</div>
                                      <div className="text-xs font-black text-slate-700">{q.total_pcs.toLocaleString()}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Giderler */}
                  {m.expenses.length > 0 && (
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Giderler</div>
                      <div className="space-y-2">
                        {m.expenses.map(exp => {
                          const expTotal = (exp.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
                          return (
                            <div key={exp.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {exp.supplier && <span className="text-[10px] font-black text-slate-700 uppercase">{exp.supplier}</span>}
                                    {exp.invoice_no && <span className="text-[9px] font-bold text-slate-400">#{exp.invoice_no}</span>}
                                  </div>
                                  <div className="flex gap-2 mt-1 flex-wrap">
                                    {(exp.items || []).map((item, i) => (
                                      <span key={i} className="text-[8px] font-black bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 uppercase">{item.category}</span>
                                    ))}
                                  </div>
                                  {exp.invoice_date && <div className="text-[9px] text-slate-300 font-bold mt-0.5">{new Date(exp.invoice_date).toLocaleDateString('tr-TR')}</div>}
                                </div>
                                <div className="text-right">
                                  <div className="text-[8px] font-black text-slate-400 uppercase">Toplam</div>
                                  <div className="text-sm font-black text-slate-900">{fmtC(expTotal)}</div>
                                  <div className="text-[9px] text-slate-400">≈ ${fmtC(totalExpenseUSD / m.expenses.length)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Özet */}
                  {(totalRevenueUSD > 0 || totalExpenseUSD > 0) && (
                    <div className={`rounded-2xl p-5 border ${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {[
                              { label: `Toplam Gelir (${displayCurrency})`, value: `${displaySym}${displayFmt(convertFromUSD(totalRevenueUSD, r))}`, color: 'text-blue-600' },
                          { label: `Toplam Gider (${displayCurrency})`, value: `${displaySym}${displayFmt(convertFromUSD(totalExpenseUSD, r))}`, color: 'text-slate-700' },
                          { label: 'Net Kar/Zarar', value: `${isProfit ? '+' : '-'}${displaySym}${displayFmt(convertFromUSD(Math.abs(profitUSD), r))}`, color: isProfit ? 'text-emerald-600' : 'text-red-600' },
                          { label: 'Kar Marjı', value: `${profitPct >= 0 ? '+' : ''}${fmtC(profitPct, 1)}%`, color: isProfit ? 'text-emerald-600' : 'text-red-600' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                            <div className={`text-lg font-black ${color}`}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}