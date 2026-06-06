import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../api/supabaseClient';
import { List, Search, ChevronDown, ChevronUp, Trash2, Edit3, CheckCircle, Clock } from 'lucide-react';

const fmtC = (n, d = 2) => (isNaN(n) || !n) ? '—' : Number(n).toFixed(d);
const sym = { USD: '$', EUR: '€', TRY: '₺' };

export default function SalesOrderList({ onEdit }) {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('sales_orders').select('*').order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLocaleLowerCase('tr-TR');
    return list.filter(o =>
      (o.customer || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (o.season   || '').toLocaleLowerCase('tr-TR').includes(q) ||
      (o.items || []).some(i =>
        (i.article || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (i.model   || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    );
  }, [list, search]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
    await supabase.from('sales_orders').delete().eq('id', id);
    if (expandedId === id) setExpandedId(null);
    load();
  };

  const handleStatusToggle = async (order, e) => {
    e.stopPropagation();
    const newStatus = order.status === 'completed' ? 'active' : 'completed';
    await supabase.from('sales_orders').update({ status: newStatus }).eq('id', order.id);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-32 space-y-5">

      {/* BAŞLIK */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-900 rounded-xl text-white shadow-lg"><List size={20}/></div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Sipariş Listesi</h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-0.5">{list.length} Sipariş</p>
        </div>
      </div>

      {/* ARAMA */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm relative">
        <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Müşteri, artikel veya model ara..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl outline-none text-[11px] font-bold"/>
      </div>

      {/* LİSTE */}
      {loading ? (
        <div className="text-center py-16 text-slate-300 font-black text-[10px] uppercase animate-pulse">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-200 font-black text-[10px] uppercase">Sipariş bulunamadı</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const isOpen = expandedId === order.id;
            const isCompleted = order.status === 'completed';
            const totalQty = (order.items || []).reduce((s, i) => s + Number(i.orderQty || 0), 0);
            const effectiveQty = (order.items || []).reduce((s, i) => s + Number(i.effectiveQty || 0), 0);

            return (
              <div key={order.id} className={`bg-white border rounded-3xl shadow-sm overflow-hidden ${isCompleted ? 'border-emerald-100' : 'border-slate-100'}`}>
                <div className="flex items-center">
                  <button onClick={() => setExpandedId(isOpen ? null : order.id)}
                    className="flex-1 p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-slate-900 text-base uppercase">{order.customer}</span>
                        {order.season && <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">{order.season}</span>}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1 ${isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                          {isCompleted ? <CheckCircle size={9}/> : <Clock size={9}/>}
                          {isCompleted ? 'Tamamlandı' : 'Aktif'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-[9px] text-slate-400 font-bold">
                        <span>{(order.items || []).length} artikel</span>
                        {order.order_date && <span>{new Date(order.order_date).toLocaleDateString('tr-TR')}</span>}
                        {order.due_date && <span>Termin: {new Date(order.due_date).toLocaleDateString('tr-TR')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0 ml-4">
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase">Sipariş</div>
                        <div className="text-sm font-black text-slate-900">{totalQty.toLocaleString()} adet</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-black text-slate-400 uppercase">Efektif</div>
                        <div className="text-sm font-black text-blue-600">{effectiveQty.toLocaleString()} adet</div>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                    </div>
                  </button>

                  <div className="flex border-l border-slate-100">
                    <button onClick={(e) => handleStatusToggle(order, e)}
                      className={`px-3 py-5 transition-all border-l border-slate-100 ${isCompleted ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                      title={isCompleted ? 'Aktife al' : 'Tamamlandı işaretle'}>
                      <CheckCircle size={15}/>
                    </button>
                    <button onClick={() => onEdit && onEdit(order)}
                      className="px-3 py-5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all border-l border-slate-100"
                      title="Düzenle">
                      <Edit3 size={15}/>
                    </button>
                    <button onClick={(e) => handleDelete(order.id, e)}
                      className="px-3 py-5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all border-l border-slate-100"
                      title="Sil">
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-slate-50">
                    <div className="mt-3 space-y-2">
                      {/* Başlık */}
                      <div className="grid grid-cols-5 gap-2 px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="col-span-2">Artikel / Model</div>
                        <div className="text-right">Birim Fiyat</div>
                        <div className="text-right">Sipariş Adedi</div>
                        <div className="text-right">Efektif Adet</div>
                      </div>
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="grid grid-cols-5 gap-2 items-center py-2.5 px-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="col-span-2">
                            <div className="text-xs font-black text-slate-900 uppercase">{item.article}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{item.model}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-blue-600">{sym[item.currency]}{fmtC(item.unitPrice)}</span>
                            <span className="text-[8px] text-slate-400 font-bold ml-1">{item.deliveryType}</span>
                          </div>
                          <div className="text-right font-black text-sm text-slate-900">{Number(item.orderQty || 0).toLocaleString()}</div>
                          <div className="text-right">
                            <span className="font-black text-sm text-emerald-600">{Number(item.effectiveQty || 0).toLocaleString()}</span>
                            <span className="text-[9px] text-slate-400 ml-1">+%{item.cuttingPct}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.notes && <div className="mt-3 text-[10px] font-bold text-slate-400 italic">Not: {order.notes}</div>}
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