import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, getProfile, updateProfile } from '../../services/api';
import { Button } from '../../components/Buttons';
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

  if (loading) {
    return <div className="loading-state">Loading profile…</div>;
  }

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h2>Settings</h2>
          <p>Manage your admin profile and password</p>
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
    </div>
  );
}
