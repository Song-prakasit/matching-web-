import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import LoginPage from './components/LoginPage.jsx';
import MainPage from './components/MainPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [dbMode, setDbMode] = useState(null);

  useEffect(() => {
    api('/health').then((h) => setDbMode(h.dbMode)).catch(() => {});
    if (getToken()) {
      api('/auth/me')
        .then((d) => setUser(d.user))
        .catch(() => setToken(null))
        .finally(() => setChecking(false));
    }
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  if (checking) return null;
  return user ? (
    <MainPage user={user} dbMode={dbMode} onLogout={logout} />
  ) : (
    <LoginPage dbMode={dbMode} onLogin={login} />
  );
}
