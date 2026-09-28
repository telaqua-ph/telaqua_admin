import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRevenueReport } from '../../services/api';
import { DataTable } from '../../components/Tables';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { todayInKolkata } from '../../utils/orderDateRange';
import '../../styles/shared.css';
import './Revenue.css';

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function thisWeek() {
  const to = todayInKolkata();
  const date = new Date(`${to}T00:00:00Z`);
  const mondayOffset = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  return { from: addDays(to, -mondayOffset), to };
}

function thisMonth() {
  const to = todayInKolkata();
  return { from: `${to.slice(0, 7)}-01`, to };
}

function displayDate(date) {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fillDays(from, to, values) {
  const indexed = new Map(values.map((item) => [item.date, item.amount]));
  const output = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    output.push({ date: day, amount: indexed.get(day) || 0 });
  }
  return output;
}

export default function Revenue() {
  const today = todayInKolkata();
  const [range, setRange] = useState({ from: today, to: today, preset: 'today' });
  const [custom, setCustom] = useState({ from: today, to: today });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await getRevenueReport(range));
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load revenue for this period.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const chartDays = useMemo(
    () => fillDays(range.from, range.to, report?.daily || []),
    [range, report]
  );
  const maxDay = Math.max(...chartDays.map((day) => day.amount), 1);
  const receivedOrders = report?.orders.filter((order) => order.bucket === 'received') || [];
  const listedReceived = receivedOrders.reduce((sum, order) => sum + order.amount, 0);
  const listedPending = (report?.orders || [])
    .filter((order) => order.bucket === 'pending')
    .reduce((sum, order) => sum + order.amount, 0);

  const choosePreset = (preset) => {
    const next = preset === 'today'
      ? { from: todayInKolkata(), to: todayInKolkata() }
      : preset === 'week' ? thisWeek() : thisMonth();
    setRange({ ...next, preset });
  };

  const applyCustom = (event) => {
    event.preventDefault();
    if (!custom.from || !custom.to || custom.from > custom.to) {
      setError('Choose a valid date range.');
      return;
    }
    setRange({ ...custom, preset: 'custom' });
  };

  const columns = [
    { key: 'order_number', label: 'Order', render: (row) => <Link className="revenue__order-link" to={`/orders/${row.id}`}>{row.order_number || `#${row.id}`}</Link> },
    { key: 'accounting_date', label: 'Date', render: (row) => displayDate(row.accounting_date) },
    { key: 'payment_mode', label: 'Payment mode' },
    { key: 'payment_status', label: 'Payment status', render: (row) => <StatusBadge status={row.payment_status} /> },
    { key: 'bucket', label: 'Included in', render: (row) => <span className={`revenue__bucket revenue__bucket--${row.bucket}`}>{row.bucket === 'received' ? 'Received' : 'Pending COD'}</span> },
    { key: 'amount', label: 'Amount', render: (row) => <strong>{formatInr(row.amount)}</strong> },
    { key: 'action', label: 'Action', render: (row) => <Link className="revenue__view" to={`/orders/${row.id}`}>Open order</Link> },
  ];

  return (
    <div className="page revenue">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Revenue</h2>
          <p>Payment-confirmed revenue and outstanding confirmed COD collections. Refunded payments are excluded.</p>
        </div>
        <span className="revenue__timezone">Asia/Kolkata</span>
      </div>

      <section className="panel revenue__filters">
        <div className="panel__body">
          <div className="revenue__preset-buttons" aria-label="Revenue date filters">
            {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => choosePreset(key)} className={range.preset === key ? 'revenue__preset revenue__preset--active' : 'revenue__preset'}>{label}</button>
            ))}
          </div>
          <form className="revenue__custom-range" onSubmit={applyCustom}>
            <label>From<input type="date" value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} /></label>
            <label>To<input type="date" value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} /></label>
            <button type="submit" className={range.preset === 'custom' ? 'revenue__preset revenue__preset--active' : 'revenue__preset'}>Apply range</button>
          </form>
        </div>
      </section>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {loading ? <div className="loading-state">Loading revenue…</div> : report ? <>
        <section className="revenue__summary">
          <article className="revenue__card revenue__card--received"><span>Revenue Received</span><strong>{formatInr(report.receivedRevenue)}</strong><small>Razorpay + explicitly paid COD</small></article>
          <article className="revenue__card revenue__card--pending"><span>Pending COD Revenue</span><strong>{formatInr(report.pendingCodRevenue)}</strong><small>Confirmed COD orders still Pending</small></article>
          <article className="revenue__card"><span>Razorpay received</span><strong>{formatInr(report.razorpayRevenue)}</strong><small>Paid online orders</small></article>
          <article className="revenue__card"><span>COD received</span><strong>{formatInr(report.codRevenue)}</strong><small>COD marked Paid</small></article>
        </section>

        <section className="panel">
          <div className="panel__header"><div><h3>Daily received revenue</h3><p className="revenue__panel-subtitle">Paid-date basis for {displayDate(range.from)} – {displayDate(range.to)}</p></div><strong>{formatInr(report.receivedRevenue)}</strong></div>
          <div className="revenue__chart" role="img" aria-label="Daily received revenue chart">
            {chartDays.map((day) => <div className="revenue__bar-group" key={day.date} title={`${displayDate(day.date)}: ${formatInr(day.amount)}`}><span className="revenue__bar-value">{day.amount ? formatInr(day.amount) : ''}</span><div className="revenue__bar-track"><div className="revenue__bar" style={{ height: `${Math.max(day.amount ? 8 : 0, (day.amount / maxDay) * 100)}%` }} /></div><span className="revenue__bar-label">{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>)}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><div><h3>Contributing orders</h3><p className="revenue__panel-subtitle">Received orders use their Paid date; pending COD uses its order date.</p></div></div>
          <DataTable columns={columns} data={report.orders} emptyMessage="No paid or confirmed pending COD orders in this period." />
          <div className="revenue__reconciliation">Table totals: Received <strong>{formatInr(listedReceived)}</strong> · Pending COD <strong>{formatInr(listedPending)}</strong></div>
        </section>
      </> : null}
    </div>
  );
}
