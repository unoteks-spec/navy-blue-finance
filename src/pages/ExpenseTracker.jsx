import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../api/supabaseClient';
import { Receipt, Plus, Trash2, Save, Search, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = ['Kumaş', 'Garni', 'Dikim', 'Baskı', 'Nakış', 'Yıkama', 'İlik-Düğme', 'Ütü-Ambalaj', 'Etiket', 'Aksesuar', 'Nakliye', 'Diğer'];

// ✅ Binlik ayraçlı TL formatı
const fmtTRY = (v) => {
  if (!v && v !== 0) return '';
  const num = Number(String(v).replace(/\./g, '').replace(',', '.'));
  if (isNaN(num)) return '';
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Input değerinden sayıya çevir (1.234,56 → 1234.56)
const parseTRY = (v) => {
  const cleaned = String(v).replace(/\./g, '').replace(',', '.');
  return isNaN(Number(cleaned)) ? 0 : Number(cleaned);
};

const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const iCls = 'w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all';

const emptyItem = () => ({ id: Date.now() + Math.random(), category: 'Kumaş', description: '', amount: '' });

const emptyForm = () => ({
  salesOrderId: '',
  model: '', article: '',
  invoiceNo: '', invoiceDate: new Date().toISOString().split('T')[0],
  supplier: '', notes: '',
  items: [emptyItem()],
});

export default function ExpenseTracker() {
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [activeId, setActiveId]   = useState(null);
  const [list, setList]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [salesOrders, setSalesOrders] = useState([]);
  // TL input display değerleri
  const [amountDisplays, setAmountDisplays] = useState({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Sales orders yükle
    supabase.from('sales_orders').select('id, customer, season, items, order_date')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSalesOrders(data || []));
  }, []);

  // Sales order seçilince model ve artikel doldur
  const handleOrderSelect = (orderId) => {
    const order = salesOrders.find(o => o.id === orderId);
    if (!order) {
      setForm(f => ({ ...f, salesOrderId: '', model: '', article: '' }));
      return;
    }
    // İlk artikeli al (birden fazla varsa kullanıcı değiştirebilir)
    const firstItem = order.items?.[0];
    setForm(f => ({
      ...f,
      salesOrderId: orderId,
      model:   firstItem?.model   || '',
      article: firstItem?.article || '',
    }));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLocaleLowerCase('tr-TR');
    return list.filter(e =>
      (e.model      || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (e.article    || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (e.supplier   || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (e.invoice_no || '').toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [list, search]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem  = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }));
  const addItem    = () => {
    const newItem = emptyItem();
    setForm(f => ({ ...f, items: [...f.items, newItem] }));
    setAmountDisplays(d => ({ ...d, [newItem.id]: '' }));
  };
  const removeItem = (id) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
    setAmountDisplays(d => { const nd = {...d}; delete nd[id]; return nd; });
  };

  // TL input handler
  const handleAmountChange = (itemId, rawValue) => {
    // Sadece rakam ve virgül/nokta kabul et
    const cleaned = rawValue.replace(/[^0-9,.]/g, '');
    setAmountDisplays(d => ({ ...d, [itemId]: cleaned }));
    const num = parseTRY(cleaned);
    setItem(itemId, 'amount', num);
  };

  const handleAmountBlur = (itemId, rawValue) => {
    const num = parseTRY(rawValue);
    if (!isNaN(num) && num > 0) {
      setAmountDisplays(d => ({ ...d, [itemId]: fmtTRY(num) }));
    }
  };

  const handleAmountFocus = (itemId, currentDisplay) => {
    // Focus'ta formatı kaldır, düz sayı göster
    const num = parseTRY(currentDisplay);
    setAmountDisplays(d => ({ ...d, [itemId]: num > 0 ? String(num) : '' }));
  };

  const totalTRY = useMemo(() => {
    return form.items.reduce((s, i) => s + Number(i.amount || 0), 0);
  }, [form.items]);

  const handleSave = async () => {
    if (!form.model) { alert('Sipariş seçin veya model adı girin'); return; }
    setSaving(true);
    try {
      const payload = {
        model:        form.model,
        article:      form.article,
        invoice_no:   form.invoiceNo,
        invoice_date: form.invoiceDate,
        supplier:     form.supplier,
        notes:        form.notes,
        currency:     'TRY',
        items:        form.items,
        total_amount: totalTRY,
        updated_at:   new Date().toISOString(),
      };
      if (activeId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', activeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('expenses').insert([payload]).select();
        if (error) throw error;
        if (data?.[0]) setActiveId(data[0].id);
      }
      setSaveMsg('Kaydedildi ✓');
      setTimeout(() => setSaveMsg(''), 2500);
      load();
    } catch (e) { alert('Kayıt hatası: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    if (expandedId === id) setExpandedId(null);
    if (activeId === id) { setForm(emptyForm()); setActiveId(null); }
    load();
  };

  const handleLoad = (exp) => {
    setForm({
      salesOrderId: '',
      model:        exp.model || '',
      article:      exp.article || '',
      invoiceNo:    exp.invoice_no || '',
      invoiceDate:  exp.invoice_date || new Date().toISOString().split('T')[0],
      supplier:     exp.supplier || '',
      notes:        exp.notes || '',
      items:        exp.items?.length ? exp.items : [emptyItem()],
    });
    // Display değerlerini ayarla
    const displays = {};
    (exp.items || []).forEach(i => {
      displays[i.id] = fmtTRY(i.amount);
    });
    setAmountDisplays(displays);
    setActiveId(exp.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNew = () => {
    setForm(emptyForm());
    setAmountDisplays({});
    setActiveId(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-32 space-y-5">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Receipt size={20}/></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              {activeId ? 'Gider Güncelle' : 'Gider Girişi'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">Model Bazlı Maliyet Takibi</p>
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

      {/* FORM */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">

        {/* ✅ Sipariş Seçimi */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
            <div className="w-1.5 h-4 bg-slate-900 rounded-full"></div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Sipariş Seçimi</h2>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sipariş Listesinden Seç</label>
            <select value={form.salesOrderId} onChange={e => handleOrderSelect(e.target.value)}
              className={iCls + ' cursor-pointer'}>
              <option value="">— Sipariş seçin —</option>
              {salesOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.customer}{o.season ? ` · ${o.season}` : ''} — {(o.items || []).map(i => i.article).join(', ')}
                  {o.order_date ? ` (${new Date(o.order_date).toLocaleDateString('tr-TR')})` : ''}
                </option>
              ))}
            </select>
          </div>


        </div>

        {/* Fatura Bilgileri */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Fatura Bilgileri</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tedarikçi</label>
              <input type="text" value={form.supplier} onChange={e => setField('supplier', e.target.value)} placeholder="Tedarikçi adı" className={iCls}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fatura No</label>
              <input type="text" value={form.invoiceNo} onChange={e => setField('invoiceNo', e.target.value)} placeholder="FAT-001" className={iCls}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fatura Tarihi</label>
              <input type="date" value={form.invoiceDate} onChange={e => setField('invoiceDate', e.target.value)} className={iCls}/>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Not</label>
            <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Opsiyonel not" className={iCls + ' mt-1'}/>
          </div>
        </div>

        {/* Kalemler */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Fatura Kalemleri</h2>
              <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">TL</span>
            </div>
            <button onClick={addItem} className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1">
              <Plus size={10}/> Kalem Ekle
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2 px-2 mb-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
            <div className="col-span-3">Kategori</div>
            <div className="col-span-5">Açıklama</div>
            <div className="col-span-3 text-right">Tutar (TL)</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-2">
            {form.items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div className="col-span-3">
                  <select value={item.category} onChange={e => setItem(item.id, 'category', e.target.value)}
                    className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black outline-none cursor-pointer">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-5">
                  <input type="text" value={item.description} onChange={e => setItem(item.id, 'description', e.target.value)}
                    placeholder="Açıklama" className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"/>
                </div>
                <div className="col-span-3">
                  {/* ✅ Binlik ayraçlı TL input */}
                  <div className="flex flex-col gap-1">
                    <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden h-9 focus-within:ring-2 focus-within:ring-amber-200">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amountDisplays[item.id] ?? fmtTRY(item.amount)}
                        onChange={e => handleAmountChange(item.id, e.target.value)}
                        onFocus={e => handleAmountFocus(item.id, e.target.value)}
                        onBlur={e => handleAmountBlur(item.id, e.target.value)}
                        placeholder="0,00"
                        className="flex-1 px-3 bg-transparent outline-none text-sm font-black text-right"
                      />
                      <div className="px-2 flex items-center text-[10px] font-black text-amber-600 bg-amber-50 border-l border-slate-200">₺</div>
                    </div>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-right">KDV Hariç</span>
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Toplam */}
          <div className="mt-4 flex justify-end">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-right">
              <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fatura Toplamı</div>
              <div className="text-lg font-black mt-0.5">₺{fmtTRY(totalTRY)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* GEÇMİŞ KAYITLAR */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Kayıtlı Giderler</h2>
          <span className="text-[10px] font-black text-slate-300">{list.length} kayıt</span>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm relative">
          <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Model, artikel, tedarikçi veya fatura no ara..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-[11px] font-bold"/>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-300 font-black text-[10px] uppercase animate-pulse">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-200 font-black text-[10px] uppercase">Kayıt bulunamadı</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(exp => {
              const isOpen = expandedId === exp.id;
              const total = (exp.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
              return (
                <div key={exp.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center">
                    <button onClick={() => setExpandedId(isOpen ? null : exp.id)}
                      className="flex-1 p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm uppercase">{exp.model}</span>
                          {exp.article && <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">{exp.article}</span>}
                          {exp.supplier && <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{exp.supplier}</span>}
                          {exp.invoice_no && <span className="text-[9px] font-bold text-slate-400">#{exp.invoice_no}</span>}
                        </div>
                        <div className="text-[9px] text-slate-300 font-bold mt-0.5">
                          {exp.invoice_date && new Date(exp.invoice_date).toLocaleDateString('tr-TR')} · {exp.items?.length || 0} kalem
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <div className="text-right">
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Toplam</div>
                          <div className="text-sm font-black text-slate-900">₺{fmtTRY(total)}</div>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                      </div>
                    </button>
                    <div className="flex border-l border-slate-100">
                      <button onClick={() => handleLoad(exp)} className="px-3 py-4 text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all" title="Düzenle">
                        <Save size={15}/>
                      </button>
                      <button onClick={(e) => handleDelete(exp.id, e)} className="px-3 py-4 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all border-l border-slate-100" title="Sil">
                        <Trash2 size={15}/>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-50">
                      <div className="mt-3 space-y-1">
                        {(exp.items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 uppercase">{item.category}</span>
                              <span className="text-[11px] font-bold text-slate-600">{item.description || '—'}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900">₺{fmtTRY(Number(item.amount || 0))}</span>
                          </div>
                        ))}
                      </div>
                      {exp.notes && <div className="mt-3 text-[10px] font-bold text-slate-400 italic">Not: {exp.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}