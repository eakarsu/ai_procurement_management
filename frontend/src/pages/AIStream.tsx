import { useRef, useState } from 'react';
// Note: stream results are now automatically saved to AI History

export default function AIStream() {
  const [process, setProcess] = useState('Customer onboarding');
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    setText('');
    setError('');
    setTokensUsed(null);
    setSaved(false);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = localStorage.getItem('token');
      const url = `/api/ai/stream-analysis?process=${encodeURIComponent(process)}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error('No response stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() || '';
        for (const ln of lines) {
          const m = ln.match(/^data: (.+)$/m);
          if (!m) continue;
          if (m[1] === '[DONE]') {
            setStreaming(false);
            return;
          }
          try {
            const obj = JSON.parse(m[1]);
            if (obj.chunk) setText((prev) => prev + obj.chunk);
            if (obj.error) setError(obj.error);
            if (obj.done && obj.tokens_used) { setTokensUsed(obj.tokens_used); setSaved(true); }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setStreaming(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="container">
      <h1 className="h1">Streaming AI Analysis</h1>
      <p style={{ color: '#6b7280' }}>Live token-by-token streaming via Server-Sent Events.</p>
      <div className="card">
        <div className="col">
          <label className="label">Process</label>
          <input value={process} onChange={(e) => setProcess(e.target.value)} />
          <div className="row">
            <button onClick={start} disabled={streaming}>
              {streaming ? 'Streaming...' : 'Start Stream'}
            </button>
            {streaming && (
              <button className="danger" onClick={stop}>
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {saved && (
        <div className="success" style={{ marginBottom: 8 }}>
          Analysis saved to AI History ({tokensUsed?.toLocaleString()} tokens used).
        </div>
      )}
      <div className="card">
        <h2 className="h2">Output</h2>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
          {text || (streaming ? 'Connecting...' : 'No output yet.')}
        </div>
      </div>
    </div>
  );
}
