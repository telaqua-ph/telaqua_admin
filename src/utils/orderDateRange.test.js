import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderCreatedDateInKolkata, orderSaleDateInKolkata, orderPaymentDateInKolkata,
  isOrderSoldInDateRange, isOrderPaymentInDateRange,
} from './orderDateRange.js';
import { periodRevenueReceived, periodDevicesSold } from './dashboardMetrics.js';

const offline = {
  createdAt: '2026-11-10T10:26:46Z', purchasedOn: '2026-08-08',
  paymentDate: '2026-11-10T10:26:46Z', paymentMode: 'COD',
  paymentStatus: 'Paid', status: 'Confirmed', total: 1499, quantity: 1,
};

test('offline sale and payment belong to Purchased On, preserving the entry date', () => {
  assert.equal(orderCreatedDateInKolkata(offline), '2026-11-10');
  assert.equal(orderSaleDateInKolkata(offline), '2026-08-08');
  assert.equal(orderPaymentDateInKolkata(offline), '2026-08-08');
  for (const matches of [isOrderSoldInDateRange, isOrderPaymentInDateRange]) {
    assert.equal(matches(offline, '2026-08-08', '2026-08-08'), true);
    assert.equal(matches(offline, '2026-11-10', '2026-11-10'), false);
  }
  assert.equal(orderSaleDateInKolkata({ purchased_on: '2026-09-16' }), '2026-09-16');
});

test('revenue moves between days when Purchased On is corrected; all-time money stays the same', () => {
  const corrected = { ...offline, purchasedOn: '2026-09-16' };
  assert.equal(periodRevenueReceived([offline], '2026-08-08', '2026-08-08'), 1499);
  assert.equal(periodRevenueReceived([corrected], '2026-08-08', '2026-08-08'), 0);
  assert.equal(periodRevenueReceived([corrected], '2026-09-16', '2026-09-16'), 1499);
  assert.equal(periodRevenueReceived([offline]), periodRevenueReceived([corrected]));
  assert.equal(periodDevicesSold([offline], '2026-08-08', '2026-08-08'), 1);
  assert.equal(periodRevenueReceived([{ ...offline, is_test_order: 1 }]), 0);
  assert.equal(periodRevenueReceived([{ ...offline, paymentStatus: 'Refunded' }]), 0);
});

test('ordinary orders keep their order and payment dates and existing COD advance amounts', () => {
  const ordinary = { ...offline, purchasedOn: null, paymentDate: '2026-11-12T19:00:00Z' };
  assert.equal(orderSaleDateInKolkata(ordinary), '2026-11-10');
  assert.equal(orderPaymentDateInKolkata(ordinary), '2026-11-13');
  assert.equal(periodRevenueReceived([ordinary], '2026-11-10', '2026-11-10'), 1499);
  const partial = { ...offline, cod_advance_status: 'paid', cod_advance_fee: 199, cod_amount_due: 1300 };
  assert.equal(periodRevenueReceived([partial]), 1499);
  assert.equal(periodRevenueReceived([{ ...partial, paymentStatus: 'Pending' }]), 199);
  assert.equal(periodRevenueReceived([{ ...partial, cod_advance_fee: 99, cod_amount_due: 1499 }]), 1598);
});
