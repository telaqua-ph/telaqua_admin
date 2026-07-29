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
  // Payment statuses
  Paid: 'payment-paid',
  paid: 'payment-paid',
  Failed: 'payment-failed',
  failed: 'payment-failed',
  Refunded: 'payment-refunded',
  refunded: 'payment-refunded',
};

export default function StatusBadge({ status }) {
  const tone = statusMap[status] || 'default';
  return <span className={`status-badge status-badge--${tone}`}>{status}</span>;
}
