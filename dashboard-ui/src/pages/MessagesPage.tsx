import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, Filter, X } from 'lucide-react';
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

  const openDrawer = async (id: number) => {
    setSelectedMsgId(id);
    setLoadingDetail(true);
    setMsgDetail(null);
    try {
      const res = await api.getMessageDetail(id);
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
                  <option value="QUEUED">QUEUED</option>
                  <option value="RCS_SENT">RCS SENT</option>
                  <option value="RCS_DELIVERED">RCS DELIVERED</option>
                  <option value="SMS_SENT">SMS SENT</option>
                  <option value="SMS_DELIVERED">SMS DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(0)}>
              <RefreshCw size={14} /> Refresh
            </button>
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
                const channel = getChannelFromStatus(log.status); // fallback 
                const channelDisplay = log.message_type === 'SMS' ? 'SMS' : 'RCS'; 
                
                const rcvd = log.total_dlrs > 0;
                const fwd = log.forwarded_dlrs > 0;

                return (
                  <tr key={log.id} onClick={() => openDrawer(log.id)}>
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
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Message #{selectedMsgId}</h2>
              <button className="btn btn-icon btn-secondary" onClick={closeDrawer}><X size={16} /></button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)' }}>Loading...</div>
              ) : msgDetail ? (
                <div className="timeline">
                  {/* Fake a timeline for the entire lifecycle as requested */}
                  <div className="timeline-item">
                    <span className="timeline-dot slate" />
                    <div className="timeline-content">
                      <div style={{ fontWeight: 600 }}>MoEngage Request Received</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTimestamp(msgDetail.message.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="timeline-item">
                    <span className="timeline-dot blue" />
                    <div className="timeline-content">
                      <div style={{ fontWeight: 600 }}>Queued & Accepted</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(200 OK returned to MoEngage)</p>
                    </div>
                  </div>

                  {msgDetail.dlrEvents.length === 0 && (
                     <div className="timeline-item">
                       <span className="timeline-dot slate" />
                       <div className="timeline-content">
                         <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Awaiting DLR from SPARC...</div>
                       </div>
                     </div>
                  )}

                  {msgDetail.dlrEvents.map((ev: any, idx: number) => {
                    const isFailure = ev.sparc_status.includes('FAIL') || ev.sparc_status.includes('REJECT');
                    const isSuccess = ev.sparc_status.includes('DELIVER') || ev.sparc_status.includes('READ');
                    const dotClass = isFailure ? 'red' : isSuccess ? 'green' : 'slate';

                    return (
                      <div key={ev.id} className="timeline-item">
                        <span className={`timeline-dot ${dotClass}`} />
                        <div className="timeline-content">
                          <div style={{ fontWeight: 600 }}>DLR Received from SPARC</div>
                          <p style={{ fontSize: '0.9rem', color: isFailure ? 'var(--danger)' : 'var(--text-primary)' }}>
                            Status: {ev.sparc_status}
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatTimestamp(ev.created_at)}
                          </p>
                          
                          <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                              Forwarded to MoEngage: {ev.callback_dispatched ? '✓ Yes' : '✕ No'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Mapped Status: {ev.moe_status}
                            </div>
                            {ev.error_message && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 4 }}>
                                Error: {ev.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="timeline-item">
                    <span className={`timeline-dot square ${getStatusDot(msgDetail.message.status)}`} />
                    <div className="timeline-content">
                      <div style={{ fontWeight: 600 }}>Current Final Status</div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 4 }}>
                        {msgDetail.message.status}
                      </p>
                    </div>
                  </div>
                  
                </div>
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
