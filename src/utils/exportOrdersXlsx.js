import * as XLSX from 'xlsx';

// This is the Shipway import template, kept verbatim and in template order.
export const SHIPWAY_COLUMNS = [
  '*Order ID', 'Warehouse ID', '*SKU', '*Product Name',
  '*Product Price(Inclusive of all taxes)', '*Product Quantity',
  '*Order Total Amount', '*Payment Type', '*Order Date', '*Order Dead Weight(g)',
  '*Length(cm)', '*Breadth(cm)', '*Height(cm)', '*Shipping:FirstName',
  '*Shipping:LastName', '*Shipping:Phone', '*Shipping:Email',
  '*Shipping:Address', 'Shipping:Address2', '*Shipping:Pincode',
  '*Shipping:City', '*Shipping:State', '*Shipping:Country',
];

// These are deliberately semantic decisions, rather than an exact-header check.
// `orderNumber` is the Shipway order identifier in the existing booking payload;
// the database's numeric `id` is therefore retained separately as Internal Order ID.
export const TELAQUA_ONLY_COLUMNS = [
  'Internal Order ID',
  'Payment Status',
  'Payment ID',
  'Promo Code',
  'Discount Amount',
  'Order Status',
  'Shipment Status',
  'Waybill',
  'Delhivery Shipment ID',
  'Shipment Created At',
  'Shipment Confirmed At',
  'Label Data',
  'Pickup Status',
  'Pickup Requested At',
  'Tracking Status',
  'Tracking Updated At',
  'Shipment Error',
];

export const FINAL_COLUMNS = [...SHIPWAY_COLUMNS, ...TELAQUA_ONLY_COLUMNS];

function text(value) {
  return value == null ? '' : String(value).trim();
}

function splitCustomerName(name) {
  const parts = text(name).split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

function paymentType(order) {
  const mode = text(order.paymentMode || order.payment_mode).toLowerCase();
  const method = text(order.paymentMethod || order.payment_method).toLowerCase();
  return mode === 'cod' || method === 'cod' || method.includes('cash on delivery') ? 'C' : 'P';
}

function shipmentTimestamp(order, rawKey, labelKey) {
  return order[rawKey] || order[labelKey] || '';
}

/**
 * Builds every Orders-page export.  Shipway fields are populated from the
 * live order record and canonical fields replace their Tel-Aqua equivalents.
 */
export function buildDeduplicatedShipwayExport(orders = []) {
  const rows = orders.map((order) => {
    const { firstName, lastName } = splitCustomerName(order.customerName || order.customer_name);
    const orderDate = order.createdAt || order.created_at || order.date || '';
    const row = {
      '*Order ID': order.orderNumber || order.order_number || order.id || '',
      'Warehouse ID': order.warehouseId || order.warehouse_id || '',
      '*SKU': order.sku || order.productSku || order.product_sku || '',
      '*Product Name': order.product || order.product_name || '',
      '*Product Price(Inclusive of all taxes)': order.unitPrice ?? order.unit_price ?? '',
      '*Product Quantity': order.quantity ?? '',
      '*Order Total Amount': order.total ?? order.total_amount ?? '',
      '*Payment Type': paymentType(order),
      '*Order Date': orderDate,
      '*Order Dead Weight(g)': order.deadWeightG ?? order.dead_weight_g ?? '',
      '*Length(cm)': order.lengthCm ?? order.length_cm ?? '',
      '*Breadth(cm)': order.breadthCm ?? order.breadth_cm ?? order.widthCm ?? '',
      '*Height(cm)': order.heightCm ?? order.height_cm ?? '',
      '*Shipping:FirstName': firstName,
      '*Shipping:LastName': lastName,
      '*Shipping:Phone': order.phone || '',
      '*Shipping:Email': order.email || '',
      '*Shipping:Address': order.address || '',
      'Shipping:Address2': order.address2 || order.address_2 || '',
      '*Shipping:Pincode': order.pincode || '',
      '*Shipping:City': order.city || '',
      '*Shipping:State': order.state || '',
      '*Shipping:Country': order.country || 'India',
      'Internal Order ID': order.id ?? '',
      'Payment Status': order.paymentStatus || order.payment_status || '',
      'Payment ID': order.paymentId || order.payment_id || order.razorpay_payment_id || '',
      'Promo Code': order.promoCode || order.promo_code || '',
      'Discount Amount': order.discountAmount ?? order.discount_amount ?? '',
      'Order Status': order.orderConfirmationStatus || order.confirmation_status || order.status || order.order_status || '',
      'Shipment Status': order.shipmentStatus || order.shipment_status || '',
      Waybill: order.waybill || '',
      'Delhivery Shipment ID': order.delhiveryShipmentId || order.delhivery_shipment_id || '',
      'Shipment Created At': shipmentTimestamp(order, 'shipmentCreatedAt', 'shipmentCreatedAtLabel'),
      'Shipment Confirmed At': shipmentTimestamp(order, 'shipmentConfirmedAt', 'shipmentConfirmedAtLabel'),
      'Label Data': order.labelData ? 'Available' : '',
      'Pickup Status': order.pickupStatus || order.pickup_status || '',
      'Pickup Requested At': shipmentTimestamp(order, 'pickupRequestedAt', 'pickupRequestedAtLabel'),
      'Tracking Status': order.trackingStatus || order.tracking_status || '',
      'Tracking Updated At': order.trackingUpdatedAt || order.tracking_updated_at || order.trackingStatusAt || '',
      'Shipment Error': order.shipmentError || order.shipment_error || '',
    };
    return Object.fromEntries(FINAL_COLUMNS.map((column) => [column, row[column] ?? '']));
  });

  return { columns: FINAL_COLUMNS, rows };
}

export function exportOrdersToXlsx(orders, filename) {
  const { columns, rows } = buildDeduplicatedShipwayExport(orders);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns, skipHeader: false });
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 2, 14), 34) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, filename, { compression: true });
}
