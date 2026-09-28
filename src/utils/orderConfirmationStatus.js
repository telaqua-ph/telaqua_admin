const CONFIRMED_ORDER_STATUSES = new Set([
  'confirmed', 'processing', 'ready to ship', 'ready_to_ship',
  'ready to pickup', 'ready_to_pickup', 'shipped', 'in transit',
  'in_transit', 'out for delivery', 'out_for_delivery', 'delivered',
  'completed', 'fulfilled',
]);

const NEW_ORDER_STATUSES = new Set(['', 'new', 'pending']);
const CANCELLED_ORDER_STATUSES = new Set(['cancelled', 'canceled']);

// Mirrors the API derivation for cached/older responses during deployment.
export function deriveOrderConfirmationStatus(order) {
  const supplied = String(order?.confirmation_status || order?.orderConfirmationStatus || '').trim();
  if (supplied === 'New' || supplied === 'Confirmed' || supplied === 'Cancelled') return supplied;

  const orderStatus = String(order?.order_status || order?.status || '').trim().toLowerCase();
  if (CANCELLED_ORDER_STATUSES.has(orderStatus)) return 'Cancelled';
  if (CONFIRMED_ORDER_STATUSES.has(orderStatus)) return 'Confirmed';
  if (NEW_ORDER_STATUSES.has(orderStatus)) return 'New';

  return String(order?.payment_status || order?.paymentStatus || '').trim().toLowerCase() === 'paid'
    ? 'Confirmed'
    : 'New';
}
