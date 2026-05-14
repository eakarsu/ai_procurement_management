import { useEffect, useState } from 'react';
import { tasks, ai } from '../services/api';

export default function Tasks() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiPriority, setAiPriority] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const PAGE_SIZE = 20;

  const load = (p = page) => {
    tasks
      .list({
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        search: search || undefined,
        page: p,
        page_size: PAGE_SIZE,
      })
      .then((r: any) => {
        setItems(r.items || []);
        setTotal(r.total || 0);
        setTotalPages(r.total_pages || 1);
      });
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [filterStatus, filterPriority, search]);

  useEffect(() => {
    load(page);
  }, [page]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await tasks.create({ title, description, priority, due_date: dueDate || undefined });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setShowCreate(false);
      load(1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await tasks.update(id, { status: newStatus });
    load(page);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await tasks.remove(id);
    load(page);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const bulkComplete = async () => {
    if (selectedIds.size === 0) return;
    await tasks.bulkUpdate([...selectedIds], { status: 'completed' });
    setSelectedIds(new Set());
    load(page);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} tasks?`)) return;
    await tasks.bulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    load(page);
  };

  const runAiPriority = async () => {
    setAiLoading(true);
    setError('');
    try {
      const r: any = await ai.prioritizeTasks();
      setAiPriority(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const priorityBadge = (p: string) => {
    const cls = p === 'critical' ? 'danger' : p === 'high' ? 'warn' : p === 'low' ? 'gray' : 'info';
    return <span className={`badge badge-${cls}`}>{p}</span>;
  };

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="h1">Tasks <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 400 }}>({total} total)</span></h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="secondary" onClick={runAiPriority} disabled={aiLoading}>
            {aiLoading ? 'Thinking...' : 'AI Prioritize'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ New Task'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="card">
          <h2 className="h2">Create Task</h2>
          <form onSubmit={create} className="col">
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="row">
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit">Create</button>
          </form>
        </div>
      )}

      {aiPriority && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">AI Priority Recommendations</h2>
            <button className="secondary" onClick={() => setAiPriority(null)}>Close</button>
          </div>
          <p style={{ color: '#6b7280', marginBottom: 12 }}>{aiPriority.summary}</p>
          {aiPriority.critical_path_tasks?.length > 0 && (
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, marginRight: 6 }}>Critical Path:</span>
              {aiPriority.critical_path_tasks.map((id: string) => (
                <span key={id} className="badge badge-danger">{id.slice(0, 8)}...</span>
              ))}
            </div>
          )}
          <ol style={{ paddingLeft: 20 }}>
            {(aiPriority.prioritized_tasks || []).slice(0, 10).map((t: any) => (
              <li key={t.task_id} style={{ marginBottom: 8 }}>
                <strong>{t.title}</strong>
                {' '}{priorityBadge(t.recommended_priority)}
                <div style={{ fontSize: 12, color: '#6b7280' }}>{t.reasoning}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="row" style={{ background: '#f0f9ff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, gap: 8 }}>
            <span style={{ fontSize: 13 }}>{selectedIds.size} selected</span>
            <button className="secondary" onClick={bulkComplete}>Mark Complete</button>
            <button className="danger" onClick={bulkDelete}>Delete Selected</button>
            <button className="secondary" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(items.map((t) => t.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th>Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                  />
                </td>
                <td>{t.title}</td>
                <td>{priorityBadge(t.priority)}</td>
                <td>
                  <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </td>
                <td>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                <td>
                  <button className="danger" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No tasks found.
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
