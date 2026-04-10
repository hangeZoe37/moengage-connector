import { useNavigate } from 'react-router-dom';
import { clearToken } from '../api';

export default function WabaDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      <header className="top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px' }}>
        <h1 className="top-bar-title" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>WABA Dashboard</h1>
        <div className="top-bar-meta">
          <button 
            className="btn btn-secondary" 
            style={{ marginRight: '16px' }}
            onClick={() => navigate('/channels')}
          >
            Switch Channel
          </button>
          <button
            className="btn btn-secondary btn-icon"
            style={{ height: 36, padding: '0 12px', fontSize: '13px', borderRadius: '18px', border: 'none', background: 'var(--bg-input)', fontWeight: 500 }}
            onClick={() => {
              if (confirm('Are you sure you want to log out?')) {
                clearToken();
                window.location.href = '/login';
              }
            }}
          >
            Logout
          </button>
        </div>
      </header>
      
      <main className="page-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚧</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Dashboard Under Construction</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '32px' }}>
            The WhatsApp Business API (WABA) connector interface is currently being developed and will be available soon.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/channels')}
          >
            Go Back
          </button>
        </div>
      </main>
    </div>
  );
}
