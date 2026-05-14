import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { workflows, ai } from '../services/api';

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const [wf, setWf] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotalPages, setRunsTotalPages] = useState(1);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [stepsJson, setStepsJson] = useState('');
  const [inputJson, setInputJson] = useState('{}');
  const [optimization, setOptimization] = useState<any>(null);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRuns = (p = runsPage) => {
    if (!id) return;
    workflows.runs(id, p).then((r: any) => {
      setRuns(r.items || []);
      setRunsTotal(r.total || 0);
      setRunsTotalPages(r.total_pages || 1);
    });
  };

  const load = () => {
    if (!id) return;
    workflows.get(id).then((w: any) => {
      setWf(w);
      setStepsJson(JSON.stringify(w.steps || [], null, 2));
    });
    loadRuns(1);
  };

  const loadVersions = () => {
    if (!id) return;
    workflows.versions(id).then((v: any[]) => setVersions(v));
  };

  useEffect(load, [id]);
  useEffect(() => { loadRuns(runsPage); }, [runsPage]);

  const saveSteps = async () => {
    setError('');
    try {
      const steps = JSON.parse(stepsJson);
      await workflows.update(id!, { steps });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const execute = async () => {
    setError('');
    setBusy(true);
    try {
      const input = JSON.parse(inputJson);
      await workflows.execute(id!, input);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const optimize = async () => {
    setBusy(true);
    setError('');
    try {
      const r: any = await ai.optimizeWorkflow(id!);
      setOptimization(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const summarize = async () => {
    setSummaryLoading(true);
    setError('');
    try {
      const r: any = await ai.summarizeRuns(id!);
      setRunSummary(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const retryRun = async (runId: string) => {
    setBusy(true);
    setError('');
    try {
      await workflows.retryRun(id!, runId);
      loadRuns(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const restoreVersion = async (versionNumber: number) => {
    if (!confirm(`Restore steps to version ${versionNumber}? Current steps will be saved as a new version.`)) return;
    try {
      await workflows.restoreVersion(id!, versionNumber);
      load();
      setShowVersions(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleStatus = async () => {
    if (!wf) return;
    const next = wf.status === 'active' ? 'paused' : 'active';
    await workflows.setStatus(id!, next);
    load();
  };

  if (!wf) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <Link to="/workflows">&larr; Back to Workflows</Link>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <h1 className="h1">{wf.name}</h1>
        <div className="row" style={{ gap: 8 }}>
          <span
            className={`badge badge-${wf.status === 'active' ? 'success' : wf.status === 'paused' ? 'warn' : 'gray'}`}
            style={{ alignSelf: 'center' }}
          >
            {wf.status}
          </span>
          <button className="secondary" onClick={toggleStatus}>
            {wf.status === 'active' ? 'Pause' : 'Activate'}
          </button>
        </div>
      </div>
      <p style={{ color: '#6b7280', marginBottom: 4 }}>{wf.description}</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="badge badge-gray">{wf.trigger_type || 'manual'}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          Updated {new Date(wf.updated_at).toLocaleString()}
        </span>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="grid grid-2">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">Steps Editor</h2>
            <button className="secondary" onClick={() => { loadVersions(); setShowVersions(true); }}>
              Version History
            </button>
          </div>
          <textarea
            value={stepsJson}
            onChange={(e) => setStepsJson(e.target.value)}
            style={{ minHeight: 220, fontFamily: 'monospace', fontSize: 12 }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            Step types: action, condition, delay, notification, integration
          </div>
          <button onClick={saveSteps} style={{ marginTop: 8 }}>Save Steps</button>
        </div>
        <div className="card">
          <h2 className="h2">Execute Workflow</h2>
          <label className="label">Input data (JSON)</label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12 }}
          />
          <div className="spacer" />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button onClick={execute} disabled={busy}>
              {busy ? 'Running...' : 'Execute'}
            </button>
            <button className="secondary" onClick={optimize} disabled={busy}>
              AI Optimize
            </button>
            <button className="secondary" onClick={summarize} disabled={summaryLoading}>
              {summaryLoading ? 'Summarizing...' : 'AI Run Summary'}
            </button>
          </div>
        </div>
      </div>

      {optimization && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">AI Optimization Suggestions</h2>
            <button className="secondary" onClick={() => setOptimization(null)}>Close</button>
          </div>
          {optimization.overall_assessment && (
            <p style={{ color: '#374151' }}>{optimization.overall_assessment}</p>
          )}
          {optimization.priority_action && (
            <div className="badge badge-danger" style={{ marginBottom: 12 }}>
              Priority action: {optimization.priority_action}
            </div>
          )}
          {optimization.step_recommendations?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Step Recommendations</h3>
              <ul>
                {optimization.step_recommendations.map((r: any, i: number) => (
                  <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                    <strong>{r.step}</strong>: {r.issue} → <em>{r.suggestion}</em>
                  </li>
                ))}
              </ul>
            </>
          )}
          {optimization.structural_improvements?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Structural Improvements</h3>
              <ul>
                {optimization.structural_improvements.map((s: string, i: number) => (
                  <li key={i} style={{ fontSize: 13 }}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 12 }}>Full JSON</summary>
            <div className="code">{JSON.stringify(optimization, null, 2)}</div>
          </details>
        </div>
      )}

      {runSummary && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">AI Run History Summary</h2>
            <button className="secondary" onClick={() => setRunSummary(null)}>Close</button>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {runSummary.reliability_rating && (
              <span className={`badge badge-${runSummary.reliability_rating === 'excellent' || runSummary.reliability_rating === 'good' ? 'success' : 'warn'}`}>
                {runSummary.reliability_rating}
              </span>
            )}
            {runSummary.success_rate_percent !== undefined && (
              <span className="badge badge-info">
                {runSummary.success_rate_percent}% success rate
              </span>
            )}
            {runSummary.trend && (
              <span className={`badge badge-${runSummary.trend === 'improving' ? 'success' : runSummary.trend === 'degrading' ? 'danger' : 'gray'}`}>
                Trend: {runSummary.trend}
              </span>
            )}
          </div>
          <p style={{ color: '#374151', marginBottom: 12 }}>{runSummary.summary}</p>
          {runSummary.recommendations?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginBottom: 6 }}>Recommendations</h3>
              <ol style={{ paddingLeft: 18 }}>
                {runSummary.recommendations.map((r: string, i: number) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{r}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {showVersions && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">Version History</h2>
            <button className="secondary" onClick={() => setShowVersions(false)}>Close</button>
          </div>
          {versions.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No versions saved yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Changed At</th>
                  <th>Steps</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v: any) => (
                  <tr key={v.id}>
                    <td>v{v.version_number}</td>
                    <td>{new Date(v.changed_at).toLocaleString()}</td>
                    <td>{(v.steps_snapshot || []).length} steps</td>
                    <td>
                      <button className="secondary" onClick={() => restoreVersion(v.version_number)}>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="h2">Run History ({runsTotal} total)</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Output / Error</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const duration = r.completed_at
                ? `${((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(1)}s`
                : '—';
              return (
                <tr key={r.id}>
                  <td>
                    <span
                      className={`badge badge-${
                        r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warn'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(r.started_at).toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{duration}</td>
                  <td>
                    {r.error_message ? (
                      <span style={{ color: '#dc2626', fontSize: 12 }}>{r.error_message}</span>
                    ) : (
                      <details>
                        <summary style={{ fontSize: 12, cursor: 'pointer' }}>view output</summary>
                        <pre style={{ fontSize: 11, maxHeight: 150, overflow: 'auto' }}>
                          {JSON.stringify(r.output_data || {}, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td>
                    {r.status === 'failed' && (
                      <button className="secondary" onClick={() => retryRun(r.id)} disabled={busy}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {runsTotalPages > 1 && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 8 }}>
            <button className="secondary" disabled={runsPage <= 1} onClick={() => setRunsPage(runsPage - 1)}>
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontSize: 13 }}>
              Page {runsPage} of {runsTotalPages}
            </span>
            <button className="secondary" disabled={runsPage >= runsTotalPages} onClick={() => setRunsPage(runsPage + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
