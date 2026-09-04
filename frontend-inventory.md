# Frontend Inventory — edms-frontend

Next.js 16 App Router. All pages live under `src/app`; the `(app)` route group adds no path segment. Data access is TanStack Query hooks (`src/apis/hooks/*`) over service modules (`src/apis/services/*`), which call a shared axios instance (`src/lib/api-client.ts`, `baseURL = ${NEXT_PUBLIC_API_URL}/api/v1`).

Four service modules never touch the network — they return `SEED` fixtures from `src/store/initialData.ts` behind a 400ms `setTimeout`: **audit, branding, circulars, policies**. A second class of screens bypasses services entirely and reads the zustand store, which is itself seeded from `SEED`.

---

## Section 1 — Screens

| Route | Component file | What it does |
|---|---|---|
| `/` | `src/app/page.tsx` | Login split-screen; posts credentials to the Next proxy and redirects by role. |
| `/admin` | `src/app/(app)/admin/page.tsx` | Client-admin home: setup-health counters (users, cabinets, published workflows) and quick links. |
| `/admin/audit` | `src/app/(app)/admin/audit/page.tsx` | Tenant-scoped immutable event log with user/action/text filters and CSV export. |
| `/admin/branding` | `src/app/(app)/admin/branding/page.tsx` | White-label theming editor (colors, logo, app name) with a live preview panel. |
| `/admin/cabinets` | `src/app/(app)/admin/cabinets/page.tsx` | Cabinet designer: CRUD cabinets, folder tree, per-cabinet metadata schema, access grants, inline document preview, move a document to another cabinet/folder. Cabinet/folder lists filter client-side past 8 items; each folder's document list is server-paginated. |
| `/admin/circulars` | `src/app/(app)/admin/circulars/page.tsx` | Author, publish and track acknowledgement of org-wide circulars. |
| `/admin/departments` | `src/app/(app)/admin/departments/page.tsx` | Department hierarchy tree with create/rename/reparent/delete. |
| `/admin/policies` | `src/app/(app)/admin/policies/page.tsx` | Confidentiality / urgency / retention matrices and toggleable control rules. |
| `/admin/users` | `src/app/(app)/admin/users/page.tsx` | Paginated user directory, user create/edit, role creation and the role-permission matrix. |
| `/admin/workflows` | `src/app/(app)/admin/workflows/page.tsx` | Drag-and-drop workflow designer: stages, assignees, SLA, actions; publish/archive. |
| `/admin/workflows/instances` | `src/app/(app)/admin/workflows/instances/page.tsx` | Thin re-export of `/supervisor/instances`. |
| `/auditor` | `src/app/(app)/auditor/page.tsx` | Auditor home: open findings count and sensitive-action summary charts. |
| `/auditor/compliance` | `src/app/(app)/auditor/compliance/page.tsx` | Thin re-export of `/management/compliance`. |
| `/auditor/findings` | `src/app/(app)/auditor/findings/page.tsx` | Findings register — raise, filter and update audit findings. |
| `/auditor/trail` | `src/app/(app)/auditor/trail/page.tsx` | Full audit trail browser with user/action/date-range filters. |
| `/circulars` | `src/app/(app)/circulars/page.tsx` | End-user circular reader with an acknowledge action. |
| `/doc/[id]` | `src/app/(app)/doc/[id]/page.tsx` | Document workspace: viewer, redaction mode, metadata, check-out/in, sign, comment; act on the active workflow task with whatever the current stage's `actions` allow (review, approve, request changes, reject, delegate, close); route an unrouted document into a workflow; workflow stage rail + activity trail. |
| `/management` | `src/app/(app)/management/page.tsx` | Executive dashboard: throughput, turnaround, SLA and per-department rollups with CSV export. |
| `/management/compliance` | `src/app/(app)/management/compliance/page.tsx` | Compliance posture — sensitive-action breakdown and open findings table. |
| `/management/departments` | `src/app/(app)/management/departments/page.tsx` | Per-department document/task/instance volumes and trend charts. |
| `/management/findings` | `src/app/(app)/management/findings/page.tsx` | Thin re-export of `/auditor/findings`. |
| `/management/performance` | `src/app/(app)/management/performance/page.tsx` | Org-wide task SLA donut. |
| `/management/reports` | `src/app/(app)/management/reports/page.tsx` | Report builder + saved/scheduled report list; export is simulated. |
| `/management/trends` | `src/app/(app)/management/trends/page.tsx` | Month-bucketed document and workflow-instance trend lines by department. |
| `/notifications` | `src/app/(app)/notifications/page.tsx` | Notification inbox — all/unread filter, mark-read, mark-all-read, deep links, and email/in-app/digest delivery preferences. |
| `/platform` | `src/app/(app)/platform/page.tsx` | SchullTech tenant directory; provision and edit tenants. |
| `/platform/audit` | `src/app/(app)/platform/audit/page.tsx` | Cross-tenant platform action log. |
| `/platform/billing` | `src/app/(app)/platform/billing/page.tsx` | Per-tenant usage metering, invoices and payment reminders. |
| `/platform/flags` | `src/app/(app)/platform/flags/page.tsx` | Thin re-export of `/platform/sysconfig`. |
| `/platform/plans` | `src/app/(app)/platform/plans/page.tsx` | Subscription plan catalogue and tenant plan assignment. |
| `/platform/sysconfig` | `src/app/(app)/platform/sysconfig/page.tsx` | Feature-flag and system configuration toggles. |
| `/delegations` | `src/app/(app)/delegations/page.tsx` | Out-of-office workflow delegation: create/end a time-bounded delegation to a colleague, optionally scoped to specific cabinets; lists what you've delegated and what's been delegated to you. Any authenticated user. |
| `/search` | `src/app/(app)/search/page.tsx` | Document search with faceted filtering, saved searches and CSV export. |
| `/staff` | `src/app/(app)/staff/page.tsx` | Staff home: status tiles (file/workflow-instance counts, not task counts), my task queue, notification feed, quick actions. |
| `/staff/cabinets` | `src/app/(app)/staff/cabinets/page.tsx` | Cabinet/folder browser for staff: view, bulk-move and route documents into workflows. |
| `/staff/performance` | `src/app/(app)/staff/performance/page.tsx` | Personal SLA, turnaround and 6-week throughput metrics. |
| `/staff/tasks` | `src/app/(app)/staff/tasks/page.tsx` | My tasks list with status/urgency filters and sorting. |
| `/supervisor` | `src/app/(app)/supervisor/page.tsx` | Team Overview: member × status matrix and open-items-by-cabinet from the purpose-built read models; row click opens a drawer with that member's open tasks, fetched on demand. |
| `/supervisor/approvals` | `src/app/(app)/supervisor/approvals/page.tsx` | Approvals queue — pending/escalated tabs, server-paginated, approve/reassign. |
| `/supervisor/bottlenecks` | `src/app/(app)/supervisor/bottlenecks/page.tsx` | Where work is stuck; SLA-breach banner, ageing/stage distributions and a server-paginated detail table with separate SLA-status and workflow-status columns. |
| `/supervisor/exceptions` | `src/app/(app)/supervisor/exceptions/page.tsx` | Control-exception register with acknowledge action. |
| `/supervisor/instances` | `src/app/(app)/supervisor/instances/page.tsx` | Workflow monitor: every started workflow instance, filterable by status/workflow, server-paginated; a drawer per row shows the stage rail, activity trail, and hold/resume/close actions. |
| `/supervisor/performance` | `src/app/(app)/supervisor/performance/page.tsx` | Team comparative SLA/throughput table with sparklines. |
| `/supervisor/workload` | `src/app/(app)/supervisor/workload/page.tsx` | Per-member load and utilization against a real capacity figure; expanding a row fetches and shows that member's open tasks for reassignment. |
| `/unauthorized` | `src/app/(app)/unauthorized/page.tsx` | Static access-denied page reached by the client-side route guard. |
| `/upload` | `src/app/(app)/upload/page.tsx` | Multi-file intake: classify, pick cabinet + folder (folder mandatory), chunked S3 upload, then register the document; a "Route to workflow" link appears once a file is filed. |

