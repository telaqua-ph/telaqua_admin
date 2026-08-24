/**
 * Domain API methods used by pages.
 * Backed by VITE_API_URL via services/http.js (Hostinger).
 * Products remain local until a products API is available.
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

function formatDatePart(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '—';
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimePart(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
    product:
      order.product_name ||
      order.product ||
      order.item_name ||
      'Tel-Aqua Product',
    quantity: order.quantity ?? 0,
    unitPrice: order.unit_price ?? order.unitPrice ?? 0,
    total: order.total_amount ?? order.total ?? 0,
    promoCode: String(order.promo_code || order.promoCode || '').trim(),
    discountAmount: Number(
      order.discount_amount ?? order.discountAmount ?? 0
    ) || 0,
    paymentMethod: order.payment_method || order.paymentMethod || '—',
    paymentStatus: order.payment_status || order.paymentStatus || 'Pending',
    displayStatus: order.display_status || order.displayStatus || '',
    paymentId:
      order.payment_id ||
      order.razorpay_payment_id ||
      order.razorpay_paymentId ||
      '',
    status: order.order_status || order.status || 'New',
    date: formatDateTime(order.created_at || order.date),
    orderedDate: formatDatePart(order.created_at || order.date),
    orderedTime: formatTimePart(order.created_at || order.date),
    createdAt: order.created_at || null,
    updatedAt: order.updated_at || null,
    isSeen: Boolean(order.is_seen ?? order.isSeen ?? false),
    firstViewedAt: order.first_viewed_at || order.firstViewedAt || null,
    lastViewedAt: order.last_viewed_at || order.lastViewedAt || null,
    // Shipment / Delhivery fields
    shipmentRecordId: order.shipment_record_id || order.shipmentRecordId || null,
    fulfillmentStatus: order.fulfillment_status || order.fulfillmentStatus || 'unfulfilled',
    shipmentStatus: order.shipment_status || order.shipmentStatus || 'Not Created',
    shipmentStatusDisplay:
      order.shipment_status_display || order.shipmentStatusDisplay || '',
    shipmentStatusUpdatedAt:
      order.shipment_status_updated_at || order.shipmentStatusUpdatedAt || null,
    shipmentStatusUpdatedAtLabel: formatDateTime(
      order.shipment_status_updated_at || order.shipmentStatusUpdatedAt
    ),
    waybill: order.waybill || '',
    delhiveryShipmentId:
      order.delhivery_shipment_id || order.delhiveryShipmentId || '',
    shipmentCreatedAt: order.shipment_created_at || null,
    shipmentCreatedAtLabel: formatDateTime(order.shipment_created_at),
    serviceable: order.serviceable == null ? null : Boolean(Number(order.serviceable)),
    serviceabilityMessage: order.serviceability_message || '',
    serviceabilityCheckedAt: order.serviceability_checked_at || null,
    serviceabilityCheckedAtLabel: formatDateTime(order.serviceability_checked_at),
    shipmentConfirmedAt: order.shipment_confirmed_at || null,
    shipmentConfirmedAtLabel: formatDateTime(order.shipment_confirmed_at),
    labelData: order.label_data || order.labelData || '',
    pickupStatus: order.pickup_status || order.pickupStatus || 'Not Requested',
    pickupRequestedAt: order.pickup_requested_at || null,
    pickupRequestedAtLabel: formatDateTime(order.pickup_requested_at),
    pickupDate: order.pickup_date || null,
    pickupLocation: order.pickup_location || '',
    pickupReference: order.pickup_reference || '',
    trackingStatus: order.tracking_status || order.trackingStatus || '',
    trackingLocation: order.tracking_location || '',
    trackingStatusAt: order.tracking_status_at || null,
    trackingStatusAtLabel: formatDateTime(order.tracking_status_at),
    trackingUpdatedAt: order.tracking_updated_at || null,
    trackingUpdatedAtLabel: formatDateTime(order.tracking_status_at || order.tracking_updated_at),
    trackingRefreshedAtLabel: formatDateTime(order.tracking_updated_at),
    shipmentError: order.shipment_error || order.shipmentError || '',
    shipmentErrorAt: order.shipment_error_at || null,
    shipmentErrorAtLabel: formatDateTime(order.shipment_error_at),
    expectedDeliveryDate: order.expected_delivery_date || null,
    estimatedTat: order.estimated_tat || null,
    tatCheckedAt: order.tat_checked_at || null,
    tatCheckedAtLabel: formatDateTime(order.tat_checked_at),
    shippingCharge: order.shipping_charge ?? null,
    rateCalculatedAt: order.rate_calculated_at || null,
    rateCalculatedAtLabel: formatDateTime(order.rate_calculated_at),
    labelStatus: order.label_status || '',
    labelGeneratedAt: order.label_generated_at || null,
    labelGeneratedAtLabel: formatDateTime(order.label_generated_at),
    ndrStatus: order.ndr_status || '',
    ndrReason: order.ndr_reason || '',
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

export async function markOrderSeen(id) {
  const data = await apiRequest(`/api/orders/${id}/mark-seen`, {
    method: 'POST',
    body: {},
  });
  window.dispatchEvent(new Event('orders:seen-changed'));
  return data;
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
  const shipOf = (o) => String(o.shipmentStatus || '').toLowerCase();
  const trackOf = (o) => String(o.trackingStatus || '').toLowerCase();

  return {
    total: orders.length,
    new: orders.filter((o) => ['new', 'pending'].includes(statusOf(o))).length,
    confirmed: orders.filter((o) => statusOf(o) === 'confirmed').length,
    delivered: orders.filter(
      (o) =>
        statusOf(o) === 'delivered' ||
        shipOf(o) === 'delivered' ||
        trackOf(o).includes('delivered')
    ).length,
    pendingPayments: orders.filter((o) => payOf(o) === 'pending').length,
    completedPayments: orders.filter((o) => payOf(o) === 'paid').length,
    paidOrders: orders.filter((o) => payOf(o) === 'paid').length,
    shipmentsCreated: orders.filter(
      (o) => o.waybill || !['', 'not created'].includes(shipOf(o))
    ).length,
    inTransit: orders.filter(
      (o) =>
        shipOf(o).includes('transit') ||
        trackOf(o).includes('transit') ||
        trackOf(o).includes('out for delivery') ||
        shipOf(o) === 'in transit'
    ).length,
    ndrExceptions: orders.filter(
      (o) =>
        shipOf(o).includes('ndr') ||
        trackOf(o).includes('ndr') ||
        shipOf(o) === 'failed' ||
        Boolean(o.shipmentError)
    ).length,
  };
}

export async function getDashboardStats({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/api/dashboard/stats${suffix}`);
  return {
    totalOrders: Number(data?.totalOrders || 0),
    newOrders: Number(data?.newOrders || 0),
    paidOrders: Number(data?.paidOrders || 0),
    pendingPayments: Number(data?.pendingPayments || 0),
    shipmentsCreated: Number(data?.shipmentsCreated || 0),
    unseenOrders: Number(data?.unseenOrders || 0),
    devicesSold: Number(data?.devicesSold || 0),
    revenueReceived: Number(data?.revenueReceived || 0),
    todayDevicesSold: Number(data?.todayDevicesSold || 0),
    todayRevenue: Number(data?.todayRevenue || 0),
    monthDevicesSold: Number(data?.monthDevicesSold || 0),
    monthRevenue: Number(data?.monthRevenue || 0),
    analysis: {
      from: data?.analysis?.from || null,
      to: data?.analysis?.to || null,
      devicesSold: Number(data?.analysis?.devicesSold || 0),
      revenueReceived: Number(data?.analysis?.revenueReceived || 0),
      averageRevenuePerDevice: Number(data?.analysis?.averageRevenuePerDevice || 0),
    },
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
