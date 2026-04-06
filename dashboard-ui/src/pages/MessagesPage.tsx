import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Filter } from 'lucide-react';
import { api, MessageLog, Client } from '../api';
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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

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

  const load = useCallback(async (off = 0, clientId?: number) => {
    setLoading(true);
    try {
      const res = await api.getLogs(PAGE_SIZE, off, clientId);
      setLogs(res.logs);
      setTotal(res.total);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.getClients().then(r => setClients(r.clients)).catch(console.error);
    load(0, selectedClient);
  }, [load, selectedClient]);

  const filtered = search.trim()
    ? logs.filter(l =>
        l.destination?.includes(search) ||
        l.callback_data?.includes(search) ||
        l.status?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      {/* Filter bar */}
      <div className="card mb-24">
        <div className="card-body" style={{ padding: '14px 22px' }}>
          <div className="filter-bar">
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5c6678' }}
              />
              <input
                className="form-input"
                style={{ paddingLeft: 36, width: '100%' }}
                placeholder="Search destination, callback_data…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} style={{ color: '#5c6678' }} />
              <select
                className="form-input"
                value={selectedClient ?? ''}
                onChange={e => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedClient(v);
                  load(0, v);
                }}
              >
                <option value="">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(offset, selectedClient)}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {/* Header styling to match Customers' List */}
        <div className="card-header" style={{ padding: '24px', borderBottom: 'none' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Message Logs</h2>
          <p style={{ color: '#8b95a8', fontSize: '0.85rem', marginTop: 4 }}>
            {total.toLocaleString()} total records processed
          </p>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Channel</th>
                <th>Destination</th>
                <th>Client</th>
                <th>Type</th>
                <th>Status</th>
                <th>Callback Data</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#5c6678' }}>
                    <RefreshCw size={18} style={{ display: 'inline', marginRight: 8 }} />
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p>No messages found</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(log => {
                const channel = getChannelFromStatus(log.status);
                return (
                  <tr key={log.id} onClick={() => navigate(`/messages/${log.id}`)}>
                    <td><span className="mono">#{log.id}</span></td>
                    <td>
                      <span className={`badge badge-channel ${channel === 'SMS' ? 'badge-sms-channel' : 'badge-rcs'}`}>
                        {channel === 'UNKNOWN' ? '—' : channel}
                      </span>
                    </td>
                    <td><span className="mono">{log.destination || '—'}</span></td>
                    <td style={{ color: '#8b95a8' }}>{log.client_name || `#${log.client_id}`}</td>
                    <td style={{ color: '#8b95a8' }}>{log.message_type || '—'}</td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${getStatusDot(log.status)}`} />
                        {log.status?.replace(/_/g, ' ') || '—'}
                      </div>
                    </td>
                    <td><span className="mono">{truncate(log.callback_data, 22)}</span></td>
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
              onClick={() => load(Math.max(0, offset - PAGE_SIZE), selectedClient)}
            >
              ← Prev
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => load(offset + PAGE_SIZE, selectedClient)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
