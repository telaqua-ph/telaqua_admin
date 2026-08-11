/**
 * Shipment timeline + list labels driven ONLY by real order DB fields.
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

function isPaid(paymentStatus) {
  return lower(paymentStatus) === 'paid';
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

function isShipmentFailed(order) {
  const s = lower(order?.shipmentStatus);
  if (s.includes('fail') || s === 'error' || s.includes('error')) return true;
  return hasNonEmpty(order?.shipmentError) && !hasNonEmpty(order?.waybill);
}

function isPickupRequested(pickupStatus, pickupRequestedAt) {
  const p = lower(pickupStatus);
  if (!p || p === 'not requested' || p.startsWith('not ')) return false;
  if (!hasNonEmpty(pickupRequestedAt)) return false;
  return (
    p === 'requested' ||
    p === 'confirmed' ||
    p === 'successful' ||
    p === 'success' ||
    p === 'pickup requested'
  );
}

function trackingMatches(trackingStatus, patterns) {
  const t = lower(trackingStatus);
  if (!t) return false;
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(t);
    return t === pattern || t.includes(pattern);
  });
}

export function extractTrackingEvents(payload) {
  if (!payload || typeof payload !== 'object') return [];

  const pools = [];
  const pushArray = (arr) => {
    if (Array.isArray(arr)) pools.push(arr);
  };

  pushArray(payload.scans);
  pushArray(payload.events);
  pushArray(payload.tracking);
  pushArray(payload.data?.scans);
  pushArray(payload.data?.events);
  pushArray(payload.data?.tracking);
  pushArray(payload.ShipmentData?.[0]?.Shipment?.Scans);
  pushArray(payload.data?.ShipmentData?.[0]?.Shipment?.Scans);

  const events = [];
  pools.forEach((list) => {
    list.forEach((item) => {
      const detail = item?.ScanDetail || item?.scanDetail || item;
      const label =
        detail?.Scan ||
        detail?.Status ||
        detail?.status ||
        detail?.Instructions ||
        detail?.statusCode ||
        detail?.ScanType ||
        null;
      const at =
        detail?.ScanDateTime ||
        detail?.StatusDateTime ||
        detail?.statusDateTime ||
        detail?.date ||
        detail?.time ||
        null;
      if (label) {
        events.push({
          label: String(label),
          at: at ? String(at) : '',
        });
      }
    });
  });

  return events;
}

export function buildFulfillmentTimeline(order) {
  if (!order) return [];

  const track = lower(order.trackingStatus);
  const shipmentFailed = isShipmentFailed(order);

  const shipmentCreated =
    (isShipmentCreatedSuccess(order.shipmentStatus) &&
      hasNonEmpty(order.shipmentCreatedAt)) ||
    (hasNonEmpty(order.waybill) && hasNonEmpty(order.shipmentCreatedAt)) ||
    (hasNonEmpty(order.delhiveryShipmentId) &&
      hasNonEmpty(order.shipmentCreatedAt));

  const awbAssigned = hasNonEmpty(order.waybill);
  const labelGenerated = hasNonEmpty(order.labelData);
  const pickupRequested = isPickupRequested(
    order.pickupStatus,
    order.pickupRequestedAt
  );

  const pickedUp = trackingMatches(track, [
    'picked up',
    'pickup done',
    'dispatched',
  ]);
  const inTransit = trackingMatches(track, [
    'in transit',
    'transit',
    'in-transit',
    'reached at',
    'arrived at',
  ]);
  const outForDelivery = trackingMatches(track, [
    'out for delivery',
    'out for dlv',
    /\bofd\b/,
  ]);
  const delivered = trackingMatches(track, ['delivered', /^dlvd$/]);

  const stages = [
    {
      id: 'placed',
      label: 'Order Placed',
      done: true,
      at: order.date || '',
    },
    {
      id: 'payment',
      label: 'Payment Confirmed',
      done: isPaid(order.paymentStatus),
      at: isPaid(order.paymentStatus) ? 'Paid' : '',
    },
    {
      id: 'shipment',
      label: 'Shipment Created',
      done: shipmentCreated,
      failed: shipmentFailed && !shipmentCreated,
      at:
        shipmentCreated && order.shipmentCreatedAtLabel !== '—'
          ? order.shipmentCreatedAtLabel
          : '',
    },
    {
      id: 'awb',
      label: 'AWB Assigned',
      done: awbAssigned,
      at: awbAssigned ? String(order.waybill) : '',
    },
    {
      id: 'label',
      label: 'Label Generated',
      done: labelGenerated,
      at: labelGenerated ? 'Available' : '',
    },
    {
      id: 'pickup_req',
      label: 'Pickup Requested',
      done: pickupRequested,
      at:
        pickupRequested && order.pickupRequestedAtLabel !== '—'
          ? order.pickupRequestedAtLabel
          : '',
    },
    {
      id: 'picked',
      label: 'Picked Up',
      done: pickedUp || delivered || outForDelivery || inTransit,
      at: pickedUp ? order.trackingStatus : '',
    },
    {
      id: 'transit',
      label: 'In Transit',
      done: inTransit || outForDelivery || delivered,
      at: inTransit ? order.trackingStatus : '',
    },
    {
      id: 'ofd',
      label: 'Out for Delivery',
      done: outForDelivery || delivered,
      at: outForDelivery ? order.trackingStatus : '',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      done: delivered,
      at:
        delivered && order.trackingUpdatedAtLabel !== '—'
          ? order.trackingUpdatedAtLabel
          : delivered
            ? order.trackingStatus
            : '',
    },
  ];

  let currentSet = false;
  return stages.map((stage) => {
    const failed = Boolean(stage.failed);
    const done = Boolean(stage.done) && !failed;
    let current = false;
    if (!currentSet && !done && !failed) {
      current = true;
      currentSet = true;
    }
    return { ...stage, done, failed, current };
  });
}

/** Display label for Orders / Fulfillment tables — DB-driven only. */
export function fulfillmentListLabel(order) {
  if (!order) return 'Not Created';

  const ship = lower(order.shipmentStatus);
  const track = lower(order.trackingStatus);

  if (trackingMatches(track, ['delivered', /^dlvd$/])) return 'Delivered';
  if (track.includes('ndr') || ship.includes('ndr')) return 'NDR / Exceptions';
  if (
    track.includes('exception') ||
    ship.includes('fail') ||
    ship.includes('error') ||
    (hasNonEmpty(order.shipmentError) && !hasNonEmpty(order.waybill))
  ) {
    return 'Failed';
  }
  if (trackingMatches(track, ['out for delivery', /\bofd\b/])) {
    return 'Out for Delivery';
  }
  if (trackingMatches(track, ['in transit', 'transit'])) return 'In Transit';
  if (trackingMatches(track, ['picked up', 'pickup done'])) return 'Picked Up';
  if (isPickupRequested(order.pickupStatus, order.pickupRequestedAt)) {
    return 'Pickup Requested';
  }
  if (hasNonEmpty(order.labelData)) return 'Label Generated';
  if (hasNonEmpty(order.waybill) || isShipmentCreatedSuccess(ship)) {
    return 'Shipment Created';
  }
  return 'Not Created';
}

export function matchesFulfillmentBucket(order, bucket) {
  if (bucket === 'all') return true;
  const label = fulfillmentListLabel(order);
  const map = {
    not_created: 'Not Created',
    created: 'Shipment Created',
    label: 'Label Generated',
    pickup: 'Pickup Requested',
    transit: 'In Transit',
    ofd: 'Out for Delivery',
    delivered: 'Delivered',
    ndr: 'NDR / Exceptions',
    failed: 'Failed',
  };
  if (bucket === 'ndr') {
    return label === 'NDR / Exceptions' || label === 'Failed';
  }
  return label === map[bucket];
}
