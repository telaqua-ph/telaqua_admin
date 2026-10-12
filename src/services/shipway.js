/** Shipway tracking is served by the authenticated Tel-Aqua API, never directly by the browser. */
import { apiRequest } from './http';

export function getShipwayOrderTracking(orderId) {
  return apiRequest(`/api/admin/logistics/shipway/orders/${encodeURIComponent(orderId)}/tracking`);
}

export function refreshShipwayOrderTracking(orderId) {
  return apiRequest(`/api/admin/logistics/shipway/orders/${encodeURIComponent(orderId)}/tracking/refresh`, {
    method: 'POST',
    body: {},
  });
}
