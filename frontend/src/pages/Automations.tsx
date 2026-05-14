import { useEffect, useState } from 'react';
import { automations } from '../services/api';

export default function Automations() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<any>(null);
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [conditionsJson, setConditionsJson] = useState('[]');
  const [actionsJson, setActionsJson] = useState('[]');
  const [testRule, setTestRule] = useState<any>(null);
  const [testData, setTestData] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsRule, setLogsRule] = useState<any>(null);
  const [error, setError] = useState('');
  const PAGE_SIZE = 20;

  const load = (p = page) => {
    automations
      .list({ page: p })
      .then((r: any) => {
        setItems(r.items || []);
        setTotal(r.total || 0);
        setTotalPages(r.total_pages || 1);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const resetForm = () => {
    setName('');
    setTriggerEvent('');
    setConditionsJson('[]');
    setActionsJson('[]');
    setEditRule(null);
  };

  const openEdit = (rule: any) => {
    setEditRule(rule);
    setName(rule.name);
    setTriggerEvent(rule.trigger_event);
    setConditionsJson(JSON.stringify(rule.conditions || [], null, 2));
    setActionsJson(JSON.stringify(rule.actions || [], null, 2));
    setShowCreate(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = {
        name,
        trigger_event: triggerEvent,
        conditions: JSON.parse(conditionsJson),
        actions: JSON.parse(actionsJson),
        is_active: true,
      };
      if (editRule) {
        await automations.update(editRule.id, data);
      } else {
        await automations.create(data);
      }
      setShowCreate(false);
      resetForm();
      load(1);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggle = async (id: string) => {
    await automations.toggle(id);
    load(page);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this automation rule?')) return;
    await automations.remove(id);
    load(page);
  };

  const runTest = async () => {
    setTestResult(null);
    try {
      const result = await automations.test(testRule.id, JSON.parse(testData));
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ error: err.message });
    }
  };

  const viewLogs = async (rule: any) => {
    setLogsRule(rule);
    const l = await automations.logs(rule.id);
    setLogs(Array.isArray(l) ? l : []);
  };

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="h1">Automation Rules <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 400 }}>({total} total)</span></h1>
        <button onClick={() => { resetForm(); setShowCreate(!showCreate); }}>
          {showCreate ? 'Cancel' : '+ New Rule'}
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <h2 className="h2">{editRule ? `Edit: ${editRule.name}` : 'Create Automation Rule'}</h2>
          <form onSubmit={submit} className="col">
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input
              placeholder="Trigger Event (e.g. workflow.completed)"
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              required
            />
            <label className="label">Conditions JSON (array)</label>
            <textarea
              value={conditionsJson}
              onChange={(e) => setConditionsJson(e.target.value)}
              placeholder='[{"field":"status","operator":"eq","value":"completed"}]'
              style={{ fontFamily: 'monospace', minHeight: 80 }}
            />
            <label className="label">Actions JSON (array)</label>
            <textarea
              value={actionsJson}
              onChange={(e) => setActionsJson(e.target.value)}
              placeholder='[{"type":"notify","channel":"email","message":"Automation triggered"}]'
              style={{ fontFamily: 'monospace', minHeight: 80 }}
            />
            {error && <div className="error">{error}</div>}
            <button type="submit">{editRule ? 'Save Changes' : 'Create'}</button>
          </form>

          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            <strong>Action types:</strong> notify, webhook, create_task, log<br />
            <strong>Operators:</strong> eq, neq, gt, lt, gte, lte, contains, exists
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Active</th>
              <th>Conditions</th>
              <th>Actions</th>
              <th>Last Triggered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td><code style={{ fontSize: 12 }}>{a.trigger_event}</code></td>
                <td>
                  <span className={`badge badge-${a.is_active ? 'success' : 'gray'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{(a.conditions || []).length}</td>
                <td>{(a.actions || []).length}</td>
                <td style={{ fontSize: 12 }}>
                  {a.last_triggered_at ? new Date(a.last_triggered_at).toLocaleString() : 'Never'}
                </td>
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="secondary" onClick={() => toggle(a.id)}>
                    {a.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button className="secondary" onClick={() => openEdit(a)}>Edit</button>
                  <button
                    className="secondary"
                    onClick={() => { setTestRule(a); setTestResult(null); }}
                  >
                    Test
                  </button>
                  <button className="secondary" onClick={() => viewLogs(a)}>Logs</button>
                  <button className="danger" onClick={() => remove(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No automation rules.
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

      {testRule && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">Test Rule: {testRule.name}</h2>
            <button className="secondary" onClick={() => setTestRule(null)}>Close</button>
          </div>
          <label className="label">Test data (JSON)</label>
          <textarea value={testData} onChange={(e) => setTestData(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <div className="spacer" />
          <button onClick={runTest}>Run Dry-Run</button>
          {testResult && (
            <div style={{ marginTop: 12 }}>
              <div
                className={`badge badge-${testResult.conditions_met ? 'success' : 'danger'}`}
                style={{ marginBottom: 8 }}
              >
                Conditions: {testResult.conditions_met ? 'MET' : 'NOT MET'}
              </div>
              {testResult.actions_that_would_run?.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Actions that would fire:</div>
                  <ul>
                    {testResult.actions_that_would_run.map((a: any, i: number) => (
                      <li key={i} style={{ fontSize: 13 }}>{JSON.stringify(a)}</li>
                    ))}
                  </ul>
                </>
              )}
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12, cursor: 'pointer' }}>Full result JSON</summary>
                <div className="code" style={{ marginTop: 4 }}>{JSON.stringify(testResult, null, 2)}</div>
              </details>
            </div>
          )}
        </div>
      )}

      {logsRule && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">Logs: {logsRule.name}</h2>
            <button className="secondary" onClick={() => setLogsRule(null)}>Close</button>
          </div>
          {logs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No execution logs yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Executed At</th>
                  <th>Event</th>
                  <th>Conditions Met</th>
                  <th>Actions</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{new Date(l.executed_at).toLocaleString()}</td>
                    <td><code style={{ fontSize: 11 }}>{l.trigger_event}</code></td>
                    <td>
                      <span className={`badge badge-${l.conditions_met ? 'success' : 'gray'}`}>
                        {l.conditions_met ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{(l.actions_executed || []).length}</td>
                    <td style={{ fontSize: 12, color: '#dc2626' }}>{l.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
