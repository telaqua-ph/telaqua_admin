import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats, getOrders } from '../../services/api';
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

function formatInr(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

function toDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTodayRange() {
  const today = toDateInput(new Date());
  return { from: today, to: today, label: 'Today' };
}

function getYesterdayRange() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const value = toDateInput(date);
  return { from: value, to: value, label: 'Yesterday' };
}

function getThisWeekRange() {
  const end = new Date();
  const start = new Date();
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
    label: 'This Week',
  };
}

function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
    label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    monthValue: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

function getLastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
    label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    monthValue: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
  };
}

function getMonthRange(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return getThisMonthRange();
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
    label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    monthValue: value,
  };
}

function describeRange(from, to, fallback = 'Selected Period') {
  if (!from && !to) return fallback;
  if (from && to && from === to) return formatDateLabel(from);
  if (from && to) return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
  if (from) return `${formatDateLabel(from)} onwards`;
  return `Up to ${formatDateLabel(to)}`;
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

const SALES_CARD_DEFS = [
  { key: 'devicesSold', title: 'Total Devices Sold', accent: 'blue', icon: icons.box },
  {
    key: 'revenueReceived',
    title: 'Total Revenue Received',
    accent: 'green',
    icon: icons.pay,
    format: formatInr,
  },
  { key: 'todayDevicesSold', title: "Today's Devices Sold", accent: 'orange', icon: icons.box },
  {
    key: 'todayRevenue',
    title: "Today's Revenue",
    accent: 'green',
    icon: icons.pay,
    format: formatInr,
  },
  { key: 'monthDevicesSold', title: "This Month's Devices Sold", accent: 'amber', icon: icons.box },
  {
    key: 'monthRevenue',
    title: "This Month's Revenue",
    accent: 'green',
    icon: icons.pay,
    format: formatInr,
  },
];

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [unseenOrders, setUnseenOrders] = useState(0);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('This Month');
  const [monthValue, setMonthValue] = useState(() => getThisMonthRange().monthValue || '');
  const [customFrom, setCustomFrom] = useState(() => getThisMonthRange().from);
  const [customTo, setCustomTo] = useState(() => getThisMonthRange().to);

  const applyStats = useCallback((dashboardStats, rangeLabel) => {
    setSales(dashboardStats);
    setAnalysis(dashboardStats.analysis);
    setUnseenOrders(dashboardStats.unseenOrders || 0);
    setSelectedRangeLabel(rangeLabel || describeRange(dashboardStats.analysis?.from, dashboardStats.analysis?.to));
  }, []);

  const loadDashboard = useCallback(async (range) => {
    const dashboardStats = await getDashboardStats({
      from: range?.from,
      to: range?.to,
    });
    applyStats(dashboardStats, range?.label || describeRange(range?.from, range?.to, 'Selected Period'));
    return dashboardStats;
  }, [applyStats]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const defaultRange = getThisMonthRange();
        const [ordersData, dashboardStats] = await Promise.all([
          getOrders(),
          getDashboardStats({ from: defaultRange.from, to: defaultRange.to }),
        ]);
        if (!active) return;
        setOrders(ordersData);
        setRecent(ordersData.slice(0, 8));
        setStats(computeStats(ordersData));
        setMonthValue(defaultRange.monthValue || '');
        setCustomFrom(defaultRange.from);
        setCustomTo(defaultRange.to);
        applyStats(dashboardStats, defaultRange.label);
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
  }, [applyStats]);

  useEffect(() => {
    const handleSeenChanged = async () => {
      try {
        const range = {
          from: analysis?.from || customFrom,
          to: analysis?.to || customTo,
          label: selectedRangeLabel,
        };
        await loadDashboard(range);
      } catch {
        /* ignore transient refresh errors */
      }
    };
    window.addEventListener('orders:seen-changed', handleSeenChanged);
    return () => window.removeEventListener('orders:seen-changed', handleSeenChanged);
  }, [analysis?.from, analysis?.to, customFrom, customTo, loadDashboard, selectedRangeLabel]);

  const handleDownloadMetric = (metricKey) => {
    const metric = DASHBOARD_METRICS[metricKey];
    if (!metric) return;
    const rows = filterOrdersByMetric(orders, metricKey);
    exportOrdersToCsv(rows, metric.filename);
  };

  const columns = [
    {
      key: 'orderNumber',
      label: 'Order',
      render: (row) => (
        <div className="dashboard__order-cell">
          <strong>{row.orderNumber}</strong>
          {!row.isSeen && <span className="dashboard__new-badge">NEW</span>}
        </div>
      ),
    },
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

  const analysisCards = [
    {
      key: 'analysisDevices',
      title: 'Devices Sold',
      value: analysis?.devicesSold ?? 0,
      icon: icons.box,
      accent: 'blue',
    },
    {
      key: 'analysisRevenue',
      title: 'Revenue Received',
      value: formatInr(analysis?.revenueReceived ?? 0),
      icon: icons.pay,
      accent: 'green',
    },
    {
      key: 'analysisAverage',
      title: 'Average Revenue / Device',
      value: formatInr(analysis?.averageRevenuePerDevice ?? 0),
      icon: icons.pay,
      accent: 'amber',
    },
  ];

  const quickFilters = [
    { key: 'today', label: 'Today', range: getTodayRange },
    { key: 'yesterday', label: 'Yesterday', range: getYesterdayRange },
    { key: 'week', label: 'This Week', range: getThisWeekRange },
    { key: 'month', label: 'This Month', range: getThisMonthRange },
    { key: 'lastMonth', label: 'Last Month', range: getLastMonthRange },
  ];

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

      {unseenOrders > 0 && (
        <div className="alert alert--info dashboard__unseen-alert">
          <div>
            <strong>{unseenOrders} unseen order{unseenOrders === 1 ? '' : 's'}</strong>
            <div>These orders have not been opened by this admin yet.</div>
          </div>
          <Link to="/orders?unseen=true">
            <Button size="sm" variant="secondary">
              View unseen orders
            </Button>
          </Link>
        </div>
      )}

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
          <div>
            <h3>Sales overview</h3>
            <p className="dashboard__section-note">
              Based on backend-confirmed paid orders and actual paid amounts.
            </p>
          </div>
        </div>
        <div className="dashboard__stats dashboard__stats--sales">
          {SALES_CARD_DEFS.map((card) => (
            <StatCard
              key={card.key}
              title={card.title}
              value={card.format ? card.format(sales?.[card.key] ?? 0) : sales?.[card.key] ?? 0}
              icon={card.icon}
              accent={card.accent}
            />
          ))}
        </div>

        <div className="dashboard__sales-filters">
          <div className="dashboard__filter-group">
            {quickFilters.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const range = item.range();
                  setMonthValue(range.monthValue || monthValue);
                  setCustomFrom(range.from);
                  setCustomTo(range.to);
                  loadDashboard(range).catch((err) => {
                    if (err.status !== 401) setError(err.message || 'Failed to load dashboard');
                  });
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="dashboard__filter-row">
            <label className="dashboard__field">
              <span>Month</span>
              <input
                type="month"
                value={monthValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setMonthValue(value);
                  const range = getMonthRange(value);
                  setCustomFrom(range.from);
                  setCustomTo(range.to);
                  loadDashboard(range).catch((err) => {
                    if (err.status !== 401) setError(err.message || 'Failed to load dashboard');
                  });
                }}
              />
            </label>

            <label className="dashboard__field">
              <span>From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>

            <label className="dashboard__field">
              <span>To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                const label = describeRange(customFrom, customTo, 'Custom Range');
                loadDashboard({
                  from: customFrom || null,
                  to: customTo || null,
                  label,
                }).catch((err) => {
                  if (err.status !== 401) setError(err.message || 'Failed to load dashboard');
                });
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        <div className="dashboard__analysis-summary">
          <p className="dashboard__analysis-label">Selected Period</p>
          <h4>{selectedRangeLabel || describeRange(analysis?.from, analysis?.to)}</h4>
        </div>

        <div className="dashboard__stats dashboard__stats--analysis">
          {analysisCards.map((card) => (
            <StatCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              accent={card.accent}
            />
          ))}
        </div>
      </section>

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
