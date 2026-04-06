import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { api, Client } from '../api';
import { formatTimestamp } from '../utils';

interface FormState {
  client_name: string;
  rcs_username: string;
  rcs_password: string;
  sms_username: string;
  sms_password: string;
  rcs_assistant_id: string;
}

const EMPTY_FORM: FormState = {
  client_name: '',
  rcs_username: '',
  rcs_password: '',
  sms_username: '',
  sms_password: '',
  rcs_assistant_id: '',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await api.getClients();
      setClients(res.clients);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openCreate = () => {
    setEditClient(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setForm({
      client_name: c.client_name,
      rcs_username: c.rcs_username || '',
      rcs_password: '',
      sms_username: c.sms_username || '',
      sms_password: '',
      rcs_assistant_id: c.rcs_assistant_id || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.client_name.trim()) {
      setError('Client name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Strip empty optional fields before sending
      const payload: Record<string, string> = { client_name: form.client_name };
      (['rcs_username', 'rcs_password', 'sms_username', 'sms_password', 'rcs_assistant_id'] as const).forEach(k => {
        if (form[k]) payload[k] = form[k];
      });

      if (editClient) {
        await api.updateClient(editClient.id, payload);
        showToast('Client updated successfully');
      } else {
        await api.onboardClient(payload);
        showToast('Client created successfully');
      }
      setModalOpen(false);
      loadClients();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Client) => {
    if (!confirm(`Permanently delete "${c.client_name}"? All related data and future calls will fail.`)) return;
    try {
      await api.deactivateClient(c.id);
      showToast('Client deleted');
      loadClients();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>{toast.msg}</div>
        </div>
      )}

      <div className="flex-between mb-24">
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Customers' List</h2>
          <p style={{ color: '#8b95a8', fontSize: '0.85rem', marginTop: 4 }}>
            Onboard and manage SPARC-connected clients
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Client
        </button>
        {/* Table Wrapping Box to look like the design */}
      </div>
      <div className="card" style={{ paddingTop: '24px' }}>

      {/* Table */}
        <div style={{ overflowX: 'auto', padding: '0 24px 24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Full Name</th>
                <th>RCS User</th>
                <th>SMS User</th>
                <th>Assistant ID</th>
                <th>Bearer Token</th>
                <th>Status</th>
                <th>Date Added</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#5c6678' }}>Loading…</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state"><p>No clients onboarded yet</p></div>
                </td></tr>
              ) : (
                clients.map(c => (
                  <tr key={c.id} style={{ cursor: 'default' }}>
                    <td><span className="mono">#{c.id}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.client_name}</td>
                    <td><span className="mono">{c.rcs_username || '—'}</span></td>
                    <td><span className="mono">{c.sms_username || '—'}</span></td>
                    <td><span className="mono" style={{ fontSize: '0.75rem' }}>{c.rcs_assistant_id || '—'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mono" style={{ fontSize: '0.7rem' }}>
                          {showPasswords[`token-${c.id}`]
                            ? c.bearer_token
                            : c.bearer_token.slice(0, 8) + '••••••••'}
                        </span>
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ width: 24, height: 24 }}
                          onClick={() => togglePassword(`token-${c.id}`)}
                        >
                          {showPasswords[`token-${c.id}`] ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className="status-dot green" />
                        Approved
                      </div>
                    </td>
                    <td style={{ color: '#5c6678', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(c.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(c)} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(c)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-container">
            <div className="modal-header">
              <h2>{editClient ? 'Edit Client' : 'Add New Client'}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="toast error" style={{ marginBottom: 16, position: 'static' }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Acme Corp"
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                />
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8b95a8', margin: '16px 0 8px', borderTop: '1px solid #1e2a3a', paddingTop: 16 }}>
                RCS Credentials
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">RCS Username</label>
                  <input className="form-input" placeholder="sparc_rcs_user" value={form.rcs_username} onChange={e => setForm(f => ({ ...f, rcs_username: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">RCS Password {editClient && <span className="text-muted">(leave blank to keep)</span>}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={form.rcs_password} onChange={e => setForm(f => ({ ...f, rcs_password: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">RCS Assistant ID</label>
                <input className="form-input" placeholder="asst_xxxxxxxx" value={form.rcs_assistant_id} onChange={e => setForm(f => ({ ...f, rcs_assistant_id: e.target.value }))} />
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8b95a8', margin: '16px 0 8px', borderTop: '1px solid #1e2a3a', paddingTop: 16 }}>
                SMS Credentials (Fallback)
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SMS Username</label>
                  <input className="form-input" placeholder="sparc_sms_user" value={form.sms_username} onChange={e => setForm(f => ({ ...f, sms_username: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">SMS Password {editClient && <span className="text-muted">(leave blank to keep)</span>}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={form.sms_password} onChange={e => setForm(f => ({ ...f, sms_password: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editClient ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
