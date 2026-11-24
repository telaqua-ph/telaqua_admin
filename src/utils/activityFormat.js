/** Shared helpers for showing Activity Log rows. */

export function formatActivityTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function activityWho(row) {
  if (row?.admin_name) return row.admin_name;
  if (row?.admin_email) return row.admin_email;
  if (row?.admin_id) return `Admin #${row.admin_id}`;
  return 'System';
}

export function formatChangeValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  // ISO timestamps -> IST
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return formatActivityTime(text);
  if (text === '1' || text === 'true') return text === '1' ? '1 (yes)' : 'yes';
  if (text === '0' || text === 'false') return text === '0' ? '0 (no)' : 'no';
  return text.replace(/_/g, ' ');
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadActivityCsv(rows, filename) {
  const header = ['Time (IST)', 'Employee', 'Email', 'Action', 'Order', 'Field', 'Old value', 'New value', 'Summary'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((row) => {
    const base = [formatActivityTime(row.created_at), activityWho(row), row.admin_email || '', row.action_label || row.action, row.order_number || row.order_id || ''];
    const changes = Array.isArray(row.changes) && row.changes.length ? row.changes : [null];
    changes.forEach((change) => {
      lines.push([
        ...base,
        change?.label || '',
        change ? formatChangeValue(change.from) : '',
        change ? formatChangeValue(change.to) : '',
        row.summary || '',
      ].map(csvCell).join(','));
    });
  });
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Plain-language view of Activity Log changes                         */
/* ------------------------------------------------------------------ */

const STATUS_WORDS = {
  unfulfilled: 'Not shipped',
  pending: 'Pending',
  pending_awb: 'Awaiting AWB',
  awb_pending: 'Awaiting AWB',
  shipment_created: 'Shipment created',
  ready_to_ship: 'Ready to ship',
  booked: 'Booked',
  picked_up: 'Picked up',
  shipped: 'Shipped',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rto: 'Returned (RTO)',
  rto_in_transit: 'Returning (RTO in transit)',
  rto_delivered: 'Returned to warehouse (RTO)',
  returned: 'Returned',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  confirmed: 'Confirmed',
  cod: 'Cash on delivery',
  razorpay: 'Online / prepaid',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  razorpay_link: 'Razorpay link',
  indiapost: 'India Post',
  shipway: 'Shipway',
  delhivery: 'Delhivery',
};

/** Fields that matter to a person reading the log, with friendly labels. */
const KEY_FIELDS = {
  fulfillment_status: { label: 'Delivery status', rank: 1 },
  payment_status: { label: 'Payment', rank: 2 },
  order_status: { label: 'Order status', rank: 3 },
  status: { label: 'Status', rank: 3 },
  payment_mode: { label: 'Payment type', rank: 4 },
  payment_method: { label: 'Paid via', rank: 5 },
  cod_amount_due: { label: 'To collect on delivery', rank: 6, money: true },
  cod_advance_fee: { label: 'Advance paid', rank: 7, money: true },
  cod_advance_status: { label: 'Advance status', rank: 8 },
  manual_payment_reference: { label: 'Payment reference', rank: 9 },
  cod_advance_razorpay_payment_id: { label: 'Payment reference', rank: 9 },
  waybill_number: { label: 'AWB / Article no.', rank: 10 },
  waybill: { label: 'AWB / Article no.', rank: 10 },
  awb: { label: 'AWB / Article no.', rank: 10 },
  courier_name: { label: 'Courier', rank: 11 },
  provider: { label: 'Courier', rank: 11 },
  current_stock: { label: 'Stock', rank: 12, stock: true },
  low_stock_threshold: { label: 'Low-stock alert at', rank: 13 },
  customer_name: { label: 'Customer name', rank: 20 },
  phone: { label: 'Phone', rank: 21 },
  email: { label: 'Email', rank: 22 },
  address: { label: 'Address', rank: 23 },
  city: { label: 'City', rank: 24 },
  state: { label: 'State', rank: 25 },
  pincode: { label: 'Pincode', rank: 26 },
  quantity: { label: 'Quantity', rank: 27 },
  final_total: { label: 'Order total', rank: 28, money: true },
  total_amount: { label: 'Order total', rank: 28, money: true },
  promo_code: { label: 'Coupon', rank: 29 },
  purchased_on: { label: 'Purchased on', rank: 30 },
  offline_sold: { label: 'Offline sold', rank: 31 },
  is_test_order: { label: 'Test order', rank: 32, bool: true },
  is_active: { label: 'Active', rank: 33, bool: true },
  discount_value: { label: 'Discount', rank: 34 },
  code: { label: 'Code', rank: 35 },
};

/** Fields hidden when the delivery status already tells the story. */
const SHADOWED_BY_DELIVERY = new Set(['tracking_status', 'shipment_status']);

function splitField(field) {
  const match = /^(Shipment|Inventory|Promo) #(\d+)\.(.+)$/i.exec(String(field || ''));
  if (match) return { group: match[1], groupId: match[2], key: match[3] };
  return { group: null, groupId: null, key: String(field || '') };
}

function titleCase(text) {
  const t = String(text || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Turn a stored value into words a person understands. */
export function humanValue(value, meta = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value).trim();
  if (meta.money && Number.isFinite(Number(text))) return `₹${Number(text).toLocaleString('en-IN')}`;
  if (meta.bool || text === 'true' || text === 'false') {
    if (['1', 'true'].includes(text.toLowerCase())) return 'Yes';
    if (['0', 'false'].includes(text.toLowerCase())) return 'No';
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return formatActivityTime(text);
  const word = STATUS_WORDS[text.toLowerCase().replace(/[\s-]+/g, '_')];
  if (word) return word;
  return text.length > 60 ? `${text.slice(0, 57)}…` : titleCase(text);
}

/**
 * Split raw changes into the few that matter (key) and the technical rest.
 * Duplicates (order + shipment both changing the delivery status) are shown once.
 */
export function explainChanges(changes = []) {
  const list = Array.isArray(changes) ? changes : [];
  const key = [];
  const technical = [];
  const seen = new Set();
  let created = false;
  let deleted = false;
  const hasDelivery = list.some((c) => splitField(c.field).key === 'fulfillment_status');

  for (const change of list) {
    const { group, groupId, key: field } = splitField(change.field);
    if (field === 'order') {
      if (String(change.to) === 'created') created = true;
      if (String(change.to) === 'deleted') deleted = true;
      continue;
    }
    const meta = KEY_FIELDS[field];
    const isKey = meta && !(hasDelivery && SHADOWED_BY_DELIVERY.has(field));
    if (isKey) {
      const label = meta.label;
      const from = humanValue(change.from, meta);
      const to = humanValue(change.to, meta);
      const dedupe = `${label}|${from}|${to}`;
      if (seen.has(dedupe) || from === to) continue;
      seen.add(dedupe);
      let note = '';
      if (meta.stock && Number.isFinite(Number(change.from)) && Number.isFinite(Number(change.to))) {
        const delta = Number(change.to) - Number(change.from);
        note = delta > 0 ? `+${delta}` : `${delta}`;
      }
      key.push({ label, from, to, note, rank: meta.rank, kind: field });
    } else {
      technical.push({
        label: `${group ? `${titleCase(group)} #${groupId} · ` : ''}${titleCase(change.label?.split(' · ').pop() || field)}`,
        from: humanValue(change.from),
        to: humanValue(change.to),
      });
    }
  }
  key.sort((a, b) => a.rank - b.rank);
  return { key, technical, created, deleted };
}

/** Colour group for the action badge. */
export function actionTone(action = '') {
  const a = String(action).toLowerCase();
  if (/delete|refund|cancel/.test(a)) return 'red';
  if (/created|added|confirmed/.test(a)) return 'orange';
  if (/cod|paid|payment|prepaid|razorpay|advance/.test(a)) return 'green';
  if (/stock|inventory|threshold/.test(a)) return 'purple';
  if (/delivery|shipment|courier|pickup|ndr|india_post|waybill|tracking/.test(a)) return 'blue';
  return 'gray';
}

/** One short headline, e.g. "Marked Delivered" or "Added prepaid order". */
export function activityHeadline(row) {
  const { key, created, deleted } = explainChanges(row?.changes);
  const delivery = key.find((c) => c.kind === 'fulfillment_status');
  if (row?.action === 'delivery_status_changed' && delivery) return `Marked ${delivery.to}`;
  if (deleted) return 'Deleted order';
  if (created && row?.action === 'other_change') return 'Created order';
  return row?.action_label || titleCase(row?.action) || 'Change';
}

export function initialsOf(name) {
  const parts = String(name || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "Today", "Yesterday" or "Mon, 22 Nov 2026" in IST. */
export function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const ist = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (ist(date) === ist(today)) return 'Today';
  if (ist(date) === ist(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
}
