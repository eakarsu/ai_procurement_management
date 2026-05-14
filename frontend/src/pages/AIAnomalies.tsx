import { useEffect, useState } from 'react';
import { ai, workflows as wfApi } from '../services/api';

export default function AIAnomalies() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r: any = await wfApi.list(1, 50);
        setWorkflows(r.items || []);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!workflowId) {
      setError('Select a workflow');
      return;
    }
    setBusy(true);
    try {
      const r: any = await ai.detectAnomalies(workflowId);
      setResult(r.result);
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.includes('503') || msg.includes('ANTHROPIC_API_KEY')) {
        setError('AI is not configured (ANTHROPIC_API_KEY missing). Set it on the server and retry.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h1 className="h1">AI Anomaly Detection</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Scans recent workflow runs for duration outliers, failure bursts, and error spikes.
      </p>
      <div className="card">
        <form onSubmit={submit} className="col">
          <label className="label">Workflow</label>
          <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} required>
            <option value="">— select workflow —</option>
            {workflows.map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Scanning...' : 'Detect anomalies'}
          </button>
        </form>
      </div>
      {result && (
        <div className="card">
          <h2 className="h2">Result</h2>
          {result.summary && <p>{result.summary}</p>}
          {Array.isArray(result.anomalies) && result.anomalies.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, marginTop: 12 }}>Anomalies</h3>
              <ul>
                {result.anomalies.map((a: any, i: number) => (
                  <li key={i}>
                    <strong>{a.type}</strong> ({a.severity}): {a.description}
                  </li>
                ))}
              </ul>
            </>
          )}
          <details style={{ marginTop: 12 }}>
            <summary>Raw JSON</summary>
            <div className="code">{JSON.stringify(result, null, 2)}</div>
          </details>
        </div>
      )}
    </div>
  );
}
