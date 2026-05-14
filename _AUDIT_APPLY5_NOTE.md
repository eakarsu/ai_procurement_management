# Apply Pass 5 — ai_business_business_automation

- **Date:** 2026-05-08
- **Project:** ai_business_business_automation
- **Stack:** Python / FastAPI (SQLAlchemy, JWT, custom rate limiter) + React (Vite + TS). Anthropic Claude 3.5 Sonnet via `_get_anthropic_client` (returns 503 when `ANTHROPIC_API_KEY` unset).
- **Audit source:** `/Users/erolakarsu/projects/_AUDIT/reports/batch_00.md` section 2
- **Action:** LEFT-AS-IS (verified prior pass-5 implementation present on disk)

## Audit detector false positive

Audit flagged this as "skeleton, 0 AI endpoints" — wrong. `routers/ai.py` is 616+ lines with: `/analyze-process`, `/generate-workflow`, `/optimize-workflow/{id}`, `/prioritize-tasks`, `/summarize-runs/{id}`, `/history`, `/stream-analysis` (SSE), plus pass-4 `/detect-anomalies/{workflow_id}` and `/suggest-automation-rules`.

## Verified present (already in code)

- AI workflow recommendation → `/optimize-workflow`
- AI task prioritization → `/prioritize-tasks`
- Workflow versioning/rollback → `/{id}/versions`, `/{id}/versions/{n}/restore`
- Anomaly detection → `/detect-anomalies/{workflow_id}` (pass 4)
- Automation rule suggestion → `/suggest-automation-rules` (pass 4)
- FE pages for all of the above

## Implemented (verified on disk; from prior pass-5 invocation)

5 features (within cap). Files all verified present:

- `routers/ai.py` (extended): `POST /api/ai/process-mining/{workflow_id}` (line 757), `POST /api/ai/refine-workflow` (line 843), `GET /api/ai/rpa/status` (line 915), `POST /api/ai/rpa/{provider}/dispatch` (line 932)
- `routers/extras.py` (new) — additive `task_dependencies` + `approvals` tables via `CREATE TABLE IF NOT EXISTS`; `models.py` untouched
- `main.py` — added single line mounting `extras` router
- `frontend/src/pages/AIProcessMining.tsx`
- `frontend/src/pages/AIRefineWorkflow.tsx`
- `frontend/src/pages/Approvals.tsx`
- `frontend/src/pages/TaskDependencies.tsx`
- `frontend/src/pages/RPAIntegrations.tsx`
- `frontend/src/services/api.ts`, `App.tsx`, `components/Nav.tsx` — wiring

## Deferred

| Item | Category | Reason |
|---|---|---|
| Conditional branching in workflow engine | TOO-RISKY | Modifies `_run_step` semantics, load-bearing for every existing run |
| Mobile companion app | OUT-OF-SCOPE | New project |
| Real RPA outbound POST | NEEDS-CREDS | `ZAPIER_HOOK_URL` / `MAKE_HOOK_URL` |

## Smoke test

Per `_AUDIT_NOTE.md`: N/A — sandbox lacks `anthropic` package and policy forbids `pip install`. `python3 -c "import ast; ast.parse(...)"` on `routers/ai.py`, `routers/extras.py`, `main.py` all pass. FE `npx tsc --noEmit` clean.