**Route handlers** (not screens): `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` — Next.js proxies in `src/app/api/auth/*/route.ts` that strip the refresh token into an HttpOnly cookie before returning the access token to the browser.

---

## Section 2 — API consumption

Paths are relative to `${NEXT_PUBLIC_API_URL}/api/v1` unless noted. **mock** means the call never leaves the browser.

### Global (every authenticated screen)

`src/components/layout/AppShell.tsx` verifies the session on mount for all `(app)` routes.

| Endpoint | Status |
|---|---|
| `GET /auth/me` | live |
| `GET /notifications/unread-count` (Topbar bell badge, polled every 60s) | live |
| `GET /notifications?channel=in_app&limit=6` (Topbar dropdown, only while open) | live |
| `PATCH /notifications/{id}/read` | live |
| `POST /notifications/read-all` | live |

### `/` — Login

| Endpoint | Status |
|---|---|
| `POST /api/auth/login` (Next proxy → backend `POST /api/v1/auth/login`) | live |

### `/admin`

| Endpoint | Status |
|---|---|
| `GET /users` | live |
| `GET /cabinets` | live |
| `GET /workflows?status=published` | live |

### `/admin/audit`

| Endpoint | Status |
|---|---|
| `GET /users` | live |
| audit log list | **mock** — `auditService.getAll()` returns `SEED.audit` |

