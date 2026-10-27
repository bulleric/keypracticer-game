import { useEffect, useRef, useState } from 'react';
import { mergeProgress, normalize } from '../store/model';
import { useProgress } from '../store/progress';
import { useAuth } from './auth';
import { supabase } from './supabase';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';
let status: SyncStatus = 'off';
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function useSyncStatus(): SyncStatus {
  const [s, set] = useState(status);
  useEffect(() => {
    listeners.add(set);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

/**
 * Keeps the progress on this device and in the account in step. On sign-in
 * the two copies are merged (nothing earned is lost); after that every change
 * is saved to the account a moment later. The game never waits for this.
 */
export function SyncBridge() {
  const { session } = useAuth();
  const { progress, loaded, replace } = useProgress();
  const userId = session?.user.id ?? null;
  const merged = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(progress);
  latest.current = progress;

  // First sync after sign-in: pull, merge, push.
  useEffect(() => {
    if (!supabase || !userId || !loaded || merged.current === userId) return;
    let cancelled = false;
    (async () => {
      setStatus('syncing');
      const { data, error } = await supabase!.from('profiles').select('data').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      if (error) return setStatus('error');
      const local = latest.current;
      const next = data?.data ? mergeProgress(local, normalize(data.data)) : local;
      if (next !== local) replace(next);
      const up = await supabase!.from('profiles').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() });
      if (cancelled) return;
      merged.current = userId;
      setStatus(up.error ? 'error' : 'synced');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loaded, replace]);

  // After that: push changes, debounced.
  useEffect(() => {
    if (!supabase || !userId || merged.current !== userId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus('syncing');
      const { error } = await supabase!.from('profiles').upsert({ user_id: userId, data: latest.current, updated_at: new Date().toISOString() });
      setStatus(error ? 'error' : 'synced');
    }, 2000);
  }, [progress.updatedAt, userId]);

  useEffect(() => {
    if (!userId) {
      merged.current = null;
      setStatus('off');
    }
  }, [userId]);

  return null;
}
