import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteOrder, getOrders } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import AddCodOrderButton from '../../components/AddCodOrder/AddCodOrderButton';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { deriveOrderConfirmationStatus } from '../../utils/orderConfirmationStatus';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import { orderPurchasedOnDate } from '../../utils/orderDateRange';
import '../../styles/shared.css';
import '../Orders/Orders.css';

const PAGE_SIZE = 10;
const OFFLINE_SOLD_TYPES = new Set(['cod paid-cash', 'cod paid-qr']);
/** Orders already on this list before the move stay on Orders only. */
const OFFLINE_SOLD_MOVED_BEFORE = Date.parse('2026-11-07T08:23:00.000Z');

/** 'YYYY-MM-DD' → '10 Nov 2026'. */
function formatPurchasedOn(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Cash and QR sales added after the existing list was moved to Orders. */
function isOfflineSoldOrder(order) {
  if (!OFFLINE_SOLD_TYPES.has(String(order?.offlineSold || '').trim().toLowerCase())) return false;
  const created = Date.parse(order?.createdAt || order?.created_at || '');
  return Number.isFinite(created) && created >= OFFLINE_SOLD_MOVED_BEFORE;
}
export default function OfflineSold() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setError('');
    try {
      const list = await getOrders();
      setOrders(list.filter(isOfflineSoldOrder));
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to load offline sold orders.');
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = async (order) => {
    const label = order.orderNumber || order.id;
    if (!window.confirm(`Delete order "${label}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrder(order.id);
      await load();
      setMessage(`Order ${label} deleted.`);
      setError('');
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to delete order');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      [
        order.orderNumber,
        order.customerName,
        order.phone,
        order.email,
        order.city,
        order.state,
        order.pincode,
        order.fullAddress,
        order.offlineSold,
        order.promoCode,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [orders, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns = [
    {
      key: 'orderNumber',
      label: 'Order',
      render: (row) => (
        <div className="orders__customer">
          <Link to={`/orders/${row.id}`}>
            <strong>{row.orderNumber || row.id}</strong>
          </Link>
          <span>{row.orderedDate || '—'}</span>
          <span>{row.orderedTime || '—'}</span>
        </div>
      ),
    },
    {
      key: 'customerName',
      label: 'Customer',
      render: (row) => (
        <div className="orders__customer">
          <strong>{row.customerName || '—'}</strong>
          <span>{row.email || '—'}</span>
          <span>{row.phone || '—'}</span>
          <span className="orders__address">{row.fullAddress || row.address || '—'}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (row) => row.quantity ?? '—',
    },
    {
      key: 'total',
      label: 'Total',
      render: (row) => `₹${row.total}`,
    },
    {
      key: 'offlineSold',
      label: 'Offline Sold',
      render: (row) => <StatusBadge status={row.offlineSold} />,
    },
    {
      key: 'purchasedOn',
      label: 'Purchased On',
      render: (row) => {
        const date = orderPurchasedOnDate(row);
        if (date) return formatPurchasedOn(date);
        return (
          <Link to={`/orders/${row.id}`} title="Open the order to set the Purchased On date">
            Not set
          </Link>
        );
      },
    },
    {
      key: 'orderConfirmationStatus',
      label: 'Order Status',
      render: (row) => <StatusBadge status={deriveOrderConfirmationStatus(row)} />,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => <StatusBadge status={row.paymentStatusLabel || row.paymentStatus} />,
    },
    {
      key: 'promoCode',
      label: 'Promo',
      render: (row) =>
        row.promoCode ? <strong className="orders__promo-code">{row.promoCode}</strong> : '—',
    },
    {
      key: 'shipment',
      label: 'Shipment',
      render: (row) => (
        <StatusBadge status={row.shipmentStatusDisplay || fulfillmentListLabel(row)} />
      ),
    },
    {
      key: 'waybill',
      label: 'AWB',
      render: (row) => row.waybill || '—',
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div className="orders__actions">
          <Link to={`/orders/${row.id}`}>
            <Button size="sm" variant="outline-primary">
              View
            </Button>
          </Link>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="loading-state">Loading offline sold orders…</div>;

  return (
    <div className="page orders">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Offline Sold</h2>
          <p>Orders added from Add COD Order, including past manual orders. Each row keeps the customer, amount, and Offline Sold type.</p>
        </div>
        <div className="orders__header-actions">
          <Button onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <AddCodOrderButton
            onCreated={async (created) => {
              await load();
              const number = created?.orderNumber || created?.id || '';
              setMessage(number ? `COD order ${number} created.` : 'COD order created.');
            }}
          />
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      <section className="panel">
        <div className="panel__header orders__toolbar-wrap">
          <div className="toolbar orders__toolbar">
            <div className="toolbar__search">
              <svg className="toolbar__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search name, phone, order, city"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="orders__page-indicator">
              {filtered.length} order{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={visible}
          emptyMessage="No offline sold orders yet. Add one with Add COD Order."
        />
        {filtered.length > PAGE_SIZE && (
          <div className="orders__table-pagination">
            <Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </Button>
            <span className="orders__page-indicator">Page {currentPage} of {pages}</span>
            <Button size="sm" variant="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
