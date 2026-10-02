
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Search, Download, ChevronDown, ChevronUp, Calendar as CalendarIcon, Edit2, Trash2, Printer, Undo2 } from 'lucide-react';
import { Sale, SaleItem } from '../types';
import { DataTablePagination, useTablePagination } from './DataTablePagination';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';
import { toSearchValue, priceMatchesQuery } from '../utils/search';
import { SortableTh } from '../utils/tableSort';
import { isCountableSale, salePayable, paymentMethodLabel } from '../utils/ticketMoney';
import { downloadCustomerReceipt } from '../utils/tickets';

export const SalesTab = () => {
  const { sales, updateSale, deleteSale, refundSale, t, formatPrice, products, tp, lang, businessSettings } = useApp();
  type SortKey = 'dateTime' | 'items' | 'total' | 'payment' | 'cashier';
  type StatusFilter = 'completed' | 'refunded' | 'voided' | 'all';
  type DateFilter = 'All' | 'Today' | 'Week' | 'Month' | 'Custom';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [deleteSaleConfirm, setDeleteSaleConfirm] = useState<Sale | null>(null);
  const [refundConfirm, setRefundConfirm] = useState<Sale | null>(null);

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

  function groupItems(items: SaleItem[]) {
    const grouped: Record<string, SaleItem> = {};
    items.forEach(item => {
      const key = `${item.productId}-${item.note || ''}-${JSON.stringify(item.extras?.map((e: any) => e.productId).sort() || [])}`;
      if (grouped[key]) {
        grouped[key].qty += item.qty;
        grouped[key].lineTotal += item.lineTotal;
      } else {
        grouped[key] = { ...item };
      }
    });
    return Object.values(grouped);
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'dateTime' || key === 'total' ? 'desc' : 'asc');
  };

  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let list = sales;

    if (statusFilter === 'completed') {
      list = list.filter(s => !s.status || s.status === 'completed');
    } else if (statusFilter === 'refunded') {
      list = list.filter(s => s.status === 'refunded');
    } else if (statusFilter === 'voided') {
      list = list.filter(s => s.status === 'voided');
    }

    if (dateFilter === 'Today') {
      list = list.filter(s => s.timestamp >= todayStart);
    } else if (dateFilter === 'Week') {
      list = list.filter(s => s.timestamp >= weekStart);
    } else if (dateFilter === 'Month') {
      list = list.filter(s => s.timestamp >= monthStart);
    } else if (dateFilter === 'Custom' && dateRange.from && dateRange.to) {
      const from = new Date(dateRange.from).getTime();
      const to = new Date(dateRange.to).setHours(23, 59, 59, 999);
      list = list.filter(s => s.timestamp >= from && s.timestamp <= to);
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
        const payable = salePayable(sale);
        const totalMatch = priceMatchesQuery(payable, s) || toSearchValue(payable).includes(s);
        const paymentLabel = paymentMethodLabel(sale.paymentMethod, t);
        const paymentMatch = toSearchValue(sale?.paymentMethod).includes(s) || toSearchValue(paymentLabel).includes(s);
        const date = new Date(sale?.timestamp || 0);
        const dateMatch =
          toSearchValue(date.toLocaleDateString(locale)).includes(s) ||
          toSearchValue(date.toLocaleString(locale)).includes(s) ||
          toSearchValue(date.toISOString().slice(0, 10)).includes(s);
        return itemMatch || cashierMatch || totalMatch || paymentMatch || dateMatch;
      });
    }

    const sorted = [...list].sort((a, b) => {
      const itemLabelA = groupItems(a.items).map(i => `${i.qty}x ${resolveItemName(i)}`).join(', ');
      const itemLabelB = groupItems(b.items).map(i => `${i.qty}x ${resolveItemName(i)}`).join(', ');
      if (sortKey === 'dateTime') {
        return a.timestamp - b.timestamp;
      }
      if (sortKey === 'items') {
        return itemLabelA.localeCompare(itemLabelB);
      }
      if (sortKey === 'total') {
        return salePayable(a) - salePayable(b);
      }
      if (sortKey === 'payment') {
        return a.paymentMethod.localeCompare(b.paymentMethod);
      }
      const cashierA = `${a.cashierFullName} ${a.cashierUsername}`;
      const cashierB = `${b.cashierFullName} ${b.cashierUsername}`;
      return cashierA.localeCompare(cashierB);
    });
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [sales, statusFilter, dateFilter, search, dateRange, formatPrice, locale, productMap, lang, tp, t, sortKey, sortDirection]);

  const salesPaging = useTablePagination(filteredSales.length, 10, `${statusFilter}|${dateFilter}|${search}|${dateRange.from}|${dateRange.to}`);
  const paginatedSales = useMemo(
    () => salesPaging.slice(filteredSales),
    [filteredSales, salesPaging.page, salesPaging.pageSize, salesPaging.start]
  );

  const totalRevenue = filteredSales.filter(isCountableSale).reduce((acc, s) => acc + salePayable(s), 0);

  const ticketLabels = () => ({
    receipt: t('receipt'),
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
  });

  const printReceipt = (sale: Sale) => {
    downloadCustomerReceipt(sale, {
      currencySymbol: businessSettings?.currencySymbol,
      business: businessSettings,
      labels: ticketLabels(),
      itemName: item => resolveItemName(item),
      extraName: (id, fallback) => {
        const product = productMap.get(id);
        return product ? tp(product) : fallback;
      },
    });
  };

  const handleDeleteSale = () => {
    if (!deleteSaleConfirm) return;
    deleteSale(deleteSaleConfirm.id);
    setDeleteSaleConfirm(null);
  };

  const handleRefundSale = () => {
    if (!refundConfirm) return;
    refundSale(refundConfirm.id);
    setRefundConfirm(null);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSale) return;
    updateSale(editSale);
    setEditSale(null);
  };

  const exportCSV = () => {
    const headers = `${t('csvDate')},${t('csvTime')},${t('csvItems')},${t('csvTotal')},${t('csvPayment')},${t('csvCashier')}\n`;
    const rows = filteredSales.map(s => {
      const date = new Date(s.timestamp).toLocaleDateString(locale);
      const time = new Date(s.timestamp).toLocaleTimeString(locale);
      const items = s.items.map(i => `${i.qty}x ${resolveItemName(i)}`).join('; ');
      return `${date},${time},"${items}",${salePayable(s)},${paymentMethodLabel(s.paymentMethod, t)},${s.cashierFullName}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('salesExportFile')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-full overflow-x-hidden pt-1">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="flex flex-wrap items-end gap-2 w-full lg:w-auto">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('salesStatus')}</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="h-10 min-w-[9.5rem] px-3 rounded-xl border border-bakery-beige bg-white text-sm font-bold text-bakery-brown outline-none focus:ring-2 focus:ring-bakery-caramel"
                >
                  <option value="completed">{t('salesCompleted')}</option>
                  <option value="refunded">{t('filterRefunded')}</option>
                  <option value="voided">{t('filterVoided')}</option>
                  <option value="all">{t('all')}</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-1 bg-bakery-beige/30 p-1 rounded-xl">
                {([
                  { id: 'All' as const, label: t('all') },
                  { id: 'Today' as const, label: t('today') },
                  { id: 'Week' as const, label: t('thisWeek') },
                  { id: 'Month' as const, label: t('thisMonth') },
                  { id: 'Custom' as const, label: t('pickDateRange') },
                ]).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${
                      dateFilter === f.id ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown/60 hover:text-bakery-brown hover:bg-white/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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

          {dateFilter === 'Custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-bakery-beige/20 rounded-xl animate-fade-in max-w-xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('from')}</span>
                <input
                  type="date"
                  className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white"
                  value={dateRange.from}
                  onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-bakery-brown/40">{t('to')}</span>
                <input
                  type="date"
                  className="w-full p-2.5 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm bg-white"
                  value={dateRange.to}
                  onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
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
                <SortableTh label={t('dateTime')} column="dateTime" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('itemsSummary')} column="items" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('total')} column="total" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('payment')} column="payment" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('cashier')} column="cashier" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
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
                    <td className="p-4 font-black whitespace-nowrap">
                      <span className={sale.status && sale.status !== 'completed' ? 'line-through opacity-50' : ''}>
                        {formatPrice(salePayable(sale))}
                      </span>
                      {sale.status === 'refunded' && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-rose-600">{t('refunded')}</span>
                      )}
                      {sale.status === 'voided' && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-bakery-brown/50">{t('voidOrder')}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                        sale.paymentMethod === 'Cash'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sale.paymentMethod === 'Split'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {paymentMethodLabel(sale.paymentMethod, t)}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-bold leading-tight whitespace-nowrap">{sale.cashierFullName}</p>
                      <p className="text-[10px] text-bakery-brown/50">@{sale.cashierUsername}</p>
                    </td>
                    <td className="p-4 text-bakery-brown/40">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); printReceipt(sale); }}
                          className="p-2 hover:bg-bakery-beige rounded-lg transition-all"
                          title={t('downloadReceipt')}
                        >
                          <Printer size={16} />
                        </button>
                        {isCountableSale(sale) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRefundConfirm(sale); }}
                            className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                            title={t('refundSale')}
                          >
                            <Undo2 size={16} />
                          </button>
                        )}
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
                              {item.note && (
                                <p className="text-[10px] italic text-bakery-brown/50 ml-10">{item.note}</p>
                              )}
                            </div>
                          ))}
                          {sale.voidReason && (
                            <p className="text-xs text-rose-700 font-bold pt-2">
                              {t('voidReason')}: {sale.voidReason}
                            </p>
                          )}
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

      <DataTablePagination
        page={salesPaging.page}
        pageSize={salesPaging.pageSize}
        totalItems={filteredSales.length}
        onPageChange={salesPaging.setPage}
        onPageSizeChange={salesPaging.setPageSize}
      />

      {editSale && (
        <Modal title={t('editSaleRecord')} onClose={() => setEditSale(null)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">{t('payment')}</label>
              <select 
                className="w-full p-3 border rounded-xl"
                value={editSale.paymentMethod}
                onChange={e => setEditSale({ ...editSale, paymentMethod: e.target.value as Sale['paymentMethod'] })}
              >
                <option value="Cash">{t('cash')}</option>
                <option value="Card">{t('cardRecorded')}</option>
                <option value="Split">{t('splitTender')}</option>
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

      {refundConfirm && (
        <ConfirmDialog
          isOpen={!!refundConfirm}
          title={t('refundSale')}
          message={t('refundSale')}
          onConfirm={handleRefundSale}
          onClose={() => setRefundConfirm(null)}
        />
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
