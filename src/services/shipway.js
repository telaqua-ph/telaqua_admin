/** Shipway tracking is served by the authenticated Tel-Aqua API, never directly by the browser. */
import { apiRequest } from './http';

export function getShipwayOrderTracking(orderId) {
  return apiRequest(`/api/admin/logistics/shipway/orders/${encodeURIComponent(orderId)}/tracking`);
}

/** Send (or re-send) the WhatsApp "order shipped" message with the tracking link. */
export function sendShipwayTrackingWhatsApp(orderId) {
  return apiRequest(`/api/admin/logistics/shipway/orders/${encodeURIComponent(orderId)}/tracking/send-whatsapp`, {
    method: 'POST',
    body: {},
  });
}

export function refreshShipwayOrderTracking(orderId) {
  return apiRequest(`/api/admin/logistics/shipway/orders/${encodeURIComponent(orderId)}/tracking/refresh`, {
    method: 'POST',
    body: {},
  });
}
