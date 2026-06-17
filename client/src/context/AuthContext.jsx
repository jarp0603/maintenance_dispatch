import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dispatch_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('dispatch_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const res = await authApi.login(username, password);
    localStorage.setItem('dispatch_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  function logout() {
    localStorage.removeItem('dispatch_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
