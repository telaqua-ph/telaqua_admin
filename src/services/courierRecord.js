/** Save the courier + article/AWB number for an order booked outside the admin. */
import { apiRequest } from './http';

/** body: { courier: 'indiapost' | 'shipway' | 'delhivery', number: string, courier_name?: string, notify?: boolean } */
export function recordOrderCourier(orderId, body) {
  return apiRequest(`/api/admin/logistics/orders/${encodeURIComponent(orderId)}/courier-record`, {
    method: 'POST',
    body: body || {},
  });
}

/** True when the order has a saved shipment / courier record. */
export function hasCourierRecord(order) {
  return Boolean(order?.shipmentRecordId || order?.waybill);
}
