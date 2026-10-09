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

function isRazorpayFailedOrPending(order) {
  const status = String(order?.paymentStatus || order?.payment_status || '').trim().toLowerCase();
  return !isCodOrder(order) && (status === 'failed' || status === 'pending');
}

function isCancelled(order) {
  if (order?.isCancelled === true || Number(order?.is_cancelled) === 1) return true;
  if (order?.cancelled_at || order?.canceled_at) return true;
  return String(order?.status || order?.orderStatus || order?.order_status || '')
    .toLowerCase() === 'cancelled';
}

// Shipments returning to origin (RTO in transit) or already returned are not
// sales. Canonical fulfillment fields are preferred; raw carrier status is
// included for older/Shipway rows that have not been normalized yet.
function isRtoOrder(order) {
  const statuses = [
    order?.fulfillment_status,
    order?.fulfillmentStatus,
    order?.shipment_status,
    order?.shipmentStatus,
    order?.tracking_status,
    order?.trackingStatus,
  ];
  return statuses.some((value) => {
    const status = String(value || '').trim().toLowerCase();
    return status === 'rto' || status === 'returned' ||
      /(^|[^a-z])rto([^a-z]|$)|return/.test(status);
  });
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
    match: (o) => !isRazorpayFailedOrPending(o),
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
  razorpay_failed_pending: {
    title: 'Razorpay Failed & Pending Orders',
    to: '/orders?metric=razorpay_failed_pending',
    filename: 'telaqua-razorpay-failed-pending-orders.csv',
    match: isRazorpayFailedOrPending,
  },
  cod: {
    title: 'Total COD Orders',
    to: '/orders?paymentMode=COD',
    filename: 'telaqua-cod-orders.csv',
    match: (o) => isCodOrder(o),
  },
  cod_paid: {
    title: 'COD Paid Orders',
    to: '/orders?metric=cod_paid',
    filename: 'telaqua-cod-paid-orders.csv',
    match: (o) =>
      isCodOrder(o) && isPaid(o) && !isRtoOrder(o),
  },
  rto_return: {
    title: 'RTO/Return Orders',
    to: '/orders?metric=rto_return',
    filename: 'telaqua-rto-return-orders.csv',
    // Operational RTO/returns are counted regardless of their payment state.
    // Paid COD RTO/returns remain excluded from the COD Paid metric above.
    match: isRtoOrder,
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
  // Devices Sold = paid only (Razorpay paid + COD marked paid).
  sales_devices: {
    title: 'Devices Sold',
    match: (o) => isConfirmedOrder(o) && !isRtoOrder(o) && isPaid(o),
  },
  // Confirmed COD devices still waiting to be marked paid.
  sales_cod_pending_devices: {
    title: 'COD Payment Pending',
    match: (o) => isConfirmedOrder(o) && !isRtoOrder(o) && isCodOrder(o) && !isPaid(o),
  },
  sales_total_devices: {
    title: 'Total Devices Sold',
    filename: 'telaqua-total-devices-sold.csv',
    match: (o) =>
      DASHBOARD_METRICS.sales_devices.match(o) ||
      DASHBOARD_METRICS.sales_cod_pending_devices.match(o),
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

export function totalDevicesSold(devicesSold, codPendingDevices) {
  return Number(devicesSold ?? 0) + Number(codPendingDevices ?? 0);
}

/** COD devices use the order date. Razorpay devices use the payment date. */
export function isDevicesSoldInDateRange(order, from, to) {
  if (isCodOrder(order)) return isOrderCreatedInDateRange(order, from, to);
  return isOrderPaymentInDateRange(order, from, to);
}
