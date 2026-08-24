import { useCallback, useEffect, useMemo, useState } from 'react';
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
  extractLabelUrl,
  extractNdrReason,
  extractWaybillFromResponse,
  hasWaybill,
  isShipmentCreated,
  looksLikeNdr,
  openLabelAsset,
} from '../../utils/shipmentHelpers';
import {
  extractBackendMessage,
  interpretShipmentError,
  mentionsPartialSave,
  sanitizeTechnicalMessage,
} from '../../utils/shipmentErrorMessages';
import {
  buildFulfillmentTimeline,
  extractTrackingEvents,
  fulfillmentListLabel,
} from '../../utils/fulfillmentTimeline';
import '../../styles/shared.css';
import './OrderDetails.css';

const emptyPickup = {
  pickup_date: '',
  pickup_time: '18:30:00',
  expected_package_count: 1,
};

const emptyEditForm = {
  phone: '',
  name: '',
  add: '',
  cod: '',
  gm: '',
  shipment_length: '',
  shipment_width: '',
  shipment_height: '',
  product_details: '',
  pt: '',
};

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
  const [trackingPayload, setTrackingPayload] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [logisticsChecks, setLogisticsChecks] = useState({
    serviceability: null,
    tat: null,
    rate: null,
  });
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
  const [editOpen, setEditOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [ndrOpen, setNdrOpen] = useState(false);
  const [ndrActions, setNdrActions] = useState([]);

  const [editForm, setEditForm] = useState(emptyEditForm);
  const [pickupForm, setPickupForm] = useState(emptyPickup);
  const [ndrForm, setNdrForm] = useState({
    act: 'RE-ATTEMPT',
    deferred_date: '',
    name: '',
    phone: '',
    add: '',
  });

  const statuses = getOrderStatuses();
  const paymentStatuses = getPaymentStatuses();

  const refreshOrder = useCallback(async () => {
    const [data, logistics] = await Promise.all([
      getOrderById(id),
      delhivery.getOrderLogistics(id).catch(() => null),
    ]);
    setOrder(data);
    setTrackingHistory(Array.isArray(logistics?.tracking_history) ? logistics.tracking_history : []);
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
        const [data, logistics] = await Promise.all([
          getOrderById(id),
          delhivery.getOrderLogistics(id).catch(() => null),
        ]);
        if (!active) return;
        if (!data) {
          setError('Order not found');
          setOrder(null);
          return;
        }
        setOrder(data);
        setTrackingHistory(Array.isArray(logistics?.tracking_history) ? logistics.tracking_history : []);
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
  const showNdr = looksLikeNdr(order);
  const labelReady = Boolean(
    order?.labelData &&
      String(order.labelData).trim() &&
      String(order.labelData).trim() !== '—'
  );

  const labelUrl = useMemo(
    () => extractLabelUrl(null, order?.labelData),
    [order?.labelData]
  );
  const displayedShippingCharge = order?.shippingCharge ?? logisticsChecks.rate?.shipping_charge ?? null;

  const runAction = async (key, fn, successMsg) => {
    setActionLoading(key);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      await refreshOrder();
      if (successMsg) setMessage(successMsg);
      return result;
    } catch (err) {
      if (err.status !== 401) {
        const raw = sanitizeTechnicalMessage(
          extractBackendMessage(err) || err.message || 'Action failed'
        );
        setError(raw || 'Action failed');
      }
      try {
        await refreshOrder();
      } catch {
        /* ignore refresh failure */
      }
      return null;
    } finally {
      setActionLoading('');
    }
  };

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
        extractWaybillFromResponse(result) ||
        '';

      setConfirmOpen(false);
      setShipmentSuccess({
        waybill: waybill || refreshed?.waybill || '—',
        status: refreshed?.shipmentStatus || 'Created',
        createdAt: refreshed?.shipmentCreatedAtLabel || 'Just now',
      });
      setMessage('Shipment Created Successfully');
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

  const handleCheckServiceability = async () => {
    const result = await runAction(
      'serviceability',
      () => delhivery.checkServiceability(order.pincode, { order_id: order.id }),
      null
    );
    if (result) {
      setLogisticsChecks((current) => ({ ...current, serviceability: result }));
      setMessage(result.serviceable ? 'Pincode is serviceable.' : 'Pincode is not serviceable.');
    }
  };

  const handleCheckTat = async () => {
    const result = await runAction(
      'tat',
      () => delhivery.getTat({ destination_pin: order.pincode, order_id: order.id }),
      'Delivery estimate updated.'
    );
    if (result) setLogisticsChecks((current) => ({ ...current, tat: result }));
  };

  const handleCalculateRate = async () => {
    const result = await runAction(
      'rate',
      () => delhivery.getRate({ d_pin: order.pincode, order_id: order.id }),
      'Shipping charge calculated.'
    );
    if (result) setLogisticsChecks((current) => ({ ...current, rate: result }));
  };

  const handleGenerateWaybill = async () => {
    await runAction(
      'waybill',
      () => delhivery.getWaybill({ order_id: order.id }),
      'Waybill generated.'
    );
  };

  const handleViewLabel = () => {
    openLabelAsset(labelUrl, { download: false });
  };

  const handleDownloadLabel = () => {
    openLabelAsset(labelUrl, {
      download: true,
      filename: `label-${order?.waybill || order?.orderNumber || 'shipment'}.pdf`,
    });
  };

  const handlePrintLabel = () => {
    if (!labelUrl) return;
    const win = window.open(labelUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      openLabelAsset(labelUrl, { download: false });
      return;
    }
    const tryPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* browser may block print until load */
      }
    };
    win.addEventListener?.('load', tryPrint);
    setTimeout(tryPrint, 800);
  };

  const handleRefreshTracking = async () => {
    if (!order?.waybill || actionLoading === 'tracking') return;
    const result = await runAction(
      'tracking',
      () =>
        delhivery.getTracking(order.waybill, {
          order_id: Number(order.id) || order.id,
        }),
      'Tracking refreshed.'
    );
    if (result) setTrackingPayload(result);
  };

  const openEditShipment = () => {
    setEditForm({
      ...emptyEditForm,
      phone: order.phone || '',
      name: order.customerName || '',
      add: order.address || '',
      cod: order.paymentMethod?.toLowerCase?.().includes('cod')
        ? String(order.total || '')
        : '',
      product_details: order.product || '',
    });
    setEditOpen(true);
  };

  const handleUpdateShipment = async () => {
    if (!order?.waybill || actionLoading === 'update') return;
    const body = { waybill: order.waybill };
    const optionalKeys = [
      'phone',
      'name',
      'add',
      'cod',
      'gm',
      'shipment_length',
      'shipment_width',
      'shipment_height',
      'product_details',
      'pt',
    ];
    optionalKeys.forEach((key) => {
      const value = String(editForm[key] ?? '').trim();
      if (value) body[key] = value;
    });

    if (Object.keys(body).length <= 1) {
      setError('Enter at least one field to update.');
      return;
    }

    await runAction(
      'update',
      () => delhivery.updateShipment({ ...body, order_id: order.id }),
      'Shipment updated successfully'
    );
    setEditOpen(false);
  };

  const openPickup = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPickupForm({
      ...emptyPickup,
      pickup_date: tomorrow.toISOString().slice(0, 10),
      expected_package_count: 1,
    });
    setPickupOpen(true);
  };

  const handleRequestPickup = async () => {
    if (actionLoading === 'pickup') return;
    if (
      !pickupForm.pickup_date ||
      !pickupForm.pickup_time
    ) {
      setError('Pickup date and time are required.');
      return;
    }

    const alreadyRequested = String(order?.pickupStatus || '')
      .toLowerCase()
      .includes('request');
    if (alreadyRequested) {
      const ok = window.confirm(
        'Pickup appears already requested for this order. Request again?'
      );
      if (!ok) return;
    }

    await runAction(
      'pickup',
      () =>
        delhivery.requestPickup({
          pickup_time: pickupForm.pickup_time,
          pickup_date: pickupForm.pickup_date,
          expected_package_count: Number(pickupForm.expected_package_count) || 1,
          order_id: Number(order.id) || order.id,
          waybill: order.waybill || undefined,
        }),
      'Pickup Requested'
    );
    setPickupOpen(false);
  };

  const handleSubmitNdr = async () => {
    if (!order?.waybill || actionLoading === 'ndr') return;
    const item = { waybill: order.waybill, act: ndrForm.act };
    if (ndrForm.act === 'DEFER_DLV') {
      if (!ndrForm.deferred_date) {
        setError('Deferred date is required for DEFER_DLV.');
        return;
      }
      item.action_data = { deferred_date: ndrForm.deferred_date };
    }
    if (ndrForm.act === 'EDIT_DETAILS') {
      item.action_data = {};
      if (ndrForm.name.trim()) item.action_data.name = ndrForm.name.trim();
      if (ndrForm.phone.trim()) item.action_data.phone = ndrForm.phone.trim();
      if (ndrForm.add.trim()) item.action_data.add = ndrForm.add.trim();
      if (!Object.keys(item.action_data).length) {
        setError('Provide at least one field for EDIT_DETAILS.');
        return;
      }
    }

    const confirmed = window.confirm(
      `Submit NDR action "${ndrForm.act}" for AWB ${order.waybill}?`
    );
    if (!confirmed) return;

    await runAction(
      'ndr',
      () =>
        delhivery.submitNdr({
          data: [item],
          order_id: Number(order.id) || order.id,
        }),
      'NDR action submitted.'
    );
    setNdrOpen(false);
  };

  const handleOpenNdr = async () => {
    const details = await runAction(
      'ndr-load',
      () => delhivery.getNdr({ order_id: Number(order.id) || order.id }),
      null
    );
    if (!details) return;
    const actions = Array.isArray(details.actions) ? details.actions : [];
    if (!actions.length) {
      setError('Delhivery has not exposed any supported NDR action for the current shipment state.');
      return;
    }
    setNdrActions(actions);
    setNdrForm((current) => ({ ...current, act: actions[0] }));
    setNdrOpen(true);
  };

  const timeline = useMemo(
    () => buildFulfillmentTimeline(order),
    [order]
  );
  const trackingEvents = useMemo(
    () => trackingHistory.length
      ? trackingHistory.map((event) => ({
          label: event.status,
          at: event.event_time || event.created_at || '',
          location: event.location || '',
        }))
      : extractTrackingEvents(trackingPayload),
    [trackingHistory, trackingPayload]
  );
  const isDelivered =
    String(order?.trackingStatus || '')
      .toLowerCase()
      .includes('delivered') ||
    String(order?.shipmentStatus || '').toLowerCase() === 'delivered' ||
    String(order?.fulfillmentStatus || '').toLowerCase() === 'delivered';
  const pickupAlreadyRequested = Boolean(order?.pickupRequestedAt) ||
    /request|scheduled|confirmed/i.test(String(order?.pickupStatus || ''));

  if (loading) {
    return <div className="loading-state">Loading order…</div>;
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
            Placed {order.date} · <StatusBadge status={order.status} /> ·{' '}
            <StatusBadge status={order.paymentStatus} />
          </p>
        </div>
        <div className="order-details__header-actions">
          <Link to="/orders">
            <Button variant="secondary">Back</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} disabled={deleting || busy}>
            {deleting ? 'Deleting…' : 'Delete'}
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
            ✓
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
            ⚠
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
                <strong>₹{order.total}</strong>
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
                  <span>₹{order.unitPrice} each</span>
                  <strong>₹{order.total}</strong>
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
                <strong>{order.paymentId || '—'}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>₹{order.total}</strong>
              </div>
              <div>
                <span>Promo code</span>
                <strong>{order.promoCode || '—'}</strong>
              </div>
              {order.promoCode && Number(order.discountAmount) > 0 ? (
                <div>
                  <span>Discount</span>
                  <strong>₹{order.discountAmount}</strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Fulfillment / Delivery</h3>
              <StatusBadge
                status={order.shipmentStatusDisplay || fulfillmentListLabel(order)}
              />
            </div>
            <div className="panel__body order-details__fields">
              <div>
                <span>Carrier</span>
                <strong>Delhivery</strong>
              </div>
              <div>
                <span>Fulfillment Status</span>
                <strong>
                  <StatusBadge status={fulfillmentListLabel(order)} />
                </strong>
              </div>
              <div>
                <span>AWB</span>
                <div className="order-details__awb">
                  <strong className="order-details__awb-value">
                    {order.waybill || '—'}
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
                <strong>{order.delhiveryShipmentId || '—'}</strong>
              </div>
              <div>
                <span>Shipment created</span>
                <strong>{order.shipmentCreatedAtLabel}</strong>
              </div>
              <div>
                <span>Serviceability</span>
                <strong>
                  {order.serviceable == null
                    ? 'Not Checked'
                    : order.serviceable
                      ? 'Serviceable'
                      : 'Not Serviceable'}
                </strong>
                {order.serviceabilityMessage ? <p>{order.serviceabilityMessage}</p> : null}
                {order.serviceabilityCheckedAt ? <p>Checked: {order.serviceabilityCheckedAtLabel}</p> : null}
              </div>
              <div>
                <span>Estimated delivery</span>
                <strong>{order.expectedDeliveryDate || order.estimatedTat || 'Not Checked'}</strong>
                {order.expectedDeliveryDate && order.estimatedTat ? <p>{order.estimatedTat}</p> : null}
                {order.tatCheckedAt ? <p>Checked: {order.tatCheckedAtLabel}</p> : null}
              </div>
              <div>
                <span>Shipping charge</span>
                <strong>{displayedShippingCharge == null ? 'Not Calculated' : `₹${displayedShippingCharge}`}</strong>
                {order.rateCalculatedAt ? <p>Calculated: {order.rateCalculatedAtLabel}</p> : null}
              </div>
              <div>
                <span>Label</span>
                <strong>{order.labelStatus || (labelReady ? 'Generated' : 'Not Generated')}</strong>
                {order.labelGeneratedAt ? <p>{order.labelGeneratedAtLabel}</p> : null}
              </div>
              <div>
                <span>Pickup status</span>
                <strong>
                  <StatusBadge status={order.pickupStatus || 'Not Requested'} />
                </strong>
              </div>
              <div>
                <span>Pickup requested</span>
                <strong>{order.pickupRequestedAtLabel}</strong>
              </div>
              <div>
                <span>Pickup reference</span>
                <strong>{order.pickupReference || '—'}</strong>
                {order.pickupLocation ? <p>{order.pickupLocation}</p> : null}
              </div>
            </div>

            <div className="panel__body order-details__tracking">
              <h4>Tracking</h4>
              <div className="order-details__fields">
                <div>
                  <span>Current Status</span>
                  <strong>
                    {order.shipmentStatusDisplay || order.trackingStatus || 'Not Available'}
                  </strong>
                </div>
                <div>
                  <span>Status Time</span>
                  <strong>
                    {order.shipmentStatusUpdatedAtLabel || order.trackingUpdatedAtLabel || '—'}
                  </strong>
                </div>
                <div>
                  <span>Last Refreshed</span>
                  <strong>{order.trackingRefreshedAtLabel || '—'}</strong>
                </div>
                <div>
                  <span>Current Location</span>
                  <strong>{order.trackingLocation || 'Not Available'}</strong>
                </div>
                <div>
                  <span>AWB</span>
                  <strong>{order.waybill || '—'}</strong>
                </div>
              </div>
            </div>

            <div className="panel__body fulfillment-timeline">
              <h4>Shipment timeline</h4>
              <ol className="fulfillment-timeline__list">
                {timeline.map((stage) => (
                  <li
                    key={stage.id}
                    className={[
                      'fulfillment-timeline__item',
                      stage.done ? 'fulfillment-timeline__item--done' : '',
                      stage.current ? 'fulfillment-timeline__item--current' : '',
                      stage.failed ? 'fulfillment-timeline__item--failed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="fulfillment-timeline__dot" aria-hidden="true">
                      {stage.done ? '✓' : stage.failed ? '!' : ''}
                    </span>
                    <div>
                      <strong>{stage.label}</strong>
                      {stage.at ? <p>{stage.at}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {trackingEvents.length > 0 && (
              <div className="panel__body order-details__tracking-raw">
                <h4>Tracking events</h4>
                <ul className="tracking-events">
                  {trackingEvents.map((event, index) => (
                    <li key={`${event.label}-${index}`}>
                      <strong>{event.label}</strong>
                      {event.at ? <span>{event.at}</span> : null}
                      {event.location ? <span>{event.location}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trackingPayload && trackingEvents.length === 0 && (
              <div className="panel__body order-details__tracking-raw">
                <h4>Latest tracking response</h4>
                <pre>{JSON.stringify(trackingPayload, null, 2)}</pre>
              </div>
            )}
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
                  {saving ? 'Saving…' : 'Save'}
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
                <strong>{order.email || '—'}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{order.phone || '—'}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Shipping address</h3>
            </div>
            <div className="panel__body">
              <p className="order-details__address">{order.fullAddress || '—'}</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h3>Delivery actions</h3>
            </div>
            <div className="panel__body order-details__actions">
              <Button
                variant="secondary"
                disabled={busy || actionLoading === 'serviceability' || !order.pincode}
                onClick={handleCheckServiceability}
              >
                {actionLoading === 'serviceability' ? 'Checking…' : 'Check Serviceability'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || actionLoading === 'tat' || !order.pincode}
                onClick={handleCheckTat}
              >
                {actionLoading === 'tat' ? 'Checking…' : 'Check Estimated Delivery'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || actionLoading === 'rate' || !order.pincode}
                onClick={handleCalculateRate}
              >
                {actionLoading === 'rate' ? 'Calculating…' : 'Calculate Shipping Charge'}
              </Button>

              {(order.serviceable != null || logisticsChecks.serviceability) && (
                <p className="form-hint">
                  Serviceability: <strong>{(order.serviceable ?? logisticsChecks.serviceability?.serviceable) ? 'Serviceable' : 'Not Serviceable'}</strong>
                </p>
              )}
              {(order.expectedDeliveryDate || order.estimatedTat || logisticsChecks.tat) && (
                <p className="form-hint">
                  Estimated delivery: <strong>{order.expectedDeliveryDate || order.estimatedTat || logisticsChecks.tat?.expected_delivery_date || logisticsChecks.tat?.estimated_tat || 'See API message'}</strong>
                </p>
              )}
              {displayedShippingCharge != null && (
                <p className="form-hint">
                  Shipping charge: <strong>₹{displayedShippingCharge}</strong>
                </p>
              )}

              {!shipmentReady && !waybillReady && createAllowed && (
                <Button
                  variant="outline-primary"
                  disabled={busy || actionLoading === 'waybill'}
                  onClick={handleGenerateWaybill}
                >
                  {actionLoading === 'waybill' ? 'Generating…' : 'Generate Waybill'}
                </Button>
              )}
              {!shipmentReady && (
                <Button
                  disabled={busy || !createAllowed || !waybillReady || actionLoading === 'create'}
                  onClick={() => {
                    setShipmentFailure(null);
                    setShowTechnicalDetails(false);
                    setConfirmOpen(true);
                  }}
                >
                  {actionLoading === 'create'
                    ? 'Creating Shipment...'
                    : 'Create Shipment'}
                </Button>
              )}
              {!createAllowed && !shipmentReady && (
                <p className="form-hint">
                  Shipment is blocked until payment is paid.
                </p>
              )}
              {createAllowed && !waybillReady && !shipmentReady && (
                <p className="form-hint">Generate one waybill before creating the shipment.</p>
              )}

              {shipmentReady && waybillReady && (
                <>
                  {!isDelivered && (
                    <>
                      {labelReady && (
                        <>
                          <p className="form-hint">✓ Label Generated</p>
                          {labelUrl ? (
                            <>
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={handleViewLabel}
                              >
                                View Label
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={handleDownloadLabel}
                              >
                                Download Label
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={handlePrintLabel}
                              >
                                Print Label
                              </Button>
                            </>
                          ) : (
                            <p className="form-hint">
                              The saved label has no downloadable PDF/URL.
                            </p>
                          )}
                        </>
                      )}

                      <Button
                        variant="secondary"
                        disabled={
                          busy || pickupAlreadyRequested || actionLoading === 'pickup'
                        }
                        onClick={openPickup}
                      >
                        {pickupAlreadyRequested
                          ? 'Pickup Requested'
                          : actionLoading === 'pickup'
                          ? 'Requesting…'
                          : 'Request Pickup'}
                      </Button>
                    </>
                  )}

                  <Button
                    variant="secondary"
                    disabled={busy || actionLoading === 'tracking'}
                    onClick={handleRefreshTracking}
                  >
                    {actionLoading === 'tracking'
                      ? 'Refreshing…'
                      : 'Track Shipment'}
                  </Button>

                  {!isDelivered && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={openEditShipment}
                    >
                      Update Shipment
                    </Button>
                  )}
                </>
              )}

              {showNdr && !isDelivered && (
                <div className="order-details__ndr">
                  <h4>⚠ Delivery Exception / NDR</h4>
                  <p className="form-hint">
                    {extractNdrReason(order, trackingPayload) ||
                      'Tracking or shipment indicates an NDR / exception.'}
                  </p>
                  <Button
                    variant="outline-primary"
                    disabled={busy || actionLoading === 'ndr-load'}
                    onClick={handleOpenNdr}
                  >
                    {actionLoading === 'ndr-load' ? 'Loading Actions…' : 'Open NDR Actions'}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Confirm shipment */}
      <Modal
        open={confirmOpen}
        title={`Confirm shipment for ${order.orderNumber}?`}
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
                ? 'Creating Shipment...'
                : 'Confirm & Create'}
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
              {order.product} × {order.quantity}
            </strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>₹{order.total}</strong>
          </div>
          <div>
            <span>Shipping address</span>
            <strong>{order.fullAddress}</strong>
          </div>
        </div>
      </Modal>

      {/* Edit shipment */}
      <Modal
        open={editOpen}
        title="Edit shipment"
        onClose={() => !busy && setEditOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || actionLoading === 'update'}
              onClick={handleUpdateShipment}
            >
              {actionLoading === 'update' ? 'Updating…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group form-group--full">
            <label htmlFor="edit-name">Name</label>
            <input
              id="edit-name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="edit-phone">Phone</label>
            <input
              id="edit-phone"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="edit-add">Address</label>
            <textarea
              id="edit-add"
              value={editForm.add}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, add: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-cod">COD amount</label>
            <input
              id="edit-cod"
              value={editForm.cod}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, cod: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-gm">Weight (gm)</label>
            <input
              id="edit-gm"
              value={editForm.gm}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, gm: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-length">Length</label>
            <input
              id="edit-length"
              value={editForm.shipment_length}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, shipment_length: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-width">Width</label>
            <input
              id="edit-width"
              value={editForm.shipment_width}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, shipment_width: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-height">Height</label>
            <input
              id="edit-height"
              value={editForm.shipment_height}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, shipment_height: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-pt">Payment type (pt)</label>
            <input
              id="edit-pt"
              placeholder="COD / Pre-paid"
              value={editForm.pt}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, pt: e.target.value }))
              }
            />
          </div>
          <div className="form-group form-group--full">
            <label htmlFor="edit-product">Product details</label>
            <input
              id="edit-product"
              value={editForm.product_details}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, product_details: e.target.value }))
              }
            />
          </div>
          <p className="form-hint form-group--full">
            Only filled fields are sent. Waybill is required and added automatically.
          </p>
        </div>
      </Modal>

      {/* Pickup */}
      <Modal
        open={pickupOpen}
        title="Request pickup"
        onClose={() => !busy && setPickupOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPickupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || actionLoading === 'pickup'}
              onClick={handleRequestPickup}
            >
              {actionLoading === 'pickup' ? 'Requesting…' : 'Request pickup'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="pickup-date">Pickup date</label>
            <input
              id="pickup-date"
              type="date"
              value={pickupForm.pickup_date}
              onChange={(e) =>
                setPickupForm((f) => ({ ...f, pickup_date: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="pickup-time">Pickup time</label>
            <input
              id="pickup-time"
              type="time"
              step="1"
              value={pickupForm.pickup_time}
              onChange={(e) =>
                setPickupForm((f) => ({
                  ...f,
                  pickup_time: e.target.value.length === 5
                    ? `${e.target.value}:00`
                    : e.target.value,
                }))
              }
              required
            />
          </div>
          <p className="form-hint form-group--full">
            Delhivery will use the registered backend warehouse/pickup-location name.
          </p>
          <div className="form-group">
            <label htmlFor="pickup-count">Expected package count</label>
            <input
              id="pickup-count"
              type="number"
              min="1"
              value={pickupForm.expected_package_count}
              onChange={(e) =>
                setPickupForm((f) => ({
                  ...f,
                  expected_package_count: e.target.value,
                }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* NDR */}
      <Modal
        open={ndrOpen}
        title="NDR action"
        onClose={() => !busy && setNdrOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setNdrOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || actionLoading === 'ndr'}
              onClick={handleSubmitNdr}
            >
              {actionLoading === 'ndr' ? 'Submitting…' : 'Submit NDR'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group form-group--full">
            <label htmlFor="ndr-act">Action</label>
            <select
              id="ndr-act"
              value={ndrForm.act}
              onChange={(e) =>
                setNdrForm((f) => ({ ...f, act: e.target.value }))
              }
            >
              {ndrActions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          {ndrForm.act === 'DEFER_DLV' && (
            <div className="form-group form-group--full">
              <label htmlFor="ndr-date">Deferred date</label>
              <input
                id="ndr-date"
                type="date"
                value={ndrForm.deferred_date}
                onChange={(e) =>
                  setNdrForm((f) => ({ ...f, deferred_date: e.target.value }))
                }
              />
            </div>
          )}
          {ndrForm.act === 'EDIT_DETAILS' && (
            <>
              <div className="form-group form-group--full">
                <label htmlFor="ndr-name">Name</label>
                <input
                  id="ndr-name"
                  value={ndrForm.name}
                  onChange={(e) =>
                    setNdrForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="ndr-phone">Phone</label>
                <input
                  id="ndr-phone"
                  value={ndrForm.phone}
                  onChange={(e) =>
                    setNdrForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="ndr-add">Address</label>
                <textarea
                  id="ndr-add"
                  value={ndrForm.add}
                  onChange={(e) =>
                    setNdrForm((f) => ({ ...f, add: e.target.value }))
                  }
                />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
