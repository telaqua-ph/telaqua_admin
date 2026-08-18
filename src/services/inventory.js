/**
 * Inventory + admin notification API client.
 */

import { apiRequest } from './http';

export async function getInventory() {
  const data = await apiRequest('/api/inventory');
  return {
    items: data?.items || [],
    totals: data?.totals || {},
  };
}

export async function getInventoryHistory(params = {}) {
  const qs = new URLSearchParams();
  if (params.sku) qs.set('sku', params.sku);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest(`/api/inventory/history${suffix}`);
  return data?.history || [];
}

export async function addStock({ sku, quantity, reason }) {
  return apiRequest('/api/inventory/add-stock', {
    method: 'POST',
    body: { sku, quantity, reason },
  });
}

export async function adjustStock({
  sku,
  quantity_change,
  transaction_type,
  reason,
}) {
  return apiRequest('/api/inventory/adjust', {
    method: 'POST',
    body: {
      sku,
      quantity_change,
      transaction_type,
      reason,
    },
  });
}

export async function updateLowStockThreshold(sku, threshold) {
  return apiRequest(`/api/inventory/${encodeURIComponent(sku)}/threshold`, {
    method: 'PATCH',
    body: { threshold },
  });
}

export async function getNotifications(unreadOnly = false) {
  const suffix = unreadOnly ? '?unread=true' : '';
  const data = await apiRequest(`/api/inventory/notifications/list${suffix}`);
  return {
    notifications: data?.notifications || [],
    unread_count: Number(data?.unread_count || 0),
  };
}

export async function markNotificationRead(id) {
  return apiRequest(`/api/inventory/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead() {
  return apiRequest('/api/inventory/notifications/read-all', {
    method: 'PATCH',
  });
}
