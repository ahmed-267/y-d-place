import { jsPDF } from 'jspdf';
import { Product, Sale } from '../types';
import { buildPeriodReport, PeriodReport, ReportPeriod } from './periodReports';

export type { ReportPeriod };

const money = (sym: string, n: number) => `${sym}${n.toFixed(2)}`;

export const downloadPeriodReportPdf = (
  report: PeriodReport,
  opts: { currencySymbol?: string; businessName?: string; labels?: Record<string, string> }
) => {
  const sym = opts.currencySymbol || '';
  const L = {
    title: opts.labels?.title || 'Sales report',
    business: opts.labels?.business || 'Business',
    report: opts.labels?.report || 'Report',
    from: opts.labels?.from || 'From',
    to: opts.labels?.to || 'To',
    allTime: opts.labels?.allTime || 'All time',
    totalSales: opts.labels?.totalSales || 'Total sales',
    orders: opts.labels?.orders || 'Orders',
    itemsSold: opts.labels?.itemsSold || 'Items sold',
    aov: opts.labels?.aov || 'Average order value',
    cash: opts.labels?.cash || 'Cash total',
    card: opts.labels?.card || 'Card total',
    categories: opts.labels?.categories || 'Category breakdown',
    products: opts.labels?.products || 'Product breakdown',
    category: opts.labels?.category || 'Category',
    product: opts.labels?.product || 'Product',
    units: opts.labels?.units || 'Units',
    revenue: opts.labels?.revenue || 'Revenue',
    total: opts.labels?.total || 'Total',
  };

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  const ensureSpace = (need = 24) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const line = (label: string, value: string, bold = false) => {
    ensureSpace();
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(11);
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 18;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(93, 64, 55);
  doc.text(L.title, margin, y);
  y += 28;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  line(L.business, opts.businessName || '—', true);
  line(L.report, report.label);
  line(L.from, report.from ? report.from.toISOString().slice(0, 10) : L.allTime);
  line(L.to, report.to.toISOString().slice(0, 10));
  y += 8;

  doc.setDrawColor(212, 163, 115);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  line(L.totalSales, money(sym, report.totalSales), true);
  line(L.orders, String(report.orderCount));
  line(L.itemsSold, String(report.itemsSold));
  line(L.aov, money(sym, report.averageOrderValue));
  line(L.cash, money(sym, report.cashTotal));
  line(L.card, money(sym, report.cardTotal));
  y += 12;

  const tableHeader = (c1: string, c2: string, c3: string) => {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(250, 237, 205);
    doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F');
    doc.text(c1, margin + 6, y);
    doc.text(c2, pageWidth - margin - 140, y);
    doc.text(c3, pageWidth - margin, y, { align: 'right' });
    y += 20;
  };

  const tableRow = (c1: string, c2: string, c3: string, strong = false) => {
    ensureSpace(18);
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setFontSize(10);
    const name = doc.splitTextToSize(c1, pageWidth - margin * 2 - 160);
    doc.text(name, margin + 6, y);
    doc.text(c2, pageWidth - margin - 140, y);
    doc.text(c3, pageWidth - margin, y, { align: 'right' });
    y += Math.max(16, name.length * 12);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(93, 64, 55);
  ensureSpace(24);
  doc.text(L.categories, margin, y);
  y += 16;
  doc.setTextColor(60, 60, 60);
  tableHeader(L.category, L.units, L.revenue);
  report.categories.forEach(c => tableRow(c.name, String(c.units), money(sym, c.revenue)));
  const catUnits = report.categories.reduce((a, c) => a + c.units, 0);
  const catRev = report.categories.reduce((a, c) => a + c.revenue, 0);
  tableRow(L.total, String(catUnits), money(sym, catRev), true);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(93, 64, 55);
  ensureSpace(24);
  doc.text(L.products, margin, y);
  y += 16;
  doc.setTextColor(60, 60, 60);
  tableHeader(L.product, L.units, L.revenue);
  report.products.slice(0, 40).forEach(p => tableRow(p.name, String(p.units), money(sym, p.revenue)));

  const slug = report.period;
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`previsio_${slug}_report_${date}.pdf`);
};

export const exportPeriodReportPdf = (
  sales: Sale[],
  products: Product[],
  period: ReportPeriod,
  opts: {
    tp: (p: Product) => string;
    tc: (category: string) => string;
    currencySymbol?: string;
    businessName?: string;
    labels?: Record<string, string>;
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
  downloadPeriodReportPdf(report, {
    currencySymbol: opts.currencySymbol,
    businessName: opts.businessName,
    labels: opts.labels,
  });
  return report;
};
