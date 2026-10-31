/**
 * Customer tracking page for an AWB. Shipway shipments use the Tel-Aqua Shipway
 * page; anything else (older Delhivery shipments) keeps the Delhivery page.
 * Mirrors trackingUrlFor() in the backend shipmentTrackingNotificationService.
 */
const SHIPWAY_TRACKING_BASE =
  import.meta.env?.VITE_SHIPWAY_TRACKING_BASE_URL || 'https://telaqua.shipway.com/tracking/forward/';

export function trackingLinkFor(awb, provider) {
  const value = String(awb || '').trim();
  if (!value) return '';
  if (String(provider || '').trim().toLowerCase() === 'shipway') {
    return `${String(SHIPWAY_TRACKING_BASE).replace(/\/+$/, '')}/${encodeURIComponent(value)}/`;
  }
  return `https://www.delhivery.com/track/package/${encodeURIComponent(value)}`;
}
