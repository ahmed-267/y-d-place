
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, CreditCard, Banknote, Plus, Search, Zap, UtensilsCrossed } from 'lucide-react';
import { Order, OrderType, Product, SaleItem } from '../types';
import { Modal } from './Modal';
import { toSearchValue, priceMatchesQuery } from '../utils/search';
import { checkStockAvailability } from '../utils/stock';
import { finalizeSale } from '../utils/sales';
import { applyCountryDialCode, getDialCode } from '../utils/phone';
import { isAddonCategory, partitionProductsByAddonCategory } from '../utils/menuCategories';

export const CashierTab = () => {
  const { 
    products,
    ingredients,
    preparedStock,
    setIngredients,
    setPreparedStock,
    setOrders,
    setSales,
    shiftLogs,
    setShiftLogs,
    user, 
    t, 
    tp, 
    tc,
    addToast, 
    categories, 
    formatPrice,
    setActiveTab,
    businessSettings,
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
  const [flashSent, setFlashSent] = useState(false);

  useEffect(() => {
    if (orderType !== 'PreOrder') return;
    if (customerPhone.trim()) return;
    if (!businessSettings?.country) return;
    setCustomerPhone(applyCountryDialCode('', businessSettings.country));
  }, [orderType, businessSettings?.country]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const resolveProductName = (productId: number, fallback: string) => {
    const product = productMap.get(productId);
    return product ? tp(product) : fallback;
  };

  const { menuProducts, addonProducts } = useMemo(
    () => partitionProductsByAddonCategory(products),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuProducts.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      if (!query) return matchesCategory;
      const translated = toSearchValue(tp(p));
      const name = toSearchValue(p?.nameEN);
      const priceMatch = priceMatchesQuery(p?.price, query) || toSearchValue(p?.price).includes(query);
      const matchesSearch = translated.includes(query) || name.includes(query) || priceMatch;
      return matchesCategory && matchesSearch;
    });
  }, [menuProducts, selectedCategory, search, tp]);

  const activeCategories = useMemo(() => {
    return Array.from(new Set(menuProducts.map(p => p.category))).sort();
  }, [menuProducts]);

  const extras = addonProducts;

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
    const isExtra = isAddonCategory(p.category);

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

  const confirmOrder = (mode: 'kitchen' | 'complete' = 'kitchen') => {
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

    const items: SaleItem[] = cart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras }) => ({
      productId, nameEN, qty, unitPrice, lineTotal, extras
    }));

    const stock = checkStockAvailability(items, products, ingredients, preparedStock);
    if (!stock.ok) {
      addToast(t('insufficientStock').replace('{items}', stock.outOfStockItems.join(', ')), 'error');
      return;
    }

    const scheduledFor = orderType === 'PreOrder' ? `${scheduledDate}T${scheduledTime}` : undefined;
    const orderId = `ORDER-${Date.now()}`;

    if (mode === 'complete') {
      const result = finalizeSale({
        items,
        products,
        ingredients,
        preparedStock,
        shiftLogs,
        cashier: user,
        paymentMethod,
        timestamp: Date.now(),
      });
      if (!result.ok) {
        addToast(t('insufficientStock').replace('{items}', result.outOfStockItems?.join(', ') || t('items')), 'error');
        return;
      }
      setPreparedStock(result.updatedPreparedStock || preparedStock);
      setIngredients(result.updatedIngredients || ingredients);
      setSales(prev => [...prev, result.sale!]);
      setShiftLogs(result.updatedShiftLogs || shiftLogs);
      setOrders(prev => [{
        id: orderId,
        type: orderType,
        status: 'Completed',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        completedAt: Date.now(),
        saleId: result.sale!.id,
        scheduledFor,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items,
        subtotal,
        paymentMethod,
        createdByUsername: user.username,
        createdByFullName: user.fullName,
      }, ...prev]);
      addToast('Paid & completed — sale recorded.', 'success');
    } else {
      const newOrder: Order = {
        id: orderId,
        type: orderType,
        status: 'Preparing',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        scheduledFor,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items,
        subtotal,
        paymentMethod,
        createdByUsername: user.username,
        createdByFullName: user.fullName
      };
      setOrders(prev => [newOrder, ...prev]);
      setFlashSent(true);
      setTimeout(() => setFlashSent(false), 1800);
      addToast('Sent to kitchen ✓', 'success');
    }

    setCart([]);
    setCashReceived('');
    setOrderType('WalkIn');
    setCustomerName('');
    setCustomerPhone('');
    setScheduledDate('');
    setScheduledTime('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-140px)] pb-16 lg:pb-0 max-w-full overflow-hidden relative">
      {flashSent && (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center pointer-events-none">
          <div className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-lg animate-fade-in">
            Sent to kitchen
          </div>
        </div>
      )}

      {products.filter(p => p.active).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 min-h-[50vh]">
          <UtensilsCrossed className="text-bakery-brown/30" size={48} />
          <h2 className="text-xl font-bold text-bakery-brown">No menu items yet</h2>
          <p className="text-sm text-bakery-brown/50 max-w-sm">Add products or scan a menu to start taking orders.</p>
          <button
            onClick={() => setActiveTab('products')}
            className="px-6 py-3 rounded-2xl bg-bakery-brown text-white font-bold text-sm"
          >
            Open products
          </button>
        </div>
      ) : (
      <>
      <div className="order-2 lg:order-1 flex-1 flex flex-col gap-3 overflow-hidden min-h-[360px] lg:min-h-0">
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <div ref={pillContainerRef} className="flex-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide px-0.5">
            {['All', ...activeCategories].map(cat => {
              const isActive = selectedCategory === 'All' ? activeCategory === cat : selectedCategory === cat;
              return (
              <button 
                key={cat} 
                ref={setPillRef(cat)}
                onClick={() => handleCategoryClick(cat)}
                className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-colors active:scale-95 ${
                  isActive ? 'bg-bakery-brown text-white' : 'bg-white border border-bakery-beige text-bakery-brown hover:bg-bakery-cream/40'
                }`}
              >
                {cat === 'All' ? t('all') : tc(cat)}
              </button>
            );
            })}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={16} />
            <input 
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm bg-white"
            />
          </div>
        </div>
        <div ref={gridRef} className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {selectedCategory === 'All' ? (
              groupedProducts.map(group => (
                <React.Fragment key={group.category}>
                  <div ref={setCategoryHeadingRef(group.category)} className="col-span-full flex items-center gap-2 pt-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-bakery-brown/50">{tc(group.category)}</h4>
                    <div className="h-px bg-bakery-beige flex-1" />
                  </div>
                  {group.items.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => handleProductClick(p)}
                      className="bg-white border border-bakery-beige p-3 flex flex-col items-center text-center hover:border-bakery-caramel active:scale-95 min-h-[100px] justify-center rounded-xl"
                    >
                      <span className="text-2xl sm:text-3xl mb-1">{p.emoji}</span>
                      <p className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2">{tp(p)}</p>
                      <p className="text-bakery-brown font-black text-xs sm:text-sm mt-1">{formatPrice(p.price)}</p>
                    </button>
                  ))}
                </React.Fragment>
              ))
            ) : (
              filteredProducts.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => handleProductClick(p)}
                  className="bg-white border border-bakery-beige p-3 flex flex-col items-center text-center hover:border-bakery-caramel active:scale-95 min-h-[100px] justify-center rounded-xl"
                >
                  <span className="text-2xl sm:text-3xl mb-1">{p.emoji}</span>
                  <p className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2">{tp(p)}</p>
                  <p className="text-bakery-brown font-black text-xs sm:text-sm mt-1">{formatPrice(p.price)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="order-1 lg:order-2 w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-3 shrink-0">
        <div className="bg-white border border-bakery-beige rounded-xl p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-bold text-bakery-brown">{t('orderDetails')}</h3>
            </div>
            <div className="flex items-center gap-1 bg-bakery-beige p-1 rounded-xl">
              <button
                onClick={() => setOrderType('WalkIn')}
                className={`px-3 py-1.5 rounded text-xs font-bold ${orderType === 'WalkIn' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/70'}`}
              >
                {t('walkIn')}
              </button>
              <button
                onClick={() => setOrderType('PreOrder')}
                className={`px-3 py-1.5 rounded text-xs font-bold ${orderType === 'PreOrder' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/70'}`}
              >
                {t('preOrder')}
              </button>
            </div>
          </div>

          {orderType === 'PreOrder' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('customerName')}</label>
                <input type="text" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('phoneNumber')}</label>
                <input
                  type="tel"
                  className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  onFocus={() => {
                    if (!customerPhone.trim() && businessSettings?.country) {
                      setCustomerPhone(applyCountryDialCode('', businessSettings.country));
                    }
                  }}
                  placeholder={`${getDialCode(businessSettings?.country) || '+'} …`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('pickupDate')}</label>
                <input type="date" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('pickupTime')}</label>
                <input type="time" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-bakery-beige rounded-xl flex-1 flex flex-col overflow-hidden max-h-[560px] lg:max-h-none">
          <div className="p-3 sm:p-4 border-b border-bakery-beige flex justify-between items-center bg-bakery-cream/40">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-bakery-brown" />
              <h3 className="text-base font-bold text-bakery-brown">{t('cart')}</h3>
            </div>
            <span className="bg-bakery-brown text-white px-2.5 py-0.5 rounded text-xs font-bold">{cart.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-1 border-b border-bakery-beige/50 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs sm:text-sm truncate">{tp(item as any)}</p>
                    {item.extras?.map(e => (
                      <p key={e.productId} className="text-[10px] text-bakery-brown/50 font-semibold truncate">+ {resolveProductName(e.productId, e.nameEN)}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.id, -1)} className="w-9 h-9 rounded-xl bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/80 active:scale-90">-</button>
                    <span className="font-bold w-5 text-center text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-9 h-9 rounded-xl bg-bakery-beige flex items-center justify-center font-bold hover:bg-bakery-beige/80 active:scale-90">+</button>
                  </div>
                  <p className="font-bold text-xs sm:text-sm w-14 text-right shrink-0">{formatPrice(item.lineTotal)}</p>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-12">
                <p className="italic font-medium text-sm">{t('emptyCart')}</p>
              </div>
            )}
          </div>
          <div className="p-3 sm:p-4 bg-bakery-cream/40 border-t border-bakery-beige space-y-3">
            <div className="flex justify-between items-center text-lg font-black">
              <span>{t('subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPaymentMethod('Card')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
                  paymentMethod === 'Card' ? 'bg-bakery-brown text-white' : 'bg-white border border-bakery-beige text-bakery-brown'
                }`}
              >
                <CreditCard size={14} />
                {t('card')}
              </button>
              <button 
                onClick={() => setPaymentMethod('Cash')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
                  paymentMethod === 'Cash' ? 'bg-bakery-brown text-white' : 'bg-white border border-bakery-beige text-bakery-brown'
                }`}
              >
                <Banknote size={14} />
                {t('cash')}
              </button>
            </div>
            {paymentMethod === 'Cash' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('cashReceived')}</p>
                  <input type="number" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('change')}</p>
                  <div className={`p-2.5 rounded-xl font-bold text-base ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formatPrice(isNaN(change) ? 0 : change)}
                  </div>
                </div>
              </div>
            )}
            <button 
              disabled={cart.length === 0 || (paymentMethod === 'Cash' && (isNaN(change) || change < 0))}
              onClick={() => confirmOrder('kitchen')}
              className="w-full bg-bakery-brown text-white p-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('confirmOrder')} · Kitchen
            </button>
            {orderType === 'WalkIn' && (
              <button
                disabled={cart.length === 0 || (paymentMethod === 'Cash' && (isNaN(change) || change < 0))}
                onClick={() => confirmOrder('complete')}
                className="w-full border-2 border-bakery-brown text-bakery-brown p-3 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                Pay & complete now
              </button>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {extraModalItem && (
        <Modal title={t('addExtras')} onClose={() => setExtraModalItem(null)}>
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-bakery-cream/40 rounded-2xl border border-bakery-beige">
              <span className="text-4xl">{extraModalItem.emoji}</span>
              <div>
                <p className="font-bold text-lg">{tp(extraModalItem)}</p>
                <p className="text-bakery-brown font-black">{formatPrice(extraModalItem.price)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {extras.map(e => (
                <label key={e.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer ${
                  selectedExtras.find(se => se.id === e.id) ? 'border-bakery-brown bg-bakery-cream/40' : 'border-bakery-beige'
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
                  {selectedExtras.find(se => se.id === e.id) && <Plus size={16} />}
                </label>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setSelectedExtras([]); addToCart(); }}
                className="flex-1 py-4 rounded-2xl font-bold text-bakery-brown/50"
              >
                {t('skip')}
              </button>
              <button 
                onClick={addToCart}
                className="flex-1 bg-bakery-brown text-white py-4 rounded-2xl font-bold"
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
