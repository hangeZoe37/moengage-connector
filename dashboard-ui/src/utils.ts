/**
 * Status badge + channel badge helpers used throughout the app.
 */

export function getStatusBadgeClass(status: string): string {
  if (!status) return 'badge-unknown';
  const s = status.toLowerCase();
  if (s.includes('read'))      return 'badge-read';
  if (s.includes('delivered') && !s.includes('fail')) return 'badge-delivered';
  if (s.includes('fail'))      return 'badge-failed';
  if (s.includes('sent') && s.startsWith('sms'))     return 'badge-sms';
  if (s.includes('sent'))      return 'badge-sent';
  if (s === 'queued')          return 'badge-queued';
  return 'badge-unknown';
}

export function getChannelFromStatus(status: string): 'RCS' | 'SMS' | 'UNKNOWN' {
  if (!status) return 'UNKNOWN';
  if (status.startsWith('SMS_')) return 'SMS';
  if (status.startsWith('RCS_') || status === 'QUEUED') return 'RCS';
  return 'UNKNOWN';
}

export function getTimelineDotClass(status: string): string {
  if (!status) return 'queued';
  const s = status.toLowerCase();
  if (s.includes('read'))       return 'read';
  if (s.includes('delivered') && !s.includes('fail')) return 'delivered';
  if (s.includes('fail'))       return 'failed';
  if (s.includes('sms'))        return 'sms';
  if (s.includes('sent'))       return 'sent';
  return 'queued';
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function truncate(str: string, max = 20): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
