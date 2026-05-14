import { useState } from 'react';
import { ai } from '../services/api';

type Turn = { role: 'user' | 'assistant'; content: string };

export default function AIRefineWorkflow() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true); setError('');
    const userMsg = message;
    setHistory((h) => [...h, { role: 'user', content: userMsg }]);
    setMessage('');
    try {
      const r: any = await ai.refineWorkflow({ user_message: userMsg, previous_steps: steps, history });
      const reply = r.result;
      if (reply?.steps) setSteps(reply.steps);
      setHistory((h) => [...h, { role: 'assistant', content: reply?.explanation || JSON.stringify(reply) }]);
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.includes('503') || msg.includes('ANTHROPIC_API_KEY')) setError('AI is not configured (ANTHROPIC_API_KEY missing).');
      else setError(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="container">
      <h1 className="h1">Workflow Builder Chat</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>Iteratively refine a workflow with natural-language instructions.</p>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ maxHeight: 380, overflowY: 'auto' }}>
        {history.map((t, i) => (
          <div key={i} style={{ padding: 8, background: t.role === 'user' ? '#eef2ff' : '#f1f5f9', marginBottom: 6, borderRadius: 6 }}>
            <strong>{t.role}:</strong> {t.content}
          </div>
        ))}
      </div>
      <div className="card">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='e.g. "add a step that emails the manager when the invoice is over $10k"'
          rows={3}
          style={{ width: '100%', padding: 8 }}
        />
        <button onClick={submit} disabled={busy} style={{ marginTop: 8 }}>{busy ? 'Thinking…' : 'Send'}</button>
      </div>
      <div className="card">
        <h3>Current draft steps</h3>
        <pre className="code">{JSON.stringify(steps, null, 2)}</pre>
      </div>
    </div>
  );
}
