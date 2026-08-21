/** Delhivery calls are always proxied through the authenticated Tel-Aqua API. */
import { apiRequest } from './http';

function params(values = {}) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const getWarehouse = () => apiRequest('/api/admin/logistics/warehouse');
export const createWarehouse = (body = {}) => apiRequest('/api/admin/logistics/warehouse', { method: 'POST', body });

export function checkServiceability(pincode, extras = {}) {
  return apiRequest(`/api/admin/logistics/serviceability/${encodeURIComponent(pincode)}${params(extras)}`);
}

export function getTat(body) {
  return apiRequest('/api/admin/logistics/tat', { method: 'POST', body });
}

export function getRate(body) {
  return apiRequest('/api/admin/logistics/rate', { method: 'POST', body });
}

export function getOrderLogistics(orderId) {
  return apiRequest(`/api/admin/logistics/orders/${orderId}`);
}

export function getShipmentDetails(shipmentId) {
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}`);
}

export function getWaybill(orderOrCount = 1) {
  const orderId = typeof orderOrCount === 'object'
    ? orderOrCount.order_id || orderOrCount.orderId
    : orderOrCount;
  return apiRequest('/api/admin/logistics/waybill', { method: 'POST', body: { order_id: orderId } });
}

export async function createShipment(payload) {
  const orderId = payload?.order_id || payload?.orderId;
  let logistics = await getOrderLogistics(orderId);
  if (!logistics?.shipment?.waybill_number) {
    await getWaybill({ order_id: orderId });
    logistics = await getOrderLogistics(orderId);
  }
  return apiRequest(`/api/admin/logistics/orders/${orderId}/shipment`, { method: 'POST', body: {} });
}

async function resolveShipmentId(extras = {}) {
  if (extras.shipment_id || extras.shipmentId) return extras.shipment_id || extras.shipmentId;
  const orderId = extras.order_id || extras.orderId;
  if (!orderId) throw new Error('Shipment or order id is required.');
  const logistics = await getOrderLogistics(orderId);
  const id = logistics?.shipment?.id;
  if (!id) throw new Error('Shipment has not been created for this order.');
  return id;
}

export async function updateShipment(data) {
  const shipmentId = await resolveShipmentId(data);
  const body = Object.fromEntries(Object.entries(data).filter(([key]) => !['shipment_id', 'shipmentId', 'order_id', 'orderId', 'waybill'].includes(key)));
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}`, { method: 'PUT', body });
}

export async function getTracking(_waybill, extras = {}) {
  const shipmentId = await resolveShipmentId(extras);
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/track`, { method: 'POST', body: {} });
}

export async function getTrackingHistory(extras = {}) {
  const shipmentId = await resolveShipmentId(extras);
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/tracking`);
}

export async function getLabel(_waybill, extras = {}) {
  const shipmentId = await resolveShipmentId(extras);
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/label`);
}

export async function requestPickup(data) {
  const shipmentId = await resolveShipmentId(data);
  const body = Object.fromEntries(Object.entries(data).filter(([key]) => !['shipment_id', 'shipmentId', 'order_id', 'orderId', 'waybill'].includes(key)));
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/pickup`, { method: 'POST', body });
}

export async function getNdr(extras = {}) {
  const shipmentId = await resolveShipmentId(extras);
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/ndr`);
}

export async function submitNdr(payload) {
  const shipmentId = await resolveShipmentId(payload);
  const first = Array.isArray(payload.data) ? payload.data[0] : payload;
  return apiRequest(`/api/admin/logistics/shipments/${shipmentId}/ndr`, {
    method: 'POST', body: { act: first.act, action_data: first.action_data },
  });
}

export function refreshActiveTracking(limit = 20) {
  return apiRequest('/api/admin/logistics/shipments/track-active', { method: 'POST', body: { limit } });
}
