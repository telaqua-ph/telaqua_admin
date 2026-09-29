import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Buttons';
import { updateOrderDeliveryDetails } from '../../services/api';
import {
  COURIER_LOCKED_FIELDS,
  DELIVERY_FIELD_LABELS,
  deliveryEditStage,
  deliveryFormChanged,
  deliveryFormFromOrder,
  validateDeliveryForm,
} from '../../utils/deliveryDetails';
import './DeliveryDetailsModal.css';

/**
 * Edit this order's delivery (shipping) details. Only the order is changed —
 * not the customer's account or other orders. Closing requires Save or Cancel;
 * discarding unsaved edits asks for confirmation.
 */
export default function DeliveryDetailsModal({ open, order, courierSyncPending = false, onClose, onSaved }) {
  const [form, setForm] = useState(() => deliveryFormFromOrder(order));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(deliveryFormFromOrder(order));
    setErrors({});
    setFormError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !order) return null;

  const stage = deliveryEditStage(order);
  const locked = stage === 'in_transit' || stage === 'closed';
  const courierFieldsLocked = stage === 'awaiting_pickup';
  const changed = deliveryFormChanged(order, form);
  const canRetryCourier = courierSyncPending && stage === 'awaiting_pickup' && changed.length === 0;
  const awb = order.waybill ? ` ${order.waybill}` : '';

  const setField = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCancel = () => {
    if (saving) return;
    if (changed.length && !window.confirm('Discard your changes to the delivery details?')) return;
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || locked) return;
    setFormError('');

    const clientErrors = validateDeliveryForm(form);
    if (courierFieldsLocked) {
      changed
        .filter((field) => COURIER_LOCKED_FIELDS.includes(field))
        .forEach((field) => {
          clientErrors[field] = `${DELIVERY_FIELD_LABELS[field]} cannot be changed after the AWB is created.`;
        });
    }
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      setFormError('Please correct the highlighted fields.');
      return;
    }
    if (!changed.length && !canRetryCourier) {
      setFormError('No delivery details were changed.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateOrderDeliveryDetails(order.id, form);
      onSaved(result);
    } catch (err) {
      if (err.status === 401) return;
      const serverErrors = err.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') setErrors(serverErrors);
      setFormError(err.data?.message || err.message || 'Unable to save delivery details.');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (field, { multiline = false, inputMode, maxLength } = {}) => {
    const disabled = locked || saving || (courierFieldsLocked && COURIER_LOCKED_FIELDS.includes(field));
    const props = {
      id: `delivery-${field}`,
      value: form[field],
      onChange: setField(field),
      disabled,
      maxLength,
      inputMode,
      'aria-invalid': errors[field] ? 'true' : undefined,
      'aria-describedby': errors[field] ? `delivery-${field}-error` : undefined,
      className: errors[field] ? 'delivery-form__input--invalid' : undefined,
    };
    return (
      <div className={`form-group${multiline ? ' form-group--full' : ''}`}>
        <label htmlFor={props.id}>{DELIVERY_FIELD_LABELS[field]} *</label>
        {multiline ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
        {errors[field] ? (
          <p className="delivery-form__error" id={`delivery-${field}-error`}>{errors[field]}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      title={`Edit delivery details — ${order.orderNumber}`}
      onClose={handleCancel}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={handleCancel}>
            Cancel
          </Button>
          {!locked ? (
            <Button type="submit" form="delivery-details-form" disabled={saving}>
              {saving
                ? stage === 'awaiting_pickup' ? 'Saving & updating Delhivery…' : 'Saving…'
                : canRetryCourier ? 'Retry Delhivery update' : 'Save'}
            </Button>
          ) : null}
        </>
      }
    >
      <form id="delivery-details-form" className="delivery-form" onSubmit={handleSubmit} noValidate>
        {stage === 'not_created' ? (
          <div className="alert alert--info">
            No Delhivery shipment has been created yet. The corrected details are saved to this order
            and will be used when the shipment is created.
          </div>
        ) : null}
        {stage === 'awaiting_pickup' ? (
          <div className="alert alert--info">
            AWB{awb} is created and awaiting pickup. Name, mobile number and address will be sent to
            Delhivery using its shipment edit API. PIN code, city and state cannot be changed on an
            existing AWB — contact Delhivery support if those are wrong.
          </div>
        ) : null}
        {locked ? (
          <div className="alert alert--error">
            {stage === 'closed'
              ? `This order is ${order.shipmentStatusDisplay || order.status} (delivered, cancelled or returned), so delivery details can no longer be changed.`
              : `The shipment is already ${String(order.shipmentStatusDisplay || order.fulfillmentStatus).replace(/_/g, ' ')} (AWB${awb}). Tel-Aqua cannot change the address or phone with Delhivery at this stage. Contact Delhivery support with the AWB to correct it, then update the order once they confirm.`}
          </div>
        ) : null}
        {courierSyncPending && !locked ? (
          <div className="alert alert--error">
            The last change was saved here but Delhivery was not updated — the courier still has the
            old details. Save again to retry, or contact Delhivery.
          </div>
        ) : null}
        {formError ? <div className="alert alert--error" role="alert">{formError}</div> : null}

        <div className="form-grid">
          {renderInput('customer_name', { maxLength: 100 })}
          {renderInput('phone', { inputMode: 'tel', maxLength: 16 })}
          {renderInput('address', { multiline: true, maxLength: 500 })}
          {renderInput('city', { maxLength: 100 })}
          {renderInput('state', { maxLength: 100 })}
          {renderInput('pincode', { inputMode: 'numeric', maxLength: 6 })}
        </div>
        <p className="form-hint">
          Only this order's shipping details change. The customer's account, other orders, payment,
          totals and order status are not affected.
        </p>
      </form>
    </Modal>
  );
}
