import { Customer, Order, Sale } from '../types';

const digits = (phone: string) => phone.replace(/\D/g, '');

export const normalizePhoneKey = (phone: string) => {
  const d = digits(phone);
  return d.length >= 7 ? d : '';
};

export const findCustomerByPhone = (customers: Customer[], phone: string) => {
  const key = normalizePhoneKey(phone);
  if (!key) return undefined;
  return customers.find(c => normalizePhoneKey(c.phone) === key);
};

export const upsertCustomerFromOrder = (
  customers: Customer[],
  opts: { name?: string; phone?: string; at?: number }
): { customers: Customer[]; customer?: Customer } => {
  const phone = (opts.phone || '').trim();
  const name = (opts.name || '').trim();
  const key = normalizePhoneKey(phone);
  if (!key) return { customers };

  const at = opts.at || Date.now();
  const existing = customers.find(c => normalizePhoneKey(c.phone) === key);
  if (existing) {
    const next: Customer = {
      ...existing,
      name: name || existing.name,
      phone: phone || existing.phone,
      lastOrderAt: at,
      orderCount: (existing.orderCount || 0) + 1,
    };
    return {
      customers: customers.map(c => (c.id === existing.id ? next : c)),
      customer: next,
    };
  }

  const created: Customer = {
    id: `C-${Date.now()}`,
    name: name || phone,
    phone,
    createdAt: at,
    lastOrderAt: at,
    orderCount: 1,
  };
  return { customers: [created, ...customers], customer: created };
};

export const customerOrderHistory = (
  customer: Customer,
  orders: Order[],
  sales: Sale[]
) => {
  const key = normalizePhoneKey(customer.phone);
  const fromOrders = orders.filter(
    o => o.customerId === customer.id || normalizePhoneKey(o.customerPhone || '') === key
  );
  const fromSales = sales.filter(
    s => s.customerId === customer.id || normalizePhoneKey(s.customerPhone || '') === key
  );
  return { orders: fromOrders, sales: fromSales };
};
