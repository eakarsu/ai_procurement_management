import { useState } from 'react';
import { ai } from '../services/api';

export default function AISuggestRules() {
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const r: any = await ai.suggestAutomationRules();
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
      <h1 className="h1">AI Automation Rule Suggestions</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Reviews your workflows, recent tasks, and existing rules to propose new automation rules.
      </p>
      <div className="card">
        <form onSubmit={submit} className="col">
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Suggesting...' : 'Suggest rules'}
          </button>
        </form>
      </div>
      {result && (
        <div className="card">
          <h2 className="h2">Suggestions</h2>
          {result.summary && <p>{result.summary}</p>}
          {Array.isArray(result.suggested_rules) && result.suggested_rules.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, marginTop: 12 }}>Suggested Rules</h3>
              <ul>
                {result.suggested_rules.map((r: any, i: number) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <div><strong>{r.name}</strong> <span className="badge badge-info">{r.priority}</span></div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Trigger: {r.trigger_event}</div>
                    {r.rationale && <div style={{ fontSize: 13 }}>{r.rationale}</div>}
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
