/**
 * Admin device Web Push helpers (order notifications only).
 * Does not touch inventory NotificationBell.
 */

import { apiRequest } from './http';

const VAPID_CACHE_KEY = 'telaqua_vapid_public_key';
const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Register SW — only call from Enable flow.
 * Does not use serviceWorker.ready before register (that can hang forever).
 */
export async function getServiceWorkerRegistration() {
  if (!isWebPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  } catch (error) {
    const err = new Error(
      error?.message ||
        'Service worker (/sw.js) could not be registered. Redeploy the admin site and hard-refresh.'
    );
    err.code = 'sw_missing';
    err.cause = error;
    throw err;
  }
}

/**
 * Existing registration only — never waits forever and never registers.
 */
export async function getExistingServiceWorkerRegistration() {
  if (!isWebPushSupported()) return null;
  try {
    const byScope = await navigator.serviceWorker.getRegistration('/');
    if (byScope) return byScope;
    const all = await navigator.serviceWorker.getRegistrations();
    return all[0] || null;
  } catch {
    return null;
  }
}

export async function fetchVapidPublicKey() {
  const data = await apiRequest('/api/admin/push/vapid-public-key');
  const key = String(data?.publicKey || '').trim();
  if (!key) {
    throw new Error('Server did not return a VAPID public key');
  }
  try {
    sessionStorage.setItem(VAPID_CACHE_KEY, key);
  } catch {
    // ignore
  }
  return key;
}

