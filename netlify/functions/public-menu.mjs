import { activeSubscription } from './_security.mjs';
import { json, createServiceClient } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const client = createServiceClient();
  if (!client) return json(503, { error: 'Online ordering is temporarily unavailable. Please contact the business.', code: 'ORDERING_SERVER_NOT_CONFIGURED' });

  const params = event.queryStringParameters || {};
  const businessId = params.businessId || '';
  if (!businessId) return json(400, { error: 'businessId required' });

  try {
    const { data: business, error: businessError } = await client
      .from('businesses')
      .select('id, name, currency_symbol, currency_code, enabled_modules, plan, trial_ends_at')
      .eq('id', businessId)
      .maybeSingle();

    if (businessError) return json(503, { error: 'Menu temporarily unavailable' });
    if (!business) return json(404, { error: 'Not found' });

    const modules = business.enabled_modules || {};
    if (modules.onlineOrders !== true || !activeSubscription(business)) {
      return json(200, {
        businessId,
        businessName: business.name,
        currencySymbol: business.currency_symbol || '€',
        onlineOrdersEnabled: false,
        products: [],
      });
    }

    const { data: products, error: productsError } = await client
      .from('products')
      .select('id, name_en, category, price, emoji, active, is_favourite, pos_color, extra_ids')
      .eq('business_id', businessId)
      .eq('active', true);

    if (productsError) return json(503, { error: 'Menu temporarily unavailable' });
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
