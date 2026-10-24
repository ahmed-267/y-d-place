import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../components/supabaseClient';
import { readAllPages } from '../utils/pagedRows.mjs';
export function useSchedulingLeave() {
  const { businessSettings, isDemoMode } = useApp();
  const biz = businessSettings?.id;
  const [state, setState] = useState<{ready:boolean; rows:{user_id:string;from_date:string;to_date:string;status:string}[]}>({ready:false,rows:[]});
  useEffect(() => {
    let active = true;
    setState({ready:false,rows:[]});
    const load = async () => {
      try {
        const rows = isDemoMode ? JSON.parse(localStorage.getItem(`previsio_leave_requests:${biz}`)||'[]') :
          await readAllPages((from,to)=>supabase.from('leave_requests').select('id,user_id,from_date,to_date,status').eq('business_id',biz).in('status',['pending','approved']).order('id').range(from,to));
        if(active) setState({ready:true,rows:rows.filter(r=>r.status!=='rejected')});
      } catch { if(active) setState(s=>({...s,ready:false})); }
    };
    void load();const refresh=()=>{void load();};const timer=setInterval(refresh,10000);
    window.addEventListener('leave-requests-changed',refresh);window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('leave-requests-changed',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);};
  },[biz,isDemoMode]);
  return state;
}
