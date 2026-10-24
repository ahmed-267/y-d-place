import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { readAllPages } from '../utils/pagedRows.mjs';
import { supabase } from './supabaseClient';

type Request = { id: string; user_id: string; from_date: string; to_date: string; reason: string; notes: string; status: string; name?: string };
export function LeaveRequests({ initialDate = '', review = false, historyOnly = false, formOnly = false }: { initialDate?: string; review?: boolean; historyOnly?: boolean; formOnly?: boolean }) {
  const { user, users, businessSettings, isDemoMode, workShifts, rota, setWorkShifts, refreshBusinessData } = useApp();
  const [requests, setRequests] = useState<Request[]>([]);
  const [first, setFirst] = useState(initialDate);
  const [last, setLast] = useState(initialDate);
  const [reason, setReason] = useState('holiday');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const retry = useRef<{body: string; id: string} | null>(null);
  const biz = businessSettings?.id;
  const key = `previsio_leave_requests:${biz}`;
  const mine = String(user?.authId || user?.id);
  const canReview = review && (user?.role === 'manager' || user?.role === 'owner');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = isDemoMode ? { data: JSON.parse(localStorage.getItem(key) || '[]'), error: null } :
          { data: await readAllPages((from, to) => supabase.from('leave_requests').select('*').eq('business_id', biz).order('id').range(from, to)), error: null };
        if (result.error) throw result.error;
        if (!cancelled) setRequests(result.data || []);
      } catch { if (!cancelled) setError('Time-off requests could not be loaded. Check your connection and database setup.'); }
    };
    void load(); const timer = window.setInterval(load, 10000);
    window.addEventListener('leave-requests-changed',load);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('leave-requests-changed',load); };
  }, [biz, isDemoMode, key]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (running.current || !biz || !user) return;
    running.current = true; setBusy(true); setError('');
    try {
      const today = new Date(); const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const days = (Date.parse(last)-Date.parse(first))/86400000;
      if (!first || !last || first<todayKey || !Number.isFinite(days) || days<0 || days>89) throw new Error('Select 1–90 days starting today or later.');
      const body = JSON.stringify({biz,first,last,reason,notes});
      if (retry.current?.body !== body) retry.current = {body,id:crypto.randomUUID()};
      const id = retry.current.id;
      if (isDemoMode) {
        const saved: Request[] = JSON.parse(localStorage.getItem(key)||'[]');
        if (saved.some(r => r.user_id===mine && r.status!=='rejected' && r.from_date<=last && r.to_date>=first)) throw new Error('These dates overlap an existing request.');
        localStorage.setItem(key,JSON.stringify([{id,user_id:mine,from_date:first,to_date:last,reason,notes,status:'pending',name:user.fullName},...saved]));
      } else {
        const { error } = await supabase.rpc('previsio_request_leave',{biz,request_id:id,first_day:first,last_day:last,reason_input:reason,notes_input:notes});
        if (error) throw error;
      }
      setRequests(prev => [{id,user_id:mine,from_date:first,to_date:last,reason,notes,status:'pending',name:user.fullName},...prev.filter(r=>r.id!==id)]);
      window.dispatchEvent(new Event('leave-requests-changed'));
      retry.current=null; setNotes('');
    } catch(e) { setError(e instanceof Error ? e.message : String((e as any)?.message || 'Request failed')); }
    finally { running.current=false; setBusy(false); }
  };
  const decide = async (req: Request, decision: string) => {
    if (running.current) return; running.current=true; setBusy(true); setError('');
    try {
      if (req.user_id===mine) throw new Error('Another manager or owner must review your request.');
      if (isDemoMode) {
        const member = users.find(u=>String(u.authId||u.id)===req.user_id);
        if (!member) throw new Error('Staff member not found');
        if (decision==='approved') {
          if(workShifts.some(s=>s.userId===member.id && s.date>=req.from_date && s.date<=req.to_date) || rota.some(s=>s.userId===member.id && s.date>=req.from_date && s.date<=req.to_date)) throw new Error('Existing shift overlaps. Review the schedule first.');
          const added = [];
          for(let d=Date.parse(req.from_date); d<=Date.parse(req.to_date); d+=86400000) added.push({id:`LEAVE-${req.id}-${d}`,userId:member.id,username:member.username,fullName:member.fullName,date:new Date(d).toISOString().slice(0,10),startTime:'',endTime:'',breakMinutes:0,totalHours:0,kind:'leave' as const,leaveReason:req.reason as any,notes:req.notes,payAmount:0});
          if(!await setWorkShifts([...workShifts,...added])) throw new Error('Approval was not saved');
        }
        const saved: Request[]=JSON.parse(localStorage.getItem(key)||'[]');
        localStorage.setItem(key,JSON.stringify(saved.map(r=>r.id===req.id?{...r,status:decision}:r)));
      } else {
        const {error} = await supabase.rpc('previsio_review_leave',{request_id:req.id,decision}); if(error) throw error;
        await refreshBusinessData();
      }
      window.dispatchEvent(new Event('leave-requests-changed'));
      setRequests(prev=>prev.map(r=>r.id===req.id?{...r,status:decision}:r));
    } catch(e) {setError(String((e as any)?.message || 'Review failed'));}
    finally {running.current=false;setBusy(false);}
  };
  return <section className="card-bakery p-4 sm:p-5 space-y-4 text-bakery-brown">
    <h3 className="text-base font-bold font-serif">{historyOnly?'My time-off history':canReview?'Time-off requests to review':'Request time off'}</h3>
    <p className="text-xs text-bakery-brown/60 leading-relaxed">Requests remain pending until a manager or owner approves them. A date range includes every day between the two dates.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!review && !historyOnly && <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
      <label className="block min-w-0 text-xs font-bold space-y-2">First day<input required aria-label="First day" type="date" value={first} onChange={e=>setFirst(e.target.value)} className="block w-full min-w-0 rounded-xl border border-bakery-beige bg-bakery-cream px-3 py-2.5 text-sm text-bakery-brown font-sans focus:outline-none focus:ring-2 focus:ring-bakery-caramel/40" /></label>
      <label className="block min-w-0 text-xs font-bold space-y-2">Last day<input required aria-label="Last day" type="date" min={first} value={last} onChange={e=>setLast(e.target.value)} className="block w-full min-w-0 rounded-xl border border-bakery-beige bg-bakery-cream px-3 py-2.5 text-sm text-bakery-brown font-sans focus:outline-none focus:ring-2 focus:ring-bakery-caramel/40" /></label>
      <label className="block min-w-0 text-xs font-bold space-y-2">Reason<select aria-label="Reason" className="block w-full min-w-0 rounded-xl border border-bakery-beige bg-bakery-cream px-3 py-2.5 text-sm text-bakery-brown font-sans focus:outline-none focus:ring-2 focus:ring-bakery-caramel/40" value={reason} onChange={e=>setReason(e.target.value)}>{['holiday','sick','personal','other'].map(r=><option key={r}>{r}</option>)}</select></label>
      <label className="block min-w-0 text-xs font-bold space-y-2">Notes<input aria-label="Request notes" maxLength={2000} className="block w-full min-w-0 rounded-xl border border-bakery-beige bg-bakery-cream px-3 py-2.5 text-sm text-bakery-brown font-sans focus:outline-none focus:ring-2 focus:ring-bakery-caramel/40" value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button disabled={busy} className="btn-primary sm:col-span-2 xl:col-span-4 justify-self-start disabled:opacity-50" type="submit">{busy?'Saving…':'Submit request'}</button>
    </form>}
    {!formOnly && <div className="overflow-x-auto rounded-xl border border-bakery-beige">
      <table className="w-full text-left text-sm"><thead className="bg-bakery-beige/30 text-bakery-brown/60 text-[10px] uppercase tracking-widest"><tr>
        {canReview && <th className="p-3">Staff member</th>}<th className="p-3">Dates</th><th className="p-3">Reason</th><th className="p-3">Status</th><th className="p-3">Notes</th>{canReview && <th className="p-3">Review</th>}
      </tr></thead><tbody className="divide-y divide-bakery-beige">
      {(canReview?[...requests]:requests.filter(r=>r.user_id===mine)).sort((a,b)=>b.from_date.localeCompare(a.from_date)).map(r=><tr key={r.id}>
        {canReview && <td className="p-3 font-bold">{r.name || users.find(u=>String(u.authId||u.id)===r.user_id)?.fullName || 'Staff member'}</td>}
        <td className="p-3 whitespace-nowrap">{r.from_date} – {r.to_date}</td><td className="p-3 capitalize">{r.reason}</td><td className="p-3"><span className="rounded-lg bg-bakery-beige/40 px-2 py-1 text-xs font-bold capitalize">{r.status}</span></td><td className="p-3">{r.notes || '—'}</td>
        {canReview && <td className="p-3">{r.status==='pending' && r.user_id!==mine && <div className="flex gap-2"><button disabled={busy} onClick={()=>void decide(r,'approved')} className="btn-secondary text-xs disabled:opacity-50">Approve</button><button disabled={busy} onClick={()=>void decide(r,'rejected')} className="btn-secondary text-xs disabled:opacity-50">Reject</button></div>}</td>}
      </tr>)}
      {!(canReview?requests:requests.filter(r=>r.user_id===mine)).length && <tr><td colSpan={canReview?6:4} className="p-6 text-center text-bakery-brown/60">No time-off requests yet.</td></tr>}
      </tbody></table>
    </div>}

  </section>;
}
