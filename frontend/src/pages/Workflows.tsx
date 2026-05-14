import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflows } from '../services/api';

export default function Workflows() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('manual');
  const [error, setError] = useState('');
  const PAGE_SIZE = 20;

  const load = (p = page) => {
    workflows
      .list(p, PAGE_SIZE, {
        search: search || undefined,
        status: statusFilter || undefined,
      })
      .then((r: any) => {
        setItems(r.items || []);
        setTotal(r.total || 0);
        setTotalPages(r.total_pages || 1);
      })
      .catch(() => {});
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, statusFilter]);

  useEffect(() => {
    load(page);
  }, [page]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await workflows.create({
        name,
        description,
        trigger_type: trigger,
        trigger_config: {},
        steps: [],
      });
      setShowCreate(false);
      setName('');
      setDescription('');
      load(1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    await workflows.remove(id);
    load(page);
  };

  const toggleStatus = async (wf: any) => {
    const next = wf.status === 'active' ? 'paused' : 'active';
    await workflows.setStatus(wf.id, next);
    load(page);
  };

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="h1">Workflows <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 400 }}>({total} total)</span></h1>
        <button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Workflow'}
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <h2 className="h2">Create Workflow</h2>
          <form onSubmit={create} className="col">
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
              <option value="event">Event-driven</option>
            </select>
            {error && <div className="error">{error}</div>}
            <button type="submit">Create</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ gap: 12, marginBottom: 12 }}>
          <input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Steps</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td>
                  <Link to={`/workflows/${w.id}`}>{w.name}</Link>
                </td>
                <td>{w.trigger_type || '-'}</td>
                <td>
                  <span
                    className={`badge badge-${
                      w.status === 'active' ? 'success' : w.status === 'paused' ? 'warn' : 'gray'
                    }`}
                  >
                    {w.status}
                  </span>
                </td>
                <td>{(w.steps || []).length}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary" onClick={() => toggleStatus(w)}>
                    {w.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                  <button className="danger" onClick={() => remove(w.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No workflows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 8 }}>
            <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontSize: 13 }}>
              Page {page} of {totalPages}
            </span>
            <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
