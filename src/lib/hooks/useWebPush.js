import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export function useWebPush(userId, orgId) {
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);
  const [supported] = useState(typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window);

  // Registrar SW al montar
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.pushManager.getSubscription().then(sub => setIsSubscribed(!!sub));
    }).catch(e => setError(e.message));

    // Listener para navegación cuando se hace click en notificación
    const handler = (event) => {
      if (event.data?.type === 'navigate' && event.data.link) {
        window.location.href = event.data.link;
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID_PUBLIC_KEY no configurada');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Guardar en Supabase
      const subJson = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        org_id: orgId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: 'user_id,endpoint' });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      setError(e.message);
      return false;
    }
  }, [supported, userId, orgId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
      setIsSubscribed(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, error, requestPermission, unsubscribe };
}
