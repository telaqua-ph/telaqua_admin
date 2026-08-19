/**
 * Shipment list labels for Tel-Aqua admin (Created / Not Created / Failed).
 * These are NOT Delhivery One states (Ready to Ship, Ready for Pickup, etc.).
 */

import { isShipmentCreated } from './shipmentHelpers';

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

/** Display label for Orders / Fulfillment tables — Created vs Not Created. */
export function fulfillmentListLabel(order) {
  if (!order) return 'Not Created';

  const ship = lower(order.shipmentStatus);

  if (
    ship.includes('fail') ||
    ship.includes('error') ||
    (hasNonEmpty(order.shipmentError) && !isShipmentCreated(order))
  ) {
    return 'Failed';
  }
  if (isShipmentCreated(order)) {
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
