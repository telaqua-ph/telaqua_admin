import { deriveOrderConfirmationStatus } from './orderConfirmationStatus';

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const CSV_COLUMNS = [
  { key: 'id', label: 'Order ID' }, { key: 'orderNumber', label: 'Order Number' },
  { key: 'customerName', label: 'Customer' }, { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' }, { key: 'fullAddress', label: 'Shipping Address', map: (o) => o.fullAddress || o.address || '' },
  { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'pincode', label: 'Pincode' },
  { key: 'product', label: 'Product' }, { key: 'quantity', label: 'Quantity' }, { key: 'total', label: 'Amount' },
  { key: 'paymentMethod', label: 'Payment Method' }, { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'paymentId', label: 'Payment ID' }, { key: 'promoCode', label: 'Promo Code' },
  { key: 'discountAmount', label: 'Discount Amount' }, { key: 'orderConfirmationStatus', label: 'Order Status', map: deriveOrderConfirmationStatus },
  { key: 'orderedDate', label: 'Order Date' }, { key: 'orderedTime', label: 'Order Time' }, { key: 'date', label: 'Ordered At' },
  { key: 'shipmentStatus', label: 'Shipment Status' }, { key: 'waybill', label: 'Waybill' },
  { key: 'delhiveryShipmentId', label: 'Delhivery Shipment ID' }, { key: 'shipmentCreatedAt', label: 'Shipment Created At' },
  { key: 'shipmentConfirmedAt', label: 'Shipment Confirmed At' }, { key: 'labelData', label: 'Label Data', map: (o) => (o.labelData ? 'Available' : 'Not Available') },
  { key: 'pickupStatus', label: 'Pickup Status' }, { key: 'pickupRequestedAt', label: 'Pickup Requested At' },
  { key: 'trackingStatus', label: 'Tracking Status' }, { key: 'trackingUpdatedAt', label: 'Tracking Updated At' },
  { key: 'shipmentError', label: 'Shipment Error' },
];

export function exportOrdersToCsv(orders, filename = 'telaqua-orders.csv') {
  const header = CSV_COLUMNS.map((column) => escapeCsv(column.label)).join(',');
  const rows = orders.map((order) => CSV_COLUMNS.map((column) => escapeCsv(column.map ? column.map(order) : order[column.key])).join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
