import React, { useEffect, useState, useRef } from 'react';
import { Product, SaleItem } from '../types';
import { isAddonCategory } from '../utils/menuCategories';
import { Modal } from './Modal';
import { ShoppingBag, Check, Plus } from 'lucide-react';

type MenuProduct = Pick<
  Product,
  'id' | 'nameEN' | 'category' | 'price' | 'emoji' | 'active' | 'isFavourite' | 'posColor' | 'extraIds'
>;

type CartLine = SaleItem & { emoji: string; lineId: number };

type MenuSnapshot = {
  businessId: string;
  businessName: string;
  currencySymbol: string;
  onlineOrdersEnabled: boolean;
  products: MenuProduct[];
};

type Props = {
  businessId: string;
  onDone?: () => void;
};

export const PublicOrderPage: React.FC<Props> = ({ businessId, onDone }) => {
  const [snap, setSnap] = useState<MenuSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [extraModalItem, setExtraModalItem] = useState<MenuProduct | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<MenuProduct[]>([]);
  const [lineNote, setLineNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/public-menu?businessId=${encodeURIComponent(businessId)}`);
        const body = (await res.json()) as MenuSnapshot & { error?: string };
        if (!res.ok) {
          if (!cancelled) {
            setSnap(null);
            setError(body.error || 'Menu unavailable');
          }
          return;
        }
        if (!cancelled) setSnap(body);
      } catch {
        if (!cancelled) {
          setSnap(null);
          setError('Could not load the menu. Try again shortly.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const allProducts = (snap?.products || []).filter(p => p.active !== false);
  const addonProducts = allProducts.filter(p => isAddonCategory(p.category));
  const menuProducts = allProducts.filter(p => !isAddonCategory(p.category));
  const categories = Array.from(new Set(menuProducts.map(p => p.category))).sort();
  const favourites = menuProducts.filter(p => p.isFavourite);
  const featured = favourites.length > 0 ? favourites : menuProducts.slice(0, 6);

  const extrasForProduct = (p: MenuProduct) => {
    if (!p.extraIds?.length) return [];
    return addonProducts.filter(a => p.extraIds!.includes(a.id));
  };

  const startAdd = (p: MenuProduct) => {
    const available = extrasForProduct(p);
    if (available.length === 0) {
      commitLine(p, [], '');
      return;
    }
    setExtraModalItem(p);
    setSelectedExtras([]);
    setLineNote('');
  };

  const commitLine = (p: MenuProduct, extras: MenuProduct[], note: string) => {
    const extrasPayload = extras.map(e => ({ productId: e.id, nameEN: e.nameEN, price: e.price }));
    const unitTotal = p.price + extrasPayload.reduce((a, e) => a + e.price, 0);
    const noteTrim = note.trim();

    setCart(prev => {
      const existing = prev.findIndex(item => {
        if (item.productId !== p.id) return false;
        if ((item.note || '') !== noteTrim) return false;
        const a = (item.extras || []).map(e => e.productId).sort().join(',');
        const b = extrasPayload.map(e => e.productId).sort().join(',');
        return a === b;
      });
      if (existing >= 0) {
        const next = [...prev];
        const item = next[existing];
        const qty = item.qty + 1;
        next[existing] = { ...item, qty, lineTotal: qty * unitTotal };
        return next;
      }
      return [
        ...prev,
        {
          lineId: Date.now(),
          productId: p.id,
          nameEN: p.nameEN,
          qty: 1,
          unitPrice: p.price,
          lineTotal: unitTotal,
          emoji: p.emoji,
          extras: extrasPayload,
          note: noteTrim || undefined,
        },
      ];
    });
  };

  const confirmExtras = (skipExtras: boolean) => {
    if (!extraModalItem) return;
    commitLine(extraModalItem, skipExtras ? [] : selectedExtras, lineNote);
    setExtraModalItem(null);
    setSelectedExtras([]);
    setLineNote('');
  };

  const updateQty = (lineId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.lineId !== lineId) return item;
          const qty = Math.max(0, item.qty + delta);
          const unit = item.unitPrice + (item.extras?.reduce((a, e) => a + e.price, 0) || 0);
          return { ...item, qty, lineTotal: qty * unit };
        })
        .filter(item => item.qty > 0)
    );
  };

  const subtotal = cart.reduce((a, c) => a + c.lineTotal, 0);
  const sym = snap?.currencySymbol || '€';
  const formatPrice = (n: number) => `${sym}${n.toFixed(2)}`;
  const orderingEnabled = snap?.onlineOrdersEnabled !== false;

  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const busyRef = useRef(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orderingEnabled) {
      setError('Online ordering is turned off for this venue.');
      return;
    }
    if (!snap?.products?.length) {
      setError('Menu not available yet.');
      return;
    }
    if (!cart.length || !name.trim() || !phone.trim() || !date || !time) {
      setError('Add items and fill name, phone, pickup date and time.');
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    const fingerprint = JSON.stringify({ businessId, name, phone, date, time, cart });
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const res = await fetch('/api/public-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          requestId: requestRef.current.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          scheduledFor: new Date(`${date}T${time}`).toISOString(),
          items: cart.map(c => ({
            productId: c.productId,
            qty: c.qty,
            extraIds: (c.extras || []).map(ex => ex.productId),
            note: c.note,
          })),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error || 'Could not place order');
        return;
      }
      requestRef.current = null;
      setDone(true);
      setCart([]);
    } catch {
      setError('Could not place order. Try again shortly.');
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F3ED] text-[#5d4037]">
        <p className="text-sm font-bold opacity-60">Loading menu…</p>
      </div>
    );
  }

  if (snap && !orderingEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F3ED] text-[#5d4037]">
        <div className="max-w-md w-full rounded-[2rem] border border-[#faedcd] bg-white p-10 text-center space-y-3 shadow-xl">
          <h1 className="text-3xl font-black font-serif">{snap.businessName || 'Pre-order'}</h1>
          <p className="text-sm opacity-70">Online ordering is turned off for this venue.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F3ED] text-[#5d4037]">
        <div className="max-w-md w-full rounded-[2rem] border border-[#faedcd] bg-white p-10 text-center space-y-3 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Check size={24} />
          </div>
          <h1 className="text-3xl font-black font-serif">Order received</h1>
          <p className="text-sm opacity-70">We’ll have it ready for your pickup time.</p>
          <button
            type="button"
            className="mt-4 px-8 py-3.5 rounded-full bg-[#5d4037] text-white font-black text-sm"
            onClick={() => {
              setDone(false);
              onDone?.();
            }}
          >
            Place another order
          </button>
        </div>
      </div>
    );
  }

  const renderMenuCard = (item: MenuProduct) => (
    <button
      key={item.id}
      type="button"
      onClick={() => startAdd(item)}
      className="rounded-[2rem] p-8 border border-[#faedcd] bg-white text-left transition-transform hover:-translate-y-2 shadow-xl"
    >
      <div className="text-6xl mb-6">{item.emoji}</div>
      <h3 className="text-2xl font-bold mb-2">{item.nameEN}</h3>
      <p className="opacity-70 text-sm mb-6 uppercase tracking-widest font-bold">{item.category}</p>
      <p className="text-3xl font-black text-[#d4a373]">{formatPrice(item.price)}</p>
      {extrasForProduct(item).length > 0 && (
        <p className="mt-3 text-xs font-bold opacity-40 uppercase tracking-wider">Extras available</p>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#5d4037]">
      <header className="relative overflow-hidden border-b border-[#faedcd]">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top right, #faedcd 0%, transparent 55%), radial-gradient(ellipse at bottom left, #e8d5b7 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-10 sm:py-14 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40 mb-3">Pre-order</p>
            <h1 className="text-4xl sm:text-5xl font-black font-serif leading-tight">
              {snap?.businessName || 'Pre-order'}
            </h1>
            <p className="mt-3 text-base opacity-60 max-w-md">
              Choose from the menu, add extras and notes, then pick a pickup time.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 self-start sm:self-auto px-5 py-3 rounded-2xl bg-white border border-[#faedcd] shadow-sm font-bold">
            <ShoppingBag size={18} />
            <span>
              {cart.reduce((a, c) => a + c.qty, 0)} items · {formatPrice(subtotal)}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 pb-24">
        <div className="space-y-16">
          {!snap?.products?.length && (
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm">
              {error || 'Menu not available yet for this venue.'}
            </div>
          )}

          {featured.length > 0 && (
            <section>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] opacity-40 mb-6">Featured</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {featured.map(renderMenuCard)}
              </div>
            </section>
          )}

          {categories.map(cat => (
            <section key={cat}>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] opacity-40 mb-6">{cat}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {menuProducts.filter(p => p.category === cat).map(renderMenuCard)}
              </div>
            </section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-8 h-fit space-y-6">
          <form
            onSubmit={submit}
            className="rounded-[2rem] border border-[#faedcd] bg-white p-6 shadow-xl space-y-4"
          >
            <h2 className="text-xl font-black font-serif">Your order</h2>
            {cart.length === 0 ? (
              <p className="text-sm opacity-50">Tap a dish to add it.</p>
            ) : (
              <ul className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map(item => (
                  <li key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-bold">
                        {item.emoji} {item.nameEN}
                      </p>
                      {item.extras && item.extras.length > 0 && (
                        <p className="text-xs opacity-50">
                          + {item.extras.map(e => e.nameEN).join(', ')}
                        </p>
                      )}
                      {item.note && <p className="text-xs opacity-50 italic">{item.note}</p>}
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border border-[#faedcd] font-bold"
                          onClick={() => updateQty(item.lineId, -1)}
                        >
                          −
                        </button>
                        <span className="font-bold">{item.qty}</span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border border-[#faedcd] font-bold"
                          onClick={() => updateQty(item.lineId, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="font-black whitespace-nowrap">{formatPrice(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-[#faedcd] pt-4 space-y-3">
              <input
                className="w-full rounded-xl border border-[#faedcd] px-4 py-3 text-sm"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-[#faedcd] px-4 py-3 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#faedcd] px-4 py-3 text-sm"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
                <input
                  type="time"
                  className="w-full rounded-xl border border-[#faedcd] px-4 py-3 text-sm"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between font-black text-lg">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {error && <p className="text-sm text-red-600 font-bold">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[#5d4037] text-white font-black py-3.5 text-sm disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Place order'}
            </button>
          </form>
        </aside>
      </main>

      {extraModalItem && (
      <Modal
        title={extraModalItem.nameEN || 'Extras'}
        onClose={() => setExtraModalItem(null)}
      >
        <div className="space-y-4">
          <p className="text-sm opacity-60">Add extras or a note for this item.</p>
          <div className="space-y-2">
            {extrasForProduct(extraModalItem).map(ex => {
              const selected = selectedExtras.some(s => s.id === ex.id);
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() =>
                    setSelectedExtras(prev =>
                      selected ? prev.filter(s => s.id !== ex.id) : [...prev, ex]
                    )
                  }
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
                    selected ? 'border-[#5d4037] bg-[#faedcd]' : 'border-[#faedcd]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus size={14} /> {ex.nameEN}
                  </span>
                  <span>{formatPrice(ex.price)}</span>
                </button>
              );
            })}
          </div>
          <textarea
            className="w-full rounded-xl border border-[#faedcd] px-4 py-3 text-sm"
            rows={2}
            placeholder="Note (optional)"
            value={lineNote}
            onChange={e => setLineNote(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-full border border-[#faedcd] font-bold py-3 text-sm"
              onClick={() => confirmExtras(true)}
            >
              No extras
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-[#5d4037] text-white font-bold py-3 text-sm"
              onClick={() => confirmExtras(false)}
            >
              Add to order
            </button>
          </div>
        </div>
      </Modal>
      )}
    </div>
  );
};
