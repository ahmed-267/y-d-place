import {
  json,
  parseBody,
  createAnonClient,
  createServiceClient,
  rateLimit,
} from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const readClient = createAnonClient();
  const writeClient = createServiceClient();
  if (!readClient || !writeClient) {
    return json(503, {
      error: 'Public orders require Supabase URL, anon key, and SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const ip =
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown';
  if (!rateLimit(`order:${ip}`, 20, 60_000)) {
    return json(429, { error: 'Too many orders. Try again shortly.' });
  }

  try {
    const body = parseBody(event);
    const businessId = (body.businessId || '').trim();
    if (!businessId || !body.customerName?.trim() || !body.customerPhone?.trim() || !body.scheduledFor) {
      return json(400, { error: 'Missing order fields' });
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return json(400, { error: 'Invalid items' });
    }

    const { data: business, error: bizErr } = await readClient
      .from('businesses')
      .select('id, name, currency_symbol, enabled_modules')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business) {
      return json(404, { error: 'Business not found or online ordering unavailable' });
    }

    const modules = business.enabled_modules || {};
    if (modules.onlineOrders !== true) {
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
      const qty = Math.min(99, Math.max(1, Math.floor(Number(item.qty) || 0)));
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
      const lineTotal = qty * (unitPrice + extras.reduce((a, e) => a + e.price, 0));
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
    const orderId = `ON-${orderNow}`;
    const { error: insertErr } = await writeClient.from('orders').insert({
      id: orderId,
      business_id: businessId,
      type: 'PreOrder',
      status: 'Preparing',
      created_at: new Date(orderNow).toISOString(),
      last_updated_at: new Date(orderNow).toISOString(),
      scheduled_for: body.scheduledFor,
      customer_name: body.customerName.trim().slice(0, 120),
      customer_phone: body.customerPhone.trim().slice(0, 40),
      items: lines,
      subtotal,
      payment_method: 'Card',
      created_by_username: 'online',
      created_by_full_name: 'Online guest',
      source: 'online',
    });

    if (insertErr) return json(400, { error: insertErr.message });

    return json(200, {
      orderId,
      subtotal,
      currencySymbol: business.currency_symbol || '€',
    });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Order failed' });
  }
};
