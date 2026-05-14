import { useEffect, useState } from 'react';
import { ai, workflows as workflowsApi } from '../services/api';

export default function AIProcessMining() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workflowsApi.list(1, 100).then((r: any) => setWorkflows(r?.items || r?.workflows || [])).catch(() => {});
  }, []);

  const submit = async () => {
    setError(''); setResult(null); setBusy(true);
    try {
      const r: any = await ai.processMining(workflowId);
      setResult(r.result);
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.includes('503') || msg.includes('ANTHROPIC_API_KEY')) setError('AI is not configured (ANTHROPIC_API_KEY missing).');
      else setError(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="container">
      <h1 className="h1">Process Mining</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>Discover common paths, slow steps, and rework loops from your workflow runs.</p>
      <div className="card">
        <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }}>
          <option value="">— select a workflow —</option>
          {workflows.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {error && <div className="error">{error}</div>}
        <button onClick={submit} disabled={busy || !workflowId}>{busy ? 'Mining…' : 'Run process mining'}</button>
      </div>
      {result && (
        <div className="card">
          <h2 className="h2">Results</h2>
          {result.summary && <p>{result.summary}</p>}
          <details><summary>Raw</summary><pre className="code">{JSON.stringify(result, null, 2)}</pre></details>
        </div>
      )}
    </div>
  );
}
