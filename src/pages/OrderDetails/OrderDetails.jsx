import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteOrder,
  getOrderById,
  getOrderStatuses,
  getPaymentStatuses,
  markOrderSeen,
  updateOrderStatus,
} from '../../services/api';
import * as delhivery from '../../services/delhivery';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { Modal } from '../../components/Modal';
import {
  canCreateShipment,
  extractWaybillFromResponse,
  hasWaybill,
  isShipmentCreated,
} from '../../utils/shipmentHelpers';
import {
  extractBackendMessage,
  interpretShipmentError,
  mentionsPartialSave,
  sanitizeTechnicalMessage,
} from '../../utils/shipmentErrorMessages';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import '../../styles/shared.css';
import './OrderDetails.css';

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [shipmentFailure, setShipmentFailure] = useState(null);
  const [shipmentSuccess, setShipmentSuccess] = useState(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  const handleCopyAwb = async () => {
    if (!order?.waybill) return;
    try {
      await navigator.clipboard.writeText(String(order.waybill));
      setCopyMsg('AWB copied');
      setTimeout(() => setCopyMsg(''), 2000);
    } catch {
      setCopyMsg('Could not copy AWB');
      setTimeout(() => setCopyMsg(''), 2000);
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  const statuses = getOrderStatuses();
  const paymentStatuses = getPaymentStatuses();

  const refreshOrder = useCallback(async () => {
    const data = await getOrderById(id);
    setOrder(data);
    if (data) {
      setStatus(data.status);
      setPaymentStatus(data.paymentStatus);
    }
    return data;
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getOrderById(id);
        if (!active) return;
        if (!data) {
          setError('Order not found');
          setOrder(null);
          return;
        }
        setOrder(data);
        setStatus(data.status);
        setPaymentStatus(data.paymentStatus);
        markOrderSeen(id).catch(() => {});
      } catch (err) {
        if (!active) return;
        if (err.status !== 401) setError(err.message || 'Failed to load order');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const hasChanges =
    status !== order?.status || paymentStatus !== order?.paymentStatus;

  const shipmentReady = isShipmentCreated(order);
  const waybillReady = hasWaybill(order);
  const createAllowed = canCreateShipment(order);

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await updateOrderStatus(id, status, paymentStatus);
      setOrder(updated);
      setMessage('Order status saved.');
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const label = order?.orderNumber || id;
    if (!window.confirm(`Delete order "${label}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteOrder(id);
      navigate('/orders', { replace: true });
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  const handleCreateShipment = async () => {
    if (actionLoading === 'create') return;

    setActionLoading('create');
    setError('');
    setMessage('');
    setShipmentFailure(null);
    setShipmentSuccess(null);
    setShowTechnicalDetails(false);

    try {
      const result = await delhivery.createShipment({
        order_id: Number(order.id) || order.id,
      });

      const refreshed = await refreshOrder();
      const waybill =
        refreshed?.waybill ||
        result?.awb ||
        result?.waybill ||
        extractWaybillFromResponse(result) ||
        '';
      const alreadyCreated =
        String(result?.message || '').toLowerCase() ===
        'shipment already created';

      setConfirmOpen(false);
      setShipmentSuccess({
        waybill: waybill || refreshed?.waybill || 'â€”',
        status: refreshed?.shipmentStatus || 'Created',
        createdAt: refreshed?.shipmentCreatedAtLabel || 'Just now',
      });
      setMessage(
        alreadyCreated
          ? 'Shipment already created'
          : 'Shipment Created Successfully'
      );
    } catch (err) {
      if (err.status === 401) return;

      const rawMessage = sanitizeTechnicalMessage(
        extractBackendMessage(err) || err.message || ''
      );
      const interpreted = interpretShipmentError(rawMessage, err.status);

      let refreshed = null;
      try {
        refreshed = await refreshOrder();
      } catch {
        /* ignore */
      }

      const partial =
        hasWaybill(refreshed) || mentionsPartialSave(rawMessage);

      setConfirmOpen(false);
      setShipmentFailure({
        title: interpreted.title,
        explanation: interpreted.explanation,
        technical: rawMessage,
        partial,
        waybill: refreshed?.waybill || '',
      });

      if (partial && refreshed?.waybill) {
        setShipmentSuccess(null);
      }
    } finally {
      setActionLoading('');
    }
  };

  const handleTrackShipment = () => {
    const awb = String(order?.waybill || '').trim();
    if (!awb) return;
    window.open(
      `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (loading) {
    return <div className="loading-state">Loading orderâ€¦</div>;
  }

  if (!order) {
    return (
      <div className="page">
        <div className="alert alert--error">{error || 'Order not found'}</div>
        <Link to="/orders">
          <Button variant="secondary">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const busy = Boolean(actionLoading);

  return (
    <div className="page order-details">
      <div className="page__header">
        <div className="page__header-text">
          <p className="order-details__eyebrow">Order</p>
          <h2>{order.orderNumber}</h2>
          <p>
            Placed {order.date} Â· <StatusBadge status={order.status} /> Â·{' '}
            <StatusBadge status={order.paymentStatus} />
          </p>
        </div>
        <div className="order-details__header-actions">
          <Link to="/orders">
            <Button variant="secondary">Back</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} disabled={deleting || busy}>
            {deleting ? 'Deletingâ€¦' : 'Delete'}
          </Button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && !shipmentSuccess && (
        <div className="alert alert--success">{message}</div>
      )}

      {shipmentSuccess && (
        <div className="shipment-alert shipment-alert--success" role="status">
          <div className="shipment-alert__icon" aria-hidden="true">
            âœ“
          </div>
          <div className="shipment-alert__content">
            <h4>Shipment Created Successfully</h4>
            <div className="shipment-alert__meta">
              <p>
                <span>AWB</span>
                <strong>{shipmentSuccess.waybill}</strong>
              </p>
              <p>
                <span>Status</span>
                <strong>{shipmentSuccess.status}</strong>
              </p>
              <p>
                <span>Created</span>
                <strong>{shipmentSuccess.createdAt}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {shipmentFailure && (
        <div className="shipment-alert shipment-alert--error" role="alert">
          <div className="shipment-alert__icon" aria-hidden="true">
            âš 
          </div>
          <div className="shipment-alert__content">
            <h4>{shipmentFailure.title}</h4>
            <p className="shipment-alert__text">{shipmentFailure.explanation}</p>
            {shipmentFailure.partial && (
              <p className="shipment-alert__partial">
                Shipment may have been partially created
                {shipmentFailure.waybill
                  ? ` (AWB: ${shipmentFailure.waybill})`
                  : ''}
                . Please verify the AWB before trying again.
              </p>
            )}
            <div className="shipment-alert__actions">
              {!hasWaybill(order) && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setShipmentFailure(null);
                    setShowTechnicalDetails(false);
                    setConfirmOpen(true);
                  }}
                >
                  Try Again
                </Button>
              )}
              {shipmentFailure.technical && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowTechnicalDetails((v) => !v)}
                >
                  {showTechnicalDetails ? 'Hide Details' : 'View Details'}
                </Button>
              )}
            </div>
            {showTechnicalDetails && shipmentFailure.technical && (
              <div className="shipment-alert__technical">
                <p className="shipment-alert__technical-label">
                  Technical details
                </p>
                <pre>{shipmentFailure.technical}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {order.shipmentError && !shipmentFailure && (
        <div className="alert alert--error">
          Shipment error: {sanitizeTechnicalMessage(order.shipmentError)}
        </div>
      )}

      <div className="order-details__layout">
        <div className="order-details__main">
          <section className="panel">
            <div className="panel__header">
              <h3>Order summary</h3>
              <StatusBadge status={order.shipmentStatus} />
            </div>
            <div className="panel__body order-details__fields">
              <div>
                <span>Order number</span>
                <strong>{order.orderNumber}</strong>
              </div>
              <div>
                <span>Order date</span>
                <strong>{order.date}</strong>
              </div>
              <div>
                <span>Order status</span>
                <strong>
                  <StatusBadge status={order.status} />
                </strong>
              </div>
              <div>
                <span>Payment status</span>
                <strong>
                  <StatusBadge status={order.paymentStatus} />
                </strong>
              </div>
              <div>
                <span>Payment method</span>
                <strong>{order.paymentMethod}</strong>
              </div>
              <div>
                <span>Total amount</span>
                <strong>â‚¹{order.total}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Products</h3>
            </div>
            <div className="panel__body">
              <div className="order-details__product-row">
                <div>
                  <strong>{order.product}</strong>
                  <p className="muted">Qty {order.quantity}</p>
                </div>
                <div className="order-details__product-price">
                  <span>â‚¹{order.unitPrice} each</span>
                  <strong>â‚¹{order.total}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Payment</h3>
            </div>
            <div className="panel__body order-details__fields">
              <div>
                <span>Payment method</span>
                <strong>{order.paymentMethod}</strong>
              </div>
              <div>
                <span>Payment status</span>
                <strong>
                  <StatusBadge status={order.paymentStatus} />
                </strong>
              </div>
              <div>
                <span>Payment ID</span>
                <strong>{order.paymentId || 'â€”'}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>â‚¹{order.total}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Fulfillment</h3>
              <StatusBadge status={fulfillmentListLabel(order)} />
            </div>
            <div className="panel__body order-details__fields">
              <div>
                <span>Delivery</span>
                <strong>{order.waybill ? 'Delhivery' : 'Not Created'}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  <StatusBadge
                    status={
                      order.waybill
                        ? order.shipmentStatus || 'Created'
                        : 'Not Created'
                    }
                  />
                </strong>
              </div>
              <div>
                <span>AWB</span>
                <div className="order-details__awb">
                  <strong className="order-details__awb-value">
                    {order.waybill || 'â€”'}
                  </strong>
                  {order.waybill ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-primary"
                      onClick={handleCopyAwb}
                    >
                      Copy AWB
                    </Button>
                  ) : null}
                </div>
                {copyMsg ? (
                  <p className="form-hint order-details__copy-msg">{copyMsg}</p>
                ) : null}
              </div>
              <div>
                <span>Delhivery shipment ID</span>
                <strong>{order.delhiveryShipmentId || 'â€”'}</strong>
              </div>
              <div>
                <span>Shipment created</span>
                <strong>{order.shipmentCreatedAtLabel}</strong>
              </div>
            </div>

            {waybillReady ? (
              <div className="panel__body">
                <p className="form-hint">
                  After AWB is created, use{' '}
                  <a
                    href="https://one.delhivery.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Delhivery One
                  </a>{' '}
                  for pickup, labels, and remaining delivery logistics.
                </p>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Update order status</h3>
            </div>
            <form className="panel__body" onSubmit={handleSaveStatus}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="status">Order status</label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {!statuses.includes(status) && status ? (
                      <option value={status}>{status}</option>
                    ) : null}
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="paymentStatus">Payment status</label>
                  <select
                    id="paymentStatus"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    {!paymentStatuses.includes(paymentStatus) && paymentStatus ? (
                      <option value={paymentStatus}>{paymentStatus}</option>
                    ) : null}
                    {paymentStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <Button type="submit" disabled={saving || !hasChanges}>
                  {saving ? 'Savingâ€¦' : 'Save'}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <aside className="order-details__aside">
          <section className="panel">
            <div className="panel__header">
              <h3>Customer</h3>
            </div>
            <div className="panel__body order-details__stack">
              <div>
                <span>Name</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{order.email || 'â€”'}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{order.phone || 'â€”'}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Shipping address</h3>
            </div>
            <div className="panel__body">
              <p className="order-details__address">{order.fullAddress || 'â€”'}</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Delivery actions</h3>
            </div>
            <div className="panel__body order-details__actions">
              <div className="order-details__stack">
                <div>
                  <span>Payment</span>
                  <strong>
                    <StatusBadge status={order.paymentStatus} />
                  </strong>
                </div>
                <div>
                  <span>Delivery</span>
                  <strong>{order.waybill ? 'Delhivery' : 'Not Created'}</strong>
                </div>
                {order.waybill ? (
                  <>
                    <div>
                      <span>Status</span>
                      <strong>{order.shipmentStatus || 'Created'}</strong>
                    </div>
                    <div>
                      <span>AWB</span>
                      <strong>{order.waybill}</strong>
                    </div>
                  </>
                ) : null}
              </div>

              {!shipmentReady && (
                <Button
                  disabled={busy || !createAllowed || actionLoading === 'create'}
                  onClick={() => {
                    setShipmentFailure(null);
                    setShowTechnicalDetails(false);
                    setConfirmOpen(true);
                  }}
                >
                  {actionLoading === 'create'
                    ? 'Sending to Delhivery...'
                    : 'Send to Delhivery'}
                </Button>
              )}
              {!createAllowed && !shipmentReady && (
                <p className="form-hint">
                  Prepaid orders must be Paid before sending to Delhivery.
                </p>
              )}

              {waybillReady && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={handleTrackShipment}
                >
                  Track Shipment
                </Button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Confirm shipment */}
      <Modal
        open={confirmOpen}
        title={`Send ${order.orderNumber} to Delhivery?`}
        onClose={() => !busy && setConfirmOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || actionLoading === 'create'}
              onClick={handleCreateShipment}
            >
              {actionLoading === 'create'
                ? 'Sending to Delhivery...'
                : 'Send to Delhivery'}
            </Button>
          </>
        }
      >
        <div className="order-details__stack">
          <div>
            <span>Customer</span>
            <strong>{order.customerName}</strong>
          </div>
          <div>
            <span>Product</span>
            <strong>
              {order.product} Ã— {order.quantity}
            </strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>â‚¹{order.total}</strong>
          </div>
          <div>
            <span>Shipping address</span>
            <strong>{order.fullAddress}</strong>
          </div>
        </div>
      </Modal>
    </div>
  );
}
