
import React, { useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { Euro, Calendar, TrendingUp, ShoppingBag, PieChart } from 'lucide-react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

export const OverviewTab = () => {
  const { sales, shiftLogs, t, products, categories, businessSettings, formatPrice, user, loadDemoData } = useApp();
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const doughnutChartInstance = useRef<Chart | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0)).getTime();
    const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);
    const monthStart = todayStart - (30 * 24 * 60 * 60 * 1000);

    const todaySales = sales.filter(s => s.timestamp >= todayStart);
    const weekSales = sales.filter(s => s.timestamp >= weekStart);
    const monthSales = sales.filter(s => s.timestamp >= monthStart);

    const cashOrders = sales.filter(s => s.paymentMethod === 'Cash').length;
    const cardOrders = sales.filter(s => s.paymentMethod === 'Card').length;
    const totalOrders = sales.length;

    return {
      todayRev: todaySales.reduce((acc, s) => acc + s.subtotal, 0),
      weekRev: weekSales.reduce((acc, s) => acc + s.subtotal, 0),
      monthRev: monthSales.reduce((acc, s) => acc + s.subtotal, 0),
      totalRev: sales.reduce((acc, s) => acc + s.subtotal, 0),
      ordersToday: todaySales.length,
      cashOrders,
      cardOrders,
      cashPercent: totalOrders ? Math.round((cashOrders / totalOrders) * 100) : 0,
      cardPercent: totalOrders ? Math.round((cardOrders / totalOrders) * 100) : 0
    };
  }, [sales]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { units: number; revenue: number }> = {};
    categories.forEach(cat => stats[cat] = { units: 0, revenue: 0 });

    sales.forEach(s => s.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      const cat = p ? p.category : 'Unknown';
      if (!stats[cat]) stats[cat] = { units: 0, revenue: 0 };
      stats[cat].units += item.qty;
      stats[cat].revenue += item.lineTotal;
    }));

    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales, products, categories]);

  useEffect(() => {
    if (barChartInstance.current) barChartInstance.current.destroy();
    if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();

    if (barChartRef.current && doughnutChartRef.current) {
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en-GB', { weekday: 'short' });
      });

      const revPerDay = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0,0,0,0);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);
        return sales.filter(s => s.timestamp >= d.getTime() && s.timestamp < nextD.getTime())
                    .reduce((acc, s) => acc + s.subtotal, 0);
      });

      const currencySymbol = businessSettings?.currencySymbol || '€';
      const currencyCode = businessSettings?.currencyCode || 'EUR';

      barChartInstance.current = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: last7Days,
          datasets: [{ 
            label: `Revenue (${currencySymbol})`, 
            data: revPerDay, 
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
                label: (context) => `Revenue: ${currencySymbol}${context.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: { title: { display: true, text: 'Date', font: { weight: 'bold' } } },
            y: { 
              title: { display: true, text: `Revenue (${currencySymbol})`, font: { weight: 'bold' } },
              ticks: { callback: (val) => `${currencySymbol}${val}` }
            }
          }
        }
      });

      const catRev = categoryStats.map(c => c.revenue);
      const catLabels = categoryStats.map(c => c.name);

      doughnutChartInstance.current = new Chart(doughnutChartRef.current, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{ 
            data: catRev, 
            backgroundColor: ['#5d4037', '#d4a373', '#faedcd', '#e9edc9', '#ccd5ae', '#d4a373'] 
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          cutout: '70%',
          plugins: {
            datalabels: { display: false },
            title: { display: true, text: 'Revenue by Category', font: { size: 16, weight: 'bold', family: 'serif' } },
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const cat = categoryStats[context.dataIndex];
                  const symbol = businessSettings?.currencySymbol || '€';
                  return `${cat.name}: ${symbol}${cat.revenue.toFixed(2)} (${cat.units} units)`;
                }
              }
            }
          }
        }
      });
    }

    return () => {
      if (barChartInstance.current) barChartInstance.current.destroy();
      if (doughnutChartInstance.current) doughnutChartInstance.current.destroy();
    };
  }, [sales, categoryStats]);

  const bestSellers = useMemo(() => {
    const counts: Record<number, number> = {};
    sales.forEach(s => s.items.forEach(item => {
      counts[item.productId] = (counts[item.productId] || 0) + item.qty;
    }));
    return Object.entries(counts)
      .map(([id, qty]) => {
        const p = products.find(prod => prod.id === parseInt(id));
        return { ...p, qty, revenue: qty * (p?.price || 0) };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales, products]);

  return (
    <div className="space-y-6 animate-fade-in max-w-full overflow-hidden">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-serif text-bakery-brown">Business Overview</h2>
        {user?.role === 'owner' && sales.length < 10 && (
          <button 
            onClick={loadDemoData}
            className="px-4 py-2 bg-bakery-accent text-bakery-brown rounded-xl font-bold text-xs hover:bg-bakery-brown hover:text-white transition-all active:scale-95 flex items-center gap-2"
          >
            <TrendingUp size={16} />
            Load 3 Months Demo Data
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {[
          { label: t('revenueToday'), val: formatPrice(stats.todayRev), icon: Euro },
          { label: t('revenueWeek'), val: formatPrice(stats.weekRev), icon: Calendar },
          { label: t('revenueMonth'), val: formatPrice(stats.monthRev), icon: TrendingUp },
          { label: t('revenueTotal'), val: formatPrice(stats.totalRev), icon: Euro },
          { label: t('ordersToday'), val: stats.ordersToday, icon: ShoppingBag }
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
          <h3 className="text-lg font-bold font-serif mb-6">Revenue Trends</h3>
          <div className="h-64 sm:h-72 w-full"><canvas ref={barChartRef}></canvas></div>
        </div>
        <div className="card-bakery p-4 sm:p-6">
          <div className="h-64 sm:h-72 w-full"><canvas ref={doughnutChartRef}></canvas></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-bakery p-4 sm:p-6 lg:col-span-1">
          <h3 className="text-lg font-bold font-serif mb-6">{t('paymentBreakdown')}</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></div>
                <span className="font-bold text-sm">{t('cash')}</span>
              </div>
              <span className="font-black text-sm sm:text-base">{stats.cashOrders} ({stats.cashPercent}%)</span>
            </div>
            <div className="w-full bg-bakery-beige rounded-full h-2 overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${stats.cashPercent}%` }}></div>
              <div className="bg-blue-500 h-full" style={{ width: `${stats.cardPercent}%` }}></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                <span className="font-bold text-sm">{t('card')}</span>
              </div>
              <span className="font-black text-sm sm:text-base">{stats.cardOrders} ({stats.cardPercent}%)</span>
            </div>
          </div>
        </div>

        <div className="card-bakery p-4 sm:p-6 lg:col-span-2">
          <h3 className="text-lg font-bold font-serif mb-6">{t('whatsSelling')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {categoryStats.slice(0, 6).map(cat => {
              const maxRev = Math.max(...categoryStats.map(c => c.revenue));
              const percent = maxRev ? (cat.revenue / maxRev) * 100 : 0;
              return (
                <div key={cat.name} className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="font-bold truncate mr-2">{cat.name}</span>
                    <span className="text-bakery-brown/60 shrink-0">{cat.units} units · {formatPrice(cat.revenue)}</span>
                  </div>
                  <div className="w-full bg-bakery-beige rounded-full h-1.5 overflow-hidden">
                    <div className="bg-bakery-caramel h-full" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-bakery p-4 sm:p-6">
          <h3 className="text-lg font-bold font-serif mb-6">{t('bestSellers')}</h3>
          <div className="space-y-4">
            {bestSellers.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-bakery-cream rounded-xl gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span className="w-6 h-6 flex items-center justify-center bg-bakery-brown text-white text-[10px] font-bold rounded-full shrink-0">{i+1}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{t(p.transKey || '')}</p>
                    <p className="text-[10px] text-bakery-brown/50 uppercase font-bold truncate">{p.category}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{p.qty} units</p>
                  <p className="text-[10px] text-bakery-caramel font-bold">{formatPrice(p.revenue)}</p>
                </div>
              </div>
            ))}
            {bestSellers.length === 0 && <p className="text-center text-bakery-brown/40 py-8 italic">No sales data yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
