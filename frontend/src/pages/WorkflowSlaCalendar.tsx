import { useEffect, useState } from 'react';

type Workflow = { id: string; name: string; owner: string; due: string; risk: string; blocked_steps: number };
type SlaPayload = {
  summary: { open_slas: number; at_risk: number; next_breach_hours: number; auto_escalations: number };
  workflows: Workflow[];
  calendar: { date: string; label: string; severity: string }[];
};

export default function WorkflowSlaCalendar() {
  const [data, setData] = useState<SlaPayload | null>(null);

  useEffect(() => {
    fetch('/api/workflow-sla-calendar')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="container">
      <h1>Workflow SLA Calendar</h1>
      <p>Track deadline risk, escalation windows, and blocked workflow steps.</p>
      <div className="grid">
        {data && Object.entries(data.summary).map(([key, value]) => (
          <div className="card" key={key}>
            <h3>{key.replaceAll('_', ' ')}</h3>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>At-risk workflows</h2>
        {(data?.workflows || []).map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', padding: '12px 0' }}>
            <div>
              <strong>{item.name}</strong>
              <div>{item.owner} - due {item.due}</div>
            </div>
            <span>{item.risk} risk / {item.blocked_steps} blocked</span>
          </div>
        ))}
      </div>
    </div>
  );
}
