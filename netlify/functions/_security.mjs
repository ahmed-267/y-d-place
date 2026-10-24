import { createHash } from 'node:crypto';
import { createServiceClient } from './_shared.mjs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const activeSubscription = business => business?.plan === 'pro' || (
  business?.plan === 'trialing' && Date.parse(business.trial_ends_at) > Date.now()
);
export async function requireMember(event, roles = ['owner', 'manager'], { allowSetup = false } = {}) {
  const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Sign in required');
  const admin = createServiceClient();
  if (!admin) throw new HttpError(503, 'Scanning is unavailable because the server configuration is incomplete. Contact support.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid session');
  const { data: member, error: profileError } = await admin.from('app_users')
    .select('business_id, role').eq('id', data.user.id).maybeSingle();
  if (profileError || !member || !roles.includes(member.role)) throw new HttpError(403, 'Access denied');
  const { data: business, error: businessError } = await admin.from('businesses')
    .select('id, plan, trial_ends_at, setup_completed, owner_user_id').eq('id', member.business_id).single();
  const ownerSetup = allowSetup && member.role === 'owner' && business?.owner_user_id === data.user.id && business?.setup_completed === false;
  if (businessError || (!activeSubscription(business) && !ownerSetup)) throw new HttpError(403, 'Active subscription required');
  return { admin, user: data.user, member, business };
}
/** Database-backed limiter is shared by all function instances; unavailable means fail closed. */
export async function enforceLimit(admin, key, maximum, seconds) {
  const { data, error } = await admin.rpc('previsio_rate_limit', {
    bucket_key: createHash('sha256').update(key).digest('hex'), maximum, window_seconds: seconds,
  });
  if (error) throw new HttpError(503, 'Usage limits temporarily unavailable');
  if (!data) throw new HttpError(429, 'Usage limit reached. Try again later.');
}
export function validateAi(body) {
  if (!['menu-scan','receipt-scan','product-assistance','brand-story'].includes(body?.operation)) throw new HttpError(400, 'Invalid operation');
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000)
    throw new HttpError(400, 'Invalid prompt');
  if (!['text', 'json'].includes(body.mode)) throw new HttpError(400, 'Invalid mode');
  if (body.model !== undefined) throw new HttpError(400, 'Model selection is managed by the server');
  if (body.imageBase64 !== undefined && (typeof body.imageBase64 !== 'string' ||
      body.imageBase64.length > 5_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(body.imageBase64)))
    throw new HttpError(400, 'Invalid image');
  if (body.schema !== undefined && (!body.schema || typeof body.schema !== 'object' ||
      Array.isArray(body.schema) || JSON.stringify(body.schema).length > 20000))
    throw new HttpError(400, 'Invalid response schema');
}
export function validateOrder(body, now = Date.now()) {
  for (const [key, max] of [['businessId', 200], ['customerName', 120], ['customerPhone', 40]]) {
    if (typeof body?.[key] !== 'string' || !body[key].trim() || body[key].length > max)
      throw new HttpError(400, `Invalid ${key}`);
  }
  if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId))
    throw new HttpError(400, 'Invalid request identifier');
  const scheduled = Date.parse(body.scheduledFor);
  if (!Number.isFinite(scheduled) || scheduled < now || scheduled > now + 90 * 86400000)
    throw new HttpError(400, 'Choose a future pickup time within 90 days');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50)
    throw new HttpError(400, 'Invalid items');
  for (const item of body.items) {
    if (!item || !Number.isSafeInteger(item.productId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)
      throw new HttpError(400, 'Invalid item quantity or identifier');
    if (item.extraIds !== undefined && (!Array.isArray(item.extraIds) || item.extraIds.length > 20 ||
        item.extraIds.some(id => !Number.isSafeInteger(id)) || new Set(item.extraIds).size !== item.extraIds.length))
      throw new HttpError(400, 'Invalid extras');
    if (item.note !== undefined && (typeof item.note !== 'string' || item.note.length > 200))
      throw new HttpError(400, 'Invalid item note');
  }
}

/** Validate the schema subset used by the app before returning structured AI output. */
export function validateStructured(value, schema, depth = 0) {
  if (!schema || depth > 20) return false;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required || []).some(key => !(key in value))) return false;
    return Object.entries(value).every(([key, item]) => schema.properties?.[key]
      ? validateStructured(item, schema.properties[key], depth + 1) : schema.additionalProperties !== false);
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length <= 500 && value.every(item => validateStructured(item, schema.items, depth + 1));
  if (schema.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (schema.type === 'string') return typeof value === 'string' && value.length <= 20000;
  if (schema.type === 'boolean') return typeof value === 'boolean';
  return false;
}
