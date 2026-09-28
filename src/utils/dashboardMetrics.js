/**
 * Shared dashboard metric → route / filter helpers.
 */

import { fulfillmentListLabel } from './fulfillmentTimeline';
import { deriveOrderConfirmationStatus } from './orderConfirmationStatus';
import { isCodOrder } from './shipmentHelpers';

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
  razorpay_paid: {
    title: 'Razorpay Paid Orders',
    to: '/orders?payment=Paid&paymentMode=Razorpay',
    filename: 'telaqua-razorpay-paid-orders.csv',
    match: (o) =>
      !isCodOrder(o) && String(o.paymentStatus || o.payment_status || '').toLowerCase() === 'paid',
  },
  pending_payment: {
    title: 'Pending Payments',
    to: '/orders?payment=Pending',
    filename: 'telaqua-pending-payments.csv',
    match: (o) => String(o.paymentStatus || '').toLowerCase() === 'pending',
  },
  cod: {
    title: 'Total COD Orders',
    to: '/orders?paymentMode=COD',
    filename: 'telaqua-cod-orders.csv',
    match: (o) => isCodOrder(o),
  },
  cod_paid: {
    title: 'COD Paid Orders',
    to: '/orders?payment=Paid&paymentMode=COD',
    filename: 'telaqua-cod-paid-orders.csv',
    match: (o) =>
      isCodOrder(o) && String(o.paymentStatus || o.payment_status || '').toLowerCase() === 'paid',
  },
  confirmed_cod_payment_pending: {
    title: 'Confirmed COD – Payment Pending',
    to: '/orders?payment=Pending&paymentMode=COD&status=Confirmed',
    filename: 'telaqua-confirmed-cod-payment-pending-orders.csv',
    match: (o) =>
      isCodOrder(o) &&
      deriveOrderConfirmationStatus(o) === 'Confirmed' &&
      String(o.paymentStatus || o.payment_status || '').toLowerCase() === 'pending',
  },
  shipments_created: {
    title: 'Shipments Created',
    to: '/fulfillment?metric=shipments_created',
    filename: 'telaqua-shipments-created.csv',
    match: (o) => fulfillmentListLabel(o) === 'Created',
  },
  cancelled: {
    title: 'Cancelled Orders',
    to: '/orders?status=Cancelled',
    filename: 'telaqua-cancelled-orders.csv',
    match: (o) => {
      const s = String(o.status || o.orderStatus || o.order_status || '').toLowerCase();
      return s === 'cancelled';
    },
  },
};

export function filterOrdersByMetric(orders, metricKey) {
  const metric = DASHBOARD_METRICS[metricKey];
  if (!metric) return orders;
  return orders.filter((o) => metric.match(o));
}
