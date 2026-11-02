/** India Post shipments are booked and tracked through the authenticated Tel-Aqua API. */
import { apiRequest } from './http';

const base = (orderId) => `/api/admin/logistics/indiapost/orders/${encodeURIComponent(orderId)}`;

export function getIndiaPostStatus() {
  return apiRequest('/api/admin/logistics/indiapost/status');
}

/** body: { manual?: boolean, barcode?: string, weight_grams?: number } */
export function createIndiaPostShipment(orderId, body) {
  return apiRequest(`${base(orderId)}/shipment`, { method: 'POST', body: body || {} });
}

export function getIndiaPostOrderTracking(orderId) {
  return apiRequest(`${base(orderId)}/tracking`);
}

export function refreshIndiaPostOrderTracking(orderId) {
  return apiRequest(`${base(orderId)}/tracking/refresh`, { method: 'POST', body: {} });
}

export function sendIndiaPostTrackingWhatsApp(orderId) {
  return apiRequest(`${base(orderId)}/tracking/send-whatsapp`, { method: 'POST', body: {} });
}
