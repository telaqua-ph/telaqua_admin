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
    match: (o) => fulfillmentListLabel(o) === 'Created',
  },
};

export function filterOrdersByMetric(orders, metricKey) {
  const metric = DASHBOARD_METRICS[metricKey];
  if (!metric) return orders;
  return orders.filter((o) => metric.match(o));
}
