
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Search, Download, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
import { Sale } from '../types';

export const SalesTab = () => {
  const { sales, t } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0)).getTime();
    const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);
    const monthStart = todayStart - (30 * 24 * 60 * 60 * 1000);

    let list = sales;
    
    if (filter === 'Today') {
      list = list.filter(s => s.timestamp >= todayStart);
    } else if (filter === 'WeekQuick') {
      list = list.filter(s => s.timestamp >= weekStart);
    } else if (filter === 'MonthQuick') {
      list = list.filter(s => s.timestamp >= monthStart);
    } else if (filter === 'Custom' && dateRange.from && dateRange.to) {
      const from = new Date(dateRange.from).getTime();
      const to = new Date(dateRange.to).setHours(23,59,59,999);
      list = list.filter(s => s.timestamp >= from && s.timestamp <= to);
    } else if (filter === 'WeekPicker' && selectedWeek) {
      // selectedWeek is "YYYY-Www"
      const [year, week] = selectedWeek.split('-W').map(Number);
      const firstDayOfYear = new Date(year, 0, 1);
      const days = (week - 1) * 7;
      const weekStartTs = new Date(year, 0, 1 + days).getTime();
      const weekEndTs = weekStartTs + (7 * 24 * 60 * 60 * 1000) - 1;
      list = list.filter(s => s.timestamp >= weekStartTs && s.timestamp <= weekEndTs);
    } else if (filter === 'MonthPicker' && selectedMonth) {
      // selectedMonth is "YYYY-MM"
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStartTs = new Date(year, month - 1, 1).getTime();
      const monthEndTs = new Date(year, month, 0, 23, 59, 59, 999).getTime();
      list = list.filter(s => s.timestamp >= monthStartTs && s.timestamp <= monthEndTs);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(sale => 
        sale.cashierUsername.toLowerCase().includes(s) ||
        sale.cashierFullName.toLowerCase().includes(s) ||
        sale.items.some(i => i.nameEN.toLowerCase().includes(s))
      );
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, filter, search, dateRange, selectedWeek, selectedMonth]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.subtotal, 0);

  const exportCSV = () => {
    const headers = "Date,Time,Items,Total,Payment,Cashier\n";
    const rows = filteredSales.map(s => {
      const date = new Date(s.timestamp).toLocaleDateString();
      const time = new Date(s.timestamp).toLocaleTimeString();
      const items = s.items.map(i => `${i.qty}x ${i.nameEN}`).join('; ');
      return `${date},${time},"${items}",${s.subtotal},${s.paymentMethod},${s.cashierFullName}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ydplace_sales_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2 bg-bakery-beige/30 p-1 rounded-2xl">
            {[
              { id: 'All', label: t('all') },
              { id: 'Today', label: t('today') },
              { id: 'WeekQuick', label: t('week') },
              { id: 'MonthQuick', label: t('month') },
              { id: 'Custom', label: t('dateRange') },
              { id: 'WeekPicker', label: 'Week Picker' },
              { id: 'MonthPicker', label: 'Month Picker' }
            ].map(f => (
              <button 
                key={f.id} 
                onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  filter === f.id ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown/60 hover:text-bakery-brown'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={18} />
              <input 
                type="text" 
                placeholder={t('search')}
                className="w-full pl-10 pr-4 py-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={exportCSV} className="p-2 bg-bakery-brown text-white rounded-xl hover:bg-bakery-brown/90 transition-colors">
              <Download size={20} />
            </button>
          </div>
        </div>

        {filter === 'Custom' && (
          <div className="flex flex-wrap items-center gap-4 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-bakery-brown/40">{t('from')}</span>
              <input type="date" className="p-2 border rounded-xl" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-bakery-brown/40">{t('to')}</span>
              <input type="date" className="p-2 border rounded-xl" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} />
            </div>
          </div>
        )}

        {filter === 'WeekPicker' && (
          <div className="flex items-center gap-4 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <span className="text-xs font-bold uppercase text-bakery-brown/40">{t('week')}</span>
            <input type="week" className="p-2 border rounded-xl" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} />
          </div>
        )}

        {filter === 'MonthPicker' && (
          <div className="flex items-center gap-4 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <span className="text-xs font-bold uppercase text-bakery-brown/40">{t('month')}</span>
            <input type="month" className="p-2 border rounded-xl" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
        )}
      </div>

      <div className="card-bakery p-6 flex justify-between items-center bg-bakery-accent/20">
        <p className="font-bold text-bakery-brown/60 uppercase tracking-widest text-xs">
          Showing {filteredSales.length} orders
        </p>
        <p className="text-2xl font-black font-serif">
          Total: €{totalRevenue.toFixed(2)}
        </p>
      </div>

      <div className="card-bakery overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Items Summary</th>
                <th className="p-4">Total</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Cashier</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {filteredSales.map(sale => (
                <React.Fragment key={sale.id}>
                  <tr 
                    className="hover:bg-bakery-cream/50 cursor-pointer transition-colors"
                    onClick={() => setExpandedRow(expandedRow === sale.id ? null : sale.id)}
                  >
                    <td className="p-4 font-medium">{new Date(sale.timestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-4 text-bakery-brown/70 truncate max-w-[200px]">
                      {sale.items.map(i => `${i.qty}x ${i.nameEN}`).join(', ')}
                    </td>
                    <td className="p-4 font-black">€{sale.subtotal.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        sale.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {t(sale.paymentMethod.toLowerCase())}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-bold leading-tight">{sale.cashierFullName}</p>
                      <p className="text-[10px] text-bakery-brown/50">@{sale.cashierUsername}</p>
                    </td>
                    <td className="p-4 text-bakery-brown/40">
                      {expandedRow === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </td>
                  </tr>
                  {expandedRow === sale.id && (
                    <tr className="bg-bakery-cream/30 animate-fade-in">
                      <td colSpan={6} className="p-6">
                        <div className="space-y-3">
                          <p className="font-black text-xs uppercase tracking-widest text-bakery-brown/40">Order Details</p>
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-1 border-b border-bakery-beige/50 pb-2">
                              <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-4">
                                  <span className="font-bold text-bakery-caramel">{item.qty}x</span>
                                  <span className="font-bold">{item.nameEN}</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">€{item.lineTotal.toFixed(2)}</p>
                                </div>
                              </div>
                              {item.extras?.map(e => (
                                <p key={e.productId} className="text-[10px] text-bakery-caramel font-bold italic ml-10">+ {e.nameEN} (€{e.price.toFixed(2)})</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSales.length === 0 && (
          <div className="p-20 text-center opacity-30 italic">
            {t('noSales')}
          </div>
        )}
      </div>
    </div>
  );
};