### `/admin/branding`

| Endpoint | Status |
|---|---|
| branding read / update | **mock** — `brandingService`, returns `SEED.branding` |

### `/admin/cabinets`

| Endpoint | Status |
|---|---|
| `GET /cabinets` | live |
| `GET /cabinets/{id}` | live |
| `POST /cabinets` | live |
| `PATCH /cabinets/{id}` | live |
| `DELETE /cabinets/{id}` | live |
| `POST /cabinets/{id}/metadata-fields` | live |
| `DELETE /cabinets/{cabinetId}/metadata-fields/{fieldId}` | live |
| `GET /cabinets/{id}/access` | live |
| `POST /cabinets/{id}/access` | live |
| `DELETE /cabinets/{cabinetId}/access/{grantId}` | live |
| `GET /cabinets/{cabinetId}/folders` | live |
| `POST /cabinets/{cabinetId}/folders` | live |
| `DELETE /folders/{id}` | live |
| `GET /documents?cabinetId=&folderId=&page=&limit=20` — one expanded folder at a time, real server pages via `<Pagination>` | live |
| `GET /documents/{id}` (inline preview) | live |
| `PATCH /documents/{id}` (move a document to another cabinet/folder) | live |
| `GET /departments` | live |
| `GET /roles` | live |
| `GET /users` (all pages walked by `usersService.getAllPages`, for the access-grant/move person pickers) | live |
| `GET /users/{id}` | live |

### `/admin/circulars`

| Endpoint | Status |
|---|---|
| `GET /users` | live |
| circular list / create / update | **mock** — `circularsService`, `SEED.circulars` |

### `/admin/departments`

| Endpoint | Status |
|---|---|
| `GET /departments` | live |
| `POST /departments` | live |
| `PATCH /departments/{id}` | live |
| `DELETE /departments/{id}` | live |

### `/admin/policies`

| Endpoint | Status |
|---|---|
| policy read + control/confidentiality/urgency updates | **mock** — `policiesService`, `SEED.policies` |

### `/admin/users`

| Endpoint | Status |
|---|---|
| `GET /users?page=&limit=&departmentId=` | live |
| `POST /users` | live |
| `PATCH /users/{id}` | live |
| `GET /roles` | live |
| `POST /roles` | live |
| `PUT /roles/{id}/permissions` | live |
| `GET /departments` | live |
| policy control toggles (Groups tab) | **mock** — `policiesService` |

### `/admin/workflows`

| Endpoint | Status |
|---|---|
| `GET /workflows` | live |
| `POST /workflows` | live |
| `PATCH /workflows/{id}` | live |
| `POST /workflows/{id}/publish` | live |
| `POST /workflows/{id}/archive` | live |
| `GET /roles` | live |
| `GET /users` (all pages walked by `usersService.getAllPages`) | live |

### `/auditor`, `/auditor/findings` (= `/management/findings`), `/auditor/trail`

No network calls. All three read `findings`, `audit` and `users` from the zustand store (`SEED`). **mock**

### `/circulars`

No network calls — zustand store (`SEED.circulars`). **mock**

### `/notifications`

| Endpoint | Status |
|---|---|
| `GET /notifications?channel=in_app&unreadOnly=` | live |
| `PATCH /notifications/{id}/read` | live |
| `POST /notifications/read-all` | live |
| `GET /notifications/preferences` | live |
| `PUT /notifications/preferences` | live |

### `/doc/[id]`

| Endpoint | Status |
|---|---|
| `GET /documents/{id}` | live |
| `GET /cabinets` | live |
| `GET /cabinets/{cabinetId}/folders` | live |
| `GET /users` | live |
| `GET /workflow-instances?documentId=` | live |
| `GET /workflow-instances/{id}` | live |
| `GET /workflow-history?workflowInstanceId=&limit=20` (activity trail, via `WorkflowActivityPanel`) | live |
| `GET /workflows` (route-to-workflow picker, published only) | live |
| `POST /workflow-instances` then `POST /workflow-instances/{id}/start` (route to workflow) | live |
| `POST /documents/{id}/checkout` | live |
| `POST /documents/{id}/checkin` | live |
| `POST /documents/{id}/comments` | live — an in-file comment records this 404s on the deployed backend |
| `POST /documents/{id}/signatures` | live — same, 404s on the deployed backend |
| `POST /tasks/{id}/action` — `review`, `approve`, `request_changes`, `reject`, `delegate`, or `close`, gated by the current stage's `actions` | live |
| policy lookup (`usePolicies`) | **mock** |
| audit logging (`useCreateAuditLog`) | **mock** |

