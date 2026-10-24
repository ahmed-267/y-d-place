import { DiscountPolicy, normalizeDiscountPolicy, Role, User } from '../types';
import { supabase, createEphemeralSupabase } from '../components/supabaseClient';
import { DEFAULT_USERS } from '../constants';

export type DiscountCheck =
  | { ok: true; needsApproval: false }
  | { ok: true; needsApproval: true }
  | { ok: false; reason: 'over_limit' };

export const evaluateDiscount = (
  role: Role | undefined,
  opts: { discountValue: number; discountPercent?: number },
  policyInput?: Partial<DiscountPolicy> | null
): DiscountCheck => {
  const discountValue = Math.max(0, opts.discountValue || 0);
  const discountPercent = Math.max(0, opts.discountPercent || 0);
  if (discountValue <= 0 && discountPercent <= 0) return { ok: true, needsApproval: false };
  if (role === 'owner' || role === 'manager') return { ok: true, needsApproval: false };

  const policy = normalizeDiscountPolicy(policyInput);
  const over =
    discountValue > policy.staffMaxAmount + 0.001 ||
    discountPercent > policy.staffMaxPercent + 0.001;

  if (!over) return { ok: true, needsApproval: false };

  if (policy.requireManagerPinAboveLimit) {
    return { ok: true, needsApproval: true };
  }
  return { ok: false, reason: 'over_limit' };
};

/**
 * Verify manager/owner credentials without touching the active POS session.
 * Demo mode may use bundled DEFAULT_USERS; production uses Supabase Auth on an ephemeral client.
 */
export const verifyManagerPassword = async (
  username: string,
  password: string,
  users: User[],
  opts?: { isDemoMode?: boolean; businessId?: string; orderId?: string; maximum?: number }
): Promise<(User & { approvalToken?: string }) | null> => {
  const id = username.trim();
  const pass = password;
  if (!id || !pass) return null;

  if (opts?.isDemoMode) {
    const demo = DEFAULT_USERS.find(
      u =>
        (u.role === 'owner' || u.role === 'manager') &&
        (u.username === id || u.email === id) &&
        u.password === pass
    );
    if (demo) {
      return {
        id: demo.id,
        username: demo.username,
        fullName: demo.fullName,
        role: demo.role,
        email: demo.email,
      } as User;
    }
  }

  // Prefer matching known team emails (username field may be an email)
  const candidate =
    users.find(
      u =>
        (u.role === 'owner' || u.role === 'manager') &&
        (u.username === id || u.email === id)
    ) || null;

  const email = (candidate?.email || (id.includes('@') ? id : '')).trim();
  if (!email) return null;

  const ephemeral = createEphemeralSupabase();
  try {
    const { data, error } = await ephemeral.auth.signInWithPassword({ email, password: pass });
    if (error || !data.user) return null;

    const { data: profile } = await ephemeral
      .from('app_users')
      .select('id, business_id, username, full_name, role, email')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || profile.business_id !== opts?.businessId) { await ephemeral.auth.signOut(); return null; }
    const { data: approval, error: approvalError } = await ephemeral.rpc('previsio_approve_discount', {
      biz: opts.businessId, order_id: opts.orderId, maximum: opts.maximum,
    });
    await ephemeral.auth.signOut();
    if (approvalError || !approval) return null;

    const role = (profile?.role as Role) || candidate?.role;
    if (role !== 'owner' && role !== 'manager') return null;

    return {
      approvalToken: approval,
      id: candidate?.id ?? Date.now(),
      username: String(profile?.username || candidate?.username || email),
      fullName: String(profile?.full_name || candidate?.fullName || email),
      role,
      email: profile?.email || candidate?.email || email,
    };
  } catch {
    try {
      await ephemeral.auth.signOut();
    } catch {
      /* ignore */
    }
    return null;
  }
};
