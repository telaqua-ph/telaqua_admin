/** Shipment helpers for Send to Delhivery gating */

export const DELHIVERY_ONE_URL = 'https://one.delhivery.com';

export const DELHIVERY_HANDOFF_TITLE = 'Shipment Created — Continue in Delhivery One';

export const DELHIVERY_HANDOFF_MESSAGE =
  'Shipment created successfully. Delhivery has assigned an AWB and the order appears under Ready to Ship in Delhivery One. Pickup, labels, and delivery are managed in Delhivery One — not in Tel-Aqua.';

export function hasWaybill(order) {
  return Boolean(String(order?.waybill || '').trim());
}

function hasStoredDelhiveryShipmentId(order) {
  return Boolean(
    String(order?.delhiveryShipmentId || order?.delhivery_shipment_id || '').trim()
  );
}

function isCreatedShipmentStatus(order) {
  const status = String(order?.shipmentStatus || order?.shipment_status || '')
    .toLowerCase()
    .trim();
  if (!status || status === 'not created' || status.startsWith('not ')) {
    return false;
  }
  if (status.includes('fail') || status.includes('error')) {
    return false;
  }
  return status === 'created' || status.includes('created');
}

/** Tel-Aqua "shipment created" — not Delhivery Ready for Pickup. */
export function isShipmentCreated(order) {
  if (!order) return false;
  return (
    hasWaybill(order) ||
    hasStoredDelhiveryShipmentId(order) ||
    isCreatedShipmentStatus(order)
  );
}

export function formatAwbDisplay(order) {
  if (hasWaybill(order)) return String(order.waybill).trim();
  if (isShipmentCreated(order)) return 'AWB Pending';
  return '—';
}

export function canCreateShipment(order) {
  if (!order) return false;
  if (isShipmentCreated(order)) return false;

  const pay = String(order.paymentStatus || '').toLowerCase();
  const method = String(order.paymentMethod || '').toLowerCase();
  const isCod =
    method.includes('cod') || method.includes('cash on delivery');

  // Block unpaid online payments; allow COD / already paid.
  if (!isCod && (pay === 'pending' || pay === 'failed')) {
    return false;
  }
  return true;
}

export function extractWaybillFromResponse(response) {
  return (
    response?.waybill ||
    response?.awb ||
    response?.AWB ||
    response?.data?.waybill ||
    response?.data?.awb ||
    response?.shipment?.waybill ||
    response?.packages?.[0]?.waybill ||
    ''
  );
}
