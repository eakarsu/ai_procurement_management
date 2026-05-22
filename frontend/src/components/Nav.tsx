import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Nav() {
  const { user, logout } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);

  if (!user) return null;
  return (
    <div className="nav">
      <span className="nav-brand">BPA Platform</span>
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Dashboard
      </NavLink>
      <NavLink to="/workflows" className={({ isActive }) => (isActive ? 'active' : '')}>
        Workflows
      </NavLink>
      <NavLink to="/tasks" className={({ isActive }) => (isActive ? 'active' : '')}>
        Tasks
      </NavLink>
      <NavLink to="/automations" className={({ isActive }) => (isActive ? 'active' : '')}>
        Automations
      </NavLink>
      <NavLink to="/templates" className={({ isActive }) => (isActive ? 'active' : '')}>
        Templates
      </NavLink>
      <NavLink to="/approvals" className={({ isActive }) => (isActive ? 'active' : '')}>
        Approvals
      </NavLink>
      <NavLink to="/task-dependencies" className={({ isActive }) => (isActive ? 'active' : '')}>
        Dependencies
      </NavLink>
      <NavLink to="/rpa-integrations" className={({ isActive }) => (isActive ? 'active' : '')}>
        RPA
      </NavLink>
      <NavLink to="/workflow-sla-calendar" className={({ isActive }) => (isActive ? 'active' : '')}>
        SLA Calendar
      </NavLink>

      {/* AI dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          className="secondary"
          style={{ fontSize: 14, padding: '4px 10px' }}
          onClick={() => setAiOpen(!aiOpen)}
        >
          AI ▾
        </button>
        {aiOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 100,
              minWidth: 180,
              padding: 4,
            }}
            onMouseLeave={() => setAiOpen(false)}
          >
            {[
              { to: '/ai/analyze', label: 'Analyze Process' },
              { to: '/ai/generate', label: 'Generate Workflow' },
              { to: '/ai/prioritize', label: 'Prioritize Tasks' },
              { to: '/ai/anomalies', label: 'Anomaly Detection' },
              { to: '/ai/suggest-rules', label: 'Suggest Rules' },
              { to: '/ai/process-mining', label: 'Process Mining' },
              { to: '/ai/refine-workflow', label: 'Workflow Builder Chat' },
              { to: '/ai/stream', label: 'Streaming Analysis' },
              { to: '/ai/history', label: 'AI History' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setAiOpen(false)}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '8px 12px',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontSize: 13,
                  color: isActive ? '#2563eb' : '#374151',
                  background: isActive ? '#eff6ff' : 'transparent',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{user.name}</span>
        <button className="secondary" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
