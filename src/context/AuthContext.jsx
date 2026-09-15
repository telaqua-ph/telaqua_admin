import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { isAuthenticated as hasToken } from '../services/http';
import {
  reconcilePushForCurrentAccount,
  revokePushOnLogout,
} from '../services/webPush';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoutNotice, setLogoutNotice] = useState(null);

  useEffect(() => {
    if (hasToken()) {
      setUser(api.getCurrentUser());
      reconcilePushForCurrentAccount().catch(() => {});
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const result = await api.login(email, password);
      if (result.success) {
        setUser(result.user);
        setLogoutNotice(null);
        reconcilePushForCurrentAccount().catch(() => {});
      }
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    let pushCleanup = null;
    try {
      pushCleanup = await revokePushOnLogout();
    } catch {
      pushCleanup = {
        attempted: true,
        serverRevoked: false,
        error: 'Push cleanup failed',
      };
    }

    api.logout();
    setUser(null);

    if (pushCleanup?.attempted && !pushCleanup.serverRevoked) {
      const notice =
        pushCleanup.error ||
        'Signed out locally, but server push revocation did not confirm. Disable notifications again after reconnecting if needed.';
      setLogoutNotice(notice);
      return { pushCleanup, notice };
    }

    setLogoutNotice(null);
    return { pushCleanup, notice: null };
  }, []);

  const clearLogoutNotice = useCallback(() => {
    setLogoutNotice(null);
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(hasToken()),
        login,
        logout,
        updateUser,
        logoutNotice,
        clearLogoutNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
