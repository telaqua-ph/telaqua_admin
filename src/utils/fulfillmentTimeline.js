/**
 * Shipment list labels driven by AWB / shipment_status on the order row.
 */

function lower(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
}

function hasNonEmpty(value) {
  if (value == null) return false;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 && t !== '—' && t.toLowerCase() !== 'null';
  }
  return true;
}

function isShipmentCreatedSuccess(shipmentStatus) {
  const s = lower(shipmentStatus);
  if (!s || s === 'not created' || s.startsWith('not ')) return false;
  if (s.includes('fail') || s.includes('error')) return false;
  return (
    s === 'created' ||
    s === 'success' ||
    s === 'successful' ||
    s === 'confirmed' ||
    s.includes('created')
  );
}

/** Display label for Orders / Fulfillment tables — Created vs Not Created. */
export function fulfillmentListLabel(order) {
  if (!order) return 'Not Created';

  const ship = lower(order.shipmentStatus);

  if (
    ship.includes('fail') ||
    ship.includes('error') ||
    (hasNonEmpty(order.shipmentError) && !hasNonEmpty(order.waybill))
  ) {
    return 'Failed';
  }
  if (hasNonEmpty(order.waybill) || isShipmentCreatedSuccess(ship)) {
    return 'Created';
  }
  return 'Not Created';
}

export function matchesFulfillmentBucket(order, bucket) {
  if (bucket === 'all') return true;
  const label = fulfillmentListLabel(order);
  const map = {
    not_created: 'Not Created',
    created: 'Created',
    failed: 'Failed',
  };
  return label === map[bucket];
}
