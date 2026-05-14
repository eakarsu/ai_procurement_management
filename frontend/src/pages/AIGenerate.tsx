import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ai, workflows } from '../services/api';

export default function AIGenerate() {
  const [goal, setGoal] = useState('');
  const [constraintsText, setConstraintsText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [savedId, setSavedId] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    setResult(null);
    setSavedMsg('');
    try {
      const constraints = constraintsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const r: any = await ai.generateWorkflow(goal, constraints);
      setResult(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAsWorkflow = async () => {
    if (!result) return;
    try {
      const wf: any = await workflows.create({
        name: result.workflow_name || 'AI Generated Workflow',
        description: result.description,
        trigger_type: result.trigger_type || 'manual',
        trigger_config: result.trigger_config || {},
        steps: result.steps || [],
      });
      setSavedMsg(`Saved as workflow ${wf.id} — click to view`);
      setSavedId(wf.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <h1 className="h1">AI Workflow Generator</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Describe a business goal; Claude generates a complete workflow definition you can save.
      </p>
      <div className="card">
        <form onSubmit={submit} className="col">
          <label className="label">Business Goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            required
            style={{ minHeight: 100 }}
            placeholder="e.g. Onboard a new customer end-to-end including KYC, account setup, and welcome communication"
          />
          <label className="label">Constraints (one per line)</label>
          <textarea
            value={constraintsText}
            onChange={(e) => setConstraintsText(e.target.value)}
            placeholder="Must complete in under 24 hours&#10;Use Slack for notifications"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Generating...' : 'Generate Workflow'}
          </button>
        </form>
      </div>
      {result && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="h2">{result.workflow_name}</h2>
            <button onClick={saveAsWorkflow}>Save as Workflow</button>
          </div>
          {savedMsg && (
            <div className="success">
              {savedMsg}{' '}
              {savedId && <Link to={`/workflows/${savedId}`}>View workflow →</Link>}
            </div>
          )}
          <p style={{ color: '#6b7280' }}>{result.description}</p>
          <div className="row">
            <span className="badge badge-info">Trigger: {result.trigger_type}</span>
            {result.estimated_duration_minutes && (
              <span className="badge badge-gray">~{result.estimated_duration_minutes} min</span>
            )}
          </div>
          <h3 style={{ marginTop: 16, fontSize: 15 }}>Steps</h3>
          <ol>
            {(result.steps || []).map((s: any, i: number) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong>{s.name}</strong> <span className="badge badge-gray">{s.type}</span>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{s.description}</div>
              </li>
            ))}
          </ol>
          {result.required_integrations && result.required_integrations.length > 0 && (
            <>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>Required Integrations</h3>
              <ul>
                {result.required_integrations.map((it: string, i: number) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </>
          )}
          <details style={{ marginTop: 16 }}>
            <summary>Raw JSON</summary>
            <div className="code">{JSON.stringify(result, null, 2)}</div>
          </details>
        </div>
      )}
    </div>
  );
}
