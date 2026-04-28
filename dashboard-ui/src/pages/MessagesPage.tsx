import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, Filter, X, Download } from 'lucide-react';
import { api, MessageLog, Client, MessageDetailResponse } from '../api';
import {
  getStatusBadgeClass,
  getChannelFromStatus,
  formatTimestamp,
  truncate,
} from '../utils';

const PAGE_SIZE = 30;

export default function MessagesPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const connector = localStorage.getItem('currentConnector') || 'MOENGAGE';
  const isWebEngage = connector === 'WEBENGAGE';
  
  // Filters
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  
  // Timeline Drawer
  const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);
  const [msgDetail, setMsgDetail] = useState<MessageDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const getStatusDot = (status: string) => {
    if (!status) return 'slate';
    const s = status.toUpperCase();
    if (s === 'DELIVERED') return 'green';
    if (s.includes('FAIL')) return 'red';
    if (s.includes('READ')) return 'cyan';
    if (s.includes('SENT')) return 'blue';
    if (s === 'QUEUED') return 'slate';
    if (s.includes('SMS')) return 'amber';
    return 'slate';
  };

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const clientId = selectedClient ? Number(selectedClient) : undefined;
      // We use api.getLogs so it goes through the proper wrapper
      const res = await api.getLogs(PAGE_SIZE, off, clientId, selectedStatus, selectedChannel);

      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, selectedStatus, selectedChannel]);

  useEffect(() => {
    api.getClients().then(r => setClients(r.clients)).catch(console.error);
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  const openDrawer = async (id: number, connector?: string) => {
    setSelectedMsgId(id);
    setLoadingDetail(true);
    setMsgDetail(null);
    try {
      const res = await api.getMessageDetail(id, connector);
      setMsgDetail(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDrawer = () => {
    setSelectedMsgId(null);
    setMsgDetail(null);
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const header = ['Msg ID', 'Callback Data', 'Client', 'Channel', 'Status', 'DLR Rcvd', 'DLR Fwd', 'Timestamp'];
    const rows = logs.map(log => {
      const channelDisplay = getChannelFromStatus(log.status); 
      const rcvd = (log as any).total_dlrs > 0 ? 'Yes' : 'No';
      const fwd = (log as any).forwarded_dlrs > 0 ? 'Yes' : 'No';
      return [
        log.id,
        `"${log.callback_data || ''}"`,
        `"${log.client_name || '#' + log.client_id}"`,
        channelDisplay,
        log.status,
        rcvd,
        fwd,
        new Date(log.created_at).toISOString()
      ];
    });
    
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `message-logs-${selectedStatus || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={{ position: 'relative' }}>
      {/* Filter bar */}
      <div className="card mb-24">
        <div className="card-body" style={{ padding: '14px 22px' }}>
          <div className="filter-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={15} style={{ color: '#5c6678' }} />
                <select className="form-input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select className="form-input" value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}>
                  <option value="">All Channels</option>
                  <option value="RCS">RCS</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select className="form-input" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="RCS_SENT">RCS SENT</option>
                  <option value="RCS_DELIVERED">RCS DELIVERED</option>
                  <option value="RCS_DELIVERY_FAILED">RCS DELIVERY FAILED</option>
                  <option value="SMS_SENT">SMS SENT</option>
                  <option value="SMS_DELIVERED">SMS DELIVERED</option>
                  <option value="SMS_DELIVERY_FAILED">SMS DELIVERY FAILED</option>
                </select>
              </div>

            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => load(0)}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button className="btn btn-primary btn-sm" onClick={exportCSV}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header" style={{ padding: '24px', borderBottom: 'none' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Message Explorer</h2>
          <p style={{ color: '#8b95a8', fontSize: '0.85rem', marginTop: 4 }}>
            {total.toLocaleString()} total records matched
          </p>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Msg ID</th>
                <th>Callback Data</th>
                <th>Client</th>
                <th>Channel</th>
                <th>Status</th>
                <th>DLR Rcvd</th>
                <th>DLR Fwd</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#5c6678' }}>
                    <RefreshCw size={18} style={{ display: 'inline', marginRight: 8 }} className="spin" />
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p>No messages found</p>
                    </div>
                  </td>
                </tr>
              ) : logs.map((log: any) => {
                const channelDisplay = getChannelFromStatus(log.status); 
                
                const rcvd = log.total_dlrs > 0;
                const fwd = log.forwarded_dlrs > 0;

                return (
                  <tr key={`${log.connector_type}-${log.id}`} onClick={() => openDrawer(log.id, log.connector_type)}>
                    <td><span className="mono">#{log.id}</span></td>
                    <td><span className="mono">{truncate(log.callback_data, 18)}</span></td>
                    <td style={{ color: '#8b95a8' }}>{log.client_name || `#${log.client_id}`}</td>
                    <td>
                      <span className={`badge badge-channel ${channelDisplay === 'SMS' ? 'badge-sms-channel' : 'badge-rcs'}`}>
                        {channelDisplay}
                      </span>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${getStatusDot(log.status)}`} />
                        {log.status?.replace(/_/g, ' ') || '—'}
                        {!isWebEngage && log.has_fallback > 0 && channelDisplay === 'SMS' && (
                          <span className="badge badge-fallback" title="RCS failed, message was sent via SMS">
                            Fallback
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{rcvd ? 'Yes' : 'No'}</td>
                    <td>{fwd ? 'Yes' : 'No'}</td>
                    <td style={{ color: '#5c6678', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            Page {currentPage} of {totalPages || 1} · {total} records
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary btn-sm"
              disabled={offset === 0}
              onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Prev
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => load(offset + PAGE_SIZE)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedMsgId !== null && (
        <>
          <div className="drawer-overlay" onClick={closeDrawer} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999
          }} />
          <div className="drawer-container" style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '450px', 
            background: 'var(--bg-card)', zIndex: 1000, boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', transition: 'transform 0.3s'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Message #{selectedMsgId}</h2>
                <button className="btn btn-icon btn-secondary" onClick={() => openDrawer(selectedMsgId!)} title="Refresh Details">
                  <RefreshCw size={14} className={loadingDetail ? 'spin' : ''} />
                </button>
              </div>
              <button className="btn btn-icon btn-secondary" onClick={closeDrawer}><X size={16} /></button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>
                   <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
                   <p>Loading details...</p>
                </div>
              ) : msgDetail ? (
                (() => {
                  const connectorType = msgDetail.message.connector_type || 'MOENGAGE';
                  const connectorName = connectorType === 'MOENGAGE' ? 'MoEngage' : connectorType === 'WEBENGAGE' ? 'WebEngage' : 'CleverTap';
                  const isFinal = msgDetail.message.status.includes('DELIVERED') || msgDetail.message.status.includes('FAILED');

                  // Merge all events into a single sorted timeline
                  const allEvents = [
                    ...(msgDetail.dlrEvents || []).map(e => ({ ...e, eventType: 'DLR' })),
                    ...(msgDetail.suggestionEvents || []).map(e => ({ ...e, eventType: 'SUGGESTION' }))
                  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                  return (
                    <div className="timeline">
                      {/* Lifecycle Start */}
                      <div className="timeline-item">
                        <span className="timeline-dot green" />
                        <div className="timeline-content">
                          <div style={{ fontWeight: 600 }}>{connectorName} Request Received</div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTimestamp(msgDetail.message.created_at)}</p>
                        </div>
                      </div>
                  
                      <div className="timeline-item">
                        <span className="timeline-dot blue" />
                        <div className="timeline-content">
                          <div style={{ fontWeight: 600 }}>Queued & Accepted</div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(200 OK returned to {connectorName})</p>
                        </div>
                      </div>

                      {/* SPARC Handshake */}
                      <div className="timeline-item">
                        <span className={`timeline-dot ${msgDetail.message.status.includes('SENT') || isFinal ? 'blue' : 'slate'}`} />
                        <div className="timeline-content">
                          <div style={{ fontWeight: 600 }}>Submitted to SPARC Network</div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {msgDetail.message.sparc_message_id ? `MsgID: ${msgDetail.message.sparc_message_id}` : 'Handshake complete'}
                          </p>
                        </div>
                      </div>

                      {/* Unified Timeline Events */}
                      {allEvents.length === 0 ? (
                         !isFinal && (
                            <div className="timeline-item">
                              <span className="timeline-dot slate pulse" />
                              <div className="timeline-content">
                                <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Awaiting DLR from SPARC...</div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for network acknowledgment</p>
                              </div>
                            </div>
                         )
                      ) : (
                        allEvents.map((ev: any, idx) => {
                          if (ev.eventType === 'DLR') {
                            const isFailure = ev.sparc_status.includes('FAIL') || ev.sparc_status.includes('REJECT');
                            const isSuccess = ev.sparc_status.includes('DELIVER') || ev.sparc_status.includes('READ');
                            const dotClass = isFailure ? 'red' : isSuccess ? 'green' : 'slate';

                            return (
                              <div key={`dlr-${ev.id}-${idx}`} className="timeline-item">
                                <span className={`timeline-dot ${dotClass}`} />
                                <div className="timeline-content">
                                  <div style={{ fontWeight: 600 }}>DLR Received from SPARC</div>
                                  <p style={{ fontSize: '0.9rem', color: isFailure ? 'var(--danger)' : 'var(--text-primary)' }}>
                                    Status: {ev.sparc_status}
                                  </p>
                                  
                                  <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                                      Forwarded to {connectorName}: {ev.callback_dispatched ? '✓ YES (Outcome Forwarded)' : '✕ NO'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      {connectorName} Status: {ev.moe_status}
                                    </div>
                                    {ev.error_message && (
                                      <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 4 }}>
                                        Error: {ev.error_message}
                                      </div>
                                    )}
                                  </div>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                    {formatTimestamp(ev.created_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          } else {
                            // Suggestion Event
                            return (
                              <div key={`sug-${ev.id}-${idx}`} className="timeline-item">
                                <span className="timeline-dot cyan" />
                                <div className="timeline-content">
                                  <div style={{ fontWeight: 600 }}>Suggestion Clicked (User Interaction)</div>
                                  <div style={{ marginTop: 10, padding: '10px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                                    <p style={{ fontSize: '0.85rem' }}>Text: <b>{ev.suggestion_text || '—'}</b></p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Postback: <code>{ev.postback_data || '—'}</code></p>
                                    <div style={{ fontSize: '0.8rem', marginTop: 8, color: ev.callback_dispatched ? 'var(--success)' : 'var(--text-muted)' }}>
                                      Forwarded to {connectorName}: {ev.callback_dispatched ? '✓ YES' : '✕ NO'}
                                    </div>
                                  </div>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                    {formatTimestamp(ev.created_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                        })
                      )}
                      
                      {/* Final Result */}
                      <div className="timeline-item" style={{ marginTop: 24 }}>
                        <span className={`timeline-dot square ${getStatusDot(msgDetail.message.status)}`} />
                        <div className="timeline-content">
                          <div style={{ fontWeight: 600 }}>{isFinal ? 'Final Outcome' : 'Current Connector Status'}</div>
                          <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: 4, letterSpacing: '0.5px' }}>
                            {msgDetail.message.status.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ color: 'var(--danger)' }}>Failed to load message details.</div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
