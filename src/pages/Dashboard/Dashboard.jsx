import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../services/api';
import { StatCard } from '../../components/Cards';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import {
  DASHBOARD_METRICS,
  filterOrdersByMetric,
} from '../../utils/dashboardMetrics';
import { exportOrdersToCsv } from '../../utils/exportOrdersCsv';
import '../../styles/shared.css';
import './Dashboard.css';

const icons = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    </svg>
  ),
  pay: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
};

function computeStats(orders) {
  return {
    total: filterOrdersByMetric(orders, 'total').length,
    new: filterOrdersByMetric(orders, 'new').length,
    paidOrders: filterOrdersByMetric(orders, 'paid').length,
    pendingPayments: filterOrdersByMetric(orders, 'pending_payment').length,
    shipmentsCreated: filterOrdersByMetric(orders, 'shipments_created').length,
  };
}

const CARD_DEFS = [
  { key: 'total', valueKey: 'total', icon: icons.total, accent: 'orange' },
  { key: 'new', valueKey: 'new', icon: icons.box, accent: 'blue' },
  { key: 'paid', valueKey: 'paidOrders', icon: icons.pay, accent: 'green' },
  {
    key: 'pending_payment',
    valueKey: 'pendingPayments',
    icon: icons.pay,
    accent: 'amber',
  },
  {
    key: 'shipments_created',
    valueKey: 'shipmentsCreated',
    icon: icons.truck,
    accent: 'blue',
  },
];

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const ordersData = await getOrders();
        if (!active) return;
        setOrders(ordersData);
        setRecent(ordersData.slice(0, 8));
        setStats(computeStats(ordersData));
      } catch (err) {
        if (!active) return;
        if (err.status !== 401) {
          setError(err.message || 'Failed to load dashboard');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDownloadMetric = (metricKey) => {
    const metric = DASHBOARD_METRICS[metricKey];
    if (!metric) return;
    const rows = filterOrdersByMetric(orders, metricKey);
    exportOrdersToCsv(rows, metric.filename);
  };

  const columns = [
    { key: 'orderNumber', label: 'Order' },
    { key: 'customerName', label: 'Customer' },
    {
      key: 'total',
      label: 'Total',
      render: (row) => `₹${row.total}`,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => <StatusBadge status={row.paymentStatus} />,
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
      render: (row) => row.date || '—',
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <Link to={`/orders/${row.id}`}>
          <Button size="sm" variant="outline-primary">
            View
          </Button>
        </Link>
      ),
    },
  ];

  if (loading) {
    return <div className="loading-state">Loading dashboard…</div>;
  }

  return (
    <div className="page dashboard">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Operations overview</h2>
          <p>Click a card to open that list, or download its CSV</p>
        </div>
        <Link to="/orders">
          <Button variant="secondary">View all orders</Button>
        </Link>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="dashboard__stats">
        {CARD_DEFS.map((card) => {
          const metric = DASHBOARD_METRICS[card.key];
          return (
            <StatCard
              key={card.key}
              title={metric.title}
              value={stats?.[card.valueKey] ?? 0}
              icon={card.icon}
              accent={card.accent}
              to={metric.to}
              onDownload={() => handleDownloadMetric(card.key)}
            />
          );
        })}
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Recent orders</h3>
          <Link to="/orders">
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        </div>
        <DataTable
          columns={columns}
          data={recent}
          emptyMessage={error ? 'Unable to load orders.' : 'No recent orders.'}
        />
      </section>
    </div>
  );
}
