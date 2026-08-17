/** Shipment helpers for Send to Delhivery gating */

export function hasWaybill(order) {
  return Boolean(order?.waybill);
}

export function isShipmentCreated(order) {
  return hasWaybill(order);
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
