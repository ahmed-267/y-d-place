import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Euro, Calendar, TrendingUp, ShoppingBag, CreditCard, Banknote, Users } from 'lucide-react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type Bucket = {
  label: string;
  start: number;
  end: number;
};

export const OverviewTab = () => {
  const { sales, products, businessSettings, formatPrice, user, loadDemoData, users, workShifts, t, tc, tp, lang } = useApp();

  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const revenueChartInstance = useRef<Chart | null>(null);
  const categoryChartRef = useRef<HTMLCanvasElement>(null);
  const categoryChartInstance = useRef<Chart | null>(null);

  const [period, setPeriod] = useState<Period>('weekly');
  const [staffPeriod, setStaffPeriod] = useState<Period | 'custom'>('weekly');
  const [staffDateRange, setStaffDateRange] = useState({ from: '', to: '' });

  const periodOptions = [
    { id: 'daily' as const, label: t('daily') },
    { id: 'weekly' as const, label: t('weekly') },
    { id: 'monthly' as const, label: t('monthly') },
    { id: 'quarterly' as const, label: t('quarterly') }
  ];

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const toDateInput = (date: Date) => date.toLocaleDateString('en-CA');
  const locale = lang === 'fl' ? 'nl-BE' : lang;

  const buildBuckets = (mode: Period): Bucket[] => {
    const now = new Date();

    if (mode === 'daily') {
      const buckets: Bucket[] = [];
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setDate(end.getDate() + 1);
        buckets.push({
          label: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
          start: d.getTime(),
          end: end.getTime()
        });
      }
      return buckets;
    }

    if (mode === 'weekly') {
      const buckets: Bucket[] = [];
      const currentWeekStart = startOfWeek(now);
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(currentWeekStart);
        start.setDate(start.getDate() - i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        buckets.push({
          label: `${t('weekShort')} ${start.toLocaleDateString(locale, { day: '2-digit', month: 'short' })}`,
          start: start.getTime(),
          end: end.getTime()
        });
      }
      return buckets;
    }

    if (mode === 'monthly') {
      const buckets: Bucket[] = [];
      for (let i = 11; i >= 0; i -= 1) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        buckets.push({
          label: start.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
          start: start.getTime(),
          end: end.getTime()
        });
      }
      return buckets;
    }

    const buckets: Bucket[] = [];
    const currentQuarter = Math.floor(now.getMonth() / 3);
    for (let i = 7; i >= 0; i -= 1) {
      const quarterIndex = currentQuarter - i;
      const yearOffset = Math.floor(quarterIndex / 4);
      const quarter = ((quarterIndex % 4) + 4) % 4;
      const year = now.getFullYear() + yearOffset;
      const monthStart = quarter * 3;
      const start = new Date(year, monthStart, 1);
      const end = new Date(year, monthStart + 3, 1);
      buckets.push({
        label: `Q${quarter + 1} ${year}`,
        start: start.getTime(),
        end: end.getTime()
      });
    }
    return buckets;
  };

  const buckets = useMemo(() => buildBuckets(period), [period]);
  const periodRange = useMemo(() => {
    if (!buckets.length) return { start: 0, end: 0 };
    return { start: buckets[0].start, end: buckets[buckets.length - 1].end };
  }, [buckets]);

  const staffBuckets = useMemo(() => staffPeriod === 'custom' ? [] : buildBuckets(staffPeriod), [staffPeriod]);
  const staffRange = useMemo(() => {
    if (staffPeriod === 'custom' && staffDateRange.from && staffDateRange.to) {
      const start = new Date(staffDateRange.from).getTime();
      const end = new Date(staffDateRange.to).setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (staffBuckets.length) {
      return { start: staffBuckets[0].start, end: staffBuckets[staffBuckets.length - 1].end };
    }
    return { start: 0, end: 0 };
  }, [staffPeriod, staffDateRange, staffBuckets]);

  useEffect(() => {
    if (staffPeriod === 'custom') return;
    if (!staffBuckets.length) return;
    const start = new Date(staffBuckets[0].start);
    const end = new Date(staffBuckets[staffBuckets.length - 1].end - 1);
    setStaffDateRange({ from: toDateInput(start), to: toDateInput(end) });
  }, [staffPeriod, staffBuckets]);

  const salesInPeriod = useMemo(() => {
    return sales.filter(s => s.timestamp >= periodRange.start && s.timestamp < periodRange.end);
  }, [sales, periodRange]);

  const staffSalesInPeriod = useMemo(() => {
    return sales.filter(s => s.timestamp >= staffRange.start && s.timestamp <= staffRange.end);
  }, [sales, staffRange]);

  const shiftsInPeriod = useMemo(() => {
    return workShifts.filter(shift => {
      const shiftTime = new Date(`${shift.date}T00:00`).getTime();
      return shiftTime >= staffRange.start && shiftTime <= staffRange.end;
    });
  }, [workShifts, staffRange]);

  const revenueByBucket = useMemo(() => {
    return buckets.map(bucket => {
      return sales.filter(s => s.timestamp >= bucket.start && s.timestamp < bucket.end)
        .reduce((acc, s) => acc + s.subtotal, 0);
    });
  }, [buckets, sales]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { units: number; revenue: number }> = {};
    const productMap = new Map(products.map(p => [p.id, p]));

    salesInPeriod.forEach(s => s.items.forEach(item => {
      const prod = productMap.get(item.productId);
      const cat = prod ? tc(prod.category) : t('unknown');
      if (!map[cat]) map[cat] = { units: 0, revenue: 0 };
      map[cat].units += item.qty;
      map[cat].revenue += item.lineTotal;
    }));

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [salesInPeriod, products, tc, t]);

  const bestSellers = useMemo(() => {
    const counts: Record<number, { qty: number; revenue: number }> = {};
    salesInPeriod.forEach(s => s.items.forEach(item => {
      if (!counts[item.productId]) counts[item.productId] = { qty: 0, revenue: 0 };
      counts[item.productId].qty += item.qty;
      counts[item.productId].revenue += item.lineTotal;
    }));

    return Object.entries(counts)
      .map(([id, data]) => {
        const p = products.find(prod => prod.id === parseInt(id, 10));
        return {
          id: parseInt(id, 10),
          name: p ? tp(p) : t('unknown'),
          emoji: p?.emoji || '🍽️',
          qty: data.qty,
          revenue: data.revenue
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [salesInPeriod, products, tp, t]);

  const paymentBreakdown = useMemo(() => {
    const totals = { cash: 0, card: 0 };
    const counts = { cash: 0, card: 0 };
    salesInPeriod.forEach(s => {
      if (s.paymentMethod === 'Cash') {
        totals.cash += s.subtotal;
        counts.cash += 1;
      } else {
        totals.card += s.subtotal;
        counts.card += 1;
      }
    });
    const totalCount = counts.cash + counts.card;
    return {
      totals,
      counts,
      totalCount,
      cashPercent: totalCount ? Math.round((counts.cash / totalCount) * 100) : 0,
      cardPercent: totalCount ? Math.round((counts.card / totalCount) * 100) : 0
    };
  }, [salesInPeriod]);

  const averageOrderValue = useMemo(() => {
    if (!salesInPeriod.length) return 0;
    const total = salesInPeriod.reduce((acc, s) => acc + s.subtotal, 0);
    return total / salesInPeriod.length;
  }, [salesInPeriod]);

  const busiestHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => 0);
    salesInPeriod.forEach(sale => {
      const hour = new Date(sale.timestamp).getHours();
      hours[hour] += 1;
    });
    const max = Math.max(...hours, 1);
    return { hours, max };
  }, [salesInPeriod]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(new Date());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const todayRev = sales.filter(s => s.timestamp >= todayStart.getTime()).reduce((acc, s) => acc + s.subtotal, 0);
    const weekRev = sales.filter(s => s.timestamp >= weekStart.getTime()).reduce((acc, s) => acc + s.subtotal, 0);
    const monthRev = sales.filter(s => s.timestamp >= monthStart.getTime()).reduce((acc, s) => acc + s.subtotal, 0);
    const yearRev = sales.filter(s => s.timestamp >= yearStart.getTime()).reduce((acc, s) => acc + s.subtotal, 0);
    const allRev = sales.reduce((acc, s) => acc + s.subtotal, 0);

    return { todayRev, weekRev, monthRev, yearRev, allRev };
  }, [sales]);

  const staffDirectory = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.username, u.fullName));
    sales.forEach(s => {
      if (!map.has(s.cashierUsername)) {
        map.set(s.cashierUsername, s.cashierFullName);
      }
    });
    return Array.from(map.entries()).map(([username, fullName]) => ({ username, fullName }));
  }, [users, sales]);

  const staffPerformance = useMemo(() => {
    return staffDirectory.map(staff => {
      const staffSales = staffSalesInPeriod.filter(s => s.cashierUsername === staff.username);
      const revenue = staffSales.reduce((acc, s) => acc + s.subtotal, 0);
      const orders = staffSales.length;
      const staffShiftList = shiftsInPeriod.filter(s => s.username === staff.username);
      const shiftsWorked = staffShiftList.length;
      const totalHours = staffShiftList.reduce((acc, s) => acc + s.totalHours, 0);
      const revenuePerHour = totalHours > 0 ? revenue / totalHours : 0;
      const avgOrdersPerShift = shiftsWorked > 0 ? orders / shiftsWorked : 0;
      const avgRevenuePerShift = shiftsWorked > 0 ? revenue / shiftsWorked : 0;
      return {
        username: staff.username,
        fullName: staff.fullName || staff.username,
        orders,
        revenue,
        totalHours,
        shiftsWorked,
        revenuePerHour,
        avgOrdersPerShift,
        avgRevenuePerShift
      };
    }).sort((a, b) => b.revenuePerHour - a.revenuePerHour);
  }, [staffDirectory, staffSalesInPeriod, shiftsInPeriod]);

  const topEfficiency = staffPerformance.length ? staffPerformance[0].revenuePerHour : 0;

  useEffect(() => {
    if (revenueChartInstance.current) revenueChartInstance.current.destroy();
    if (categoryChartInstance.current) categoryChartInstance.current.destroy();

    if (revenueChartRef.current && categoryChartRef.current) {
      const currencySymbol = businessSettings?.currencySymbol || '€';

      revenueChartInstance.current = new Chart(revenueChartRef.current, {
        type: 'bar',
        data: {
          labels: buckets.map(b => b.label),
          datasets: [{
            label: `${t('revenue')} (${currencySymbol})`,
            data: revenueByBucket,
            backgroundColor: '#d4a373',
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: 'end',
              align: 'top',
              formatter: (val: number) => `${currencySymbol}${val.toFixed(0)}`,
              font: { weight: 'bold' }
            },
            tooltip: {
              callbacks: {
                label: (context) => `${t('revenue')}: ${currencySymbol}${context.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: { title: { display: true, text: t('period'), font: { weight: 'bold' } } },
            y: {
              title: { display: true, text: `${t('revenue')} (${currencySymbol})`, font: { weight: 'bold' } },
              ticks: { callback: (val) => `${currencySymbol}${val}` }
            }
          }
        }
      });

      categoryChartInstance.current = new Chart(categoryChartRef.current, {
        type: 'doughnut',
        data: {
          labels: categoryStats.map(c => c.name),
          datasets: [{
            data: categoryStats.map(c => c.revenue),
            backgroundColor: ['#5d4037', '#d4a373', '#faedcd', '#e9edc9', '#ccd5ae', '#7f5539', '#a98467', '#adc178']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            datalabels: { display: false },
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const cat = categoryStats[context.dataIndex];
                  const symbol = businessSettings?.currencySymbol || '€';
                  return `${cat?.name || t('unknown')}: ${symbol}${(cat?.revenue || 0).toFixed(2)} (${cat?.units || 0} ${t('units')})`;
                }
              }
            }
          }
        }
      });
    }

    return () => {
      if (revenueChartInstance.current) revenueChartInstance.current.destroy();
      if (categoryChartInstance.current) categoryChartInstance.current.destroy();
    };
  }, [buckets, revenueByBucket, categoryStats, businessSettings, t]);

  return (
    <div className="space-y-10 animate-fade-in max-w-full overflow-hidden">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-serif text-bakery-brown">{t('businessOverview')}</h2>
        {user?.role === 'owner' && sales.length < 10 && (
          <button 
            onClick={loadDemoData}
            className="px-4 py-2 bg-bakery-accent text-bakery-brown rounded-xl font-bold text-xs hover:bg-bakery-brown hover:text-white transition-all active:scale-95 flex items-center gap-2"
          >
            <TrendingUp size={16} />
            {t('loadDemoData')}
          </button>
        )}
      </div>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-black font-serif text-bakery-brown">{t('revenue')}</h3>
          <div className="flex items-center gap-2 bg-bakery-beige/40 p-1 rounded-2xl">
            {periodOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setPeriod(option.id)}
                className={`h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                  period === option.id ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {[
            { label: t('today'), val: formatPrice(stats.todayRev), icon: Euro },
            { label: t('thisWeek'), val: formatPrice(stats.weekRev), icon: Calendar },
            { label: t('thisMonth'), val: formatPrice(stats.monthRev), icon: TrendingUp },
            { label: t('thisYear'), val: formatPrice(stats.yearRev), icon: Euro },
            { label: t('allTime'), val: formatPrice(stats.allRev), icon: ShoppingBag }
          ].map(s => (
            <div key={s.label} className="card-bakery p-4 sm:p-6 flex justify-between items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider mb-1 truncate">{s.label}</p>
                <p className="text-lg sm:text-xl font-black font-serif truncate">{s.val}</p>
              </div>
              <div className="p-2 bg-bakery-beige rounded-xl text-bakery-brown shrink-0 ml-2">
                <s.icon size={20} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-bakery p-4 sm:p-6">
            <h4 className="text-lg font-bold font-serif mb-6">{t('revenueTrends')}</h4>
            <div className="h-72 w-full"><canvas ref={revenueChartRef}></canvas></div>
          </div>
          <div className="card-bakery p-4 sm:p-6">
            <h4 className="text-lg font-bold font-serif mb-6">{t('revenueByCategory')}</h4>
            <div className="h-72 w-full"><canvas ref={categoryChartRef}></canvas></div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-black font-serif text-bakery-brown">{t('sales')}</h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-bakery p-4 sm:p-6 lg:col-span-2">
            <h4 className="text-lg font-bold font-serif mb-6">{t('bestSellers')}</h4>
            <div className="space-y-4">
              {bestSellers.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-bakery-cream rounded-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-bakery-brown text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.emoji} {item.name}</p>
                      <p className="text-[10px] text-bakery-brown/50 uppercase font-bold">{item.qty} {t('units')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm">{formatPrice(item.revenue)}</p>
                  </div>
                </div>
              ))}
              {bestSellers.length === 0 && (
                <p className="text-center text-bakery-brown/40 py-8 italic">{t('noSalesData')}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-bakery p-4 sm:p-6">
              <h4 className="text-lg font-bold font-serif mb-6">{t('paymentBreakdown')}</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Banknote size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-bakery-brown/40">{t('cash')}</p>
                      <p className="font-black text-sm">{paymentBreakdown.cashPercent}%</p>
                    </div>
                  </div>
                  <p className="font-black text-sm">{formatPrice(paymentBreakdown.totals.cash)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-bakery-brown/40">{t('card')}</p>
                      <p className="font-black text-sm">{paymentBreakdown.cardPercent}%</p>
                    </div>
                  </div>
                  <p className="font-black text-sm">{formatPrice(paymentBreakdown.totals.card)}</p>
                </div>
                <div className="w-full bg-bakery-beige rounded-full h-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: `${paymentBreakdown.cashPercent}%` }}></div>
                  <div className="bg-blue-500 h-full" style={{ width: `${paymentBreakdown.cardPercent}%` }}></div>
                </div>
                <p className="text-[10px] text-bakery-brown/50 uppercase tracking-widest font-bold">{paymentBreakdown.totalCount} {t('orders')}</p>
              </div>
            </div>

            <div className="card-bakery p-4 sm:p-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-bakery-brown/50 mb-2">{t('averageOrderValue')}</h4>
              <p className="text-2xl font-black font-serif text-bakery-brown">{formatPrice(averageOrderValue)}</p>
              <p className="text-xs text-bakery-brown/50">{t('basedOnOrders').replace('{count}', String(salesInPeriod.length))}</p>
            </div>

            <div className="card-bakery p-4 sm:p-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-bakery-brown/50 mb-4">{t('busiestHours')}</h4>
              <div className="flex items-end gap-1 h-24">
                {busiestHours.hours.map((count, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full rounded-md bg-bakery-caramel/70"
                      style={{ height: `${(count / busiestHours.max) * 100}%` }}
                      title={`${idx}:00 - ${count} ${t('orders')}`}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-bakery-brown/50 mt-2">
                <span>0</span>
                <span>6</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card-bakery p-4 sm:p-6">
          <h4 className="text-lg font-bold font-serif mb-6">{t('whatsSelling')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {categoryStats.length > 0 ? categoryStats.map(cat => {
              const maxUnits = Math.max(...categoryStats.map(c => c.units));
              const percent = maxUnits ? (cat.units / maxUnits) * 100 : 0;
              return (
                <div key={cat.name} className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="font-bold truncate mr-2">{cat.name}</span>
                    <span className="text-bakery-brown/60 shrink-0">{cat.units} {t('units')}</span>
                  </div>
                  <div className="w-full bg-bakery-beige rounded-full h-1.5 overflow-hidden">
                    <div className="bg-bakery-caramel h-full" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            }) : (
              <p className="text-center text-bakery-brown/40 italic">{t('noSalesData')}</p>
            )}
          </div>
        </div>
      </section>

      {user?.role === 'owner' && (
        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h3 className="text-xl font-black font-serif text-bakery-brown">{t('staffPerformance')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-bakery-beige/40 p-1 rounded-2xl">
                {periodOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setStaffPeriod(option.id)}
                    className={`h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                      staffPeriod === option.id ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={staffDateRange.from}
                  onChange={e => { setStaffDateRange(prev => ({ ...prev, from: e.target.value })); setStaffPeriod('custom'); }}
                  className="h-9 px-3 border border-bakery-beige rounded-xl text-xs font-bold"
                />
                <input
                  type="date"
                  value={staffDateRange.to}
                  onChange={e => { setStaffDateRange(prev => ({ ...prev, to: e.target.value })); setStaffPeriod('custom'); }}
                  className="h-9 px-3 border border-bakery-beige rounded-xl text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="card-bakery p-4 sm:p-6 space-y-4">
            <h4 className="text-lg font-bold font-serif">{t('staffLeaderboard')}</h4>
            <div className="space-y-4">
              {staffPerformance.map((staff, idx) => {
                const rankLabel = idx === 0 ? t('rankFirst') : idx === 1 ? t('rankSecond') : idx === 2 ? t('rankThird') : `${idx + 1}`;
                const percent = topEfficiency ? Math.min(100, (staff.revenuePerHour / topEfficiency) * 100) : 0;
                return (
                  <div key={staff.username} className="p-4 bg-bakery-cream rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-bakery-brown text-white text-[10px] font-black flex items-center justify-center">{rankLabel}</span>
                        <div>
                          <p className="font-bold text-sm">{staff.fullName}</p>
                          <p className="text-[10px] text-bakery-brown/50">@{staff.username}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-bold text-bakery-brown">
                        <span>{t('ordersProcessed')}: {staff.orders}</span>
                        <span>{t('totalRevenue')}: {formatPrice(staff.revenue)}</span>
                        <span>{t('revenuePerHour')}: {formatPrice(staff.revenuePerHour)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-bakery-beige rounded-full h-2 mt-3">
                      <div className="bg-bakery-caramel h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {staffPerformance.length === 0 && (
                <p className="text-center text-bakery-brown/40 italic">{t('noStaffData')}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffPerformance.map(staff => (
              <div key={staff.username} className="card-bakery p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-bakery-brown" />
                  <p className="font-bold">{staff.fullName}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-bakery-brown/50 uppercase font-black text-[10px]">{t('shiftsWorked')}</p>
                    <p className="font-bold text-sm">{staff.shiftsWorked}</p>
                  </div>
                  <div>
                    <p className="text-bakery-brown/50 uppercase font-black text-[10px]">{t('totalHours')}</p>
                    <p className="font-bold text-sm">{staff.totalHours.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-bakery-brown/50 uppercase font-black text-[10px]">{t('avgOrdersPerShift')}</p>
                    <p className="font-bold text-sm">{staff.avgOrdersPerShift.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-bakery-brown/50 uppercase font-black text-[10px]">{t('avgRevenuePerShift')}</p>
                    <p className="font-bold text-sm">{formatPrice(staff.avgRevenuePerShift)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
