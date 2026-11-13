import test from 'node:test';
import assert from 'node:assert/strict';
import { isOfflineSoldOrder, OFFLINE_SOLD_MOVED_BEFORE } from './offlineSold.js';

const offline = {
  offline_sold: 'COD Paid-Cash', created_at: '2026-11-10T10:26:46Z',
  purchased_on: '2026-08-08', payment_status: 'Paid', payment_method: 'cod',
  payment_mode: 'cod', order_channel: 'admin',
};

test('explicit cash and QR sales belong to Offline Sold even when purchased earlier', () => {
  assert.equal(isOfflineSoldOrder(offline), true);
  assert.equal(isOfflineSoldOrder({ ...offline, offline_sold: 'COD Paid-QR' }), true);
  assert.equal(isOfflineSoldOrder({
    offlineSold: 'COD Paid-QR', createdAt: offline.created_at,
    paymentStatus: 'Paid', paymentMode: 'COD', orderChannel: 'admin',
  }), true);
});

test('historical paid COD records do not become Offline Sold from a legacy marker', () => {
  for (const id of [375, 376, 377, 378, 369, 371]) {
    assert.equal(isOfflineSoldOrder({ ...offline, id, created_at: '2026-08-25T05:18:47Z' }), false);
  }
  assert.equal(isOfflineSoldOrder({ ...offline, created_at: new Date(OFFLINE_SOLD_MOVED_BEFORE - 1).toISOString() }), false);
  assert.equal(isOfflineSoldOrder({ ...offline, created_at: new Date(OFFLINE_SOLD_MOVED_BEFORE).toISOString() }), true);
});

test('normal COD, unpaid, online and conflicting source records are not offline sales', () => {
  for (const patch of [
    { offline_sold: null }, { offline_sold: 'COD Pending' },
    { payment_status: 'Pending' }, { payment_status: 'Refunded' },
    { payment_mode: 'razorpay' }, { order_channel: 'website' },
    { cod_advance_razorpay_payment_id: 'pay_cod_advance' },
    { created_at: null }, { created_at: 'invalid' },
  ]) {
    assert.equal(isOfflineSoldOrder({ ...offline, ...patch }), false, JSON.stringify(patch));
  }
});

test('classification leaves the backend payment and order record unchanged', () => {
  const row = { ...offline };
  isOfflineSoldOrder(row);
  assert.deepEqual(row, offline);
});
