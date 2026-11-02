/**
 * Customer tracking page for an AWB. Shipway shipments use the Tel-Aqua Shipway
 * page; anything else (older Delhivery shipments) keeps the Delhivery page.
 * Mirrors trackingUrlFor() in the backend shipmentTrackingNotificationService.
 */
const SHIPWAY_TRACKING_BASE =
  import.meta.env?.VITE_SHIPWAY_TRACKING_BASE_URL || 'https://telaqua.shipway.com/tracking/forward/';

const isIndiaPost = (provider) => String(provider || '').trim().toLowerCase().replace(/[\s_-]/g, '') === 'indiapost';

export function trackingLinkFor(awb, provider) {
  const value = String(awb || '').trim();
  if (!value) return '';
  // India Post has no public deep link; our backend /t/<article> page shows its live tracking.
  if (isIndiaPost(provider)) {
    const apiBase = String(import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
    return apiBase ? `${apiBase}/t/${encodeURIComponent(value)}` : '';
  }
  if (String(provider || '').trim().toLowerCase() === 'shipway') {
    return `${String(SHIPWAY_TRACKING_BASE).replace(/\/+$/, '')}/${encodeURIComponent(value)}/`;
  }
  return `https://www.delhivery.com/track/package/${encodeURIComponent(value)}`;
}
