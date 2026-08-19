# Security & Dependency Audit (Phase 0)

## Dependency Audit
An `npm audit` revealed the following vulnerabilities within the current package lockfile:

- **12 vulnerabilities** (1 low, 5 moderate, 6 high)
- High severity issues found in `lodash` (Prototype Pollution), `nanoid` (DoS loops), `postcss` (Path Traversal / XSS), `ws` (Uninitialized memory disclosure), and `xlsx` (Prototype Pollution in SheetJS).
- Moderate severity issues found in `@remix-run/router`, `dompurify`, and `esbuild`.

*Action:* A controlled `npm audit fix` should be run in Phase 1, taking care not to introduce breaking changes by blindly updating major versions.

## Local Storage Vulnerabilities
A search for `localStorage` usage across the frontend codebase shows it is heavily utilized for:
- Offline queue sync (`assetpro_offline_queue`)
- Profile metadata fallback (`profile_metadata_${id}`)
- Report templates (`assetpro_report_templates`, `assetpro_report_favorites`)
- Custom inventory categories (`assetpro_custom_inventory_categories`)
- Trash bin / soft delete recovery (`TRASH_KEY`)

**Risk:** Because these values are stored exclusively or primarily in the browser's local storage rather than the database, they are vulnerable to data loss (if the user clears browser data or switches devices) and manipulation (users could inject malicious templates or bypass metadata).

## Service-Role & Secrets Check
- **Secrets:** The `.env` file does **not** contain any privileged `service_role` keys. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, which are meant to be public.
- **Frontend Code:** No instances of `SUPABASE_SERVICE_ROLE_KEY` or direct admin overrides were found in the `src/` directory. The application relies entirely on JWT tokens for the authenticated user, which correctly offloads security to Supabase RLS.

## General Security Findings
As detailed in the `database_audit.md`, the primary security failing in the current version is the broad `auth.role() = 'authenticated'` condition in Supabase RLS policies. The frontend role checks (`if (user.role === 'admin')`) are merely hiding buttons, but the underlying API allows any authenticated user to fetch and modify data across the entire organization.
