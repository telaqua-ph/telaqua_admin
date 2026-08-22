import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  deleteOrder,
  getOrderById,
  getOrders,
  getOrderStatuses,
  getPaymentStatuses,
} from '../../services/api';
import * as delhivery from '../../services/delhivery';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { exportOrdersToCsv } from '../../utils/exportOrdersCsv';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import { filterOrdersByMetric } from '../../utils/dashboardMetrics';
import {
  canCreateShipment,
  isShipmentCreated,
} from '../../utils/shipmentHelpers';
import {
  extractBackendMessage,
  sanitizeTechnicalMessage,
} from '../../utils/shipmentErrorMessages';
import '../../styles/shared.css';
import './Orders.css';

const PAGE_SIZE = 10;

const SHIPMENT_FILTERS = [
  'All',
  'Unfulfilled',
  'Ready to Ship',
  'Shipment Created',
  'Pickup Requested',
  'Pickup Failed',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'NDR / Exceptions',
  'RTO / Returning',
  'Returned',
  'Failed',
];

function orderKey(orderOrId) {
  if (orderOrId && typeof orderOrId === 'object') {
    return String(orderOrId.id);
  }
  return String(orderOrId);
}

function isPaymentBlocked(order) {
  const pay = String(order?.paymentStatus || '').toLowerCase();
  const method = String(order?.paymentMethod || '').toLowerCase();
  const isCod =
    method.includes('cod') || method.includes('cash on delivery');
  return !isCod && (pay === 'pending' || pay === 'failed');
}

