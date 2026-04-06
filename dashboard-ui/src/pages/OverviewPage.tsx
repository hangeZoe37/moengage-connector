import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, MessageLog, MetricsResponse } from '../api';
import { formatTimestamp } from '../utils';

export default function OverviewPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    try {
      const [logsRes, metricsRes] = await Promise.all([
        api.getLogs(15, 0),
        api.getMetrics()
      ]);
      setLogs(logsRes.logs);
      setMetrics(metricsRes);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

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

  if (loading && logs.length === 0) {
    return (
      <div className="empty-state">
        <RefreshCw size={36} className="spin" />
        <p>Loading overview...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Metrics Snap Row */}
      {metrics && (
        <div className="metrics-snap mb-24">
          <div className="snap-item">
            <span className="snap-label">Total Volume</span>
            <span className="snap-value">{metrics.stats.total?.toLocaleString() ?? 0}</span>
          </div>
          <div className="snap-item">
            <span className="snap-label">Delivered</span>
            <span className="snap-value success">{metrics.stats.delivered?.toLocaleString() ?? 0}</span>
          </div>
          <div className="snap-item">
            <span className="snap-label">Read Rate</span>
            <span className="snap-value info">
              {metrics.stats.total ? Math.round((metrics.stats.read / metrics.stats.total) * 100) : 0}%
            </span>
          </div>
          <div className="snap-item">
            <span className="snap-label">SMS Fallback</span>
            <span className="snap-value warning">{metrics.channelStats.SMS?.toLocaleString() ?? 0}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ padding: '24px', borderBottom: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                System Overview
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Recent message logs · Last refresh: {formatTimestamp(lastRefresh.toISOString())}
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>Destination</th>
                <th>Date Sent</th>
                <th>Client</th>
                <th>Channel / Type</th>
                <th>Status</th>
                <th style={{ width: 60, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>#{log.id}</td>
                  <td style={{ fontWeight: 500 }}>{log.destination}</td>
                  <td className="text-secondary">{formatTimestamp(log.created_at)}</td>
                  <td>{log.client_name || <span className="text-muted italic">Unknown</span>}</td>
                  <td>
                    {log.message_type === 'SMS' ? (
                      <span className="badge badge-sms-channel">SMS Auth</span>
                    ) : (
                      <span className="badge badge-rcs">RCS · {log.message_type}</span>
                    )}
                  </td>
                  <td>
                    <div className="status-indicator">
                      <span className={`status-dot ${getStatusDot(log.status)}`} />
                      {log.status.toUpperCase()}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Link to={`/messages/${log.id}`} className="btn btn-secondary btn-icon btn-sm" title="View details">
                      <ExternalLink size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    No recent messages.
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
