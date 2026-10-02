import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { Euro, TrendingUp, ShoppingBag, CreditCard, Banknote, ArrowRight, Rocket, AlertCircle, Download, Clock } from 'lucide-react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { exportPeriodReportPdf, ReportPeriod } from '../utils/pdfReport';
import { normalizeEnabledModules } from '../types';
import { isCountableSale, salePayable } from '../utils/ticketMoney';
import { downloadZReport } from '../utils/tickets';
import { tillTotals } from '../utils/till';

Chart.register(ChartDataLabels);

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly';

type Bucket = {
  label: string;
  start: number;
  end: number;
};

interface OverviewTabProps {
  setupRequired?: boolean;
  onStartSetup?: () => void;
  setupCompleted?: boolean;
  onCompleteOnboarding?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  setupRequired = false,
  onStartSetup,
  setupCompleted = false,
}) => {
  const {
    sales, products, businessSettings, formatPrice, user, loadDemoData, users, workShifts, shiftLogs, cashSessions,
    t, tc, tp, lang, ingredients, preparedStock = [], setActiveTab, addToast, orders,
  } = useApp();

  const lowStockItems = useMemo(() => {
    const prepped = (preparedStock || [])
      .filter(p => p.portions <= p.lowThreshold)
      .map(p => ({
        id: `p-${p.id}`,
        name: p.name,
        level: p.portions,
        unit: t('portionsAbbr') || 'portions',
        out: p.portions <= 0,
      }));
    const ings = (ingredients || [])
      .filter(i => i.qty <= i.lowThreshold)
      .map(i => ({
        id: `i-${i.id}`,
        name: i.name,
        level: i.qty,
        unit: i.unit,
        out: i.qty <= 0,
      }));
    return [...prepped, ...ings]
      .sort((a, b) => (a.out === b.out ? a.level - b.level : a.out ? -1 : 1))
      .slice(0, 5);
  }, [preparedStock, ingredients, t]);

  const goToStockAttention = () => {
    try {
      sessionStorage.setItem('previsio_stock_view', 'attention');
    } catch {
      /* ignore */
    }
    setActiveTab('stock');
  };

  const nextSteps = useMemo(() => {
    const modules = normalizeEnabledModules(businessSettings?.enabledModules);
    return [
      {
        id: 'menu',
        label: t('nextStepMenu'),
        done: products.length >= 1,
        action: () => setActiveTab('products'),
      },
      modules.stock && {
        id: 'stock',
        label: t('nextStepStock'),
        done: ingredients.length > 0,
        action: () => setActiveTab('stock'),
      },
      modules.staff && {
        id: 'staff',
        label: t('nextStepStaff'),
        done: users.filter(u => u.role !== 'owner').length > 0,
        action: () => setActiveTab('staff'),
      },
      {
        id: 'sell',
        label: t('nextStepSell'),
        done: sales.length > 0,
        action: () => setActiveTab('cashier'),
      },
    ].filter(Boolean) as { id: string; label: string; done: boolean; action: () => void }[];
  }, [products.length, ingredients.length, users, sales.length, setActiveTab, businessSettings?.enabledModules, t]);

  const pendingSteps = nextSteps.filter(s => !s.done);

  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const revenueChartInstance = useRef<Chart | null>(null);
  const categoryChartRef = useRef<HTMLCanvasElement>(null);
  const categoryChartInstance = useRef<Chart | null>(null);
  const busiestChartRef = useRef<HTMLCanvasElement>(null);
  const busiestChartInstance = useRef<Chart | null>(null);

  const [period, setPeriod] = useState<Period>('weekly');
  const [staffPeriod, setStaffPeriod] = useState<Period | 'custom'>('weekly');
  const [staffDateRange, setStaffDateRange] = useState({ from: '', to: '' });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

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

  const staffRange = useMemo(() => {
    if (staffPeriod === 'custom' && staffDateRange.from && staffDateRange.to) {
      const start = new Date(staffDateRange.from).getTime();
      const end = new Date(staffDateRange.to).setHours(23, 59, 59, 999);
      return { start, end };
    }
    const now = new Date();
    const end = now.getTime();
    const start = new Date(now);
    if (staffPeriod === 'daily') start.setDate(now.getDate() - 1);
    if (staffPeriod === 'weekly') start.setDate(now.getDate() - 7);
    if (staffPeriod === 'monthly') start.setMonth(now.getMonth() - 1);
    if (staffPeriod === 'quarterly') start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end };
  }, [staffPeriod, staffDateRange]);

  useEffect(() => {
    if (staffPeriod === 'custom') return;
    const now = new Date();
    const start = new Date(now);
    if (staffPeriod === 'daily') start.setDate(now.getDate() - 1);
    if (staffPeriod === 'weekly') start.setDate(now.getDate() - 7);
    if (staffPeriod === 'monthly') start.setMonth(now.getMonth() - 1);
    if (staffPeriod === 'quarterly') start.setMonth(now.getMonth() - 3);
    setStaffDateRange({ from: toDateInput(start), to: toDateInput(now) });
  }, [staffPeriod]);

  const salesInPeriod = useMemo(() => {
    return sales.filter(s => isCountableSale(s) && s.timestamp >= periodRange.start && s.timestamp < periodRange.end);
  }, [sales, periodRange]);

  const staffSalesInPeriod = useMemo(() => {
    return sales.filter(s => isCountableSale(s) && s.timestamp >= staffRange.start && s.timestamp <= staffRange.end);
  }, [sales, staffRange]);

  const shiftsInPeriod = useMemo(() => {
    return workShifts.filter(shift => {
      const shiftTime = new Date(`${shift.date}T00:00`).getTime();
      return shiftTime >= staffRange.start && shiftTime <= staffRange.end;
    });
  }, [workShifts, staffRange]);

  const revenueByBucket = useMemo(() => {
    return buckets.map(bucket => {
      return sales.filter(s => isCountableSale(s) && s.timestamp >= bucket.start && s.timestamp < bucket.end)
        .reduce((acc, s) => acc + salePayable(s), 0);
    });
  }, [buckets, sales]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { units: number; revenue: number }> = {};
    const productMap = new Map<number, (typeof products)[number]>(products.map(p => [p.id, p]));

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
      const cash = s.paymentMethod === 'Cash' || s.paymentMethod === 'Split'
        ? (s.paymentMethod === 'Cash' ? salePayable(s) : Math.max(0, s.cashAmount || 0))
        : 0;
      const card = s.paymentMethod === 'Card' || s.paymentMethod === 'Split'
        ? (s.paymentMethod === 'Card' ? salePayable(s) : Math.max(0, s.cardAmount || 0))
        : 0;
      totals.cash += cash;
      totals.card += card;
      if (cash > 0) counts.cash += 1;
      if (card > 0) counts.card += 1;
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
    const total = salesInPeriod.reduce((acc, s) => acc + salePayable(s), 0);
    return total / salesInPeriod.length;
  }, [salesInPeriod]);

  const periodRevenue = useMemo(
    () => salesInPeriod.reduce((acc, s) => acc + salePayable(s), 0),
    [salesInPeriod]
  );
  const periodTips = useMemo(
    () => salesInPeriod.reduce((acc, s) => acc + Math.max(0, s.tipAmount || 0), 0),
    [salesInPeriod]
  );
  const tipsByCashier = useMemo(() => {
    const map = new Map<string, { name: string; tips: number }>();
    salesInPeriod.forEach(s => {
      const tip = Math.max(0, s.tipAmount || 0);
      if (tip <= 0) return;
      const key = s.cashierUsername || 'unknown';
      const prev = map.get(key) || { name: s.cashierFullName || key, tips: 0 };
      prev.tips += tip;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.tips - a.tips).slice(0, 5);
  }, [salesInPeriod]);
  const avgTurnMins = useMemo(() => {
    if (!normalizeEnabledModules(businessSettings?.enabledModules).tables) return null;
    const turns = orders.filter(
      o =>
        o.type === 'DineIn' &&
        o.status === 'Completed' &&
        o.completedAt &&
        o.completedAt >= periodRange.start &&
        o.completedAt <= periodRange.end &&
        o.tableId
    );
    if (!turns.length) return null;
    const total = turns.reduce((acc, o) => acc + Math.max(0, (o.completedAt || 0) - o.createdAt), 0);
    return Math.round(total / turns.length / 60000);
  }, [orders, periodRange, businessSettings?.enabledModules]);
  const periodItemsSold = useMemo(
    () => salesInPeriod.reduce((acc, s) => acc + s.items.reduce((n, i) => n + i.qty, 0), 0),
    [salesInPeriod]
  );

  const labourVsSales = useMemo(() => {
    const rateOf = (username: string) => users.find(u => u.username === username)?.hourlyRate || 0;
    const covered = new Set<string>();
    const dateKey = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    let labourCost = 0;
    shiftLogs.forEach(log => {
      const end = log.logoutTime ?? now;
      const start = Math.max(log.loginTime, periodRange.start);
      const stop = Math.min(end, periodRange.end);
      if (stop <= start) return;
      labourCost += ((stop - start) / 3600000) * rateOf(log.username);
      covered.add(`${log.username}|${dateKey(log.loginTime)}`);
    });
    workShifts.forEach(shift => {
      const shiftTime = new Date(`${shift.date}T00:00`).getTime();
      if (shiftTime < periodRange.start || shiftTime >= periodRange.end) return;
      if (covered.has(`${shift.username}|${shift.date}`)) return;
      labourCost += shift.totalHours * rateOf(shift.username);
    });
    const labourPercent = periodRevenue > 0 ? (labourCost / periodRevenue) * 100 : 0;
    return { labourCost, labourPercent };
  }, [shiftLogs, workShifts, users, periodRange, now, periodRevenue]);

  const handleDownloadReport = () => {
    const reportPeriod: ReportPeriod =
      period === 'quarterly' ? 'quarterly' : period;
    exportPeriodReportPdf(sales, products, reportPeriod, {
      tp,
      tc,
      currencySymbol: businessSettings?.currencySymbol,
      businessName: businessSettings?.name,
      labels: {
        title: t('downloadReport'),
        business: t('businessName'),
        report: t('period'),
        from: t('timeOffFrom'),
        to: t('timeOffTo'),
        allTime: t('allTime'),
        totalSales: t('totalRevenue'),
        orders: t('orders'),
        itemsSold: t('units'),
        aov: t('averageOrderValue'),
        cash: t('cash'),
        card: t('cardRecorded'),
        categories: t('categories'),
        category: t('category'),
        units: t('units'),
        revenue: t('revenue'),
        total: t('total'),
      },
    });
    addToast(t('reportDownloaded'), 'success');
  };

  const busiestHours = useMemo(() => {
    const source = salesInPeriod.length > 0 ? salesInPeriod : sales.filter(isCountableSale);
    const hours = Array.from({ length: 24 }, () => 0);
    source.forEach(sale => {
      const stamp = Number(sale.timestamp);
      if (Number.isNaN(stamp)) return;
      const date = new Date(stamp);
      if (Number.isNaN(date.getTime())) return;
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        hours[hour] += 1;
      }
    });
    const max = Math.max(...hours, 1);
    const topHours = hours
      .map((count, hour) => ({ hour, count }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    return { hours, max, topHours };
  }, [salesInPeriod, sales]);

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
      const revenue = staffSales.reduce((acc, s) => acc + salePayable(s), 0);
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
    if (busiestChartInstance.current) busiestChartInstance.current.destroy();

    if (revenueChartRef.current && categoryChartRef.current && busiestChartRef.current) {
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

      busiestChartInstance.current = new Chart(busiestChartRef.current, {
        type: 'bar',
        data: {
          labels: Array.from({ length: 24 }, (_, hour) => `${hour}:00`),
          datasets: [{
            label: t('orders'),
            data: busiestHours.hours,
            backgroundColor: 'rgba(212, 163, 115, 0.75)',
            borderColor: '#d4a373',
            borderWidth: 1,
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label} - ${ctx.parsed.y} ${t('orders')}`,
              },
            },
          },
          scales: {
            x: {
              ticks: {
                callback: (value, index) => ([0, 6, 12, 18, 23].includes(index) ? `${index}:00` : ''),
              },
            },
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
        },
      });
    }

    return () => {
      if (revenueChartInstance.current) revenueChartInstance.current.destroy();
      if (categoryChartInstance.current) categoryChartInstance.current.destroy();
      if (busiestChartInstance.current) busiestChartInstance.current.destroy();
    };
  }, [buckets, revenueByBucket, categoryStats, businessSettings, t, busiestHours]);

  if (setupRequired && products.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-bakery-beige text-bakery-brown flex items-center justify-center">
            <Rocket size={36} />
          </div>
          <h2 className="text-3xl font-black font-serif text-bakery-brown mb-3">
            Welcome to {businessSettings?.name || 'PreVisio'}
          </h2>
          <p className="text-bakery-brown/60 mb-8">
            Add your business profile and a menu to start selling. Everything else can wait.
          </p>
          <button
            onClick={onStartSetup}
            className="px-8 py-4 rounded-2xl font-bold bg-bakery-brown text-white inline-flex items-center gap-2"
          >
            <Rocket size={18} />
            Start setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-full overflow-hidden">
      {(pendingSteps.length > 0 || lowStockItems.length > 0) && user?.role === 'owner' && (
        <section className="bg-white border border-bakery-beige rounded-2xl p-3 sm:p-4 space-y-3">
          {pendingSteps.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold font-serif text-bakery-brown">{t('whatToDoNext')}</h3>
                {onStartSetup && !setupCompleted && (
                  <button type="button" onClick={onStartSetup} className="text-[10px] font-bold uppercase tracking-wider text-bakery-caramel hover:underline">
                    {t('resumeSetup')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingSteps.slice(0, 4).map(step => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={step.action}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bakery-beige/50 hover:bg-bakery-beige text-xs font-bold text-bakery-brown"
                  >
                    <ArrowRight size={12} className="opacity-50" />
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-bakery-beige/60">
              <AlertCircle size={14} className="text-orange-500 shrink-0" />
              <span className="text-xs font-bold text-bakery-brown">{t('lowStockOverview')}:</span>
              {lowStockItems.slice(0, 3).map(item => (
                <span key={item.id} className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.out ? 'bg-rose-50 text-rose-700' : 'bg-orange-50 text-orange-700'}`}>
                  {item.name}
                </span>
              ))}
              <button type="button" onClick={goToStockAttention} className="text-[10px] font-bold uppercase tracking-wider text-bakery-caramel ml-auto">
                {t('viewAllLowStock')} →
              </button>
            </div>
          )}
        </section>
      )}

      {user?.role === 'owner' && businessSettings?.id === 'ydplace' && sales.length === 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={loadDemoData}
            className="text-xs font-bold text-bakery-brown/50 hover:text-bakery-brown inline-flex items-center gap-1"
          >
            <TrendingUp size={12} />
            {t('loadDemoData')}
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold font-serif text-bakery-brown mr-1">{t('periodKpis')}</h3>
            <div className="flex items-center gap-1 bg-bakery-beige/40 p-1 rounded-xl">
              {periodOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                  className={`h-8 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                    period === option.id ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-bakery-brown text-white inline-flex items-center gap-1.5 hover:bg-bakery-brown/90 self-start sm:self-auto"
          >
            <Download size={12} />
            {t('downloadReport')}
          </button>
        </div>

        <div className={`grid gap-3 ${normalizeEnabledModules(businessSettings?.enabledModules).tips ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {[
            { label: t('revenue'), val: formatPrice(periodRevenue), icon: Euro },
            ...(normalizeEnabledModules(businessSettings?.enabledModules).tips
              ? [{ label: t('tipsTotal'), val: formatPrice(periodTips), icon: Banknote }]
              : []),
            { label: t('orders'), val: String(salesInPeriod.length), icon: ShoppingBag },
            { label: t('units'), val: String(periodItemsSold), icon: TrendingUp },
            { label: t('averageOrderValue'), val: formatPrice(averageOrderValue), icon: CreditCard },
          ].map(s => (
            <div key={s.label} className="card-bakery p-3 sm:p-4 flex justify-between items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider mb-0.5 truncate">{s.label}</p>
                <p className="text-base sm:text-lg font-black font-serif truncate">{s.val}</p>
              </div>
              <div className="p-2 bg-bakery-beige rounded-xl text-bakery-brown shrink-0 ml-2">
                <s.icon size={16} />
              </div>
            </div>
          ))}
        </div>

        {(
          (normalizeEnabledModules(businessSettings?.enabledModules).tips && tipsByCashier.length > 0) ||
          avgTurnMins != null
        ) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {normalizeEnabledModules(businessSettings?.enabledModules).tips && tipsByCashier.length > 0 && (
              <div className="card-bakery p-3 sm:p-4">
                <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider mb-2">{t('tipsByCashier')}</p>
                <ul className="space-y-1.5">
                  {tipsByCashier.map(row => (
                    <li key={row.name} className="flex justify-between text-sm font-bold">
                      <span className="truncate text-bakery-brown/70">{row.name}</span>
                      <span>{formatPrice(row.tips)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {avgTurnMins != null && (
              <div className="card-bakery p-3 sm:p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider">{t('avgTurnTime')}</p>
                  <p className="text-lg font-black font-serif mt-0.5">
                    {avgTurnMins} {t('minutesShort')}
                  </p>
                </div>
                <Clock className="text-bakery-brown/40" size={20} />
              </div>
            )}
          </div>
        )}

        <div className="card-bakery p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-bakery-beige rounded-xl text-bakery-brown shrink-0">
              <Clock size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider truncate">{t('labourVsSales')}</p>
              <p className="text-base sm:text-lg font-black font-serif">{labourVsSales.labourPercent.toFixed(1)}%</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-bold">
            <span className="text-bakery-brown/60">{t('labourCost')}: {formatPrice(labourVsSales.labourCost)}</span>
            <span>{t('revenue')}: {formatPrice(periodRevenue)}</span>
          </div>
        </div>

        {(() => {
          const lastClosed = [...cashSessions].filter(s => s.closedAt).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))[0];
          return (
            <div className="card-bakery p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-bakery-brown/50 uppercase tracking-wider">{t('lastZReport')}</p>
                <p className="text-sm font-bold mt-0.5">
                  {lastClosed
                    ? new Date(lastClosed.closedAt!).toLocaleString()
                    : t('noClosedTill')}
                </p>
              </div>
              {lastClosed && (
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl bg-bakery-brown text-white text-xs font-bold inline-flex items-center gap-1.5"
                  onClick={() => {
                    const totals = tillTotals(sales, lastClosed);
                    downloadZReport({
                      business: businessSettings,
                      currencySymbol: businessSettings?.currencySymbol,
                      openedAt: lastClosed.openedAt,
                      closedAt: lastClosed.closedAt || Date.now(),
                      openingFloat: lastClosed.openingFloat,
                      expectedCash: totals.expectedCash,
                      countedCash: lastClosed.closingCounted || totals.expectedCash,
                      cardRecorded: totals.cardRecorded,
                      cashSales: totals.cashSales,
                      refunds: totals.refunds,
                      voids: totals.voids,
                      orderCount: totals.orderCount,
                      labels: {
                        zReport: t('zReport'),
                        cardRecorded: t('cardRecorded'),
                        cash: t('cash'),
                      },
                    });
                  }}
                >
                  <Download size={14} />
                  {t('zReport')}
                </button>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card-bakery p-3 sm:p-4">
            <h4 className="text-sm font-bold font-serif mb-3">{t('revenueTrends')}</h4>
            <div className="h-44 w-full"><canvas ref={revenueChartRef}></canvas></div>
          </div>
          <div className="card-bakery p-3 sm:p-4">
            <h4 className="text-sm font-bold font-serif mb-3">{t('revenueByCategory')}</h4>
            <div className="h-44 w-full"><canvas ref={categoryChartRef}></canvas></div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card-bakery p-3 sm:p-4 lg:col-span-2">
          <h4 className="text-sm font-bold font-serif mb-3">{t('bestSellers')}</h4>
          <div className="space-y-2">
            {bestSellers.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-bakery-cream rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-bakery-brown text-white text-[10px] font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                  <p className="font-bold text-sm truncate">{item.emoji} {item.name}</p>
                  <span className="text-[10px] text-bakery-brown/50 font-bold shrink-0">{item.qty}</span>
                </div>
                <p className="font-black text-sm shrink-0">{formatPrice(item.revenue)}</p>
              </div>
            ))}
            {bestSellers.length === 0 && (
              <p className="text-center text-bakery-brown/40 py-6 italic text-sm">{t('noSalesData')}</p>
            )}
          </div>
        </div>

        <div className="card-bakery p-3 sm:p-4 space-y-3">
          <h4 className="text-sm font-bold font-serif">{t('salesSnapshot')}</h4>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-bakery-brown/60"><Banknote size={14} />{t('cash')}</span>
            <span className="font-black">{formatPrice(paymentBreakdown.totals.cash)} · {paymentBreakdown.cashPercent}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-bakery-brown/60"><CreditCard size={14} />{t('cardRecorded')}</span>
            <span className="font-black">{formatPrice(paymentBreakdown.totals.card)} · {paymentBreakdown.cardPercent}%</span>
          </div>
          <div className="w-full bg-bakery-beige rounded-full h-1.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${paymentBreakdown.cashPercent}%` }} />
            <div className="bg-blue-500 h-full" style={{ width: `${paymentBreakdown.cardPercent}%` }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('busiestHours')}</p>
            <div className="h-20 w-full"><canvas ref={busiestChartRef}></canvas></div>
          </div>
          {categoryStats.length > 0 && (
            <div className="pt-2 border-t border-bakery-beige/50 space-y-1.5">
              {categoryStats.slice(0, 4).map(cat => (
                <div key={cat.name} className="flex justify-between text-xs gap-2">
                  <span className="font-bold truncate">{cat.name}</span>
                  <span className="text-bakery-brown/60 shrink-0">{cat.units} · {formatPrice(cat.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {user?.role === 'owner' && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base font-bold font-serif text-bakery-brown">{t('staffPerformance')}</h3>
            <div className="flex items-center gap-1 bg-bakery-beige/40 p-1 rounded-xl">
              {periodOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStaffPeriod(option.id)}
                  className={`h-8 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                    staffPeriod === option.id ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-bakery p-3 sm:p-4 space-y-2">
            {staffPerformance.slice(0, 5).map((staff, idx) => {
              const rankLabel = idx === 0 ? t('rankFirst') : idx === 1 ? t('rankSecond') : idx === 2 ? t('rankThird') : `${idx + 1}`;
              const percent = topEfficiency ? Math.min(100, (staff.revenuePerHour / topEfficiency) * 100) : 0;
              return (
                <div key={staff.username} className="px-3 py-2.5 bg-bakery-cream rounded-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-bakery-brown text-white text-[10px] font-black flex items-center justify-center shrink-0">{rankLabel}</span>
                      <p className="font-bold text-sm truncate">{staff.fullName}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] font-bold text-bakery-brown">
                      <span>{staff.orders} {t('orders')}</span>
                      <span>{formatPrice(staff.revenue)}</span>
                      <span>{formatPrice(staff.revenuePerHour)}/h</span>
                      <span>{staff.totalHours.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div className="w-full bg-bakery-beige rounded-full h-1.5 mt-2">
                    <div className="bg-bakery-caramel h-full rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {staffPerformance.length === 0 && (
              <p className="text-center text-bakery-brown/40 italic text-sm py-4">{t('noStaffData')}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
