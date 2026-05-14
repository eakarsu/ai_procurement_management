import { useEffect, useState } from 'react';
import { extras } from '../services/api';

export default function TaskDependencies() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ task_id: '', depends_on_task_id: '' });

  const refresh = async () => {
    try { const r: any = await extras.taskDeps.list(); setItems(r.dependencies || []); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { refresh(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await extras.taskDeps.add(form.task_id, form.depends_on_task_id); setForm({ task_id: '', depends_on_task_id: '' }); refresh(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div className="container">
      <h1 className="h1">Task Dependencies</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={add} className="card">
        <input value={form.task_id} onChange={(e) => setForm({ ...form, task_id: e.target.value })} placeholder="task id" style={{ width: '100%', padding: 8, marginBottom: 6 }} required />
        <input value={form.depends_on_task_id} onChange={(e) => setForm({ ...form, depends_on_task_id: e.target.value })} placeholder="depends on task id" style={{ width: '100%', padding: 8, marginBottom: 6 }} required />
        <button type="submit">Add dependency</button>
      </form>
      <div className="card">
        {items.length === 0 ? <p style={{ color: '#6b7280' }}>No dependencies.</p> : items.map((d) => (
          <div key={d.id} style={{ padding: 6, borderBottom: '1px solid #e5e7eb' }}>
            <code>{d.task_id}</code> depends on <code>{d.depends_on_task_id}</code>
            <button onClick={() => extras.taskDeps.remove(d.id).then(refresh).catch((e) => setError(e.message))} style={{ marginLeft: 12 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
