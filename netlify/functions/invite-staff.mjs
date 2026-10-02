import { createClient } from '@supabase/supabase-js';
import { json, parseBody, getAnonEnv, createServiceClient } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const anonEnv = getAnonEnv();
  const admin = createServiceClient();
  if (!anonEnv || !admin) {
    return json(503, {
      error:
        'Server invite requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return json(401, { error: 'Missing authorization' });

  const userClient = createClient(anonEnv.url, anonEnv.anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !authData.user) return json(401, { error: 'Invalid session' });

  const { data: caller } = await admin
    .from('app_users')
    .select('business_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || caller.role !== 'owner' || !caller.business_id) {
    return json(403, { error: 'Only the business owner can invite staff' });
  }

  try {
    const body = parseBody(event);
    const email = (body.email || '').trim().toLowerCase();
    const username = (body.username || '').trim();
    const password = body.password || '';
    const role = body.role === 'manager' ? 'manager' : 'staff';

    if (!email || !username || password.length < 8) {
      return json(400, { error: 'Email, username, and a strong password (8+) are required' });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.fullName, username },
    });

    if (createErr || !created.user) {
      return json(400, { error: createErr?.message || 'Could not create auth user' });
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
      return json(400, { error: profileErr.message });
    }

    return json(200, {
      user: {
        id: created.user.id,
        username,
        fullName: body.fullName || username,
        email,
        role,
      },
    });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Invite failed' });
  }
};
