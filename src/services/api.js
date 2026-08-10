/**
 * Domain API methods used by pages.
 * Backed by VITE_API_URL via services/http.js.
 * Products remain local until a products API is available (currently 501).
 */

import {
  apiRequest,
  clearAuthSession,
  getStoredAdmin,
  getToken,
  isAuthenticated,
  setAuthSession,
  setStoredAdmin,
} from './http';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
} from '../data/dummyOrders';

export { isAuthenticated };

/* ─── Auth ─────────────────────────────────────────────────────────── */

export async function login(email, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });

  if (!data?.success || !data?.token || !data?.admin) {
    return {
      success: false,
      message: data?.message || 'Login failed',
    };
  }

  setAuthSession(data.token, data.admin);
  return { success: true, user: data.admin, token: data.token };
}

export function logout() {
  clearAuthSession();
}

export function getCurrentUser() {
  return getStoredAdmin();
}

export function getAuthToken() {
  return getToken();
}

export async function getProfile() {
  const data = await apiRequest('/api/auth/profile');
  const admin = data?.admin || data?.data || data;
  if (admin && (admin.email || admin.full_name)) {
    setStoredAdmin(admin);
  }
  return admin;
}

export async function updateProfile({ full_name, email }) {
  const data = await apiRequest('/api/auth/profile', {
    method: 'PUT',
    body: { full_name, email },
  });
  const admin = data?.admin || data?.data || {
    ...getStoredAdmin(),
    full_name,
    email,
  };
  setStoredAdmin(admin);
  return { success: true, user: admin, message: data?.message };
}

export async function changePassword({
  current_password,
  new_password,
  confirm_password,
}) {
  const data = await apiRequest('/api/auth/change-password', {
    method: 'PUT',
    body: {
      current_password,
      new_password,
      confirm_password,
    },
  });
  return {
    success: true,
    message: data?.message || 'Password updated successfully',
  };
}

/* ─── Orders ───────────────────────────────────────────────────────── */

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.orders)) return data.orders;
  return [];
}

function unwrapItem(data) {
  if (!data) return null;
  if (data.order) return data.order;
  if (data.data && !Array.isArray(data.data)) return data.data;
  return data;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Normalize API snake_case order into UI-friendly fields. */
export function normalizeOrder(order) {
  if (!order) return null;

  const addressParts = [
    order.address,
    order.city,
    order.state,
    order.pincode,
  ].filter(Boolean);

  return {
    ...order,
    id: order.id,
    orderNumber: order.order_number || order.orderNumber || String(order.id),
    customerName: order.customer_name || order.customerName || '',
    phone: order.phone || '',
    email: order.email || '',
    address: order.address || '',
    city: order.city || '',
    state: order.state || '',
    pincode: order.pincode || '',
    fullAddress: addressParts.join(', '),
    quantity: order.quantity ?? 0,
    unitPrice: order.unit_price ?? order.unitPrice ?? 0,
    total: order.total_amount ?? order.total ?? 0,
    paymentMethod: order.payment_method || order.paymentMethod || '—',
    paymentStatus: order.payment_status || order.paymentStatus || 'Pending',
    status: order.order_status || order.status || 'New',
    date: formatDate(order.created_at || order.date),
    createdAt: order.created_at || null,
    updatedAt: order.updated_at || null,
  };
}

export async function getOrders() {
  const data = await apiRequest('/api/orders');
  return unwrapList(data).map(normalizeOrder);
}

export async function getOrderById(id) {
  const data = await apiRequest(`/api/orders/${id}`);
  return normalizeOrder(unwrapItem(data));
}

export async function updateOrderStatus(id, status, paymentStatus) {
  const body = {};
  if (status !== undefined) body.order_status = status;
  if (paymentStatus !== undefined) body.payment_status = paymentStatus;

  const data = await apiRequest(`/api/orders/${id}`, {
    method: 'PUT',
    body,
  });
  return normalizeOrder(unwrapItem(data)) || (await getOrderById(id));
}

export async function deleteOrder(id) {
  await apiRequest(`/api/orders/${id}`, { method: 'DELETE' });
  return { success: true };
}

export async function getOrderStats() {
  const orders = await getOrders();
  const statusOf = (o) => String(o.status || '').toLowerCase();
  const payOf = (o) => String(o.paymentStatus || '').toLowerCase();

  return {
    total: orders.length,
    new: orders.filter((o) => ['new', 'pending'].includes(statusOf(o))).length,
    confirmed: orders.filter((o) => statusOf(o) === 'confirmed').length,
    delivered: orders.filter((o) => statusOf(o) === 'delivered').length,
    pendingPayments: orders.filter((o) => payOf(o) === 'pending').length,
    completedPayments: orders.filter((o) => payOf(o) === 'paid').length,
  };
}

export function getOrderStatuses() {
  return [...ORDER_STATUSES];
}

export function getPaymentStatuses() {
  return [...PAYMENT_STATUSES];
}

export function getPaymentMethods() {
  return [...PAYMENT_METHODS];
}

/* ─── Products (ready for future GET /api/products) ────────────────── */

let productsStore = [];

export async function getProducts() {
  return [...productsStore];
}

export async function getProductById(id) {
  return productsStore.find((p) => p.id === id) || null;
}

export async function createProduct(product) {
  const nextNum = productsStore.length + 1;
  const newProduct = {
    ...product,
    id: `PRD-${String(nextNum).padStart(3, '0')}`,
    status: product.stock > 0 ? 'Active' : 'Out of Stock',
  };
  productsStore = [newProduct, ...productsStore];
  return newProduct;
}

export async function updateProduct(id, updates) {
  productsStore = productsStore.map((p) =>
    p.id === id
      ? {
          ...p,
          ...updates,
          status:
            updates.stock !== undefined
              ? updates.stock > 0
                ? updates.status || 'Active'
                : 'Out of Stock'
              : updates.status || p.status,
        }
      : p
  );
  return productsStore.find((p) => p.id === id) || null;
}

export async function deleteProduct(id) {
  productsStore = productsStore.filter((p) => p.id !== id);
  return { success: true };
}
