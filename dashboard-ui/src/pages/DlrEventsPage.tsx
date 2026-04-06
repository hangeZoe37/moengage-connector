import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { api, DlrEvent, Client } from '../api';
import { getStatusBadgeClass, formatTimestamp, truncate } from '../utils';

const PAGE_SIZE = 30;

export default function DlrEventsPage() {
  const [events, setEvents]  = useState<DlrEvent[]>([]);
  const [total, setTotal]    = useState(0);
  const [offset, setOffset]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState<Client[]>([]);

  const getDotColor = (s?: string) => {
    if (!s) return 'slate';
    const l = s.toLowerCase();
    if (l.includes('deliver')) return 'green';
    if (l.includes('fail') || l.includes('reject')) return 'red';
    if (l.includes('read')) return 'cyan';
    if (l.includes('sent')) return 'blue';
    return 'slate';
  };

  const loadClients = async () => {
    try {
      const res = await api.getClients();
      setClients(res.clients);
    } catch {}
  };

  const load = useCallback(async (off = 0, cid = clientFilter) => {
    setLoading(true);
    try {
      const res = await api.getDlrEvents(PAGE_SIZE, off, cid ? Number(cid) : undefined);
      setEvents(res.events);
      setTotal(res.total);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clientFilter]);

  useEffect(() => { 
    loadClients();
    load(0); 
  }, [load]);

  const filtered = statusFilter
    ? events.filter(e => e.sparc_status?.toLowerCase().includes(statusFilter.toLowerCase()))
    : events;

  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Unique statuses for dropdown
  const statuses = [...new Set(events.map(e => e.sparc_status).filter(Boolean))];

  return (
    <div>
      {/* Filter bar */}
      <div className="card mb-24">
        <div className="card-body" style={{ padding: '14px 22px' }}>
          <div className="filter-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={15} style={{ color: '#5c6678' }} />
                <select
                  className="form-input"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {statuses.map(s => (
                    <option key={s} value={s}>{s?.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  className="form-input"
                  value={clientFilter}
                  onChange={e => {
                    setClientFilter(e.target.value);
                    load(0, e.target.value);
                  }}
                >
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.client_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => load(0)}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>DLR Events</h2>
          <span style={{ fontSize: '0.82rem', color: '#5c6678' }}>{total.toLocaleString()} total</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Callback Data</th>
                <th>SPARC Status</th>
                <th>MoE Status</th>
                <th>Dispatched</th>
                <th>Client</th>
                <th>Error</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#5c6678' }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p>No DLR events found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(ev => (
                  <tr key={ev.id}>
                    <td><span className="mono">#{ev.id}</span></td>
                    <td><span className="mono" style={{ color: '#8b95a8' }}>{truncate(ev.callback_data, 22)}</span></td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${getDotColor(ev.sparc_status)}`} />
                        {ev.sparc_status?.replace(/_/g, ' ') || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${getDotColor(ev.moe_status)}`} />
                        {ev.moe_status?.replace(/_/g, ' ') || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot ${ev.callback_dispatched ? 'green' : 'slate'}`} />
                        {ev.callback_dispatched ? 'Yes' : 'No'}
                      </div>
                    </td>
                    <td style={{ color: '#8b95a8' }}>
                      {ev.client_name || '—'}
                    </td>
                    <td style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                      {ev.error_message ? truncate(ev.error_message, 30) : '—'}
                    </td>
                    <td style={{ color: '#5c6678', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {ev.event_timestamp
                        ? formatTimestamp(new Date(ev.event_timestamp * 1000).toISOString())
                        : formatTimestamp(ev.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
