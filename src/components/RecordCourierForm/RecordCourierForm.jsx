import { useState } from 'react';
import { Button } from '../Buttons';
import './RecordCourierForm.css';

const COURIERS = [
  { value: 'indiapost', label: 'India Post', numberLabel: 'Article number', placeholder: 'EN123456789IN' },
  { value: 'shipway', label: 'Shipway', numberLabel: 'AWB number', placeholder: 'AWB from Shipway' },
  { value: 'delhivery', label: 'Delhivery', numberLabel: 'AWB number', placeholder: 'AWB from Delhivery' },
];

const FINISHED = ['delivered', 'returned', 'rto', 'rto_delivered', 'cancelled'];

/**
 * "Add courier & article number" for an order booked outside the admin
 * (India Post portal / post office counter, Shipway or Delhivery panel).
 * Saves the courier only; it does not book anything with the courier.
 */
export default function RecordCourierForm({ order, busy, onSubmit }) {
  const alreadyFinished = FINISHED.includes(String(order?.fulfillmentStatus || '').toLowerCase());
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState('indiapost');
  const [number, setNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [notify, setNotify] = useState(!alreadyFinished);

  const selected = COURIERS.find((c) => c.value === courier) || COURIERS[0];
  const cleanNumber = number.replace(/\s+/g, '').toUpperCase();
  const valid = courier === 'indiapost'
    ? /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleanNumber)
    : /^[A-Z0-9-]{6,40}$/.test(cleanNumber);

  const submit = async (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    const result = await onSubmit({
      courier,
      number: cleanNumber,
      courier_name: courier === 'indiapost' ? undefined : courierName.trim() || undefined,
      notify: notify && !alreadyFinished,
    });
    if (result) {
      setOpen(false);
      setNumber('');
      setCourierName('');
    }
  };

  if (!open) {
    return (
      <div className="panel__body record-courier record-courier--closed">
        <p className="form-hint">Booked this parcel in the India Post portal, at the post office, or in Shipway / Delhivery? Save the courier here so the order shows the right courier and tracking.</p>
        <Button type="button" size="sm" variant="outline-primary" onClick={() => setOpen(true)}>
          Add courier &amp; article number
        </Button>
      </div>
    );
  }

  return (
    <form className="panel__body record-courier" onSubmit={submit}>
      <h4>Add courier &amp; article number</h4>
      <div className="record-courier__grid">
        <div className="form-group">
          <label htmlFor="rc-courier">Courier</label>
          <select id="rc-courier" value={courier} onChange={(e) => setCourier(e.target.value)}>
            {COURIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="rc-number">{selected.numberLabel}</label>
          <input
            id="rc-number"
            value={number}
            placeholder={selected.placeholder}
            autoComplete="off"
            onChange={(e) => setNumber(e.target.value)}
          />
          {number && !valid ? (
            <span className="record-courier__error">
              {courier === 'indiapost' ? 'Must look like EN123456789IN (2 letters, 9 digits, IN).' : 'Letters and digits only, at least 6 characters.'}
            </span>
          ) : null}
        </div>
        {courier !== 'indiapost' ? (
          <div className="form-group">
            <label htmlFor="rc-name">Courier partner (optional)</label>
            <input id="rc-name" value={courierName} placeholder="e.g. Ekart, Bluedart" onChange={(e) => setCourierName(e.target.value)} />
          </div>
        ) : null}
      </div>
      {alreadyFinished ? (
        <p className="form-hint">This order is already {String(order.fulfillmentStatus).replace(/_/g, ' ')}. Its delivery status will stay the same and the customer will not be messaged.</p>
      ) : (
        <label className="record-courier__check">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Send the tracking link to the customer on WhatsApp
        </label>
      )}
      <div className="record-courier__actions">
        <Button type="submit" size="sm" disabled={!valid || busy}>{busy ? 'Saving…' : 'Save courier'}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
