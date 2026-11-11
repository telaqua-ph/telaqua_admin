import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  deleteOrder,
  getOrderById,
  getOrders,
  exportOrders,
  markSelectedCodPaymentsPaid,
  getPaymentStatuses,
} from '../../services/api';
import * as delhivery from '../../services/delhivery';
import { DataTable } from '../../components/Tables';
import { Button } from '../../components/Buttons';
import AddCodOrderButton from '../../components/AddCodOrder/AddCodOrderButton';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import ShipmentStatusEditor from './ShipmentStatusEditor';
import { exportOrdersToXlsx } from '../../utils/exportOrdersXlsx';
import { paymentModeLabel } from '../../utils/paymentModeLabel';
import { deriveOrderConfirmationStatus } from '../../utils/orderConfirmationStatus';
import { fulfillmentListLabel } from '../../utils/fulfillmentTimeline';
import { trackingLinkFor } from '../../utils/trackingLink';
import { DASHBOARD_METRICS, filterOrdersByMetric, isDevicesSoldInDateRange } from '../../utils/dashboardMetrics';
import {
  isOrderCreatedInDateRange,
  isOrderPaymentInDateRange,
  isOrderSoldInDateRange,
} from '../../utils/orderDateRange';
import {
  canCreateShipment,
  isCodOrder,
  isShipmentCreated,
} from '../../utils/shipmentHelpers';
import {
  extractBackendMessage,
  sanitizeTechnicalMessage,
} from '../../utils/shipmentErrorMessages';
import '../../styles/shared.css';
import './Orders.css';

// No response reached the browser (connection dropped or the server took too long).
// The booking may still have succeeded in Shipway; Retry looks it up first and never books twice.
const NO_RESPONSE_SHIPMENT_REASON =
  'No response from the server (connection dropped or request took too long). ' +
  'It may already be booked in Shipway. Press Retry on Wi-Fi: it checks Shipway first and never books twice.';

const PAGE_SIZE = 10;

/** Add COD Order from this page: pending, and not an Offline Sold cash or QR sale. */
function isOrdersPagePendingCod(order) {
  const offline = String(order?.offlineSold || '').trim().toLowerCase();
  if (offline === 'cod pending') return true;
  const channel = String(order?.order_channel || order?.orderChannel || '').trim().toLowerCase();
  const payment = String(order?.paymentStatus || '').trim().toLowerCase();
  return channel === 'admin' && !offline && payment === 'pending';
}

const ORDER_CONFIRMATION_FILTERS = ['New', 'Confirmed', 'Cancelled'];
const SALES_METRICS = new Set([
  'sales_devices',
  'sales_cod_pending_devices',
  'sales_total_devices',
  'sales_period_devices',
  'sales_revenue_received',
  'sales_pending_revenue',
  'shipments_created',
]);

const OPERATIONAL_METRICS = new Set(['new', 'cod_paid', 'rto_return', 'cancelled']);

const SHIPMENT_FILTERS = [
  'All',
  'Unfulfilled',
  'Ready to Ship',
  'Shipment Created',
  'Pickup Requested',
  'Pickup Failed',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'NDR / Exceptions',
  'RTO / Returning',
  'Returned',
  'Failed',
];

function orderKey(orderOrId) {
  if (orderOrId && typeof orderOrId === 'object') {
    return String(orderOrId.id);
  }
  return String(orderOrId);
}

function isPaymentBlocked(order) {
  const pay = String(order?.paymentStatus || '').toLowerCase();
  if (isCodOrder(order)) return false;
  return pay === 'pending' || pay === 'failed';
}

