import { directInvoke } from './supabase';

// Web-push enrolment for staff devices. Call enablePush() from a user click
// (permission prompts must be user-initiated). Registers the service worker,
// fetches the VAPID public key, subscribes, and stores the subscription.

export const isPushSupported = () =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (b64: string) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export const enablePush = async (userId?: string): Promise<{ ok: boolean; error?: string }> => {
    try {
        if (!isPushSupported()) return { ok: false, error: 'This device/browser does not support notifications. On iPhone, add the app to your Home Screen first (Share → Add to Home Screen).' };
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, error: 'Notifications were not allowed.' };

        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const { data, error } = await directInvoke('push-vapid', {});
        if (error || !data?.publicKey) return { ok: false, error: error?.message || 'Could not get the push key.' };

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
        }
        const res = await directInvoke('push-subscribe', { userId, subscription: (sub as any).toJSON(), label: navigator.userAgent.slice(0, 80) });
        if (res.error) return { ok: false, error: res.error.message };
        localStorage.setItem('fbn_push_enabled', '1');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Could not enable notifications.' };
    }
};

export const pushAlreadyEnabled = () => typeof localStorage !== 'undefined' && localStorage.getItem('fbn_push_enabled') === '1';
