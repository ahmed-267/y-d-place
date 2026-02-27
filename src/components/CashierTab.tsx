
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, CreditCard, Banknote, Plus } from 'lucide-react';
import { Product, Sale, SaleItem } from '../types';
import { Modal } from './Modal';

export const CashierTab = () => {
  const { products, setProducts, sales, setSales, user, shiftLogs, setShiftLogs, t, addToast, categories } = useApp();
  const [cart, setCart] = useState<(SaleItem & { emoji: string, transKey: string, id: number })[]>([]);
  const [filter, setFilter] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Card');
  const [cashReceived, setCashReceived] = useState('');
  const [extraModalItem, setExtraModalItem] = useState<Product | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Product[]>([]);

  const filteredProducts = products.filter(p => p.active && (filter === 'All' || p.category === filter));
  const extras = products.filter(p => p.active && p.category === 'Extras');
  
  const subtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  const change = parseFloat(cashReceived) - subtotal;

  const handleProductClick = (p: Product) => {
    if (p.stock <= 0) return;
    if (p.category === 'Extras') {
      // Add extras directly to cart if clicked from grid
      const newItem: SaleItem & { emoji: string, transKey: string, id: number } = {
        id: Date.now(),
        productId: p.id,
        nameEN: p.nameEN,
        qty: 1,
        unitPrice: p.price,
        lineTotal: p.price,
        emoji: p.emoji,
        transKey: p.transKey,
        extras: []
      };
      setCart([...cart, newItem]);
      addToast(`${t(p.transKey || '')} added to cart`);
    } else {
      setExtraModalItem(p);
      setSelectedExtras([]);
    }
  };

  const addToCart = () => {
    if (!extraModalItem) return;
    
    const itemTotal = extraModalItem.price + selectedExtras.reduce((acc, e) => acc + e.price, 0);
    
    const newItem: SaleItem & { emoji: string, transKey: string, id: number } = {
      id: Date.now(),
      productId: extraModalItem.id,
      nameEN: extraModalItem.nameEN,
      qty: 1,
      unitPrice: extraModalItem.price,
      lineTotal: itemTotal,
      emoji: extraModalItem.emoji,
      transKey: extraModalItem.transKey,
      extras: selectedExtras.map(e => ({ productId: e.id, nameEN: e.nameEN, price: e.price }))
    };

    setCart([...cart, newItem]);
    setExtraModalItem(null);
    setSelectedExtras([]);
  };

  const updateQty = (id: number, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    const p = products.find(prod => prod.id === item.productId);
    if (!p) return;
    
    if (delta > 0 && item.qty >= p.stock) {
      addToast(`Only ${p.stock} in stock!`, 'error');
      return;
    }

    const newCart = cart.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.qty + delta);
        const unitTotal = i.unitPrice + (i.extras?.reduce((acc, e) => acc + e.price, 0) || 0);
        return { ...i, qty: newQty, lineTotal: newQty * unitTotal };
      }
      return i;
    }).filter(i => i.qty > 0);
    
    setCart(newCart);
  };

  const confirmOrder = () => {
    if (!user) return;
    if (paymentMethod === 'Cash' && (isNaN(change) || change < 0)) {
      addToast("Insufficient cash received", "error");
      return;
    }

    const newSale: Sale = {
      id: `ORD-${Date.now()}`,
      timestamp: Date.now(),
      items: cart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras }) => ({
        productId, nameEN, qty, unitPrice, lineTotal, extras
      })),
      subtotal,
      paymentMethod,
      cashierUsername: user.username,
      cashierFullName: user.fullName
    };

    const updatedProducts = products.map(p => {
      let totalDeduction = 0;
      cart.forEach(item => {
        if (item.productId === p.id) totalDeduction += item.qty;
        item.extras?.forEach(extra => {
          if (extra.productId === p.id) totalDeduction += item.qty;
        });
      });
      return totalDeduction > 0 ? { ...p, stock: p.stock - totalDeduction } : p;
    });

    const updatedLogs = shiftLogs.map(log => {
      if (log.username === user.username && !log.logoutTime) {
        return { ...log, ordersProcessed: log.ordersProcessed + 1 };
      }
      return log;
    });

    setProducts(updatedProducts);
    setSales([...sales, newSale]);
    setShiftLogs(updatedLogs);
    setCart([]);
    setCashReceived('');
    addToast(t('orderSuccess'));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-160px)] animate-fade-in pb-20 lg:pb-0">
      <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-[500px] lg:min-h-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0">
          {['All', ...categories].map(cat => (
            <button 
              key={cat} 
              onClick={() => setFilter(cat)}
              className={`px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap transition-all active:scale-95 ${
                filter === cat ? 'bg-bakery-brown text-white shadow-md' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-bakery-beige/50'
              }`}
            >
              {t(cat.toLowerCase().replace(' ', '')) || cat}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-4 gap-2 md:gap-4">
            {filteredProducts.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleProductClick(p)}
                disabled={p.stock <= 0}
                className={`card-bakery p-3 md:p-6 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-90 min-h-[120px] md:min-h-[160px] justify-center ${
                  p.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md'
                }`}
              >
                <span className="text-3xl md:text-5xl mb-2 md:mb-3">{p.emoji}</span>
                <p className="font-bold text-[10px] md:text-base mb-1 leading-tight h-8 md:h-12 flex items-center justify-center">{t(p.transKey || '')}</p>
                <p className="text-bakery-caramel font-black text-sm md:text-lg mb-1 md:mb-2">€{p.price.toFixed(2)}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-full ${
                    p.stock <= p.lowThreshold ? 'bg-rose-100 text-rose-600' : 'bg-bakery-beige text-bakery-brown/60'
                  }`}>
                    {p.stock} {p.stock === 1 ? 'unit' : 'units'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[450px] flex flex-col gap-6 shrink-0">
        <div className="card-bakery flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-bakery-beige flex justify-between items-center bg-bakery-cream/30">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-bakery-brown" />
              <h3 className="text-xl font-bold font-serif">{t('cart')}</h3>
            </div>
            <span className="bg-bakery-brown text-white px-3 py-1 rounded-full text-xs font-bold">{cart.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-1 animate-fade-in border-b border-bakery-beige/50 pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-sm">{t(item.transKey || '')}</p>
                    {item.extras?.map(e => (
                      <p key={e.productId} className="text-[10px] text-bakery-caramel font-bold italic">+ {e.nameEN}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQty(item.id, -1)} className="w-10 h-10 rounded-full bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/70 transition-colors active:scale-90">-</button>
                    <span className="font-bold w-6 text-center text-base">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-10 h-10 rounded-full bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/70 transition-colors active:scale-90">+</button>
                  </div>
                  <p className="font-bold text-sm w-16 text-right">€{item.lineTotal.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                <span className="text-5xl mb-4">🛒</span>
                <p className="italic font-medium">{t('emptyCart')}</p>
              </div>
            )}
          </div>
          <div className="p-6 bg-bakery-beige/30 border-t border-bakery-beige space-y-4">
            <div className="flex justify-between items-center text-xl font-black font-serif">
              <span>{t('subtotal')}</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('payment')}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPaymentMethod('Card')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'Card' ? 'bg-bakery-brown text-white shadow-md' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-white/80'
                  }`}
                >
                  <CreditCard size={16} />
                  {t('card')}
                </button>
                <button 
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'Cash' ? 'bg-bakery-brown text-white shadow-md' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-white/80'
                  }`}
                >
                  <Banknote size={16} />
                  {t('cash')}
                </button>
              </div>
            </div>
            {paymentMethod === 'Cash' && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('cashReceived')}</p>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('change')}</p>
                  <div className={`p-3 rounded-xl font-bold text-lg ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    €{isNaN(change) ? '0.00' : change.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
            <button 
              disabled={cart.length === 0 || (paymentMethod === 'Cash' && (isNaN(change) || change < 0))}
              onClick={confirmOrder}
              className="w-full btn-primary p-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {t('confirmOrder')}
            </button>
          </div>
        </div>
      </div>

      {extraModalItem && (
        <Modal title={t('addExtras')} onClose={() => setExtraModalItem(null)}>
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-bakery-cream rounded-2xl border border-bakery-beige">
              <span className="text-4xl">{extraModalItem.emoji}</span>
              <div>
                <p className="font-bold text-lg">{t(extraModalItem.transKey || '')}</p>
                <p className="text-bakery-caramel font-black">€{extraModalItem.price.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {extras.map(e => (
                <label key={e.id} className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedExtras.find(se => se.id === e.id) ? 'border-bakery-brown bg-bakery-beige/30' : 'border-bakery-beige hover:border-bakery-brown/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={!!selectedExtras.find(se => se.id === e.id)}
                      onChange={() => {
                        if (selectedExtras.find(se => se.id === e.id)) {
                          setSelectedExtras(selectedExtras.filter(se => se.id !== e.id));
                        } else {
                          setSelectedExtras([...selectedExtras, e]);
                        }
                      }}
                    />
                    <span className="text-xl">{e.emoji}</span>
                    <div className="text-left">
                      <p className="font-bold text-sm">{t(e.transKey || '')}</p>
                      <p className="text-[10px] text-bakery-brown/50">€{e.price.toFixed(2)}</p>
                    </div>
                  </div>
                  {selectedExtras.find(se => se.id === e.id) && <Plus size={16} className="text-bakery-brown" />}
                </label>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setSelectedExtras([]); addToCart(); }}
                className="flex-1 py-5 rounded-2xl font-bold text-bakery-brown/60 hover:text-bakery-brown transition-colors active:scale-95"
              >
                {t('skip')}
              </button>
              <button 
                onClick={addToCart}
                className="flex-1 btn-primary py-5 rounded-2xl font-bold shadow-lg active:scale-95"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};