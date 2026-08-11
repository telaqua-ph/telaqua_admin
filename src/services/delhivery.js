/**
 * Delhivery operations via Hostinger backend only.
 * Never call Delhivery directly and never send Delhivery tokens from the browser.
 */

import { apiRequest } from './http';

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

/** GET /api/delhivery/serviceability/:pincode */
export async function checkServiceability(pincode) {
  return apiRequest(`/api/delhivery/serviceability/${pincode}`);
}

/** GET /api/delhivery/tat */
export async function getTat(params) {
  return apiRequest(`/api/delhivery/tat${qs(params)}`);
}

/** GET /api/delhivery/rate */
export async function getRate(params) {
  return apiRequest(`/api/delhivery/rate${qs(params)}`);
}

/** GET /api/delhivery/waybill?count=1 */
export async function getWaybill(count = 1) {
  return apiRequest(`/api/delhivery/waybill${qs({ count })}`);
}

/** POST /api/delhivery/warehouse/create */
export async function createWarehouse(data) {
  return apiRequest('/api/delhivery/warehouse/create', {
    method: 'POST',
    body: data,
  });
}

/**
 * POST /api/delhivery/shipment/create
 * Body: { order_id } or { order_number }
 * Treats HTTP success with success:false as a thrown error so UI can show message.
 */
export async function createShipment(payload) {
  const data = await apiRequest('/api/delhivery/shipment/create', {
    method: 'POST',
    body: payload,
  });

  if (data && data.success === false) {
    const rawMessage =
      data.message ||
      data.error ||
      'Shipment creation failed. Please try again.';
    const error = new Error(rawMessage);
    error.status = 400;
    error.data = data;
    error.rawMessage = rawMessage;
    throw error;
  }

  return data;
}

/** POST /api/delhivery/shipment/update */
export async function updateShipment(data) {
  return apiRequest('/api/delhivery/shipment/update', {
    method: 'POST',
    body: data,
  });
}

/** POST /api/delhivery/tracking */
export async function getTracking(waybill) {
  return apiRequest('/api/delhivery/tracking', {
    method: 'POST',
    body: { waybill },
  });
}

/** POST /api/delhivery/label */
export async function getLabel(waybill) {
  return apiRequest('/api/delhivery/label', {
    method: 'POST',
    body: { waybill },
  });
}

/** POST /api/delhivery/pickup */
export async function requestPickup(data) {
  return apiRequest('/api/delhivery/pickup', {
    method: 'POST',
    body: data,
  });
}

/**
 * POST /api/delhivery/ndr
 * Body: { data: [ { waybill, act, action_data? } ] }
 */
export async function submitNdr(payload) {
  return apiRequest('/api/delhivery/ndr', {
    method: 'POST',
    body: payload,
  });
}
