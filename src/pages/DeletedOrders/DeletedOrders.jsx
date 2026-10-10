import { useEffect, useMemo, useState } from 'react';
import { getDeletedOrders, exportDeletedOrders } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import { downloadDeletedOrdersCsv } from '../../utils/exportDeletedOrdersCsv';
import '../../styles/shared.css';
import '../Orders/Orders.css';

const PAGE_SIZE = 10;
const formatDate = (value) => value ? new Date(value).toLocaleString('en-IN') : '—';

export default function DeletedOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getDeletedOrders().then(setOrders).catch((err) => setError(err.message || 'Failed to load deleted orders.')).finally(() => setLoading(false));
  }, []);

  const pages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const visible = useMemo(() => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [orders, page]);
  const download = async () => {
    setDownloading(true); setError(''); setMessage('');
    try {
      const { orders: all } = await exportDeletedOrders();
      if (!all.length) { setMessage('There are no deleted orders to download.'); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadDeletedOrdersCsv(all, `telaqua-deleted-orders-${stamp}.csv`);
      setMessage(`Downloaded ${all.length} deleted order${all.length === 1 ? '' : 's'}.`);
    } catch (err) { setError(err.message || 'Failed to download deleted orders CSV.'); }
    finally { setDownloading(false); }
  };

  const columns = [
    { key: 'orderNumber', label: 'Order' },
    { key: 'customer', label: 'Customer', render: (o) => <div className="orders__customer"><strong>{o.customerName || '—'}</strong><span>{o.email || '—'}</span><span>{o.phone || '—'}</span></div> },
    { key: 'product', label: 'Items', render: (o) => `${o.product} × ${o.quantity}` },
    { key: 'total', label: 'Total', render: (o) => `₹${Number(o.total || 0).toFixed(2)}` },
    { key: 'paymentStatus', label: 'Payment', render: (o) => `${o.paymentStatus} (${o.paymentMode})` },
    { key: 'shipmentStatus', label: 'Shipment', render: (o) => `${o.shipmentStatus || '—'}${o.waybill ? ` · ${o.waybill}` : ''}` },
    { key: 'createdAt', label: 'Ordered At', render: (o) => formatDate(o.createdAt) },
    { key: 'deletedAt', label: 'Deleted At', render: (o) => formatDate(o.deletedAt) },
    { key: 'deletedBy', label: 'Deleted By', render: (o) => o.deletedBy || '—' },
  ];
  if (loading) return <div className="loading-state">Loading deleted orders…</div>;
  return <div className="page orders"><div className="page__header"><div className="page__header-text"><h2>Deleted Orders</h2><p>Archived orders are retained for audit and export.</p></div><Button onClick={download} disabled={downloading}>{downloading ? 'Preparing CSV…' : 'Download CSV'}</Button></div>
    {error && <div className="alert alert--error">{error}</div>}{message && <div className="alert alert--info">{message}</div>}
    <section className="panel"><DataTable columns={columns} data={visible} emptyMessage="No deleted orders found." />
      {orders.length > PAGE_SIZE && <div className="orders__table-pagination"><Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="orders__page-indicator">Page {page} of {pages}</span><Button size="sm" variant="secondary" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>}
    </section></div>;
}
