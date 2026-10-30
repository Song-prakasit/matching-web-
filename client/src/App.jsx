import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import LoginPage from './components/LoginPage.jsx';
import ChangePasswordPage from './components/ChangePasswordPage.jsx';
import MainPage from './components/MainPage.jsx';

// Shared workstations: sign out after this long without any mouse, key or touch activity.
const IDLE_LOGOUT_MS = 15 * 60000;
const IDLE_WARNING_MS = 60000;

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [dbMode, setDbMode] = useState(null);
  const [branding, setBranding] = useState({ hospitalName: '', title: 'IPD Pharmacy Login', logo: '' });

  useEffect(() => {
    api('/branding').then(setBranding).catch(() => {});
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

  useEffect(() => {
    if (!user) return undefined;
    let warnTimer;
    let tick;
    const arm = () => {
      clearTimeout(warnTimer);
      clearInterval(tick);
      setIdleSecondsLeft(null);
      warnTimer = setTimeout(() => {
        const deadline = Date.now() + IDLE_WARNING_MS;
        const update = () => {
          const left = Math.ceil((deadline - Date.now()) / 1000);
          if (left <= 0) {
            clearInterval(tick);
            setToken(null);
            setChangingPassword(false);
            setIdleSecondsLeft(null);
            setUser(null);
          } else setIdleSecondsLeft(left);
        };
        update();
        tick = setInterval(update, 1000);
      }, IDLE_LOGOUT_MS - IDLE_WARNING_MS);
    };
    // Any activity (including pressing "continue") restarts the countdown and hides the warning.
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(warnTimer);
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [user]);

  const login = ({ token, user }, remember, { openSettings: open = false } = {}) => {
    setToken(token, remember);
    setOpenSettings(open);
    setUser(user);
  };
  const logout = () => {
    setToken(null);
    setChangingPassword(false);
    setUser(null);
  };
  // Keeps the "remember" choice: the new token goes to whichever storage holds the current one.
  const passwordChanged = ({ token, user }) => {
    setToken(token, !!localStorage.getItem('matching.token'));
    setUser(user);
    setChangingPassword(false);
  };

  if (checking) return null;
  const idleWarning = idleSecondsLeft !== null && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <h2 id="idle-title" className="text-lg font-semibold">
          ไม่มีการใช้งานสักครู่
        </h2>
        <p className="mt-2 text-slate-600">
          ระบบจะออกจากระบบอัตโนมัติใน <b className="tabular-nums">{idleSecondsLeft}</b> วินาที
        </p>
        <button autoFocus className="mt-5 w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800">
          ใช้งานต่อ
        </button>
      </div>
    </div>
  );

  const wrap = (page) => (
    <>
      {page}
      {idleWarning}
    </>
  );

  if (!user) return <LoginPage dbMode={dbMode} branding={branding} onLogin={login} />;
  if (user.mustChangePassword || changingPassword) {
    return wrap(
      <ChangePasswordPage
        forced={user.mustChangePassword}
        branding={branding}
        onDone={passwordChanged}
        onCancel={() => setChangingPassword(false)}
        onLogout={logout}
      />,
    );
  }
  return wrap(
    <MainPage
      user={user}
      dbMode={dbMode}
      branding={branding}
      onBrandingSaved={setBranding}
      startWithSettings={openSettings}
      onChangePassword={() => setChangingPassword(true)}
      onLogout={logout}
    />,
  );
}
