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
    categories: opts.labels?.categories || 'By category',
    category: opts.labels?.category || 'Category',
    units: opts.labels?.units || 'Qty',
    revenue: opts.labels?.revenue || 'Revenue',
    total: opts.labels?.total || 'Total',
  };

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (need = 24) => {
    if (y + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header band
  doc.setFillColor(93, 64, 55);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(opts.businessName || 'PreVisio', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(L.title, margin, 54);
  y = 96;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  const meta = [
    `${L.report}: ${report.label}`,
    `${L.from}: ${report.from ? report.from.toISOString().slice(0, 10) : L.allTime}`,
    `${L.to}: ${report.to.toISOString().slice(0, 10)}`,
  ].join('   ·   ');
  doc.text(meta, margin, y);
  y += 18;

  doc.setDrawColor(212, 163, 115);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  // Summary cards row
  const kpis = [
    { label: L.totalSales, value: money(sym, report.totalSales) },
    { label: L.orders, value: String(report.orderCount) },
    { label: L.itemsSold, value: String(report.itemsSold) },
    { label: L.aov, value: money(sym, report.averageOrderValue) },
  ];
  const cardW = (contentW - 18) / 4;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardW + 6);
    doc.setFillColor(250, 245, 238);
    doc.roundedRect(x, y, cardW, 48, 6, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 90);
    doc.text(kpi.label.toUpperCase(), x + 10, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(50, 40, 35);
    doc.text(kpi.value, x + 10, y + 36);
  });
  y += 64;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`${L.cash}: ${money(sym, report.cashTotal)}`, margin, y);
  doc.text(`${L.card}: ${money(sym, report.cardTotal)}`, pageWidth - margin, y, { align: 'right' });
  y += 14;
  doc.text(`Tips: ${money(sym, report.tipTotal)}`, margin, y);
  y += 28;

  // Category table — qty per category (keep short)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(93, 64, 55);
  ensureSpace(40);
  doc.text(L.categories, margin, y);
  y += 14;

  const colCat = margin + 8;
  const colQty = pageWidth - margin - 100;
  const colRev = pageWidth - margin - 8;

  const headerY = y;
  doc.setFillColor(93, 64, 55);
  doc.roundedRect(margin, headerY - 2, contentW, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(L.category, colCat, headerY + 12);
  doc.text(L.units, colQty, headerY + 12, { align: 'right' });
  doc.text(L.revenue, colRev, headerY + 12, { align: 'right' });
  y = headerY + 28;
  doc.setTextColor(50, 40, 35);

  report.categories.forEach((c, idx) => {
    ensureSpace(18);
    if (idx % 2 === 0) {
      doc.setFillColor(250, 245, 238);
      doc.rect(margin, y - 11, contentW, 18, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const name = doc.splitTextToSize(c.name, contentW - 160);
    doc.text(name, colCat, y);
    doc.text(String(c.units), colQty, y, { align: 'right' });
    doc.text(money(sym, c.revenue), colRev, y, { align: 'right' });
    y += Math.max(18, name.length * 12);
  });

  const catUnits = report.categories.reduce((a, c) => a + c.units, 0);
  const catRev = report.categories.reduce((a, c) => a + c.revenue, 0);
  ensureSpace(22);
  doc.setDrawColor(212, 163, 115);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(L.total, colCat, y + 10);
  doc.text(String(catUnits), colQty, y + 10, { align: 'right' });
  doc.text(money(sym, catRev), colRev, y + 10, { align: 'right' });

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
