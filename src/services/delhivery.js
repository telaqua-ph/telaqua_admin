/**
 * Delhivery operations via Hostinger backend only.
 * Never call Delhivery directly and never send Delhivery tokens from the browser.
 */

import { apiRequest } from './http';

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
