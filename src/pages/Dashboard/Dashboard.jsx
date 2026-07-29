import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrderStats, getOrders } from '../../services/api';
import { StatCard } from '../../components/Cards';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import '../../styles/shared.css';
import './Dashboard.css';

const icons = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  ),
  new: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  confirmed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  delivered: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  pendingPay: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  completedPay: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
};

export default function Dashboard() {
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
        setRecent(ordersData.slice(0, 6));
        // No dedicated dashboard/stats API — derive cards from orders.
        setStats({
          total: ordersData.length,
          new: ordersData.filter((o) =>
            ['new', 'pending'].includes(String(o.status || '').toLowerCase())
          ).length,
          confirmed: ordersData.filter(
            (o) => String(o.status || '').toLowerCase() === 'confirmed'
          ).length,
          delivered: ordersData.filter(
            (o) => String(o.status || '').toLowerCase() === 'delivered'
          ).length,
          pendingPayments: ordersData.filter(
            (o) => String(o.paymentStatus || '').toLowerCase() === 'pending'
          ).length,
          completedPayments: ordersData.filter(
            (o) => String(o.paymentStatus || '').toLowerCase() === 'paid'
          ).length,
        });
      } catch (err) {
        if (!active) return;
        if (err.status !== 401) {
          setError(err.message || 'Failed to load dashboard');
          try {
            // keep card structure stable if stats helper fails independently
            const fallback = await getOrderStats().catch(() => null);
            if (active && fallback) setStats(fallback);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const columns = [
    { key: 'orderNumber', label: 'Order ID' },
    { key: 'customerName', label: 'Customer' },
    { key: 'city', label: 'City' },
    { key: 'quantity', label: 'Qty' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'paymentMethod', label: 'Payment Method' },
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
          <h2>Welcome back</h2>
          <p>Overview of Tel-Aqua PH02 orders and activity</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="dashboard__stats">
        <StatCard title="Total Orders" value={stats?.total ?? 0} icon={icons.total} accent="orange" />
        <StatCard title="New Orders" value={stats?.new ?? 0} icon={icons.new} accent="blue" />
        <StatCard title="Confirmed Orders" value={stats?.confirmed ?? 0} icon={icons.confirmed} accent="amber" />
        <StatCard title="Delivered Orders" value={stats?.delivered ?? 0} icon={icons.delivered} accent="green" />
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments ?? 0}
          icon={icons.pendingPay}
          accent="amber"
        />
        <StatCard
          title="Completed Payments"
          value={stats?.completedPayments ?? 0}
          icon={icons.completedPay}
          accent="green"
        />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Recent Orders</h3>
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
