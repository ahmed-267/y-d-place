import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { ArrowLeftRight, Calendar, Check, Loader2, Search, User, Phone } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { finalizeSale } from '../utils/sales';
import { toSearchValue, priceMatchesQuery } from '../utils/search';

const ORDER_STATUSES: OrderStatus[] = ['Preparing', 'Ready', 'Completed'];
const DISPLAY_STATUSES: OrderStatus[] = ['Preparing', 'Ready', 'Completed'];

export const OrdersTab = () => {
  const {
    orders,
    setOrders,
    products,
    sales,
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
    lang
  } = useApp();

  const statusLabels: Record<OrderStatus, string> = {
    Preparing: t('statusPreparing'),
    Ready: t('statusReady'),
    Completed: t('statusCompleted')
  };

  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getDateKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
  const todayKey = getDateKey(Date.now());

  const productMap = useMemo(() => {
    return new Map(products.map(p => [p.id, p]));
  }, [products]);

  const visibleOrders = useMemo(() => {
    return orders.filter(o => {
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
  }, [visibleOrders, search, productMap, tp, t, lang]);

  const upcomingPreOrders = useMemo(() => {
    return filteredOrders.filter(
      o => o.type === 'PreOrder' && o.scheduledFor && o.scheduledFor.slice(0, 10) > todayKey
    );
  }, [filteredOrders, todayKey]);

  const groupedOrders = useMemo(() => {
    const activeDisplay = filteredOrders.filter(o => !(o.type === 'PreOrder' && o.scheduledFor && o.scheduledFor.slice(0, 10) > todayKey));
    return DISPLAY_STATUSES.reduce((acc, status) => {
      acc[status] = activeDisplay.filter(o => o.status === status);
      return acc;
    }, {} as Record<OrderStatus, Order[]>);
  }, [filteredOrders, todayKey]);

  const moveOrderStatus = (order: Order, direction: 'back' | 'forward') => {
    if (!user) return;
    const currentIndex = ORDER_STATUSES.indexOf(order.status);
    const nextIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= ORDER_STATUSES.length) return;
    const nextStatus = ORDER_STATUSES[nextIndex];

    if (nextStatus === 'Completed' && !order.saleId) {
      const result = finalizeSale({
        items: order.items,
        products,
        ingredients,
        preparedStock,
        shiftLogs,
        cashier: user,
        paymentMethod: order.paymentMethod,
        timestamp: Date.now()
      });

      if (!result.ok) {
        addToast(t('insufficientStock').replace('{items}', result.outOfStockItems?.join(', ') || t('items')), 'error');
        return;
      }

      setPreparedStock(result.updatedPreparedStock || preparedStock);
      setIngredients(result.updatedIngredients || ingredients);
      setSales([...sales, result.sale!]);
      setShiftLogs(result.updatedShiftLogs || shiftLogs);

      setOrders(prev => prev.map(o => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          status: 'Completed',
          completedAt: Date.now(),
          saleId: result.sale?.id,
          lastUpdatedAt: Date.now()
        };
      }));
      addToast(t('orderCompleted'));
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id !== order.id) return o;
      return { ...o, status: nextStatus, lastUpdatedAt: Date.now() };
    }));
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

  const isWalkInLate = (order: Order) => {
    return order.type === 'WalkIn' && now - order.createdAt > 15 * 60 * 1000;
  };

  const isPreOrderToday = (order: Order) => {
    return order.type === 'PreOrder' && order.scheduledFor?.slice(0, 10) === todayKey;
  };

  const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
    const timing = getOrderTiming(order);
    const isLate = isWalkInLate(order);
    const highlightToday = isPreOrderToday(order);

    return (
      <div className={`card-bakery p-4 sm:p-5 space-y-4 border ${
        isLate ? 'border-rose-400 bg-rose-50/50' : highlightToday ? 'border-emerald-300 bg-emerald-50/50' : 'border-bakery-beige'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-bakery-brown/40">{order.type === 'WalkIn' ? t('walkIn') : t('preOrder')}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                order.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : order.status === 'Ready' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-700'
              }`}>
                {statusLabels[order.status]}
              </span>
              {order.saleId && (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">{t('recorded')}</span>
              )}
            </div>
            <p className="text-sm font-bold mt-1">#{order.id.slice(-6)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{timing.label}</p>
            <p className={`text-sm font-bold ${isLate ? 'text-rose-600' : 'text-bakery-brown'}`}>{timing.value}</p>
          </div>
        </div>

        {order.type === 'PreOrder' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-bakery-brown/70">
            <div className="flex items-center gap-2">
              <User size={14} />
              <span className="font-bold">{order.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} />
              <span className="font-bold">{order.customerPhone}</span>
            </div>
            {order.scheduledFor && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <Calendar size={14} />
                <span className="font-bold">
                  {order.scheduledFor.replace('T', ' ')}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {order.items.map((item, idx) => {
            const product = productMap.get(item.productId);
            const name = product ? tp(product) : item.translations?.[lang] || item.nameEN;
            return (
              <div key={`${order.id}-${idx}`} className="flex items-start justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-bold truncate">{item.qty}× {name}</p>
                  {item.extras?.map(extra => {
                    const extraProduct = productMap.get(extra.productId);
                    const extraName = extraProduct ? tp(extraProduct) : extra.nameEN;
                    return (
                      <p key={`${order.id}-${idx}-${extra.productId}`} className="text-[10px] text-bakery-caramel font-bold italic">+ {extraName}</p>
                    );
                  })}
                </div>
                <span className="font-bold">{formatPrice(item.lineTotal)}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm font-bold">
          <span>{t('orderTotal')}</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {order.status !== 'Preparing' && (
            <button
              onClick={() => moveOrderStatus(order, 'back')}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-bakery-beige/40 text-bakery-brown/70 hover:bg-bakery-beige/70 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeftRight size={14} />
              {t('moveBack')}
            </button>
          )}
          {order.status !== 'Completed' && (
            <button
              onClick={() => moveOrderStatus(order, 'forward')}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-bakery-brown text-white hover:bg-bakery-brown/90 transition-all flex items-center justify-center gap-2"
            >
              {order.status === 'Ready' ? <Check size={14} /> : <Loader2 size={14} />}
              {order.status === 'Ready' ? t('completeOrder') : t('moveForward')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-serif text-bakery-brown">{t('activeOrders')}</h2>
          <p className="text-sm text-bakery-brown/50">{t('ordersFlowHint')}</p>
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={18} />
          <input
            type="text"
            placeholder={t('search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-bakery-beige rounded-full outline-none focus:ring-2 focus:ring-bakery-caramel text-sm bg-white shadow-sm"
          />
        </div>
      </div>

      <section className="space-y-6">
        <div className="space-y-6">
          {DISPLAY_STATUSES.map(status => (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">{statusLabels[status]}</span>
                <div className="h-px bg-bakery-beige flex-1" />
              </div>
              {groupedOrders[status].length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groupedOrders[status].map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-bakery-brown/40 italic">{t('noOrdersStage')}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">{t('upcomingPreOrders')}</span>
          <div className="h-px bg-bakery-beige flex-1" />
        </div>
        {upcomingPreOrders.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcomingPreOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-bakery-brown/40 italic">{t('noUpcomingPreOrders')}</p>
        )}
      </section>
    </div>
  );
};
