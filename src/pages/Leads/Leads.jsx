import { useEffect, useMemo, useState } from 'react';
import { deleteLead, deleteOrder, getLeads } from '../../services/api';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import '../../styles/shared.css';
import '../Orders/Orders.css';

const PAGE_SIZE = 10;

const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
};

/**
 * Leads: unpaid checkouts, for follow-up only.
 *  - Checkout: customer filled in their details but did not place the order (no order exists).
 *  - Online: Razorpay order created but the payment is still Pending or Failed.
 *    Once the payment succeeds the order leaves Leads and appears in Orders.
 */
export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setError('');
    try {
      setLeads(await getLeads());
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to load leads.');
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleDelete = async (lead) => {
    const name = lead.customerName || lead.phone || lead.orderNumber;
    const prompt = lead.leadType === 'online'
      ? `Delete lead ${lead.orderNumber} (${name})? The unpaid order will be moved to Deleted Orders.`
      : `Delete lead ${lead.orderNumber} (${name})? It will be removed from this list.`;
    if (!window.confirm(prompt)) return;
    setDeletingId(lead.leadId);
    setError('');
    setMessage('');
    try {
      if (lead.leadType === 'online') await deleteOrder(lead.orderId);
      else await deleteLead(lead.leadId);
      setLeads((prev) => prev.filter((item) => item.leadId !== lead.leadId));
      setMessage(`Lead ${lead.orderNumber} deleted.`);
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to delete lead.');
    } finally {
      setDeletingId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.orderNumber, lead.customerName, lead.phone, lead.email, lead.city, lead.state, lead.pincode, lead.promoCode]
        .some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [leads, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns = [
    {
      key: 'createdAt',
      label: 'Lead',
      render: (lead) => (
        <div className="orders__customer">
          <strong>{lead.orderNumber}</strong>
          <span>{lead.orderedDate || '—'}</span>
          <span>{lead.orderedTime || '—'}</span>
        </div>
      ),
    },
    {
      key: 'customerName',
      label: 'Customer',
      render: (lead) => (
        <div className="orders__customer">
          <strong>{lead.customerName || '—'}</strong>
          <span>{lead.email || '—'}</span>
          <span>{lead.phone || '—'}</span>
          <span className="orders__address">{lead.fullAddress || '—'}</span>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (lead) => `₹${lead.total}`,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (lead) => (
        <div className="orders__customer">
          <StatusBadge status={lead.leadType === 'online' ? lead.paymentStatus : 'Pending'} />
          <span>{lead.leadType === 'online' ? 'online' : 'cod'}</span>
        </div>
      ),
    },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      render: (lead) =>
        lead.leadType === 'online' ? (
          'Online'
        ) : (
          <div className="orders__customer">
            <span>COD</span>
            <span>Order not placed</span>
          </div>
        ),
    },
    {
      key: 'promoCode',
      label: 'Promo',
      render: (lead) =>
        lead.promoCode ? <strong className="orders__promo-code">{lead.promoCode}</strong> : '—',
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (lead) =>
        lead.phone ? (
          <div className="orders__actions">
            <a href={`tel:${lead.phone}`}>
              <Button size="sm" variant="outline-primary">Call</Button>
            </a>
            <a href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline-primary">WhatsApp</Button>
            </a>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (lead) => (
        <Button
          size="sm"
          variant="danger"
          disabled={deletingId === lead.leadId}
          onClick={() => handleDelete(lead)}
        >
          {deletingId === lead.leadId ? 'Deleting…' : 'Delete'}
        </Button>
      ),
    },
  ];

  if (loading) return <div className="loading-state">Loading leads…</div>;

  return (
    <div className="page orders">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Leads</h2>
          <p>Customers who entered their details but left without ordering: online orders with payment Pending or Failed, and checkouts where the order was not placed.</p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--info">{message}</div>}

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
                placeholder="Search name, phone, email, city"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="orders__page-indicator">
              {filtered.length} lead{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <DataTable columns={columns} data={visible} emptyMessage="No leads yet." />
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
