import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hkchat_token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const res = await API.get('/auth/me');
      setUser(res.data.user);
      setSettings(res.data.settings);
    } catch (err) {
      localStorage.removeItem('hkchat_token');
      localStorage.removeItem('hkchat_user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('hkchat_token', res.data.token);
    localStorage.setItem('hkchat_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await loadUser();
    return res.data;
  };

  const register = async (email, password, display_name) => {
    const res = await API.post('/auth/register', { email, password, display_name });
    localStorage.setItem('hkchat_token', res.data.token);
    localStorage.setItem('hkchat_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await loadUser();
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('hkchat_token');
    localStorage.removeItem('hkchat_user');
    setUser(null);
    setSettings(null);
    window.location.href = '/login';
  };

  const updateProfile = async (data) => {
    const res = await API.put('/users/profile', data);
    setUser(res.data.user);
    return res.data;
  };

  const updateSettings = async (data) => {
    const res = await API.put('/users/settings', data);
    setSettings(res.data.settings);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{
      user, settings, loading,
      login, register, logout,
      updateProfile, updateSettings,
      setUser, setSettings
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