export default function Orders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [shipmentFilter, setShipmentFilter] = useState('All');
  const [metricFilter, setMetricFilter] = useState('');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  const selectAllRef = useRef(null);

  const statuses = getOrderStatuses();
  const paymentStatuses = getPaymentStatuses();

  // Deep-link from dashboard cards: ?payment=Paid&metric=new&status=New
  useEffect(() => {
    const payment = searchParams.get('payment');
    const status = searchParams.get('status');
    const shipment = searchParams.get('shipment');
    const metric = searchParams.get('metric') || '';
    const unseen = String(searchParams.get('unseen') || '').toLowerCase() === 'true';

    if (payment && paymentStatuses.includes(payment)) {
      setPaymentFilter(payment);
    }

    if (status && (statuses.includes(status) || status === 'Pending')) {
      setStatusFilter(status);
    }

    if (shipment && SHIPMENT_FILTERS.includes(shipment)) {
      setShipmentFilter(shipment);
    }

    setMetricFilter(metric === 'new' ? 'new' : '');
    setUnseenOnly(unseen);
    setPage(1);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrders = async () => {
    const data = await getOrders();
    setOrders(data);
    return data;
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
    let list = orders.filter((order) => {
      if (metricFilter === 'new') {
        if (!filterOrdersByMetric([order], 'new').length) return false;
      } else {
        const matchesStatus =
          statusFilter === 'All' || order.status === statusFilter;
        if (!matchesStatus) return false;
      }

      const matchesPayment =
        paymentFilter === 'All' || order.paymentStatus === paymentFilter;
      const matchesSeen = !unseenOnly || !order.isSeen;
      let matchesShipment = true;
      if (shipmentFilter !== 'All') {
        matchesShipment = fulfillmentListLabel(order) === shipmentFilter;
      }

      const created = order.createdAt ? new Date(order.createdAt) : null;
      const matchesFrom =
        !dateFrom || (created && created >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo =
        !dateTo || (created && created <= new Date(`${dateTo}T23:59:59`));

      const matchesSearch =
        !q ||
        String(order.orderNumber || '').toLowerCase().includes(q) ||
        String(order.customerName || '').toLowerCase().includes(q) ||
        String(order.phone || '').toLowerCase().includes(q) ||
        String(order.email || '').toLowerCase().includes(q) ||
        String(order.product || '').toLowerCase().includes(q) ||
        String(order.waybill || '').toLowerCase().includes(q) ||
        String(order.promoCode || '').toLowerCase().includes(q) ||
        String(order.city || '').toLowerCase().includes(q);

      return (
        matchesSeen &&
        matchesPayment &&
        matchesShipment &&
        matchesFrom &&
        matchesTo &&
        matchesSearch
      );
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey] ?? a.createdAt ?? '';
      const bv = b[sortKey] ?? b.createdAt ?? '';
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });

    return list;
  }, [
    orders,
    search,
    statusFilter,
    paymentFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    paymentFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
  ]);

  // Clear selection when filters/search change (keep across sort/page)
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkResult(null);
  }, [
    search,
    statusFilter,
    paymentFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
  ]);

  const filteredIds = useMemo(
    () => filtered.map((o) => orderKey(o)),
    [filtered]
  );

  const selectedOnFiltered = useMemo(
    () => filteredIds.filter((id) => selectedIds.has(id)),
    [filteredIds, selectedIds]
  );

  const allFilteredSelected =
    filteredIds.length > 0 && selectedOnFiltered.length === filteredIds.length;
  const someFilteredSelected =
    selectedOnFiltered.length > 0 && !allFilteredSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  const selectedOrders = useMemo(() => {
    const map = new Map(orders.map((o) => [orderKey(o), o]));
    return Array.from(selectedIds)
      .map((id) => map.get(id))
      .filter(Boolean);
  }, [orders, selectedIds]);

  const toggleOne = (id) => {
    const key = orderKey(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setBulkResult(null);
  };

  const toggleSelectAllFiltered = () => {
    setBulkResult(null);
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkResult(null);
  };

  const handleDelete = async (order) => {
    const label = order.orderNumber || order.id;
    if (!window.confirm(`Delete order "${label}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrder(order.id);
      await loadOrders();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(orderKey(order));
        return next;
      });
      setMessage(`Order ${label} deleted.`);
      setError('');
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to delete order');
    }
  };

  const createShipmentForOrder = async (order) => {
    await delhivery.createShipment({
      order_id: Number(order.id) || order.id,
    });
    try {
      return await getOrderById(order.id);
    } catch {
      return null;
    }
  };

  const runBulkCreate = async (eligibleOrders) => {
    if (!eligibleOrders.length || bulkBusy) return;

    setBulkBusy(true);
    setError('');
    setMessage('');
    setBulkResult(null);

    const successes = [];
    const failures = [];

    for (let i = 0; i < eligibleOrders.length; i += 1) {
      const order = eligibleOrders[i];
      setBulkProgress({
        current: i + 1,
        total: eligibleOrders.length,
        orderNumber: order.orderNumber || order.id,
      });

      try {
        const refreshed = await createShipmentForOrder(order);
        if (refreshed) {
          setOrders((prev) =>
            prev.map((o) => (orderKey(o) === orderKey(order) ? refreshed : o))
          );
        }
        successes.push({
          id: order.id,
          orderNumber: order.orderNumber || String(order.id),
        });
      } catch (err) {
        if (err.status === 401) {
          setBulkBusy(false);
          setBulkProgress(null);
          return;
        }
        const reason = sanitizeTechnicalMessage(
          extractBackendMessage(err) || err.message || 'Shipment creation failed'
        );
        failures.push({
          id: order.id,
          orderNumber: order.orderNumber || String(order.id),
          reason,
        });
        // Refresh this row in case of partial save
        try {
          const refreshed = await getOrderById(order.id);
          if (refreshed) {
            setOrders((prev) =>
              prev.map((o) =>
                orderKey(o) === orderKey(order) ? refreshed : o
              )
            );
          }
        } catch {
          /* ignore */
        }
      }
    }

    setBulkProgress(null);
    setBulkBusy(false);
    setSelectedIds(new Set());

    try {
      await loadOrders();
    } catch {
      /* keep local updates */
    }

    setBulkResult({
      successCount: successes.length,
      failures,
    });

    if (successes.length && !failures.length) {
      setMessage(
        `${successes.length} shipment${successes.length === 1 ? '' : 's'} created successfully`
      );
    }
  };

  const handleBulkCreateClick = () => {
    if (bulkBusy || selectedOrders.length === 0) return;

    const eligible = [];
    const paymentBlocked = [];
    const alreadyCreated = [];

    selectedOrders.forEach((order) => {
      if (canCreateShipment(order)) {
        eligible.push(order);
      } else if (isShipmentCreated(order)) {
        alreadyCreated.push(order);
      } else if (isPaymentBlocked(order)) {
        paymentBlocked.push(order);
      } else {
        paymentBlocked.push(order);
      }
    });

    if (eligible.length === 0) {
      const parts = [];
      if (paymentBlocked.length) {
        parts.push(
          `${paymentBlocked.length} not eligible (payment pending / not paid)`
        );
      }
      if (alreadyCreated.length) {
        parts.push(
          `${alreadyCreated.length} already have a shipment`
        );
      }
      setError(
        `None of the ${selectedOrders.length} selected order${
          selectedOrders.length === 1 ? '' : 's'
        } can create a shipment. ${parts.join('; ')}.`
      );
      setMessage('');
      return;
    }

    const ineligibleCount = selectedOrders.length - eligible.length;
    if (ineligibleCount > 0) {
      const reasons = [];
      if (paymentBlocked.length) {
        reasons.push(
          `${paymentBlocked.length} of ${selectedOrders.length} selected orders are not eligible (payment pending) and will be skipped`
        );
      }
      if (alreadyCreated.length) {
        reasons.push(
          `${alreadyCreated.length} already have a shipment and will be skipped`
        );
      }
      const ok = window.confirm(
        `${reasons.join('. ')}. Continue with the remaining ${eligible.length}?`
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        `Create shipments for ${eligible.length} selected order${
          eligible.length === 1 ? '' : 's'
        }?`
      );
      if (!ok) return;
    }

    runBulkCreate(eligible);
  };

  const handleRetryFailed = async (failure) => {
    const order = orders.find((o) => orderKey(o) === orderKey(failure.id));
    if (!order) {
      setError(`Order ${failure.orderNumber} is no longer in the list.`);
      return;
    }
    if (!canCreateShipment(order)) {
      setError(
        `Order ${failure.orderNumber} is not eligible to create a shipment right now.`
      );
      return;
    }

    setBulkBusy(true);
    setBulkProgress({
      current: 1,
      total: 1,
      orderNumber: order.orderNumber || order.id,
    });
    setError('');

    try {
      const refreshed = await createShipmentForOrder(order);
      if (refreshed) {
        setOrders((prev) =>
          prev.map((o) => (orderKey(o) === orderKey(order) ? refreshed : o))
        );
      }
      setBulkResult((prev) => {
        if (!prev) return prev;
        const failures = prev.failures.filter(
          (f) => orderKey(f.id) !== orderKey(failure.id)
        );
        return {
          successCount: prev.successCount + 1,
          failures,
        };
      });
      setMessage(`Shipment created for ${order.orderNumber || order.id}.`);
      await loadOrders();
    } catch (err) {
      if (err.status !== 401) {
        const reason = sanitizeTechnicalMessage(
          extractBackendMessage(err) || err.message || 'Shipment creation failed'
        );
        setBulkResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            failures: prev.failures.map((f) =>
              orderKey(f.id) === orderKey(failure.id) ? { ...f, reason } : f
            ),
          };
        });
        setError(`${failure.orderNumber}: ${reason}`);
      }
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const columns = [
    {
      key: 'select',
      width: '48px',
      ariaLabel: 'Select',
      label: (
        <input
          ref={selectAllRef}
          type="checkbox"
          className="orders__checkbox"
          checked={allFilteredSelected}
          onChange={toggleSelectAllFiltered}
          disabled={filteredIds.length === 0 || bulkBusy}
          aria-label="Select all filtered orders"
          title="Select all filtered orders"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          className="orders__checkbox"
          checked={selectedIds.has(orderKey(row))}
          onChange={() => toggleOne(row.id)}
          disabled={bulkBusy}
          aria-label={`Select order ${row.orderNumber || row.id}`}
        />
      ),
    },
    {
      key: 'orderNumber',
      label: 'Order',
      render: (row) => (
        <div className="orders__order-cell">
          {!row.isSeen && <span className="orders__unread-dot" aria-hidden="true" />}
          <strong>{row.orderNumber || row.id}</strong>
          {!row.isSeen && <span className="orders__new-badge">NEW</span>}
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
          <span className="orders__address">
            {row.fullAddress || row.address || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row) => `₹${row.total}`,
    },
    {
      key: 'status',
      label: 'Order Status',
      render: (row) => <StatusBadge status={row.status || '—'} />,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => (
        <div className="orders__customer">
          <StatusBadge status={row.paymentStatus || '—'} />
          <span>{row.paymentMethod || '—'}</span>
          {row.paymentId ? (
            <span className="orders__payment-id" title={row.paymentId}>
              ID: {row.paymentId}
            </span>
          ) : (
            <span>ID: —</span>
          )}
        </div>
      ),
    },
    {
      key: 'promoCode',
      label: 'Promo',
      render: (row) =>
        row.promoCode ? (
          <strong className="orders__promo-code">{row.promoCode}</strong>
        ) : (
          '—'
        ),
    },
    {
      key: 'shipmentStatus',
      label: 'Shipment',
      render: (row) => <StatusBadge status={fulfillmentListLabel(row)} />,
    },
    {
      key: 'waybill',
      label: 'AWB',
      render: (row) => row.waybill || '—',
    },
    {
      key: 'date',
      label: 'Ordered at',
      render: (row) => (
        <div className="orders__customer">
          <strong>{row.orderedDate || '—'}</strong>
          <span>{row.orderedTime || '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div className="orders__actions">
          <Link to={`/orders/${row.id}`}>
            <Button size="sm" variant="outline-primary" disabled={bulkBusy}>
              View
            </Button>
          </Link>
          <Button
            size="sm"
            variant="danger"
            disabled={bulkBusy}
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
  const selectedCount = selectedIds.size;

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Orders</h2>
          <p>Search, filter, fulfill, and export customer orders</p>
        </div>
        <div className="orders__header-actions">
          <Button
            variant="secondary"
            disabled={bulkBusy}
            onClick={() =>
              exportOrdersToCsv(filtered, 'telaqua-orders-filtered.csv')
            }
          >
            Export Filtered
          </Button>
          <Button
            disabled={bulkBusy}
            onClick={() => exportOrdersToCsv(orders, 'telaqua-orders-all.csv')}
          >
            Export All Orders
          </Button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      {(metricFilter === 'new' || paymentFilter !== 'All' || unseenOnly) && (
        <div className="alert alert--info">
          Showing:{' '}
          <strong>
            {metricFilter === 'new'
              ? 'New orders (New + Pending status)'
              : unseenOnly
                ? 'Unseen orders only'
                : `${paymentFilter} payments`}
          </strong>
          {metricFilter === 'new' || unseenOnly ? (
            <button
              type="button"
              className="orders__clear-selection"
              style={{ marginLeft: 12 }}
              onClick={() => {
                setMetricFilter('');
                setUnseenOnly(false);
              }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      )}

      {bulkProgress && (
        <div className="alert alert--info orders__bulk-progress" role="status">
          Creating shipment {bulkProgress.current} of {bulkProgress.total}
          {bulkProgress.orderNumber
            ? ` (${bulkProgress.orderNumber})…`
            : '…'}
        </div>
      )}

      {bulkResult && (
        <div className="orders__bulk-result panel">
          <div className="panel__body">
            {bulkResult.successCount > 0 && (
              <p className="orders__bulk-result-success">
                {bulkResult.successCount} shipment
                {bulkResult.successCount === 1 ? '' : 's'} created successfully
              </p>
            )}
            {bulkResult.failures.length > 0 && (
              <div className="orders__bulk-failures">
                <p>
                  {bulkResult.failures.length} failed:
                </p>
                <ul>
                  {bulkResult.failures.map((f) => (
                    <li key={orderKey(f.id)}>
                      <div>
                        <strong>{f.orderNumber}</strong>
                        <span> (reason: {f.reason})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={bulkBusy}
                        onClick={() => handleRetryFailed(f)}
                      >
                        Retry
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="orders__bulk-dismiss"
              onClick={() => setBulkResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        <div className="panel__header orders__toolbar-wrap">
          <div className="toolbar orders__toolbar">
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
                placeholder="Search order, customer, AWB…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={bulkBusy}
              />
            </div>

            <select
              className="toolbar__select"
              value={metricFilter === 'new' ? 'New' : statusFilter}
              onChange={(e) => {
                setMetricFilter('');
                setStatusFilter(e.target.value);
              }}
              disabled={bulkBusy}
            >
              <option value="All">All order statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="toolbar__select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              disabled={bulkBusy}
            >
              <option value="All">All payments</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="toolbar__select"
              value={shipmentFilter}
              onChange={(e) => setShipmentFilter(e.target.value)}
              disabled={bulkBusy}
            >
              {SHIPMENT_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All shipments' : status}
                </option>
              ))}
            </select>

            <input
              className="toolbar__select"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              disabled={bulkBusy}
            />
            <input
              className="toolbar__select"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              disabled={bulkBusy}
            />

            <select
              className="toolbar__select"
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setSortKey(key);
                setSortDir(dir);
              }}
              disabled={bulkBusy}
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="total:desc">Amount high → low</option>
              <option value="total:asc">Amount low → high</option>
              <option value="orderNumber:asc">Order A → Z</option>
            </select>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="orders__bulk-bar" role="region" aria-label="Bulk actions">
            <p className="orders__bulk-count">
              {selectedCount} order{selectedCount === 1 ? '' : 's'} selected
            </p>
            <div className="orders__bulk-actions">
              <Button
                disabled={bulkBusy}
                onClick={handleBulkCreateClick}
              >
                {bulkBusy ? 'Creating…' : 'Create Shipments'}
              </Button>
              <button
                type="button"
                className="orders__clear-selection"
                onClick={clearSelection}
                disabled={bulkBusy}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

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
              disabled={currentPage <= 1 || bulkBusy}
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
              disabled={currentPage >= totalPages || bulkBusy}
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
