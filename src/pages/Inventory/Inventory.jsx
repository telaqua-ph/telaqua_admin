import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatCard } from '../../components/Cards';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import { Modal } from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import {
  addStock,
  adjustStock,
  getInventory,
  getInventoryHistory,
  updateLowStockThreshold,
} from '../../services/inventory';
import '../../styles/shared.css';
import './Inventory.css';

const icons = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    </svg>
  ),
  sold: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  remaining: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

function statusLabel(status) {
  if (status === 'OUT_OF_STOCK') return 'Out of Stock';
  if (status === 'LOW_STOCK') return 'Low Stock';
  return 'In Stock';
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN');
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [inventoryData, historyData] = await Promise.all([
        getInventory(),
        getInventoryHistory({ limit: 50 }),
      ]);
      setItems(inventoryData.items);
      setTotals(inventoryData.totals);
      setHistory(historyData);
    } catch (err) {
      setError(err?.message || 'Could not load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const productColumns = useMemo(
    () => [
      { key: 'product_name', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'total_stock', label: 'Total Stock' },
      { key: 'sold', label: 'Sold' },
      { key: 'remaining', label: 'Remaining' },
      { key: 'low_stock_threshold', label: 'Threshold' },
      {
        key: 'status',
        label: 'Status',
        render: (row) => (
          <StatusBadge status={statusLabel(row.status)} />
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div className="inventory-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setForm({ sku: row.sku, quantity: '', reason: '' });
                setModal('add');
              }}
            >
              Add Stock
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setForm({
                  sku: row.sku,
                  quantity_change: '',
                  transaction_type: 'ADJUSTMENT',
                  reason: '',
                });
                setModal('adjust');
              }}
            >
              Adjust
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm({ sku: row.sku, threshold: String(row.low_stock_threshold) });
                setModal('threshold');
              }}
            >
              Threshold
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const historyColumns = useMemo(
    () => [
      { key: 'created_at', label: 'When', render: (row) => formatWhen(row.created_at) },
      { key: 'sku', label: 'SKU' },
      {
        key: 'quantity_change',
        label: 'Change',
        render: (row) => {
          const n = Number(row.quantity_change);
          const prefix = n > 0 ? '+' : '';
          return `${prefix}${n}`;
        },
      },
      { key: 'transaction_type', label: 'Type' },
      {
        key: 'order_number',
        label: 'Order',
        render: (row) => row.order_number || '—',
      },
      {
        key: 'reason',
        label: 'Reason',
        render: (row) => row.reason || '—',
      },
      {
        key: 'stock',
        label: 'Stock',
        render: (row) => `${row.previous_stock} → ${row.new_stock}`,
      },
    ],
    []
  );

  const closeModal = () => {
    setModal(null);
    setForm({});
    setSubmitting(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (modal === 'add') {
        await addStock({
          sku: form.sku,
          quantity: Number(form.quantity),
          reason: form.reason,
        });
        setSuccess('Stock added successfully.');
      } else if (modal === 'adjust') {
        await adjustStock({
          sku: form.sku,
          quantity_change: Number(form.quantity_change),
          transaction_type: form.transaction_type,
          reason: form.reason,
        });
        setSuccess('Stock adjusted successfully.');
      } else if (modal === 'threshold') {
        await updateLowStockThreshold(form.sku, Number(form.threshold));
        setSuccess('Low-stock threshold updated.');
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err?.message || 'Action failed');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="page-loading">Loading inventory…</p>;
  }

  return (
    <div className="inventory-page">
      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      <section className="inventory-cards">
        <StatCard
          title="Total Stock"
          value={totals?.total_stock ?? 0}
          icon={icons.total}
          accent="blue"
        />
        <StatCard
          title="Sold"
          value={totals?.sold ?? 0}
          icon={icons.sold}
          accent="orange"
        />
        <StatCard
          title="Remaining"
          value={totals?.remaining ?? 0}
          icon={icons.remaining}
          accent="green"
        />
        <StatCard
          title="Low Stock Items"
          value={totals?.low_stock_count ?? 0}
          icon={icons.alert}
          accent="amber"
        />
      </section>

      <section className="inventory-section">
        <div className="inventory-section__head">
          <h2>Products</h2>
        </div>
        <DataTable columns={productColumns} data={items} emptyMessage="No products" />
      </section>

      <section className="inventory-section">
        <div className="inventory-section__head">
          <h2>Inventory History</h2>
        </div>
        <DataTable
          columns={historyColumns}
          data={history}
          emptyMessage="No inventory changes yet"
        />
      </section>

      <Modal
        open={modal === 'add'}
        title="Add Stock"
        onClose={closeModal}
      >
        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.quantity || ''}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </label>
          <label>
            Reason / Notes
            <textarea
              required
              rows={3}
              value={form.reason || ''}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <div className="inventory-form__actions">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Stock'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'adjust'}
        title="Adjust Stock"
        onClose={closeModal}
      >
        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            Change (+/- units)
            <input
              type="number"
              step="1"
              required
              value={form.quantity_change || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity_change: e.target.value }))
              }
              placeholder="e.g. -2 for damaged"
            />
          </label>
          <label>
            Type
            <select
              value={form.transaction_type || 'ADJUSTMENT'}
              onChange={(e) =>
                setForm((f) => ({ ...f, transaction_type: e.target.value }))
              }
            >
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </label>
          <label>
            Reason
            <textarea
              required
              rows={3}
              value={form.reason || ''}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <div className="inventory-form__actions">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Apply Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'threshold'}
        title="Low Stock Threshold"
        onClose={closeModal}
      >
        <form className="inventory-form" onSubmit={handleSubmit}>
          <label>
            Threshold (units)
            <input
              type="number"
              min="0"
              step="1"
              required
              value={form.threshold || ''}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
            />
          </label>
          <div className="inventory-form__actions">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Update Threshold'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
