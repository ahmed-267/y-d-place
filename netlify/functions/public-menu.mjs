import { json, createAnonClient } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const client = createAnonClient();
  if (!client) return json(503, { error: 'Supabase env not configured' });

  const params = event.queryStringParameters || {};
  const businessId = params.businessId || '';
  if (!businessId) return json(400, { error: 'businessId required' });

  try {
    const { data: business } = await client
      .from('businesses')
      .select('id, name, currency_symbol, currency_code, enabled_modules')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) return json(404, { error: 'Not found' });

    const modules = business.enabled_modules || {};
    if (modules.onlineOrders !== true) {
      return json(200, {
        businessId,
        businessName: business.name,
        currencySymbol: business.currency_symbol || '€',
        onlineOrdersEnabled: false,
        products: [],
      });
    }

    const { data: products } = await client
      .from('products')
      .select('id, name_en, category, price, emoji, active, is_favourite, pos_color, extra_ids')
      .eq('business_id', businessId)
      .eq('active', true);

    return json(200, {
      businessId,
      businessName: business.name,
      currencySymbol: business.currency_symbol || '€',
      currencyCode: business.currency_code || 'EUR',
      onlineOrdersEnabled: true,
      products: (products || []).map((p) => ({
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
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Menu failed' });
  }
};
