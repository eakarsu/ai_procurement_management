# Procurement workflow runbook

The acceptance journey is tenant owner registration in development, tenant user provisioning, persistent vendor creation, bid submission for an active tenant vendor, and audited `SUBMITTED → UNDER_EVALUATION → EVALUATED → AWARDED` decisions. The browser vendors/bids pages call this PostgreSQL workflow. Production accepts only provisioned, verified OIDC identities; role and tenant authority come from the database.

Run `./start.sh check` for builds and unit tests. CI creates PostgreSQL, replays Prisma migrations twice, and runs the HTTP/database test with `RUN_DB_TESTS=true`. Before deployment run `ALLOW_SCHEMA_MIGRATION=1 ./start.sh migrate` as a one-shot job, then `./start.sh start`. Mock dashboard/compliance/generic-AI routes are unavailable by default and cannot be enabled in production.

Use `compose.yaml` as the reference topology. `/api/health` is liveness, `/api/ready` verifies PostgreSQL, `/api/metrics` exposes request counters, and logs are structured JSON with request IDs. Alert on readiness failures, 5xx/error ratio, authentication failures, invalid transitions, audit-write failures, database saturation, and backup age.

Run `DATABASE_URL=... BACKUP_FILE=/approved/path/procurement.dump ./scripts/backup.sh` and keep the verified dump encrypted with restricted access. Restore only to the exact approved target with `ALLOW_DATABASE_RESTORE=1` during maintenance, rehearse quarterly, and reconcile tenant/vendor/bid/audit counts. Startup never installs, seeds, migrates, deletes data, or kills unrelated processes.
