import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../api/supabaseClient';
import { Clock, Search, ChevronDown, ChevronUp, DollarSign, Package, Scissors, Tag, Layers, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';

const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const sym = { USD: '$', EUR: '€', TRY: '₺' };

const Row = ({ label, valueUSD, rates, color = 'text-slate-700' }) => {
  if (!valueUSD) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
      <div className="flex items-center gap-4">
        <span className={`text-xs font-black ${color}`}>${fmtC(valueUSD)}</span>
        <span className="text-[10px] font-black text-blue-500">€{fmtC(valueUSD * (rates?.EUR || 1))}</span>
        <span className="text-[10px] font-black text-emerald-600">₺{fmtC(valueUSD * (rates?.TRY || 1))}</span>
      </div>
    </div>
  );
};

const Section = ({ icon: Icon, title, color, children }) => (
  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
    <div className={`px-4 py-3 flex items-center gap-2 border-b border-slate-50 ${color}`}>
      <Icon size={14}/>
      <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
    </div>
    <div className="px-4 py-2">{children}</div>
  </div>
);

function QuotationDetail({ q }) {
  const ci   = q.cost_items || {};
  const r    = q.rates || { USD: 1, EUR: 1, TRY: 1 };

  const toUSD = (amount, currency) => {
    const n = Number(amount || 0);
    if (!n) return 0;
    if (currency === 'USD') return n;
    if (currency === 'EUR') return n / r.EUR;
    if (currency === 'TRY') return n / r.TRY;
    return 0;
  };

  const fabricUSD    = toUSD(Number(ci.fabric?.qty || 0) * Number(ci.fabric?.price || 0), ci.fabric?.currency);
  const garniUSD     = (ci.garnis || []).reduce((s, g) => s + toUSD(Number(g.qty||0)*Number(g.price||0), g.currency), 0);
  const labelUSD     = toUSD(Number(ci.label?.price || 0), ci.label?.currency);
  const packagingUSD = toUSD(Number(ci.packaging?.price || 0), ci.packaging?.currency);
  const accessoryUSD = (ci.accessories || []).reduce((s, a) => s + toUSD(Number(a.qty||0)*Number(a.price||0), a.currency), 0);
  const processUSD   = (ci.processes || []).reduce((s, p) => s + toUSD(Number(p.price||0), p.currency), 0);
  const rawUSD       = fabricUSD + garniUSD + labelUSD + packagingUSD + accessoryUSD + processUSD;

  const quotedUSD    = toUSD(Number(q.quoted_price || 0), q.quoted_currency);
  const displayUSD   = q.delivery_type === 'FOB' ? q.fob_usd : q.cif_usd;
  const profitUSD    = quotedUSD - (displayUSD || 0);
  const profitPct    = displayUSD > 0 ? (profitUSD / displayUSD) * 100 : 0;

  return (
    <div className="space-y-3 mt-4">
      {/* Özet Başlık */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ham Maliyet', value: `$${fmtC(rawUSD)}`, bg: 'bg-slate-50', color: 'text-slate-900' },
          { label: `${q.delivery_type} USD`, value: `$${fmtC(displayUSD)}`, bg: 'bg-blue-50', color: 'text-blue-700' },
          { label: `${q.delivery_type} EUR`, value: `€${fmtC((displayUSD||0) * r.EUR)}`, bg: 'bg-indigo-50', color: 'text-indigo-700' },
          { label: `${q.delivery_type} TRY`, value: `₺${fmtC((displayUSD||0) * r.TRY)}`, bg: 'bg-emerald-50', color: 'text-emerald-700' },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center border border-white`}>
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
            <div className={`text-sm font-black ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Kumaş */}
      {(fabricUSD > 0 || garniUSD > 0) && (
        <Section icon={Layers} title="Kumaş Giderleri" color="text-blue-600 bg-blue-50">
          {ci.fabric?.kind && ci.fabric?.price && (
            <div className="py-2 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{ci.fabric.kind} — Ana Kumaş</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">{ci.fabric.qty} kg/mt × {ci.fabric.price} {ci.fabric.currency}</span>
                </div>
                <span className="text-xs font-black text-blue-600">${fmtC(fabricUSD)}</span>
              </div>
            </div>
          )}
          {(ci.garnis || []).filter(g => g.price).map((g, i) => (
            <div key={i} className="py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{g.kind || `Garni ${i+1}`}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">{g.qty} × {g.price} {g.currency}</span>
                </div>
                <span className="text-xs font-black text-blue-600">${fmtC(toUSD(Number(g.qty||0)*Number(g.price||0), g.currency))}</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Etiket & Aksesuar */}
      {(labelUSD > 0 || packagingUSD > 0 || accessoryUSD > 0) && (
        <Section icon={Tag} title="Etiket & Aksesuar" color="text-purple-600 bg-purple-50">
          {ci.label?.price && (
            <div className="py-2 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-700 uppercase">Etiket + Karton Etiket</span>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-400 font-bold">{ci.label.price} {ci.label.currency}/adet</span>
                  <span className="text-xs font-black text-purple-600">${fmtC(labelUSD)}</span>
                </div>
              </div>
            </div>
          )}
          {ci.packaging?.price && (
            <div className="py-2 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-700 uppercase">Poşet / Koli / Ambalaj</span>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-400 font-bold">{ci.packaging.price} {ci.packaging.currency}/adet</span>
                  <span className="text-xs font-black text-purple-600">${fmtC(packagingUSD)}</span>
                </div>
              </div>
            </div>
          )}
          {(ci.accessories || []).filter(a => a.price).map((a, i) => (
            <div key={i} className="py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{a.label || `Aksesuar ${i+1}`}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">{a.qty} × {a.price} {a.currency}</span>
                </div>
                <span className="text-xs font-black text-purple-600">${fmtC(toUSD(Number(a.qty||0)*Number(a.price||0), a.currency))}</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* İşlemler */}
      {processUSD > 0 && (
        <Section icon={Scissors} title="İşçilik & İşlemler" color="text-amber-600 bg-amber-50">
          {(ci.processes || []).filter(p => p.price).map((p, i) => (
            <div key={i} className="py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-700 uppercase">{p.label}</span>
                  <span className="text-[9px] text-slate-400 font-bold ml-2">{p.price} {p.currency}/adet</span>
                </div>
                <span className="text-xs font-black text-amber-600">${fmtC(toUSD(Number(p.price||0), p.currency))}</span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Oranlar */}
      <Section icon={Package} title="Genel Gider & Kar & Komisyon" color="text-slate-600 bg-slate-50">
        {[
          { label: 'Genel Gider', value: q.overhead_pct, color: 'text-amber-600' },
          { label: 'Kar Marjı',   value: q.margin_pct,   color: 'text-emerald-600' },
          { label: 'Komisyon',    value: q.commission_pct,color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
            <span className={`text-sm font-black ${color}`}>%{fmtC(value, 1)}</span>
          </div>
        ))}
        {(q.freight_usd > 0 || q.insurance_usd > 0) && (
          <>
            {q.freight_usd   > 0 && <div className="flex items-center justify-between py-2 border-b border-slate-50"><span className="text-[10px] font-bold text-slate-400 uppercase">Navlun</span><span className="text-sm font-black text-indigo-600">€{fmtC(q.freight_usd / (r.EUR||1))}/adet</span></div>}
            {q.insurance_usd > 0 && <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Sigorta</span><span className="text-sm font-black text-indigo-600">€{fmtC(q.insurance_usd / (r.EUR||1))}/adet</span></div>}
          </>
        )}
      </Section>

      {/* Teklif & Kar/Zarar */}
      {q.quoted_price > 0 && (
        <div className={`rounded-2xl p-5 border ${profitUSD >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Müşteriye Verilen Fiyat ({q.delivery_type})</div>
              <div className="text-xl font-black text-slate-900">{sym[q.quoted_currency]}{fmtC(q.quoted_price)} / adet</div>
              <div className="flex gap-3 mt-1 text-[10px] font-black text-slate-500">
                <span>= ${fmtC(quotedUSD)}</span>
                <span>= €{fmtC(quotedUSD * r.EUR)}</span>
                <span>= ₺{fmtC(quotedUSD * r.TRY)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black ${profitUSD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {profitUSD >= 0 ? '+' : ''}${fmtC(profitUSD)}
              </div>
              <div className={`text-sm font-black ${profitUSD >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {profitPct >= 0 ? '+' : ''}{fmtC(profitPct, 1)}%
              </div>
              {profitUSD >= 0 ? <TrendingUp size={20} className="text-emerald-400 ml-auto mt-1"/> : <TrendingDown size={20} className="text-red-400 ml-auto mt-1"/>}
            </div>
          </div>
          {q.total_pcs > 0 && (
            <div className="mt-3 pt-3 border-t border-white/60 grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Toplam (USD)', value: `$${fmtC(quotedUSD * q.total_pcs)}` },
                { label: 'Toplam (EUR)', value: `€${fmtC(quotedUSD * r.EUR * q.total_pcs)}` },
                { label: 'Toplam (TRY)', value: `₺${fmtC(quotedUSD * r.TRY * q.total_pcs)}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
                  <div className="text-sm font-black text-slate-800 mt-0.5">{value}</div>
                  <div className="text-[9px] text-slate-400">{q.total_pcs?.toLocaleString()} adet</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kur Bilgisi */}
      <div className="text-[9px] font-bold text-slate-300 uppercase text-right">
        Hesaplama kuru: $1=₺{fmtC(r.TRY)} | €1=${fmtC(1/r.EUR, 4)}
      </div>
    </div>
  );
}

export default function QuotationHistory() {
  const [list, setList]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bu teklifi silmek istediğinize emin misiniz?')) return;
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) { alert('Silme hatası: ' + error.message); return; }
    if (expandedId === id) setExpandedId(null);
    load();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLocaleLowerCase('tr-TR');
    return list.filter(h =>
      (h.customer || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (h.article  || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (h.model    || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (h.season   || '').toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [list, search]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5 pb-32">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><Clock size={20}/></div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Teklif Geçmişi</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">{list.length} Kayıtlı Teklif</p>
          </div>
        </div>
      </div>

      {/* ARAMA */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm relative">
        <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Müşteri, artikel, model veya sezon ara..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-[11px] font-bold"/>
      </div>

      {/* LİSTE */}
      {loading ? (
        <div className="text-center py-20 text-slate-300 font-black text-[10px] uppercase animate-pulse">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-200 font-black text-[10px] uppercase">Kayıt bulunamadı</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const isOpen = expandedId === q.id;
            const displayUSD = q.delivery_type === 'FOB' ? q.fob_usd : q.cif_usd;
            const r = q.rates || { USD: 1, EUR: 1, TRY: 1 };
            const quotedUSD = q.quoted_price ? (q.quoted_currency === 'USD' ? q.quoted_price : q.quoted_currency === 'EUR' ? q.quoted_price / r.EUR : q.quoted_price / r.TRY) : 0;
            const profitUSD = quotedUSD - (displayUSD || 0);

            return (
              <div key={q.id} className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="flex items-start">
                <button
                  onClick={() => setExpandedId(isOpen ? null : q.id)}
                  className="flex-1 p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-slate-900 text-base uppercase">{q.article || '—'}</span>
                      {q.customer && <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 uppercase">{q.customer}</span>}
                      {q.season   && <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">{q.season}</span>}
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${q.delivery_type === 'FOB' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                        {q.delivery_type}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{q.model}</div>
                    <div className="text-[9px] text-slate-300 font-bold mt-0.5">
                      {new Date(q.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 ml-4">
                    <div className="text-right">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{q.delivery_type} Maliyet</div>
                      <div className="text-sm font-black text-slate-900">${fmtC(displayUSD)}</div>
                    </div>
                    {q.quoted_price > 0 && (
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verilen Fiyat</div>
                        <div className="text-sm font-black text-blue-600">{sym[q.quoted_currency]}{fmtC(q.quoted_price)}</div>
                        <div className={`text-[10px] font-black ${profitUSD >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {profitUSD >= 0 ? '+' : ''}${fmtC(profitUSD)}
                        </div>
                      </div>
                    )}
                    {isOpen ? <ChevronUp size={18} className="text-slate-300"/> : <ChevronDown size={18} className="text-slate-300"/>}
                  </div>
                </button>
                <button
                  onClick={(e) => handleDelete(q.id, e)}
                  className="px-4 text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all border-l border-slate-100 shrink-0"
                  title="Sil"
                >
                  <Trash2 size={16}/>
                </button>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-slate-50">
                    <QuotationDetail q={q}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
