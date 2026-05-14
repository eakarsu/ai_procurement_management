# Business Process Automation – Frontend

React + Vite + TypeScript SPA for the BPA Platform.

## Run

```bash
cd frontend
npm install
npm run dev
```

Backend should be running at `http://localhost:8000` (proxied via `/api`).

## Pages

- `/login` — Sign in / register (JWT)
- `/` — Dashboard with workflow / task / automation stats
- `/workflows` — List + create workflows
- `/workflows/:id` — Detail with steps editor, execute, run history, AI optimize
- `/tasks` — List, filter, create, update status
- `/automations` — Rules with toggle and dry-run test
- `/ai/analyze` — Process analysis via Claude
- `/ai/generate` — Generate workflow from goal (saveable to backend)
- `/ai/stream` — Live SSE streaming analysis
