# Parts Lifecycle Integration — implementation contract

Read this before touching Inventory, Asset or Maintenance UI. It records the
conventions the parts work depends on. The authoritative API surface is
`src/services/partsService.js` — read that file, do not guess signatures.

## 1. The two tracks

There are exactly two kinds of stock. `inventory_items` is **retired** (renamed
to `inventory_items_archive` by migration `004_parts_lifecycle_integration.sql`).
Never query it again.

| Track | Table(s) | What it holds | Identity |
|---|---|---|---|
| **Serialized** | `serialized_components` | Parts with their own serial number: hard drives, SSDs, motherboards, RAM, CPUs, batteries, screens, motors | one row = one physical part |
| **Bulk** | `bulk_items` + `bulk_site_stock` + `bulk_transactions` | Quantity-only consumables: cables, thermal paste, screws, oil, filters | one row = one SKU, quantity per site |

A serialized part has a lifecycle: `IN_STOCK → INSTALLED → REMOVED →`
`(AVAILABLE | IN_REPAIR | AT_VENDOR | SCRAPPED | LOST)`. A bulk part is
consumed, not tracked — you decrement a quantity.

Terminal statuses (`SCRAPPED`, `DISPOSED`, `WRITTEN_OFF`, `LOST`) cannot be
installed. `isTerminal(status)` from partsService tells you.

## 2. Every write goes through an RPC

Do **not** write multi-step mutations in the browser (insert component, then
update asset, then insert an event). Migration 004 created SECURITY DEFINER
Postgres functions that do each of those atomically, and `partsService.js` wraps
them. If you find yourself calling `supabase.from(...).insert()` for anything
lifecycle-related, you are doing it wrong.

Lifecycle functions take a **single named-argument object**, not positional args:

```js
await installComponent({ componentId, assetId, position, workOrderId, userId, location })
await removeComponent({ componentId, workOrderId, reason, disposition, userId, newStatus, scrapValue })
await replaceComponent({ oldComponentId, newComponentId, assetId, position, workOrderId, reason, disposition, userId, oldNewStatus, scrapValue })
await consumeBulkPart({ itemId, quantity, workOrderId, userId, site, isOverride, overrideReason })
```

The positional form is what let a **ticket id** get passed into the
**work order id** slot, which is the bug that made every install/remove fail
with a foreign-key violation. The `workOrderId` argument now tolerates either a
work-order id *or* a ticket id — the RPC resolves or creates the work order
server-side. So from a ticket screen you may pass `ticket.id` safely.

## 3. Reads come from views, not joins

| View | Use it for |
|---|---|
| `v_part_where_used` | one row per installation episode: which part sat in which asset, when, why it came out, what it cost, what it was scrapped for. This is the "part history" report and also what the asset Parts tab renders. |
| `v_asset_total_cost` | asset costing: `original_value`, `capitalized_parts`, `expensed_parts`, `consumables_spend`, `total_parts_spend`, `combined_value`, `total_cost_of_ownership` |
| `v_asset_parts_cost` | per-part cost lines for one asset |
| `v_work_order_parts` | parts consumed on a work order, both tracks, with a `track` column |
| `v_scrapped_parts` | scrap register with `book_loss` |
| `v_bulk_stock_status` | bulk stock with `stock_status` = `OUT_OF_STOCK` / `LOW_STOCK` / `IN_STOCK`, computed from each item's own `reorder_level` |

Low stock is **never** a hardcoded threshold. Use `stock_status` from the view.

## 4. Cost display rule (user's explicit decision)

Show the original purchase value and the parts spend **separately**, and also
show a **combined figure as the asset's value**. All three are visible; the
combined one is the headline.

```
Purchase value        ₹45,000     ← v_asset_total_cost.original_value
Parts capitalised     ₹ 8,500     ← .capitalized_parts
Parts expensed        ₹ 1,200     ← .expensed_parts
Consumables           ₹   340     ← .consumables_spend
─────────────────────────────
Asset value (combined) ₹53,500    ← .combined_value      (headline)
Total cost of ownership ₹55,040   ← .total_cost_of_ownership
```

## 5. House style — non-negotiable

- **Vite + React 18, plain `.jsx`. No TypeScript anywhere.** No interfaces, no
  type annotations, no `.ts`/`.tsx` files.
