import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearFarmerIntelSession,
  getFarmerIntelBasemap,
  getFarmerIntelPincodeOrders,
  getFarmerIntelSession,
  getFarmerIntelSummary,
  isFarmerIntelLocked,
  loginFarmerIntel,
} from '../../services/api';
import { Button } from '../../components/Buttons';
import './FarmerIntelMap.css';

const initialFilters = { from: '', to: '', status: 'all', district: '' };
const asNumber = (value) => Number(value || 0);
const percent = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;

function dotStatusClass(location) {
  const delivered = asNumber(location.delivered_orders);
  const returned = asNumber(location.returned_orders);
  const pending = asNumber(location.pending_orders);
  if (returned > delivered && returned >= pending) return 'farmer-map__dot--returned';
  if (pending > delivered && pending > returned) return 'farmer-map__dot--pending';
  return 'farmer-map__dot--delivered';
}

function projectLocation(location, basemap) {
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { longitudeOrigin, latitudeOrigin, longitudeScale, latitudeScale } = basemap.projection;
  const [minX, minY, width, height] = basemap.viewBox;
  const x = (lng - longitudeOrigin) * longitudeScale;
  const y = (latitudeOrigin - lat) * latitudeScale;
  if (x < minX || y < minY || x > minX + width || y > minY + height) return null;
  return { x, y };
}

/** Second lock: separate Farmer Intel email + password before the map loads. */
function FarmerIntelLogin({ onUnlocked, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await loginFarmerIntel(email.trim(), password);
      setPassword('');
      onUnlocked(session);
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="farmer-map page">
    <div className="farmer-map__lock">
      <p className="farmer-map__eyebrow">RESTRICTED</p>
      <h2>Farmer Intel Map</h2>
      <p>This map has its own login. Enter your Farmer Intel email and password to continue.</p>
      {notice && <div className="alert alert--error">{notice}</div>}
      {error && <div className="alert alert--error">{error}</div>}
      <form onSubmit={submit} className="farmer-map__lock-form">
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Unlock map'}</Button>
      </form>
    </div>
  </div>;
}

export default function FarmerIntelMap() {
  const [session, setSession] = useState(() => getFarmerIntelSession());
  const [lockNotice, setLockNotice] = useState('');

  const lock = useCallback((message = '') => {
    clearFarmerIntelSession();
    setLockNotice(message);
    setSession(null);
  }, []);

  if (!session) {
    return <FarmerIntelLogin notice={lockNotice} onUnlocked={(next) => { setLockNotice(''); setSession(next); }} />;
  }
  return <FarmerIntelMapContent session={session} onLock={lock} />;
}

function FarmerIntelMapContent({ session, onLock }) {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [basemap, setBasemap] = useState(null);
  const [basemapError, setBasemapError] = useState('');
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
      if (isFarmerIntelLocked(requestError)) { onLock(requestError.message); return; }
      setError(requestError.message || 'Unable to load Farmer Intel Map.');
    } finally { if (!quiet) setLoading(false); }
  }, [filters, onLock]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let active = true;
    getFarmerIntelBasemap().then((response) => {
      if (active) setBasemap(response.basemap);
    }).catch((requestError) => {
      if (!active) return;
      if (isFarmerIntelLocked(requestError)) { onLock(requestError.message); return; }
      setBasemapError(requestError.message || 'Unable to load India basemap.');
    });
    return () => { active = false; };
  }, [onLock]);
  useEffect(() => {
    // Lock again automatically when the Farmer Intel session expires.
    const remaining = Number(session?.expiresAt || 0) - Date.now();
    const timer = window.setTimeout(() => onLock('Your Farmer Intel session has expired. Please sign in again.'), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [session, onLock]);
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
    } catch (requestError) {
      if (isFarmerIntelLocked(requestError)) { onLock(requestError.message); return; }
      setOrders({ error: requestError.message || 'Unable to load orders.' });
    }
  }, [filters, onLock]);

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
      <div className="farmer-map__refresh"><span>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN') : '—'}{stale ? ' (stale)' : ''}</span><Button size="sm" onClick={() => load()}>Refresh</Button><Button size="sm" variant="secondary" onClick={() => onLock('')} title={session?.user?.email ? `Signed in as ${session.user.email}` : undefined}>Lock map</Button></div>
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
        <div className="farmer-map__surface-label">India · state boundaries · pincode centroids only</div>
        {basemap ? <svg className="farmer-map__basemap" viewBox={basemap.viewBox.join(' ')} role="img" aria-label="India map with state boundaries and order pincodes">
          <path className="farmer-map__india" d={basemap.indiaPath} />
          {basemap.statePaths.map((state) => <path key={state.name} className="farmer-map__state" d={state.path} />)}
          {locations.map((location) => {
            const point = projectLocation(location, basemap);
            if (!point) return null;
            const label = `${location.pincode}, ${location.district || 'Unknown district'}, ${location.state || 'Unknown state'}; ${location.total_orders} orders, ${location.delivered_orders} delivered, ${location.returned_orders} returned, ${location.pending_orders} pending`;
            return <g key={location.pincode} className={`farmer-map__dot ${dotStatusClass(location)}`} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-label={label} onClick={() => selectLocation(location)} onFocus={() => setSelected(location)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectLocation(location);
              }
            }}>
              <title>{label}</title>
              <circle r={Math.min(18, Math.max(8, 6 + Math.sqrt(asNumber(location.total_orders)) * 1.5))} />
            </g>;
          })}
        </svg> : <div className="farmer-map__empty" role="status">{basemapError || 'Loading authenticated India basemap…'}</div>}
        {basemap && locations.length === 0 && <div className="farmer-map__empty">No mapped pincode coordinates are available. Import approved private pincode coordinates to show dots.</div>}
        <div className="farmer-map__pond">Pond-area layer: {data?.pond_area_layer?.available ? 'available' : 'unavailable — no approved source configured'}</div>
        {basemap && <div className="farmer-map__attribution">{basemap.source}</div>}
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
