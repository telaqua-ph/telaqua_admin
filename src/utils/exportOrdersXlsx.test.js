import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_COLUMNS,
  SHIPWAY_COLUMNS,
  TELAQUA_ONLY_COLUMNS,
  buildDeduplicatedShipwayExport,
} from './exportOrdersXlsx.js';

test('uses the Shipway template first and has no repeated or semantic duplicate fields', () => {
  assert.deepEqual(FINAL_COLUMNS.slice(0, SHIPWAY_COLUMNS.length), SHIPWAY_COLUMNS);
  assert.equal(new Set(FINAL_COLUMNS).size, FINAL_COLUMNS.length);
  for (const duplicate of [
    'Phone', 'Email', 'City', 'State', 'Pincode', 'Product', 'Quantity',
    'Amount', 'Payment Method', 'Order Date', 'Ordered At', 'Order Time',
    'Shipping Address', 'Customer', 'Order Number',
  ]) {
    assert.equal(TELAQUA_ONLY_COLUMNS.includes(duplicate), false, `${duplicate} is represented by Shipway`);
  }
});

test('merges Tel-Aqua order data into its canonical Shipway fields', () => {
  const { columns, rows } = buildDeduplicatedShipwayExport([{
    id: 42,
    orderNumber: 'TAQ-000042',
    customerName: 'Ada Lovelace',
    phone: '6302862346',
    email: 'ada@example.com',
    address: '1 Computing Lane',
    city: 'Hyderabad', state: 'Telangana', pincode: '500001',
    product: 'Tel-Aqua PH02', quantity: 2, unitPrice: 1799, total: 3598,
    paymentMode: 'Razorpay', paymentStatus: 'Paid', createdAt: '2026-10-08 07:00:00',
  }]);
  assert.equal(rows[0]['*Order ID'], 'TAQ-000042');
  assert.equal(rows[0]['Internal Order ID'], 42);
  assert.equal(rows[0]['*Shipping:Phone'], '6302862346');
  assert.equal(rows[0]['*Shipping:Email'], 'ada@example.com');
  assert.equal(rows[0]['*Product Name'], 'Tel-Aqua PH02');
  assert.equal(rows[0]['*Product Quantity'], 2);
  assert.equal(rows[0]['*Order Total Amount'], 3598);
  assert.equal(rows[0]['*Payment Type'], 'P');
  assert.equal(rows[0]['*Order Date'], '2026-10-08 07:00:00');
  assert.equal(columns.length, 40);
});
