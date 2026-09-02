import { supabase } from '../components/supabaseClient';

export type AuthDestination = 'dashboard' | 'onboarding';

/** Resolve where to send an authenticated owner based on their business row. */
export async function resolvePostAuthDestination(userId: string): Promise<AuthDestination> {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, setup_completed')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (error || !data) return 'onboarding';
    return data.setup_completed === true ? 'dashboard' : 'onboarding';
  } catch {
    return 'onboarding';
  }
}
