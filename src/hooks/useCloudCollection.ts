import { useRef, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '../components/supabaseClient';

export type CloudSetter<T> = (action: SetStateAction<T[]>) => Promise<boolean>;

type Row = { id: string | number; revision?: number };
/** Only user mutations enter this queue. Hydration and realtime use the raw setter. */
export function useCloudCollection<T extends Row>(
  table: string, businessId: string | undefined, local: boolean, state: T[],
  setState: Dispatch<SetStateAction<T[]>>, toRow: (item: T, business: string) => object,
  onError: (message: string) => void,
): CloudSetter<T> {
  const stateRef = useRef(state);
  stateRef.current = state;
  const scope = useRef(businessId);
  scope.current = businessId;
  const queue = useRef(Promise.resolve(true));
  return action => {
    if (local) { setState(action); return Promise.resolve(true); }
    if (!businessId) return Promise.resolve(false);
    const capturedBusiness = businessId;
    // Capture the user's base now. A later realtime event must not silently rebase a stale edit.
    const capturedBase = stateRef.current;
    queue.current = queue.current.then(async () => {
      if (scope.current !== capturedBusiness) return false;
      const before = capturedBase;
      const next = typeof action === 'function' ? action(before) : action;
      const old = new Map(before.map(row => [row.id, row]));
      const ids = new Set(next.map(row => row.id));
      const changes = next.filter(row => JSON.stringify(toRow(row, capturedBusiness)) !==
        JSON.stringify(old.has(row.id) ? toRow(old.get(row.id)!, capturedBusiness) : null))
        .map(row => ({ row: toRow(row, capturedBusiness), expected: old.has(row.id) ? old.get(row.id)!.revision ?? 0 : null }));
      const deleted = before.filter(row => !ids.has(row.id)).map(row => ({
        row: { id: toRow(row, capturedBusiness)['id'], business_id: capturedBusiness }, expected: row.revision ?? 0, delete: true,
      }));
      if (!changes.length && !deleted.length) return true;
      const pendingKey = `previsio_pending_${capturedBusiness}_${table}`;
      try {
        // Recovery artifact only. Never replay blindly after a reload or account switch.
        try { localStorage.setItem(pendingKey, JSON.stringify({ changes: [...changes, ...deleted], at: Date.now() })); } catch { /* Cloud saving remains available when browser storage is full. */ }
        const { data, error } = await supabase.rpc('previsio_mutate', {
          collection: table, biz: capturedBusiness, changes: [...changes, ...deleted],
        });
        if (error) throw new Error(error.message);
        try { localStorage.removeItem(pendingKey); } catch { /* Cloud result remains authoritative. */ }
        if (scope.current !== capturedBusiness) return false;
        const revisions = new Map((data as Row[]).map(row => [String(row.id), row.revision]));
        // Preserve remote changes to unrelated rows received while this request was pending.
        const changed = new Set([...changes, ...deleted].map(c => String(c.row['id'])));
        const serverId = (row: T) => String(toRow(row, capturedBusiness)['id']);
        const saved = next.filter(row => changed.has(serverId(row))).map(row => {
          const revision = revisions.get(serverId(row)) ?? row.revision ?? 0;
          const live = stateRef.current.find(item => serverId(item) === serverId(row));
          return live && (live.revision ?? 0) > revision ? live : { ...row, revision };
        });
        const merged = [...stateRef.current.filter(row => !changed.has(serverId(row))), ...saved];
        stateRef.current = merged;
        setState(merged);
        return true;
      } catch (error) {
        onError(`Not saved: ${error instanceof Error ? error.message : 'Connection failed'}. Your attempted change is retained for recovery; reload before retrying a conflict.`);
        return false;
      }
    }).catch(error => { onError(`Not saved: ${String(error)}`); return false; });
    return queue.current;
  };
}
