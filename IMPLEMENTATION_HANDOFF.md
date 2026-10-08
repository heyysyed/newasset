# Security and reliability implementation handoff

## Status

This checkpoint is implemented and locally tested. It has not been applied to a live Supabase project. The supplied project URL is `https://brsrxabeuuicpitjxmrk.supabase.co`; confirm whether it is staging before applying migrations.

## Included

- Hardened authentication loading, route permissions, deployment headers, QR parsing, print HTML, and document validation.
- Replaced fabricated invoice values with reviewed extraction from pasted invoice text.
- Added tenant/site-aware RLS, safe public QR projection, signup role protection, inactive-account restrictions, and archive/restore RPCs.
- Added atomic, retry-safe stock reconciliation and account-scoped offline queues.
- Added real scheduled-report persistence and a leased delivery worker. Schedules default to paused.
- Added encrypted database plus Supabase Storage backup tooling with integrity checks and optional S3-compatible upload.
- Upgraded affected dependencies, including SheetJS from its official distribution, and added CI.

## Required before production

1. Restore a recent production backup into a separate staging Supabase project.
2. Inventory live policies, grants, functions, columns, storage buckets, and company/site memberships.
3. Populate `user_company_assignments` and validate every account before enabling the core security migration.
4. Apply migrations in filename order to staging and run role-based acceptance tests.
5. Configure the report worker secrets and verified sender; enable schedules only after a successful staging delivery.
6. Configure backup scheduler secrets, encrypted remote storage, retention/immutability, alerts, and a complete restore drill.
7. Apply to production during a controlled migration window with a verified rollback backup.

## Secure runtime configuration

The report worker requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, and `REPORT_DELIVERY_ENABLED=true`.

The backup job requires PostgreSQL TLS variables (`PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGSSLMODE=verify-full` and the trusted CA), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_KEY_BASE64`, and `BACKUP_OUTPUT_DIR`. Remote copies additionally require `BACKUP_S3_BUCKET`, `AWS_REGION`, and the provider's secure credentials; `BACKUP_S3_ENDPOINT` is optional.

Never place these values in Git or frontend `VITE_*` variables.

## Commands

```bash
npm ci
npm test
npm run test:db
npm run build
npm run test:e2e
```

Backup creation and verification:

```bash
npm run backup
npm run backup:verify -- /absolute/path/to/file.apbackup
```

The backup verification command authenticates and checks the archive and validates the PostgreSQL dump structure. Operational readiness additionally requires restoring into an isolated project and testing application access, storage objects, and permissions.
