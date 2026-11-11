/**
 * ₹199 COD partial payment: paid online at checkout and deducted from the
 * order total (after coupon); cod_amount_due is the balance collected on
 * delivery. Older orders had a ₹99 fee charged on top (cod_amount_due equals
 * the total) — those are not partial-payment orders.
 * Accepts raw API rows (snake_case) or normalized orders (camelCase).
 */
export function isCodPartialPaid(order) {
  const status = String(order?.cod_advance_status ?? order?.codAdvanceStatus ?? '').trim().toLowerCase();
  if (status !== 'paid') return false;
  const fee = Number(order?.cod_advance_fee ?? order?.codAdvanceFee);
  const rawDue = order?.cod_amount_due ?? order?.codAmountDue;
  const due = rawDue == null ? NaN : Number(rawDue);
  const total = Number(order?.final_total ?? order?.total_amount ?? order?.total);
  return fee > 0 && Number.isFinite(due) && Number.isFinite(total) && due < total;
}
