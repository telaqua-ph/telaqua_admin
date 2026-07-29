import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteOrder,
  getOrderById,
  getOrderStatuses,
  getPaymentStatuses,
  updateOrderStatus,
} from '../../services/api';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const statuses = getOrderStatuses();
  const paymentStatuses = getPaymentStatuses();

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
      } catch (err) {
        if (!active) return;
        if (err.status !== 401) {
          setError(err.message || 'Failed to load order');
        }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await updateOrderStatus(id, status, paymentStatus);
      setOrder(updated);
      setStatus(updated.status);
      setPaymentStatus(updated.paymentStatus);
      setMessage('Order details saved successfully.');
    } catch (err) {
      if (err.status !== 401) {
        setMessage('');
        setError(err.message || 'Failed to save order details.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const label = order?.orderNumber || id;
    const confirmed = window.confirm(
      `Delete order "${label}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      await deleteOrder(id);
      navigate('/orders', { replace: true });
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Failed to delete order');
      }
      setDeleting(false);
    }
  };

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

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Order {order.orderNumber}</h2>
          <p>Review customer details and update status</p>
        </div>
        <div className="order-details__header-actions">
          <Link to="/orders">
            <Button variant="secondary">Back to Orders</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      <div className="order-details__grid">
        <section className="panel">
          <div className="panel__header">
            <h3>Customer Information</h3>
            <StatusBadge status={order.status} />
          </div>
          <div className="panel__body order-details__fields">
            <div>
              <span>Customer Name</span>
              <strong>{order.customerName}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{order.phone}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{order.email || '—'}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{order.city || '—'}</strong>
            </div>
            <div>
              <span>State</span>
              <strong>{order.state || '—'}</strong>
            </div>
            <div>
              <span>Pincode</span>
              <strong>{order.pincode || '—'}</strong>
            </div>
            <div className="order-details__full">
              <span>Address</span>
              <strong>{order.fullAddress || order.address || '—'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h3>Order Information</h3>
            <StatusBadge status={order.paymentStatus} />
          </div>
          <div className="panel__body order-details__fields">
            <div>
              <span>Order Number</span>
              <strong>{order.orderNumber}</strong>
            </div>
            <div>
              <span>Quantity</span>
              <strong>{order.quantity}</strong>
            </div>
            <div>
              <span>Unit Price</span>
              <strong>₹{order.unitPrice}</strong>
            </div>
            <div>
              <span>Total Amount</span>
              <strong>₹{order.total}</strong>
            </div>
            <div>
              <span>Order Date</span>
              <strong>{order.date}</strong>
            </div>
            <div>
              <span>Payment Method</span>
              <strong>{order.paymentMethod}</strong>
            </div>
            <div>
              <span>Order Status</span>
              <strong>
                <StatusBadge status={order.status} />
              </strong>
            </div>
            <div>
              <span>Payment Status</span>
              <strong>
                <StatusBadge status={order.paymentStatus} />
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Update Status</h3>
        </div>
        <form className="panel__body" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="status">Order Status</label>
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
              <label htmlFor="paymentStatus">Payment Status</label>
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
  );
}
