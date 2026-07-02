import { apiGet, apiPost } from './api';

// urlBase64ToUint8Array converts a VAPID public key to the format the
// PushManager expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

// enablePush registers the service worker, asks for permission, subscribes with
// the server's VAPID key, and stores the subscription on the backend.
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'Your browser does not support push notifications.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Notification permission was not granted.' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let key = '';
  try {
    const res = await apiGet<{ public_key: string }>('/notifications/push/vapid-key');
    key = res.public_key;
  } catch {
    return { ok: false, reason: 'Could not fetch the push key from the server.' };
  }
  if (!key) return { ok: false, reason: 'Push is not configured on the server yet (missing VAPID key).' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    await apiPost('/notifications/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
  } catch {
    return { ok: false, reason: 'Could not save your subscription on the server.' };
  }
  return { ok: true };
}
