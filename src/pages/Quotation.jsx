import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calculator, RefreshCcw, DollarSign, TrendingUp, TrendingDown,
  Ship, Anchor, Plus, Trash2, Save
} from 'lucide-react';
import { supabase } from '../api/supabaseClient';

// --- SABİTLER ---
const PROCESS_ITEMS_DEFAULT = [
  { id: 'baski',       label: 'Baskı',         currency: 'TRY' },
  { id: 'nakis',       label: 'Nakış',         currency: 'TRY' },
  { id: 'ilik_dugme',  label: 'İlik - Düğme',  currency: 'TRY' },
  { id: 'yikama',      label: 'Yıkama',        currency: 'TRY' },
  { id: 'dikim',       label: 'Dikim',         currency: 'TRY' },
  { id: 'utu_ambalaj', label: 'Ütü - Ambalaj', currency: 'TRY' },
];

const CURRENCIES = ['USD', 'EUR', 'TRY'];
const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const sanitize = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const emptyGarni     = () => ({ id: Date.now() + Math.random(), kind: '', qty: '', price: '', currency: 'USD' });
const emptyAccessory = () => ({ id: Date.now() + Math.random(), label: '', qty: '', price: '', currency: 'TRY' });
const emptyProcess   = () => ({ id: Date.now() + Math.random(), label: '', price: '', currency: 'TRY' });

const emptyForm = () => ({
  customer: '', article: '', model: '', season: '', totalPcs: '',
  fabricKind: '', fabricQty: '', fabricPrice: '', fabricCurrency: 'USD',
  garnis: [emptyGarni()],
  labelPrice: '', labelCurrency: 'TRY',
  packagingPrice: '', packagingCurrency: 'TRY',
  accessories: [],
  processes: PROCESS_ITEMS_DEFAULT.map(p => ({ ...p, price: '' })),
  overhead: '', margin: '', commission: '',
  freightEur: '', insuranceEur: '',
  deliveryType: 'FOB',
  quotedPrice: '', quotedCurrency: 'EUR',
});

// ✅ COMPONENT DIŞINDA TANIMLANDI — re-render'da yeniden oluşmaz, focus sorunu yok
const iCls = 'w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all';
const numCls = iCls + ' text-right';

const CurrencySelect = ({ value, onChange }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className="h-9 px-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer text-slate-700 shrink-0">
    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
  </select>
);

