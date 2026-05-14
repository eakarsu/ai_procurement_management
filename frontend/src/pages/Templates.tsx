import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { templates } from '../services/api';

const CATEGORIES = ['all', 'customer', 'finance', 'hr', 'general'];

export default function Templates() {
  const [items, setItems] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [instantiating, setInstantiating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    templates
      .list(category === 'all' ? undefined : category)
      .then((data: any) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category]);

  const instantiate = async (id: string) => {
    setInstantiating(id);
    setError('');
    try {
      const wf: any = await templates.instantiate(id);
      navigate(`/workflows/${wf.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstantiating(null);
    }
  };

  return (
    <div className="container">
      <h1 className="h1">Workflow Templates</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Pre-built workflow templates to get started quickly. Click "Use Template" to create a workflow from any template.
      </p>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={category === c ? '' : 'secondary'}
              onClick={() => setCategory(c)}
              style={{ textTransform: 'capitalize' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#6b7280' }}>Loading templates...</div>
      ) : items.length === 0 ? (
        <div className="card"><p style={{ color: '#6b7280' }}>No templates found.</p></div>
      ) : (
        <div className="grid grid-2">
          {items.map((t) => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 className="h2" style={{ margin: 0 }}>{t.name}</h2>
                <span className="badge badge-gray">{t.category}</span>
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{t.description}</p>
              <div className="row" style={{ gap: 6 }}>
                <span className="badge badge-info">trigger: {t.trigger_type}</span>
                <span className="badge badge-gray">{(t.steps || []).length} steps</span>
              </div>
              {(t.tags || []).length > 0 && (
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {t.tags.map((tag: string) => (
                    <span key={tag} style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div>
                <h4 style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Steps:</h4>
                <ol style={{ paddingLeft: 16, margin: 0 }}>
                  {(t.steps || []).map((s: any, i: number) => (
                    <li key={i} style={{ fontSize: 12, color: '#374151' }}>
                      <strong>{s.name}</strong> — {s.description}
                    </li>
                  ))}
                </ol>
              </div>
              <button
                onClick={() => instantiate(t.id)}
                disabled={instantiating === t.id}
                style={{ marginTop: 'auto' }}
              >
                {instantiating === t.id ? 'Creating...' : 'Use Template'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
