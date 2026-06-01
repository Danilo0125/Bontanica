// useOrders.js — órdenes abiertas + suscripción realtime.
// Refetch completo en cada evento; suficiente para 2-3 usuarios concurrentes.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { fetchOpenOrders } from './orderApi.js';

export function useOpenOrders(channelName = 'orders-default') {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchOpenOrders();
      setOrders(rows);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refresh())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [channelName, refresh]);

  return { orders, loading, error, refresh };
}
