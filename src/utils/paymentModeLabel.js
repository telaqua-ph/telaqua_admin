/**
 * Display label for an order's payment mode in the admin UI.
 * The stored/filter value stays "Razorpay"; only what admins see changes.
 */
export function paymentModeLabel(mode) {
  const value = String(mode || '').trim();
  if (!value) return '—';
  if (value.toLowerCase() === 'razorpay') return 'Online';
  return value;
}
