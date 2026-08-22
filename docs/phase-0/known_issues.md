# Known Issues & Deficiencies (Phase 0 Baseline)

This document aggregates the specific functional, code, and data issues discovered during the Phase 0 Baseline Audit. These issues must be addressed during Phase 1 (Stabilization) before proceeding to Phase 2.

## 1. Syntax & Compilation Errors
- **`AssetDetail.jsx` Line 1533:** A stray `window.open('/assets/${id}/history', '_blank')` statement exists outside of any function scope, causing a fatal Vite build error: `[vite:esbuild] Transform failed with 1 error: Expected ")" but found "window"`.

## 2. Security & RLS Vulnerabilities
- **Cross-Tenant Access:** `assets`, `maintenance_schedules`, and other core tables use permissive `USING (auth.role() = 'authenticated')` policies, allowing users to query and modify records across the entire application regardless of their site or project.
- **Global Profile Visibility:** The `profiles` table allows unauthenticated read access, leaking user details.
- **Client-Side Data Storage:** Critical workflow data (like report templates and offline sync queues) are stored in `localStorage`, risking data loss and manipulation.

## 3. Architecture & Code Debt
- **Monolithic Page Components:** Files like `AssetDetail.jsx` (~1700 lines) handle too much responsibility (fetching, mutation, layout, UI states) and need to be broken down into modular domain components.
- **Scattered TanStack Queries:** Data fetching is performed inline without central query keys, leading to duplicate network requests and difficulty in cache invalidation.
- **Direct Supabase Coupling:** The UI components directly execute Supabase SDK methods (`supabase.from(...)`), making the business logic untestable and deeply coupled to the rendering tree.

## 4. Missing Database Constraints (Data Quality Risks)
- **Negative Inventory:** `inventory_items.current_stock` lacks a `>= 0` check constraint.
- **Orphaned Assets:** `site` and `department` in the `assets` table are free-text fields instead of foreign keys to normalized tables, risking data inconsistency if a site is renamed.
- **Duplicate Serials:** `serial_no` is not constrained to be unique, risking duplicate physical asset entries.
