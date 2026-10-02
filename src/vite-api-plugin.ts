/**
 * Vite middleware: server-only API routes (AI, staff invite, public orders).
 * Keys stay off the client. Production uses netlify/functions/* equivalents.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const getAnon = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
};

const getService = () => {
  const base = getAnon();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !service) return null;
  return { ...base, service };
};

const handleAi = async (req: IncomingMessage, res: ServerResponse) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: 'OPENROUTER_API_KEY not configured on server' });
    return;
  }

  const raw = await readBody(req);
  const body = JSON.parse(raw) as {
    prompt: string;
    schema?: Record<string, unknown>;
    imageBase64?: string;
    mode?: 'json' | 'text';
    model?: string;
  };

  const model = body.model || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: body.prompt }];
  if (body.imageBase64) {
    content.push({ type: 'image_url', image_url: { url: body.imageBase64 } });
  }

  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content }],
  };

  if (body.mode !== 'text' && body.schema) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'structured_response',
        strict: true,
        schema: body.schema,
      },
    };
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.VITE_OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.VITE_OPENROUTER_APP_NAME || 'PreVisio',
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    sendJson(res, upstream.status, { error: text });
    return;
  }

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  sendJson(res, 200, { content: data.choices?.[0]?.message?.content ?? null });
};

const handleInviteStaff = async (req: IncomingMessage, res: ServerResponse) => {
  const svc = getService();
  const anon = getAnon();
  if (!svc || !anon) {
    sendJson(res, 503, {
      error:
        'Server invite requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY',
    });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    sendJson(res, 401, { error: 'Missing authorization' });
    return;
  }

  const userClient = createClient(anon.url, anon.anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !authData.user) {
    sendJson(res, 401, { error: 'Invalid session' });
    return;
  }

  const admin = createClient(svc.url, svc.service);
  const { data: caller } = await admin
    .from('app_users')
    .select('business_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || caller.role !== 'owner' || !caller.business_id) {
    sendJson(res, 403, { error: 'Only the business owner can invite staff' });
    return;
  }

  const raw = await readBody(req);
  const body = JSON.parse(raw) as {
    fullName: string;
    username: string;
    email: string;
    password: string;
    role: 'staff' | 'manager';
  };

  const email = (body.email || '').trim().toLowerCase();
  const username = (body.username || '').trim();
  const password = body.password || '';
  const role = body.role === 'manager' ? 'manager' : 'staff';

  if (!email || !username || password.length < 8) {
    sendJson(res, 400, { error: 'Email, username, and a strong password (8+) are required' });
    return;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: body.fullName, username },
  });

  if (createErr || !created.user) {
    sendJson(res, 400, { error: createErr?.message || 'Could not create auth user' });
    return;
  }

  const { error: profileErr } = await admin.from('app_users').upsert({
    id: created.user.id,
    business_id: caller.business_id,
    username,
    full_name: body.fullName || username,
    role,
    email,
    hourly_rate: role === 'manager' ? 18 : 14,
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    sendJson(res, 400, { error: profileErr.message });
    return;
  }

  sendJson(res, 200, {
    user: {
      id: created.user.id,
      username,
      fullName: body.fullName || username,
      email,
      role,
    },
  });
};

const rateBucket = new Map<string, { count: number; reset: number }>();

const handlePublicOrder = async (req: IncomingMessage, res: ServerResponse) => {
  const svc = getService();
  const anon = getAnon();
  if (!svc || !anon) {
    sendJson(res, 503, {
      error: 'Public orders require Supabase URL, anon key, and SUPABASE_SERVICE_ROLE_KEY',
    });
    return;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const bucket = rateBucket.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  rateBucket.set(ip, bucket);
  if (bucket.count > 20) {
    sendJson(res, 429, { error: 'Too many orders. Try again shortly.' });
    return;
  }

  // Menu lookup can use anon (public menu RLS). Inserts use service role after price validation.
  const readClient = createClient(anon.url, anon.anon);
  const writeClient = createClient(svc.url, svc.service);
  const raw = await readBody(req);
  const body = JSON.parse(raw) as {
    businessId: string;
    customerName: string;
    customerPhone: string;
    scheduledFor: string;
    items: Array<{ productId: number; qty: number; extraIds?: number[]; note?: string }>;
  };

  const businessId = (body.businessId || '').trim();
  if (!businessId || !body.customerName?.trim() || !body.customerPhone?.trim() || !body.scheduledFor) {
    sendJson(res, 400, { error: 'Missing order fields' });
    return;
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    sendJson(res, 400, { error: 'Invalid items' });
    return;
  }

  const { data: business, error: bizErr } = await readClient
    .from('businesses')
    .select('id, name, currency_symbol, enabled_modules')
    .eq('id', businessId)
    .maybeSingle();

  if (bizErr || !business) {
    sendJson(res, 404, { error: 'Business not found or online ordering unavailable' });
    return;
  }

  const modules = (business.enabled_modules || {}) as Record<string, unknown>;
  if (modules.onlineOrders !== true) {
    sendJson(res, 403, { error: 'Online ordering is turned off' });
    return;
  }

  const productIds = [...new Set(body.items.flatMap(i => [i.productId, ...(i.extraIds || [])]))];
  const { data: products, error: prodErr } = await readClient
    .from('products')
    .select('id, name_en, price, active, extra_ids')
    .eq('business_id', businessId)
    .in('id', productIds);

  if (prodErr || !products?.length) {
    sendJson(res, 400, { error: 'Menu items unavailable' });
    return;
  }

  const byId = new Map(products.map(p => [Number(p.id), p]));
  const lines = [];
  let subtotal = 0;

  for (const item of body.items) {
    const qty = Math.min(99, Math.max(1, Math.floor(Number(item.qty) || 0)));
    const product = byId.get(Number(item.productId));
    if (!product || product.active === false) {
      sendJson(res, 400, { error: `Unknown product ${item.productId}` });
      return;
    }
    const allowedExtras = new Set(
      Array.isArray(product.extra_ids) ? product.extra_ids.map(Number) : []
    );
    const extras = [];
    for (const eid of item.extraIds || []) {
      if (!allowedExtras.has(Number(eid))) {
        sendJson(res, 400, { error: `Invalid extra ${eid}` });
        return;
      }
      const extra = byId.get(Number(eid));
      if (!extra || extra.active === false) {
        sendJson(res, 400, { error: `Unknown extra ${eid}` });
        return;
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
  const orderRow = {
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
  };

  const { error: insertErr } = await writeClient.from('orders').insert(orderRow);
  if (insertErr) {
    sendJson(res, 400, { error: insertErr.message });
    return;
  }

  sendJson(res, 200, {
    orderId,
    subtotal,
    currencySymbol: business.currency_symbol || '€',
  });
};

const handlePublicMenu = async (req: IncomingMessage, res: ServerResponse) => {
  const anon = getAnon();
  if (!anon) {
    sendJson(res, 503, { error: 'Supabase env not configured' });
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const businessId = url.searchParams.get('businessId') || '';
  if (!businessId) {
    sendJson(res, 400, { error: 'businessId required' });
    return;
  }

  const client = createClient(anon.url, anon.anon);
  const { data: business } = await client
    .from('businesses')
    .select('id, name, currency_symbol, currency_code, enabled_modules')
    .eq('id', businessId)
    .maybeSingle();

  if (!business) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const modules = (business.enabled_modules || {}) as Record<string, unknown>;
  if (modules.onlineOrders !== true) {
    sendJson(res, 200, {
      businessId,
      businessName: business.name,
      currencySymbol: business.currency_symbol || '€',
      onlineOrdersEnabled: false,
      products: [],
    });
    return;
  }

  const { data: products } = await client
    .from('products')
    .select('id, name_en, category, price, emoji, active, is_favourite, pos_color, extra_ids')
    .eq('business_id', businessId)
    .eq('active', true);

  sendJson(res, 200, {
    businessId,
    businessName: business.name,
    currencySymbol: business.currency_symbol || '€',
    currencyCode: business.currency_code || 'EUR',
    onlineOrdersEnabled: true,
    products: (products || []).map(p => ({
      id: Number(p.id),
      nameEN: p.name_en,
      category: p.category,
      price: Number(p.price),
      emoji: p.emoji || '🍽️',
      active: p.active !== false,
      isFavourite: p.is_favourite === true,
      posColor: p.pos_color || undefined,
      extraIds: Array.isArray(p.extra_ids) ? p.extra_ids.map(Number) : undefined,
    })),
  });
};

const TRIAL_DAYS = 14;

const getAppUrl = () =>
  (process.env.APP_URL || process.env.VITE_OPENROUTER_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

const planFromStripeStatus = (status?: string | null) => {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'pro';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'none';
  }
};

const requireOwnerFromReq = async (req: IncomingMessage) => {
  const anon = getAnon();
  const svc = getService();
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!anon || !svc || !jwt) return { error: 'Unauthorized', status: 401 as const };

  const userClient = createClient(anon.url, anon.anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !authData.user) return { error: 'Invalid session', status: 401 as const };

  const admin = createClient(svc.url, svc.service);
  const { data: caller } = await admin
    .from('app_users')
    .select('business_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || caller.role !== 'owner' || !caller.business_id) {
    return { error: 'Only the business owner can manage billing', status: 403 as const };
  }

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, owner_email, stripe_customer_id, stripe_subscription_id, plan')
    .eq('id', caller.business_id)
    .maybeSingle();

  if (!business) return { error: 'Business not found', status: 404 as const };
  return { user: authData.user, business, admin };
};

const handleBillingCheckout = async (req: IncomingMessage, res: ServerResponse) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_PRO;
  if (!secret || !priceId) {
    sendJson(res, 503, { error: 'Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_PRO)' });
    return;
  }

  const auth = await requireOwnerFromReq(req);
  if ('error' in auth && auth.error) {
    sendJson(res, auth.status || 401, { error: auth.error });
    return;
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  const { user, business, admin } = auth as {
    user: { id: string; email?: string | null };
    business: {
      id: string;
      name: string;
      owner_email?: string;
      stripe_customer_id?: string;
    };
    admin: any;
  };

  let customerId = business.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || business.owner_email || undefined,
      name: business.name || undefined,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
    await admin.from('businesses').update({ stripe_customer_id: customerId }).eq('id', business.id);
  }

  const appUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: business.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { business_id: business.id, owner_user_id: user.id },
    },
    metadata: { business_id: business.id, owner_user_id: user.id },
    success_url: `${appUrl}/?billing=success`,
    cancel_url: `${appUrl}/?billing=cancel`,
    allow_promotion_codes: true,
  });

  sendJson(res, 200, { url: session.url });
};

const handleBillingPortal = async (req: IncomingMessage, res: ServerResponse) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    sendJson(res, 503, { error: 'Stripe is not configured' });
    return;
  }
  const auth = await requireOwnerFromReq(req);
  if ('error' in auth && auth.error) {
    sendJson(res, auth.status || 401, { error: auth.error });
    return;
  }
  const { user, business, admin } = auth as {
    user: { id: string; email?: string | null };
    business: {
      id: string;
      name: string;
      owner_email?: string;
      stripe_customer_id?: string;
      stripe_subscription_id?: string;
    };
    admin: any;
  };
  if (!business.stripe_customer_id && !business.stripe_subscription_id) {
    sendJson(res, 400, { error: 'No billing customer yet. Start a trial first.' });
    return;
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  let customerId = business.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || business.owner_email || undefined,
      name: business.name || undefined,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
    await admin.from('businesses').update({ stripe_customer_id: customerId }).eq('id', business.id);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/?billing=portal`,
  });
  sendJson(res, 200, { url: session.url });
};

const applySub = async (
  admin: any,
  businessId: string,
  subscription: {
    id: string;
    status: string;
    trial_end?: number | null;
    current_period_end?: number | null;
    customer?: string | { id: string };
  }
) => {
  const plan = planFromStripeStatus(subscription.status);
  await admin
    .from('businesses')
    .update({
      plan,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_ends_at: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    })
    .eq('id', businessId);
};

const handleStripeWebhook = async (req: IncomingMessage, res: ServerResponse) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const svc = getService();
  if (!secret || !webhookSecret || !svc) {
    sendJson(res, 503, { error: 'Stripe webhook not configured' });
    return;
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret);
  const raw = await readBody(req);
  const signature = String(req.headers['stripe-signature'] || '');
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid signature' });
    return;
  }

  const admin = createClient(svc.url, svc.service);
  const resolveBiz = async (subscription: { metadata?: { business_id?: string }; customer?: string | { id: string } }) => {
    if (subscription.metadata?.business_id) return subscription.metadata.business_id;
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    if (!customerId) return null;
    const { data } = await admin
      .from('businesses')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    return data?.id || null;
  };

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        client_reference_id?: string;
        metadata?: { business_id?: string };
        subscription?: string | { id: string };
      };
      const businessId = session.client_reference_id || session.metadata?.business_id;
      if (businessId && session.subscription) {
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        await applySub(admin, businessId, subscription);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Parameters<typeof applySub>[2] & {
        metadata?: { business_id?: string };
      };
      const businessId = await resolveBiz(subscription);
      if (businessId) await applySub(admin, businessId, subscription);
    } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
      const invoice = event.data.object as { subscription?: string | { id: string } };
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subId) {
        const subscription = await stripe.subscriptions.retrieve(subId);
        const businessId = await resolveBiz(subscription);
        if (businessId) {
          if (event.type === 'invoice.payment_failed' && subscription.status === 'active') {
            await admin
              .from('businesses')
              .update({ plan: 'past_due', subscription_status: subscription.status })
              .eq('id', businessId);
          } else {
            await applySub(admin, businessId, subscription);
          }
        }
      }
    }
    sendJson(res, 200, { received: true });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Webhook failed' });
  }
};

export function apiProxyPlugin(): Plugin {
  return {
    name: 'previsio-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method === 'POST' && req.url?.startsWith('/api/ai')) {
            await handleAi(req, res);
            return;
          }
          if (req.method === 'POST' && req.url?.startsWith('/api/invite-staff')) {
            await handleInviteStaff(req, res);
            return;
          }
          if (req.method === 'POST' && req.url?.startsWith('/api/public-order')) {
            await handlePublicOrder(req, res);
            return;
          }
          if (req.method === 'GET' && req.url?.startsWith('/api/public-menu')) {
            await handlePublicMenu(req, res);
            return;
          }
          if (req.method === 'POST' && req.url?.startsWith('/api/billing/checkout')) {
            await handleBillingCheckout(req, res);
            return;
          }
          if (req.method === 'POST' && req.url?.startsWith('/api/billing/portal')) {
            await handleBillingPortal(req, res);
            return;
          }
          if (req.method === 'POST' && req.url?.startsWith('/api/stripe-webhook')) {
            await handleStripeWebhook(req, res);
            return;
          }
        } catch (err) {
          sendJson(res, 500, { error: err instanceof Error ? err.message : 'API failed' });
          return;
        }
        next();
      });
    },
  };
}

/** @deprecated use apiProxyPlugin */
export const aiProxyPlugin = apiProxyPlugin;
