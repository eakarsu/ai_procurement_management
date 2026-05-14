import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analytics } from '../services/api';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    analytics
      .get()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container">Loading analytics...</div>;
  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!data) return null;

  const successRate = data.workflow_runs_total > 0
    ? Math.round((data.workflow_runs_succeeded / data.workflow_runs_total) * 100)
    : null;

  return (
    <div className="container">
      <h1 className="h1">Business Automation Dashboard</h1>

      <div className="grid grid-4">
        <div className="stat">
          <div className="stat-label">Workflows</div>
          <div className="stat-value">{data.workflows_total}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{data.workflows_active} active</div>
        </div>
        <div className="stat">
          <div className="stat-label">Pending Tasks</div>
          <div className="stat-value">{data.tasks_pending}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{data.tasks_completed} completed</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active Automations</div>
          <div className="stat-value">{data.automations_active}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{data.automations_total} total</div>
        </div>
        <div className="stat">
          <div className="stat-label">Workflow Runs</div>
          <div className="stat-value">{data.workflow_runs_total}</div>
          {successRate !== null && (
            <div style={{ fontSize: 12, color: successRate >= 80 ? '#16a34a' : '#dc2626' }}>
              {successRate}% success
            </div>
          )}
        </div>
      </div>

      <div className="spacer" />

      <div className="grid grid-4">
        <div className="stat">
          <div className="stat-label">AI Analyses</div>
          <div className="stat-value">{data.ai_analyses_total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">AI Tokens Used</div>
          <div className="stat-value">{data.ai_tokens_total.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Runs Succeeded</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{data.workflow_runs_succeeded}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Runs Failed</div>
          <div className="stat-value" style={{ color: data.workflow_runs_failed > 0 ? '#dc2626' : 'inherit' }}>
            {data.workflow_runs_failed}
          </div>
        </div>
      </div>

      <div className="spacer" />

      <div className="grid grid-2">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="h2">Recent Activity</h2>
          </div>
          {data.recent_activity.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No recent activity.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.recent_activity.map((a: any, i: number) => (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>{a.description}</span>
                    <span
                      className={`badge badge-${
                        a.status === 'completed' ? 'success' : a.status === 'failed' ? 'danger' : 'info'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {new Date(a.timestamp).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="h2">Quick Links</h2>
          <div className="col" style={{ gap: 8, marginTop: 8 }}>
            <Link to="/workflows" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              Manage Workflows
            </Link>
            <Link to="/tasks" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              View Tasks
            </Link>
            <Link to="/automations" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              Automation Rules
            </Link>
            <Link to="/ai/analyze" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              Analyze a Process
            </Link>
            <Link to="/ai/generate" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              Generate Workflow with AI
            </Link>
            <Link to="/ai/prioritize" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              AI Task Prioritizer
            </Link>
            <Link to="/templates" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              Workflow Templates
            </Link>
            <Link to="/ai/history" style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: '#111827' }}>
              AI Analysis History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
