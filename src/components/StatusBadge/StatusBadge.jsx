import './StatusBadge.css';

const statusMap = {
  New: 'new',
  new: 'new',
  Pending: 'payment-pending',
  pending: 'payment-pending',
  Confirmed: 'confirmed',
  confirmed: 'confirmed',
  Processing: 'processing',
  processing: 'processing',
  'Out for Delivery': 'delivery',
  Delivered: 'delivered',
  delivered: 'delivered',
  Cancelled: 'cancelled',
  cancelled: 'cancelled',
  Active: 'delivered',
  Inactive: 'cancelled',
  'Out of Stock': 'new',
  Paid: 'payment-paid',
  paid: 'payment-paid',
  Failed: 'payment-failed',
  failed: 'payment-failed',
  Refunded: 'payment-refunded',
  refunded: 'payment-refunded',
  // Shipment
  'Not Created': 'shipment-idle',
  Created: 'confirmed',
  'Pickup Requested': 'processing',
  'In Transit': 'delivery',
  NDR: 'payment-failed',
  'Not Requested': 'shipment-idle',
  Requested: 'processing',
};

function resolveTone(status) {
  if (!status) return 'default';
  if (statusMap[status]) return statusMap[status];
  const lower = String(status).toLowerCase();
  if (lower.includes('deliver')) return 'delivered';
  if (lower.includes('transit') || lower.includes('out for')) return 'delivery';
  if (lower.includes('ndr') || lower.includes('fail')) return 'payment-failed';
  if (lower.includes('pickup') || lower.includes('created')) return 'confirmed';
  if (lower.includes('unfulfilled') || lower.includes('not created')) return 'shipment-idle';
  if (lower.includes('shipment created') || lower.includes('created')) return 'confirmed';
  if (lower.includes('picked')) return 'processing';
  if (lower.includes('exception') || lower.includes('ndr')) return 'payment-failed';
  if (lower.includes('not')) return 'shipment-idle';
  return 'default';
}

export default function StatusBadge({ status }) {
  const label = status || '—';
  const tone = resolveTone(status);
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
