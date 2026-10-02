import { jsPDF } from 'jspdf';
import { BusinessSettings, Order, Sale, SaleItem } from '../types';
import { salePayable } from './ticketMoney';

const money = (sym: string, n: number) => `${sym}${(n || 0).toFixed(2)}`;

type TicketOpts = {
  currencySymbol?: string;
  business?: BusinessSettings | null;
  labels?: Record<string, string>;
  itemName?: (item: SaleItem) => string;
  extraName?: (productId: number, fallback: string) => string;
};

const L = (opts: TicketOpts, key: string, fallback: string) => opts.labels?.[key] || fallback;

/** Compact receipt/kitchen ticket header (80mm thermal-style, mm units). */
const writeTicketHeader = (doc: jsPDF, title: string, business?: BusinessSettings | null) => {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(93, 64, 55);
  doc.rect(0, 0, w, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(business?.name || 'PreVisio', w / 2, 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(title, w / 2, 14, { align: 'center' });

  doc.setTextColor(90, 90, 90);
  const loc = [business?.address, business?.city].filter(Boolean).join(', ');
  let y = 24;
  if (loc) {
    doc.setFontSize(7);
    doc.text(loc, w / 2, y, { align: 'center' });
    y += 5;
  }
  doc.setDrawColor(212, 163, 115);
  doc.setLineWidth(0.4);
  doc.line(8, y, w - 8, y);
  return y + 5;
};

const writeItems = (
  doc: jsPDF,
  items: SaleItem[],
  opts: TicketOpts,
  startY: number,
  withPrices: boolean
) => {
  const sym = opts.currencySymbol || '';
  const w = doc.internal.pageSize.getWidth();
  let y = startY;
  items.forEach(item => {
    const name = opts.itemName?.(item) || item.nameEN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`${item.qty}× ${name}`, 8, y);
    if (withPrices) doc.text(money(sym, item.lineTotal), w - 8, y, { align: 'right' });
    y += 5;
    item.extras?.forEach(extra => {
      const extraLabel = opts.extraName?.(extra.productId, extra.nameEN) || extra.nameEN;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 80, 70);
      doc.text(`+ ${extraLabel}`, 11, y);
      if (withPrices) doc.text(money(sym, extra.price * item.qty), w - 8, y, { align: 'right' });
      y += 4;
    });
    if (item.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      doc.text(item.note, 11, y);
      y += 4;
    }
    y += 1;
  });
  return y;
};

export const downloadCustomerReceipt = (
  sale: Sale,
  opts: TicketOpts & { orderId?: string }
) => {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const w = doc.internal.pageSize.getWidth();
  const title = L(opts, 'receipt', 'Receipt');
  let y = writeTicketHeader(doc, title, opts.business);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(new Date(sale.timestamp).toLocaleString(), 8, y);
  if (opts.orderId) {
    doc.text(`#${opts.orderId.slice(-6)}`, w - 8, y, { align: 'right' });
  }
  y += 6;

  y = writeItems(doc, sale.items, opts, y, true);
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(8, y, w - 8, y);
  y += 5;

  const sym = opts.currencySymbol || '';
  const discount = sale.discountAmount || 0;
  const tip = sale.tipAmount || 0;
  const payable = salePayable(sale);
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8);
    doc.setTextColor(30, 30, 30);
    doc.text(label, 8, y);
    doc.text(value, w - 8, y, { align: 'right' });
    y += bold ? 6 : 5;
  };
  row(L(opts, 'subtotal', 'Subtotal'), money(sym, sale.subtotal));
  if (discount > 0) row(L(opts, 'discount', 'Discount'), `−${money(sym, discount)}`);
  if (tip > 0) row(L(opts, 'tip', 'Tip'), money(sym, tip));
  doc.setDrawColor(212, 163, 115);
  doc.line(8, y - 1, w - 8, y - 1);
  y += 4;
  row(L(opts, 'total', 'Total'), money(sym, payable), true);
  row(
    L(opts, 'payment', 'Payment'),
    sale.paymentMethod === 'Card'
      ? L(opts, 'cardRecorded', 'Card recorded')
      : sale.paymentMethod === 'Split'
        ? L(opts, 'splitTender', 'Split tender')
        : L(opts, 'cash', 'Cash')
  );
  if (sale.paymentMethod === 'Split') {
    row(L(opts, 'cashPortion', 'Cash'), money(sym, sale.cashAmount || 0));
    row(L(opts, 'cardPortion', 'Card recorded'), money(sym, sale.cardAmount || 0));
  }
  if ((sale.paymentMethod === 'Cash' || sale.paymentMethod === 'Split') && sale.tenderedCash != null) {
    row(L(opts, 'cashReceived', 'Tendered'), money(sym, sale.tenderedCash));
    row(L(opts, 'change', 'Change'), money(sym, sale.changeGiven || 0));
  }
  if (sale.status === 'refunded') {
    y += 3;
    doc.setTextColor(180, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(L(opts, 'refunded', 'REFUNDED'), w / 2, y, { align: 'center' });
  }
  y += 8;
  doc.setTextColor(130, 130, 130);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(L(opts, 'thankYou', 'Thank you'), w / 2, y, { align: 'center' });
  doc.save(`receipt_${sale.id}.pdf`);
};

