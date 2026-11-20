import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFarmerIntelPincodeOrders, getFarmerIntelSummary } from '../../services/api';
import { Button } from '../../components/Buttons';
import './FarmerIntelMap.css';

const initialFilters = { from: '', to: '', status: 'all', district: '' };
const asNumber = (value) => Number(value || 0);
const percent = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;

function locationPosition(location, locations) {
  const latitudes = locations.map((item) => Number(item.latitude));
  const longitudes = locations.map((item) => Number(item.longitude));
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes); const maxLng = Math.max(...longitudes);
  return {
    left: `${12 + ((lng - minLng) / Math.max(maxLng - minLng, 1)) * 76}%`,
    top: `${86 - ((lat - minLat) / Math.max(maxLat - minLat, 1)) * 74}%`,
  };
}

export default function FarmerIntelMap() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await getFarmerIntelSummary(filters);
      setData(response);
      setLastUpdated(new Date(response.updated_at));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load Farmer Intel Map.');
    } finally { if (!quiet) setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refreshSeconds = Math.max(15, Number(data?.refresh_after_seconds || 60));
    const timer = window.setInterval(() => load({ quiet: true }), refreshSeconds * 1000);
    const reconnect = () => load({ quiet: true });
    window.addEventListener('online', reconnect);
    return () => { window.clearInterval(timer); window.removeEventListener('online', reconnect); };
  }, [data?.refresh_after_seconds, load]);

  const selectLocation = useCallback(async (location) => {
    setSelected(location); setOrders(null);
    try {
      const response = await getFarmerIntelPincodeOrders(location.pincode, { ...filters, page: 1, limit: 25 });
      setOrders(response);
    } catch (requestError) { setOrders({ error: requestError.message || 'Unable to load orders.' }); }
  }, [filters]);

  const locations = data?.locations || [];
  const totals = data?.totals || {};
  const stale = lastUpdated && Date.now() - lastUpdated.getTime() > Math.max(120000, Number(data?.refresh_after_seconds || 60) * 2500);
  const summaryCards = useMemo(() => [
    ['Orders', totals.total_orders], ['Units', totals.total_units], ['Delivered', totals.delivered_orders],
    ['Returned / RTO', totals.returned_orders], ['Pending', totals.pending_orders], ['Return rate', percent(totals.return_rate)],
  ], [totals]);

  return <div className="farmer-map page">
    <div className="farmer-map__header">
      <div><p className="farmer-map__eyebrow">LIVE OPERATIONS</p><h2>Farmer Intel Map</h2><p>Pincode-centroid view for Tel-Aqua pH Meter orders. Dots never represent an exact farmer or pond location.</p></div>
      <div className="farmer-map__refresh"><span>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN') : '—'}{stale ? ' (stale)' : ''}</span><Button size="sm" onClick={() => load()}>Refresh</Button></div>
    </div>
    <div className="farmer-map__filters" aria-label="Map filters">
      <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((old) => ({ ...old, from: event.target.value }))} /></label>
      <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((old) => ({ ...old, to: event.target.value }))} /></label>
      <label>Status<select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option value="all">All</option><option value="delivered">Delivered</option><option value="returned">Returned / RTO</option><option value="pending">Pending</option></select></label>
      <label>District<select value={filters.district} onChange={(event) => setFilters((old) => ({ ...old, district: event.target.value }))}><option value="">All districts</option>{(data?.districts || []).map((district) => <option key={`${district.state}-${district.district}`} value={district.district}>{district.district}, {district.state}</option>)}</select></label>
      <Button size="sm" variant="secondary" onClick={() => setFilters(initialFilters)}>Clear</Button>
    </div>
    {error && <div className="alert alert--error">{error}</div>}
    <div className="farmer-map__cards">{summaryCards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value ?? 0}</strong></article>)}</div>
    {loading && !data ? <div className="loading-state">Loading map data…</div> : <div className="farmer-map__grid">
      <section className="farmer-map__surface" aria-label="Pincode map">
        <div className="farmer-map__surface-label">Pincode map · coordinates are private admin data</div>
        {locations.length ? locations.map((location) => {
          const position = locationPosition(location, locations);
          return <button key={location.pincode} type="button" className="farmer-map__dot" style={position} onClick={() => selectLocation(location)} onFocus={() => setSelected(location)} aria-label={`${location.pincode}, ${location.district || 'Unknown district'}, ${location.total_orders} orders`}>
            <span>{asNumber(location.total_orders)}</span>
            <i role="tooltip"><b>{location.pincode}</b><br />{location.district || 'Unknown district'}, {location.state || 'Unknown state'}<br />Orders {location.total_orders} · Delivered {location.delivered_orders} · Returned {location.returned_orders} · Pending {location.pending_orders}<br />Return rate {percent(location.return_rate)}</i>
          </button>;
        }) : <div className="farmer-map__empty">No mapped pincode coordinates are available. Import approved private pincode coordinates to show dots.</div>}
        <div className="farmer-map__pond">Pond-area layer: {data?.pond_area_layer?.available ? 'available' : 'unavailable — no approved source configured'}</div>
      </section>
      <aside className="farmer-map__panel">
        <h3>{selected ? `${selected.pincode} orders` : 'Select a pincode'}</h3>
        {selected && <p>{selected.district || 'Unknown district'}, {selected.state || 'Unknown state'} · {selected.total_orders} orders · return rate {percent(selected.return_rate)}</p>}
        {!selected && <p>Click or focus a pincode dot to load its paginated order list.</p>}
        {orders?.error && <div className="alert alert--error">{orders.error}</div>}
        {orders?.orders?.map((order) => <article className="farmer-map__order" key={`${order.id}-${order.shipment_id || 'order'}`}>
          <strong>{order.order_number || `Order ${order.id}`}</strong><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span>
          <p>{order.quantity} × Tel-Aqua pH Meter · {order.payment_method} · {order.order_status}</p>
          <p>{order.shipment_fulfillment_status || order.fulfillment_status} · {order.provider || order.courier_name || 'Courier not assigned'}{order.waybill_number ? ` · ${order.waybill_number}` : ''}</p>
          {orders.can_view_customer_data && <p>{order.customer_name} · {order.phone}</p>}
          <Link to={`/orders/${order.id}`}>Open order</Link>
        </article>)}
      </aside>
    </div>}
    <section className="farmer-map__unmapped"><h3>Unmapped orders ({data?.unmapped?.count ?? 0})</h3><p>These orders remain in totals but are not plotted because their pincode is blank, invalid, or has no approved coordinate. No coordinates are inferred.</p></section>
  </div>;
}
