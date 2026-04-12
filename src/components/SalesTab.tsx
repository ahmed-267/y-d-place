
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Search, Download, ChevronDown, ChevronUp, Calendar as CalendarIcon, Edit2, Trash2, Plus } from 'lucide-react';
import { Sale, SaleItem } from '../types';
import { Pagination } from './Pagination';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { toSearchValue, priceMatchesQuery } from '../utils/search';

export const SalesTab = () => {
  const { sales, setSales, t, formatPrice, addToast, products, tp, lang } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteSaleConfirm, setDeleteSaleConfirm] = useState<Sale | null>(null);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const locale = lang === 'fl' ? 'nl-BE' : lang;

  const resolveItemName = (item: SaleItem) => {
    const product = productMap.get(item.productId);
    if (product) return tp(product);
    return item.translations?.[lang] || item.nameEN;
  };

  const resolveExtraName = (extra: { productId: number; nameEN: string }) => {
    const product = productMap.get(extra.productId);
    return product ? tp(product) : extra.nameEN;
  };

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
      list = list.filter(sale => {
        const itemMatch = sale.items?.some(i => {
          const nameMatch = toSearchValue(resolveItemName(i)).includes(s);
          const translationMatch = i?.translations ? Object.values(i.translations).some(val => toSearchValue(val).includes(s)) : false;
          return nameMatch || translationMatch;
        }) || false;
        const cashierMatch = toSearchValue(sale?.cashierUsername).includes(s) || toSearchValue(sale?.cashierFullName).includes(s);
        const totalMatch = priceMatchesQuery(sale?.subtotal, s) || toSearchValue(sale?.subtotal).includes(s);
        const paymentLabel = sale?.paymentMethod === 'Cash' ? t('cash') : t('card');
        const paymentMatch = toSearchValue(sale?.paymentMethod).includes(s) || toSearchValue(paymentLabel).includes(s);
        const date = new Date(sale?.timestamp || 0);
        const dateMatch =
          toSearchValue(date.toLocaleDateString(locale)).includes(s) ||
          toSearchValue(date.toLocaleString(locale)).includes(s) ||
          toSearchValue(date.toISOString().slice(0, 10)).includes(s);
        return itemMatch || cashierMatch || totalMatch || paymentMatch || dateMatch;
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, filter, search, dateRange, selectedWeek, selectedMonth, formatPrice, locale, productMap, lang, tp, t]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, dateRange, selectedWeek, selectedMonth]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.subtotal, 0);

  const handleDeleteSale = () => {
    if (!deleteSaleConfirm) return;
    setSales(sales.filter(s => s.id !== deleteSaleConfirm.id));
    addToast(t('saleDeleted'), "info");
    setDeleteSaleConfirm(null);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSale) return;
    setSales(sales.map(s => s.id === editSale.id ? editSale : s));
    addToast(t('saleUpdated'));
    setEditSale(null);
  };

  const exportCSV = () => {
    const headers = `${t('csvDate')},${t('csvTime')},${t('csvItems')},${t('csvTotal')},${t('csvPayment')},${t('csvCashier')}\n`;
    const rows = filteredSales.map(s => {
      const date = new Date(s.timestamp).toLocaleDateString(locale);
      const time = new Date(s.timestamp).toLocaleTimeString(locale);
      const items = s.items.map(i => `${i.qty}x ${resolveItemName(i)}`).join('; ');
      return `${date},${time},"${items}",${s.subtotal},${t(s.paymentMethod === 'Cash' ? 'cash' : 'card')},${s.cashierFullName}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('salesExportFile')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const groupItems = (items: SaleItem[]) => {
    const grouped: Record<string, SaleItem> = {};
    items.forEach(item => {
      const key = `${item.productId}-${JSON.stringify(item.extras?.map((e: any) => e.productId).sort() || [])}`;
      if (grouped[key]) {
        grouped[key].qty += item.qty;
        grouped[key].lineTotal += item.lineTotal;
      } else {
        grouped[key] = { ...item };
      }
    });
    return Object.values(grouped);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap gap-1 sm:gap-2 bg-bakery-beige/30 p-1 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
            {[
              { id: 'All', label: t('all') },
              { id: 'Today', label: t('today') },
              { id: 'WeekQuick', label: t('week') },
              { id: 'MonthQuick', label: t('month') },
              { id: 'Custom', label: t('dateRange') },
              { id: 'WeekPicker', label: t('week') },
              { id: 'MonthPicker', label: t('month') }
            ].map(f => (
              <button 
                key={f.id} 
                onClick={() => setFilter(f.id)}
                className={`flex-1 lg:flex-none px-3 sm:px-4 py-2 rounded-xl font-bold text-[10px] sm:text-sm transition-all whitespace-nowrap ${
                  filter === f.id ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown/60 hover:text-bakery-brown'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={18} />
              <input 
                type="text" 
                placeholder={t('search')}
                className="w-full pl-10 pr-4 py-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={exportCSV} className="p-2 bg-bakery-brown text-white rounded-xl hover:bg-bakery-brown/90 transition-colors shrink-0 active:scale-90">
              <Download size={20} />
            </button>
          </div>
        </div>

        {filter === 'Custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('from')}</span>
              <input 
                type="date" 
                className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white" 
                value={dateRange.from} 
                onChange={e => setDateRange({ ...dateRange, from: e.target.value })} 
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('to')}</span>
              <input 
                type="date" 
                className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white" 
                value={dateRange.to} 
                onChange={e => setDateRange({ ...dateRange, to: e.target.value })} 
              />
            </div>
          </div>
        )}

        {filter === 'WeekPicker' && (
          <div className="flex flex-col gap-1 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('week')}</span>
            <input 
              type="week" 
              className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white" 
              value={selectedWeek} 
              onChange={e => setSelectedWeek(e.target.value)} 
            />
          </div>
        )}

        {filter === 'MonthPicker' && (
          <div className="flex flex-col gap-1 p-4 bg-bakery-beige/20 rounded-2xl animate-fade-in">
            <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('month')}</span>
            <input 
              type="month" 
              className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
            />
          </div>
        )}
      </div>

      <div className="card-bakery p-4 sm:p-6 flex justify-between items-center bg-bakery-accent/20">
        <p className="font-bold text-bakery-brown/60 uppercase tracking-widest text-[10px] sm:text-xs">
          {filteredSales.length} {t('orders')}
        </p>
        <p className="text-lg sm:text-2xl font-black font-serif">
          {t('total')}: {formatPrice(totalRevenue)}
        </p>
      </div>

      <div className="card-bakery overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-4">{t('dateTime')}</th>
                <th className="p-4">{t('itemsSummary')}</th>
                <th className="p-4">{t('total')}</th>
                <th className="p-4">{t('payment')}</th>
                <th className="p-4">{t('cashier')}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {paginatedSales.map(sale => (
                <React.Fragment key={sale.id}>
                  <tr 
                    className="hover:bg-bakery-cream/50 cursor-pointer transition-colors"
                    onClick={() => setExpandedRow(expandedRow === sale.id ? null : sale.id)}
                  >
                    <td className="p-4 font-medium whitespace-nowrap">{new Date(sale.timestamp).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-4 text-bakery-brown/70 truncate max-w-[200px]">
                      {groupItems(sale.items).map(i => `${i.qty}x ${resolveItemName(i)}`).join(', ')}
                    </td>
                    <td className="p-4 font-black whitespace-nowrap">{formatPrice(sale.subtotal)}</td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                        sale.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {sale.paymentMethod === 'Cash' ? t('cash') : t('card')}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-bold leading-tight whitespace-nowrap">{sale.cashierFullName}</p>
                      <p className="text-[10px] text-bakery-brown/50">@{sale.cashierUsername}</p>
                    </td>
                    <td className="p-4 text-bakery-brown/40">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditSale(sale); }}
                          className="p-2 hover:bg-bakery-beige rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteSaleConfirm(sale); }}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                        {expandedRow === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </td>
                  </tr>
                  {expandedRow === sale.id && (
                    <tr className="bg-bakery-cream/30 animate-fade-in">
                      <td colSpan={6} className="p-4 sm:p-6">
                        <div className="space-y-3">
                          <p className="font-black text-[10px] uppercase tracking-widest text-bakery-brown/40">{t('orderDetails')}</p>
                          {groupItems(sale.items).map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-1 border-b border-bakery-beige/50 pb-2">
                              <div className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-4">
                                  <span className="font-bold text-bakery-caramel">{item.qty}x</span>
                                  <span className="font-bold">{resolveItemName(item)}</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold">{formatPrice(item.lineTotal)}</p>
                                </div>
                              </div>
                              {item.extras?.map(e => (
                                <p key={e.productId} className="text-[10px] text-bakery-caramel font-bold italic ml-10">+ {resolveExtraName(e)} ({formatPrice(e.price)})</p>
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

      {filteredSales.length > itemsPerPage && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          t={t}
        />
      )}

      {editSale && (
        <Modal title={t('editSaleRecord')} onClose={() => setEditSale(null)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('payment')}</label>
              <select 
                className="w-full p-3 border rounded-xl"
                value={editSale.paymentMethod}
                onChange={e => setEditSale({ ...editSale, paymentMethod: e.target.value as 'Cash' | 'Card' })}
              >
                <option value="Cash">{t('cash')}</option>
                <option value="Card">{t('card')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('subtotal')}</label>
              <input 
                type="number"
                step="0.01"
                className="w-full p-3 border rounded-xl"
                value={editSale.subtotal}
                onChange={e => setEditSale({ ...editSale, subtotal: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {deleteSaleConfirm && (
        <ConfirmDialog 
          isOpen={!!deleteSaleConfirm}
          title={t('deleteSaleRecord')}
          message={t('deleteSaleConfirm')}
          onConfirm={handleDeleteSale}
          onClose={() => setDeleteSaleConfirm(null)}
        />
      )}
    </div>
  );
};
