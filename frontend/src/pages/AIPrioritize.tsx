import { useState } from 'react';
import { ai } from '../services/api';

export default function AIPrioritize() {
  const [context, setContext] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const r: any = await ai.prioritizeTasks(context);
      setResult(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'critical') return '#dc2626';
    if (p === 'high') return '#d97706';
    if (p === 'low') return '#6b7280';
    return '#2563eb';
  };

  return (
    <div className="container">
      <h1 className="h1">AI Task Prioritizer</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Claude analyzes your pending tasks and recommends an optimal priority order.
      </p>

      <div className="card">
        <form onSubmit={submit} className="col">
          <label className="label">Business context (optional)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Q2 product launch in 2 weeks, customer contracts are highest priority..."
            style={{ minHeight: 80 }}
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Analyzing tasks...' : 'Prioritize My Tasks'}
          </button>
        </form>
      </div>

      {result && (
        <div className="card">
          <h2 className="h2">Priority Recommendations</h2>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>{result.summary}</p>

          {result.critical_path_tasks?.length > 0 && (
            <div style={{ background: '#fef2f2', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong style={{ fontSize: 13, color: '#dc2626' }}>Critical Path Tasks</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.critical_path_tasks.map((id: string, i: number) => (
                  <li key={i} style={{ fontSize: 13 }}>{id}</li>
                ))}
              </ul>
            </div>
          )}

          {result.quick_wins?.length > 0 && (
            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong style={{ fontSize: 13, color: '#16a34a' }}>Quick Wins</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.quick_wins.map((id: string, i: number) => (
                  <li key={i} style={{ fontSize: 13 }}>{id}</li>
                ))}
              </ul>
            </div>
          )}

          {result.blockers_identified?.length > 0 && (
            <div style={{ background: '#fffbeb', padding: 12, borderRadius: 6, marginBottom: 16 }}>
              <strong style={{ fontSize: 13, color: '#d97706' }}>Blockers Identified</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.blockers_identified.map((b: string, i: number) => (
                  <li key={i} style={{ fontSize: 13 }}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Prioritized Task Order</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(result.prioritized_tasks || []).map((t: any) => (
              <div
                key={t.task_id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  borderLeft: `4px solid ${priorityColor(t.recommended_priority)}`,
                }}
              >
                <div
                  style={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: priorityColor(t.recommended_priority),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t.rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.reasoning}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span className="badge badge-info" style={{ fontSize: 10 }}>
                      priority: {t.recommended_priority}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>
                      urgency: {t.urgency}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>
                      impact: {t.impact}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 12 }}>Raw JSON</summary>
            <div className="code" style={{ fontSize: 11 }}>{JSON.stringify(result, null, 2)}</div>
          </details>
        </div>
      )}
    </div>
  );
}
