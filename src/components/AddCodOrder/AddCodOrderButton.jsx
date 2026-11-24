import { useState } from 'react';
import { createManualCodOrder, createManualPrepaidOrder, validatePromoCode } from '../../services/api';
import { Button } from '../Buttons';
import { Modal } from '../Modal';
import './AddCodOrder.css';

const OFFLINE_SOLD_OPTIONS = ['COD Paid-Cash', 'COD Paid-QR'];

const emptyCodForm = {
  customer_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  quantity: '1',
  unit_price: '',
  total_amount: '',
  promo_code: '',
  offline_sold: 'COD Paid-Cash',
  purchased_on: '',
  // Prepaid (already paid) — only on the Orders page (allowPrepaid)
  payment_type: 'cod',
  payment_method: 'upi',
  payment_reference: '',
  paid_on: '',
  payment_confirmed: false,
  notify: true,
};

const PREPAID_METHODS = [
  { value: 'upi', label: 'UPI / QR code' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'razorpay_link', label: 'Razorpay payment link' },
  { value: 'other', label: 'Other' },
];
const PAYMENT_REFERENCE = /^[A-Za-z0-9@._\-/]{4,64}$/;

/** Today as YYYY-MM-DD in the admin's local time (latest allowed Purchased On date). */
function todayLocal() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The same Add COD Order button and form used on Orders and Offline Sold. */
export default function AddCodOrderButton({ onCreated, disabled = false, showOfflineSold = true, allowPrepaid = false }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCodForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);

  const isPrepaid = allowPrepaid && form.payment_type === 'prepaid';
  const cleanReference = String(form.payment_reference || '').replace(/\s+/g, '');
  const referenceInvalid = isPrepaid && cleanReference !== '' && !PAYMENT_REFERENCE.test(cleanReference);

  const openModal = () => {
    setForm({ ...emptyCodForm, paid_on: todayLocal() });
    setError('');
    setPromo(null);
    setPromoError('');
    setOpen(true);
  };

  const updatePromoCode = (value) => {
    setForm((prev) => ({ ...prev, promo_code: value }));
    if (promo) setPromo(null);
    setPromoError('');
  };

  const applyPromo = async () => {
    const code = String(form.promo_code || '').trim().toUpperCase();
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoError('');
    try {
      const nextPromo = await validatePromoCode(code);
      if (!nextPromo) throw new Error('Invalid or inactive promo code');
      setPromo(nextPromo);
      setForm((prev) => {
        const qty = Number(prev.quantity);
        const next = { ...prev, promo_code: nextPromo.code, unit_price: String(nextPromo.promo_price) };
        if (Number.isFinite(qty) && qty > 0) {
          next.total_amount = String(Number((qty * nextPromo.promo_price).toFixed(2)));
        }
        return next;
      });
    } catch (err) {
      setPromo(null);
      if (err.status !== 401) {
        setPromoError(err.message || 'Invalid or inactive promo code');
      }
    } finally {
      setPromoChecking(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoError('');
    setForm((prev) => ({ ...prev, promo_code: '' }));
  };

  const updateField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'quantity' || name === 'unit_price') {
        const qty = Number(name === 'quantity' ? value : next.quantity);
        const unit = Number(name === 'unit_price' ? value : next.unit_price);
        if (Number.isFinite(qty) && Number.isFinite(unit) && qty > 0 && unit > 0) {
          next.total_amount = String(Number((qty * unit).toFixed(2)));
        }
      }
      return next;
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    if (isPrepaid && (!PAYMENT_REFERENCE.test(cleanReference) || !form.payment_confirmed)) {
      setError(!PAYMENT_REFERENCE.test(cleanReference)
        ? 'Enter the transaction ID / UTR / Razorpay payment ID.'
        : 'Tick the box to confirm the payment was received in the company account.');
      setSaving(false);
      return;
    }
    try {
      const create = isPrepaid ? createManualPrepaidOrder : createManualCodOrder;
      const prepaidFields = isPrepaid
        ? {
            payment_method: form.payment_method,
            payment_reference: cleanReference,
            paid_on: form.paid_on || todayLocal(),
            amount_received: Number(form.total_amount),
            payment_confirmed: true,
            notify: Boolean(form.notify),
          }
        : {};
      const created = await create({
        ...prepaidFields,
        customer_name: String(form.customer_name || '').trim(),
        phone: String(form.phone || '').trim(),
        email: String(form.email || '').trim(),
        address: String(form.address || '').trim(),
        city: String(form.city || '').trim(),
        state: String(form.state || '').trim(),
        pincode: String(form.pincode || '').trim(),
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price),
        total_amount: Number(form.total_amount),
        promo_code: String(form.promo_code || '').trim().toUpperCase() || undefined,
        offline_sold: showOfflineSold ? form.offline_sold : 'COD Pending',
        purchased_on: showOfflineSold ? form.purchased_on : undefined,
      });
      setOpen(false);
      setForm(emptyCodForm);
      if (onCreated) await onCreated(created);
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || (isPrepaid ? 'Failed to create prepaid order' : 'Failed to create COD order'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button disabled={disabled} onClick={openModal}>
        {allowPrepaid ? '+ Add Order' : '+ Add COD Order'}
      </Button>
      <Modal
        open={open}
        title={allowPrepaid ? (isPrepaid ? 'Add Order — Prepaid (already paid)' : 'Add Order — Cash on Delivery') : 'Add COD Order'}
        size="lg"
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="cod-order-form" disabled={saving}>
              {saving ? 'Saving…' : isPrepaid ? 'Create Prepaid Order' : 'Create COD Order'}
            </Button>
          </>
        }
      >
        <form id="cod-order-form" className="form-grid" onSubmit={handleCreate}>
          {error ? <div className="alert alert--error form-group--full">{error}</div> : null}
          <div className="form-group form-group--full">
            <span>Product</span>
            <strong>Tel-Aqua Product</strong>
          </div>
          {allowPrepaid ? (
            <div className="form-group form-group--full">
              <span>Payment type</span>
              <div className="order-type" role="radiogroup" aria-label="Payment type">
                {[
                  { value: 'cod', title: 'Cash on Delivery', desc: 'Customer pays the full amount on delivery' },
                  { value: 'prepaid', title: 'Prepaid', desc: 'Customer has already paid in full (UPI / bank / link)' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`order-type__option${form.payment_type === option.value ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="order-payment-type"
                      value={option.value}
                      checked={form.payment_type === option.value}
                      onChange={() => updateField('payment_type', option.value)}
                    />
                    <span className="order-type__dot" aria-hidden="true" />
                    <span className="order-type__text">
                      <strong>{option.title}</strong>
                      <span>{option.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {showOfflineSold ? (
            <div className="form-group form-group--full">
              <label htmlFor="cod-offline-sold">Offline Sold</label>
              <select
                id="cod-offline-sold"
                value={form.offline_sold}
                onChange={(e) => updateField('offline_sold', e.target.value)}
                required
              >
                {OFFLINE_SOLD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          ) : null}
          {showOfflineSold ? (
            <div className="form-group form-group--full">
              <label htmlFor="cod-purchased-on">Purchased On</label>
              <input
                id="cod-purchased-on"
                type="date"
                max={todayLocal()}
                value={form.purchased_on}
                onChange={(e) => updateField('purchased_on', e.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="form-group">
            <label htmlFor="cod-name">Customer Name</label>
            <input
              id="cod-name"
              value={form.customer_name}
              onChange={(e) => updateField('customer_name', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-phone">Phone</label>
            <input
              id="cod-phone"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="cod-email">Email (optional)</label>
            <input
              id="cod-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="cod-address">Address</label>
            <textarea
              id="cod-address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-city">City</label>
            <input
              id="cod-city"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-state">State</label>
            <input
              id="cod-state"
              value={form.state}
              onChange={(e) => updateField('state', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-pincode">Pincode</label>
            <input
              id="cod-pincode"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => updateField('pincode', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-quantity">Quantity</label>
            <input
              id="cod-quantity"
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => updateField('quantity', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="cod-promo">Coupon Code (optional)</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                id="cod-promo"
                style={{ flex: 1, textTransform: 'uppercase' }}
                value={form.promo_code}
                onChange={(e) => updatePromoCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPromo();
                  }
                }}
                placeholder="e.g. SN40"
                disabled={saving}
              />
              {promo ? (
                <Button variant="secondary" disabled={saving} onClick={removePromo}>
                  Remove
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={saving || promoChecking || !String(form.promo_code || '').trim()}
                  onClick={applyPromo}
                >
                  {promoChecking ? 'Checking…' : 'Apply'}
                </Button>
              )}
            </div>
            {promo ? (
              <span className="form-hint">
                {promo.code} applied: ₹{promo.promo_price} per unit (was ₹
                {promo.original_price}, save ₹{promo.discount_amount} per unit).
              </span>
            ) : promoError ? (
              <span className="form-hint" style={{ color: 'var(--color-danger, #c62828)' }}>
                {promoError}
              </span>
            ) : (
              <span className="form-hint">
                With a coupon, the price is taken from the coupon, not the fields below.
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="cod-unit-price">Unit Price</label>
            <input
              id="cod-unit-price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => updateField('unit_price', e.target.value)}
              readOnly={Boolean(promo)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="cod-total">Total Amount</label>
            <input
              id="cod-total"
              type="number"
              min="0.01"
              step="0.01"
              value={form.total_amount}
              onChange={(e) => updateField('total_amount', e.target.value)}
              readOnly={Boolean(promo)}
              required
            />
          </div>
          {isPrepaid ? (
            <section className="prepaid-box" aria-label="Payment received">
              <div className="prepaid-box__head">
                <h4>Payment received</h4>
                <span className="prepaid-box__amount">{form.total_amount ? `₹${form.total_amount}` : '—'}</span>
              </div>
              <p className="prepaid-box__note">Full amount paid in advance. The courier will not collect any money.</p>
              <div className="form-group">
                <label htmlFor="prepaid-method">Paid via</label>
                <select
                  id="prepaid-method"
                  value={form.payment_method}
                  onChange={(e) => updateField('payment_method', e.target.value)}
                  required
                >
                  {PREPAID_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="prepaid-date">Payment date</label>
                <input
                  id="prepaid-date"
                  type="date"
                  max={todayLocal()}
                  value={form.paid_on}
                  onChange={(e) => updateField('paid_on', e.target.value)}
                  required
                />
              </div>
              <div className="form-group prepaid-box__full">
                <label htmlFor="prepaid-ref">Transaction ID / UTR / Razorpay payment ID</label>
                <input
                  id="prepaid-ref"
                  autoComplete="off"
                  placeholder="e.g. 632082106728 or pay_U3VuJj3Y3zB9Un"
                  value={form.payment_reference}
                  onChange={(e) => updateField('payment_reference', e.target.value)}
                  required
                />
                {referenceInvalid ? (
                  <span className="prepaid-box__error">Letters, digits, @ . - _ only (4–64 characters).</span>
                ) : (
                  <span className="form-hint">Razorpay IDs (pay_…) are verified with Razorpay automatically.</span>
                )}
              </div>
              <div className="prepaid-box__checks">
                <label className="prepaid-check">
                  <input
                    type="checkbox"
                    checked={form.payment_confirmed}
                    onChange={(e) => updateField('payment_confirmed', e.target.checked)}
                  />
                  <span>I checked that {form.total_amount ? `₹${form.total_amount}` : 'the full amount'} was received in the company account.</span>
                </label>
                <label className="prepaid-check">
                  <input
                    type="checkbox"
                    checked={form.notify}
                    onChange={(e) => updateField('notify', e.target.checked)}
                  />
                  <span>Send the order-confirmation WhatsApp to the customer</span>
                </label>
              </div>
            </section>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