export default function Orders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [paymentModeFilter, setPaymentModeFilter] = useState('All');
  const [shipmentFilter, setShipmentFilter] = useState('All');
  const [metricFilter, setMetricFilter] = useState('');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [codPaymentResult, setCodPaymentResult] = useState(null);

  const selectAllRef = useRef(null);

  const paymentStatuses = getPaymentStatuses();

  // Sales overview tiles link with dateBasis=payment so their lists stay on
  // the payment date; every other date filter uses the order date.
  const paymentDateBasis = searchParams.get('dateBasis') === 'payment';

  // Deep-link from dashboard cards: ?payment=Paid&metric=new&status=New
  useEffect(() => {
    const payment = searchParams.get('payment');
    const paymentMode = String(searchParams.get('paymentMode') || '').trim();
    const status = searchParams.get('status');
    const shipment = searchParams.get('shipment');
    const metric = searchParams.get('metric') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const unseen = String(searchParams.get('unseen') || '').toLowerCase() === 'true';

    if (payment && paymentStatuses.includes(payment)) {
      setPaymentFilter(payment);
    }

    if (paymentMode === 'COD' || paymentMode === 'Razorpay' || paymentMode === 'COD Advance') {
      setPaymentModeFilter(paymentMode);
    } else {
      setPaymentModeFilter('All');
    }

    setStatusFilter(
      status && ORDER_CONFIRMATION_FILTERS.includes(status) ? status : 'All'
    );

    if (shipment && SHIPMENT_FILTERS.includes(shipment)) {
      setShipmentFilter(shipment);
    }

    setMetricFilter(OPERATIONAL_METRICS.has(metric) || SALES_METRICS.has(metric) ? metric : '');
    setUnseenOnly(unseen);
    setDateFrom(/^\d{4}-\d{2}-\d{2}$/.test(from) ? from : '');
    setDateTo(/^\d{4}-\d{2}-\d{2}$/.test(to) ? to : '');
    setPage(1);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrders = async () => {
    const data = await getOrders();
    setOrders(data);
    return data;
  };

  // Delivery details edited elsewhere: reload rows in place (filters and page are kept).
  useEffect(() => {
    const onOrdersChanged = () => {
      getOrders().then(setOrders).catch(() => {});
    };
    window.addEventListener('orders:changed', onOrdersChanged);
    return () => window.removeEventListener('orders:changed', onOrdersChanged);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getOrders();
        if (active) setOrders(data);
      } catch (err) {
        if (active && err.status !== 401) {
          setError(err.message || 'Failed to load orders');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = orders.filter((order) => {
      if (metricFilter) {
        if (!filterOrdersByMetric([order], metricFilter).length) return false;
      } else {
        const matchesStatus =
          statusFilter === 'All' || deriveOrderConfirmationStatus(order) === statusFilter;
        if (!matchesStatus) return false;
      }

      const shownPayment = String(order.paymentStatusLabel || order.paymentStatus || '');
      const matchesPayment =
        paymentFilter === 'All' ||
        shownPayment === paymentFilter ||
        order.paymentStatus === paymentFilter ||
        (paymentFilter === 'Paid' && (shownPayment === 'Offline Paid' || shownPayment === 'COD Paid'));
      const matchesPaymentMode =
        paymentModeFilter === 'All' ||
        (paymentModeFilter === 'COD Advance'
          ? order.paymentMode === 'COD' && order.hasCodAdvance
          : order.paymentMode === paymentModeFilter);
      const matchesSeen = !unseenOnly || !order.isSeen;
      let matchesShipment = true;
      if (shipmentFilter !== 'All') {
        matchesShipment = fulfillmentListLabel(order) === shipmentFilter;
      }

      // Revenue received is listed by order date (cash collected later
      // still belongs to the day the order was placed).
      const matchesDateRange = metricFilter === 'sales_revenue_received' && paymentDateBasis
        ? isOrderPaymentInDateRange(order, dateFrom, dateTo)
        : metricFilter === 'sales_devices' ||
            metricFilter === 'sales_cod_pending_devices' ||
            metricFilter === 'sales_total_devices' ||
            metricFilter === 'sales_period_devices'
          ? isDevicesSoldInDateRange(order, dateFrom, dateTo)
          : metricFilter === 'sales_revenue_received' || metricFilter === 'sales_pending_revenue'
            ? isOrderSoldInDateRange(order, dateFrom, dateTo)
            : isOrderCreatedInDateRange(order, dateFrom, dateTo);

      const matchesSearch =
        !q ||
        String(order.orderNumber || '').toLowerCase().includes(q) ||
        String(order.customerName || '').toLowerCase().includes(q) ||
        String(order.phone || '').toLowerCase().includes(q) ||
        String(order.email || '').toLowerCase().includes(q) ||
        String(order.product || '').toLowerCase().includes(q) ||
        String(order.waybill || '').toLowerCase().includes(q) ||
        String(order.promoCode || '').toLowerCase().includes(q) ||
        String(order.city || '').toLowerCase().includes(q);

      return (
        matchesSeen &&
        matchesPayment &&
        matchesPaymentMode &&
        matchesShipment &&
        matchesDateRange &&
        matchesSearch
      );
    });

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey] ?? a.createdAt ?? '';
      const bv = b[sortKey] ?? b.createdAt ?? '';
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });

    return list;
  }, [
    paymentDateBasis,
    orders,
    search,
    statusFilter,
    paymentFilter,
    paymentModeFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    paymentFilter,
    paymentModeFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
  ]);

  // Clear selection when the active result set changes; keep it across pagination and sorting.
  useEffect(() => {
    setSelectedIds(new Set());
    setBulkResult(null);
  }, [
    search,
    statusFilter,
    paymentFilter,
    paymentModeFilter,
    shipmentFilter,
    metricFilter,
    unseenOnly,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  const currentPageIds = useMemo(
    () => pageData.map((o) => orderKey(o)),
    [pageData]
  );

  const selectedOnCurrentPage = useMemo(
    () => currentPageIds.filter((id) => selectedIds.has(id)),
    [currentPageIds, selectedIds]
  );

  const allCurrentPageSelected =
    currentPageIds.length > 0 && selectedOnCurrentPage.length === currentPageIds.length;
  const someCurrentPageSelected =
    selectedOnCurrentPage.length > 0 && !allCurrentPageSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentPageSelected;
    }
  }, [someCurrentPageSelected]);

  const selectedOrders = useMemo(() => {
    return filtered.filter((order) => selectedIds.has(orderKey(order)));
  }, [filtered, selectedIds]);

  const eligibleSelectedCodOrders = useMemo(
    () =>
      selectedOrders.filter(
        (order) =>
          isCodOrder(order) &&
          String(order.paymentStatus || '').trim().toLowerCase() === 'pending' &&
          String(order.status || order.order_status || '').trim().toLowerCase() !==
            'cancelled'
      ),
    [selectedOrders]
  );

  const eligibleSelectedCodTotal = useMemo(
    () =>
      eligibleSelectedCodOrders.reduce(
        (total, order) => total + (Number(order.total) || 0),
        0
      ),
    [eligibleSelectedCodOrders]
  );

  const toggleOne = (id) => {
    const key = orderKey(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setBulkResult(null);
  };

  const toggleSelectAllCurrentPage = () => {
    setBulkResult(null);
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentPageIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkResult(null);
    setCodPaymentResult(null);
  };

  const handleCodOrderCreated = async (created) => {
    const list = await loadOrders();
    if (created?.id) {
      const found = (list || []).find((o) => String(o.id) === String(created.id));
      setMessage(
        `COD order ${found?.orderNumber || created.orderNumber || created.id} created.`
      );
    } else {
      setMessage('COD order created.');
    }
    setError('');
  };

  const handleDelete = async (order) => {
    const label = order.orderNumber || order.id;
    if (!window.confirm(`Delete order "${label}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrder(order.id);
      await loadOrders();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(orderKey(order));
        return next;
      });
      setMessage(`Order ${label} deleted.`);
      setError('');
    } catch (err) {
      if (err.status !== 401) setError(err.message || 'Failed to delete order');
    }
  };

  const createShipmentForOrder = async (order) => {
    await delhivery.createShipment({
      order_id: Number(order.id) || order.id,
    });
    try {
      return await getOrderById(order.id);
    } catch {
      return null;
    }
  };

  const runBulkCreate = async (eligibleOrders) => {
    if (!eligibleOrders.length || bulkBusy) return;

    setBulkBusy(true);
    setError('');
    setMessage('');
    setBulkResult(null);

    const successes = [];
    const failures = [];

    for (let i = 0; i < eligibleOrders.length; i += 1) {
      const order = eligibleOrders[i];
      setBulkProgress({
        current: i + 1,
        total: eligibleOrders.length,
        orderNumber: order.orderNumber || order.id,
      });

      try {
        const refreshed = await createShipmentForOrder(order);
        if (refreshed) {
          setOrders((prev) =>
            prev.map((o) => (orderKey(o) === orderKey(order) ? refreshed : o))
          );
        }
        successes.push({
          id: order.id,
          orderNumber: order.orderNumber || String(order.id),
        });
      } catch (err) {
        if (err.status === 401) {
          setBulkBusy(false);
          setBulkProgress(null);
          return;
        }
        const reason = err.status === 0
          ? NO_RESPONSE_SHIPMENT_REASON
          : sanitizeTechnicalMessage(
              extractBackendMessage(err) || err.message || 'Shipment creation failed'
            );
        failures.push({
          id: order.id,
          orderNumber: order.orderNumber || String(order.id),
          reason,
        });
        // Refresh this row in case of partial save
        try {
          const refreshed = await getOrderById(order.id);
          if (refreshed) {
            setOrders((prev) =>
              prev.map((o) =>
                orderKey(o) === orderKey(order) ? refreshed : o
              )
            );
          }
        } catch {
          /* ignore */
        }
      }
    }

    setBulkProgress(null);
    setBulkBusy(false);
    setSelectedIds(new Set());

    try {
      await loadOrders();
    } catch {
      /* keep local updates */
    }

    setBulkResult({
      successCount: successes.length,
      failures,
    });

    if (successes.length && !failures.length) {
      setMessage(
        `${successes.length} shipment${successes.length === 1 ? '' : 's'} created successfully`
      );
    }
  };

  const handleBulkCreateClick = () => {
    if (bulkBusy || selectedOrders.length === 0) return;

    const eligible = [];
    const paymentBlocked = [];
    const alreadyCreated = [];

    selectedOrders.forEach((order) => {
      if (canCreateShipment(order)) {
        eligible.push(order);
      } else if (isShipmentCreated(order)) {
        alreadyCreated.push(order);
      } else if (isPaymentBlocked(order)) {
        paymentBlocked.push(order);
      } else {
        paymentBlocked.push(order);
      }
    });

    if (eligible.length === 0) {
      const parts = [];
      if (paymentBlocked.length) {
        parts.push(
          `${paymentBlocked.length} not eligible (payment pending / not paid)`
        );
      }
      if (alreadyCreated.length) {
        parts.push(
          `${alreadyCreated.length} already have a shipment`
        );
      }
      setError(
        `None of the ${selectedOrders.length} selected order${
          selectedOrders.length === 1 ? '' : 's'
        } can create a shipment. ${parts.join('; ')}.`
      );
      setMessage('');
      return;
    }

    const ineligibleCount = selectedOrders.length - eligible.length;
    if (ineligibleCount > 0) {
      const reasons = [];
      if (paymentBlocked.length) {
        reasons.push(
          `${paymentBlocked.length} of ${selectedOrders.length} selected orders are not eligible (payment pending) and will be skipped`
        );
      }
      if (alreadyCreated.length) {
        reasons.push(
          `${alreadyCreated.length} already have a shipment and will be skipped`
        );
      }
      const ok = window.confirm(
        `${reasons.join('. ')}. Continue with the remaining ${eligible.length}?`
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        `Create shipments for ${eligible.length} selected order${
          eligible.length === 1 ? '' : 's'
        }?`
      );
      if (!ok) return;
    }

    runBulkCreate(eligible);
  };

  const handleBulkCodPaymentClick = async () => {
    if (bulkBusy || eligibleSelectedCodOrders.length === 0) return;

    const orderIds = eligibleSelectedCodOrders.map((order) => order.id);
    const total = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(eligibleSelectedCodTotal);
    const confirmed = window.confirm(
      `Confirm payment has been collected for ${orderIds.length} selected COD order${
        orderIds.length === 1 ? '' : 's'
      } totaling ${total}? This marks only their payment status as Paid; order and shipment statuses will not change.`
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setError('');
    setMessage('');
    setBulkResult(null);
    setCodPaymentResult(null);

    try {
      const result = await markSelectedCodPaymentsPaid(orderIds);
      const succeeded = Array.isArray(result?.succeeded) ? result.succeeded : [];
      const failed = Array.isArray(result?.failed) ? result.failed : [];
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];

      setCodPaymentResult({ succeeded: succeeded.length, failed, skipped });
      setSelectedIds(new Set());
      await loadOrders();
      window.dispatchEvent(new Event('orders:payment-changed'));

      if (succeeded.length) {
        setMessage(
          `${succeeded.length} COD payment${succeeded.length === 1 ? '' : 's'} marked as Paid.`
        );
      }
      if (!succeeded.length && (failed.length || skipped.length)) {
        setError('No selected COD payments could be marked as Paid.');
      }
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Failed to mark selected COD payments as Paid');
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRetryFailed = async (failure) => {
    const order = orders.find((o) => orderKey(o) === orderKey(failure.id));
    if (!order) {
      setError(`Order ${failure.orderNumber} is no longer in the list.`);
      return;
    }
    if (!canCreateShipment(order)) {
      setError(
        `Order ${failure.orderNumber} is not eligible to create a shipment right now.`
      );
      return;
    }

    setBulkBusy(true);
    setBulkProgress({
      current: 1,
      total: 1,
      orderNumber: order.orderNumber || order.id,
    });
    setError('');

    try {
      const refreshed = await createShipmentForOrder(order);
      if (refreshed) {
        setOrders((prev) =>
          prev.map((o) => (orderKey(o) === orderKey(order) ? refreshed : o))
        );
      }
      setBulkResult((prev) => {
        if (!prev) return prev;
        const failures = prev.failures.filter(
          (f) => orderKey(f.id) !== orderKey(failure.id)
        );
        return {
          successCount: prev.successCount + 1,
          failures,
        };
      });
      setMessage(`Shipment created for ${order.orderNumber || order.id}.`);
      await loadOrders();
    } catch (err) {
      if (err.status !== 401) {
        const reason = err.status === 0
          ? NO_RESPONSE_SHIPMENT_REASON
          : sanitizeTechnicalMessage(
              extractBackendMessage(err) || err.message || 'Shipment creation failed'
            );
        setBulkResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            failures: prev.failures.map((f) =>
              orderKey(f.id) === orderKey(failure.id) ? { ...f, reason } : f
            ),
          };
        });
        setError(`${failure.orderNumber}: ${reason}`);
      }
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const handleExport = async ({ allTime = false } = {}) => {
    if (bulkBusy) return;
    const selectedOrderIds = [...selectedIds];
    const exportingSelection = selectedOrderIds.length > 0;
    const exportAllTime = allTime && !exportingSelection;
    const activeFilters = exportAllTime
      ? {
          allTime: true,
          selectedOrderIds: [],
          search: '', statusFilter: 'All', paymentFilter: 'All', paymentModeFilter: 'All',
          shipmentFilter: 'All', metricFilter: '', unseenOnly: false, startDate: '', endDate: '',
        }
      : {
          selectedOrderIds,
          search, statusFilter, paymentFilter, paymentModeFilter, shipmentFilter,
          metricFilter, unseenOnly, startDate: dateFrom, endDate: dateTo,
        };
    const expectedCount = exportingSelection ? selectedOrderIds.length : filtered.length;
    if (!expectedCount) {
      setError('No orders match the current export filters.');
      setMessage('');
      return;
    }
    setBulkBusy(true);
    setError('');
    setMessage(`Downloading ${expectedCount} ${exportingSelection ? 'selected ' : ''}order${expectedCount === 1 ? '' : 's'}…`);
    try {
      const result = await exportOrders(activeFilters);
      if (!result.orders.length) throw new Error('No orders match the current export selection and filters.');
      if (exportingSelection && result.count !== selectedOrderIds.length) {
        throw new Error(`Only ${result.count} of ${selectedOrderIds.length} selected orders match the current filters.`);
      }
      const exportDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date()).replace(/\//g, '-');
      exportOrdersToXlsx(
        result.orders,
        `${exportAllTime ? 'telaqua-orders-all-time' : 'telaqua-orders-filtered'}-${exportDate}.xlsx`
      );
      setMessage(`Downloaded ${result.count} ${exportingSelection ? 'selected ' : ''}order${result.count === 1 ? '' : 's'}.`);
    } catch (err) {
      if (err.status !== 401) {
        setError(err.message || 'Unable to download orders for the current filters.');
        setMessage('');
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const columns = [
    {
      key: 'select',
      width: '48px',
      ariaLabel: 'Select',
      label: (
        <input
          ref={selectAllRef}
          type="checkbox"
          className="orders__checkbox"
          checked={allCurrentPageSelected}
          onChange={toggleSelectAllCurrentPage}
          disabled={currentPageIds.length === 0 || bulkBusy}
          aria-label="Select all orders on this page"
          title="Select all orders on this page"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          className="orders__checkbox"
          checked={selectedIds.has(orderKey(row))}
          onChange={() => toggleOne(row.id)}
          disabled={bulkBusy}
          aria-label={`Select order ${row.orderNumber || row.id}`}
        />
      ),
    },
    {
      key: 'orderNumber',
      label: 'Order',
      render: (row) => (
        <div className="orders__order-cell">
          {!row.isSeen && <span className="orders__unread-dot" aria-hidden="true" />}
          <strong>{row.orderNumber || row.id}</strong>
          {!row.isSeen && <span className="orders__new-badge">NEW</span>}
        </div>
      ),
    },
    {
      key: 'customerName',
      label: 'Customer',
      render: (row) => (
        <div className="orders__customer">
          <strong>{row.customerName || '—'}</strong>
          <span>{row.email || '—'}</span>
          <span>{row.phone || '—'}</span>
          <span className="orders__address">
            {row.fullAddress || row.address || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row) => `₹${row.total}`,
    },
    {
      key: 'orderConfirmationStatus',
      label: 'Order Status',
      render: (row) => (
        <StatusBadge
          status={deriveOrderConfirmationStatus(row)}
        />
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (row) => {
        const pendingCod = isOrdersPagePendingCod(row);
        const paymentLabel = pendingCod
          ? 'Pending COD'
          : row.isCodPartialPaid && String(row.paymentStatus || '').toLowerCase() === 'pending'
            ? 'COD Partially Paid'
            : row.codAdvanceStatus === 'paid' && String(row.paymentStatus || '').toLowerCase() === 'pending'
              ? 'Partially Paid'
              : row.paymentStatusLabel || row.paymentStatus || '—';
        return (
        <div className="orders__customer">
          <StatusBadge status={paymentLabel} />
          {!pendingCod && row.paymentMethod && row.paymentMethod !== (row.paymentStatusLabel || row.paymentStatus) ? (
            <span>{row.paymentMethod}</span>
          ) : null}
          {row.paymentId ? (
            <span className="orders__payment-id" title={row.paymentId}>
              ID: {row.paymentId}
            </span>
          ) : (
            <span>ID: —</span>
          )}
        </div>
        );
      },
    },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      render: (row) =>
        row.isCodPartialPaid ? (
          <div className="orders__customer">
            <span>COD Partially Paid</span>
            <span>Paid online: ₹{row.codAdvanceFee}</span>
            {row.codAdvancePaymentId ? (
              <span className="orders__payment-id" title={row.codAdvancePaymentId}>
                Ref: {row.codAdvancePaymentId}
              </span>
            ) : null}
            <span>
              {String(row.paymentStatus || '').toLowerCase() === 'paid'
                ? `Balance ₹${row.codAmountDue} collected`
                : `Remaining due: ₹${row.codAmountDue}`}
            </span>
          </div>
        ) : row.hasCodAdvance ? (
          <div className="orders__customer">
            <span>{row.codAdvanceStatus === 'paid' ? 'Partial COD' : paymentModeLabel(row.paymentMode)}</span>
            <span>
              Advance ₹{row.codAdvanceFee ?? 99}:{' '}
              {row.codAdvanceStatus === 'paid' ? 'Paid' : row.codAdvanceStatus || '—'}
            </span>
            {row.codAdvancePaymentId ? (
              <span className="orders__payment-id" title={row.codAdvancePaymentId}>
                Ref: {row.codAdvancePaymentId}
              </span>
            ) : null}
            <span>COD due: ₹{row.codAmountDue ?? row.total}</span>
          </div>
        ) : (
          paymentModeLabel(row.paymentMode)
        ),
    },
    {
      key: 'promoCode',
      label: 'Promo',
      render: (row) =>
        row.promoCode ? (
          <strong className="orders__promo-code">{row.promoCode}</strong>
        ) : (
          '—'
        ),
    },
    {
      key: 'shipmentStatus',
      label: 'Shipment',
      render: (row) => (
        <ShipmentStatusEditor
          order={row}
          statusLabel={row.shipmentStatusDisplay || fulfillmentListLabel(row)}
          disabled={bulkBusy}
          onSaved={(updated, label) => {
            if (updated?.id) {
              setOrders((prev) =>
                prev.map((o) => (String(o.id) === String(updated.id) ? { ...o, ...updated } : o))
              );
            }
            setMessage(`Shipment status for ${row.orderNumber || row.id} updated to ${label}.`);
            setError('');
          }}
          onError={(msg) => {
            setError(msg);
            setMessage('');
          }}
        />
      ),
    },
    {
      key: 'waybill',
      label: 'AWB',
      render: (row) =>
        row.waybill ? (
          <a
            href={trackingLinkFor(row.waybill, row.shippingProvider)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the customer tracking page"
          >
            {row.waybill}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'date',
      label: 'Ordered at',
      render: (row) => (
        <div className="orders__customer">
          <strong>{row.orderedDate || '—'}</strong>
          <span>{row.orderedTime || '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row) => (
        <div className="orders__actions">
          <Link to={`/orders/${row.id}`}>
            <Button size="sm" variant="outline-primary" disabled={bulkBusy}>
              View
            </Button>
          </Link>
          <Button
            size="sm"
            variant="danger"
            disabled={bulkBusy}
            onClick={() => handleDelete(row)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="loading-state">Loading orders…</div>;
  }

  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const selectedCount = selectedOrders.length;

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Orders</h2>
          <p>Search, filter, fulfill, and export customer orders</p>
        </div>
        <div className="orders__header-actions">
          <Button
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => handleExport()}
          >
            {selectedIds.size ? `Export ${selectedIds.size} Selected` : 'Export Filtered'}
          </Button>
          <Button
            disabled={bulkBusy}
            onClick={() => handleExport({ allTime: true })}
          >
            Export All Time
          </Button>
          <AddCodOrderButton disabled={bulkBusy} showOfflineSold={false} onCreated={handleCodOrderCreated} />
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {message && <div className="alert alert--success">{message}</div>}

      {(metricFilter || paymentFilter !== 'All' || unseenOnly || dateFrom || dateTo) && (
        <div className="alert alert--info">
          Showing:{' '}
          <strong>
            {metricFilter
              ? metricFilter === 'new'
                ? 'New orders (New + Pending status)'
                : DASHBOARD_METRICS[metricFilter]?.title || 'Dashboard metric'
              : unseenOnly
                ? 'Unseen orders only'
                : `${paymentFilter} payments`}
          </strong>
          {(dateFrom || dateTo) && (
            <>
              <span>{` · ${
                metricFilter === 'sales_revenue_received' && paymentDateBasis
                  ? 'Payment date'
                  : metricFilter === 'sales_devices' ||
                      metricFilter === 'sales_cod_pending_devices' ||
                      metricFilter === 'sales_total_devices' ||
                      metricFilter === 'sales_period_devices'
                    ? 'COD order date, Razorpay payment date'
                    : 'Ordered At'
              }: ${dateFrom || 'start'} to ${dateTo || 'end'}`}</span>
              <button
                type="button"
                className="orders__clear-selection"
                style={{ marginLeft: 12 }}
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear date range
              </button>
            </>
          )}
          {metricFilter === 'new' || unseenOnly || SALES_METRICS.has(metricFilter) ? (
            <button
              type="button"
              className="orders__clear-selection"
              style={{ marginLeft: 12 }}
              onClick={() => {
                setMetricFilter('');
                setUnseenOnly(false);
                if (SALES_METRICS.has(metricFilter)) {
                  setDateFrom('');
                  setDateTo('');
                }
              }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      )}

      {bulkProgress && (
        <div className="alert alert--info orders__bulk-progress" role="status">
          Creating shipment {bulkProgress.current} of {bulkProgress.total}
          {bulkProgress.orderNumber
            ? ` (${bulkProgress.orderNumber})…`
            : '…'}
        </div>
      )}

      {bulkResult && (
        <div className="orders__bulk-result panel">
          <div className="panel__body">
            {bulkResult.successCount > 0 && (
              <p className="orders__bulk-result-success">
                {bulkResult.successCount} shipment
                {bulkResult.successCount === 1 ? '' : 's'} created successfully
              </p>
            )}
            {bulkResult.failures.length > 0 && (
              <div className="orders__bulk-failures">
                <p>
                  {bulkResult.failures.length} failed:
                </p>
                <ul>
                  {bulkResult.failures.map((f) => (
                    <li key={orderKey(f.id)}>
                      <div>
                        <strong>{f.orderNumber}</strong>
                        <span> (reason: {f.reason})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={bulkBusy}
                        onClick={() => handleRetryFailed(f)}
                      >
                        Retry
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="orders__bulk-dismiss"
              onClick={() => setBulkResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {codPaymentResult && (
        <div className="orders__bulk-result panel" role="status">
          <div className="panel__body">
            {codPaymentResult.succeeded > 0 && (
              <p className="orders__bulk-result-success">
                {codPaymentResult.succeeded} COD payment
                {codPaymentResult.succeeded === 1 ? '' : 's'} marked as Paid.
              </p>
            )}
            {codPaymentResult.failed.length > 0 && (
              <p>{codPaymentResult.failed.length} order{codPaymentResult.failed.length === 1 ? '' : 's'} failed eligibility checks.</p>
            )}
            {codPaymentResult.skipped.length > 0 && (
              <p>{codPaymentResult.skipped.length} order{codPaymentResult.skipped.length === 1 ? '' : 's'} skipped because the payment had already changed.</p>
            )}
            <button
              type="button"
              className="orders__bulk-dismiss"
              onClick={() => setCodPaymentResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        <div className="panel__header orders__toolbar-wrap">
          <div className="toolbar orders__toolbar">
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
                placeholder="Search order, customer, AWB…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={bulkBusy}
              />
            </div>

            <select
              className="toolbar__select"
              value={metricFilter === 'new' ? 'New' : statusFilter}
              onChange={(e) => {
                setMetricFilter('');
                setStatusFilter(e.target.value);
              }}
              disabled={bulkBusy}
            >
              <option value="All">All order statuses</option>
              {ORDER_CONFIRMATION_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="toolbar__select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              disabled={bulkBusy}
            >
              <option value="All">All payments</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="toolbar__select"
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              disabled={bulkBusy}
            >
              <option value="All">All payment modes</option>
              <option value="COD">COD</option>
              <option value="COD Advance">COD Partially Paid (₹199)</option>
              <option value="Razorpay">Online</option>
            </select>

            <select
              className="toolbar__select"
              value={shipmentFilter}
              onChange={(e) => setShipmentFilter(e.target.value)}
              disabled={bulkBusy}
            >
              {SHIPMENT_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All shipments' : status}
                </option>
              ))}
            </select>

            <input
              className="toolbar__select"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              disabled={bulkBusy}
            />
            <input
              className="toolbar__select"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              disabled={bulkBusy}
            />

            <select
              className="toolbar__select"
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setSortKey(key);
                setSortDir(dir);
              }}
              disabled={bulkBusy}
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="total:desc">Amount high → low</option>
              <option value="total:asc">Amount low → high</option>
              <option value="orderNumber:asc">Order A → Z</option>
            </select>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="orders__bulk-bar" role="region" aria-label="Bulk actions">
            <p className="orders__bulk-count">
              {selectedCount} order{selectedCount === 1 ? '' : 's'} selected
            </p>
            <div className="orders__bulk-actions">
              {eligibleSelectedCodOrders.length > 0 && (
                <Button
                  disabled={bulkBusy}
                  onClick={handleBulkCodPaymentClick}
                >
                  {bulkBusy ? 'Updating…' : 'Mark Selected COD as Paid'}
                </Button>
              )}
              <Button
                disabled={bulkBusy}
                onClick={handleBulkCreateClick}
              >
                {bulkBusy ? 'Creating…' : 'Create Shipments'}
              </Button>
              <button
                type="button"
                className="orders__clear-selection"
                onClick={clearSelection}
                disabled={bulkBusy}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        <div className="orders__table-pagination" aria-label="Orders pagination">
          <Button
            size="sm"
            variant="secondary"
            disabled={currentPage <= 1 || bulkBusy}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="orders__page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={currentPage >= totalPages || bulkBusy}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={pageData}
          emptyMessage={
            error ? 'Unable to load orders.' : 'No orders match your filters.'
          }
        />

        <div className="pagination">
          <p className="pagination__info">
            Showing {from}–{to} of {filtered.length}
          </p>
          <div className="pagination__controls">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1 || bulkBusy}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="orders__page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages || bulkBusy}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
