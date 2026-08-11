import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPromoCode,
  getPromoCodes,
  setPromoCodeStatus,
  updatePromoCode,
} from '../../services/promoCodes';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import { Modal } from '../../components/Modal';
import '../../styles/shared.css';
import './PromoCodes.css';

const PLATFORM_OPTIONS = [
  'Website',
  'Social Media',
  'WhatsApp',
  'Email',
  'Influencer',
  'Other',
];

const LANGUAGE_OPTIONS = ['Direct', 'Telugu', 'Hindi', 'English', 'Other'];

const emptyForm = {
  platform: 'Website',
  language: 'Direct',
  code: '',
  original_price: '',
  promo_price: '',
  is_active: true,
  usage_limit: '',
};

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function validateForm(form, { requireActiveField }) {
  const code = String(form.code || '').trim().toUpperCase();
  const original = Number(form.original_price);
  const promo = Number(form.promo_price);
  const platform = String(form.platform || '').trim();
  const language = String(form.language || '').trim();

  if (!platform) return 'Platform is required.';
  if (!language) return 'Language is required.';
  if (!code) return 'Promo code is required.';
  if (!Number.isFinite(original) || original <= 0) {
    return 'Original price must be greater than 0.';
  }
  if (!Number.isFinite(promo) || promo < 0) {
    return 'Promo price must be 0 or greater.';
  }
  if (promo > original) {
    return 'Promo price cannot be greater than original price.';
  }

  if (requireActiveField && typeof form.is_active !== 'boolean') {
    return 'Active status is required.';
  }

  const limitRaw = String(form.usage_limit ?? '').trim();
  if (limitRaw !== '') {
    const limit = Number(limitRaw);
    if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit)) {
      return 'Usage limit must be a whole number, or left empty for unlimited.';
    }
  }

  return '';
}

function buildCreatePayload(form) {
  const limitRaw = String(form.usage_limit ?? '').trim();
  return {
    platform: String(form.platform).trim(),
    language: String(form.language).trim(),
    code: String(form.code).trim().toUpperCase(),
    original_price: Number(form.original_price),
    promo_price: Number(form.promo_price),
    is_active: Boolean(form.is_active),
    usage_limit: limitRaw === '' ? null : Number(limitRaw),
  };
}

function buildUpdatePayload(form) {
  const limitRaw = String(form.usage_limit ?? '').trim();
  return {
    platform: String(form.platform).trim(),
    language: String(form.language).trim(),
    code: String(form.code).trim().toUpperCase(),
    original_price: Number(form.original_price),
    promo_price: Number(form.promo_price),
    usage_limit: limitRaw === '' ? null : Number(limitRaw),
  };
}

