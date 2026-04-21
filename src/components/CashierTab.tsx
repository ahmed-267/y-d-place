
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, CreditCard, Banknote, Plus, Search } from 'lucide-react';
import { Order, OrderType, Product, SaleItem } from '../types';
import { Modal } from './Modal';
import { toSearchValue, priceMatchesQuery } from '../utils/search';

export const CashierTab = () => {
  const { 
    products, 
    setOrders,
    user, 
    t, 
    tp, 
    tc,
    addToast, 
    categories, 
    formatPrice 
  } = useApp();
  const [cart, setCart] = useState<(SaleItem & { emoji: string, transKey: string, id: number })[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('WalkIn');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Card');
  const [cashReceived, setCashReceived] = useState('');
  const [extraModalItem, setExtraModalItem] = useState<Product | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Product[]>([]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const resolveProductName = (productId: number, fallback: string) => {
    const product = productMap.get(productId);
    return product ? tp(product) : fallback;
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter(p => {
      const matchesCategory = p.active && (selectedCategory === 'All' || p.category === selectedCategory);
      if (!query) return matchesCategory;
      const translated = toSearchValue(tp(p));
      const name = toSearchValue(p?.nameEN);
      const priceMatch = priceMatchesQuery(p?.price, query) || toSearchValue(p?.price).includes(query);
      const matchesSearch = translated.includes(query) || name.includes(query) || priceMatch;
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, search, tp]);

  const activeCategories = useMemo(() => {
    return Array.from(new Set(products.filter(p => p.active).map(p => p.category))).sort();
  }, [products]);

  const extras = products.filter(p => p.active && p.category === 'Extras');

  const groupedProducts = useMemo(() => {
    if (selectedCategory !== 'All') return [];
    return activeCategories
      .map(cat => ({ category: cat, items: filteredProducts.filter(p => p.category === cat) }))
      .filter(group => group.items.length > 0);
  }, [selectedCategory, activeCategories, filteredProducts]);
  
  const subtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  const change = parseFloat(cashReceived) - subtotal;

  const gridRef = useRef<HTMLDivElement>(null);
  const pillContainerRef = useRef<HTMLDivElement>(null);
  const categoryHeadingRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const setCategoryHeadingRef = (category: string) => (el: HTMLDivElement | null) => {
    categoryHeadingRefs.current[category] = el;
  };

  const setPillRef = (category: string) => (el: HTMLButtonElement | null) => {
    pillRefs.current[category] = el;
  };

  useEffect(() => {
    if (selectedCategory !== 'All') {
      setActiveCategory(selectedCategory);
      return;
    }
    if (activeCategories.length && activeCategory === 'All') {
      setActiveCategory(activeCategories[0]);
    }
  }, [selectedCategory, activeCategories, activeCategory]);

  useEffect(() => {
    const container = gridRef.current;
    if (!container || selectedCategory !== 'All') return;

    let frame: number | null = null;

    const updateActive = () => {
      const containerTop = container.getBoundingClientRect().top;
      let nextCategory = activeCategory;
      let closestOffset = -Infinity;

      activeCategories.forEach(category => {
        const heading = categoryHeadingRefs.current[category];
        if (!heading) return;
        const rect = heading.getBoundingClientRect();
        const offset = rect.top - containerTop;
        if (offset <= 24 && offset > closestOffset) {
          closestOffset = offset;
          nextCategory = category;
        }
      });

      if (nextCategory !== activeCategory) {
        setActiveCategory(nextCategory);
      }
    };

    const onScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActive);
    };

    container.addEventListener('scroll', onScroll);
    updateActive();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      container.removeEventListener('scroll', onScroll);
    };
  }, [selectedCategory, activeCategories, activeCategory]);

  useEffect(() => {
    const pill = pillRefs.current[selectedCategory === 'All' ? activeCategory : selectedCategory];
    if (pill && pillContainerRef.current) {
      pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeCategory, selectedCategory]);

  const scrollToCategory = (category: string) => {
    if (!gridRef.current) return;
    if (category === 'All') {
      gridRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const heading = categoryHeadingRefs.current[category];
    if (heading) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      gridRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCategoryClick = (category: string) => {
    if (category === 'All') {
      setSelectedCategory('All');
      setActiveCategory(activeCategories[0] || 'All');
      scrollToCategory('All');
      return;
    }
    setSelectedCategory(category);
    setActiveCategory(category);
    scrollToCategory(category);
  };

  const handleProductClick = (p: Product) => {
    // Check if there are any available extras
    const hasExtras = extras.length > 0;
    const isExtra = p.category === 'Extras';

    if (isExtra || !hasExtras) {
      // Add directly to cart if it's an extra itself or if no extras are available
      const existingItemIndex = cart.findIndex(item => item.productId === p.id && (!item.extras || item.extras.length === 0));
      
      if (existingItemIndex > -1) {
        const newCart = [...cart];
        const item = newCart[existingItemIndex];
        const newQty = item.qty + 1;
        newCart[existingItemIndex] = { ...item, qty: newQty, lineTotal: newQty * item.unitPrice };
        setCart(newCart);
      } else {
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
      }
      addToast(t('addedToCart').replace('{item}', tp(p)));
    } else {
      setExtraModalItem(p);
      setSelectedExtras([]);
    }
  };

  const addToCart = () => {
    if (!extraModalItem) return;
    
    const itemTotal = extraModalItem.price + selectedExtras.reduce((acc, e) => acc + e.price, 0);
    const extrasPayload = selectedExtras.map(e => ({ productId: e.id, nameEN: e.nameEN, price: e.price }));
    
    // Check for existing item with same product and same extras
    const existingItemIndex = cart.findIndex(item => {
      if (item.productId !== extraModalItem.id) return false;
      if (!item.extras && extrasPayload.length === 0) return true;
      if (!item.extras || item.extras.length !== extrasPayload.length) return false;
      
      // Compare extras (assuming order doesn't matter, but for simplicity we can sort or just check inclusion)
      const itemExtraIds = item.extras.map(e => e.productId).sort();
      const payloadExtraIds = extrasPayload.map(e => e.productId).sort();
      return JSON.stringify(itemExtraIds) === JSON.stringify(payloadExtraIds);
    });

    if (existingItemIndex > -1) {
      const newCart = [...cart];
      const item = newCart[existingItemIndex];
      const newQty = item.qty + 1;
      newCart[existingItemIndex] = { ...item, qty: newQty, lineTotal: newQty * (item.lineTotal / item.qty) };
      setCart(newCart);
    } else {
      const newItem: SaleItem & { emoji: string, transKey: string, id: number } = {
        id: Date.now(),
        productId: extraModalItem.id,
        nameEN: extraModalItem.nameEN,
        qty: 1,
        unitPrice: extraModalItem.price,
        lineTotal: itemTotal,
        emoji: extraModalItem.emoji,
        transKey: extraModalItem.transKey,
        extras: extrasPayload
      };
      setCart([...cart, newItem]);
    }

    setExtraModalItem(null);
    setSelectedExtras([]);
  };

  const updateQty = (id: number, delta: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
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
      addToast(t('insufficientCash'), "error");
      return;
    }
    if (cart.length === 0) {
      addToast(t('addItemsFirst'), "error");
      return;
    }
    if (orderType === 'PreOrder') {
      if (!customerName.trim() || !customerPhone.trim() || !scheduledDate || !scheduledTime) {
        addToast(t('preOrderRequiresDetails'), "error");
        return;
      }
    }

    const scheduledFor = orderType === 'PreOrder' ? `${scheduledDate}T${scheduledTime}` : undefined;
    const newOrder: Order = {
      id: `ORDER-${Date.now()}`,
      type: orderType,
      status: 'Preparing',
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      scheduledFor,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: cart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras }) => ({
        productId, nameEN, qty, unitPrice, lineTotal, extras
      })),
      subtotal,
      paymentMethod,
      createdByUsername: user.username,
      createdByFullName: user.fullName
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setCashReceived('');
    setOrderType('WalkIn');
    setCustomerName('');
    setCustomerPhone('');
    setScheduledDate('');
    setScheduledTime('');
    addToast(t('orderSent'));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-160px)] animate-fade-in pb-20 lg:pb-0 max-w-full overflow-hidden">
      <div className="order-2 lg:order-1 flex-1 flex flex-col gap-4 sm:gap-6 overflow-hidden min-h-[400px] lg:min-h-0">
        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
          <div ref={pillContainerRef} className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
            {['All', ...activeCategories].map(cat => {
              const isActive = selectedCategory === 'All' ? activeCategory === cat : selectedCategory === cat;
              return (
              <button 
                key={cat} 
                ref={setPillRef(cat)}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm whitespace-nowrap transition-all active:scale-95 ${
                  isActive ? 'bg-bakery-brown text-white shadow-md' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-bakery-beige/50'
                }`}
              >
                {cat === 'All' ? t('all') : tc(cat)}
              </button>
            );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={18} />
            <input 
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-3 border border-bakery-beige rounded-full outline-none focus:ring-2 focus:ring-bakery-caramel text-sm bg-white shadow-sm"
            />
          </div>
        </div>
        <div ref={gridRef} className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {selectedCategory === 'All' ? (
              groupedProducts.map(group => (
                <React.Fragment key={group.category}>
                  <div ref={setCategoryHeadingRef(group.category)} className="col-span-full flex items-center gap-3">
                    <h4 className="text-sm sm:text-base font-black font-serif text-bakery-brown">{tc(group.category)}</h4>
                    <div className="h-px bg-bakery-beige flex-1" />
                  </div>
                  {group.items.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => handleProductClick(p)}
                      className="card-bakery p-3 sm:p-4 md:p-6 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-90 min-h-[110px] sm:min-h-[140px] md:min-h-[160px] justify-center hover:shadow-md"
                    >
                      <span className="text-2xl sm:text-3xl md:text-5xl mb-2 md:mb-3">{p.emoji}</span>
                      <p className="font-bold text-[10px] sm:text-xs md:text-base mb-1 leading-tight h-6 sm:h-8 md:h-12 flex items-center justify-center overflow-hidden line-clamp-2">{tp(p)}</p>
                      <p className="text-bakery-caramel font-black text-xs sm:text-sm md:text-lg mb-1 md:mb-2">{formatPrice(p.price)}</p>
                    </button>
                  ))}
                </React.Fragment>
              ))
            ) : (
              filteredProducts.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => handleProductClick(p)}
                  className="card-bakery p-3 sm:p-4 md:p-6 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-90 min-h-[110px] sm:min-h-[140px] md:min-h-[160px] justify-center hover:shadow-md"
                >
                  <span className="text-2xl sm:text-3xl md:text-5xl mb-2 md:mb-3">{p.emoji}</span>
                  <p className="font-bold text-[10px] sm:text-xs md:text-base mb-1 leading-tight h-6 sm:h-8 md:h-12 flex items-center justify-center overflow-hidden line-clamp-2">{tp(p)}</p>
                  <p className="text-bakery-caramel font-black text-xs sm:text-sm md:text-lg mb-1 md:mb-2">{formatPrice(p.price)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-2 w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-6 shrink-0">
        <div className="card-bakery p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold font-serif">{t('orderDetails')}</h3>
              <p className="text-[10px] uppercase tracking-widest text-bakery-brown/40 font-black">{t('createdInCashier')}</p>
            </div>
            <div className="flex items-center gap-2 bg-bakery-beige/40 p-1 rounded-2xl">
              <button
                onClick={() => setOrderType('WalkIn')}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${orderType === 'WalkIn' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
              >
                {t('walkIn')}
              </button>
              <button
                onClick={() => setOrderType('PreOrder')}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${orderType === 'PreOrder' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
              >
                {t('preOrder')}
              </button>
            </div>
          </div>

          {orderType === 'PreOrder' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('customerName')}</label>
                <input
                  type="text"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('phoneNumber')}</label>
                <input
                  type="tel"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('pickupDate')}</label>
                <input
                  type="date"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('pickupTime')}</label>
                <input
                  type="time"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="card-bakery flex-1 flex flex-col overflow-hidden max-h-[600px] lg:max-h-none">
          <div className="p-4 sm:p-6 border-b border-bakery-beige flex justify-between items-center bg-bakery-cream/30">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-bakery-brown" />
              <h3 className="text-lg sm:text-xl font-bold font-serif">{t('cart')}</h3>
            </div>
            <span className="bg-bakery-brown text-white px-3 py-1 rounded-full text-xs font-bold">{cart.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-hide">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-1 animate-fade-in border-b border-bakery-beige/50 pb-3">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs sm:text-sm truncate">{tp(item as any)}</p>
                    {item.extras?.map(e => (
                      <p key={e.productId} className="text-[9px] sm:text-[10px] text-bakery-caramel font-bold italic truncate">+ {resolveProductName(e.productId, e.nameEN)}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/70 transition-colors active:scale-90">-</button>
                    <span className="font-bold w-4 sm:w-6 text-center text-sm sm:text-base">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/70 transition-colors active:scale-90">+</button>
                  </div>
                  <p className="font-bold text-xs sm:text-sm w-14 sm:w-16 text-right shrink-0">{formatPrice(item.lineTotal)}</p>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-10 sm:py-20">
                <span className="text-4xl sm:text-5xl mb-4">🛒</span>
                <p className="italic font-medium text-sm sm:text-base">{t('emptyCart')}</p>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6 bg-bakery-beige/30 border-t border-bakery-beige space-y-4">
            <div className="flex justify-between items-center text-lg sm:text-xl font-black font-serif">
              <span>{t('subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('payment')}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPaymentMethod('Card')}
                  className={`flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'Card' ? 'bg-bakery-brown text-white shadow-md' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-white/80'
                  }`}
                >
                  <CreditCard size={16} />
                  {t('card')}
                </button>
                <button 
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
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
                    className="w-full p-2.5 sm:p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('change')}</p>
                  <div className={`p-2.5 sm:p-3 rounded-xl font-bold text-base sm:text-lg ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatPrice(isNaN(change) ? 0 : change)}
                  </div>
                </div>
              </div>
            )}
            <button 
              disabled={cart.length === 0 || (paymentMethod === 'Cash' && (isNaN(change) || change < 0))}
              onClick={confirmOrder}
              className="w-full btn-primary p-3.5 sm:p-4 rounded-2xl font-bold text-base sm:text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                <p className="font-bold text-lg">{tp(extraModalItem)}</p>
                <p className="text-bakery-caramel font-black">{formatPrice(extraModalItem.price)}</p>
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
                      <p className="font-bold text-sm">{tp(e as any)}</p>
                      <p className="text-[10px] text-bakery-brown/50">{formatPrice(e.price)}</p>
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