const SectionTitle = ({ color = 'bg-slate-900', children, action }) => (
  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-4 ${color} rounded-full`}></div>
      <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{children}</h2>
    </div>
    {action}
  </div>
);

// --- ANA COMPONENT ---
export default function Quotation() {
  const [form, setForm]       = useState(emptyForm());
  const [rates, setRates]     = useState({ USD: 1, EUR: 1, TRY: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesDate, setRatesDate]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeId, setActiveId] = useState(null);

  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      setRates({ USD: 1, EUR: data.rates.EUR, TRY: data.rates.TRY });
      setRatesDate(data.date);
    } catch (e) { console.error('Kur hatası:', e); }
    finally { setRatesLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const toUSD = useCallback((amount, currency) => {
    const n = Number(amount || 0);
    if (!n) return 0;
    if (currency === 'USD') return n;
    if (currency === 'EUR') return n / rates.EUR;
    if (currency === 'TRY') return n / rates.TRY;
    return 0;
  }, [rates]);

  const fromUSD = useCallback((usd, currency) => {
    if (currency === 'USD') return usd;
    if (currency === 'EUR') return usd * rates.EUR;
    if (currency === 'TRY') return usd * rates.TRY;
    return usd;
  }, [rates]);

  const calc = useMemo(() => {
    const fabricUSD    = toUSD(Number(form.fabricQty||0) * Number(form.fabricPrice||0), form.fabricCurrency);
    const garniUSD     = form.garnis.reduce((s,g) => s + toUSD(Number(g.qty||0)*Number(g.price||0), g.currency), 0);
    const labelUSD     = toUSD(Number(form.labelPrice||0), form.labelCurrency);
    const packagingUSD = toUSD(Number(form.packagingPrice||0), form.packagingCurrency);
    const accessoryUSD = form.accessories.reduce((s,a) => s + toUSD(Number(a.qty||0)*Number(a.price||0), a.currency), 0);
    const processUSD   = form.processes.reduce((s,p) => s + toUSD(Number(p.price||0), p.currency), 0);
    const rawUSD       = fabricUSD + garniUSD + labelUSD + packagingUSD + accessoryUSD + processUSD;
    const ovh = 1 + (Number(form.overhead||0)/100);
    const mrg = 1 + (Number(form.margin||0)/100);
    const com = 1 + (Number(form.commission||0)/100);
    const fobUSD = rawUSD * ovh * mrg * com;
    const freightUSD   = toUSD(Number(form.freightEur||0), 'EUR');
    const insuranceUSD = toUSD(Number(form.insuranceEur||0), 'EUR');
    const cifUSD     = fobUSD + freightUSD + insuranceUSD;
    const displayUSD = form.deliveryType === 'FOB' ? fobUSD : cifUSD;
    const quotedUSD  = toUSD(Number(form.quotedPrice||0), form.quotedCurrency);
    const profitUSD  = quotedUSD - displayUSD;
    const profitPct  = displayUSD > 0 ? (profitUSD/displayUSD)*100 : 0;
    const totalUSD   = quotedUSD * Number(form.totalPcs||0);
    return { fabricUSD, garniUSD, labelUSD, accessoryUSD, processUSD, rawUSD, fobUSD, cifUSD, displayUSD, quotedUSD, profitUSD, profitPct, totalUSD };
  }, [form, toUSD]);

  const setField     = (k,v) => setForm(f => ({...f, [k]: v}));
  const setGarni     = (id,k,v) => setForm(f => ({...f, garnis:      f.garnis.map(g      => g.id===id ? {...g,[k]:v} : g)}));
  const setAccessory = (id,k,v) => setForm(f => ({...f, accessories: f.accessories.map(a => a.id===id ? {...a,[k]:v} : a)}));
  const setProcess   = (id,k,v) => setForm(f => ({...f, processes:   f.processes.map(p   => p.id===id ? {...p,[k]:v} : p)}));
  const addGarni     = () => setForm(f => ({...f, garnis:      [...f.garnis,      emptyGarni()]}));
  const addAccessory = () => setForm(f => ({...f, accessories: [...f.accessories, emptyAccessory()]}));
  const addProcess   = () => setForm(f => ({...f, processes:   [...f.processes,   emptyProcess()]}));
  const removeGarni     = (id) => setForm(f => ({...f, garnis:      f.garnis.filter(g      => g.id!==id)}));
  const removeAccessory = (id) => setForm(f => ({...f, accessories: f.accessories.filter(a => a.id!==id)}));
  const removeProcess   = (id) => setForm(f => ({...f, processes:   f.processes.filter(p   => p.id!==id)}));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        customer: form.customer, article: form.article, model: form.model,
        season: form.season, total_pcs: Number(form.totalPcs||0),
        cost_items: {
          fabric:      { kind: form.fabricKind, qty: form.fabricQty, price: form.fabricPrice, currency: form.fabricCurrency },
          garnis:      form.garnis,
          label:       { price: form.labelPrice, currency: form.labelCurrency },
          packaging:   { price: form.packagingPrice, currency: form.packagingCurrency },
          accessories: form.accessories,
          processes:   form.processes,
        },
        overhead_pct:    Number(form.overhead||0),
        margin_pct:      Number(form.margin||0),
        commission_pct:  Number(form.commission||0),
        freight_usd:     toUSD(Number(form.freightEur||0), 'EUR'),
        insurance_usd:   toUSD(Number(form.insuranceEur||0), 'EUR'),
        delivery_type:   form.deliveryType,
        fob_usd:         calc.fobUSD,
        cif_usd:         calc.cifUSD,
        quoted_price:    Number(form.quotedPrice||0),
        quoted_currency: form.quotedCurrency,
        rates:           rates,
        updated_at:      new Date().toISOString(),
      };
      if (activeId) {
        const {error} = await supabase.from('quotations').update(payload).eq('id', activeId);
        if (error) throw error;
      } else {
        const {data, error} = await supabase.from('quotations').insert([payload]).select();
        if (error) throw error;
        if (data?.[0]) setActiveId(data[0].id);
      }
      setSaveMsg('Kaydedildi ✓');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { alert('Kayıt hatası: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleNew = () => { setForm(emptyForm()); setActiveId(null); };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-32 space-y-5">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Calculator size={20}/></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              {activeId ? 'Teklif Güncelle' : 'Yeni Teklif'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">Maliyet & Quotation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-2.5 shadow-sm">
            <div>
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kur {ratesDate && `· ${ratesDate}`}</div>
              <div className="flex gap-3 mt-0.5">
                <span className="text-[11px] font-black text-slate-700">$1=<span className="text-emerald-600">₺{fmtC(rates.TRY)}</span></span>
                <span className="text-slate-200">|</span>
                <span className="text-[11px] font-black text-slate-700">€1=<span className="text-blue-600">${fmtC(1/rates.EUR,4)}</span></span>
              </div>
            </div>
            <button onClick={fetchRates} disabled={ratesLoading} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-100">
              <RefreshCcw size={13} className={ratesLoading ? 'animate-spin text-blue-600' : 'text-slate-400'}/>
            </button>
          </div>
          <button onClick={handleNew} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
            <Plus size={14}/> Yeni
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all">
            <Save size={14}/>{saving ? 'Kaydediliyor...' : saveMsg || 'Kaydet'}
          </button>
        </div>
      </div>

      {/* TEMEL BİLGİLER */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle>Teklif Bilgileri</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Müşteri</label>
            <input type="text" value={form.customer} onChange={e => setField('customer', e.target.value)} placeholder="Müşteri adı" className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Artikel</label>
            <input type="text" value={form.article} onChange={e => setField('article', e.target.value)} placeholder="Artikel no" className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Model</label>
            <input type="text" value={form.model} onChange={e => setField('model', e.target.value)} placeholder="Model adı" className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sezon</label>
            <input type="text" value={form.season} onChange={e => setField('season', e.target.value)} placeholder="SS26" className={iCls}/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Toplam Adet (Bilgi)</label>
            <input type="text" inputMode="decimal" value={form.totalPcs} onChange={e => setField('totalPcs', sanitize(e.target.value))} placeholder="0" className={numCls}/>
          </div>
        </div>
      </div>

      {/* KUMAŞ */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle color="bg-blue-600">Kumaş Giderleri</SectionTitle>
        <div className="mb-5">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ana Kumaş</div>
          <div className="grid grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Cinsi</label>
              <input type="text" value={form.fabricKind} onChange={e => setField('fabricKind', e.target.value)} placeholder="Süprem" className={iCls}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Miktar (Kg/Mt)</label>
              <input type="text" inputMode="decimal" value={form.fabricQty} onChange={e => setField('fabricQty', sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.000" className={numCls}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Fiyat</label>
              <input type="text" inputMode="decimal" value={form.fabricPrice} onChange={e => setField('fabricPrice', sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Döviz</label>
              <CurrencySelect value={form.fabricCurrency} onChange={v => setField('fabricCurrency', v)}/>
            </div>
          </div>
          {form.fabricQty && form.fabricPrice && (
            <div className="mt-1.5 text-[10px] font-black text-blue-600 ml-1">
              = ${fmtC(toUSD(Number(form.fabricQty)*Number(form.fabricPrice), form.fabricCurrency))} / adet
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Garni Kumaşlar</div>
            <button onClick={addGarni} className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1">
              <Plus size={10}/> Garni Ekle
            </button>
          </div>
          <div className="space-y-2">
            {form.garnis.map((g, i) => (
              <div key={g.id} className="grid grid-cols-4 gap-3 items-end bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Garni {i+1} Cinsi</label>
                  <input type="text" value={g.kind} onChange={e => setGarni(g.id,'kind',e.target.value)} placeholder="Cinsi" className={iCls}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Miktar</label>
                  <input type="text" inputMode="decimal" value={g.qty} onChange={e => setGarni(g.id,'qty',sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.000" className={numCls}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Fiyat</label>
                  <input type="text" inputMode="decimal" value={g.price} onChange={e => setGarni(g.id,'price',sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls}/>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Döviz</label>
                    <CurrencySelect value={g.currency} onChange={v => setGarni(g.id,'currency',v)}/>
                  </div>
                  {form.garnis.length > 1 && (
                    <button onClick={() => removeGarni(g.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 mb-0.5"><Trash2 size={13}/></button>
                  )}
                </div>
                {g.qty && g.price && (
                  <div className="col-span-4 text-[10px] font-black text-blue-600 ml-1 -mt-1">
                    = ${fmtC(toUSD(Number(g.qty)*Number(g.price), g.currency))} / adet
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ETİKET & AKSESUAR */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle color="bg-purple-500">Etiket & Aksesuar</SectionTitle>
        <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Etiket + Karton */}
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Etiket + Karton Etiket (Birim)</div>
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Fiyat</label>
                <input type="text" inputMode="decimal" value={form.labelPrice} onChange={e => setField('labelPrice', sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls}/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Döviz</label>
                <CurrencySelect value={form.labelCurrency} onChange={v => setField('labelCurrency', v)}/>
              </div>
            </div>
            {form.labelPrice && (
              <div className="mt-1.5 text-[10px] font-black text-purple-600 ml-1">
                = ${fmtC(toUSD(Number(form.labelPrice), form.labelCurrency))} / adet
              </div>
            )}
          </div>

          {/* Poşet / Koli / Ambalaj */}
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Poşet / Koli / Ambalaj (Birim)</div>
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Fiyat</label>
                <input type="text" inputMode="decimal" value={form.packagingPrice} onChange={e => setField('packagingPrice', sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls}/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Döviz</label>
                <CurrencySelect value={form.packagingCurrency} onChange={v => setField('packagingCurrency', v)}/>
              </div>
            </div>
            {form.packagingPrice && (
              <div className="mt-1.5 text-[10px] font-black text-purple-600 ml-1">
                = ${fmtC(toUSD(Number(form.packagingPrice), form.packagingCurrency))} / adet
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Aksesuarlar</div>
            <button onClick={addAccessory} className="text-[9px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1">
              <Plus size={10}/> Aksesuar Ekle
            </button>
          </div>
          {form.accessories.length === 0 && <p className="text-[10px] text-slate-300 font-bold italic ml-1">Aksesuar eklenmedi</p>}
          <div className="space-y-2">
            {form.accessories.map(a => (
              <div key={a.id} className="grid grid-cols-5 gap-3 items-end bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Aksesuar Adı</label>
                  <input type="text" value={a.label} onChange={e => setAccessory(a.id,'label',e.target.value)} placeholder="Fermuar, düğme..." className={iCls}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Adet/Birim</label>
                  <input type="text" inputMode="decimal" value={a.qty} onChange={e => setAccessory(a.id,'qty',sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="1" className={numCls}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Birim Fiyat</label>
                  <input type="text" inputMode="decimal" value={a.price} onChange={e => setAccessory(a.id,'price',sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls}/>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Döviz</label>
                    <CurrencySelect value={a.currency} onChange={v => setAccessory(a.id,'currency',v)}/>
                  </div>
                  <button onClick={() => removeAccessory(a.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 mb-0.5"><Trash2 size={13}/></button>
                </div>
                {a.qty && a.price && (
                  <div className="col-span-5 text-[10px] font-black text-purple-600 ml-1 -mt-1">
                    = ${fmtC(toUSD(Number(a.qty)*Number(a.price), a.currency))} / adet
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* İŞÇİLİK */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle color="bg-amber-500"
          action={
            <button onClick={addProcess} className="text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 hover:bg-amber-600 hover:text-white transition-all flex items-center gap-1">
              <Plus size={10}/> İşlem Ekle
            </button>
          }
        >İşçilik & İşlemler</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {form.processes.map(p => (
            <div key={p.id} className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <input value={p.label} onChange={e => setProcess(p.id,'label',e.target.value)}
                  className="text-[10px] font-black text-slate-600 bg-transparent outline-none flex-1 tracking-wide"/>
                {!PROCESS_ITEMS_DEFAULT.find(d => d.id === p.id) && (
                  <button onClick={() => removeProcess(p.id)} className="p-1 text-slate-200 hover:text-red-500 transition-colors rounded"><Trash2 size={11}/></button>
                )}
              </div>
              <div className="flex gap-2">
                <input type="text" inputMode="decimal" value={p.price} onChange={e => setProcess(p.id,'price',sanitize(e.target.value))} onFocus={e=>e.target.select()} placeholder="0.0000" className={numCls + ' flex-1'}/>
                <CurrencySelect value={p.currency} onChange={v => setProcess(p.id,'currency',v)}/>
              </div>
              {p.price && (
                <div className="text-[9px] font-black text-amber-600">= ${fmtC(toUSD(Number(p.price), p.currency))} / adet</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* GENEL GİDER */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle color="bg-emerald-500">Genel Gider & Kar & Komisyon</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Genel Gider (%)', key: 'overhead',   color: 'text-amber-600' },
            { label: 'Kar Marjı (%)',   key: 'margin',     color: 'text-emerald-600' },
            { label: 'Komisyon (%)',    key: 'commission', color: 'text-purple-600' },
          ].map(({ label, key, color }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
              <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden h-10">
                <input type="text" inputMode="decimal" value={form[key]}
                  onChange={e => setField(key, sanitize(e.target.value))}
                  onFocus={e=>e.target.select()} placeholder="0"
                  className="flex-1 px-3 bg-transparent outline-none text-sm font-black"/>
                <div className={`px-3 flex items-center text-[11px] font-black ${color} bg-white border-l border-slate-200`}>%</div>
              </div>
            </div>
          ))}
        </div>
        {calc.rawUSD > 0 && (
          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Ham Maliyet', value: `$${fmtC(calc.rawUSD)}` },
              { label: 'FOB Maliyet', value: `$${fmtC(calc.fobUSD)}` },
              { label: 'FOB (EUR)',   value: `€${fmtC(fromUSD(calc.fobUSD,'EUR'))}` },
              { label: 'FOB (TRY)',   value: `₺${fmtC(fromUSD(calc.fobUSD,'TRY'))}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                <div className="text-sm font-black text-slate-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOB / CIF */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <SectionTitle color="bg-indigo-500">Teslim Şekli</SectionTitle>
        <div className="flex gap-3 mb-5">
          {['FOB','CIF'].map(type => (
            <button key={type} onClick={() => setField('deliveryType', type)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest border transition-all ${
                form.deliveryType === type ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}>
              {type === 'FOB' ? <Anchor size={14}/> : <Ship size={14}/>} {type}
            </button>
          ))}
        </div>

        {form.deliveryType === 'CIF' && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-5">
            {[
              { label: 'Navlun (EUR/adet)', key: 'freightEur' },
              { label: 'Sigorta (EUR/adet)', key: 'insuranceEur' },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">{label}</label>
                <div className="flex bg-white rounded-xl border border-indigo-200 overflow-hidden h-10">
                  <div className="px-3 flex items-center text-[11px] font-black text-indigo-400 bg-indigo-50 border-r border-indigo-200">€</div>
                  <input type="text" inputMode="decimal" value={form[key]}
                    onChange={e => setField(key, sanitize(e.target.value))}
                    onFocus={e=>e.target.select()} placeholder="0.000"
                    className="flex-1 px-3 bg-transparent outline-none text-sm font-black"/>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: `${form.deliveryType} (USD)`, symbol: '$', value: calc.displayUSD,                 color: 'text-slate-900', bg: 'bg-slate-50' },
            { label: `${form.deliveryType} (EUR)`, symbol: '€', value: fromUSD(calc.displayUSD,'EUR'), color: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: `${form.deliveryType} (TRY)`, symbol: '₺', value: fromUSD(calc.displayUSD,'TRY'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, symbol, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-4 border border-slate-100 text-center`}>
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
              <div className={`text-xl font-black ${color}`}>{symbol}{fmtC(value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MÜŞTERİYE VERİLEN FİYAT */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/10">
          <DollarSign size={16} className="text-blue-400"/>
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Müşteriye Verilen Fiyat</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Fiyatı (Birim)</label>
            <div className="flex bg-white/10 rounded-2xl border border-white/20 overflow-hidden h-14">
              <select value={form.quotedCurrency} onChange={e => setField('quotedCurrency', e.target.value)}
                className="bg-white/10 border-r border-white/20 px-3 text-[11px] font-black text-white outline-none cursor-pointer">
                {CURRENCIES.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
              </select>
              <input type="text" inputMode="decimal" value={form.quotedPrice}
                onChange={e => setField('quotedPrice', sanitize(e.target.value))}
                onFocus={e=>e.target.select()} placeholder="0.0000"
                className="flex-1 px-4 bg-transparent outline-none text-xl font-black text-white placeholder-white/30"/>
            </div>
            <div className="flex gap-3 text-[10px] font-black text-slate-500">
              <span>= ${fmtC(calc.quotedUSD)}</span>
              <span>= €{fmtC(fromUSD(calc.quotedUSD,'EUR'))}</span>
              <span>= ₺{fmtC(fromUSD(calc.quotedUSD,'TRY'))}</span>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kar / Zarar ({form.deliveryType} Baz)</label>
            <div className={`rounded-2xl p-4 border ${calc.profitUSD > 0 ? 'bg-emerald-600/20 border-emerald-500/30' : calc.profitUSD < 0 ? 'bg-red-600/20 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-black ${calc.profitUSD > 0 ? 'text-emerald-400' : calc.profitUSD < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {calc.profitUSD >= 0 ? '+' : ''}${fmtC(calc.profitUSD)}
                  </div>
                  <div className={`text-[11px] font-black mt-0.5 ${calc.profitUSD > 0 ? 'text-emerald-400' : calc.profitUSD < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {calc.profitPct >= 0 ? '+' : ''}{fmtC(calc.profitPct,1)}%
                  </div>
                </div>
                {calc.profitUSD > 0 ? <TrendingUp size={32} className="text-emerald-400 opacity-60"/> : calc.profitUSD < 0 ? <TrendingDown size={32} className="text-red-400 opacity-60"/> : null}
              </div>
            </div>
          </div>
        </div>
        {Number(form.totalPcs) > 0 && calc.quotedUSD > 0 && (
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-3 gap-4">
            {[
              { label: 'Toplam (USD)', value: `$${fmtC(calc.totalUSD)}` },
              { label: 'Toplam (EUR)', value: `€${fmtC(fromUSD(calc.totalUSD,'EUR'))}` },
              { label: 'Toplam (TRY)', value: `₺${fmtC(fromUSD(calc.totalUSD,'TRY'))}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-lg font-black text-white">{value}</div>
                <div className="text-[9px] text-slate-500 font-bold mt-0.5">{Number(form.totalPcs).toLocaleString()} adet</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}