function subscriptionToJson(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

/**
 * Read existing push subscription without registering a service worker.
 * Returns null quickly when none is registered (Settings must not hang).
 */
export async function getBrowserPushSubscription() {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await getExistingServiceWorkerRegistration();
    if (!registration) return null;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function checkDevicePushStatus() {
  if (!isWebPushSupported()) {
    return { supported: false, enabled: false, permission: 'unsupported' };
  }

  const permission = Notification.permission;
  let subscription = null;
  try {
    subscription = await getBrowserPushSubscription();
  } catch {
    return {
      supported: true,
      enabled: false,
      permission,
      subscription: null,
      error: 'Unable to read this browser’s push subscription.',
    };
  }

  if (!subscription) {
    return { supported: true, enabled: false, permission, subscription: null };
  }

  try {
    const data = await apiRequest(
      `/api/admin/push/status?endpoint=${encodeURIComponent(subscription.endpoint)}`
    );
    return {
      supported: true,
      enabled: Boolean(data?.enabled),
      permission,
      subscription,
      subscriptionId: data?.subscriptionId || null,
    };
  } catch (error) {
    return {
      supported: true,
      enabled: false,
      permission,
      subscription,
      error: error.message || 'Unable to check notification status with the server.',
    };
  }
}

/**
 * Enable push on this device. Asks permission only when called.
 */
export async function enableOrderPushOnDevice() {
  if (!isWebPushSupported()) {
    return {
      success: false,
      code: 'unsupported',
      message: 'This browser does not support Web Push notifications.',
    };
  }

  if (!window.isSecureContext && location.hostname !== 'localhost') {
    return {
      success: false,
      code: 'insecure',
      message: 'Notifications require HTTPS (or localhost).',
    };
  }

  let permission = Notification.permission;
  if (permission === 'denied') {
    return {
      success: false,
      code: 'denied',
      message:
        'Notification permission is blocked. Allow notifications for this site in browser settings, then try again.',
    };
  }

  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return {
      success: false,
      code: 'denied',
      message: 'Notification permission was not granted.',
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    // After register(), ready resolves when this SW is active (does not hang forever).
    await navigator.serviceWorker.ready;
    const activeRegistration =
      (await getExistingServiceWorkerRegistration()) || registration;

    const publicKey = await fetchVapidPublicKey();
    let subscription = await activeRegistration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await activeRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const payload = subscriptionToJson(subscription);
    const data = await apiRequest('/api/admin/push/subscribe', {
      method: 'POST',
      body: payload,
    });

    if (!data?.success) {
      return {
        success: false,
        code: 'register_failed',
        message: data?.message || 'Server did not accept the subscription.',
      };
    }

    return {
      success: true,
      enabled: true,
      message: data.message || 'Order notifications enabled on this device.',
      subscriptionId: data.subscriptionId,
    };
  } catch (error) {
    const message = String(error?.message || 'Failed to enable notifications.');
    const code =
      error?.code === 'sw_missing' || /sw\.js|service worker|Failed to register/i.test(message)
        ? 'sw_missing'
        : /vapid|not configured|503/i.test(message)
          ? 'backend'
          : 'error';
    return {
      success: false,
      code,
      message:
        code === 'sw_missing'
          ? 'Service worker (/sw.js) could not be loaded. Redeploy the admin site and hard-refresh.'
          : message,
    };
  }
}

export async function disableOrderPushOnDevice() {
  const subscription = await getBrowserPushSubscription();
  let serverDeleted = false;
  let serverError = null;

  if (subscription) {
    try {
      const data = await apiRequest('/api/admin/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint },
      });
      serverDeleted = Boolean(data?.deleted || data?.success);
    } catch (error) {
      serverError = error.message || 'Server revoke failed';
    }

    try {
      await subscription.unsubscribe();
    } catch {
      // browser may already be unsubscribed
    }
  }

  return {
    success: !serverError,
    serverDeleted,
    serverError,
    message: serverError
      ? `Could not revoke on server: ${serverError}. Local subscription was cleared where possible.`
      : 'Order notifications disabled on this device.',
  };
}

export async function sendTestOrderPush() {
  const subscription = await getBrowserPushSubscription();
  if (!subscription) {
    return {
      success: false,
      message: 'Enable order notifications on this device first.',
    };
  }

  try {
    const data = await apiRequest('/api/admin/push/test', {
      method: 'POST',
      body: subscriptionToJson(subscription),
    });
    return {
      success: true,
      message: data?.message || 'Test notification sent.',
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Test notification failed.',
    };
  }
}

/**
 * On login / account switch: invalidate a browser subscription that is not
 * registered to the current admin so the previous account cannot keep receiving.
 */
export async function reconcilePushForCurrentAccount() {
  if (!isWebPushSupported()) {
    return { action: 'unsupported' };
  }

  let subscription;
  try {
    subscription = await getBrowserPushSubscription();
  } catch {
    return { action: 'none' };
  }
  if (!subscription) return { action: 'none' };

  try {
    const data = await apiRequest(
      `/api/admin/push/status?endpoint=${encodeURIComponent(subscription.endpoint)}`
    );
    if (data?.enabled) {
      return { action: 'owned' };
    }
  } catch {
    // fall through to local invalidate
  }

  try {
    await subscription.unsubscribe();
  } catch {
    // ignore
  }
  return { action: 'cleared_foreign_or_stale' };
}

/**
 * Logout cleanup: revoke this device on the server while the JWT is still valid,
 * then unsubscribe the browser. Always allows local logout to proceed.
 */
export async function revokePushOnLogout() {
  const result = {
    attempted: false,
    serverRevoked: false,
    browserUnsubscribed: false,
    error: null,
  };

  if (!isWebPushSupported()) {
    return result;
  }

  let subscription = null;
  try {
    subscription = await getBrowserPushSubscription();
  } catch {
    return result;
  }

  if (!subscription) {
    return result;
  }

  result.attempted = true;
  const endpoint = subscription.endpoint;

  try {
    const data = await apiRequest('/api/admin/push/unsubscribe', {
      method: 'POST',
      body: { endpoint },
    });
    result.serverRevoked = Boolean(data?.deleted || data?.success);
    if (!result.serverRevoked) {
      result.error = data?.message || 'Server did not confirm revocation';
    }
  } catch (error) {
    result.serverRevoked = false;
    result.error = error.message || 'Network error during push revoke';
  }

  try {
    const ok = await subscription.unsubscribe();
    result.browserUnsubscribed = Boolean(ok);
  } catch (error) {
    if (!result.error) {
      result.error = error.message || 'Browser unsubscribe failed';
    }
  }

  return result;
}
