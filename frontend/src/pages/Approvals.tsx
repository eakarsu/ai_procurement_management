import { useEffect, useState } from 'react';
import { extras } from '../services/api';

export default function Approvals() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ subject: '', approver_id: '' });

  const refresh = async () => {
    try { const r: any = await extras.approvals.list(); setItems(r.approvals || []); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { refresh(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject) return;
    try { await extras.approvals.create({ subject: form.subject, approver_id: form.approver_id || undefined }); setForm({ subject: '', approver_id: '' }); refresh(); }
    catch (err: any) { setError(err.message); }
  };

  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    try { await extras.approvals.decide(id, decision); refresh(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div className="container">
      <h1 className="h1">Approvals</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={create} className="card">
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" style={{ width: '100%', padding: 8, marginBottom: 6 }} required />
        <input value={form.approver_id} onChange={(e) => setForm({ ...form, approver_id: e.target.value })} placeholder="Approver user id (optional)" style={{ width: '100%', padding: 8, marginBottom: 6 }} />
        <button type="submit">Request approval</button>
      </form>
      <div className="card">
        {items.length === 0 ? <p style={{ color: '#6b7280' }}>No approvals yet.</p> : items.map((a) => (
          <div key={a.id} style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
            <div><strong>{a.subject}</strong> — <em>{a.status}</em></div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>requester: {a.requester_id} → approver: {a.approver_id || '—'}</div>
            {a.status === 'pending' && (
              <div style={{ marginTop: 4 }}>
                <button onClick={() => decide(a.id, 'approved')} style={{ marginRight: 6 }}>Approve</button>
                <button onClick={() => decide(a.id, 'rejected')}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