### `/management`, `/management/departments`, `/management/trends`

| Endpoint | Status |
|---|---|
| `GET /departments` | live |
| `GET /cabinets` | live |
| `GET /documents?page=&limit=100` — every page walked client-side by `fetchAllPages` | live |
| `GET /workflow-instances?page=&limit=100` — every page walked | live |
| `GET /tasks?page=&limit=100` — every page walked (`/management` and `/management/departments` only) | live |

### `/management/performance`

| Endpoint | Status |
|---|---|
| `GET /tasks?page=&limit=100` (all pages) | live |

### `/management/compliance` (= `/auditor/compliance`)

| Endpoint | Status |
|---|---|
| `GET /users` | live |
| audit log list | **mock** |
| findings table | **mock** — zustand store |

### `/management/reports`

| Endpoint | Status |
|---|---|
| audit logging on run/schedule | **mock** |

Report generation itself is not wired to anything — the run button toasts "Export simulated".

### `/platform`, `/platform/audit`, `/platform/billing`, `/platform/plans`, `/platform/sysconfig`, `/platform/flags`

No network calls. Entirely zustand store (`SEED.tenants`, `SEED.plans`, `SEED.featureFlags`, `SEED.audit`). **mock**

### `/search`

| Endpoint | Status |
|---|---|
| `GET /documents/search?q=` (when a query is typed) | live |
| `GET /documents` (when the query box is empty) | live |
| `GET /cabinets` | live |

Facets (cabinet, type, status, confidentiality, urgency) are applied client-side, not sent to the server.

### `/staff`

| Endpoint | Status |
|---|---|
| `GET /tasks` | live |
| `GET /workflow-instances/status-counts?scope=mine` (status tiles) | live |
| `GET /sla/breaches?scope=mine&status=open&limit=1` (Overdue/SLA tile count) | live |
| `GET /notifications?channel=in_app` | live |
| `PATCH /notifications/{id}/read` | live |

### `/staff/cabinets`

| Endpoint | Status |
|---|---|
| `GET /cabinets` | live |
| `GET /documents?cabinetId=&folderId=` | live |
| `GET /cabinets/{cabinetId}/folders` | live |
| `GET /users` | live |
| `GET /workflows` (route-to-workflow picker, filtered client-side to `status: 'published'`) | live |
| `PATCH /documents/{id}` (bulk move) | live |
| `POST /workflow-instances` then `POST /workflow-instances/{id}/start` (route to workflow, via the shared `useRouteToWorkflow` hook) | live |

### `/staff/performance`

| Endpoint | Status |
|---|---|
| `GET /tasks?scope=mine` | live |

### `/staff/tasks`

| Endpoint | Status |
|---|---|
| `GET /tasks?status=&urgency=` | live |

### `/supervisor`

