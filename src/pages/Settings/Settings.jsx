import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, getProfile, updateProfile } from '../../services/api';
import { createWarehouse, getWaybill } from '../../services/delhivery';
import { Button } from '../../components/Buttons';
import '../../styles/shared.css';
import './Settings.css';

const emptyWarehouse = {
  name: '',
  registered_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pin: '',
  return_address: '',
  return_pin: '',
  return_city: '',
  return_state: '',
  return_country: 'India',
};

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });
  const [warehouse, setWarehouse] = useState(emptyWarehouse);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [warehouseMsg, setWarehouseMsg] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [waybillCount, setWaybillCount] = useState(1);
  const [waybillLoading, setWaybillLoading] = useState(false);
  const [waybillMsg, setWaybillMsg] = useState('');
  const [waybillError, setWaybillError] = useState('');
  const [waybillResult, setWaybillResult] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const admin = await getProfile();
        if (!active) return;
        setProfile({
          full_name: admin?.full_name || '',
          username: admin?.username || '',
          email: admin?.email || '',
        });
        updateUser(admin);
      } catch (error) {
        if (!active) return;
        if (error.status !== 401) {
          setLoadError(error.message || 'Failed to load profile');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [updateUser]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    setSavingProfile(true);
    try {
      const result = await updateProfile({
        full_name: profile.full_name.trim(),
        email: profile.email.trim(),
      });
      if (result.success) {
        updateUser(result.user);
        setProfile((p) => ({
          ...p,
          full_name: result.user.full_name || p.full_name,
          email: result.user.email || p.email,
          username: result.user.username || p.username,
        }));
        setProfileMsg('Profile updated successfully.');
      }
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');
    setSavingPassword(true);
    try {
      const result = await changePassword({
        current_password: passwords.current,
        new_password: passwords.next,
        confirm_password: passwords.confirm,
      });
      setPasswordMsg(result.message);
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    setWarehouseMsg('');
    setWarehouseError('');
    setSavingWarehouse(true);
    try {
      const payload = {};
      Object.entries(warehouse).forEach(([key, value]) => {
        if (String(value).trim()) payload[key] = String(value).trim();
      });
      await createWarehouse(payload);
      setWarehouseMsg(
        'Warehouse create request sent successfully. This is a one-time setup.'
      );
    } catch (error) {
      setWarehouseError(error.message || 'Failed to create warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleFetchWaybill = async (e) => {
    e.preventDefault();
    setWaybillMsg('');
    setWaybillError('');
    setWaybillResult(null);
    setWaybillLoading(true);
    try {
      const result = await getWaybill(Number(waybillCount) || 1);
      setWaybillResult(result);
      setWaybillMsg('Waybill fetched successfully (optional tool).');
    } catch (error) {
      setWaybillError(error.message || 'Failed to fetch waybill');
    } finally {
      setWaybillLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading profile…</div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Settings</h2>
          <p>Profile, password, and delivery warehouse setup</p>
        </div>
      </div>

      {loadError && <div className="alert alert--error">{loadError}</div>}

      <div className="settings__grid">
        <section className="panel">
          <div className="panel__header">
            <h3>Admin Profile</h3>
          </div>
          <form className="panel__body" onSubmit={handleProfileSubmit}>
            {profileMsg && (
              <div className="alert alert--success">{profileMsg}</div>
            )}
            {profileError && (
              <div className="alert alert--error">{profileError}</div>
            )}
            <div className="form-grid">
              <div className="form-group form-group--full">
                <label htmlFor="full_name">Full Name</label>
                <input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, full_name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  value={profile.username}
                  readOnly
                  disabled
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h3>Change Password</h3>
          </div>
          <form className="panel__body" onSubmit={handlePasswordSubmit}>
            {passwordMsg && (
              <div className="alert alert--success">{passwordMsg}</div>
            )}
            {passwordError && (
              <div className="alert alert--error">{passwordError}</div>
            )}
            <div className="form-grid">
              <div className="form-group form-group--full">
                <label htmlFor="current">Current Password</label>
                <input
                  id="current"
                  type="password"
                  value={passwords.current}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, current: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="next">New Password</label>
                <input
                  id="next"
                  type="password"
                  value={passwords.next}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, next: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="form-group form-group--full">
                <label htmlFor="confirm">Confirm New Password</label>
                <input
                  id="confirm"
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, confirm: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel settings__warehouse">
        <div className="panel__header">
          <h3>Warehouse / Delivery setup</h3>
        </div>
        <form className="panel__body" onSubmit={handleWarehouseSubmit}>
          <p className="form-hint settings__hint">
            One-time Delhivery warehouse registration via your Hostinger backend.
            Do not run this automatically for every order.
          </p>
          {warehouseMsg && (
            <div className="alert alert--success">{warehouseMsg}</div>
          )}
          {warehouseError && (
            <div className="alert alert--error">{warehouseError}</div>
          )}
          <div className="form-grid">
            {[
              ['name', 'Warehouse name'],
              ['registered_name', 'Registered name'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['address', 'Address'],
              ['city', 'City'],
              ['state', 'State'],
              ['country', 'Country'],
              ['pin', 'Pincode'],
              ['return_address', 'Return address'],
              ['return_city', 'Return city'],
              ['return_state', 'Return state'],
              ['return_pin', 'Return pincode'],
              ['return_country', 'Return country'],
            ].map(([key, label]) => (
              <div
                className={`form-group ${
                  key.includes('address') ? 'form-group--full' : ''
                }`}
                key={key}
              >
                <label htmlFor={`wh-${key}`}>{label}</label>
                <input
                  id={`wh-${key}`}
                  value={warehouse[key]}
                  onChange={(e) =>
                    setWarehouse((w) => ({ ...w, [key]: e.target.value }))
                  }
                  required={['name', 'phone', 'address', 'city', 'pin'].includes(
                    key
                  )}
                />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={savingWarehouse}>
              {savingWarehouse ? 'Creating…' : 'Create warehouse'}
            </Button>
          </div>
        </form>
      </section>

      <section className="panel settings__warehouse">
        <div className="panel__header">
          <h3>Fetch Waybill (optional)</h3>
        </div>
        <form className="panel__body" onSubmit={handleFetchWaybill}>
          <p className="form-hint settings__hint">
            Use only if you need to fetch AWB numbers manually. Normal order
            fulfillment gets AWB from Create Shipment — do not use this for every order.
          </p>
          {waybillMsg && <div className="alert alert--success">{waybillMsg}</div>}
          {waybillError && (
            <div className="alert alert--error">{waybillError}</div>
          )}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="waybill-count">Count</label>
              <input
                id="waybill-count"
                type="number"
                min="1"
                max="10"
                value={waybillCount}
                onChange={(e) => setWaybillCount(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={waybillLoading}>
              {waybillLoading ? 'Fetching…' : 'Fetch Waybill'}
            </Button>
          </div>
          {waybillResult && (
            <pre className="settings__waybill-result">
              {JSON.stringify(waybillResult, null, 2)}
            </pre>
          )}
        </form>
      </section>
    </div>
  );
}
