import { useNavigate } from 'react-router-dom';
import WhatsAppLogo from '../assets/whatsapp.png';
import MessagesLogo from '../assets/messages.png';
import MoEngageLogo from '../assets/moengage.png';
import CleverTapLogo from '../assets/clevertap.png';
import WebEngageLogo from '../assets/webengage.png';

export default function ChannelSelectionPage() {
  const navigate = useNavigate();
  const connector = localStorage.getItem('currentConnector') || 'MOENGAGE';
  const isMoEngage  = connector === 'MOENGAGE';
  const isWebEngage = connector === 'WEBENGAGE';

  const connectorLogo = isMoEngage ? MoEngageLogo : isWebEngage ? WebEngageLogo : CleverTapLogo;
  const connectorName = isMoEngage ? 'MoEngage' : isWebEngage ? 'WebEngage' : 'CleverTap';

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '600px', padding: '16px', textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px', overflow: 'hidden',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <img src={connectorLogo} alt={connectorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Select Channel</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '1.1rem' }}>
          Choose communication channel for {connectorName}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {/* WABA — shows Under Construction for all connectors */}
          <div
            className="card"
            style={{ cursor: 'pointer', padding: '40px 24px', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            onClick={() => navigate('/waba')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '64px', height: '64px', marginBottom: '8px' }}>
              <img src={WhatsAppLogo} alt="WhatsApp" style={{ width: '100%', height: '100%' }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>WABA</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>WhatsApp Business API</p>
            </div>
          </div>

          {/* RCS — full dashboard */}
          <div
            className="card"
            style={{ cursor: 'pointer', padding: '40px 24px', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
            onClick={() => navigate('/')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '64px', height: '64px', marginBottom: '8px' }}>
              <img src={MessagesLogo} alt="Google Messages" style={{ width: '100%', height: '100%' }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem' }}>RCS</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Rich Communication Services</p>
            </div>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          style={{ marginTop: '48px' }}
          onClick={() => navigate('/connectors')}
        >
          ← Back to Connectors
        </button>
      </div>
    </div>
  );
}
