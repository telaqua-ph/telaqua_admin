import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, getProfile, updateProfile } from '../../services/api';
import {
  checkDevicePushStatus,
  disableOrderPushOnDevice,
  enableOrderPushOnDevice,
  isWebPushSupported,
  sendTestOrderPush,
} from '../../services/webPush';
import { Button } from '../../components/Buttons';
import * as delhivery from '../../services/delhivery';
import '../../styles/shared.css';
import './Settings.css';

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [warehouse, setWarehouse] = useState(null);
  const [warehouseEnv, setWarehouseEnv] = useState('staging');
  const [logisticsReadiness, setLogisticsReadiness] = useState(null);
  const [warehouseError, setWarehouseError] = useState('');
  const [warehouseMessage, setWarehouseMessage] = useState('');
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const [pushSupported] = useState(() => isWebPushSupported());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');
  const [pushError, setPushError] = useState('');
  const [pushLoading, setPushLoading] = useState(true);

  const refreshPushStatus = async () => {
    setPushLoading(true);
    try {
      const status = await checkDevicePushStatus();
      setPushEnabled(Boolean(status.enabled));
      setPushPermission(status.permission || (status.supported ? 'default' : 'unsupported'));
      if (status.error) {
        setPushError(status.error);
      }
    } catch (error) {
      setPushError(error.message || 'Unable to check notification status');
    } finally {
      setPushLoading(false);
    }
  };

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

  useEffect(() => {
    delhivery.getWarehouse()
      .then((result) => {
        setWarehouse(result.warehouse || null);
        setWarehouseEnv(result.environment || 'staging');
        setLogisticsReadiness(result.readiness || null);
      })
      .catch((error) => {
        if (error.status !== 401) setWarehouseError(error.message || 'Unable to load warehouse');
      });
  }, []);

  useEffect(() => {
    refreshPushStatus();
  }, []);

  const handleCreateWarehouse = async () => {
    setSavingWarehouse(true);
    setWarehouseError('');
    setWarehouseMessage('');
    try {
      await delhivery.createWarehouse({});
      const result = await delhivery.getWarehouse();
      setWarehouse(result.warehouse || null);
      setLogisticsReadiness(result.readiness || null);
      setWarehouseMessage('Warehouse created or verified with Delhivery.');
    } catch (error) {
      setWarehouseError(error.message || 'Unable to create warehouse');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMsg('');
    setPushError('');
    const result = await enableOrderPushOnDevice();
    if (result.success) {
      setPushEnabled(true);
      setPushPermission('granted');
      setPushMsg(result.message);
    } else {
      setPushEnabled(false);
      setPushError(result.message);
      if (result.code === 'denied') setPushPermission('denied');
    }
    setPushBusy(false);
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMsg('');
    setPushError('');
    const result = await sendTestOrderPush();
    if (result.success) setPushMsg(result.message);
    else setPushError(result.message);
    setPushBusy(false);
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushMsg('');
    setPushError('');
    const result = await disableOrderPushOnDevice();
    setPushEnabled(false);
    if (result.success) {
      setPushMsg(result.message);
    } else {
      setPushError(result.message);
    }
    setPushBusy(false);
  };

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

  if (loading) {
    return <div className="loading-state">Loading profile…</div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Settings</h2>
          <p>Profile and password</p>
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

        <section className="panel settings__push">
          <div className="panel__header">
            <h3>Order notifications</h3>
          </div>
          <div className="panel__body order-details__stack">
            {pushMsg && <div className="alert alert--success">{pushMsg}</div>}
            {pushError && <div className="alert alert--error">{pushError}</div>}
            <p className="form-hint">
              Get a system notification on this device when a new order is saved,
              even if the admin tab is closed. Inventory alerts are unchanged.
            </p>
            {!pushSupported ? (
              <div className="alert alert--error">
                This browser does not support Web Push. Use Chrome or Edge on Windows,
                or Chrome on Android.
              </div>
            ) : pushLoading ? (
              <p className="form-hint">Checking this device…</p>
            ) : (
              <>
                <div>
                  <span>This device</span>
                  <strong>{pushEnabled ? 'Enabled' : 'Not enabled'}</strong>
                </div>
                {pushPermission === 'denied' && (
                  <div className="alert alert--error">
                    Notifications are blocked for this site. Allow them in browser
                    settings, then click Enable again.
                  </div>
                )}
                <div className="form-actions settings__push-actions">
                  {!pushEnabled ? (
                    <Button disabled={pushBusy} onClick={handleEnablePush}>
                      {pushBusy ? 'Enabling…' : 'Enable order notifications'}
                    </Button>
                  ) : (
                    <>
                      <Button disabled={pushBusy} onClick={handleTestPush}>
                        {pushBusy ? 'Sending…' : 'Send test notification'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={pushBusy}
                        onClick={handleDisablePush}
                      >
                        Disable on this device
                      </Button>
                    </>
                  )}
                </div>
                <p className="form-hint">
                  Enabling on a phone and a PC registers both. Disabling here only
                  affects this browser. Permission is requested only when you click Enable.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="panel settings__warehouse">
          <div className="panel__header">
            <h3>Delhivery Warehouse</h3>
          </div>
          <div className="panel__body order-details__stack">
            {warehouseMessage && <div className="alert alert--success">{warehouseMessage}</div>}
            {warehouseError && <div className="alert alert--error">{warehouseError}</div>}
            <p className="form-hint">Environment: <strong>{warehouseEnv}</strong></p>
            {logisticsReadiness && !logisticsReadiness.ready ? (
              <div className="alert alert--error">
                Backend configuration is incomplete. Add these server environment variables: {logisticsReadiness.missing.join(', ')}.
              </div>
            ) : null}
            {warehouse ? (
              <>
                <div><span>Warehouse Name</span><strong>{warehouse.name || '—'}</strong></div>
                <div><span>Address</span><strong>{warehouse.address || '—'}</strong></div>
                <div><span>City / State</span><strong>{[warehouse.city, warehouse.state].filter(Boolean).join(', ') || '—'}</strong></div>
                <div><span>Pincode</span><strong>{warehouse.pincode || '—'}</strong></div>
                <div><span>Phone</span><strong>{warehouse.phone || '—'}</strong></div>
                <Button disabled={savingWarehouse} onClick={handleCreateWarehouse}>
                  {savingWarehouse ? 'Verifying…' : 'Create / Verify with Delhivery'}
                </Button>
              </>
            ) : (
              <p className="form-hint">Configure the TELAQUA_WAREHOUSE_* variables on the backend.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
