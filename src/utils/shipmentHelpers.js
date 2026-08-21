/** Shipment / fulfillment helpers for UI gating */

/** Optional secondary link only — not the primary post-create workflow. */
export const DELHIVERY_ONE_URL = 'https://one.delhivery.com';
export const DELHIVERY_HANDOFF_MESSAGE =
  'Manage serviceability, labels, pickup, tracking, and delivery exceptions from Tel-Aqua Admin.';

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

/** Tel-Aqua "shipment created" — waybill, Delhivery id, or created status. */
export function isShipmentCreated(order) {
  if (!order) return false;
  return (
    hasStoredDelhiveryShipmentId(order) ||
    isCreatedShipmentStatus(order) ||
    ['shipment_created', 'pickup_requested', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'ndr', 'returned']
      .includes(String(order?.fulfillmentStatus || order?.fulfillment_status || '').toLowerCase())
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
  return pay === 'paid';
}

export function looksLikeNdr(order) {
  const ship = String(order?.shipmentStatus || '').toLowerCase();
  const track = String(order?.trackingStatus || '').toLowerCase();
  const fulfillment = String(order?.fulfillmentStatus || order?.fulfillment_status || '').toLowerCase();
  return (
    hasWaybill(order) &&
    (fulfillment === 'ndr' ||
      ship.includes('ndr') ||
      track.includes('ndr') ||
      track.includes('undelivered') ||
      track.includes('failed delivery') ||
      track.includes('exception'))
  );
}

/** Prefer real Delhivery NDR/exception text — never invent reasons. */
export function extractNdrReason(order, trackingPayload) {
  const fromOrder = String(order?.trackingStatus || '').trim();
  if (
    fromOrder &&
    /ndr|undeliver|exception|failed delivery/i.test(fromOrder)
  ) {
    return fromOrder;
  }

  const data = trackingPayload?.data || trackingPayload;
  const shipment = Array.isArray(data?.ShipmentData)
    ? data.ShipmentData[0]
    : null;
  const details = shipment?.Shipment || shipment?.shipment || shipment || {};
  const statusObj = details.Status || {};
  const candidates = [
    statusObj.Instructions,
    statusObj.StatusLocation,
    statusObj.Status,
    details.Remarks,
    details.remarks,
    details.Status,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function normalizeLabelCandidate(value) {
  if (value == null) return null;
  if (typeof value === 'object') {
    return (
      value.url ||
      value.label_url ||
      value.pdf_url ||
      value.pdf ||
      value.download_url ||
      null
    );
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }
  // Raw base64 PDF from backend — wrap as data URL for view/download
  if (/^JVBER/i.test(trimmed) || (trimmed.length > 200 && !trimmed.includes(' '))) {
    return `data:application/pdf;base64,${trimmed}`;
  }
  return null;
}

export function extractLabelUrl(labelResponse, existingLabelData) {
  const candidates = [
    labelResponse?.url,
    labelResponse?.label_url,
    labelResponse?.pdf_url,
    labelResponse?.download_url,
    labelResponse?.data?.url,
    labelResponse?.data?.label_url,
    labelResponse?.data?.pdf_url,
    labelResponse?.label,
    labelResponse?.packages?.[0]?.pdf_download,
    labelResponse?.packages?.[0]?.pdf_download_link,
    typeof labelResponse?.data === 'string' ? labelResponse.data : null,
    existingLabelData,
  ];

  for (const value of candidates) {
    const url = normalizeLabelCandidate(value);
    if (url) return url;
  }
  return null;
}

/** Open or trigger download for a label URL / data URI. */
export function openLabelAsset(url, { download = false, filename = 'shipping-label.pdf' } = {}) {
  if (!url) return;
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
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
