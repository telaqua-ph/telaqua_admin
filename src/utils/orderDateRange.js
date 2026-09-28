const KOLKATA_TIME_ZONE = 'Asia/Kolkata';

function datePartsInKolkata(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOLKATA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Returns an order's creation date as an ISO date in the business timezone. */
export function orderCreatedDateInKolkata(order) {
  const value = order?.createdAt || order?.created_at || '';
  const raw = String(value || '').trim();

  // MySQL DATETIME values have no UTC offset and represent the business
  // wall-clock time. Preserve their calendar date before parsing in a browser.
  const localDate = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (localDate) return localDate[1];

  return datePartsInKolkata(value);
}

/** Returns an order's payment date as an ISO date in the business timezone. */
export function orderPaymentDateInKolkata(order) {
  return orderCreatedDateInKolkata({
    createdAt: order?.paymentDate || order?.payment_date || order?.createdAt || order?.created_at,
  });
}

/** Inclusive [from, to] business-date range matching for an order. */
export function isOrderCreatedInDateRange(order, from, to) {
  if (!from && !to) return true;
  const orderDate = orderCreatedDateInKolkata(order);
  if (!orderDate) return false;
  return (!from || orderDate >= from) && (!to || orderDate <= to);
}

export function isOrderPaymentInDateRange(order, from, to) {
  if (!from && !to) return true;
  const paymentDate = orderPaymentDateInKolkata(order);
  if (!paymentDate) return false;
  return (!from || paymentDate >= from) && (!to || paymentDate <= to);
}

export function todayInKolkata() {
  return datePartsInKolkata(new Date());
}
