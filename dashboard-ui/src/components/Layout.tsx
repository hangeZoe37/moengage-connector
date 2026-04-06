import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Radio,
  Settings,
  Zap,
  Moon,
  Sun
} from 'lucide-react';

const navItems = [
  { to: '/',           label: 'DASHBOARD',    icon: LayoutDashboard, section: '' },
  { to: '/clients',    label: 'CUSTOMERS',    icon: Users,           section: '' },
  { to: '/dlr-events', label: 'ANALYTICS',    icon: Radio,           section: '' },
  { to: '/messages',   label: 'MESSAGES',     icon: MessageSquare,   section: 'SETTINGS' },
  { to: '/settings',   label: 'SETTING',      icon: Settings,        section: 'SETTINGS' },
];

const pageTitles: Record<string, string> = {
  '/':           'Overview',
  '/messages':   'Message Logs',
  '/dlr-events': 'DLR Events',
  '/clients':    'Client Management',
  '/settings':   'Settings',
};

export default function Layout() {
  const location = useLocation();
  const pathKey = location.pathname;
  const title = pageTitles[pathKey] ?? (pathKey.startsWith('/messages/') ? 'Message Detail' : 'Dashboard');

  const [isDark, setIsDark] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light');
    } else {
      document.body.classList.add('light');
    }
  }, [isDark]);

  let lastSection = '';

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isCollapsed && <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'white' }}>Brand.</h1>}
          <button 
            className="btn btn-icon" 
            style={{ color: '#5c6678', background: 'transparent' }}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Zap size={isCollapsed ? 20 : 16} strokeWidth={2.5} style={{ color: isCollapsed ? '#0ea5e9' : 'inherit' }} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const showSection = item.section !== lastSection;
            if (showSection) lastSection = item.section;
            return (
              <div key={item.to}>
                {showSection && !isCollapsed && (
                  <div className="sidebar-section-label">{item.section}</div>
                )}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}`
                  }
                >
                  <item.icon size={18} />
                  {!isCollapsed && <span>{item.label}</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="main-area">
        <header className="top-bar">
          <h2 className="top-bar-title">{title}</h2>
          <div className="top-bar-meta">
            <button
              className="btn btn-secondary btn-icon"
              style={{ width: 32, height: 32, borderRadius: 16 }}
              onClick={() => setIsDark(!isDark)}
              title="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
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
  );
}
