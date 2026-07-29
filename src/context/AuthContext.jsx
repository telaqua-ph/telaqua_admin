import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { isAuthenticated as hasToken } from '../services/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasToken()) {
      setUser(api.getCurrentUser());
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
      }
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
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