export const downloadKitchenTicket = (order: Order, opts: TicketOpts) => {
  const doc = new jsPDF({ unit: 'mm', format: [80, 180] });
  const w = doc.internal.pageSize.getWidth();
  const title = L(opts, 'kitchenTicket', 'Kitchen');
  let y = writeTicketHeader(doc, title, opts.business);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(`#${order.id.slice(-6)}`, 8, y);
  doc.setFontSize(9);
  doc.text(
    order.type === 'PreOrder' ? L(opts, 'preOrder', 'Pre-order') : L(opts, 'walkIn', 'Walk-in'),
    w - 8,
    y,
    { align: 'right' }
  );
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(new Date(order.createdAt).toLocaleTimeString(), 8, y);
  y += 5;
  if (order.scheduledFor) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(93, 64, 55);
    doc.text(`${L(opts, 'pickupTime', 'Pickup')} ${order.scheduledFor.replace('T', ' ')}`, 8, y);
    y += 5;
  }
  if (order.customerName) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(order.customerName, 8, y);
    y += 5;
  }
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(8, y, w - 8, y);
  y += 5;
  writeItems(doc, order.items, opts, y, false);
  doc.save(`kitchen_${order.id}.pdf`);
};

export const downloadZReport = (opts: {
  business?: BusinessSettings | null;
  currencySymbol?: string;
  openedAt: number;
  closedAt: number;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  cardRecorded: number;
  cashSales: number;
  refunds: number;
  voids: number;
  orderCount: number;
  labels?: Record<string, string>;
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const lab = (k: string, f: string) => opts.labels?.[k] || f;
  const sym = opts.currencySymbol || '';
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;

  doc.setFillColor(93, 64, 55);
  doc.rect(0, 0, pageWidth, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(opts.business?.name || 'PreVisio', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(lab('zReport', 'Z-report / till close'), margin, 54);

  let y = 100;
  const row = (label: string, value: string, emphasize = false) => {
    doc.setFont('helvetica', emphasize ? 'bold' : 'normal');
    doc.setFontSize(11);
    doc.setTextColor(emphasize ? 93 : 40, emphasize ? 64 : 40, emphasize ? 55 : 40);
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 20;
  };

  row(lab('openedAt', 'Opened'), new Date(opts.openedAt).toLocaleString());
  row(lab('closedAt', 'Closed'), new Date(opts.closedAt).toLocaleString());
  row(lab('orders', 'Orders'), String(opts.orderCount));
  y += 6;
  doc.setDrawColor(212, 163, 115);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;
  row(lab('openingFloat', 'Opening float'), money(sym, opts.openingFloat));
  row(lab('cashSales', 'Cash sales'), money(sym, opts.cashSales));
  row(lab('refunds', 'Refunds'), money(sym, opts.refunds));
  row(lab('expectedCash', 'Expected cash'), money(sym, opts.expectedCash), true);
  row(lab('countedCash', 'Counted cash'), money(sym, opts.countedCash), true);
  row(lab('overShort', 'Over / short'), money(sym, opts.countedCash - opts.expectedCash), true);
  y += 6;
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;
  row(lab('cardRecorded', 'Card recorded'), money(sym, opts.cardRecorded));
  row(lab('voids', 'Voids'), String(opts.voids));
  doc.save(`z_report_${new Date(opts.closedAt).toISOString().slice(0, 10)}.pdf`);
};
