/**
 * Shared dashboard metric → route / filter helpers.
 */

import { fulfillmentListLabel } from './fulfillmentTimeline';
import { deriveOrderConfirmationStatus } from './orderConfirmationStatus';
import {
  isOrderCreatedInDateRange,
  isOrderPaymentInDateRange,
} from './orderDateRange';
import { isCodOrder } from './shipmentHelpers';

function isPaid(order) {
  return String(order?.paymentStatus || order?.payment_status || '').toLowerCase() === 'paid';
}

function isPending(order) {
  return String(order?.paymentStatus || order?.payment_status || '').toLowerCase() === 'pending';
}

function isCancelled(order) {
  if (order?.isCancelled === true || Number(order?.is_cancelled) === 1) return true;
  if (order?.cancelled_at || order?.canceled_at) return true;
  return String(order?.status || order?.orderStatus || order?.order_status || '')
    .toLowerCase() === 'cancelled';
}

// Shipments returning to origin (RTO in transit) or already returned are not
// sales. Mirrors the API's Devices Sold filter.
function isRtoOrder(order) {
  const status = String(order?.fulfillment_status || order?.fulfillmentStatus || '')
    .trim()
    .toLowerCase();
  return status === 'rto' || status === 'returned';
}

// Keep sales lists aligned with the dashboard aggregate. A paid payment or a
// shipment event never promotes a New order into Devices Sold.
function isConfirmedOrder(order) {
  return !isCancelled(order) && deriveOrderConfirmationStatus(order) === 'Confirmed';
}

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
      !isCodOrder(o) && isPaid(o),
  },
  pending_payment: {
    title: 'Pending Payments',
    to: '/orders?payment=Pending',
    filename: 'telaqua-pending-payments.csv',
    match: (o) => isPending(o),
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
      isCodOrder(o) && isPaid(o),
  },
  confirmed_cod_payment_pending: {
    title: 'Confirmed COD – Payment Pending',
    to: '/orders?payment=Pending&paymentMode=COD&status=Confirmed',
    filename: 'telaqua-confirmed-cod-payment-pending-orders.csv',
    match: (o) =>
      isCodOrder(o) &&
      deriveOrderConfirmationStatus(o) === 'Confirmed' &&
      isPending(o),
  },
  sales_devices: {
    title: 'Devices Sold',
    match: (o) =>
      isConfirmedOrder(o) &&
      !isRtoOrder(o) &&
      (isCodOrder(o) || (!isCodOrder(o) && isPaid(o))),
  },
  sales_revenue_received: {
    title: 'Revenue Received',
    match: (o) => isPaid(o) && !isCancelled(o),
  },
  sales_pending_revenue: {
    title: 'Pending Revenue',
    match: (o) =>
      isCodOrder(o) && deriveOrderConfirmationStatus(o) === 'Confirmed' && isPending(o),
  },
  shipments_created: {
    title: 'Shipments Created',
    to: '/orders?metric=shipments_created',
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

/** COD devices use the order date. Razorpay devices use the payment date. */
export function isDevicesSoldInDateRange(order, from, to) {
  if (isCodOrder(order)) return isOrderCreatedInDateRange(order, from, to);
  return isOrderPaymentInDateRange(order, from, to);
}
