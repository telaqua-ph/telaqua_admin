import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOrdersByMetric } from './dashboardMetrics.js';

const eligibleOrder = (overrides = {}) => ({
  id: 1,
  paymentMode: 'COD',
  paymentStatus: 'Pending',
  order_status: 'Confirmed',
  shipmentStatus: 'Unfulfilled',
  ...overrides,
});

function confirmedCodPendingIds(orders) {
  return filterOrdersByMetric(orders, 'confirmed_cod_payment_pending').map((order) => order.id);
}

test('Confirmed COD – Payment Pending directly excludes cancelled and RTO/return orders', () => {
  const orders = [
    eligibleOrder({ id: 1 }), // normal shipment: included
    eligibleOrder({ id: 2, fulfillmentStatus: 'rto' }), // RTO: excluded
    eligibleOrder({ id: 3, shipmentStatus: 'Return to Origin' }), // return: excluded
    eligibleOrder({ id: 4, order_status: 'Cancelled' }), // cancelled: excluded
    eligibleOrder({ id: 5, isCancelled: true, fulfillmentStatus: 'rto' }), // both: excluded once
    eligibleOrder({ id: 6, paymentMode: 'Razorpay' }), // not COD: excluded
    eligibleOrder({ id: 7, paymentStatus: 'Paid' }), // not pending: excluded
    eligibleOrder({ id: 8, shipmentStatus: '' }), // no shipment: included
    eligibleOrder({ id: 9, shipmentStatus: 'RTO In-Transit' }), // raw carrier RTO: excluded
    eligibleOrder({ id: 10, fulfillmentStatus: 'returned' }), // normalized returned: excluded
  ];

  assert.deepEqual(confirmedCodPendingIds(orders), [1, 8]);
});

test('Confirmed COD – Payment Pending counts each qualifying order once', () => {
  const orders = [
    eligibleOrder({ id: 11 }),
    eligibleOrder({ id: 12, shipmentStatus: 'RTO In-Transit' }),
    eligibleOrder({ id: 13, fulfillmentStatus: 'returned' }),
  ];

  assert.deepEqual(confirmedCodPendingIds(orders), [11]);
});
