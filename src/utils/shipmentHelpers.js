/** Shipment / fulfillment helpers for UI gating */

export function hasWaybill(order) {
  return Boolean(order?.waybill);
}

export function isShipmentCreated(order) {
  const status = String(order?.shipmentStatus || '').toLowerCase();
  return hasWaybill(order) || (status && status !== 'not created');
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

export function looksLikeNdr(order) {
  const ship = String(order?.shipmentStatus || '').toLowerCase();
  const track = String(order?.trackingStatus || '').toLowerCase();
  return (
    hasWaybill(order) &&
    (ship.includes('ndr') ||
      track.includes('ndr') ||
      track.includes('undelivered') ||
      track.includes('failed delivery') ||
      track.includes('exception'))
  );
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
