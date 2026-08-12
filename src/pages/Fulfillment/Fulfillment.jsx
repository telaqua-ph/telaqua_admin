import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOrders } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import {
  fulfillmentListLabel,
  matchesFulfillmentBucket,
} from '../../utils/fulfillmentTimeline';
import { filterOrdersByMetric } from '../../utils/dashboardMetrics';
import { exportOrdersToCsv } from '../../utils/exportOrdersCsv';
import '../../styles/shared.css';
import './Fulfillment.css';

const PAGE_SIZE = 10;

const BUCKETS = [
  { id: 'all', label: 'All shipments' },
  { id: 'not_created', label: 'Not Created' },
  { id: 'created', label: 'Shipment Created' },
  { id: 'label', label: 'Label Generated' },
  { id: 'pickup', label: 'Pickup Requested' },
  { id: 'transit', label: 'In Transit' },
  { id: 'ofd', label: 'Out for Delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'ndr', label: 'NDR / Exceptions' },
];

const VALID_BUCKETS = new Set(BUCKETS.map((b) => b.id));

export default function Fulfillment() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bucket, setBucket] = useState('all');
  const [metricFilter, setMetricFilter] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [shipmentFilter, setShipmentFilter] = useState('All');
  const [trackingFilter, setTrackingFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const bucketParam = searchParams.get('bucket') || '';
    const metricParam = searchParams.get('metric') || '';

    if (VALID_BUCKETS.has(bucketParam)) {
      setBucket(bucketParam);
      setMetricFilter('');
    } else if (
      metricParam === 'shipments_created' ||
      metricParam === 'in_transit'
    ) {
      setMetricFilter(metricParam);
      setBucket('all');
    }
    setPage(1);
  }, [searchParams]);

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
          setError(err.message || 'Failed to load fulfillment orders');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const shipmentOptions = useMemo(() => {
    const set = new Set(orders.map((o) => fulfillmentListLabel(o)));
    return ['All', ...Array.from(set).sort()];
  }, [orders]);

  const trackingOptions = useMemo(() => {
    const set = new Set(
      orders
        .map((o) => o.trackingStatus)
        .filter((v) => v && String(v).trim())
    );
    return ['All', 'Not Available', ...Array.from(set).sort()];
  }, [orders]);

  const bucketCounts = useMemo(() => {
    const counts = { all: orders.length };
    BUCKETS.forEach((b) => {
      if (b.id === 'all') return;
      counts[b.id] = orders.filter((o) => matchesFulfillmentBucket(o, b.id))
        .length;
    });
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (metricFilter) {
        if (!filterOrdersByMetric([order], metricFilter).length) return false;
      } else if (!matchesFulfillmentBucket(order, bucket)) {
        return false;
      }

      const matchesPayment =
        paymentFilter === 'All' || order.paymentStatus === paymentFilter;

      const shipLabel = fulfillmentListLabel(order);
      const matchesShipment =
        shipmentFilter === 'All' || shipLabel === shipmentFilter;

      const trackValue = order.trackingStatus || 'Not Available';
      const matchesTracking =
        trackingFilter === 'All' ||
        (trackingFilter === 'Not Available'
          ? !order.trackingStatus
          : trackValue === trackingFilter);

      const created = order.createdAt ? new Date(order.createdAt) : null;
      const matchesFrom =
        !dateFrom || (created && created >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo =
        !dateTo || (created && created <= new Date(`${dateTo}T23:59:59`));

      const matchesSearch =
        !q ||
        String(order.orderNumber || '').toLowerCase().includes(q) ||
        String(order.customerName || '').toLowerCase().includes(q) ||
        String(order.waybill || '').toLowerCase().includes(q) ||
        String(order.phone || '').toLowerCase().includes(q);

      return (
        matchesPayment &&
        matchesShipment &&
        matchesTracking &&
        matchesFrom &&
        matchesTo &&
        matchesSearch
      );
    });
  }, [
    orders,
    bucket,
    metricFilter,
    search,
    paymentFilter,
    shipmentFilter,
    trackingFilter,
    dateFrom,
    dateTo,
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
    bucket,
    metricFilter,
    search,
    paymentFilter,
    shipmentFilter,
    trackingFilter,
    dateFrom,
    dateTo,
  ]);

  const columns = [
    { key: 'orderNumber', label: 'Order' },
    {
      key: 'customerName',
      label: 'Customer',
      render: (row) => (
        <div className="fulfillment__customer">
          <strong>{row.customerName}</strong>
          <span>{row.phone || '—'}</span>
        </div>
      ),
    },
    {
      key: 'waybill',
      label: 'AWB',
      render: (row) => row.waybill || '—',
    },
    {
      key: 'shipment',
      label: 'Shipment Status',
      render: (row) => <StatusBadge status={fulfillmentListLabel(row)} />,
    },
    {
      key: 'trackingStatus',
      label: 'Tracking Status',
      render: (row) => row.trackingStatus || 'Not Available',
    },
    {
      key: 'pickupStatus',
      label: 'Pickup Status',
      render: (row) => (
        <StatusBadge status={row.pickupStatus || 'Not Requested'} />
      ),
    },
    {
      key: 'date',
      label: 'Ordered at',
      render: (row) => row.date || '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <Link to={`/orders/${row.id}`}>
          <Button size="sm" variant="outline-primary">
            Manage
          </Button>
        </Link>
      ),
    },
  ];

  if (loading) {
    return <div className="loading-state">Loading fulfillment…</div>;
  }

  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const metricLabel =
    metricFilter === 'shipments_created'
      ? 'Shipments created'
      : metricFilter === 'in_transit'
        ? 'In transit / picked up / out for delivery'
        : null;

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Fulfillment</h2>
          <p>Operate Delhivery shipments from real order database state</p>
        </div>
        <Button
          variant="secondary"
          disabled={filtered.length === 0}
          onClick={() =>
            exportOrdersToCsv(filtered, 'telaqua-fulfillment-filtered.csv')
          }
        >
          Export Filtered
        </Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {metricLabel && (
        <div className="alert alert--info">
          Showing: <strong>{metricLabel}</strong>
          <button
            type="button"
            className="orders__clear-selection"
            style={{ marginLeft: 12 }}
            onClick={() => setMetricFilter('')}
          >
            Clear metric filter
          </button>
        </div>
      )}

      <div className="fulfillment__buckets">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`fulfillment__bucket ${
              !metricFilter && bucket === b.id
                ? 'fulfillment__bucket--active'
                : ''
            }`}
            onClick={() => {
              setMetricFilter('');
              setBucket(b.id);
            }}
          >
            <span>{b.label}</span>
            <strong>{bucketCounts[b.id] ?? 0}</strong>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel__header">
          <div className="toolbar fulfillment__toolbar">
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
              />
            </div>
            <select
              className="toolbar__select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="All">All payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
            <select
              className="toolbar__select"
              value={shipmentFilter}
              onChange={(e) => setShipmentFilter(e.target.value)}
            >
              {shipmentOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All shipment statuses' : opt}
                </option>
              ))}
            </select>
            <select
              className="toolbar__select"
              value={trackingFilter}
              onChange={(e) => setTrackingFilter(e.target.value)}
            >
              {trackingOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'All' ? 'All tracking statuses' : opt}
                </option>
              ))}
            </select>
            <input
              className="toolbar__select"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
            />
            <input
              className="toolbar__select"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={pageData}
          emptyMessage="No shipments in this view."
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
            <span className="fulfillment__page">
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
