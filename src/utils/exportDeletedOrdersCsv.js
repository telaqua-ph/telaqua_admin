const formulaPrefix = /^[=+\-@\t\r]/;

function csvValue(value) {
  let text = String(value ?? '');
  if (formulaPrefix.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const columns = [
  ['orderNumber', 'Order Number'], ['customerName', 'Customer Name'], ['email', 'Customer Email'],
  ['phone', 'Customer Phone'], ['product', 'Order Items'], ['quantity', 'Quantity'], ['total', 'Total Amount'],
  ['orderConfirmationStatus', 'Order Status at Deletion'], ['paymentStatus', 'Payment Status'], ['paymentMode', 'Payment Mode'],
  ['promoCode', 'Promo Code'], ['shipmentStatus', 'Shipment Status'], ['waybill', 'AWB Number'],
  ['createdAt', 'Original Order Date'], ['deletedAt', 'Deletion Date'], ['deletedBy', 'Deleted By'],
];

export function downloadDeletedOrdersCsv(orders, filename) {
  const lines = [columns.map(([, label]) => csvValue(label)).join(',')];
  orders.forEach((order) => lines.push(columns.map(([key]) => csvValue(order[key])).join(',')));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
