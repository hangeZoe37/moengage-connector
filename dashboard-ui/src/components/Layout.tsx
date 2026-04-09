import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Radio,
  Zap,
} from 'lucide-react';
import { api, clearToken } from '../api';

const navItems = [
  { to: '/',           label: 'Overview',    icon: LayoutDashboard, section: '' },
  { to: '/clients',    label: 'Clients',     icon: Users,           section: '' },
  { to: '/messages',   label: 'Messages',    icon: MessageSquare,   section: '' },
  { to: '/dlr-events', label: 'DLR Tracker', icon: Radio,           section: '', badgeKey: 'dlr_pending' },
];

const pageTitles: Record<string, string> = {
  '/':           'Overview',
  '/messages':   'Message Explorer',
  '/dlr-events': 'DLR Tracker',
  '/clients':    'Client Management',
};

export default function Layout() {
  const location = useLocation();
  const pathKey = location.pathname;
  const title = pageTitles[pathKey] ?? (pathKey.startsWith('/messages/') ? 'Message Detail' : 'Dashboard');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false); // Defaulting to light mode to match the reference image
  const [dlrPending, setDlrPending] = useState(0);

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light');
    } else {
      document.body.classList.add('light');
    }
  }, [isDark]);

  useEffect(() => {
    const checkPending = async () => {
      try {
        // Fetch only stuck DLRs (callback_dispatched = 0) — page size 1 is enough, we just need the total
        const res = await api.getDlrEvents(1, 0, undefined, 'stuck');
        setDlrPending(res.total || 0);
      } catch (e) {
        /* silent */
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isCollapsed && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: 'var(--accent-violet)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>M</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'white' }}>MoEngage</h1>
          </div>}
          <button 
            className="btn btn-icon" 
            style={{ color: '#5c6678', background: 'transparent' }}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Zap size={isCollapsed ? 20 : 16} strokeWidth={2.5} style={{ color: isCollapsed ? '#0ea5e9' : 'inherit' }} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' active' : ''}`
                }
              >
                <item.icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && item.badgeKey === 'dlr_pending' && dlrPending > 0 && (
                  <span className="badge-danger" style={{ marginLeft: 'auto' }}>
                    {dlrPending}
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="main-area">
        <div className="main-content-wrapper">
          <header className="top-bar">
            <h2 className="top-bar-title">{title}</h2>
            <div className="top-bar-meta">
              <button
                className="btn btn-secondary btn-icon"
                style={{ height: 36, padding: '0 12px', fontSize: '13px', borderRadius: '18px', border: 'none', background: 'var(--bg-input)', fontWeight: 500 }}
                onClick={() => {
                  if (confirm('Are you sure you want to log out?')) {
                    clearToken();
                    window.location.href = '/admin/login';
                  }
                }}
              >
                Logout
              </button>
              <button
                className="btn btn-secondary btn-icon"
                style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--bg-input)' }}
                onClick={() => setIsDark(!isDark)}
                title="Toggle Theme"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <div className="live-indicator">
                <span className="live-dot" />
                Live
              </div>
            </div>
          </header>
          <main className="page-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
