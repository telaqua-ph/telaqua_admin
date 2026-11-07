import { useState } from 'react';
import { createManualCodOrder, validatePromoCode } from '../../services/api';
import { Button } from '../Buttons';
import { Modal } from '../Modal';

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
};

/** The same Add COD Order button and form used on Orders and Offline Sold. */
export default function AddCodOrderButton({ onCreated, disabled = false, showOfflineSold = true }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCodForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);

  const openModal = () => {
    setForm(emptyCodForm);
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
    try {
      const created = await createManualCodOrder({
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
        offline_sold: showOfflineSold ? form.offline_sold : 'COD Paid-Cash',
      });
      setOpen(false);
      setForm(emptyCodForm);
      if (onCreated) await onCreated(created);
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Failed to create COD order');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button disabled={disabled} onClick={openModal}>
        + Add COD Order
      </Button>
      <Modal
        open={open}
        title="Add COD Order"
        size="lg"
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="cod-order-form" disabled={saving}>
              {saving ? 'Saving…' : 'Create COD Order'}
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
        </form>
      </Modal>
    </>
  );
}
