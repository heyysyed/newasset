# Architecture Inventory (Phase 0)

## Current Structure Overview
The application currently follows a monolithic, page-centric architecture rather than a modular, domain-driven one. 

```text
src/
├── App.jsx (Routing orchestration)
├── main.jsx (Entry point)
├── index.css (Custom CSS variables and Tailwind)
├── components/ (Global components)
│   ├── Layout.jsx
│   ├── SkeletonLoader.jsx
│   ├── ...
├── context/ (Global State)
│   ├── AuthContext.jsx
│   ├── ImportContext.jsx
│   ├── NotificationContext.jsx
├── lib/ (Utilities & Services)
│   ├── supabase.js (Direct DB connection & offline queue)
├── pages/ (Monolithic Pages containing UI + Business Logic + Data Fetching)
│   ├── AdminPage.jsx
│   ├── AssetDetail.jsx
│   ├── AssetForm.jsx
│   ├── AssetList.jsx
│   ├── AuditModulePage.jsx
│   ├── Dashboard.jsx
│   ├── ExcelImport.jsx
│   ├── InventoryPage.jsx
│   ├── MaintenancePage.jsx
│   ├── ReportsPage.jsx
│   ├── SitesPage.jsx
│   ├── StickerPage.jsx
│   └── ...
```

## Feature Matrix Status

| Module | Existing | Working | Partial | Broken | Planned Enhancement |
|---|:---:|:---:|:---:|:---:|:---:|
| Authentication | ✓ | ✓ | | | Modularization |
| Dashboard | ✓ | ✓ | | | Command Center & Exec Dashboard |
| Assets | ✓ | | ✓ | | Syntax fix needed, UI modularization |
| Maintenance | ✓ | ✓ | | | Full CMMS upgrade |
| Inventory | ✓ | ✓ | | | Multi-site logic |
| Procurement | | | | ✓ | Not implemented in frontend yet |
| Inspections/Audit | ✓ | ✓ | | | Configurable SLAs & Scoring |
| QR | ✓ | ✓ | | | Enhanced field scanning |
| Reports | ✓ | ✓ | | | Report Scheduling & Custom Builder |
| Admin | ✓ | ✓ | | | Advanced Data Quality & Global Settings |

## Dependency Map Issues
- **Fat Pages:** Pages like `AssetDetail.jsx` (~1700 lines) and `AuditModulePage.jsx` encapsulate too much logic (fetching, rendering, state management).
- **Inline Queries:** TanStack `useQuery` and `useMutation` are hardcoded directly inside components instead of abstracted hooks or services.
- **Supabase Coupling:** The UI components import `supabase` directly and execute `.select()`, `.insert()`, etc., scattering business logic across the rendering layer.
