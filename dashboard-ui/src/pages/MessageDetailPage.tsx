import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';
import { api, MessageDetailResponse } from '../api';
import {
  getStatusBadgeClass,
  getChannelFromStatus,
  formatTimestamp,
  truncate,
} from '../utils';

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<MessageDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryParams = new URLSearchParams(location.search);
  const connector = queryParams.get('connector') || undefined;

  const getStatusDot = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'DELIVERED') return 'green';
    if (s === 'FAILED') return 'red';
    if (s === 'READ') return 'cyan';
    if (s === 'SENT') return 'blue';
    if (s === 'QUEUED') return 'slate';
    if (s === 'SMS') return 'amber';
    return 'slate';
  };

  useEffect(() => {
    if (!id) return;
    api.getMessageDetail(Number(id), connector)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, connector]);

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw size={36} />
        <p>Loading message…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <p className="text-danger">{error || 'Message not found'}</p>
        <button className="btn btn-secondary mt-16" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const { message: msg, dlrEvents, suggestionEvents = [] } = data;
  const channel = getChannelFromStatus(msg.status);
  const isWebEngage = msg.connector_type === 'WEBENGAGE';

  const exportReport = () => {
    const rows: string[][] = [];

    // Section: Message Metadata
    rows.push(['=== MESSAGE METADATA ===']);
    rows.push(['Field', 'Value']);
    rows.push(['Message ID', String(msg.id)]);
    rows.push(['Callback Data', msg.callback_data || '—']);
    rows.push(['Client', msg.client_name || `ID #${msg.client_id}`]);
    rows.push(['Destination', msg.destination || '—']);
    rows.push(['Bot / Assistant', msg.bot_id || '—']);
    rows.push(['Message Type', msg.message_type || '—']);
    rows.push(['Template', msg.template_name || '—']);
    if (!isWebEngage) rows.push(['Fallback Order', msg.fallback_order || '—']);
    rows.push(['Status', msg.status || '—']);
    rows.push(['SPARC Msg ID', msg.sparc_message_id || '—']);
    rows.push(['Error', msg.error_message || '—']);
    rows.push(['Created At', new Date(msg.created_at).toISOString()]);
    rows.push(['Updated At', new Date(msg.updated_at).toISOString()]);
    rows.push([]);

    // Section: DLR Events
    rows.push(['=== DLR EVENTS ===']);
    rows.push(['Event ID', 'SPARC Status', 'Connector Status', 'Dispatched', 'Error', 'Timestamp']);
    if (dlrEvents.length === 0) {
      rows.push(['No DLR events recorded', '', '', '', '', '']);
    } else {
      dlrEvents.forEach(ev => {
        rows.push([
          String(ev.id),
          ev.sparc_status || '—',
          ev.moe_status || '—',
          ev.callback_dispatched ? 'Yes' : 'No',
          ev.error_message || '—',
          new Date(ev.created_at).toISOString()
        ]);
      });
    }
    rows.push([]);

    // Section: User Interactions
    rows.push(['=== USER INTERACTIONS (SUGGESTION EVENTS) ===']);
    rows.push(['Event ID', 'Suggestion Text', 'Postback Data', 'Dispatched', 'Timestamp']);
    if (suggestionEvents.length === 0) {
      rows.push(['No interaction events recorded', '', '', '', '']);
    } else {
      suggestionEvents.forEach(ev => {
        rows.push([
          String(ev.id),
          `"${ev.suggestion_text || '—'}"`,
          `"${ev.postback_data || '—'}"`,
          ev.callback_dispatched ? 'Yes' : 'No',
          new Date(ev.created_at).toISOString()
        ]);
      });
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `message-report-${msg.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-24">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 600 }}>Message Details</h2>
              <div className="status-indicator" style={{ background: 'var(--bg-card)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                <span className={`status-dot ${getStatusDot(msg.status)}`} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{msg.status.toUpperCase()}</span>
              </div>
              {channel === 'SMS' && !isWebEngage ? (
                <span className="badge badge-sms-channel">SMS Fallback</span>
              ) : (
                <span className="badge badge-rcs">RCS · {msg.message_type}</span>
              )}
            </div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={exportReport}>
          <Download size={14} /> Export Report
        </button>
      </div>

      <div className="grid-2">
        {/* Left column: details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Core fields */}
          <div className="card">
            <div className="card-header"><h2>Message Details</h2></div>
            <div className="card-body">
              <dl className="detail-panel">
                <dt>Destination</dt>
                <dd className="mono">{msg.destination || '—'}</dd>
                <dt>Bot / Assistant</dt>
                <dd className="mono">{msg.bot_id || '—'}</dd>
                <dt>Message Type</dt>
                <dd>{msg.message_type || '—'}</dd>
                <dt>Template</dt>
                <dd>{msg.template_name || '—'}</dd>
                {!isWebEngage && (
                  <>
                    <dt>Fallback Order</dt>
                    <dd style={{ textTransform: 'capitalize' }}>{msg.fallback_order || '—'}</dd>
                  </>
                )}
                <dt>SPARC Msg ID</dt>
                <dd className="mono">{msg.sparc_message_id || '—'}</dd>
                <dt>Client</dt>
                <dd>{msg.client_name || `ID #${msg.client_id}`}</dd>
                <dt>Created</dt>
                <dd>{formatTimestamp(msg.created_at)}</dd>
                <dt>Updated</dt>
                <dd>{formatTimestamp(msg.updated_at)}</dd>
                {msg.error_message && (
                  <>
                    <dt>Error</dt>
                    <dd className="text-danger">{msg.error_message}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Raw payload */}
          <div className="card">
            <div className="card-header"><h2>Raw Payload</h2></div>
            <div className="card-body">
              {msg.raw_payload ? (
                <pre className="json-viewer">
                  {JSON.stringify(msg.raw_payload, null, 2)}
                </pre>
              ) : (
                <p className="text-muted">No payload stored</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: DLR timeline */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h2>DLR Event Timeline</h2>
            <span style={{ fontSize: '0.8rem', color: '#5c6678' }}>{dlrEvents.length} events</span>
          </div>
          <div className="card-body">
            {dlrEvents.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <p>No DLR events received yet</p>
              </div>
            ) : (
              <div className="timeline">
                {(() => {
                  const connectorType = msg.connector_type || 'MOENGAGE';
                  const connectorName = connectorType === 'MOENGAGE' ? 'MoEngage' : connectorType === 'WEBENGAGE' ? 'WebEngage' : 'CleverTap';
                  
                  return dlrEvents.map((ev, i) => (
                    <div key={ev.id} className="timeline-item">
                      <span className={`timeline-dot ${getStatusDot(ev.sparc_status)}`} />
                      <div className="timeline-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div className="status-indicator">
                            <span className={`status-dot ${getStatusDot(ev.sparc_status)}`} />
                            <span style={{ fontWeight: 600 }}>{ev.sparc_status.replace(/_/g, ' ')}</span>
                          </div>
                          {i === 0 && <span className="badge badge-queued" style={{ fontSize: '0.65rem' }}>LATEST</span>}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {connectorName}: {ev.moe_status} · Forwarded: {ev.callback_dispatched ? 'Yes' : 'No'}
                        </p>
                        {ev.error_message && (
                          <p className="text-danger" style={{ marginTop: 4, fontSize: '0.8rem' }}>{ev.error_message}</p>
                        )}
                        <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {formatTimestamp(ev.created_at)}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Interaction/Suggestion Events below DLR */}
        {suggestionEvents && suggestionEvents.length > 0 && (
          <div className="card" style={{ height: 'fit-content', marginTop: '20px' }}>
            <div className="card-header">
              <h2>User Interactions</h2>
              <span style={{ fontSize: '0.8rem', color: '#5c6678' }}>{suggestionEvents.length} events</span>
            </div>
            <div className="card-body">
              <div className="timeline">
                {(() => {
                  const connectorType = msg.connector_type || 'MOENGAGE';
                  const connectorName = connectorType === 'MOENGAGE' ? 'MoEngage' : connectorType === 'WEBENGAGE' ? 'WebEngage' : 'CleverTap';
                  
                  return suggestionEvents.map((ev) => (
                    <div key={`sug-${ev.id}`} className="timeline-item">
                      <span className="timeline-dot bg-cyan" />
                      <div className="timeline-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div className="status-indicator">
                            <span className="status-dot bg-cyan" />
                            <span style={{ fontWeight: 600 }}>REPLY / CLICK</span>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Text: <span className="mono">{ev.suggestion_text || '—'}</span>
                        </p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          Postback: <span className="mono">{ev.postback_data || '—'}</span>
                        </p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          Forwarded to {connectorName}: {ev.callback_dispatched ? 'Yes' : 'No'}
                        </p>
                        <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {formatTimestamp(ev.created_at)}
                        </p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
