import { Product, Sale } from '../types';
import { downloadCsv, rowsToCsv } from './csvExport';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export type PeriodReport = {
  period: ReportPeriod;
  label: string;
  from: Date | null;
  to: Date;
  orderCount: number;
  itemsSold: number;
  totalSales: number;
  averageOrderValue: number;
  cashTotal: number;
  cardTotal: number;
  categories: { name: string; units: number; revenue: number }[];
  products: { name: string; units: number; revenue: number }[];
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const getPeriodBounds = (period: ReportPeriod, now = new Date()): { from: Date | null; to: Date; label: string } => {
  const to = new Date(now);
  if (period === 'total') {
    return { from: null, to, label: 'Total' };
  }
  const from = startOfDay(now);
  if (period === 'daily') {
    return { from, to, label: `Daily ${from.toISOString().slice(0, 10)}` };
  }
  if (period === 'weekly') {
    const day = from.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + mondayOffset);
    return { from, to, label: `Weekly from ${from.toISOString().slice(0, 10)}` };
  }
  // monthly
  from.setDate(1);
  return { from, to, label: `Monthly ${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}` };
};

export const filterSalesForPeriod = (sales: Sale[], period: ReportPeriod, now = new Date()): Sale[] => {
  const { from, to } = getPeriodBounds(period, now);
  const toTs = to.getTime();
  const fromTs = from ? from.getTime() : 0;
  return sales.filter(s => s.timestamp >= fromTs && s.timestamp <= toTs);
};

type ResolveName = (productId: number, fallback: string) => string;
type ResolveCategory = (productId: number, fallbackCategory?: string) => string;

export const buildPeriodReport = (
  sales: Sale[],
  period: ReportPeriod,
  opts: {
    resolveName: ResolveName;
    resolveCategory: ResolveCategory;
    now?: Date;
  }
): PeriodReport => {
  const now = opts.now || new Date();
  const bounds = getPeriodBounds(period, now);
  const list = filterSalesForPeriod(sales, period, now);

  let itemsSold = 0;
  let totalSales = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  const catMap = new Map<string, { units: number; revenue: number }>();
  const prodMap = new Map<string, { name: string; units: number; revenue: number }>();

  for (const sale of list) {
    totalSales += sale.subtotal || 0;
    if (sale.paymentMethod === 'Cash') cashTotal += sale.subtotal || 0;
    else cardTotal += sale.subtotal || 0;

    for (const item of sale.items || []) {
      const qty = item.qty || 0;
      const revenue = item.lineTotal ?? 0;
      itemsSold += qty;

      const name = opts.resolveName(item.productId, item.nameEN || 'Item');
      const prev = prodMap.get(String(item.productId)) || { name, units: 0, revenue: 0 };
      prev.units += qty;
      prev.revenue += revenue;
      prev.name = name;
      prodMap.set(String(item.productId), prev);

      const cat = opts.resolveCategory(item.productId, (item as { category?: string }).category);
      const cPrev = catMap.get(cat) || { units: 0, revenue: 0 };
      cPrev.units += qty;
      cPrev.revenue += revenue;
      catMap.set(cat, cPrev);
    }
  }

  const orderCount = list.length;
  return {
    period,
    label: bounds.label,
    from: bounds.from,
    to: bounds.to,
    orderCount,
    itemsSold,
    totalSales,
    averageOrderValue: orderCount ? totalSales / orderCount : 0,
    cashTotal,
    cardTotal,
    categories: [...catMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    products: [...prodMap.values()].sort((a, b) => b.units - a.units),
  };
};

export const downloadPeriodReportCsv = (
  report: PeriodReport,
  opts: { currencySymbol?: string; businessName?: string }
) => {
  const sym = opts.currencySymbol || '';
  const money = (n: number) => `${sym}${n.toFixed(2)}`;
  const summaryHeaders = ['Metric', 'Value'];
  const summaryRows: (string | number)[][] = [
    ['Business', opts.businessName || ''],
    ['Report', report.label],
    ['From', report.from ? report.from.toISOString().slice(0, 10) : 'All time'],
    ['To', report.to.toISOString().slice(0, 10)],
    ['Total sales', money(report.totalSales)],
    ['Orders', report.orderCount],
    ['Items sold', report.itemsSold],
    ['Average order value', money(report.averageOrderValue)],
    ['Cash total', money(report.cashTotal)],
    ['Card total', money(report.cardTotal)],
  ];

  const catHeaders = ['Category', 'Units sold', 'Revenue'];
  const catRows = report.categories.map(c => [c.name, c.units, money(c.revenue)]);
  const catTotalUnits = report.categories.reduce((a, c) => a + c.units, 0);
  const catTotalRev = report.categories.reduce((a, c) => a + c.revenue, 0);
  catRows.push(['TOTAL', catTotalUnits, money(catTotalRev)]);

  const prodHeaders = ['Product', 'Units sold', 'Revenue'];
  const prodRows = report.products.map(p => [p.name, p.units, money(p.revenue)]);

  const content = [
    rowsToCsv(summaryHeaders, summaryRows),
    '',
    'Category breakdown',
    rowsToCsv(catHeaders, catRows),
    '',
    'Product breakdown',
    rowsToCsv(prodHeaders, prodRows),
  ].join('\n');

  const slug = report.period;
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`previsio_${slug}_report_${date}.csv`, content);
};

/** Convenience for wiring from UI */
export const exportPeriodReport = (
  sales: Sale[],
  products: Product[],
  period: ReportPeriod,
  opts: {
    tp: (p: Product) => string;
    tc: (category: string) => string;
    currencySymbol?: string;
    businessName?: string;
  }
) => {
  const byId = new Map(products.map(p => [p.id, p]));
  const report = buildPeriodReport(sales, period, {
    resolveName: (id, fallback) => {
      const p = byId.get(id);
      return p ? opts.tp(p) : fallback;
    },
    resolveCategory: (id, fallback) => {
      const p = byId.get(id);
      const cat = p?.category || fallback || 'Other';
      return opts.tc(cat);
    },
  });
  downloadPeriodReportCsv(report, {
    currencySymbol: opts.currencySymbol,
    businessName: opts.businessName,
  });
  return report;
};
