import React, { useMemo, useState } from 'react';
import { resolvePublicMenuSnapshot, pushOnlineOrder } from '../utils/opsPersistence';
import { Order, Product, SaleItem } from '../types';
import { isAddonCategory } from '../utils/menuCategories';
import { Modal } from './Modal';
import { ShoppingBag, Check, Plus } from 'lucide-react';

type MenuProduct = Pick<
  Product,
  'id' | 'nameEN' | 'category' | 'price' | 'emoji' | 'active' | 'isFavourite' | 'posColor' | 'extraIds'
>;

type CartLine = SaleItem & { emoji: string; lineId: number };

type Props = {
  businessId: string;
  onDone?: () => void;
};

export const PublicOrderPage: React.FC<Props> = ({ businessId, onDone }) => {
  const snap = useMemo(() => resolvePublicMenuSnapshot(businessId), [businessId]);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orderingEnabled) {
      setError('Online ordering is turned off for this venue.');
      return;
    }
    if (!snap?.products?.length) {
      setError('Menu not available yet. Ask the venue to open PreVisio once, then retry this link.');
      return;
    }
    if (!cart.length || !name.trim() || !phone.trim() || !date || !time) {
      setError('Add items and fill name, phone, pickup date and time.');
      return;
    }
    const items: SaleItem[] = cart.map(c => ({
      productId: c.productId,
      nameEN: c.nameEN,
      qty: c.qty,
      unitPrice: c.unitPrice,
      lineTotal: c.lineTotal,
      extras: c.extras,
      note: c.note,
    }));
    const now = Date.now();
    const order: Order = {
      id: `ON-${now}`,
      type: 'PreOrder',
      status: 'Preparing',
      createdAt: now,
      lastUpdatedAt: now,
      scheduledFor: `${date}T${time}`,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      items,
      subtotal,
      paymentMethod: 'Card',
      createdByUsername: 'online',
      createdByFullName: 'Online guest',
      source: 'online',
    };
    pushOnlineOrder(businessId, order);
    setDone(true);
    setCart([]);
  };

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
              Menu not found for this link yet. Ask the venue to open PreVisio on a device once, then refresh.
            </div>
          )}

          {featured.length > 0 && (
            <section>
              <div className="text-center mb-10">
                <h2 className="text-4xl sm:text-5xl font-black font-serif text-[#d4a373]">Featured Menu</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {featured.map(item => renderMenuCard(item))}
              </div>
            </section>
          )}

          {categories.map(category => {
            const items = menuProducts.filter(p => p.category === category);
            if (!items.length) return null;
            return (
              <section key={category}>
                <div className="mb-8">
                  <h2 className="text-3xl sm:text-4xl font-black font-serif">{category}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {items.map(item => renderMenuCard(item))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="h-fit lg:sticky lg:top-6 rounded-[2rem] border border-[#faedcd] bg-white p-6 sm:p-8 shadow-xl space-y-4">
          <h2 className="text-2xl font-black font-serif">Your order</h2>
          {cart.length === 0 ? (
            <p className="text-sm opacity-50">Tap a menu item to add it.</p>
          ) : (
            <ul className="space-y-4">
              {cart.map(c => (
                <li key={c.lineId} className="space-y-1 border-b border-[#faedcd]/60 pb-3">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold truncate">
                      {c.emoji} {c.nameEN}
                    </span>
                    <span className="font-bold shrink-0">{formatPrice(c.lineTotal)}</span>
                  </div>
                  {c.extras?.map(ex => (
                    <p key={ex.productId} className="text-[11px] opacity-55 font-semibold">
                      + {ex.nameEN}
                    </p>
                  ))}
                  {c.note && <p className="text-[11px] italic opacity-50">{c.note}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateQty(c.lineId, -1)}
                      className="w-8 h-8 rounded-xl bg-[#faedcd] font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-sm w-5 text-center">{c.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(c.lineId, 1)}
                      className="w-8 h-8 rounded-xl bg-[#faedcd] font-bold"
                    >
                      +
                    </button>
                    <input
                      type="text"
                      className="flex-1 text-[11px] p-2 border border-[#faedcd] rounded-xl outline-none"
                      placeholder="e.g. no ice, allergy"
                      value={c.note || ''}
                      onChange={e => {
                        const note = e.target.value;
                        setCart(prev => prev.map(line => (line.lineId === c.lineId ? { ...line, note } : line)));
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="font-black text-2xl border-t border-[#faedcd] pt-3">{formatPrice(subtotal)}</p>
          <form onSubmit={submit} className="space-y-3">
            <input
              className="w-full p-3.5 border border-[#faedcd] rounded-2xl text-sm font-medium"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="w-full p-3.5 border border-[#faedcd] rounded-2xl text-sm font-medium"
              placeholder="Phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="w-full p-3.5 border border-[#faedcd] rounded-2xl text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              <input
                type="time"
                className="w-full p-3.5 border border-[#faedcd] rounded-2xl text-sm"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
            <button type="submit" className="w-full py-4 rounded-full bg-[#5d4037] text-white font-black text-sm">
              Place pre-order
            </button>
          </form>
        </aside>
      </main>

      {extraModalItem && (
        <Modal title="Add extras?" onClose={() => setExtraModalItem(null)}>
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-[#F7F3ED] rounded-2xl border border-[#faedcd]">
              <span className="text-4xl">{extraModalItem.emoji}</span>
              <div>
                <p className="font-bold text-lg">{extraModalItem.nameEN}</p>
                <p className="font-black text-[#d4a373]">{formatPrice(extraModalItem.price)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {extrasForProduct(extraModalItem).map(e => {
                const on = selectedExtras.some(se => se.id === e.id);
                return (
                  <label
                    key={e.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer ${
                      on ? 'border-[#5d4037] bg-[#F7F3ED]' : 'border-[#faedcd]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={on}
                        onChange={() => {
                          setSelectedExtras(prev =>
                            on ? prev.filter(se => se.id !== e.id) : [...prev, e]
                          );
                        }}
                      />
                      <span className="text-xl">{e.emoji}</span>
                      <div className="text-left">
                        <p className="font-bold text-sm">{e.nameEN}</p>
                        <p className="text-[10px] opacity-50">{formatPrice(e.price)}</p>
                      </div>
                    </div>
                    {on && <Plus size={16} />}
                  </label>
                );
              })}
            </div>

            <input
              type="text"
              className="w-full text-sm p-2.5 border border-[#faedcd] rounded-xl outline-none"
              placeholder="e.g. no ice, allergy"
              value={lineNote}
              onChange={e => setLineNote(e.target.value)}
            />

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => confirmExtras(true)}
                className="flex-1 py-4 rounded-2xl font-bold opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => confirmExtras(false)}
                className="flex-1 bg-[#5d4037] text-white py-4 rounded-2xl font-bold"
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
