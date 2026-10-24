import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../components/supabaseClient';

export function usePendingLeaveCount() {
  const { user, businessSettings, isDemoMode } = useApp();
  const [count, setCount] = useState(0);
  const biz = businessSettings?.id;
  const mine = String(user?.authId || user?.id);
  const reviewer = user?.role === 'owner' || user?.role === 'manager';
  useEffect(() => {
    setCount(0);
    if (!reviewer || !biz) return;
    let cancelled = false;
    const load = async () => {
      try {
        let next = 0;
        if (isDemoMode) {
          const rows = JSON.parse(localStorage.getItem(`previsio_leave_requests:${biz}`) || '[]');
          next = rows.filter((r: {status: string; user_id: string}) => r.status === 'pending' && r.user_id !== mine).length;
        } else {
          const result = await supabase.from('leave_requests').select('id', {count: 'exact', head: true}).eq('business_id', biz).eq('status', 'pending').neq('user_id', mine);
          if (result.error) return;
          next = result.count || 0;
        }
        if (!cancelled) setCount(next);
      } catch { /* Retain the last known count on a temporary connection failure. */ }
    };
    void load();
    const refresh = () => { void load(); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('leave-requests-changed', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('leave-requests-changed', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [biz, mine, reviewer, isDemoMode]);
  return count;
}
