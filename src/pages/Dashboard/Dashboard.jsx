import { useCallback, useEffect, useState } from 'react';
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
  totalDevicesSold,
} from '../../utils/dashboardMetrics';
import { exportOrdersToCsv } from '../../utils/exportOrdersCsv';
import { isOrderCreatedInDateRange, todayInKolkata } from '../../utils/orderDateRange';
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
  cancel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </svg>
  ),
};

function computeStats(orders) {
  return {
    total: filterOrdersByMetric(orders, 'total').length,
    new: filterOrdersByMetric(orders, 'new').length,
    razorpayPaidOrders: filterOrdersByMetric(orders || [], 'razorpay_paid').length,
    pendingPayments: filterOrdersByMetric(orders, 'pending_payment').length,
    codOrders: filterOrdersByMetric(orders || [], 'cod').length,
    codPaidOrders: filterOrdersByMetric(orders || [], 'cod_paid').length,
    confirmedCodPaymentPending: filterOrdersByMetric(
      orders || [],
      'confirmed_cod_payment_pending'
    ).length,
    shipmentsCreated: filterOrdersByMetric(orders, 'shipments_created').length,
    cancelledOrders: filterOrdersByMetric(orders, 'cancelled').length,
  };
}

function operationalStatsFromApi(data, orders) {
  if (!data) return null;
  return {
    total: Number(data.totalOrders || 0),
    new: Number(data.newOrders || 0),
    razorpayPaidOrders: filterOrdersByMetric(orders, 'razorpay_paid').length,
    pendingPayments: Number(data.pendingPayments || 0),
    codOrders: filterOrdersByMetric(orders, 'cod').length,
    codPaidOrders: filterOrdersByMetric(orders, 'cod_paid').length,
    confirmedCodPaymentPending: filterOrdersByMetric(
      orders,
      'confirmed_cod_payment_pending'
    ).length,
    shipmentsCreated: Number(data.shipmentsCreated || 0),
    cancelledOrders: Number(data.cancelledOrders || 0),
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
  const today = todayInKolkata();
  return { from: today, to: today, label: 'Today' };
}

function getYesterdayRange() {
  const date = new Date(`${todayInKolkata()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  const value = date.toISOString().slice(0, 10);
  return { from: value, to: value, label: 'Yesterday' };
}

function getThisWeekRange() {
  const end = todayInKolkata();
  const start = new Date(`${end}T00:00:00Z`);
  const day = start.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - offset);
  return {
    from: start.toISOString().slice(0, 10),
    to: end,
    label: 'This Week',
  };
}

function getThisMonthRange() {
  const today = todayInKolkata();
  const [year, month] = today.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    from: start,
    to: end,
    label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    monthValue: `${year}-${String(month).padStart(2, '0')}`,
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
  {
    key: 'razorpay_paid',
    valueKey: 'razorpayPaidOrders',
    icon: icons.pay,
    accent: 'green',
  },
  {
    key: 'cod',
    valueKey: 'codOrders',
    icon: icons.box,
    accent: 'orange',
  },
  {
    key: 'cod_paid',
    valueKey: 'codPaidOrders',
    icon: icons.pay,
    accent: 'green',
  },
  {
    key: 'confirmed_cod_payment_pending',
    valueKey: 'confirmedCodPaymentPending',
    icon: icons.box,
    accent: 'amber',
  },
  {
    key: 'cancelled',
    valueKey: 'cancelledOrders',
    icon: icons.cancel,
    accent: 'red',
  },
];

const SALES_GROUPS = [
  {
    key: 'all',
    label: 'All time',
    cards: [
      {
        key: 'totalDevicesSold',
        title: 'Total Devices Sold',
        value: (data) => totalDevicesSold(data?.devicesSold, data?.codPendingDevices),
        accent: 'blue',
        icon: icons.box,
        metric: 'sales_total_devices',
      },
      {
        key: 'revenueReceived',
        title: 'Revenue Received',
        accent: 'green',
        icon: icons.pay,
        format: formatInr,
        metric: 'sales_revenue_received',
      },
    ],
  },
  {
    key: 'today',
    label: 'Today',
    cards: [
      {
        key: 'todayTotalDevicesSold',
        title: 'Total Devices Sold',
        value: (data) => totalDevicesSold(data?.todayDevicesSold, data?.todayCodPendingDevices),
        accent: 'orange',
        icon: icons.box,
        metric: 'sales_total_devices',
        range: 'today',
      },
      {
        key: 'todayRevenue',
        title: 'Revenue Received',
        accent: 'green',
        icon: icons.pay,
        format: formatInr,
        metric: 'sales_revenue_received',
        range: 'today',
      },
    ],
  },
];

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [unseenOrders, setUnseenOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRangeLabel, setSelectedRangeLabel] = useState('');
  const [monthValue, setMonthValue] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedRange, setAppliedRange] = useState(null);
  const periodApplied = Boolean(appliedRange);

  const applyStats = useCallback((dashboardStats, rangeLabel, metricOrders) => {
    setSales(dashboardStats);
    setAnalysis(dashboardStats.analysis);
    setUnseenOrders(dashboardStats.unseenOrders || 0);
    const operational = operationalStatsFromApi(dashboardStats, metricOrders);
    if (operational) setStats(operational);
    if (rangeLabel) setSelectedRangeLabel(rangeLabel);
  }, []);

  const loadDashboard = useCallback(async (range) => {
    const dashboardStats = await getDashboardStats({
      from: range?.from || undefined,
      to: range?.to || undefined,
    });
    const rangeLabel = range
      ? range.label || describeRange(range.from, range.to, 'Selected Period')
      : '';
    applyStats(dashboardStats, rangeLabel, orders);
    return dashboardStats;
  }, [applyStats, orders]);

  const applyPeriodRange = useCallback((range) => {
    setMonthValue(range.monthValue || '');
    setCustomFrom(range.from || '');
    setCustomTo(range.to || '');
    setAppliedRange({
      from: range.from || '',
      to: range.to || '',
      label: range.label || describeRange(range.from, range.to, 'Selected Period'),
    });
    loadDashboard(range).catch((err) => {
      if (err.status !== 401) setError(err.message || 'Failed to load dashboard stats');
    });
  }, [loadDashboard]);

  const clearPeriodFilter = useCallback(() => {
    setSelectedRangeLabel('');
    setMonthValue('');
    setCustomFrom('');
    setCustomTo('');
    setAppliedRange(null);
    loadDashboard().catch((err) => {
      if (err.status !== 401) setError(err.message || 'Failed to load dashboard stats');
    });
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [ordersResult, statsResult] = await Promise.allSettled([
          getOrders(),
          getDashboardStats(),
        ]);
        if (!active) return;
        const metricOrders =
          ordersResult.status === 'fulfilled' ? ordersResult.value : [];

        if (ordersResult.status === 'fulfilled') {
          const ordersData = metricOrders;
          setOrders(ordersData);
          if (statsResult.status !== 'fulfilled') {
            setStats(computeStats(ordersData));
          }
        } else if (ordersResult.reason?.status !== 401) {
          setError(ordersResult.reason?.message || 'Failed to load orders');
        }

        if (statsResult.status === 'fulfilled') {
          applyStats(statsResult.value, undefined, metricOrders);
        } else if (statsResult.reason?.status !== 401) {
          setError((prev) => prev || statsResult.reason?.message || 'Failed to load dashboard stats');
        }
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
    const handleOrdersChanged = async () => {
      try {
        const range = appliedRange
          ? {
              from: appliedRange.from || undefined,
              to: appliedRange.to || undefined,
              label: appliedRange.label,
            }
          : undefined;
        const [freshOrders, dashboardStats] = await Promise.all([
          getOrders(),
          loadDashboard(
            range
          ),
        ]);
        setOrders(freshOrders);
        applyStats(
          dashboardStats,
          appliedRange
            ? appliedRange.label
            : undefined,
          freshOrders
        );
      } catch {
        /* ignore transient refresh errors */
      }
    };
    window.addEventListener('orders:seen-changed', handleOrdersChanged);
    window.addEventListener('orders:payment-changed', handleOrdersChanged);
    return () => {
      window.removeEventListener('orders:seen-changed', handleOrdersChanged);
      window.removeEventListener('orders:payment-changed', handleOrdersChanged);
    };
  }, [appliedRange, applyStats, loadDashboard]);

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

  const recentOrders = orders
    .filter((order) =>
      !appliedRange || isOrderCreatedInDateRange(order, appliedRange.from, appliedRange.to)
    )
    .slice(0, 8);
  const recentOrdersPath = appliedRange
    ? `/orders?${new URLSearchParams({
        ...(appliedRange.from ? { from: appliedRange.from } : {}),
        ...(appliedRange.to ? { to: appliedRange.to } : {}),
      }).toString()}`
    : '/orders';

  const salesRanges = {
    today: getTodayRange(),
    month: getThisMonthRange(),
  };
  const salesMetricPath = (metric, range) => {
    const params = new URLSearchParams({ metric });
    if (
      metric === 'sales_devices' ||
      metric === 'sales_cod_pending_devices' ||
      metric === 'sales_total_devices'
    ) params.set('status', 'Confirmed');
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    return `/orders?${params.toString()}`;
  };

  const analysisCards = [
    {
      key: 'analysisDevices',
      title: 'Devices Sold',
      value: analysis?.devicesSold ?? 0,
      icon: icons.box,
      accent: 'blue',
      to: salesMetricPath('sales_devices', appliedRange),
    },
    {
      key: 'analysisRevenue',
      title: 'Revenue Received',
      value: formatInr(analysis?.revenueReceived ?? 0),
      icon: icons.pay,
      accent: 'green',
      to: salesMetricPath('sales_revenue_received', appliedRange),
    },
    {
      key: 'analysisPendingRevenue',
      title: 'Pending Revenue',
      value: formatInr(analysis?.pendingRevenue ?? 0),
      icon: icons.pay,
      accent: 'amber',
      to: salesMetricPath('sales_pending_revenue', appliedRange),
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

      <div className="dashboard__stats dashboard__stats--operations">
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
              Total Devices Sold combines paid devices with confirmed COD devices not yet marked as paid.
              COD uses the order date, Razorpay the payment date; RTO orders are excluded. Revenue includes confirmed payments only.
            </p>
          </div>
        </div>
        <div className="dashboard__sales-body">
          <div className="dashboard__sales-groups">
            {SALES_GROUPS.map((group) => (
              <div key={group.key} className="dashboard__sales-group">
                <p className="dashboard__sales-group-label">{group.label}</p>
                <div className={`dashboard__stats dashboard__stats--pair${group.cards.length > 2 ? ' dashboard__stats--triple' : ''}`}>
                  {group.cards.map((card) => (
                    <StatCard
                      key={card.key}
                      title={card.title}
                      value={card.format
                        ? card.format(sales?.[card.key] ?? 0)
                        : card.value
                          ? card.value(sales)
                          : sales?.[card.key] ?? 0}
                      icon={card.icon}
                      accent={card.accent}
                      to={salesMetricPath(card.metric, salesRanges[card.range])}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard__sales-filters">
            <p className="dashboard__analysis-label">Filter a period</p>
            <div className="dashboard__filter-line">
            <div className="dashboard__filter-group">
              {quickFilters.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPeriodRange(item.range())}
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
                    if (value) {
                      const range = getMonthRange(value);
                      setCustomFrom(range.from);
                      setCustomTo(range.to);
                    }
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
                  applyPeriodRange({
                    from: customFrom || null,
                    to: customTo || null,
                    label: describeRange(customFrom, customTo, 'Custom Range'),
                  });
                }}
              >
                Apply
              </Button>
              {periodApplied && (
                <Button type="button" size="sm" variant="secondary" onClick={clearPeriodFilter}>
                  Clear
                </Button>
              )}
            </div>
            </div>
          </div>

          {periodApplied && (
            <>
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
                    to={card.to}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Recent orders</h3>
            {appliedRange && (
              <p className="dashboard__section-note">
                Showing orders placed {appliedRange.label}
              </p>
            )}
          </div>
          <Link to={recentOrdersPath}>
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        </div>
        <DataTable
          columns={columns}
          data={recentOrders}
          emptyMessage={error ? 'Unable to load orders.' : 'No recent orders.'}
        />
      </section>
    </div>
  );
}
