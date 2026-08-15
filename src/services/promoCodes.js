/**
 * Admin promo-code CRUD via Hostinger backend.
 * Auth: Bearer admin JWT only (via apiRequest). Never send isAdmin from UI.
 */

import { apiRequest } from './http';

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatIstDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Convert a stored timestamp to datetime-local value in IST. */
export function toIstDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Normalize API record for admin UI. */
export function normalizePromoCode(row) {
  if (!row) return null;

  const original = Number(row.original_price ?? row.originalPrice ?? 0);
  const promo = Number(row.promo_price ?? row.promoPrice ?? 0);
  const usageRaw = row.usage_limit ?? row.usageLimit;
  const usageLimit =
    usageRaw === undefined || usageRaw === null ? null : Number(usageRaw);
  const usedCount = Number(row.used_count ?? row.usedCount ?? 0);
  const isActive = Boolean(row.is_active ?? row.isActive);
  const validFrom = row.valid_from ?? row.validFrom ?? null;
  const validUntil = row.valid_until ?? row.validUntil ?? null;
  const effectiveStatus =
    row.effective_status ||
    row.effectiveStatus ||
    (isActive ? 'Active' : 'Inactive');

  return {
    id: row.id,
    platform: row.platform || '',
    language: row.language || '',
    code: String(row.code || '').toUpperCase(),
    originalPrice: original,
    promoPrice: promo,
    discount: Math.max(0, original - promo),
    isActive,
    statusLabel: effectiveStatus,
    usageLimit: Number.isFinite(usageLimit) ? usageLimit : null,
    usedCount: Number.isFinite(usedCount) ? usedCount : 0,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAtLabel: formatDateTime(row.created_at || row.createdAt),
    updatedAtLabel: formatDateTime(row.updated_at || row.updatedAt),
    validFrom,
    validUntil,
    validFromLabel: validFrom ? formatIstDateTime(validFrom) : null,
    validUntilLabel: validUntil ? formatIstDateTime(validUntil) : null,
    validFromLocal: toIstDatetimeLocal(validFrom),
    validUntilLocal: toIstDatetimeLocal(validUntil),
  };
}

/**
 * GET /api/promo-codes
 * Optional: status=active|inactive
 */
export async function getPromoCodes(status) {
  const params = {};
  if (status === 'active' || status === 'inactive') {
    params.status = status;
  }
  const data = await apiRequest(`/api/promo-codes${qs(params)}`);
  const list = Array.isArray(data?.promoCodes)
    ? data.promoCodes
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];
  return list.map(normalizePromoCode).filter(Boolean);
}

/** GET /api/promo-codes/:id */
export async function getPromoCodeById(id) {
  const data = await apiRequest(`/api/promo-codes/${id}`);
  return normalizePromoCode(data?.promoCode || data?.data || data);
}

/**
 * POST /api/promo-codes
 * Do not send id, used_count, created_at, updated_at.
 */
export async function createPromoCode(payload) {
  const data = await apiRequest('/api/promo-codes', {
    method: 'POST',
    body: payload,
  });
  return {
    message: data?.message || 'Promo code created successfully',
    promoCode: normalizePromoCode(data?.promoCode || data?.data),
  };
}

/**
 * PUT /api/promo-codes/:id
 * Editable fields only — no used_count / timestamps.
 */
export async function updatePromoCode(id, payload) {
  const data = await apiRequest(`/api/promo-codes/${id}`, {
    method: 'PUT',
    body: payload,
  });
  return {
    message: data?.message || 'Promo code updated successfully',
    promoCode: normalizePromoCode(data?.promoCode || data?.data),
  };
}

/**
 * PATCH /api/promo-codes/:id/status
 * Activate / deactivate only — never delete.
 */
export async function setPromoCodeStatus(id, isActive) {
  const data = await apiRequest(`/api/promo-codes/${id}/status`, {
    method: 'PATCH',
    body: { is_active: Boolean(isActive) },
  });
  return {
    message: data?.message || 'Promo code status updated successfully',
    promoCode: normalizePromoCode(data?.promoCode || data?.data),
  };
}
