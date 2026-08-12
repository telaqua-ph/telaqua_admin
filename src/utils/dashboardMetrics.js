/**
 * Shared dashboard metric → route / filter helpers.
 */

import { fulfillmentListLabel } from './fulfillmentTimeline';

export const DASHBOARD_METRICS = {
  total: {
    title: 'Total Orders',
    to: '/orders',
    filename: 'telaqua-total-orders.csv',
    match: () => true,
  },
  new: {
    title: 'New Orders',
    to: '/orders?metric=new',
    filename: 'telaqua-new-orders.csv',
    match: (o) => {
      const s = String(o.status || '').toLowerCase();
      return s === 'new' || s === 'pending';
    },
  },
  paid: {
    title: 'Paid Orders',
    to: '/orders?payment=Paid',
    filename: 'telaqua-paid-orders.csv',
    match: (o) => String(o.paymentStatus || '').toLowerCase() === 'paid',
  },
  pending_payment: {
    title: 'Pending Payments',
    to: '/orders?payment=Pending',
    filename: 'telaqua-pending-payments.csv',
    match: (o) => String(o.paymentStatus || '').toLowerCase() === 'pending',
  },
  shipments_created: {
    title: 'Shipments Created',
    to: '/fulfillment?metric=shipments_created',
    filename: 'telaqua-shipments-created.csv',
    match: (o) => fulfillmentListLabel(o) !== 'Not Created',
  },
  in_transit: {
    title: 'In Transit',
    to: '/fulfillment?metric=in_transit',
    filename: 'telaqua-in-transit.csv',
    match: (o) => {
      const label = fulfillmentListLabel(o);
      return (
        label === 'In Transit' ||
        label === 'Out for Delivery' ||
        label === 'Picked Up'
      );
    },
  },
  delivered: {
    title: 'Delivered',
    to: '/fulfillment?bucket=delivered',
    filename: 'telaqua-delivered.csv',
    match: (o) => fulfillmentListLabel(o) === 'Delivered',
  },
  ndr: {
    title: 'NDR / Exceptions',
    to: '/fulfillment?bucket=ndr',
    filename: 'telaqua-ndr-exceptions.csv',
    match: (o) => {
      const label = fulfillmentListLabel(o);
      return label === 'NDR / Exceptions' || label === 'Failed';
    },
  },
};

export function filterOrdersByMetric(orders, metricKey) {
  const metric = DASHBOARD_METRICS[metricKey];
  if (!metric) return orders;
  return orders.filter((o) => metric.match(o));
}
