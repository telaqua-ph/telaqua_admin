// The existing Offline Sold section excludes historical rows moved to Orders.
// Use the entry date, not Purchased On (an offline sale may be entered later).
export const OFFLINE_SOLD_MOVED_BEFORE = Date.parse('2026-11-07T08:23:00.000Z');
const OFFLINE_SOLD_TYPES = new Set(['cod paid-cash', 'cod paid-qr']);

const text = (value) => String(value || '').trim().toLowerCase();

/** Shared membership rule for the Offline Sold list and Orders payment label. */
export function isOfflineSoldOrder(order) {
  const type = text(order?.offline_sold ?? order?.offlineSold);
  if (!OFFLINE_SOLD_TYPES.has(type)) return false;
  const created = Date.parse(order?.created_at ?? order?.createdAt ?? '');
  if (!Number.isFinite(created) || created < OFFLINE_SOLD_MOVED_BEFORE) return false;

  const payment = text(order?.payment_status ?? order?.paymentStatus);
  if (payment !== 'paid') return false;
  const mode = text(order?.payment_mode ?? order?.paymentMode);
  const method = text(order?.payment_method ?? order?.paymentMethod);
  if (mode ? mode !== 'cod' : !['cod', 'cash on delivery', 'cash_on_delivery'].includes(method)) return false;
  const channel = text(order?.order_channel ?? order?.orderChannel);
  if (channel && channel !== 'admin') return false;
  // A verified website COD advance is not an in-person cash/QR sale.
  if (order?.cod_advance_razorpay_payment_id || order?.codAdvancePaymentId) return false;
  return true;
}
