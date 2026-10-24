import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { ArrowLeftRight, Calendar, Check, Loader2, Search, User, Phone, XCircle, ShoppingBag, Printer, Maximize2, Minimize2 } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { finalizeSale } from '../utils/sales';
import { restoreStock } from '../utils/stock';
import { toSearchValue, priceMatchesQuery } from '../utils/search';
import { downloadKitchenTicket } from '../utils/tickets';
import { paymentMethodLabel } from '../utils/ticketMoney';

const ORDER_STATUSES: OrderStatus[] = ['Preparing', 'Ready', 'Completed'];
const BOARD_STATUSES: OrderStatus[] = ['Preparing', 'Ready', 'Completed'];

export const OrdersTab = () => {
  const {
    orders,
    setOrders,
    products,
    setSales,
    ingredients,
    setIngredients,
    preparedStock,
    setPreparedStock,
    shiftLogs,
    setShiftLogs,
    user,
    t,
    tp,
    addToast,
    formatPrice,
    lang,
    setActiveTab,
    businessSettings,
    recordSale,
    markSaleStatus,
  } = useApp();

  const statusLabels: Record<OrderStatus, string> = {
    Preparing: t('statusPreparing'),
    Ready: t('statusReady'),
    Completed: t('statusCompleted'),
    Cancelled: t('voidOrder'),
  };

  const ticketLabels = () => ({
    kitchenTicket: t('kitchenTicket'),
    walkIn: t('walkIn'),
    preOrder: t('preOrder'),
    pickupTime: t('pickupTime'),
  });

  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const prevPreparing = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const preparingCount = orders.filter(o => o.status === 'Preparing').length;
  useEffect(() => {
    if (preparingCount > prevPreparing.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch {
        /* audio optional */
      }
    }
    prevPreparing.current = preparingCount;
  }, [preparingCount]);

  const getDateKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
  const todayKey = getDateKey(Date.now());

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const visibleOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'Cancelled') return false;
      if (o.status !== 'Completed') return true;
      const completedStamp = o.completedAt ?? o.lastUpdatedAt ?? o.createdAt;
      return getDateKey(completedStamp) === todayKey;
    });
  }, [orders, todayKey]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleOrders;
    return visibleOrders.filter(order => {
      const itemMatch = order.items?.some(i => {
        const product = productMap.get(i.productId);
        const name = product ? tp(product) : i?.translations?.[lang] || i?.nameEN;
        return toSearchValue(name).includes(query);
      }) || false;
      const nameMatch = toSearchValue(order?.customerName).includes(query);
      const phoneMatch = toSearchValue(order?.customerPhone).includes(query);
      const totalMatch = priceMatchesQuery(order?.subtotal, query) || toSearchValue(order?.subtotal).includes(query);
      const statusMatch = toSearchValue(order?.status).includes(query) || toSearchValue(statusLabels[order.status]).includes(query);
      return itemMatch || nameMatch || phoneMatch || totalMatch || statusMatch;
    });
  }, [visibleOrders, search, productMap, tp, lang]);

  const upcomingPreOrders = useMemo(() => {
    return filteredOrders.filter(
      o => o.type === 'PreOrder' && o.scheduledFor && o.scheduledFor.slice(0, 10) > todayKey
    );
  }, [filteredOrders, todayKey]);

  const groupedOrders = useMemo(() => {
    const activeDisplay = filteredOrders.filter(o => !(o.type === 'PreOrder' && o.scheduledFor && o.scheduledFor.slice(0, 10) > todayKey));
    return BOARD_STATUSES.reduce((acc, status) => {
      acc[status] = activeDisplay.filter(o => o.status === status);
      return acc;
    }, {} as Record<OrderStatus, Order[]>);
  }, [filteredOrders, todayKey]);

  const completeOrder = async (order: Order) => {
    if (!user) return;
    if (order.saleId) {
      if (!await setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Completed', completedAt: o.completedAt || Date.now(), lastUpdatedAt: Date.now() } : o))) return;
      return;
    }

    const result = finalizeSale({
      items: order.items,
      products,
      ingredients,
      preparedStock,
      shiftLogs,
      cashier: user,
      paymentMethod: order.paymentMethod,
      timestamp: Date.now(),
      existingSaleId: order.saleId || `SALE-${order.id}-${order.lastUpdatedAt}`,
      discountPercent: order.discountPercent,
      discountAmount: order.discountAmount,
      tipAmount: order.tipAmount,
      tenderedCash: order.tenderedCash,
      changeGiven: order.changeGiven,
      cashAmount: order.cashAmount,
      cardAmount: order.cardAmount,
    });

    if (!result.ok) {
      addToast(t('insufficientStock').replace('{items}', result.outOfStockItems?.join(', ') || t('items')), 'error');
      return;
    }

    const completedOrder: Order = { ...order, status: 'Completed', completedAt: Date.now(), saleId: result.sale!.id, lastUpdatedAt: Date.now() };
    if (!await recordSale({ ...result.sale!, discountApprovalToken: order.discountApprovalToken }, completedOrder)) return;
    if (businessSettings?.id === 'ydplace') {
      if (!await setPreparedStock(result.updatedPreparedStock || preparedStock)) return;
      if (!await setIngredients(result.updatedIngredients || ingredients)) return;
    }
    setShiftLogs(result.updatedShiftLogs || shiftLogs);
    addToast(t('orderCompleted'));
  };

  const moveOrderStatus = async (order: Order, direction: 'back' | 'forward') => {
    if (!user) return;
    const currentIndex = ORDER_STATUSES.indexOf(order.status);
    const nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= ORDER_STATUSES.length) return;
    const nextStatus = ORDER_STATUSES[nextIndex];

    if (nextStatus === 'Completed') {
      completeOrder(order);
      return;
    }

    // Reopening also updates the order inside the refund transaction.
    if (order.saleId && (order.status === 'Completed' || order.status === 'Cancelled')) {
      if (!await markSaleStatus(order.saleId, 'voided', t('orderReopened'), nextStatus as 'Preparing' | 'Ready')) return;
      addToast(t('orderReopened'), 'info');
      return;
    }

    if (!await setOrders(prev => prev.map(o => {
      if (o.id !== order.id) return o;
      return { ...o, status: nextStatus, lastUpdatedAt: Date.now() };
    }))) return;
  };

  const printKitchen = async (order: Order) => {
    downloadKitchenTicket(order, {
      currencySymbol: businessSettings?.currencySymbol,
      business: businessSettings,
      labels: ticketLabels(),
      itemName: item => {
        const product = productMap.get(item.productId);
        return product ? tp(product) : item.translations?.[lang] || item.nameEN;
      },
      extraName: (id, fallback) => {
        const product = productMap.get(id);
        return product ? tp(product) : fallback;
      },
    });
    if (!await setOrders(prev => prev.map(o => o.id === order.id ? { ...o, kitchenPrintedAt: Date.now() } : o))) return;
  };

  const voidOrder = async (order: Order) => {
    const reason = window.prompt(t('voidReasonPlaceholder'));
    if (reason === null) return;
    const voidReason = reason.trim() || t('voidOrder');
    if (order.status === 'Completed' && order.saleId) {
      if (!await markSaleStatus(order.saleId, 'voided', voidReason)) return;
      addToast(t('orderCancelled'), 'info');
      return;
    }
    if (!await setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled' as const, voidReason, lastUpdatedAt: Date.now() } : o))) return;
    addToast(t('orderCancelled'), 'info');
  };

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getOrderTiming = (order: Order) => {
    if (order.type === 'PreOrder' && order.scheduledFor) {
      const scheduledTime = new Date(order.scheduledFor).getTime();
      if (scheduledTime > now) {
        return { label: t('startsIn'), value: formatDuration(scheduledTime - now) };
      }
      return { label: t('waiting'), value: formatDuration(now - scheduledTime) };
    }
    return { label: t('waiting'), value: formatDuration(now - order.createdAt) };
  };

  const isWalkInLate = (order: Order) =>
    (order.type === 'WalkIn' || order.type === 'DineIn') && now - order.createdAt > 15 * 60 * 1000;

  const isOrderAging = (order: Order) => {
    if (order.status === 'Completed' || order.status === 'Cancelled') return false;
    const ageMs = now - order.createdAt;
    if (order.status === 'Ready') return ageMs > 10 * 60 * 1000;
    return isWalkInLate(order);
  };

  const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
    const timing = getOrderTiming(order);
    const isLate = isOrderAging(order);

    return (
      <div className={`rounded-2xl border p-3 space-y-3 bg-white ${
        isLate ? 'border-rose-400 bg-rose-50/40' : 'border-bakery-beige'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40">
                {order.tableLabel
                  ? `${t('tableLabel')} ${order.tableLabel}`
                  : order.type === 'WalkIn'
                    ? t('walkIn')
                    : order.type === 'DineIn'
                      ? t('dineIn')
                      : t('preOrder')}
              </span>
              <span className="text-xs font-bold text-bakery-brown">#{order.id.slice(-6)}</span>
            </div>
            <p className={`text-sm font-bold mt-1 ${isLate ? 'text-rose-600' : 'text-bakery-brown'}`}>
              {timing.label}: {timing.value}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => printKitchen(order)}
              className="p-1.5 text-bakery-brown/40 hover:text-bakery-brown"
              title={t('downloadTicket')}
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={() => voidOrder(order)}
              className="p-1.5 text-bakery-brown/40 hover:text-rose-600"
              title={t('voidOrder')}
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {order.type === 'PreOrder' && (
          <div className="space-y-1 text-xs text-bakery-brown/70">
            <div className="flex items-center gap-2"><User size={12} /><span className="font-semibold">{order.customerName}</span></div>
            <div className="flex items-center gap-2"><Phone size={12} /><span>{order.customerPhone}</span></div>
            {order.scheduledFor && (
              <div className="flex items-center gap-2"><Calendar size={12} /><span>{order.scheduledFor.replace('T', ' ')}</span></div>
            )}
          </div>
        )}

        <div className="space-y-1 border-t border-bakery-beige/50 pt-2">
          {order.items.map((item, idx) => {
            const product = productMap.get(item.productId);
            const name = product ? tp(product) : item.translations?.[lang] || item.nameEN;
            return (
              <div key={`${order.id}-${idx}`} className="text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold truncate">{item.qty}× {name}</span>
                  <span className="font-bold shrink-0 ml-2">{formatPrice(item.lineTotal)}</span>
                </div>
                {item.extras?.map(extra => (
                  <p key={extra.productId} className="text-[10px] text-bakery-brown/50 font-semibold ml-3">
                    + {productMap.get(extra.productId) ? tp(productMap.get(extra.productId)!) : extra.nameEN}
                  </p>
                ))}
                {item.note && (
                  <p className="text-[10px] italic text-bakery-brown/45 ml-3">{item.note}</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-bakery-brown/40">
          {paymentMethodLabel(order.paymentMethod, t)}
        </p>

        <div className="flex gap-2">
          {order.status !== 'Preparing' && (
            <button
              onClick={() => moveOrderStatus(order, 'back')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-bakery-beige text-bakery-brown/70 hover:bg-bakery-beige/80 flex items-center justify-center gap-1"
            >
              <ArrowLeftRight size={14} />
              {t('moveBack')}
            </button>
          )}
          {order.status !== 'Completed' && (
            <button
              onClick={() => moveOrderStatus(order, 'forward')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-bakery-brown text-white hover:bg-bakery-brown/90 flex items-center justify-center gap-1"
            >
              {order.status === 'Ready' ? <Check size={14} /> : <Loader2 size={14} />}
              {order.status === 'Ready' ? t('completeOrder') : t('moveForward')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const columnStyles: Record<Exclude<OrderStatus, 'Cancelled'>, string> = {
    Preparing: 'bg-amber-50/80 border-amber-200',
    Ready: 'bg-sky-50/80 border-sky-200',
    Completed: 'bg-emerald-50/50 border-emerald-200',
  };

  if (orders.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
        <ShoppingBag className="text-bakery-brown/30" size={48} />
        <h2 className="text-xl font-bold text-bakery-brown">{t('activeOrders')}</h2>
        <p className="text-bakery-brown/50 text-sm max-w-sm">No active kitchen orders. Open Cashier to send the first one.</p>
        <button
          onClick={() => setActiveTab('cashier')}
          className="px-6 py-3 rounded-2xl bg-bakery-brown text-white font-bold text-sm"
        >
          Open cashier
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 max-w-full overflow-hidden ${fullscreen ? 'fixed inset-0 z-[90] bg-[#F7F3ED] p-4 overflow-y-auto' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-bakery-brown">{t('activeOrders')}</h2>
          <p className="text-sm text-bakery-brown/50">{t('ordersFlowHint')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFullscreen(f => !f)}
            className="h-10 px-3 rounded-xl border border-bakery-beige bg-white text-bakery-brown text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
            title={fullscreen ? t('exitFullscreen') : t('kitchenFullscreen')}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{fullscreen ? t('exitFullscreen') : t('kitchenFullscreen')}</span>
          </button>
          <div className="relative flex-1 sm:w-64">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-[60vh]">
        {BOARD_STATUSES.map(status => (
          <section key={status} className={`rounded-2xl border p-3 flex flex-col ${columnStyles[status]}`}>
            <header className="flex items-center justify-between mb-3 pb-2 border-b border-black/5">
              <h3 className="text-sm font-black uppercase tracking-wider text-bakery-brown">{statusLabels[status]}</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/80 text-bakery-brown">
                {groupedOrders[status].length}
              </span>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[70vh] pr-1">
              {groupedOrders[status].length > 0 ? (
                groupedOrders[status].map(order => <OrderCard key={order.id} order={order} />)
              ) : (
                <p className="text-xs text-bakery-brown/40 italic py-6 text-center">{t('noOrdersStage')}</p>
              )}
            </div>
          </section>
        ))}
      </div>

      {upcomingPreOrders.length > 0 && (
        <section className="space-y-3 pt-2">
          <h3 className="text-sm font-black uppercase tracking-wider text-bakery-brown/70">{t('upcomingPreOrders')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {upcomingPreOrders.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </section>
      )}
    </div>
  );
};
