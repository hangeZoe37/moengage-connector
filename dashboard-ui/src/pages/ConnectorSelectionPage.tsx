import { useNavigate } from 'react-router-dom';
import MoEngageLogo from '../assets/moengage.png';
import CleverTapLogo from '../assets/clevertap.png';

export default function ConnectorSelectionPage() {
  const navigate = useNavigate();

  const selectConnector = (id: string) => {
    localStorage.setItem('currentConnector', id);
    navigate('/channels');
  };

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '800px', padding: '16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Select Connector</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '1.1rem' }}>Choose the platform you want to integrate</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <div 
            className="card" 
            style={{ cursor: 'pointer', padding: '40px 24px', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            onClick={() => selectConnector('MOENGAGE')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', overflow: 'hidden' }}>
              <img src={MoEngageLogo} alt="MoEngage" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>MoEngage</h2>
          </div>
          
          <div 
            className="card" 
            style={{ cursor: 'pointer', padding: '40px 24px', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            onClick={() => selectConnector('CLEVERTAP')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', overflow: 'hidden' }}>
              <img src={CleverTapLogo} alt="CleverTap" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>CleverTap</h2>
          </div>
          
          <div 
            className="card" 
            style={{ cursor: 'pointer', padding: '40px 24px', opacity: 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            onClick={() => alert('WebEngage integration coming soon!')}
          >
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '16px', 
              background: '#00c3ff', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', 
              fontSize: '28px', fontWeight: 'bold', color: 'white' 
            }}>
              W
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>WebEngage</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
