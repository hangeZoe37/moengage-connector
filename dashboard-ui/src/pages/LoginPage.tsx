import { useState } from 'react';
import { api, setToken } from '../api';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login({ username, password });
      if (response.token) {
        setToken(response.token);
        navigate('/');
      } else {
        setError('Login failed: Token not received.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '16px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-violet)',
            color: 'white', marginBottom: '16px', fontWeight: 'bold', fontSize: '24px'
          }}>
            M
          </div>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', margin: 0 }}>MoEngage SPARC</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Log in to Admin Dashboard</p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleLogin}>
              
              {error && (
                <div className="toast error" style={{ marginBottom: '20px' }}>
                  {error}
                </div>
              )}
              
              <div className="form-group mb-5">
                <label className="form-label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  placeholder="admin"
                  required
                />
              </div>
              
              <div className="form-group mb-6">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div style={{ marginTop: '24px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>

            </form>
          </div>
        </div>
        
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '32px' }}>
          MoEngage RCS Connector System
        </p>
      </div>
    </div>
  );
}
