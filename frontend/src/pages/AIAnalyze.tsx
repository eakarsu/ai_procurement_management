import { useState } from 'react';
import { ai } from '../services/api';

export default function AIAnalyze() {
  const [process, setProcess] = useState('');
  const [goalsText, setGoalsText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const goals = goalsText.split('\n').map((s) => s.trim()).filter(Boolean);
      const r: any = await ai.analyzeProcess(process, goals);
      setResult(r.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h1 className="h1">AI Process Analysis</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Describe a business process; Claude analyzes inefficiencies, bottlenecks, and automation opportunities.
      </p>
      <div className="card">
        <form onSubmit={submit} className="col">
          <label className="label">Process description</label>
          <textarea
            value={process}
            onChange={(e) => setProcess(e.target.value)}
            required
            style={{ minHeight: 120 }}
            placeholder="Describe the current business process step-by-step..."
          />
          <label className="label">Goals (one per line)</label>
          <textarea
            value={goalsText}
            onChange={(e) => setGoalsText(e.target.value)}
            placeholder="Reduce processing time&#10;Eliminate manual handoffs"
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Analyzing...' : 'Analyze with Claude'}
          </button>
        </form>
      </div>
      {result && (
        <div className="card">
          <h2 className="h2">Analysis Result</h2>
          {result.complexity_score && (
            <div className="row">
              <span className="badge badge-info">Complexity: {result.complexity_score}</span>
              {typeof result.estimated_time_savings_percent === 'number' && (
                <span className="badge badge-success">Est. time savings: {result.estimated_time_savings_percent}%</span>
              )}
            </div>
          )}
          <div className="spacer" />
          {result.inefficiencies && (
            <>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>Inefficiencies</h3>
              <ul>
                {result.inefficiencies.map((it: string, i: number) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </>
          )}
          {result.bottlenecks && (
            <>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>Bottlenecks</h3>
              <ul>
                {result.bottlenecks.map((it: string, i: number) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </>
          )}
          {result.automation_opportunities && (
            <>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>Automation Opportunities</h3>
              <ul>
                {result.automation_opportunities.map((it: string, i: number) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </>
          )}
          {result.priority_recommendations && (
            <>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>Priority Recommendations</h3>
              <ol>
                {result.priority_recommendations.map((it: string, i: number) => (
                  <li key={i}>{it}</li>
                ))}
              </ol>
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
