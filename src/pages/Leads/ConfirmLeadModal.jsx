import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Buttons';
import './ConfirmLeadModal.css';

const PER_UNIT = 199;
const MAX_UNITS = 3;
const REFERENCE = /^[A-Za-z0-9@._\-/]{4,64}$/;
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Same rule as the website checkout: ₹199 per unit (max 3 units), deducted from the total. */
export function leadAdvanceSplit(total, quantity) {
  const amount = Math.round((Number(total) || 0) * 100) / 100;
  const units = Math.max(1, Math.floor(Number(quantity) || 1));
  const advance = Math.min(PER_UNIT * Math.min(units, MAX_UNITS), amount);
  return { total: amount, advance, due: Math.round((amount - advance) * 100) / 100 };
}

/**
 * Leads → Confirm: the customer paid the partial payment by scanning the company QR code.
 * Staff enter the UPI transaction ID / UTR; the lead becomes a COD order with the balance due.
 */
export default function ConfirmLeadModal({ lead, saving, onClose, onConfirm }) {
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('upi');
  const [paidOn, setPaidOn] = useState(todayInIndia());
  const [notify, setNotify] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setReference('');
    setMethod('upi');
    setPaidOn(todayInIndia());
    setNotify(true);
    setChecked(false);
  }, [lead?.leadId]);

  if (!lead) return null;
  const split = leadAdvanceSplit(lead.total, lead.quantity);
  const cleanRef = reference.replace(/\s+/g, '');
  const validRef = REFERENCE.test(cleanRef);
  const canSave = validRef && checked && !saving;

  const submit = () => {
    if (!canSave) return;
    onConfirm({ reference: cleanRef, method, paidOn, notify });
  };

  return (
    <Modal
      open
      title={`Confirm ${lead.orderNumber} — paid by QR`}
      onClose={() => !saving && onClose()}
      footer={(
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={submit}>{saving ? 'Confirming…' : 'Confirm order'}</Button>
        </>
      )}
    >
      <div className="confirm-lead">
        <div className="confirm-lead__summary">
          <div><span>Customer</span><strong>{lead.customerName || '—'}</strong><span>{lead.phone || ''}</span></div>
          <div><span>Order total</span><strong>₹{split.total.toFixed(2)}</strong><span>Qty {lead.quantity || 1}</span></div>
          <div><span>Partial payment received</span><strong className="confirm-lead__paid">₹{split.advance.toFixed(2)}</strong><span>by QR</span></div>
          <div><span>Remaining (cash on delivery)</span><strong>₹{split.due.toFixed(2)}</strong></div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="cl-method">Paid by</label>
            <select id="cl-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="upi">UPI (QR code)</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="cl-ref">Transaction ID / UTR / UPI reference</label>
            <input
              id="cl-ref"
              value={reference}
              autoComplete="off"
              placeholder="e.g. 632082106728"
              onChange={(e) => setReference(e.target.value)}
            />
            {reference && !validRef ? (
              <span className="confirm-lead__error">Letters, digits, @ . - _ only (4–64 characters).</span>
            ) : null}
          </div>
          <div className="form-group">
            <label htmlFor="cl-paid-on">Payment received date</label>
            <input
              id="cl-paid-on"
              type="date"
              value={paidOn}
              max={todayInIndia()}
              required
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
        </div>

        <label className="confirm-lead__check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I checked that ₹{split.advance.toFixed(2)} was received in the company account for this customer.
        </label>
        <label className="confirm-lead__check">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Send the order-confirmation WhatsApp to the customer
        </label>
        <p className="form-hint">
          {lead.leadType === 'online'
            ? 'This online order will switch to COD (partially paid) and move to Orders. 1 device per unit is taken from stock.'
            : 'A new COD order will be created and appear in Orders. 1 device per unit is taken from stock.'}
        </p>
      </div>
    </Modal>
  );
}
