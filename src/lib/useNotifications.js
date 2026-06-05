// useNotifications.js — bandeja del usuario actual en tiempo real.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { listNotifications } from './notificationsApi.js';

export function useNotifications(recipient) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!recipient) { setItems([]); setLoading(false); return; }
    try {
      const rows = await listNotifications(recipient);
      setItems(rows);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [recipient]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    if (!recipient) return () => { cancelled = true; };

    const channel = supabase
      .channel(`notifications-${recipient}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `recipient_username=eq.${recipient}`,
      }, () => refresh())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [recipient, refresh]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  return { items, unreadCount, loading, error, refresh };
}
