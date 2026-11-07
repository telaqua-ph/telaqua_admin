import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { deriveOrderConfirmationStatus } from '../../utils/orderConfirmationStatus';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import '../../styles/shared.css';
import '../Orders/Orders.css';

const PAGE_SIZE = 10;

/**
 * Orders entered from Add COD Order. Website orders stay on the Orders page.
 */
export default function OfflineSold() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const list = await getOrders();
      setOrders(list.filter((order) => order.offlineSold));
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
  ];

  if (loading) return <div className="loading-state">Loading offline sold orders…</div>;

  return (
    <div className="page orders">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Offline Sold</h2>
          <p>Orders added from Add COD Order, including past manual orders. Each row keeps the customer, amount, and Offline Sold type.</p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

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
          emptyMessage="No offline sold orders yet. Add one from Orders → Add COD Order."
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
