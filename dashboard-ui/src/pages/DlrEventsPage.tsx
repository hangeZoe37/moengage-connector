import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, Download } from 'lucide-react';
import { api, DlrEvent } from '../api';
import { formatTimestamp, truncate } from '../utils';

const PAGE_SIZE = 50;

export default function DlrEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedState, setSelectedState] = useState('all');

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const res = await api.getDlrEvents(PAGE_SIZE, off, undefined, selectedState);
      
      setEvents(res.events || []);
      setTotal(res.total || 0);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedState]);

  useEffect(() => { load(0); }, [load]);

  const exportCSV = () => {
    if (!events.length) return;
    const header = ['Seq ID', 'Client', 'SPARC Status', 'Mapped Status', 'Forwarded', 'Created At'];
    const rows = events.map(e => [
      e.seq_id,
      e.client_name || 'N/A',
      e.sparc_status,
      e.moe_status,
      e.forwarded ? 'Yes' : 'No',
      new Date(e.created_at).toISOString()
    ]);
    
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `dlr-tracker-${selectedState}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="card mb-24">
        <div className="card-body" style={{ padding: '14px 22px' }}>
          <div className="filter-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <select className="form-input" value={selectedState} onChange={e => setSelectedState(e.target.value)}>
                <option value="all">All Events</option>
                <option value="stuck">Stuck (Pending Forwarding)</option>
              </select>
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

      <div className="card">
        <div className="card-header" style={{ padding: '24px', borderBottom: 'none' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>DLR Tracker</h2>
          <p style={{ color: '#8b95a8', fontSize: '0.85rem', marginTop: 4 }}>
            Monitor lifecycle issues and sync anomalies.
          </p>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Seq ID</th>
                <th>Client</th>
                <th>SPARC Status</th>
                <th>Mapped Status</th>
                <th>Outcome (Forwarded)</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#5c6678' }}>
                    <RefreshCw size={18} style={{ display: 'inline', marginRight: 8 }} className="spin" />
                    Loading…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <p>No DLR records found.</p>
                    </div>
                  </td>
                </tr>
              ) : (events || []).map(ev => {
                const sparcStatus = ev.sparc_status || 'UNKNOWN';
                const isFail = sparcStatus.includes('FAIL') || sparcStatus.includes('REJECT');
                return (
                  <tr key={ev.id}>
                    <td><span className="mono">{truncate(ev.seq_id || '', 24)}</span></td>
                    <td style={{ color: '#8b95a8' }}>{ev.client_name || '—'}</td>
                    <td>
                      <span style={{ color: isFail ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 500 }}>
                        {sparcStatus}
                      </span>
                    </td>
                    <td>{ev.moe_status || '—'}</td>
                    <td>
                      <span className={`badge ${ev.forwarded ? 'badge-delivered' : 'badge-failed'}`}>
                        {ev.forwarded ? 'Yes' : 'Stuck'}
                      </span>
                    </td>
                    <td style={{ color: '#5c6678', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(ev.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span className="pagination-info">
            Page {currentPage} of {totalPages} · {total} records
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
