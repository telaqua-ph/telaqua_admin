/**
 * Client-side mirror of the backend delivery-details rules
 * (telaqua_mysql_backend/services/orderDeliveryDetails.js). Used for
 * instant form feedback only — the API remains authoritative.
 */

export const DELIVERY_FIELDS = ['customer_name', 'phone', 'address', 'city', 'state', 'pincode'];

export const DELIVERY_FIELD_LABELS = {
  customer_name: 'Recipient name',
  phone: 'Mobile number',
  address: 'Address',
  city: 'City / locality',
  state: 'State',
  pincode: 'PIN code',
};

/** Fields Delhivery's shipment edit API cannot change once an AWB is manifested. */
export const COURIER_LOCKED_FIELDS = ['city', 'state', 'pincode'];

const AWAITING_PICKUP = new Set([
  'unfulfilled',
  'ready_to_ship',
  'shipment_created',
  'pickup_requested',
  'pickup_failed',
]);
const CLOSED = new Set(['delivered', 'cancelled', 'canceled', 'returned']);

export function deliveryEditStage(order) {
  if (!order) return 'not_created';
  const status = String(order.status || '').trim().toLowerCase();
  const fulfillment = String(order.fulfillmentStatus || 'unfulfilled').trim().toLowerCase();
  const manifested = Boolean(order.shipmentCreatedAt || order.delhiveryShipmentId);
  if (status === 'cancelled' || status === 'delivered' || CLOSED.has(fulfillment)) return 'closed';
  if (!manifested) return 'not_created';
  if (AWAITING_PICKUP.has(fulfillment)) return 'awaiting_pickup';
  return 'in_transit';
}

export function deliveryFormFromOrder(order) {
  return {
    customer_name: order?.customerName || '',
    phone: order?.phone || '',
    address: order?.address || '',
    city: order?.city || '',
    state: order?.state || '',
    pincode: order?.pincode || '',
  };
}

function normalizePhone(raw) {
  const text = String(raw || '').trim();
  if (!/^[\d\s+()-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function validateDeliveryForm(form) {
  const errors = {};
  const value = (field) => String(form[field] ?? '').replace(/\s+/g, ' ').trim();

  DELIVERY_FIELDS.forEach((field) => {
    if (!value(field)) errors[field] = `${DELIVERY_FIELD_LABELS[field]} is required.`;
  });
  if (!errors.customer_name && value('customer_name').length < 2) {
    errors.customer_name = 'Recipient name must be at least 2 characters.';
  }
  if (!errors.address && value('address').length < 5) {
    errors.address = 'Address looks incomplete — include house/street and area.';
  }
  if (!errors.address && value('address').length > 500) {
    errors.address = 'Address must be at most 500 characters.';
  }
  if (!errors.phone && !normalizePhone(form.phone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number (starting with 6–9).';
  }
  if (!errors.pincode && !/^[1-9]\d{5}$/.test(String(form.pincode || '').replace(/\s+/g, ''))) {
    errors.pincode = 'PIN code must be exactly 6 digits (and cannot start with 0).';
  }
  return errors;
}

export function deliveryFormChanged(order, form) {
  const initial = deliveryFormFromOrder(order);
  const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  return DELIVERY_FIELDS.filter((field) => norm(initial[field]) !== norm(form[field]));
}
