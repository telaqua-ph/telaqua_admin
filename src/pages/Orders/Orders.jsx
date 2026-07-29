import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteOrder, getOrders, getOrderStatuses } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import '../../styles/shared.css';
import './Orders.css';

const PAGE_SIZE = 6;

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const statuses = getOrderStatuses();

  const loadOrders = async () => {
    const data = await getOrders();
    setOrders(data);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getOrders();
        if (active) setOrders(data);
      } catch (err) {
        if (active && err.status !== 401) {
          setError(err.message || 'Failed to load orders');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'All' || order.status === statusFilter;
      const matchesSearch =
        !q ||
        String(order.orderNumber || '').toLowerCase().includes(q) ||
        String(order.customerName || '').toLowerCase().includes(q) ||
        String(order.phone || '').toLowerCase().includes(q) ||
        String(order.email || '').toLowerCase().includes(q) ||
        String(order.city || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleDelete = async (order) => {
    const label = order.orderNumber || order.id;
    const confirmed = window.confirm(
      `Delete order "${label}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteOrder(order.id);
      await loadOrders();
      setMessage(`Order ${label} deleted.`);
      setError('');
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Failed to delete order');
      }
    }
  };

  const columns = [
    { key: 'orderNumber', label: 'Order ID' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'City' },
    { key: 'quantity', label: 'Quantity' },
    {
      key: 'total',
      label: 'Total',
      render: (row) => `₹${row.total}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    { key: 'date', label: 'Date' },
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
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="loading-state">Loading orders…</div>;
  }

  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Orders</h2>
          <p>Search, filter, and manage customer orders</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      <section className="panel">
        <div className="panel__header orders__toolbar-wrap">
          <div className="toolbar">
            <div className="toolbar__search">
              <svg
                className="toolbar__search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search orders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="toolbar__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={pageData}
          emptyMessage={
            error ? 'Unable to load orders.' : 'No orders match your filters.'
          }
        />

        <div className="pagination">
          <p className="pagination__info">
            Showing {from}–{to} of {filtered.length}
          </p>
          <div className="pagination__controls">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="orders__page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
