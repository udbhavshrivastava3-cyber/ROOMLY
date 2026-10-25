import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('roomly_token');
    if (!token) return setBooted(true);
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.data.user))
      .catch(() => localStorage.removeItem('roomly_token'))
      .finally(() => setBooted(true));
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('roomly_token', r.data.data.token);
    setUser(r.data.data.user);
    return r.data.data.user;
  };

  const register = async (name, email, password, phone = '') => {
    const r = await api.post('/auth/register', { name, email, password, phone: phone || undefined });
    localStorage.setItem('roomly_token', r.data.data.token);
    setUser(r.data.data.user);
    return r.data.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('roomly_token');
      setUser(null);
    }
  };

  const homeFor = (role) =>
    role === 'admin' ? '/admin' : role === 'hotel_manager' ? '/manage' : role === 'staff' ? '/staff' : '/';

  return (
    <AuthCtx.Provider value={{ user, booted, login, register, logout, homeFor }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
