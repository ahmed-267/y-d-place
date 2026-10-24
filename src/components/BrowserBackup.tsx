import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { loadPersistedOps } from '../utils/opsPersistence';
import { recoverySnapshot } from '../utils/browserBackup';

type Backup = { id: string; device_id: string; created_at: string; user_id: string };

export function BrowserBackup({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState('Checking automatic backup…');
  const [expanded, setExpanded] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, running = false, localSaveFailed = false, confirmed = '';
    let confirmedAt = '';
    const backup = async () => {
      if (cancelled || running || localSaveFailed) return;
      running = true;
      try {
        const ops = loadPersistedOps(businessId);
        if (!ops) { setStatus('Backup waiting for local data'); return; }
        const snapshot = recoverySnapshot(ops);
        const fingerprint = JSON.stringify(snapshot);
        if (fingerprint === confirmed) { setStatus(`Local data backed up: ${confirmedAt}`); return; }
        setStatus('Local changes awaiting backup…');
        if (!navigator.onLine) throw new Error('Offline — keep this browser’s data until backup succeeds.');
        const key = `previsio_backup_device:${businessId}`;
        let device = localStorage.getItem(key);
        if (!device) { device = crypto.randomUUID(); localStorage.setItem(key, device); }
        const { data, error } = await supabase.rpc('previsio_backup_browser', { biz: businessId, device, snapshot });
        if (error) throw new Error(error.message);
        if (cancelled) return;
        confirmed = fingerprint;
        confirmedAt = new Date(data).toLocaleString();
        setStatus(`Local data backed up: ${confirmedAt}`);
        setError('');
      } catch (e) {
        if (!cancelled) {
          setStatus('Automatic backup needs attention');
          setError(e instanceof Error ? e.message : 'Backup failed. We will retry while this app is open.');
        }
      } finally { running = false; }
    };
    const first = window.setTimeout(backup, 2000);
    const interval = window.setInterval(backup, 60000);
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.businessId !== businessId || cancelled) return;
      localSaveFailed = false;
      setStatus('Local changes awaiting automatic backup…');
    };
    const failed = (event: Event) => {
      if ((event as CustomEvent).detail?.businessId !== businessId || cancelled) return;
      localSaveFailed = true;
      setStatus('Local save failed — latest changes are not backed up');
      setError('Browser storage is unavailable or full. Keep this tab open and resolve storage before reloading.');
    };
    window.addEventListener('previsio-local-save-failed', failed);
    window.addEventListener('previsio-local-data-changed', changed);
    window.addEventListener('online', backup);
    return () => {
      cancelled = true;
      window.clearTimeout(first); window.clearInterval(interval);
      window.removeEventListener('online', backup);
      window.removeEventListener('previsio-local-save-failed', failed);
      window.removeEventListener('previsio-local-data-changed', changed);
    };
  }, [businessId]);

  const list = async () => {
    setExpanded(true);
    const { data, error } = await supabase.from('browser_backups')
      .select('id,device_id,created_at,user_id').eq('business_id', businessId).order('created_at', { ascending: false }).limit(60);
    if (error) setError(error.message); else setBackups(data || []);
  };
  const download = async (id: string) => {
    const { data, error } = await supabase.from('browser_backups').select('payload,created_at,device_id')
      .eq('business_id', businessId).eq('id', id).single();
    if (error) { setError(error.message); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ businessId, ...data }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `previsio-recovery-${id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (import.meta.env.PROD) return null;

  return <aside className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-700">
    <button type="button" onClick={() => expanded ? setExpanded(false) : void list()} className="underline">{status}</button>
    {error && <p role="alert" className="text-red-700">{error} Automatic retries run every minute while the app is open.</p>}
    {expanded && <div className="max-h-60 overflow-auto py-2">
      <p>Recovery copies of this browser’s local records, checked every minute. Keep the app open until backup succeeds. This does not synchronise tills or back up the whole database.</p>
      <p>Three versions per device/account are retained. Owners can download their business’s copies for recovery; other users can download their own. Recovery requires reviewing records before importing; do not replay sales.</p>
      <button type="button" className="underline" onClick={() => void list()}>Refresh recovery copies</button>
      {backups.map(b => <div key={b.id}><button type="button" className="underline" onClick={() => void download(b.id)}>
        Download {new Date(b.created_at).toLocaleString()} — device {b.device_id.slice(0, 8)}
      </button></div>)}
      {!backups.length && <p>No recovery copies available yet.</p>}
    </div>}
  </aside>;
}
