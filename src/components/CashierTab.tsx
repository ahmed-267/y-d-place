import { PasswordInput } from './PasswordInput';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { ShoppingCart, CreditCard, Banknote, Plus, Search, Zap, UtensilsCrossed, Printer, Wallet } from 'lucide-react';
import { Order, OrderType, Product, SaleItem, normalizeEnabledModules, normalizeFloorPlan } from '../types';
import { findCustomerByPhone, upsertCustomerFromOrder } from '../utils/customers';
import { evaluateDiscount, verifyManagerPassword } from '../utils/discountPolicy';
import { Modal } from './Modal';
import { toSearchValue, priceMatchesQuery } from '../utils/search';
import { checkStockAvailability, remainingYieldForProduct, calculateStockNeeds } from '../utils/stock';
import { finalizeSale } from '../utils/sales';
import { applyCountryDialCode, getDialCode } from '../utils/phone';
import { isAddonCategory, partitionProductsByAddonCategory } from '../utils/menuCategories';
import { computeDiscountAmount, salePayable, paymentMethodLabel } from '../utils/ticketMoney';
import { downloadZReport } from '../utils/tickets';
import { tillTotals } from '../utils/till';

type CartLine = SaleItem & { emoji: string; transKey: string; id: number };
type PaymentChoice = 'Cash' | 'Card' | 'Split';

const LAST_EXTRAS_KEY = 'previsio_last_extras';

const formatDiscountAmount = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '';
  return (Math.round(n * 100) / 100).toFixed(2);
};

const formatDiscountPercent = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n * 100) / 100);
};

