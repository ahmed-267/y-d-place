import { createHash } from 'node:crypto';
import { enforceLimit, validateOrder, activeSubscription } from './_security.mjs';
import {
  json,
  parseBody,
  createServiceClient,
} from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const readClient = createServiceClient();
  const writeClient = createServiceClient();
  if (!readClient || !writeClient) {
    return json(503, {
      error: 'Online ordering is temporarily unavailable. Please contact the business.',
      code: 'ORDERING_SERVER_NOT_CONFIGURED',
    });
  }

  try {
    const body = parseBody(event);
    validateOrder(body);
    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
    await enforceLimit(writeClient, `public-order:${ip}`, 20, 60);
    const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const orderId = `ON-${body.businessId}-${body.requestId}`;
    const { data: existing, error: lookupError } = await writeClient.from('orders')
      .select('id, subtotal, request_hash').eq('id', orderId).maybeSingle();
    if (lookupError) return json(503, { error: 'Ordering temporarily unavailable' });
    if (existing) {
      if (existing.request_hash !== fingerprint) return json(409, { error: 'This request identifier was already used for a different order' });
      return json(200, { orderId, subtotal: Number(existing.subtotal) });
    }
    const businessId = (body.businessId || '').trim();
    if (!businessId || !body.customerName?.trim() || !body.customerPhone?.trim() || !body.scheduledFor) {
      return json(400, { error: 'Missing order fields' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return json(400, { error: 'Invalid items' });
    }

    const { data: business, error: bizErr } = await readClient
      .from('businesses')
      .select('id, name, currency_symbol, enabled_modules, plan, trial_ends_at')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business) {
      return json(404, { error: 'Business not found or online ordering unavailable' });
    }

    const modules = business.enabled_modules || {};
    if (modules.onlineOrders !== true || !activeSubscription(business)) {
      return json(403, { error: 'Online ordering is turned off' });
    }

    const productIds = [
      ...new Set(body.items.flatMap((i) => [i.productId, ...(i.extraIds || [])])),
    ];
    const { data: products, error: prodErr } = await readClient
      .from('products')
      .select('id, name_en, price, active, extra_ids')
      .eq('business_id', businessId)
      .in('id', productIds);

    if (prodErr || !products?.length) {
      return json(400, { error: 'Menu items unavailable' });
    }

    const byId = new Map(products.map((p) => [Number(p.id), p]));
    const lines = [];
    let subtotal = 0;

    for (const item of body.items) {
      const qty = item.qty;
      const product = byId.get(Number(item.productId));
      if (!product || product.active === false) {
        return json(400, { error: `Unknown product ${item.productId}` });
      }
      const allowedExtras = new Set(
        Array.isArray(product.extra_ids) ? product.extra_ids.map(Number) : []
      );
      const extras = [];
      for (const eid of item.extraIds || []) {
        if (!allowedExtras.has(Number(eid))) {
          return json(400, { error: `Invalid extra ${eid}` });
        }
        const extra = byId.get(Number(eid));
        if (!extra || extra.active === false) {
          return json(400, { error: `Unknown extra ${eid}` });
        }
        extras.push({
          productId: Number(extra.id),
          nameEN: String(extra.name_en),
          price: Number(extra.price),
        });
      }
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || extras.some(e => !Number.isFinite(e.price) || e.price < 0)) return json(400, { error: 'Invalid menu price' });
      const lineTotal = Math.round(qty * (unitPrice + extras.reduce((a, e) => a + e.price, 0)) * 100) / 100;
      subtotal += lineTotal;
      lines.push({
        productId: Number(product.id),
        nameEN: String(product.name_en),
        qty,
        unitPrice,
        lineTotal,
        extras,
        note: (item.note || '').trim().slice(0, 200) || undefined,
      });
    }

    const orderNow = Date.now();
    subtotal = Math.round(subtotal * 100) / 100;
    const { error: insertErr } = await writeClient.from('orders').insert({
      id: orderId,
      request_hash: fingerprint,
      business_id: businessId,
      type: 'PreOrder',
      status: 'Preparing',
      created_at: new Date(orderNow).toISOString(),
      updated_at: new Date(orderNow).toISOString(),
      scheduled_for: body.scheduledFor,
      customer_name: body.customerName.trim().slice(0, 120),
      customer_phone: body.customerPhone.trim().slice(0, 40),
      items: lines,
      subtotal,
      payment_method: 'Card',
      created_by_username: 'online',
      created_by_fullname: 'Online guest',
      source: 'online',
    });

    if (insertErr?.code === '23505') {
      const { data: retry } = await writeClient.from('orders').select('subtotal, request_hash').eq('id', orderId).single();
      if (retry?.request_hash === fingerprint) return json(200, { orderId, subtotal: Number(retry.subtotal) });
      return json(409, { error: 'Request already used' });
    }
    if (insertErr) return json(503, { error: 'Order could not be saved. Retry this submission.' });

    return json(200, {
      orderId,
      subtotal,
      currencySymbol: business.currency_symbol || '€',
    });
  } catch (err) {
    return json(err.status || (err instanceof SyntaxError ? 400 : 500), { error: err.status ? err.message : 'Order could not be processed' });
  }
};