- **No Next.js primitives.** No server components, no `'use server'`, no API
  routes, no `next/*` imports. This is a SPA behind `HashRouter`.
- **`formatCurrency(value)` from `src/lib/depreciation.js` takes ONE argument.**
  Passing a second currency arg does nothing. Don't add one.
- **React Query v5 syntax.** `invalidateQueries({ queryKey: ['x'] })` — the bare
  array form `invalidateQueries(['x'])` silently no-ops on v5.
  `isPending`, not `isLoading`, for mutations.
- Icons from `lucide-react`. Charts from `recharts`. Excel via `xlsx` (SheetJS).
  PDF via `jspdf` + `jspdf-autotable`.
- Styling: Tailwind utilities plus the CSS-variable design system in
  `src/index.css`. Existing hand-rolled classes: `.inp .sel .lbl .btn-primary`
  `.btn-ghost .btn-danger .card`. Use CSS variables (`var(--text-1)`,
  `var(--bg-1)`, `var(--border)`, `var(--accent)`, `var(--status-danger)` …)
  rather than hex literals.
- **No `window.prompt` / `window.confirm` / `alert` for anything a user does
  more than once.** Use a real modal. (`alert` for a caught error is tolerable.)
- **No `localStorage` for domain data.** Part categories now live in the
  `part_categories` table — `fetchPartCategories(track)`.

## 6. Responsive contract

Breakpoints are defined once, in `src/hooks/useBreakpoint.js`, and the CSS now
matches them exactly:

- phone `< 768`
- tablet `768 – 1023`
- desktop `>= 1024`

Hooks: `useBreakpoint()`, `useIsMobile()`, `useIsTablet()`, `useIsMobileOrTablet()`.

Every parts surface must work on all three. `src/index.css` now ships shared
primitives — **use these instead of inventing new ones**:

| Class | Behaviour |
|---|---|
| `.pt-table-wrap` / `.pt-card-list` | table on ≥768, stacked cards below. Render both; CSS picks. |
| `.pt-card` `.pt-card-head` `.pt-card-title` `.pt-card-sub` `.pt-card-grid` `.pt-field-label` `.pt-field-value` `.pt-card-actions` | anatomy of a phone card row |
| `.pt-pill` + `.success .warning .danger .info .neutral` | status badge; tone comes from `STATUS_META[status].tone` |
| `.pt-metrics` `.pt-metric` `.pt-metric-label` `.pt-metric-value` `.pt-metric-hint` | KPI strip: auto-fit desktop, 2-up tablet/phone, 1-up under 400px |
| `.pt-toolbar` `.pt-grow` `.pt-toolbar-row` | search + actions row; stacks full-width on phone |
| `.pt-chips` `.pt-chip` `.pt-chip.active` | horizontally scrollable filter chips |
| `.pt-modal-backdrop` `.pt-modal` (`.sm` `.lg`) `.pt-modal-head` `.pt-modal-title` `.pt-modal-body` `.pt-modal-foot` | centred dialog on desktop, **bottom sheet on phone**, safe-area aware |
| `.pt-form-grid` + `.span-2` | 2-col form, 1-col under 640 |
| `.pt-section-head` `.pt-section-title` | section header |
| `.pt-empty` `.pt-empty-title` `.pt-empty-hint` | empty state |
| `.pt-timeline` `.pt-tl-item` `.pt-tl-dot` `.pt-tl-body` `.pt-tl-title` `.pt-tl-meta` | lifecycle history |
| `.pt-cost-rows` `.pt-cost-row` (`.total`) | cost breakdown |

Rules: modals must be reachable and dismissible on a 360px-wide screen; tables
must never force horizontal scroll on phone (use the card list); tap targets
≥ 42px on touch; long serial numbers need `word-break`.

## 7. Where things live

```
004_parts_lifecycle_integration.sql   schema, RPCs, views   (run in Supabase SQL Editor)
src/services/partsService.js          the only data API for parts
src/services/componentService.js      deprecated re-export shim
src/lib/supabase.js                   everything else (assets, tickets, WOs)
src/hooks/useBreakpoint.js            breakpoints
src/lib/depreciation.js               formatCurrency(value)
src/components/mobile/                parallel mobile component tree
```