const loadLastExtrasMap = (): Record<string, number[]> => {
  try {
    return JSON.parse(localStorage.getItem(LAST_EXTRAS_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const saveLastExtras = (productId: number, extraIds: number[]) => {
  try {
    const map = loadLastExtrasMap();
    map[String(productId)] = extraIds;
    localStorage.setItem(LAST_EXTRAS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

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
    sales,
    openTill,
    closeTill,
    openCashSession,
    recordSale,
    saveOrder,
    orders,
    floorPlan,
    setFloorPlan,
    pendingTableSession,
    setPendingTableSession,
    users,
    customers,
    setCustomers,
    isDemoMode,
  } = useApp();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('WalkIn');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>('Card');
  const [cashReceived, setCashReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [extraModalItem, setExtraModalItem] = useState<Product | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Product[]>([]);
  const [flashSent, setFlashSent] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  /** Which field the cashier last edited — keeps % and € in sync when the cart total changes. */
  const [discountSource, setDiscountSource] = useState<'percent' | 'amount' | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [lineNoteDraft, setLineNoteDraft] = useState<Record<number, string>>({});
  const [showTillOpen, setShowTillOpen] = useState(false);
  const [showTillClose, setShowTillClose] = useState(false);
  const [floatInput, setFloatInput] = useState('50');
  const [countedInput, setCountedInput] = useState('');
  const [tableId, setTableId] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [covers, setCovers] = useState('2');
  const [resumeOrderId, setResumeOrderId] = useState<string | undefined>();
  const [discountApprovedBy, setDiscountApprovedBy] = useState<string | undefined>();
  const [showManagerApproval, setShowManagerApproval] = useState(false);
  const [pendingConfirmMode, setPendingConfirmMode] = useState<'kitchen' | 'complete' | null>(null);
  const [managerUser, setManagerUser] = useState('');
  const [managerPass, setManagerPass] = useState('');

  useEffect(() => {
    if (orderType !== 'PreOrder') return;
    if (customerPhone.trim()) return;
    if (!businessSettings?.country) return;
    setCustomerPhone(applyCountryDialCode('', businessSettings.country));
  }, [orderType, businessSettings?.country]);

  const tablesEnabled = normalizeEnabledModules(businessSettings?.enabledModules).tables;
  const customersEnabled = normalizeEnabledModules(businessSettings?.enabledModules).customers;
  const tipsEnabled = normalizeEnabledModules(businessSettings?.enabledModules).tips;
  const floor = normalizeFloorPlan(floorPlan);

  useEffect(() => {
    if (!pendingTableSession) return;
    setOrderType('DineIn');
    setTableId(pendingTableSession.tableId);
    setTableLabel(pendingTableSession.tableLabel);
    if (pendingTableSession.covers) setCovers(String(pendingTableSession.covers));
    if (pendingTableSession.resumeOrderId) {
      const existing = orders.find(o => o.id === pendingTableSession.resumeOrderId);
      setResumeOrderId(pendingTableSession.resumeOrderId);
      if (existing) {
        setCart(
          existing.items.map((item, idx) => ({
            ...item,
            id: Date.now() + idx,
            emoji: products.find(p => p.id === item.productId)?.emoji || '🍽️',
            transKey: products.find(p => p.id === item.productId)?.transKey || '',
          }))
        );
        if (existing.discountPercent) {
          setDiscountPercent(String(existing.discountPercent));
          setDiscountSource('percent');
        }
        if (existing.discountAmount) {
          setDiscountAmount(String(existing.discountAmount));
          if (!existing.discountPercent) setDiscountSource('amount');
        }
        if (existing.tipAmount) setTipAmount(String(existing.tipAmount));
        if (existing.paymentMethod) setPaymentMethod(existing.paymentMethod as PaymentChoice);
      }
    }
    setPendingTableSession(null);
  }, [pendingTableSession]);

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

  const extrasForProduct = (p: Product) => {
    // Only extras explicitly linked on the product — never dump every add-on onto every item.
    if (!p.extraIds?.length) return [];
    return addonProducts.filter(a => a.active !== false && p.extraIds!.includes(a.id));
  };

  const cartItems: SaleItem[] = cart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note }) => ({
    productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note,
  }));
  const subtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);

  useEffect(() => {
    if (!discountSource) return;
    if (discountSource === 'percent') {
      const pct = parseFloat(discountPercent) || 0;
      if (pct <= 0) {
        if (discountAmount) setDiscountAmount('');
        return;
      }
      const next = formatDiscountAmount(Math.min(subtotal, (subtotal * pct) / 100));
      if (next !== discountAmount) setDiscountAmount(next);
      return;
    }
    const amt = parseFloat(discountAmount) || 0;
    if (amt <= 0 || subtotal <= 0) {
      if (discountPercent) setDiscountPercent('');
      return;
    }
    const next = formatDiscountPercent(Math.min(100, (Math.min(amt, subtotal) / subtotal) * 100));
    if (next !== discountPercent) setDiscountPercent(next);
  }, [subtotal, discountSource, discountPercent, discountAmount]);

  const discountValue = computeDiscountAmount(
    subtotal,
    parseFloat(discountPercent) || 0,
    parseFloat(discountAmount) || 0
  );
  const tipValue = tipsEnabled ? Math.max(0, parseFloat(tipAmount) || 0) : 0;
  const payable = Math.max(0, subtotal - discountValue) + tipValue;
  const splitCashNum = Math.max(0, parseFloat(splitCash) || 0);
  const splitCardNum = Math.max(0, parseFloat(splitCard) || 0);
  const splitMatches =
    paymentMethod !== 'Split' || Math.abs(splitCashNum + splitCardNum - payable) < 0.02;
  const cashPortion =
    paymentMethod === 'Cash' ? payable : paymentMethod === 'Split' ? splitCashNum : 0;
  const change =
    paymentMethod === 'Cash'
      ? parseFloat(cashReceived) - payable
      : paymentMethod === 'Split' && cashPortion > 0
        ? parseFloat(cashReceived || String(cashPortion)) - cashPortion
        : 0;
  const needsOpenTill = cashPortion > 0;
  const paymentReady =
    cart.length > 0 &&
    (paymentMethod === 'Card' ||
      (paymentMethod === 'Cash' && !isNaN(change) && change >= 0) ||
      (paymentMethod === 'Split' && splitMatches && cashPortion >= 0 && (cashPortion === 0 || (!isNaN(change) && change >= 0))));

  const clearTicketFields = () => {
    setCart([]);
    setCashReceived('');
    setSplitCash('');
    setSplitCard('');
    setOrderType('WalkIn');
    setCustomerName('');
    setCustomerPhone('');
    setScheduledDate('');
    setScheduledTime('');
    setDiscountPercent('');
    setDiscountAmount('');
    setDiscountSource(null);
    setTipAmount('');
    setLineNoteDraft({});
    setPaymentMethod('Card');
    setTableId('');
    setTableLabel('');
    setCovers('2');
    setResumeOrderId(undefined);
    setDiscountApprovedBy(undefined);
  };

  const recipeNeeds = useMemo(
    () => calculateStockNeeds(cartItems, products),
    [cart, products]
  );
  const recipeLines = useMemo(() => {
    const lines: string[] = [];
    Object.entries(recipeNeeds.neededPrepped).forEach(([id, qty]) => {
      const ps = preparedStock.find(p => p.id === Number(id));
      if (ps && qty) lines.push(`${qty} ${t('portionsAbbr') || 'portions'} ${ps.name}`);
    });
    Object.entries(recipeNeeds.neededIngredients).forEach(([id, qty]) => {
      const ing = ingredients.find(i => i.id === Number(id));
      if (ing && qty) lines.push(`${qty}${ing.unit ? ` ${ing.unit}` : ''} ${ing.name}`);
    });
    return lines.slice(0, 4);
  }, [recipeNeeds, preparedStock, ingredients, t]);

  const ticketLabels = () => ({
    receipt: t('receipt'),
    kitchenTicket: t('kitchenTicket'),
    subtotal: t('subtotal'),
    discount: t('discount'),
    tip: t('tip'),
    total: t('total') || 'Total',
    payment: t('payment'),
    cardRecorded: t('cardRecorded'),
    cash: t('cash'),
    cashReceived: t('cashReceived'),
    change: t('change'),
    refunded: t('refunded'),
    thankYou: t('thankYou'),
    walkIn: t('walkIn'),
    preOrder: t('preOrder'),
    pickupTime: t('pickupTime'),
    zReport: t('zReport'),
  });

  const groupedProducts = useMemo(() => {
    if (selectedCategory !== 'All') return [];
    return activeCategories
      .map(cat => ({ category: cat, items: filteredProducts.filter(p => p.category === cat) }))
      .filter(group => group.items.length > 0);
  }, [selectedCategory, activeCategories, filteredProducts]);

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
    const yieldLeft = remainingYieldForProduct(p, ingredients, preparedStock);
    if (yieldLeft === 0) {
      addToast(t('soldOut'), 'error');
      return;
    }
    const availableExtras = extrasForProduct(p);
    const isExtra = isAddonCategory(p.category);

    if (isExtra || availableExtras.length === 0) {
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
      const rememberedIds = loadLastExtrasMap()[String(p.id)] || [];
      const available = extrasForProduct(p);
      setSelectedExtras(available.filter(a => rememberedIds.includes(a.id)));
      setLineNoteDraft(prev => ({ ...prev, [-1]: '' }));
    }
  };

  const addToCart = () => {
    if (!extraModalItem) return;

    const itemTotal = extraModalItem.price + selectedExtras.reduce((acc, e) => acc + e.price, 0);
    const extrasPayload = selectedExtras.map(e => ({ productId: e.id, nameEN: e.nameEN, price: e.price }));
    const note = extraModalItem ? lineNoteDraft[-1] : undefined;

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
        extras: extrasPayload,
        note,
      };
      setCart([...cart, newItem]);
    }

    setExtraModalItem(null);
    if (extraModalItem) {
      saveLastExtras(extraModalItem.id, extrasPayload.map(e => e.productId));
      setLineNoteDraft(prev => ({ ...prev, [-1]: '' }));
    }
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
    if (delta > 0) {
      const stock = checkStockAvailability(
        newCart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note }) => ({
          productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note,
        })),
        products,
        ingredients,
        preparedStock
      );
      if (!stock.ok) {
        addToast(t('soldOut'), 'error');
        return;
      }
    }
    setCart(newCart);
  };

  const approvalTokenRef = useRef<string | undefined>(undefined);
  const confirmingRef = useRef(false);
  const pendingSaleRef = useRef<string | null>(null);
  const confirmOrder = async (mode: 'kitchen' | 'complete' = 'kitchen', approvedByOverride?: string) => {
    if (!user || confirmingRef.current) return;
    if (paymentMethod === 'Split' && !splitMatches) {
      addToast(t('splitMustMatch'), 'error');
      return;
    }
    if (needsOpenTill && (isNaN(change) || change < 0)) {
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
    if (orderType === 'DineIn' && !(tableId || tableLabel.trim())) {
      addToast(t('noTableSelected'), 'error');
      return;
    }

    const approvedBy = approvedByOverride || discountApprovedBy;
    const discountGate = evaluateDiscount(
      user.role,
      { discountValue, discountPercent: parseFloat(discountPercent) || 0 },
      businessSettings?.discountPolicy
    );
    if (!discountGate.ok) {
      addToast(t('discountBlocked'), 'error');
      return;
    }
    if (discountGate.needsApproval && !approvedBy) {
      setPendingConfirmMode(mode);
      setShowManagerApproval(true);
      return;
    }

    const items: SaleItem[] = cart.map(({ productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note }) => ({
      productId, nameEN, qty, unitPrice, lineTotal, extras: ex, note
    }));

    const stock = checkStockAvailability(items, products, ingredients, preparedStock);
    if (!stock.ok) {
      addToast(t('insufficientStock').replace('{items}', stock.outOfStockItems.join(', ')), 'error');
      return;
    }

    const scheduledFor = orderType === 'PreOrder' ? `${scheduledDate}T${scheduledTime}` : undefined;
    const orderId = resumeOrderId || pendingSaleRef.current || `ORDER-${crypto.randomUUID()}`;
    pendingSaleRef.current = orderId;
    const tableMeta = orderType === 'DineIn' ? {
      tableId: tableId || undefined,
      tableLabel: tableLabel.trim() || floorPlan.tables.find(tb => tb.id === tableId)?.label,
      covers: Math.max(1, parseInt(covers, 10) || 1),
    } : {};
    const cashAmount = paymentMethod === 'Split' ? splitCashNum : paymentMethod === 'Cash' ? payable : undefined;
    const cardAmount = paymentMethod === 'Split' ? splitCardNum : paymentMethod === 'Card' ? payable : undefined;
    const tendered =
      needsOpenTill
        ? parseFloat(cashReceived) || cashPortion
        : undefined;
    const changeGiven = needsOpenTill ? change : undefined;

    if (mode === 'complete') {
      const matchedCustomer = findCustomerByPhone(customers, customerPhone);
      const result = finalizeSale({
        items,
        products,
        ingredients,
        preparedStock,
        shiftLogs,
        cashier: user,
        paymentMethod,
        timestamp: Date.now(),
        existingSaleId: `SALE-${orderId}`,
        discountPercent: parseFloat(discountPercent) || 0,
        discountAmount: discountValue,
        tipAmount: tipValue,
        tenderedCash: tendered,
        changeGiven,
        cashAmount,
        cardAmount,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerId: matchedCustomer?.id,
      });
      if (!result.ok) {
        addToast(t('insufficientStock').replace('{items}', result.outOfStockItems?.join(', ') || t('items')), 'error');
        return;
      }

      const saleWithApproval = {
        ...result.sale!,
        discountApprovedByUsername: approvedBy,
        discountApprovalToken: approvalTokenRef.current,
      };

      const completedOrder: Order = {
          id: orderId,
          type: orderType,
          status: 'Completed' as const,
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
          completedAt: Date.now(),
          saleId: result.sale!.id,
          scheduledFor,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerId: matchedCustomer?.id || result.sale!.customerId,
          items,
          subtotal,
          discountPercent: parseFloat(discountPercent) || 0,
          discountAmount: discountValue,
          tipAmount: tipValue,
          tenderedCash: tendered,
          changeGiven,
          paymentMethod,
          cashAmount,
          cardAmount,
          ...tableMeta,
          discountApprovedByUsername: approvedBy,
        discountApprovalToken: approvalTokenRef.current,
          createdByUsername: user.username,
          createdByFullName: user.fullName,
        };
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      try {
        if (!await recordSale(saleWithApproval, completedOrder)) return;
        if (isDemoMode) {
          setPreparedStock(result.updatedPreparedStock || preparedStock);
          setIngredients(result.updatedIngredients || ingredients);
        }
      } finally { confirmingRef.current = false; }
      if (customersEnabled && (customerPhone.trim() || customerName.trim())) {
        setCustomers(prev =>
          upsertCustomerFromOrder(prev, {
            name: customerName,
            phone: customerPhone,
            at: Date.now(),
          }).customers
        );
      }
      setShiftLogs(result.updatedShiftLogs || shiftLogs);
      if (orderType === 'DineIn' && tableId) {
        setFloorPlan(prev => ({
          ...prev,
          tables: prev.tables.map(tb =>
            tb.id === tableId ? { ...tb, dirty: true, seatedAt: undefined } : tb
          ),
        }));
      }
      addToast(t('paidAndCompleted'), 'success');
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
        discountPercent: parseFloat(discountPercent) || 0,
        discountAmount: discountValue,
        tipAmount: tipValue,
        paymentMethod,
        cashAmount,
        cardAmount,
        ...tableMeta,
        discountApprovedByUsername: approvedBy,
        discountApprovalToken: approvalTokenRef.current,
        createdByUsername: user.username,
        createdByFullName: user.fullName,
        kitchenPrintedAt: Date.now(),
      };
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      try { if (!await saveOrder(newOrder)) return; }
      finally { confirmingRef.current = false; }
      setFlashSent(true);
      setTimeout(() => setFlashSent(false), 1800);
      addToast(t('sentToKitchen'), 'success');
    }

    pendingSaleRef.current = null;
    approvalTokenRef.current = undefined;
    clearTicketFields();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-140px)] pb-16 lg:pb-0 max-w-full overflow-hidden relative">
      {flashSent && (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center pointer-events-none">
          <div className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-lg animate-fade-in">
            {t('sentToKitchenFlash')}
          </div>
        </div>
      )}

      {products.filter(p => p.active).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 min-h-[50vh]">
          <UtensilsCrossed className="text-bakery-brown/30" size={48} />
          <h2 className="text-xl font-bold text-bakery-brown">{t('noMenuItemsYet')}</h2>
          <p className="text-sm text-bakery-brown/50 max-w-sm">{t('addMenuToSell')}</p>
          <button
            onClick={() => setActiveTab('products')}
            className="px-6 py-3 rounded-2xl bg-bakery-brown text-white font-bold text-sm"
          >
            {t('openProducts')}
          </button>
        </div>
      ) : (
      <>
      <div className="order-1 flex-1 flex flex-col gap-3 overflow-hidden min-h-[360px] lg:min-h-0">
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
          {menuProducts.some(p => p.isFavourite && p.active !== false) && (
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1.5 px-0.5">{t('favourites')}</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {menuProducts.filter(p => p.isFavourite && p.active !== false).map(p => {
                  const left = remainingYieldForProduct(p, ingredients, preparedStock);
                  const soldOut = left === 0;
                  return (
                    <button
                      key={`fav-${p.id}`}
                      type="button"
                      disabled={soldOut}
                      onClick={() => handleProductClick(p)}
                      className={`shrink-0 w-[88px] bg-white border border-bakery-beige p-2 flex flex-col items-center rounded-xl transition-all hover:border-bakery-caramel hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${soldOut ? 'opacity-40' : ''}`}
                      style={p.posColor ? { backgroundColor: `${p.posColor}14` } : undefined}
                    >
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-[10px] font-bold truncate w-full text-center mt-0.5">{tp(p)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {selectedCategory === 'All' ? (
              groupedProducts.map(group => (
                <React.Fragment key={group.category}>
                  <div ref={setCategoryHeadingRef(group.category)} className="col-span-full flex items-center gap-2 pt-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-bakery-brown/50">{tc(group.category)}</h4>
                    <div className="h-px bg-bakery-beige flex-1" />
                  </div>
                  {group.items.map(p => {
                    const left = remainingYieldForProduct(p, ingredients, preparedStock);
                    const soldOut = left === 0;
                    return (
                    <button 
                      key={p.id} 
                      disabled={soldOut}
                      onClick={() => handleProductClick(p)}
                      className={`bg-white border border-bakery-beige p-3 flex flex-col items-center text-center transition-all hover:border-bakery-caramel hover:shadow-md hover:-translate-y-0.5 active:scale-95 min-h-[100px] justify-center rounded-xl ${soldOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                      style={p.posColor ? { backgroundColor: `${p.posColor}12` } : undefined}
                    >
                      <span className="text-2xl sm:text-3xl mb-1">{p.emoji}</span>
                      <p className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2">{tp(p)}</p>
                      <p className="text-bakery-brown font-black text-xs sm:text-sm mt-1">{formatPrice(p.price)}</p>
                      {soldOut && <p className="text-[9px] font-bold text-rose-600 mt-1">{t('soldOut')}</p>}
                      {left != null && left > 0 && left <= 5 && (
                        <p className="text-[9px] text-bakery-brown/45">{t('remainingYield').replace('{count}', String(left))}</p>
                      )}
                    </button>
                    );
                  })}
                </React.Fragment>
              ))
            ) : (
              filteredProducts.map(p => {
                const left = remainingYieldForProduct(p, ingredients, preparedStock);
                const soldOut = left === 0;
                return (
                <button 
                  key={p.id}
                  disabled={soldOut}
                  onClick={() => handleProductClick(p)}
                  className={`bg-white border border-bakery-beige p-3 flex flex-col items-center text-center transition-all hover:border-bakery-caramel hover:shadow-md hover:-translate-y-0.5 active:scale-95 min-h-[100px] justify-center rounded-xl ${soldOut ? 'opacity-40 cursor-not-allowed' : ''}`}
                  style={p.posColor ? { backgroundColor: `${p.posColor}12` } : undefined}
                >
                  <span className="text-2xl sm:text-3xl mb-1">{p.emoji}</span>
                  <p className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2">{tp(p)}</p>
                  <p className="text-bakery-brown font-black text-xs sm:text-sm mt-1">{formatPrice(p.price)}</p>
                      {soldOut && <p className="text-[9px] font-bold text-rose-600 mt-1">{t('soldOut')}</p>}
                  {left != null && left > 0 && left <= 5 && (
                    <p className="text-[9px] text-bakery-brown/45">{t('remainingYield').replace('{count}', String(left))}</p>
                  )}
                </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="order-2 w-full lg:w-[420px] xl:w-[480px] flex flex-col gap-3 shrink-0">
        <div className="bg-white border border-bakery-beige rounded-xl p-3 sm:p-4">
          <div className="space-y-3 mb-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-bakery-brown shrink-0">{t('orderDetails')}</h3>
              {(user?.role === 'owner' || user?.role === 'manager') && (
                <button
                  type="button"
                  onClick={() => (openCashSession ? setShowTillClose(true) : setShowTillOpen(true))}
                  className="h-8 px-2.5 rounded-lg border border-bakery-beige text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Wallet size={12} />
                  {openCashSession ? t('closeTill') : t('openTill')}
                </button>
              )}
            </div>
            <div className="flex items-stretch gap-1 bg-bakery-beige p-1 rounded-xl">
              <button
                onClick={() => setOrderType('WalkIn')}
                className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${orderType === 'WalkIn' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/70'}`}
              >
                {t('walkIn')}
              </button>
              {tablesEnabled && (
                <button
                  onClick={() => setOrderType('DineIn')}
                  className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${orderType === 'DineIn' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/70'}`}
                >
                  {t('dineIn')}
                </button>
              )}
              <button
                onClick={() => setOrderType('PreOrder')}
                className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${orderType === 'PreOrder' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/70'}`}
              >
                {t('preOrder')}
              </button>
            </div>
          </div>

          {orderType === 'PreOrder' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('customerName')}</label>
                <input type="text" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} list={customersEnabled ? 'cashier-customer-names' : undefined} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('phoneNumber')}</label>
                <input
                  type="tel"
                  className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={customerPhone}
                  list={customersEnabled ? 'cashier-customer-phones' : undefined}
                  onChange={e => {
                    const v = e.target.value;
                    setCustomerPhone(v);
                    if (!customersEnabled) return;
                    const hit = findCustomerByPhone(customers, v);
                    if (hit) {
                      setCustomerName(hit.name);
                      if (hit.allergies) addToast(`${t('customerAllergies')}: ${hit.allergies}`, 'info');
                    }
                  }}
                  onFocus={() => {
                    if (!customerPhone.trim() && businessSettings?.country) {
                      setCustomerPhone(applyCountryDialCode('', businessSettings.country));
                    }
                  }}
                  placeholder={`${getDialCode(businessSettings?.country) || '+'} …`}
                />
                {customersEnabled && (
                  <>
                    <datalist id="cashier-customer-phones">
                      {customers.map(c => (
                        <option key={c.id} value={c.phone}>{c.name}</option>
                      ))}
                    </datalist>
                    <datalist id="cashier-customer-names">
                      {customers.map(c => (
                        <option key={`n-${c.id}`} value={c.name}>{c.phone}</option>
                      ))}
                    </datalist>
                  </>
                )}
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

          {orderType === 'DineIn' && tablesEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('selectTable')}</label>
                <select
                  className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none text-sm font-bold"
                  value={tableId}
                  onChange={e => {
                    const id = e.target.value;
                    setTableId(id);
                    const tb = floorPlan.tables.find(x => x.id === id);
                    setTableLabel(tb?.label || '');
                  }}
                >
                  <option value="">{t('selectTable')}</option>
                  {floor.useSections
                    ? floor.sections.map(section => (
                        <optgroup key={section.id} label={section.name}>
                          {floor.tables
                            .filter(tb => tb.sectionId === section.id)
                            .map(tb => (
                              <option key={tb.id} value={tb.id}>
                                {tb.label} ({tb.seats} {t('seatsShort')})
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : floor.tables.map(tb => (
                        <option key={tb.id} value={tb.id}>
                          {tb.label} ({tb.seats} {t('seatsShort')})
                        </option>
                      ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('covers')}</label>
                <input type="number" min={1} className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none text-sm font-bold" value={covers} onChange={e => setCovers(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-bakery-beige rounded-xl flex-1 flex flex-col overflow-hidden max-h-[560px] lg:max-h-none">
          <div className="p-3 sm:p-4 border-b border-bakery-beige flex justify-between items-center bg-bakery-cream/40 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart size={18} className="text-bakery-brown shrink-0" />
              <h3 className="text-base font-bold text-bakery-brown">{t('cart')}</h3>
              <span className="bg-bakery-brown text-white px-2.5 py-0.5 rounded text-xs font-bold">{cart.length}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
            </div>
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
                    <input
                      type="text"
                      className="mt-1 w-full text-[10px] p-1.5 border border-bakery-beige rounded-lg outline-none"
                      placeholder={t('lineNotePlaceholder')}
                      value={item.note || ''}
                      onChange={e => {
                        const note = e.target.value;
                        setCart(prev => prev.map(c => c.id === item.id ? { ...c, note } : c));
                      }}
                    />
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
            {recipeLines.length > 0 && (
              <p className="text-[10px] text-bakery-brown/50 leading-snug">
                {t('recipeThisTicket')}: {recipeLines.join(' · ')}
              </p>
            )}
            <div className={`grid gap-2 ${tipsEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <p className="text-[9px] font-black uppercase text-bakery-brown/40 mb-1">{t('discountPercent')}</p>
                <input
                  type="number"
                  className="w-full p-2 border border-bakery-beige rounded-lg text-xs font-bold"
                  value={discountPercent}
                  onChange={e => {
                    const v = e.target.value;
                    setDiscountPercent(v);
                    setDiscountSource('percent');
                    const pct = parseFloat(v);
                    if (!v || Number.isNaN(pct) || pct <= 0) {
                      setDiscountAmount('');
                      return;
                    }
                    setDiscountAmount(formatDiscountAmount(Math.min(subtotal, (subtotal * pct) / 100)));
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-bakery-brown/40 mb-1">{t('discountAmount')}</p>
                <input
                  type="number"
                  className="w-full p-2 border border-bakery-beige rounded-lg text-xs font-bold"
                  value={discountAmount}
                  onChange={e => {
                    const v = e.target.value;
                    setDiscountAmount(v);
                    setDiscountSource('amount');
                    const amt = parseFloat(v);
                    if (!v || Number.isNaN(amt) || amt <= 0 || subtotal <= 0) {
                      setDiscountPercent('');
                      return;
                    }
                    setDiscountPercent(formatDiscountPercent(Math.min(100, (Math.min(amt, subtotal) / subtotal) * 100)));
                  }}
                  placeholder="0"
                />
              </div>
              {tipsEnabled && (
                <div>
                  <p className="text-[9px] font-black uppercase text-bakery-brown/40 mb-1">{t('tip')}</p>
                  <input type="number" className="w-full p-2 border border-bakery-beige rounded-lg text-xs font-bold" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-bakery-brown/60">{t('subtotal')}</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between items-center text-sm text-rose-700">
                <span>{t('discount')}</span>
                <span>−{formatPrice(discountValue)}</span>
              </div>
            )}
            {tipValue > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span>{t('tip')}</span>
                <span>{formatPrice(tipValue)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-black">
              <span>{t('total') || 'Total'}</span>
              <span>{formatPrice(payable)}</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPaymentMethod('Card')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${
                  paymentMethod === 'Card' ? 'bg-bakery-brown text-white' : 'bg-white border border-bakery-beige text-bakery-brown'
                }`}
              >
                <CreditCard size={14} />
                {t('cardRecorded')}
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
              <button
                onClick={() => {
                  setPaymentMethod('Split');
                  if (!splitCash && !splitCard) {
                    const half = Math.round((payable / 2) * 100) / 100;
                    setSplitCash(String(half));
                    setSplitCard(String(Math.max(0, Math.round((payable - half) * 100) / 100)));
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${
                  paymentMethod === 'Split' ? 'bg-bakery-brown text-white' : 'bg-white border border-bakery-beige text-bakery-brown'
                }`}
              >
                {t('splitTender')}
              </button>
            </div>
            {paymentMethod === 'Card' && (
              <p className="text-[10px] text-bakery-brown/45">{t('cardRecordedHint')}</p>
            )}
            {paymentMethod === 'Split' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('cashPortion')}</p>
                  <input
                    type="number"
                    className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm"
                    value={splitCash}
                    onChange={e => {
                      const v = e.target.value;
                      setSplitCash(v);
                      const cash = Math.max(0, parseFloat(v) || 0);
                      setSplitCard(String(Math.max(0, Math.round((payable - cash) * 100) / 100)));
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('cardPortion')}</p>
                  <input
                    type="number"
                    className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm"
                    value={splitCard}
                    onChange={e => {
                      const v = e.target.value;
                      setSplitCard(v);
                      const card = Math.max(0, parseFloat(v) || 0);
                      setSplitCash(String(Math.max(0, Math.round((payable - card) * 100) / 100)));
                    }}
                    placeholder="0.00"
                  />
                </div>
                {!splitMatches && (
                  <p className="col-span-2 text-[10px] text-rose-600 font-bold">{t('splitMustMatch')}</p>
                )}
              </div>
            )}
            {(paymentMethod === 'Cash' || (paymentMethod === 'Split' && cashPortion > 0)) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 mb-1">{t('cashReceived')}</p>
                  <input type="number" className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder={paymentMethod === 'Split' ? String(cashPortion || '0.00') : '0.00'} />
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
              disabled={!paymentReady}
              onClick={() => confirmOrder('kitchen')}
              className="w-full bg-bakery-brown text-white p-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('confirmOrder')} · Kitchen
            </button>
            {(orderType === 'WalkIn' || orderType === 'DineIn') && (
              <button
                disabled={!paymentReady}
                onClick={() => confirmOrder('complete')}
                className="w-full border-2 border-bakery-brown text-bakery-brown p-3 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                {t('payAndComplete')}
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
              {extrasForProduct(extraModalItem).map(e => (
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

            {(loadLastExtrasMap()[String(extraModalItem.id)] || []).length > 0 && (
              <p className="text-[10px] font-bold text-bakery-brown/45">{t('holdLastExtras')}</p>
            )}

            <input
              type="text"
              className="w-full text-sm p-2.5 border border-bakery-beige rounded-xl outline-none"
              placeholder={t('lineNotePlaceholder')}
              value={lineNoteDraft[-1] || ''}
              onChange={e => setLineNoteDraft(prev => ({ ...prev, [-1]: e.target.value }))}
            />

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


      {showManagerApproval && (
        <Modal title={t('managerApproval')} onClose={() => { setShowManagerApproval(false); setPendingConfirmMode(null); }}>
          <div className="space-y-4">
            <p className="text-sm text-bakery-brown/70">{t('discountNeedsApproval')}</p>
            <div>
              <label className="block text-xs font-bold mb-1">{t('managerUsername')}</label>
              <input className="w-full p-3 border border-bakery-beige rounded-xl" value={managerUser} onChange={e => setManagerUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">{t('password')}</label>
              <PasswordInput className="w-full p-3 border border-bakery-beige rounded-xl" value={managerPass} onChange={e => setManagerPass(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn-primary w-full py-3 rounded-xl font-bold"
              onClick={async () => {
                pendingSaleRef.current ||= resumeOrderId || `ORDER-${crypto.randomUUID()}`;
                const mgr = await verifyManagerPassword(managerUser, managerPass, users, { isDemoMode, businessId: businessSettings?.id, orderId: pendingSaleRef.current, maximum: discountValue });
                if (!mgr) {
                  addToast(t('invalidCredentials'), 'error');
                  return;
                }
                approvalTokenRef.current = mgr.approvalToken;
                setDiscountApprovedBy(mgr.username);
                setShowManagerApproval(false);
                const mode = pendingConfirmMode;
                setPendingConfirmMode(null);
                setManagerUser('');
                setManagerPass('');
                if (mode) confirmOrder(mode, mgr.username);
              }}
            >
              {t('approveDiscount')}
            </button>
          </div>
        </Modal>
      )}

      {showTillOpen && (
        <Modal title={t('openTill')} onClose={() => setShowTillOpen(false)}>
          <div className="space-y-4">
            <label className="block text-sm font-bold">{t('openingFloat')}</label>
            <input type="number" className="w-full p-3 border border-bakery-beige rounded-xl font-bold" value={floatInput} onChange={e => setFloatInput(e.target.value)} />
            <button
              type="button"
              className="btn-primary w-full py-3 rounded-xl font-bold"
              onClick={() => {
                openTill(parseFloat(floatInput) || 0);
                setShowTillOpen(false);
              }}
            >
              {t('openTill')}
            </button>
          </div>
        </Modal>
      )}

      {showTillClose && openCashSession && (
        <Modal title={t('closeTill')} onClose={() => setShowTillClose(false)}>
          {(() => {
            const totals = tillTotals(sales, openCashSession);
            return (
              <div className="space-y-3 text-sm">
                <p>{t('expectedCash')}: <strong>{formatPrice(totals.expectedCash)}</strong></p>
                <p>{t('cardRecorded')}: <strong>{formatPrice(totals.cardRecorded)}</strong></p>
                <label className="block font-bold pt-2">{t('countedCash')}</label>
                <input type="number" className="w-full p-3 border border-bakery-beige rounded-xl font-bold" value={countedInput} onChange={e => setCountedInput(e.target.value)} />
                <button
                  type="button"
                  className="btn-primary w-full py-3 rounded-xl font-bold"
                  onClick={() => {
                    const counted = parseFloat(countedInput) || 0;
                    const closed = closeTill(counted);
                    if (closed) {
                      downloadZReport({
                        business: businessSettings,
                        currencySymbol: businessSettings?.currencySymbol,
                        openedAt: closed.openedAt,
                        closedAt: closed.closedAt || Date.now(),
                        openingFloat: closed.openingFloat,
                        expectedCash: totals.expectedCash,
                        countedCash: counted,
                        cardRecorded: totals.cardRecorded,
                        cashSales: totals.cashSales,
                        refunds: totals.refunds,
                        voids: totals.voids,
                        orderCount: totals.orderCount,
                        labels: ticketLabels(),
                      });
                    }
                    setShowTillClose(false);
                    setCountedInput('');
                  }}
                >
                  {t('zReport')}
                </button>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
