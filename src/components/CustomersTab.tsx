import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Customer } from '../types';
import { Search, UserRound } from 'lucide-react';
import { toSearchValue } from '../utils/search';
import { customerOrderHistory } from '../utils/customers';

export const CustomersTab = () => {
  const { customers, setCustomers, orders, sales, t, formatPrice } = useApp();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = toSearchValue(q);
    if (!needle) return customers;
    return customers.filter(
      c =>
        toSearchValue(c.name).includes(needle) ||
        toSearchValue(c.phone).includes(needle) ||
        toSearchValue(c.notes || '').includes(needle) ||
        toSearchValue(c.allergies || '').includes(needle)
    );
  }, [customers, q]);

  const selected = customers.find(c => c.id === selectedId) || filtered[0] || null;
  const history = selected ? customerOrderHistory(selected, orders, sales) : null;

  const patch = (id: string, patch: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-4 animate-fade-in pb-8 max-w-full">
      <div>
        <h2 className="text-lg font-bold font-serif text-bakery-brown">{t('customersTab')}</h2>
        <p className="text-xs text-bakery-brown/50">{t('noCustomers')}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={16} />
        <input
          className="w-full pl-9 pr-3 py-2.5 border border-bakery-beige rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
          placeholder={t('searchCustomers')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {customers.length === 0 ? (
        <div className="card-bakery p-10 text-center text-bakery-brown/50 text-sm">{t('noCustomers')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <ul className="card-bakery divide-y divide-bakery-beige max-h-[560px] overflow-y-auto">
            {filtered.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-3 hover:bg-bakery-cream/40 ${
                    selected?.id === c.id ? 'bg-bakery-beige/50' : ''
                  }`}
                >
                  <p className="font-bold text-sm truncate">{c.name}</p>
                  <p className="text-xs text-bakery-brown/50">{c.phone}</p>
                  <p className="text-[10px] text-bakery-brown/35 mt-0.5">
                    {c.orderCount} {t('orders')}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="card-bakery p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bakery-beige flex items-center justify-center text-bakery-brown">
                  <UserRound size={18} />
                </div>
                <div>
                  <p className="font-black text-bakery-brown">{selected.name}</p>
                  <p className="text-sm text-bakery-brown/60">{selected.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40">{t('customerAllergies')}</span>
                  <input
                    className="w-full p-2.5 border border-bakery-beige rounded-xl text-sm"
                    value={selected.allergies || ''}
                    onChange={e => patch(selected.id, { allergies: e.target.value })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40">{t('customerNotes')}</span>
                  <input
                    className="w-full p-2.5 border border-bakery-beige rounded-xl text-sm"
                    value={selected.notes || ''}
                    onChange={e => patch(selected.id, { notes: e.target.value })}
                  />
                </label>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-2">{t('orders')}</p>
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {(history?.orders || []).slice(0, 12).map(o => (
                    <li key={o.id} className="flex justify-between text-sm border border-bakery-beige rounded-xl px-3 py-2">
                      <span>
                        {o.type} · {o.status}
                        {o.source === 'online' ? ` · ${t('sourceOnline')}` : ''}
                      </span>
                      <span className="font-bold">{formatPrice(o.subtotal)}</span>
                    </li>
                  ))}
                  {(history?.sales || []).slice(0, 12).map(s => (
                    <li key={s.id} className="flex justify-between text-sm border border-bakery-beige rounded-xl px-3 py-2">
                      <span>{new Date(s.timestamp).toLocaleString()}</span>
                      <span className="font-bold">{formatPrice(s.subtotal + (s.tipAmount || 0) - (s.discountAmount || 0))}</span>
                    </li>
                  ))}
                  {!history?.orders.length && !history?.sales.length && (
                    <li className="text-sm text-bakery-brown/40">{t('orders')}</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
