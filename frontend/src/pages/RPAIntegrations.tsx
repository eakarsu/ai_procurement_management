import { useEffect, useState } from 'react';
import { ai } from '../services/api';

export default function RPAIntegrations() {
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ai.rpaStatus().then((r: any) => setStatus(r.providers)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <h1 className="h1">RPA Integrations</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>Zapier and Make webhook adapters. Set the listed env vars on the server to enable.</p>
      {error && <div className="error">{error}</div>}
      {status && Object.entries(status).map(([provider, s]: any) => (
        <div key={provider} className="card">
          <div><strong style={{ textTransform: 'capitalize' }}>{provider}</strong> — <span style={{ color: s.configured ? '#16a34a' : '#dc2626' }}>{s.configured ? 'configured' : 'not configured'}</span></div>
          {!s.configured && <div style={{ color: '#6b7280', fontSize: 12 }}>Missing: {s.missing.join(', ')}</div>}
        </div>
      ))}
    </div>
  );
}
