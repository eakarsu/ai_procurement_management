import { useEffect, useState } from 'react';
import { ai } from '../services/api';

const TYPE_LABELS: Record<string, string> = {
  analyze_process: 'Process Analysis',
  generate_workflow: 'Workflow Generator',
  optimize_workflow: 'Workflow Optimizer',
  prioritize_tasks: 'Task Prioritizer',
  summarize_runs: 'Run Summarizer',
  stream_analysis: 'Streaming Analysis',
};

export default function AIHistory() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const load = (p = page) => {
    ai.history({ page: p, analysis_type: typeFilter || undefined })
      .then((r: any) => {
        setItems(r.items || []);
        setTotal(r.total || 0);
        setTotalPages(r.total_pages || 1);
      })
      .catch(() => {});
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [typeFilter]);

  useEffect(() => {
    load(page);
  }, [page]);

  return (
    <div className="container">
      <h1 className="h1">AI Analysis History</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        All past AI analyses — {total} total, {items.length} shown.
      </p>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No AI analyses found.</p>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f9fafb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <div>
                  <span className="badge badge-info" style={{ marginRight: 8 }}>
                    {TYPE_LABELS[a.analysis_type] || a.analysis_type}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {a.tokens_used.toLocaleString()} tokens
                  </span>
                  <span style={{ fontSize: 13 }}>{expanded === a.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === a.id && (
                <div style={{ padding: 14 }}>
                  <h4 style={{ fontSize: 13, marginBottom: 6, color: '#374151' }}>Input</h4>
                  <div className="code" style={{ marginBottom: 12, fontSize: 11 }}>
                    {JSON.stringify(a.input_data, null, 2)}
                  </div>
                  <h4 style={{ fontSize: 13, marginBottom: 6, color: '#374151' }}>Result</h4>
                  {a.result?.raw_response ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>
                      {a.result.raw_response}
                    </div>
                  ) : (
                    <div className="code" style={{ fontSize: 11 }}>
                      {JSON.stringify(a.result, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {totalPages > 1 && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 16, gap: 8 }}>
            <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontSize: 13 }}>
              Page {page} of {totalPages}
            </span>
            <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
