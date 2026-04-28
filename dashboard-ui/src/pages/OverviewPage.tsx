import { useEffect, useState } from 'react';
import { RefreshCw, Calendar, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, MetricsResponse } from '../api';
import { formatTimestamp } from '../utils';

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [datePreset, setDatePreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const connector = localStorage.getItem('currentConnector') || 'MOENGAGE';
  const isWebEngage = connector === 'WEBENGAGE';
  const navigate = useNavigate();

  const load = async () => {
    try {
      let from: string | undefined = undefined;
      let to: string | undefined = undefined;

      const format = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const today = new Date();

      if (datePreset === '30days') {
        const p = new Date(today);
        p.setDate(p.getDate() - 30);
        from = format(p);
        to = format(today);
      } else if (datePreset === '60days') {
        const p = new Date(today);
        p.setDate(p.getDate() - 60);
        from = format(p);
        to = format(today);
      } else if (datePreset === 'custom') {
        from = customFrom || undefined;
        to = customTo || undefined;
      }

      const metricsRes = await api.getMetrics(from, to);
      // Due to the type casting in api.ts, it returns the correct shape
      setMetrics(metricsRes as unknown as MetricsResponse);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [datePreset, customFrom, customTo]);

  const exportCSV = () => {
    if (!metrics?.clients.length) return;
    const header = ['Client Name', 'RCS Sent', 'SMS Fallback', 'Failed', 'DLRs Received', 'Fallback Rate %'];
    const rows = metrics.clients.map(c => [
      `"${c.client_name}"`,
      c.rcs_sent,
      c.sms_fallback,
      c.failed,
      c.dlrs_received,
      c.fallback_rate.toFixed(1)
    ]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `client-overview-${datePreset}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !metrics) {
    return (
      <div className="empty-state">
        <RefreshCw size={36} className="spin" />
        <p>Loading overview...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px', gap: '8px' }}>
        <div className="date-select-wrapper">
          <select
            className="form-input date-select"
            value={datePreset}
            onChange={e => setDatePreset(e.target.value)}
            style={{ padding: '6px 32px 6px 12px', fontSize: '0.85rem' }}
          >
            <option value="today">Today</option>
            <option value="30days">Last 30 Days</option>
            <option value="60days">Last 60 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          <Calendar className="calendar-icon" size={14} />
        </div>

        {datePreset === 'custom' && (
          <>
            <input
              type="date"
              className="form-input"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>to</span>
            <input
              type="date"
              className="form-input"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </>
        )}

        <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginLeft: '4px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button className="btn btn-primary btn-sm" onClick={exportCSV} style={{ marginLeft: '4px' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* 5 Stat Cards */}
      {metrics && (
        <div className="kpi-grid">
          <div className="kpi-card violet">
            <div className="kpi-label">Total Messages Received</div>
            <div className="kpi-value violet">{(metrics?.stats.total_received ?? 0).toLocaleString()}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">RCS Sent Successfully</div>
            <div className="kpi-value green">{(metrics?.stats.rcs_sent ?? 0).toLocaleString()}</div>
          </div>
          {!isWebEngage && (
            <div className="kpi-card amber">
              <div className="kpi-label">SMS Fallback Triggered</div>
              <div className="kpi-value amber">{(metrics?.stats.sms_fallback ?? 0).toLocaleString()}</div>
            </div>
          )}
          <div className="kpi-card cyan">
            <div className="kpi-label">DLRs Received</div>
            <div className="kpi-value cyan">{(metrics?.stats.dlrs_received ?? 0).toLocaleString()}</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Terminal Failures</div>
            <div className="kpi-value red">{(metrics?.stats.terminal_failures ?? 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ padding: '24px', borderBottom: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Client Overview
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Numbers per client · Last refresh: {formatTimestamp(lastRefresh.toISOString())}
              </p>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>RCS Sent</th>
                {!isWebEngage && <th>SMS Fallback</th>}
                <th>Failed</th>
                <th>DLRs Received</th>
                {!isWebEngage && <th>Fallback Rate %</th>}
              </tr>
            </thead>
            <tbody>
              {metrics?.clients.map((c: any) => {
                const isAmber = c.fallback_rate > 30;
                const isRed = c.failed > 0;
                let bgRule = '';
                if (isRed) bgRule = 'rgba(239, 68, 68, 0.08)';
                else if (isAmber) bgRule = 'rgba(245, 158, 11, 0.08)';

                return (
                  <tr
                    key={c.client_id}
                    onClick={() => navigate(`/messages?clientId=${c.client_id}`)}
                    style={{ background: bgRule }}
                  >
                    <td style={{ fontWeight: 600 }}>{c.client_name}</td>
                    <td>{c.rcs_sent.toLocaleString()}</td>
                    {!isWebEngage && <td>{c.sms_fallback.toLocaleString()}</td>}
                    <td>{c.failed.toLocaleString()}</td>
                    <td>{c.dlrs_received.toLocaleString()}</td>
                    {!isWebEngage && (
                      <td>
                        <span style={{
                          color: c.fallback_rate > 30 ? '#f59e0b' : 'inherit',
                          fontWeight: c.fallback_rate > 30 ? 600 : 400
                        }}>
                          {c.fallback_rate.toFixed(1)}%
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
              {metrics?.clients.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    No operations on the selected date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
