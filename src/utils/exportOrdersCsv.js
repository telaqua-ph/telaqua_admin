/**
 * Client-side CSV export for orders (no secrets / tokens).
 */

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_COLUMNS = [
  { key: 'id', label: 'Order ID' },
  { key: 'orderNumber', label: 'Order Number' },
  { key: 'customerName', label: 'Customer' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'product', label: 'Product' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'total', label: 'Amount' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'status', label: 'Order Status' },
  { key: 'address', label: 'Shipping Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'date', label: 'Created Date' },
  { key: 'shipmentStatus', label: 'Shipment Status' },
  { key: 'waybill', label: 'Waybill' },
  { key: 'delhiveryShipmentId', label: 'Delhivery Shipment ID' },
  { key: 'shipmentCreatedAt', label: 'Shipment Created At' },
  { key: 'shipmentConfirmedAt', label: 'Shipment Confirmed At' },
  {
    key: 'labelData',
    label: 'Label Data',
    map: (o) => (o.labelData ? 'Available' : 'Not Available'),
  },
  { key: 'pickupStatus', label: 'Pickup Status' },
  { key: 'pickupRequestedAt', label: 'Pickup Requested At' },
  { key: 'trackingStatus', label: 'Tracking Status' },
  { key: 'trackingUpdatedAt', label: 'Tracking Updated At' },
  { key: 'shipmentError', label: 'Shipment Error' },
];

export function exportOrdersToCsv(orders, filename = 'telaqua-orders.csv') {
  const header = CSV_COLUMNS.map((c) => escapeCsv(c.label)).join(',');
  const rows = orders.map((order) =>
    CSV_COLUMNS.map((col) => {
      const value = col.map ? col.map(order) : order[col.key];
      return escapeCsv(value);
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
