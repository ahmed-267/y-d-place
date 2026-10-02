import { createClient } from '@supabase/supabase-js';

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const getAnonEnv = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url, anon };
};

export const getServiceEnv = () => {
  const base = getAnonEnv();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !service) return null;
  return { ...base, service };
};

export const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
};

export const createAnonClient = () => {
  const env = getAnonEnv();
  if (!env) return null;
  return createClient(env.url, env.anon);
};

export const createServiceClient = () => {
  const env = getServiceEnv();
  if (!env) return null;
  return createClient(env.url, env.service);
};

/** Simple in-memory rate limit (per warm function instance). */
const buckets = new Map();
export const rateLimit = (key, max = 20, windowMs = 60_000) => {
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= max;
};
