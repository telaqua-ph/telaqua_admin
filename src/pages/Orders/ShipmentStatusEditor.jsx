import { useState } from 'react';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import {
  MANUAL_SHIPMENT_STATUS_OPTIONS,
  updateOrderShipmentStatus,
} from '../../services/api';

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

/**
 * Shipment cell: shows the status badge, and on row hover a pencil icon.
 * Clicking it opens a dropdown of manual statuses with Save / Cancel.
 */
export default function ShipmentStatusEditor({ order, statusLabel, disabled, onSaved, onError }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => {
    setValue('');
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setValue('');
  };

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      const updated = await updateOrderShipmentStatus(order.id, value);
      setEditing(false);
      setValue('');
      onSaved?.(updated, MANUAL_SHIPMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label);
    } catch (err) {
      if (err?.status !== 401) onError?.(err?.message || 'Failed to update shipment status');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="orders__ship-editor">
        <select
          className="orders__ship-select"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          autoFocus
          aria-label={`Shipment status for order ${order.orderNumber || order.id}`}
        >
          <option value="" disabled>
            Select status
          </option>
          {MANUAL_SHIPMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="orders__ship-editor-actions">
          <button
            type="button"
            className="orders__ship-save"
            onClick={save}
            disabled={!value || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="orders__ship-cancel"
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orders__ship-cell">
      <StatusBadge status={statusLabel} />
      <button
        type="button"
        className="orders__ship-edit"
        onClick={open}
        disabled={disabled}
        title="Update shipment status"
        aria-label={`Update shipment status for order ${order.orderNumber || order.id}`}
      >
        <PencilIcon />
      </button>
    </div>
  );
}
