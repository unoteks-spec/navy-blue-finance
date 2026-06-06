import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../api/supabaseClient';
import { ShoppingBag, Search, Plus, Trash2, Save, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'TRY'];
const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const sanitize = (v) => String(v).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const iCls = 'w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all';

const emptyForm = () => ({
  customer: '',
  orderDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  season: '',
  notes: '',
  items: [],
});

export default function SalesOrderCreate({ onSaved }) {
  const [form, setForm]           = useState(emptyForm());
  const [quotations, setQuotations] = useState([]);
  const [search, setSearch]       = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [activeId, setActiveId]   = useState(null);

  useEffect(() => {
    supabase.from('quotations').select('id, customer, article, model, season, quoted_price, quoted_currency, total_pcs, fob_usd, cif_usd, delivery_type, rates')
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotations(data || []));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return quotations;
    const q = search.toLocaleLowerCase('tr-TR');
    return quotations.filter(qt =>
      (qt.article || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (qt.model   || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (qt.customer|| '').toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [quotations, search]);

  const selectedIds = form.items.map(i => i.quotationId);

  const toggleQuotation = (qt) => {
    const already = form.items.find(i => i.quotationId === qt.id);
    if (already) {
      setForm(f => ({ ...f, items: f.items.filter(i => i.quotationId !== qt.id) }));
    } else {
      const newItem = {
        quotationId:  qt.id,
        article:      qt.article || '',
        model:        qt.model || '',
        unitPrice:    qt.quoted_price || '',
        currency:     qt.quoted_currency || 'USD',
        orderQty:     '',
        cuttingPct:   '5',
        deliveryType: qt.delivery_type || 'FOB',
      };
      setForm(f => ({ ...f, items: [...f.items, newItem] }));
    }
  };

  const setItem = (qid, k, v) => setForm(f => ({
    ...f, items: f.items.map(i => i.quotationId === qid ? { ...i, [k]: v } : i)
  }));

  const removeItem = (qid) => setForm(f => ({ ...f, items: f.items.filter(i => i.quotationId !== qid) }));

  const getEffectiveQty = (item) => {
    const qty = Number(item.orderQty || 0);
    const pct = Number(item.cuttingPct || 0);
    return Math.ceil(qty * (1 + pct / 100));
  };

  // Toplam hesap
  const totals = useMemo(() => {
    return form.items.reduce((acc, item) => {
      const qty = Number(item.orderQty || 0);
      const price = Number(item.unitPrice || 0);
      const r = quotations.find(q => q.id === item.quotationId)?.rates || { USD: 1, EUR: 1, TRY: 1 };
      let usd = 0;
      if (item.currency === 'USD') usd = price * qty;
      else if (item.currency === 'EUR') usd = (price / r.EUR) * qty;
      else usd = (price / r.TRY) * qty;
      return {
        qty: acc.qty + qty,
        effective: acc.effective + getEffectiveQty(item),
        usd: acc.usd + usd,
      };
    }, { qty: 0, effective: 0, usd: 0 });
  }, [form.items, quotations]);

  const handleSave = async () => {
    if (!form.customer) { alert('Müşteri adı zorunlu'); return; }
    if (form.items.length === 0) { alert('En az bir artikel seçin'); return; }
    setSaving(true);
    try {
      const payload = {
        customer:   form.customer,
        order_date: form.orderDate,
        due_date:   form.dueDate || null,
        season:     form.season,
        notes:      form.notes,
        status:     'active',
        items:      form.items.map(i => ({ ...i, effectiveQty: getEffectiveQty(i) })),
        updated_at: new Date().toISOString(),
      };
      if (activeId) {
        const { error } = await supabase.from('sales_orders').update(payload).eq('id', activeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('sales_orders').insert([payload]).select();
        if (error) throw error;
        if (data?.[0]) setActiveId(data[0].id);
      }
      setSaveMsg('Kaydedildi ✓');
      setTimeout(() => setSaveMsg(''), 2500);
      if (onSaved) onSaved();
    } catch (e) { alert('Kayıt hatası: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleNew = () => { setForm(emptyForm()); setActiveId(null); };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-32 space-y-5">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><ShoppingBag size={20}/></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              {activeId ? 'Siparişi Güncelle' : 'Yeni Sipariş'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">Artikel Bazlı Sipariş Oluşturma</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleNew} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
            <Plus size={14}/> Yeni
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all">
            <Save size={14}/>{saving ? 'Kaydediliyor...' : saveMsg || 'Kaydet'}
          </button>
        </div>
      </div>

      {/* SİPARİŞ BİLGİLERİ */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
          <div className="w-1.5 h-4 bg-slate-900 rounded-full"></div>
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Sipariş Bilgileri</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Müşteri *</label>
            <input type="text" value={form.customer} onChange={e => setForm(f => ({...f, customer: e.target.value}))} placeholder="Müşteri adı" className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sipariş Tarihi</label>
            <input type="date" value={form.orderDate} onChange={e => setForm(f => ({...f, orderDate: e.target.value}))} className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Termin</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sezon</label>
            <input type="text" value={form.season} onChange={e => setForm(f => ({...f, season: e.target.value}))} placeholder="SS26" className={iCls}/>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Not</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Opsiyonel" className={iCls + ' mt-1'}/>
        </div>
      </div>

      {/* ARTİKEL SEÇİMİ */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Artikeller</h2>
            {form.items.length > 0 && <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100">{form.items.length} artikel seçildi</span>}
          </div>
          <button onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">
            <Plus size={10}/> Artikel Seç
            {showPicker ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          </button>
        </div>

        {/* Quotation Picker */}
        {showPicker && (
          <div className="mb-5 border border-slate-100 rounded-2xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Artikel, model veya müşteri ara..."
                  className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[11px] font-bold"/>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase">Teklif bulunamadı</div>
              ) : filtered.map(qt => {
                const isSelected = selectedIds.includes(qt.id);
                return (
                  <button key={qt.id} onClick={() => toggleQuotation(qt)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors text-left ${isSelected ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      {isSelected ? <CheckSquare size={16} className="text-blue-600 shrink-0"/> : <Square size={16} className="text-slate-300 shrink-0"/>}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 uppercase">{qt.article}</span>
                          {qt.season && <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{qt.season}</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{qt.model} {qt.customer && `· ${qt.customer}`}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-[8px] font-black text-slate-400 uppercase">Teklif Fiyatı</div>
                      <div className="text-sm font-black text-blue-600">{qt.quoted_currency === 'USD' ? '$' : qt.quoted_currency === 'EUR' ? '€' : '₺'}{fmtC(qt.quoted_price)}</div>
                      <div className="text-[8px] text-slate-300 font-bold">{qt.delivery_type}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Seçilen Artikeller */}
        {form.items.length === 0 ? (
          <div className="py-10 text-center text-slate-200 text-[10px] font-black uppercase">Henüz artikel seçilmedi</div>
        ) : (
          <div className="space-y-3">
            {/* Başlık */}
            <div className="grid grid-cols-12 gap-2 px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <div className="col-span-3">Artikel / Model</div>
              <div className="col-span-2 text-right">Birim Fiyat</div>
              <div className="col-span-1">Dvz</div>
              <div className="col-span-2 text-right">Sipariş Adedi</div>
              <div className="col-span-1 text-right">Kesim %</div>
              <div className="col-span-2 text-right">Efektif Adet</div>
              <div className="col-span-1"></div>
            </div>

            {form.items.map(item => (
              <div key={item.quotationId} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="col-span-3">
                  <div className="text-xs font-black text-slate-900 uppercase">{item.article}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">{item.model}</div>
                </div>
                <div className="col-span-2">
                  <input type="text" inputMode="decimal" value={item.unitPrice}
                    onChange={e => setItem(item.quotationId, 'unitPrice', sanitize(e.target.value))}
                    onFocus={e => e.target.select()} placeholder="0.0000"
                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-black outline-none text-right focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div className="col-span-1">
                  <select value={item.currency} onChange={e => setItem(item.quotationId, 'currency', e.target.value)}
                    className="w-full h-8 px-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="text" inputMode="decimal" value={item.orderQty}
                    onChange={e => setItem(item.quotationId, 'orderQty', sanitize(e.target.value))}
                    onFocus={e => e.target.select()} placeholder="0"
                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-black outline-none text-right focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div className="col-span-1">
                  <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden h-8">
                    <input type="text" inputMode="decimal" value={item.cuttingPct}
                      onChange={e => setItem(item.quotationId, 'cuttingPct', sanitize(e.target.value))}
                      onFocus={e => e.target.select()}
                      className="flex-1 px-2 bg-transparent outline-none text-xs font-black text-right w-full"/>
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-black text-slate-900">{getEffectiveQty(item).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-1">adet</span>
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={() => removeItem(item.quotationId)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}

            {/* Toplam */}
            {form.items.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'Toplam Sipariş', value: totals.qty.toLocaleString() + ' adet', color: 'text-slate-900' },
                  { label: 'Efektif Adet', value: totals.effective.toLocaleString() + ' adet', color: 'text-blue-600' },
                  { label: 'Toplam Tutar (USD)', value: '$' + fmtC(totals.usd), color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                    <div className={`text-lg font-black ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}