| Endpoint | Status |
|---|---|
| `GET /workflow-instances/team-status-matrix` (member × status matrix; `departmentId` omitted — backend resolves the supervisor's own) | live |
| `GET /workflow-instances/open-items-by-cabinet` (same scoping) | live |
| `GET /users` | live |
| `GET /tasks?assigneeId=&status=pending&scope=all&limit=100` (row-click drawer, fetched on demand) | live |
| `PATCH /tasks/{id}/reassign` | live |
| audit logging | **mock** |

### `/supervisor/approvals`

| Endpoint | Status |
|---|---|
| `GET /tasks/approvals?scope=all&status=pending\|escalated&page=&limit=20` (purpose-built queue, not a generic `/tasks` filter; pending/escalated tabs) | live |
| `GET /users` | live |
| `POST /tasks/{id}/action` | live |
| `PATCH /tasks/{id}/reassign` | live |
| audit logging | **mock** |

### `/supervisor/bottlenecks`

| Endpoint | Status |
|---|---|
| `GET /workflow-instances/bottlenecks-ageing?page=&limit=20` (summary, ageing/stage distributions and detail rows in one call; `slaStatus` and `workflowStatus` are separate fields, rendered as separate badges) | live |
| `GET /users` | live |
| `PATCH /tasks/{id}/reassign` (gated by each row's `canReassign`/`currentTaskId`) | live |
| audit logging | **mock** |

### `/supervisor/workload`

| Endpoint | Status |
|---|---|
| `GET /tasks/workload` (per-member capacity/utilization; `departmentId` omitted) | live |
| `GET /users` | live |
| `GET /tasks?assigneeId=&status=pending&scope=all&limit=100` (fetched only once a member's row is expanded) | live |
| `PATCH /tasks/{id}/reassign` | live |
| audit logging | **mock** |

### `/delegations`

| Endpoint | Status |
|---|---|
| `GET /delegations?scope=mine&limit=100` | live |
| `GET /users` (delegate picker) | live |
| `GET /cabinets` (optional cabinet-scoped delegation) | live |
| `POST /delegations` | live |
| `POST /delegations/{id}/end` | live |

### `/supervisor/exceptions`

| Endpoint | Status |
|---|---|
| audit logging on acknowledge | **mock** |

The exception rows themselves are a hardcoded `useState` array in the page.

### `/supervisor/instances` (= `/admin/workflows/instances`)

| Endpoint | Status |
|---|---|
| `GET /workflow-instances?page=&limit=20&status=&workflowDefinitionId=` | live |
| `GET /workflows?limit=100` (workflow filter dropdown + stage-name lookup) | live |
| `GET /workflow-instances/{id}` (row-click drawer) | live |
| `GET /workflow-history?workflowInstanceId=&scope=all&order=desc&limit=` (drawer activity trail) | live |
| `POST /workflow-instances/{id}/hold` | live |
| `POST /workflow-instances/{id}/resume` | live |
| `POST /workflow-instances/{id}/close` | live |
| audit logging on hold/resume/close | **mock** |

### `/supervisor/performance`

No API calls at all — the whole page is hardcoded.

### `/upload`

| Endpoint | Status |
|---|---|
| `GET /cabinets` | live |
| `GET /cabinets/{cabinetId}/folders` | live |
| `POST /initialize`, `POST /presigned-url`, `POST /finalize` on `NEXT_PUBLIC_UPLOAD_BASE_URL` (separate AWS API Gateway host, no Authorization header) | live |
| `POST /documents` | live |
| `GET /workflows`, then `POST /workflow-instances` + `POST /workflow-instances/{id}/start` (optional "Route to workflow" link after a file is filed) | live |

### `/unauthorized`

Static page, no calls.

### Defined but never called from any screen

These services/hooks exist and point at real endpoints, but no page imports them:

`GET /delegations/{id}` (`useDelegation` — single-record fetch has a hook but no screen opens one this way; the list, create and end calls are now used — see `/delegations`), `GET /workflow-history/{id}` (the list endpoint `GET /workflow-history` is now called — see `/doc/[id]` and `/supervisor/instances`), `GET /tasks/stats`, `GET /workflow-instances/stats` (both have service + hook, unused — see the Workflow Module API guide's own note that these are basic statistics endpoints, not the full Team Performance/Management Dashboard, and are intentionally left for a later pass), `GET /documents/stats`, `GET|PUT /documents/{id}/metadata`, `GET|POST /documents/{id}/versions` (and `/restore`), `DELETE /documents/{id}`, `DELETE /users/{id}`, `DELETE /roles/{id}`, `PATCH /roles/{id}`, `PATCH /folders/{id}`, `GET /folders/{id}`, `PATCH /cabinets/{id}/metadata-fields/{fieldId}`, plus the legacy base64 uploaders in `s3.service.ts`. (`POST /workflow-instances/{id}/hold|resume|close`, `GET /workflow-instances/status-counts`, `GET /workflow-instances/team-status-matrix`, `GET /workflow-instances/open-items-by-cabinet`, `GET /workflow-instances/bottlenecks-ageing`, `GET /tasks/approvals`, `GET /tasks/workload` and `GET /sla/breaches` are now all called too — see `/supervisor/instances`, `/staff`, `/supervisor`, `/supervisor/approvals`, `/supervisor/bottlenecks` and `/supervisor/workload`.)

---

## Section 3 — Remaining mocks

| File | What it holds | Screens that consume it |
|---|---|---|
| `src/store/initialData.ts` | The master fixture (`SEED`, 1520 lines): users, cabinets, documents, notifications, circulars, workflows, roles matrix, tenants, findings, audit log, policies, feature flags, plans, saved searches, branding. | Everything below, directly or via `useStore` and the four mock services. |
| `src/store/useStore.ts` | Spreads `SEED` into a persisted zustand store and exposes the mutators the mock screens write through. | `/auditor`, `/auditor/findings`, `/auditor/trail`, `/circulars`, `/notifications`, `/platform`, `/platform/audit`, `/platform/billing`, `/platform/plans`, `/platform/sysconfig`, `/platform/flags`, `/management/compliance`, `/auditor/compliance`, `/management/findings`, `/search` (`docTypes`, `savedSearches`), `/upload` (`docTypes`), and all `/admin/*` for `auditAction` / `currentUser`. |
| `src/apis/services/audit.service.ts` | Returns `SEED.audit`; `logAction` is a no-op resolve. Carries `TODO: Replace with actual API call`. | `/admin/audit`, `/management/compliance`, `/auditor/compliance`, `/management/reports`, `/doc/[id]`, `/supervisor`, `/supervisor/approvals`, `/supervisor/bottlenecks`, `/supervisor/workload`, `/supervisor/exceptions` |
| `src/apis/services/branding.service.ts` | Returns `SEED.branding`; update echoes the patch back. | `/admin/branding` |
| `src/apis/services/circulars.service.ts` | Returns `SEED.circulars`; create/update/acknowledge are no-ops. | `/admin/circulars` |
| `src/apis/services/policies.service.ts` | Returns `SEED.policies`; all three update methods are no-ops. | `/admin/policies`, `/admin/users` (Groups tab), `/doc/[id]` |
| `src/app/(app)/supervisor/exceptions/page.tsx` | Four hardcoded exception rows in `useState`. | itself |
| `src/app/(app)/supervisor/performance/page.tsx` | Hardcoded team roster with SLA %, closed counts, turnaround and sparkline arrays, plus hardcoded KPI tiles. | itself |
| `src/app/(app)/management/reports/page.tsx` | Hardcoded "saved reports" schedule list; running a report only toasts. | itself |
| `src/app/(app)/staff/performance/page.tsx` | KPIs are computed from live tasks, but the "Rework rate 4.2%" tile and every "vs last period" delta are hardcoded strings. | itself |
| `src/hooks/usePermissions.ts` | Role-based permission heuristics used whenever the backend returns no `permissions` array; the file labels this "Mocking for now until backend matrix is ready". | `Guard` component and any permission check |
| `src/apis/utils/fetchAllPages.ts` | Not fixture data, but flagged in-file as an "INTERIM STOPGAP" standing in for missing server-side aggregation endpoints. Only `useAllDocuments`/`useAllWorkflowInstances` (`src/apis/hooks/useDocuments.ts`, `useWorkflowInstances.ts`) actually call it — `useTasks.ts` imports it but never calls it. | `/management`, `/management/departments`, `/management/trends` |
| `src/apis/services/tasks.service.ts` (`getAllPages`) / `src/apis/services/users.service.ts` (`getAllPages`) | Two separate, hand-rolled page-walking loops that duplicate `fetchAllPages.ts`'s idea (same "walk to `MAX_PAGES` of `MAX_LIMIT`" shape) without sharing its code. Not fixture data. | tasks: `/management/performance`, `/supervisor`, `/supervisor/bottlenecks`, `/supervisor/workload` — via `useAllTasks`. users: `/admin/cabinets`, `/admin/workflows` — via `useAllUsers` |

---

## Section 4 — State handling

Only screens that make at least one live call. ✅ implemented, ❌ absent.

| Screen | Loading | Error | Empty | 403 / permission-denied | Server pagination `{page, limit, total, totalPages}` |
|---|---|---|---|---|---|
| `/` | ✅ button shows "Authenticating…" | ✅ toast on failure | n/a | ❌ | n/a |
| `/admin` | ❌ | ❌ | ❌ | ❌ | ❌ — reads `pagination.total` for counters only |
| `/admin/audit` | ✅ `Spinner` | ✅ `ErrorMessage` + retry | ✅ via `Table` | ❌ | ❌ |
| `/admin/cabinets` | ✅ skeleton (full page + per-panel) | ✅ `ErrorMessage` + retry | ✅ cabinets, folders, fields, grants, documents | ❌ | ✅ per-folder document list only (`<Pagination>`); the cabinet/folder trees themselves are unpaginated API responses |
| `/admin/circulars` | ✅ | ✅ + retry | ✅ via `Table` | ❌ | ❌ |
| `/admin/departments` | ✅ | ✅ + retry | ✅ via `Table` | ❌ | ❌ |
| `/admin/users` | ✅ | ❌ | ✅ via `Table` | ❌ | ✅ — `useUsers({page, limit})` → `<Pagination>` |
| `/admin/workflows` | ✅ | ✅ inline message, no retry | ✅ "No workflows yet" | ❌ | ❌ |
| `/admin/workflows/instances` (= `/supervisor/instances`) | ✅ skeleton (`SkeletonTable`) | ❌ | ✅ via `Table` | ❌ | ✅ — `<Pagination>` on the instance list |
| `/doc/[id]` | ✅ skeleton | ❌ — a failed fetch falls through to the not-found panel | ✅ "Document not found" | ❌ | n/a |
| `/management` | ✅ | ❌ | ⚠️ partial — "No departments yet" only | ❌ | ❌ walks all pages client-side |
| `/management/compliance` | ✅ | ❌ | ✅ via `Table` | ❌ | ❌ |
| `/management/departments` | ✅ | ❌ | ✅ "No departments yet." | ❌ | ❌ walks all pages |
| `/management/performance` | ✅ | ❌ | ❌ | ❌ | ❌ walks all pages |
| `/management/trends` | ✅ | ❌ | ❌ | ❌ | ❌ walks all pages |
| `/management/reports` | ❌ | ❌ | n/a | ❌ | n/a |
| `/search` | ✅ | ❌ | ✅ "No results" panel | ❌ | ❌ |
| `/delegations` | ✅ | ✅ `ErrorMessage` + retry | ✅ `EmptyState` per direction (delegated-by-you / delegated-to-you) | ❌ | ❌ — `limit: 100`, no `<Pagination>` |
| `/staff` | ✅ | ✅ `ErrorMessage` + retry (tasks) | ✅ `EmptyState` for tasks and notifications | ❌ | ❌ |
| `/staff/cabinets` | ✅ skeleton (full page on first load; table/grid skeleton while switching folders) | ❌ — mutation failures toast only | ✅ "This folder is empty" — now correctly gated behind the loading check, so it can no longer flash before a folder switch's real data arrives | ❌ | ❌ |
| `/staff/performance` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/staff/tasks` | ✅ | ✅ `ErrorMessage` + retry | ✅ "No tasks in this view" | ❌ | ❌ |
| `/supervisor` | ✅ | ❌ — drawer's per-member task fetch has no error state | ✅ "No open items" (drawer) | ❌ | ❌ — matrix/by-cabinet are unpaginated aggregates; the drawer's task list is `limit: 100`, no `<Pagination>` |
| `/supervisor/approvals` | ✅ | ✅ `ErrorMessage` + retry | ✅ per tab (pending/escalated) | ❌ | ✅ — `<Pagination>` on the queue |
| `/supervisor/bottlenecks` | ✅ | ✅ `ErrorMessage` + retry | ✅ "No active SLA breaches" banner; `Table`'s built-in empty state for the detail rows | ❌ | ✅ — `<Pagination>` on the detail table |
| `/supervisor/instances` | ✅ skeleton (`SkeletonTable`) | ❌ | ✅ via `Table` | ❌ | ✅ — `<Pagination>` on the instance list |
| `/supervisor/workload` | ✅ | ✅ `ErrorMessage` + retry (workload); a member's expanded task list has no error state | ✅ "No open tasks" per expanded member | ❌ | ❌ — workload summary is an unpaginated aggregate; an expanded member's task list is `limit: 100` |
| `/upload` | ✅ folder select ("Loading folders…") + per-file upload progress | ❌ — failures toast only | ❌ | ❌ | n/a |

**403 handling — nothing screen-level exists anywhere.** The only permission behaviour is `AppShell`'s client-side route guard, which compares `currentUser.roles` against `src/config/routes.config.ts` and calls `router.replace('/unauthorized')` before render. A 403 returned by an actual API call is not distinguished from any other error: in `api-client.ts` a 403 is only inspected when it comes back from the *refresh* attempt, in which case the session is cleared. No query hook or screen branches on `error.response.status === 403`.

**Pagination.** `<Pagination>` (`src/components/ui/Pagination.tsx`) takes `{page, totalPages, total, limit}` straight from the API envelope. Six places render it: `/admin/users`, `/supervisor/instances` (= `/admin/workflows/instances`), `/supervisor/approvals`, `/supervisor/bottlenecks`, `/notifications`, and the per-folder document list inside `/admin/cabinets`. Every other list either fetches the server default page and filters/sorts in the browser, or walks every page and concatenates client-side — via the shared `fetchAllPages.ts` (`/management`, `/management/departments`, `/management/trends`) or `tasksService.getAllPages` (`/management/performance`) or `usersService.getAllPages` (`/admin/cabinets`, `/admin/workflows`, and the access-grant/move pickers). `/supervisor`, `/supervisor/workload` and `/delegations` now read from purpose-built aggregate endpoints (`team-status-matrix`, `open-items-by-cabinet`, `tasks/workload`) that return the whole result in one unpaginated call rather than walking `/tasks` — a real reduction in request volume even without a `<Pagination>` control of their own; only the on-demand per-member task lists they open (capped at `limit: 100`) have no pager.

**Loading skeletons.** `src/components/common/Skeleton.tsx` (`Skeleton`, `SkeletonText`, `SkeletonTreeRows`, `SkeletonTable`) wires up the `.skel` shimmer that already existed in `globals.css` but had no component using it. Used by `/admin/cabinets`, `/staff/cabinets`, `/doc/[id]`, `/supervisor/instances` and `/admin/workflows/instances` (via `WorkflowInstanceMonitor`/`WorkflowInstanceDetail`). Every other screen's "✅" in the Loading column above is still `<Spinner>` (`src/components/common/Spinner.tsx`) or an inline "Loading…" string, not a skeleton.

**Layout overflow.** `.cab-layout` (`/admin/cabinets`, `/staff/cabinets`) and `.search-layout` (`/search`) are a fixed-sidebar + content grid (or, on `/admin/cabinets`, an equivalent flex row); grid/flex items default to `min-width: auto`, so a wide `<Table>` in the content column — most columns are `white-space: nowrap` — forced the track past the viewport instead of scrolling inside its own `.tbl-wrap`. Fixed by adding Tailwind's `min-w-0` (the utilities layer is already imported in `globals.css`) to the content-column element on all three screens.

---

## Section 5 — Auth

**Token storage.** Two tokens, two stores:

- **Access token** — a JavaScript-readable `js-cookie` cookie named `accessToken`, set by `authService.login()` and by `refreshAccessToken()` with `{ expires: 1 day, secure: NODE_ENV === 'production', sameSite: 'strict' }`. Readable by page scripts, so it is not XSS-protected.
- **Refresh token** — never reaches client JavaScript. Login goes to the Next.js proxy `POST /api/auth/login`, which strips `refreshToken` out of the backend response and sets it as an HttpOnly, `sameSite: 'lax'`, path `/`, 7-day cookie before returning the rest to the browser (`src/app/api/auth/login/route.ts`).

The authenticated user object is held in zustand (`useStore.currentUser`, persisted), and `AppShell` re-validates it against `GET /auth/me` on every mount.

**Attachment.** A request interceptor on the shared axios instance ([api-client.ts:62](src/lib/api-client.ts#L62)) reads the `accessToken` cookie and sets `Authorization: Bearer <token>` on every outgoing request. Requests made outside that instance — the three `/api/auth/*` proxy calls and the S3/multipart upload calls — carry no Authorization header.

**Refresh on 401 — implemented.** The response interceptor ([api-client.ts:93](src/lib/api-client.ts#L93)):

1. On a 401 with `!originalRequest._retry`, marks the request and calls `refreshAccessToken()`, a promise singleton so concurrent 401s share one refresh.
2. Concurrent failures queue in `failedQueue` and are replayed with the new token once the refresh resolves.
3. `refreshAccessToken()` posts to the Next proxy `POST /api/auth/refresh`, which reads the HttpOnly `refreshToken` cookie, calls the backend, rotates the cookie, and returns the new access token — which is written back to the `accessToken` cookie.
4. Cross-tab races are handled with a `localStorage` timestamp (`__edms_last_refresh_ts`): if the refresh fails but another tab refreshed within the last 4 seconds, the request is retried with whatever token is now in the cookie instead of logging out.
5. If the refresh genuinely fails (401/403, or no token in the response), the access cookie is removed and the browser is hard-redirected to `/`.

The refresh route deliberately does *not* delete the refresh cookie on a failed refresh, to avoid killing a session during a cross-tab race.

**Tenant identifier — none is sent.** No header (`X-Tenant-Id` or otherwise), query parameter, or request-body field carries a tenant/org id anywhere in the codebase. The axios instance sets only `Content-Type` and `Authorization`. Tenancy exists in the UI purely as fixture data: `SEED.tenants` drives the `/platform/*` screens, and `/admin/audit` filters its (mock) rows with a hardcoded `a.tenant === 't-1'`. Real tenant scoping is presumably derived server-side from the bearer token.
