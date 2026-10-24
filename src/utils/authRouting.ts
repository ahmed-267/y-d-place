import { supabase } from '../components/supabaseClient';

export type AuthDestination = 'dashboard' | 'onboarding';

/** Resolve where to send an authenticated owner based on their business row. */
export async function resolvePostAuthDestination(userId: string): Promise<AuthDestination> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, setup_completed')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load your business: ${error.message}`);
  return data?.setup_completed === true ? 'dashboard' : 'onboarding';
}