export default function PromoCodes() {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ all: 0, active: 0, inactive: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);

  const loadList = useCallback(async (filter = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const statusParam =
        filter === 'active' || filter === 'inactive' ? filter : undefined;
      const [list, allList] = await Promise.all([
        getPromoCodes(statusParam),
        filter === 'all' ? Promise.resolve(null) : getPromoCodes(),
      ]);

      setPromoCodes(list);

      const base = allList || list;
      setCounts({
        all: base.length,
        active: base.filter((p) => p.isActive).length,
        inactive: base.filter((p) => !p.isActive).length,
      });
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Failed to load promo codes');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadList(statusFilter);
  }, [loadList, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promoCodes;
    return promoCodes.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        row.platform.toLowerCase().includes(q) ||
        row.language.toLowerCase().includes(q)
    );
  }, [promoCodes, search]);

  const openCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setModalMode('edit');
    setEditingId(row.id);
    setForm({
      platform: row.platform || 'Website',
      language: row.language || 'Direct',
      code: row.code || '',
      original_price: String(row.originalPrice ?? ''),
      promo_price: String(row.promoPrice ?? ''),
      is_active: Boolean(row.isActive),
      usage_limit:
        row.usageLimit === null || row.usageLimit === undefined
          ? ''
          : String(row.usageLimit),
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateForm(form, {
      requireActiveField: modalMode === 'create',
    });
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setMessage('');

    try {
      if (modalMode === 'create') {
        const result = await createPromoCode(buildCreatePayload(form));
        setMessage(result.message || 'Promo code created successfully');
      } else {
        const result = await updatePromoCode(
          editingId,
          buildUpdatePayload(form)
        );
        setMessage(result.message || 'Promo code updated successfully');
      }
      setModalOpen(false);
      await loadList(statusFilter);
    } catch (err) {
      if (err.status === 401) return;
      if (err.status === 409) {
        setFormError(err.message || 'Promo code already exists');
      } else if (err.status === 404) {
        setFormError(err.message || 'Promo code not found');
      } else if (err.status === 400 || err.status === 422) {
        setFormError(err.message || 'Please check the form fields.');
      } else if (err.status >= 500) {
        setFormError('Server error. Please try again later.');
      } else {
        setFormError(err.message || 'Failed to save promo code');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    const nextActive = !row.isActive;
    const action = nextActive ? 'activate' : 'deactivate';
    if (
      !window.confirm(
        `${nextActive ? 'Activate' : 'Deactivate'} promo code "${row.code}"?`
      )
    ) {
      return;
    }

    setStatusBusyId(row.id);
    setError('');
    setMessage('');
    try {
      const result = await setPromoCodeStatus(row.id, nextActive);
      setPromoCodes((prev) =>
        prev.map((item) => {
          if (item.id !== row.id) return item;
          const merged = result.promoCode
            ? { ...item, ...result.promoCode }
            : {
                ...item,
                isActive: nextActive,
                statusLabel: nextActive ? 'Active' : 'Inactive',
              };
          return merged;
        })
      );
      setMessage(
        result.message ||
          `Promo code ${action}d successfully`
      );
      // Keep counts in sync; if filtered list would hide the row, refresh.
      if (
        (statusFilter === 'active' && !nextActive) ||
        (statusFilter === 'inactive' && nextActive)
      ) {
        await loadList(statusFilter);
      } else {
        setCounts((prev) => {
          const delta = nextActive ? 1 : -1;
          return {
            ...prev,
            active: Math.max(0, prev.active + delta),
            inactive: Math.max(0, prev.inactive - delta),
          };
        });
      }
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || `Failed to ${action} promo code`);
      }
    } finally {
      setStatusBusyId(null);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (row) => <strong className="promo-codes__code">{row.code}</strong>,
    },
    { key: 'platform', label: 'Platform' },
    { key: 'language', label: 'Language' },
    {
      key: 'originalPrice',
      label: 'Original',
      render: (row) => formatInr(row.originalPrice),
    },
    {
      key: 'promoPrice',
      label: 'Promo',
      render: (row) => formatInr(row.promoPrice),
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (row) => formatInr(row.discount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.statusLabel} />,
    },
    {
      key: 'usageLimit',
      label: 'Usage limit',
      render: (row) =>
        row.usageLimit === null || row.usageLimit === undefined
          ? 'Unlimited'
          : String(row.usageLimit),
    },
    {
      key: 'usedCount',
      label: 'Used',
      render: (row) => String(row.usedCount ?? 0),
    },
    {
      key: 'dates',
      label: 'Created / Updated',
      render: (row) => (
        <div className="promo-codes__dates">
          <span>{row.createdAtLabel}</span>
          <span>{row.updatedAtLabel}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="promo-codes__actions">
          <Button
            size="sm"
            variant="outline-primary"
            disabled={Boolean(statusBusyId)}
            onClick={() => openEdit(row)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant={row.isActive ? 'secondary' : 'primary'}
            disabled={statusBusyId === row.id}
            onClick={() => handleToggleStatus(row)}
          >
            {statusBusyId === row.id
              ? 'Updating…'
              : row.isActive
                ? 'Deactivate'
                : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  const discountPreview =
    Number(form.original_price) > 0 &&
    Number(form.promo_price) >= 0 &&
    Number(form.promo_price) <= Number(form.original_price)
      ? Number(form.original_price) - Number(form.promo_price)
      : null;

  return (
    <div className="page promo-codes">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Discounts</h2>
          <p>Manage promo codes for Website, Social, and campaign channels</p>
        </div>
        <Button onClick={openCreate}>Add coupon</Button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      <div className="promo-codes__buckets">
        {[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'active', label: 'Active', count: counts.active },
          { id: 'inactive', label: 'Inactive', count: counts.inactive },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`promo-codes__bucket ${
              statusFilter === tab.id ? 'promo-codes__bucket--active' : ''
            }`}
            onClick={() => setStatusFilter(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel__header">
          <div className="toolbar promo-codes__toolbar">
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
                placeholder="Search by code, platform, language…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading promo codes…</div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            emptyMessage={
              error
                ? 'Unable to load promo codes.'
                : 'No promo codes yet. Create your first coupon.'
            }
          />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? 'Add coupon' : 'Edit coupon'}
        onClose={closeModal}
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="promo-code-form"
              disabled={saving}
            >
              {saving
                ? 'Saving…'
                : modalMode === 'create'
                  ? 'Create coupon'
                  : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="promo-code-form" className="promo-codes__form" onSubmit={handleSubmit}>
          {formError && <div className="alert alert--error">{formError}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="promo-platform">Platform</label>
              <input
                id="promo-platform"
                list="promo-platform-options"
                value={form.platform}
                onChange={(e) =>
                  setForm((f) => ({ ...f, platform: e.target.value }))
                }
                placeholder="Website"
                required
              />
              <datalist id="promo-platform-options">
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label htmlFor="promo-language">Language</label>
              <input
                id="promo-language"
                list="promo-language-options"
                value={form.language}
                onChange={(e) =>
                  setForm((f) => ({ ...f, language: e.target.value }))
                }
                placeholder="Direct"
                required
              />
              <datalist id="promo-language-options">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="form-group form-group--full">
              <label htmlFor="promo-code">Code</label>
              <input
                id="promo-code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="WELCOME25"
                autoComplete="off"
                required
              />
              <p className="form-hint">Codes are stored uppercase.</p>
            </div>

            <div className="form-group">
              <label htmlFor="promo-original">Original price (₹)</label>
              <input
                id="promo-original"
                type="number"
                min="1"
                step="1"
                value={form.original_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, original_price: e.target.value }))
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="promo-price">Promo price (₹)</label>
              <input
                id="promo-price"
                type="number"
                min="0"
                step="1"
                value={form.promo_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, promo_price: e.target.value }))
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="promo-limit">Usage limit</label>
              <input
                id="promo-limit"
                type="number"
                min="0"
                step="1"
                value={form.usage_limit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, usage_limit: e.target.value }))
                }
                placeholder="Leave empty for unlimited"
              />
            </div>

            {modalMode === 'create' && (
              <div className="form-group">
                <label className="promo-codes__toggle-label" htmlFor="promo-active">
                  <input
                    id="promo-active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  Active on create
                </label>
              </div>
            )}
          </div>

          {discountPreview !== null && (
            <p className="promo-codes__preview">
              Discount preview: <strong>{formatInr(discountPreview)}</strong>
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
