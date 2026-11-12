import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Load through Vite so API imports use the same environment and resolution as the app.
test('order displays use Purchased On and refresh after a correction without changing entry timestamps', async () => {
  const server = await createServer({
    server: { middlewareMode: true, watch: null, ws: false },
    appType: 'custom',
  });
  try {
    const { normalizeOrder } = await server.ssrLoadModule('/src/services/api.js');
    const raw = {
      id: 1478, created_at: '2026-11-10T10:26:46Z', purchased_on: '2026-08-08',
      payment_status: 'Paid', total_amount: 1499,
    };
    const order = normalizeOrder(raw);
    assert.equal(order.orderedDate, '08 Aug 2026');
    assert.equal(order.date, '08 Aug 2026');
    assert.equal(order.orderedTime, '');
    assert.equal(order.createdAt, raw.created_at);
    assert.equal(order.orderDate, '2026-08-08T00:00:00+05:30');
    assert.equal(order.total, 1499);
    const corrected = normalizeOrder({ ...raw, purchased_on: '2026-09-16' });
    assert.equal(corrected.orderedDate, '16 Sept 2026');
    const ordinary = normalizeOrder({ ...raw, purchased_on: null });
    assert.ok(ordinary.orderedTime);
    assert.equal(ordinary.orderDate, raw.created_at);
  } finally {
    await server.close();
  }
});
