interface EnvGroup {
  group: string;
  vars: string[];
}

const envVars: EnvGroup[] = [
  { group: 'Database',             vars: ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'] },
  { group: 'SPARC API',            vars: ['SPARC_API_BASE_URL'] },
  { group: 'Webhook URLs',         vars: ['SPARC_WEBHOOK_URL', 'MOENGAGE_DLR_URL'] },
  { group: 'Dashboard Auth',       vars: ['DASHBOARD_PASSWORD'] },
  { group: 'Server',               vars: ['PORT', 'NODE_ENV'] },
];


export default function SettingsPage() {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Environment Variables Reference */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: 'none', padding: '24px 24px 12px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>System Configuration</h2>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {envVars.map(({ group, vars }) => (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {vars.map(v => (
                    <div key={v} style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      borderBottom: '1px solid var(--border-subtle)',
                      padding: '12px 4px',
                    }}>
                      <span className="mono" style={{ fontSize: '0.82rem', color: '#3B82F6', minWidth: 220 }}>{v}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {v.includes('PASSWORD') || v.includes('PASS') ? '•••••••• (Secret)' : 'Set in .env'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

 
        {/* Dashboard Info */}
        <div className="card">
          <div className="card-header" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Application Info</h2>
          </div>
          <div className="card-body">
            <dl className="detail-panel">
              <dt>Service Name</dt>
              <dd>MoEngage × SPARC Gateway Connector</dd>
              <dt>Version</dt>
              <dd className="mono">1.0.4-stable</dd>
              <dt>Authentication</dt>
              <dd>Dashboard secured with Basic-Auth</dd>
              <dt>Live Streams</dt>
              <dd>Real-time DLR consumption active</dd>
            </dl>
          </div>
        </div>

      </div>
    </div>
  );
}
