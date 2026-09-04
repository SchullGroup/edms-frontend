# 05 — Implementation Status by Role Dashboard

**Status:** Written 2026-08-29. Every row verified against the source.

**Revised 2026-09-04** against `edms-backend` @ `dev` (`b72e0bf`, 83 routes) and
`EDMS-FRONTEND` @ `dev` (`f02c7b8`). Two findings changed: **document routing is fixed**
(the two-call create-then-start sequence shipped) and **the notifications module now
exists** on both sides — but nothing calls `notifyUser`, so no notification is ever
created. Superseded statements are struck through or marked in place rather than
deleted. See `01-architecture-and-drift.md` for the full revision table.


For each of the six role dashboards this document lists:

- **Every page**, with its line count and exact data source
- **APIs wired** — endpoints the page really calls
- **APIs missing** — endpoints it needs that don't exist
- **Dummy data** — precisely which fixtures it renders and where they live
- **Flows working / flows broken** — end-to-end, with the reason
- **What's left** — a concrete, ordered build list

---

## Table of contents

- [How to read the status markers](#how-to-read-the-status-markers)
- [Portfolio summary](#portfolio-summary)
- [The three kinds of dummy data](#the-three-kinds-of-dummy-data)
- [1. Staff Workspace](#1-staff-workspace-staff)
- [2. Supervisor Console](#2-supervisor-console-supervisor)
- [3. Management Portal](#3-management-portal-management)
- [4. Client Administration](#4-client-administration-client_admin)
- [5. Audit & Compliance](#5-audit--compliance-internal_auditor)
- [6. SchullTech Platform Admin](#6-schulltech-platform-admin-schulltech_admin)
- [Shared pages](#shared-pages-used-by-multiple-roles)
- [Backend endpoints with no UI](#backend-endpoints-with-no-ui)
- [Frontend calls with no backend](#frontend-calls-with-no-backend)
- [Consolidated build backlog](#consolidated-build-backlog)

---

## How to read the status markers

| Marker | Meaning |
|---|---|
| ✅ **Live** | Renders real data from the backend. The flow works end to end. |
| 🟨 **Hybrid** | Calls real APIs **and** reads `SEED` fixtures on the same page. Partly real. |
| 🟥 **Mock** | Every value comes from `src/store/initialData.ts` or a hardcoded array. Nothing persists. |
| ⛔ **Broken** | Calls an endpoint that does not exist, or is otherwise non-functional. |
| ↪️ **Re-export** | The route renders another page's component. |

---

## Portfolio summary

**42 pages across 6 role dashboards.** Every classification below was verified by
inspecting what each page destructures from `useStore` versus which API hooks it calls.

> **Classification rule.** Reading `currentUser` / `prefs` from the store is *legitimate
> client session state* and does not make a page hybrid. A page is **Hybrid** only when it
> renders `SEED` **domain** data (documents, users, findings, audit, tenants…) alongside
> live API data, or depends on one of the four mock service modules.

| Dashboard | Pages | ✅ Live | 🟨 Hybrid | 🟥 Mock | Verdict |
|---|---:|---:|---:|---:|---|
| Staff Workspace | 4 | 3 | 1 | — | **Strongest.** Real data throughout. |
| Supervisor Console | 6 | 3 | 1 | 2 | Approvals and ageing real; exceptions/performance fixture. |
| Management Portal | 7 | 4 | 1 | 2 | The only fully API-driven pages — and the ones that don't scale. |
| Client Administration | 8 | 3 | 1 | 4 | Structure real; policy/branding/circulars/audit mock. |
| Audit & Compliance | 4 | — | — | 4 | **Weakest. Zero API calls.** |
| Platform Admin | 6 | — | — | 6 | Mock by design (Phase 2). |
| Shared | 7 | 2 | 2 | 2 | Login and upload real; notifications and circulars fixture. |
| **Total** | **42** | **15** | **6** | **20** | |

*(41 classified + `/unauthorized`, which is static markup.)*

### By data source

```
Calls the backend API      █████████████████████░░░░░░░░░░░░░░░░░░░  21 pages (50%)
Renders SEED domain data   ███████████████████████░░░░░░░░░░░░░░░░░  23 pages (55%)
Both, on the same page     ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   6 pages (14%)
Neither (inline / nothing) ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3 pages (7%)
```

The split is cleaner than it first looks: most pages are decisively one thing or the other.
The **20 mock pages cluster almost entirely in three dashboards** — Auditor (4/4), Platform
(6/6), and the governance half of Client Admin (4/8). The operational dashboards — Staff,
Supervisor, Management — are largely wired.

### The four mock service modules

Four pages appear "wired" because they call a hook, but the hook resolves a fixture:

| Hook | Service | Actually returns |
|---|---|---|
| `useAuditLogs`, `useCreateAuditLog` | `audit.service.ts` | `SEED.audit` after `setTimeout(400)` |
| `usePolicies`, `useUpdatePolicy*` | `policies.service.ts` | `SEED.policies` |
| `useBranding`, `useUpdateBranding` | `branding.service.ts` | `SEED.branding` |
| `useCirculars`, `useAcknowledgeCircular` | `circulars.service.ts` | `SEED.circulars` |

`useCreateAuditLog()` in particular is called from **seven** pages and resolves
successfully every time without doing anything. That is why so many admin and supervisor
actions produce a success toast for an operation that was never recorded.

## The three kinds of dummy data

Not all fixtures are the same, and the fix differs for each.

### Type 1 — `SEED` in the Zustand store *(the big one)*

`src/store/initialData.ts` — **1,520 lines**, spread into `useStore` and **persisted to
`localStorage` under `edms-state-v3`**.

Contains: `USERS`, `documents`, `cabinets`, `workflows`, `audit`, `notifications`,
`circulars`, `findings`, `tenants`, `plans`, `featureFlags`, `policies`, `rolesMatrix`,
`branding`, `prefs`, `docTypes`, `session`, `seq`.

**Why it's the worst kind:** it is persisted, so a stale snapshot survives rebuilds and
redeploys. `version: 3` bumps the key but there is no migration. Roughly 25 store mutators
(`updateTenant`, `addFinding`, `updateBranding`, …) write to it, so the UI produces
convincing success toasts for operations that never leave the browser.

### Type 2 — mock service modules

Five files in `src/apis/services/` return `SEED` slices after a `setTimeout(400)` to
simulate latency:

| File | Returns | Marked |
|---|---|---|
| `audit.service.ts` | `SEED.audit` | `// TODO: Replace with actual API call when backend is ready` |
| `branding.service.ts` | `SEED.branding` | same |
| `circulars.service.ts` | `SEED.circulars` | same |
| `policies.service.ts` | `SEED.policies` | same |

**Why it's the best kind:** these are honest, isolated and clearly labelled. Swapping each
for `apiClient` calls is a contained change once the endpoints exist. This is the pattern
the other two should be migrated toward.

### Type 3 — inline hardcoded arrays

Fixtures declared directly inside a component, invisible to any `SEED` audit:

| Page | Constant | What it fakes |
|---|---|---|
| `upload/page.tsx` | `IDU_GUESSES` (4 entries) | The entire "Intelligent Document Understanding" classification, including confidence percentages |
| `supervisor/exceptions/page.tsx` | `useState([...])` (4 rows) | SoD conflicts, control failures, access anomalies |
| `management/reports/page.tsx` | `DEPTS` | The department list in the report builder |

**Why it's the sneakiest kind:** `IDU_GUESSES` presents fabricated ML output with a
confidence badge, in the product's most prominent flow. Nothing about the UI signals that
it is fixed data.

---

## 1. Staff Workspace (`staff`)

**Landing:** `/staff` · **Sidebar:** Workspace / Documents / Communication / Insights
**Overall: 🟨 The strongest dashboard.** Capture and filing genuinely work.

### Page inventory

*Owned pages. `/upload`, `/search`, `/doc/[id]`, `/circulars` and `/notifications` are
shared — see [Shared pages](#shared-pages-used-by-multiple-roles).*

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/staff` | 283 | `currentUser` | `useTasks` ✅ · `useNotifications` ⛔ | ✅ Live (notification panel dead) |
| `/staff/tasks` | 162 | `currentUser` | `useTasks` ✅ | ✅ Live |
| `/staff/cabinets` | 423 | `session`, **`users`** | `useCabinets`, `useCabinetFolders`, `useDocuments` ✅ | 🟨 Hybrid — names resolved from `SEED.USERS` |
| `/staff/performance` | 212 | `currentUser` | `useDocuments`, `useTasks` ✅ | ✅ Live |

### APIs wired ✅

```
GET  /tasks                                  task queue
GET  /documents            + filters         cabinet/folder browsing
GET  /documents/:id                          document detail
POST /documents                              upload
GET  /cabinets                               cabinet list
GET  /cabinets/:cabinetId/folders            folder tree
POST /documents/:id/checkout   /checkin      lock lifecycle
GET  /documents/:id/versions                 version history
POST /documents/:id/versions                 new version
GET  /documents/:id/metadata                 metadata read
PUT  /documents/:id/metadata                 metadata write
GET  /documents/search                       ⚠️ works but always returns [] (index never built)
```

### APIs missing ⛔

| Needed | Status | Impact |
|---|---|---|
| `POST /workflow-instances` + `/:id/start` | Frontend calls the wrong URL (DRIFT-09) | **Cannot route a document for approval** |
| `GET/PATCH /notifications*` | Backend module is an empty directory | Bell badge and notification panel dead |
| `POST /documents/:id/comments` | Not built | Cannot add context to a document |
| `GET /documents/:id/download` | Not built | No way to retrieve the file |
| `GET /circulars`, `POST /circulars/:id/ack` | No model, no endpoint | Circulars page is fixture-only |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/circulars` | `SEED.circulars` | Acknowledgements vanish on cache clear |
| Sidebar badges | `SEED.documents`, `SEED.notifications` | Counts don't match the real task queue |
| `/upload` IDU card | `IDU_GUESSES` inline | Fake classification with a fake confidence score |
| `/staff/performance` | partly `SEED.documents` | Personal stats blend real and fabricated |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Log in → land on `/staff` | ✅ | |
| Browse cabinets → folders → documents | ✅ | ⚠️ cabinet grants not enforced on reads |
| Upload → checksum → storage → create | ✅ | ⚠️ 2 MB cap, PDF/images only, external gateway |
| Open a document, view metadata + versions | ✅ | |
| Check out → edit → check in | ✅ | ⚠️ only the holder can release the lock |
| Upload a new version | ✅ | Auto-increments |
| **Route for approval** | ⛔ | **404 — the single biggest blocker for this role** |
| Search by content | ⛔ | Index never built (OCR always fails) |
| Work the task queue | ✅ | Prioritised by urgency then due date |
| Act on a task | ✅ | |
| Receive a notification | ⛔ | Endpoints 404 with an HTML body |
| Comment on a document | ⛔ | 404 |
| Read/acknowledge a circular | 🟥 | localStorage only |

### What's left, in order

1. **Fix routing** — two-call `POST /workflow-instances` then `/:id/start`. *~1 hour. Unblocks the entire approval half of the product.*
2. **Fix the upload→OCR bucket** so search works at all.
3. **Build notifications** (backend module + wire the bell).
4. **Add `POST /documents/:id/comments`.**
5. **Add a download endpoint** gated by `requireConfidentiality('download')`.
6. **Replace `IDU_GUESSES`** with real extraction, or clearly label it as a preview.
7. **Render cabinet metadata fields** in the upload form.
8. **Drive sidebar badges from the API** instead of `SEED`.
9. **Raise the file-size cap** and support the document types the allowlist already claims.

---

## 2. Supervisor Console (`supervisor`)

**Landing:** `/supervisor` · **Sidebar:** Oversight / Quality / Documents
**Overall: 🟨 Approvals are real; oversight is half-fixture.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/supervisor` | 320 | `currentUser` | `useDocuments`, `useUsers`, `useCabinets` ✅ · `useCreateAuditLog` 🟥 | 🟨 Hybrid — audit hook is a no-op |
| `/supervisor/approvals` | 185 | `currentUser` | `useTasks`, `useDocuments` ✅ | ✅ Live |
| `/supervisor/bottlenecks` | 164 | `currentUser` | `useDocuments`, `useUsers` ✅ | ✅ Live — ⚠️ **but "Overdue" is always 0** |
| `/supervisor/workload` | 191 | `currentUser` | `useDocuments`, `useUsers` ✅ | ✅ Live |
| `/supervisor/exceptions` | 73 | — | **inline `useState` array** | 🟥 Mock |
| `/supervisor/performance` | 86 | — | **none** | 🟥 Mock |

### APIs wired ✅

```
GET   /tasks                    ?scope=all for oversight roles
POST  /tasks/:id/action         approve | reject | request_changes | close
PATCH /tasks/:id/reassign       gated by TASK_REASSIGN_ROLES
GET   /documents                team documents
GET   /users                    team roster
GET   /cabinets                 cabinet context
```

### APIs missing ⛔

| Needed | Status | Impact |
|---|---|---|
| `GET /sla-breaches` or breach data on tasks | `SlaBreach` rows exist; **no endpoint reads them** | Bottlenecks page invents ageing from `SEED` |
| `GET/POST /delegations`, `POST /delegations/:id/end` | **Backend complete, no UI** | A supervisor on leave cannot hand over |
| Team aggregation endpoint | Not built | Workload counts computed client-side |
| Notifications | Module missing | No SLA warning ever reaches them |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/supervisor/exceptions` | 4 hardcoded rows in `useState` | SoD conflicts, control failures and access anomalies are entirely invented |
| `/supervisor/performance` | none — static markup | The page shows nothing real |
| `useCreateAuditLog` (4 pages) | `audit.service.ts` stub | Every "action logged" toast is false |

### ⚠️ The overdue bug — `/supervisor/bottlenecks`

The page is genuinely live: it reads `useDocuments()` and `useUsers()` and computes ageing
in days from each document's real `createdAt`. **But its breach count is permanently zero.**

```ts
const aged = open.map(d => ({ …, overdue: effStatus(d) === 'Overdue' }));
const breaches = aged.filter(a => a.overdue);   // always []
```

`effStatus()` (there are **two** divergent copies — `store/useStore.ts:235` and
`utils/helpers.ts:1`) returns `'Overdue'` only when `doc.due` / `doc.dueDate` is in the
past. **The backend `Document` model has no due-date field at all** — `grep due` over
`filing.prisma` returns nothing. Both copies also compare capitalized statuses
(`'Closed'`, `'On Hold'`) against the backend's lowercase values.

`effStatus()` is therefore an identity function on every API-sourced document. It works
only on `SEED` fixtures. See DRIFT-13 in doc 01 — it affects **8 call sites**, including
`TaskRow`, so every overdue badge and ageing bucket in the product reads zero.

The page also **recomputes ageing rather than reading the real `SlaBreach` table**, which
already holds warning and escalation rows written by the SLA worker.

### Flows

| Flow | Status | Detail |
|---|---|---|
| See the approvals queue | ✅ | Direct + role-pool + delegated assignment all resolve |
| Open and review a document | ✅ | ⛔ no download for offline review |
| Approve / reject / request changes with a note | ✅ | History written with `elapsedSeconds` |
| Reassign a task | ✅ | Gated correctly |
| See team workload | 🟨 | Real, but walks up to 50 pages client-side |
| See ageing / bottlenecks | 🟨 | Ageing real; **overdue count permanently 0** (DRIFT-13); ignores `SlaBreach` |
| Get warned before an SLA breach | ⛔ | Worker detects it and tells nobody |
| Delegate while on leave | ⛔ | **No UI exists** |
| Review exceptions | 🟥 | Hardcoded |
| Export team stats | ✅ | CSV |

### What's left, in order

1. **Build the delegation UI** — the backend is finished and unreachable. *Highest value for this role.*
2. **Fix `effStatus()`** — delete one of the two copies, derive overdue from the task's
   `dueAt` or the instance's `stageDueAt` (both of which exist), and normalise status
   casing at the API boundary. *Small fix, 8 call sites, restores every overdue indicator
   in the product.*
3. **Expose SLA breach data** and point `/supervisor/bottlenecks` at it.
4. **Build notifications** so SLA warnings actually arrive.
5. **Replace `/supervisor/exceptions`** with real SoD/control-failure detection, or remove it.
6. **Give `/supervisor/performance` a data source.**
7. **Add a team-aggregation endpoint** to replace the client-side page walking.
8. **Allow an admin/supervisor to force-release a stale checkout lock** (there is an explicit `TODO` in `documents.service.ts`).

---

## 3. Management Portal (`management`)

**Landing:** `/management` · **Sidebar:** Dashboards / Governance / Reporting
**Overall: 🟨 The numbers are real. The method will not scale.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/management` | 276 | **none** | `useDepartments`, `useCabinets`, `useAllDocuments`, `useAllTasks`, `useAllWorkflowInstances` ✅ | ✅ Live ⚠️ client-side aggregation |
| `/management/departments` | 176 | **none** | 5 hooks ✅ | ✅ Live ⚠️ same |
| `/management/trends` | 186 | **none** | 4 hooks ✅ | ✅ Live ⚠️ same |
| `/management/performance` | 43 | **none** | `useAllTasks` + `taskSlaRate` ✅ | ✅ Live ⚠️ same |
| `/management/compliance` | 169 | **`findings`** | `useUsers` ✅ · `useAuditLogs` 🟥 | 🟨 Hybrid |
| `/management/reports` | 161 | — | **inline `DEPTS`** · `useCreateAuditLog` 🟥 | 🟥 Mock |
| `/management/findings` | 7 | — | ↪️ re-exports `/auditor/findings` | 🟥 Mock |

> **Management is the only dashboard with fully API-driven pages** — four of its seven read
> no fixtures at all. It is also the dashboard whose method scales worst, because those
> four compute every aggregate in the browser.

### APIs wired ✅

```
GET /departments                  tree, flattened client-side
GET /cabinets                     cabinet → department mapping
GET /documents        (paginated) ⚠️ via fetchAllPages — up to 50 requests
GET /tasks            (paginated) ⚠️ via fetchAllPages
GET /workflow-instances (paginated) ⚠️ via fetchAllPages
GET /users                        headcount per department
```

### APIs missing ⛔ — the defining gap for this role

**The backend has no aggregation, statistics or reporting endpoints of any kind.**

| Needed | Currently |
|---|---|
| `GET /stats/documents?groupBy=department&from=&to=` | 50 requests + JS reduce |
| `GET /stats/sla-compliance?groupBy=department` | Recomputed in JS; **ignores `SlaBreach`** |
| `GET /stats/turnaround?groupBy=month` | JS month-bucketing |
| `GET /stats/workload?groupBy=user` | JS |
| `GET /findings` | 🟥 No `Finding` model exists |
| `GET /audit` | 🟥 No endpoint; `internal_auditor` already holds `audit:view` |
| Scheduled/emailed reports | No scheduler, no mail transport |

### The cost, quantified

```
One /management page load:
  useAllDocuments()          → up to 50 × 100 records
  useAllTasks()              → up to 50 × 100 records
  useAllWorkflowInstances()  → up to 50 × 100 records
  ─────────────────────────────────────────────────
  up to 150 sequential HTTP requests
  up to 15,000 records parsed and aggregated in the browser
```

`fetchAllPages.ts` says so itself: *"INTERIM STOPGAP… reconstructing in the browser what a
single SQL aggregate query would do on the server. Replace call sites with real aggregation
endpoints once the backend adds them, and delete this file."*

Invisible at demo scale. A 30-second page load at 10,000 documents.

### Dummy data 🟥

| Where | Fixture |
|---|---|
| `/management/compliance` | `useAuditLogs` → `SEED.audit`, plus `SEED` blends |
| `/management/reports` | inline `DEPTS`; the report builder produces nothing real |
| `/management/findings` | ↪️ auditor's page → `SEED.findings` |
| SLA compliance figures | derived from documents/tasks, **not** from `SlaBreach` |

### Flows

| Flow | Status |
|---|---|
| Organisation overview | 🟨 real data, client-side aggregation |
| Compare departments | 🟨 same |
| Trends over time | 🟨 same; no forecasting despite the page title |
| Performance overview | 🟨 thin — 43 lines |
| Compliance posture | 🟥 mock audit data |
| Findings review | 🟥 re-export of a mock page |
| Export CSV | ✅ |
| Scheduled report by email | ⛔ |

### What's left, in order

1. **Build aggregation endpoints**, then delete `fetchAllPages.ts` as its header asks. *Largest single backend gap for this role.*
2. **Build `Finding`** — model, endpoints, and a management-oriented view (owner, ageing, department rollup) rather than a re-export.
3. **Build the audit module** so compliance posture stops being fabricated.
4. **Compute SLA compliance from `SlaBreach`**, not from re-derived document dates.
5. **Make `/management/reports` generate real reports.**
6. **Correct the frontend permission heuristic** — `usePermissions` grants management
   approve/reject rights the backend never issued. Fix this *with* DRIFT-05, or management's
   buttons will start 403-ing and look like a regression.

---

## 4. Client Administration (`client_admin`)

**Landing:** `/admin` · **Sidebar:** Administration / Configuration / Communication / Governance
**Overall: 🟨 Structure is real. Policy, branding and circulars are localStorage.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/admin` | 114 | `currentUser` | `useUsers`, `useCabinets` ✅ | ✅ Live |
| `/admin/users` | 423 | **`rolesMatrix`, `policies`** + `updateRoleMatrix` | `useUsers` + mutations ✅ | 🟨 Hybrid — ⚠️ **the role matrix writes to `SEED`, not the API** |
| `/admin/cabinets` | 346 | `auditAction` only | `useCabinets`, `useCabinetFolders`, `useDepartments` ✅ | ✅ Live |
| `/admin/workflows` | 493 | `auditAction` only | `useWorkflows` + mutations ✅ · `@ts-nocheck` | ✅ Live ⚠️ **no authorization on the endpoints** |
| `/admin/policies` | 244 | `auditAction` | `usePolicies` 🟥 | 🟥 Mock |
| `/admin/branding` | 397 | `auditAction` | `useBranding` 🟥 | 🟥 Mock |
| `/admin/circulars` | 263 | `auditAction`, `currentUser` | `useCirculars` 🟥 | 🟥 Mock |
| `/admin/audit` | 150 | — | `useAuditLogs` 🟥 · `useUsers` ✅ | 🟥 Mock |

### APIs wired ✅

```
GET/POST/PATCH/DELETE  /users              full lifecycle
POST   /users/:id/roles                    role assignment
DELETE /users/:id/roles/:roleId            role removal
GET    /roles                              role list
GET/POST/PATCH/DELETE  /cabinets
GET/POST  /cabinets/:cabinetId/folders
PATCH/DELETE /folders/:id
GET/POST/PATCH/DELETE  /departments
GET/POST/PATCH  /workflows
POST   /workflows/:id/publish  /archive
```

### APIs missing ⛔

| Needed | Backend status | Impact |
|---|---|---|
| `POST/PATCH/DELETE /cabinets/:id/metadata-fields` | **Exists — no UI** | No cabinet has metadata fields |
| `GET/POST /cabinets/:id/access`, `DELETE .../:grantId` | **Exists — no UI** | **Cannot grant cabinet access to anyone** |
| `PUT /roles/:id/permissions` | **Exists — UI writes to `SEED` instead** | Permission edits silently don't persist |
| `POST /users/invite` | Not built | Admin sets and communicates every password |
| Password reset | Not built | |
| Retention policy CRUD + enforcement job | Model only | Nothing ever expires |
| Branding model + endpoints | Not built | Theming resets on cache clear |
| Circulars model + endpoints | Not built | |
| `GET /audit` | Not built | Tenant audit view is fabricated |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/admin/policies` | `SEED.policies` | Confidentiality/urgency/control config is decorative |
| `/admin/branding` | `SEED.branding` | ⚠️ **Theming genuinely applies** via CSS custom properties in `AppShell`, including a dark-mode `lighten()` — so it looks completely real and persists nowhere |
| `/admin/circulars` | `SEED.circulars` | |
| `/admin/audit` | `SEED.audit` | |
| Role matrix editor | `SEED.rolesMatrix` via `updateRoleMatrix` | **Permission changes appear to save and don't** |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Create departments | ✅ | ⚠️ 200 cap, no cycle detection |
| Create cabinets, assign to departments | ✅ | ⚠️ 100 cap |
| Build folder trees | ✅ | ⚠️ `folderId` not validated against `cabinetId` |
| Define cabinet metadata fields | ⛔ | Backend done, no UI |
| Grant cabinet access | ⛔ | Backend done, no UI |
| Create users with dept + roles | ✅ | ⛔ no invite flow |
| Assign / remove roles | ✅ | |
| Deactivate a user | ✅ | Login then 403 |
| Edit the role permission matrix | ⛔ | Writes to localStorage, not the API |
| Design and publish a workflow | ✅ | ⛔ **but so can any authenticated user** |
| Configure retention policy | 🟥 | |
| Apply branding | 🟥 | Applies visually, persists nowhere |
| Publish a circular | 🟥 | |
| Review the tenant audit trail | 🟥 | |

### What's left, in order

1. **Build the cabinet access-grant UI** — the need-to-know model is currently unreachable.
   **Ship it together with backend read-path enforcement**, or fixing one without the other
   locks every non-admin out of everything.
2. **Point the role matrix editor at `PUT /roles/:id/permissions`.** *Silent data loss today.*
3. **Build the cabinet metadata-field designer** — backend is complete.
4. **Add `POST /users/invite`** + mail transport + password reset + login rate limiting.
5. **Add authorization to the workflow endpoints** (backend — DRIFT-05).
6. **Build branding**: model, endpoints, logo upload.
7. **Build circulars**: model, endpoints, audience targeting, acknowledgement tracking.
8. **Build retention**: endpoints + an enforcement job.
9. **Build the audit module** and point `/admin/audit` at it.
10. **Remove `@ts-nocheck`** from `/admin/workflows`.

---

## 5. Audit & Compliance (`internal_auditor`)

**Landing:** `/auditor` · **Sidebar:** Review / Findings / Posture
**Overall: 🟥 Every page is fixture data. The weakest dashboard in the product.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/auditor` | 128 | `findings`, `audit`, `users` | **none** | 🟥 Mock |
| `/auditor/trail` | 172 | `audit`, `users`, `auditAction` | **none** | 🟥 Mock |
| `/auditor/findings` | 367 | `findings`, `users`, `addFinding`, `updateFinding` | **none** | 🟥 Mock |
| `/auditor/compliance` | 7 | — | ↪️ re-exports `/management/compliance` | 🟥 Mock |

*The auditor also uses the shared `/staff/cabinets` (✅ live) and `/search` (⛔ empty).*

### APIs wired

**None.** Not one page in this dashboard calls the backend. `useAuditLogs` resolves
`SEED.audit` after a `setTimeout`.

### APIs missing ⛔

| Needed | Backend status |
|---|---|
| `GET /audit` with actor / object / action / date filters | **No endpoint** — yet `internal_auditor` holds `audit:view:global` |
| `GET /audit/verify` (hash-chain integrity proof) | Not built |
| `GET/POST/PATCH /findings` | **No `Finding` model in Prisma at all** |
| `GET /cabinets/:id/access` (who can see this cabinet) | Endpoint exists; **no screen calls it**, though `cabinet_access:view` is granted |
| Document view/download logging | No download endpoint; views not logged |
| SoD violation detection | No logic anywhere |

### The core problem

```
DESIGNED in audit.prisma                     BUILT
──────────────────────────────────────────   ─────────────────────────────
Append-only via an INSERT-only Postgres      ⛔ role never created
  role — no code, admin, or migration
  can UPDATE/DELETE
Hash chain: entryHash = SHA-256(id +         ⛔ never computed
  actor + action + object + time + prevHash)
Indexes: object history, actor timeline,     ✅ exist — on an empty table
  action filter, time range
Monthly range partitioning                   ⛔ not applied
25 documented action types                   ⛔ none ever emitted
AuditService.log() on every mutation,        ⛔ no AuditService exists;
  view and download                             audit.middleware.ts is 0 bytes
```

**Zero references to `auditEntry` exist in the backend `src/`. The table has never been
written to.**

### Flows

| Flow | Status |
|---|---|
| View the audit trail | 🟥 `SEED.audit` |
| Filter by actor / object / action / date | 🟥 filters fixture data |
| Verify chain integrity | ⛔ |
| Sample documents | ✅ shared `/staff/cabinets` |
| Search for evidence | ⛔ index never built |
| Raise a finding | 🟥 localStorage |
| Assign an owner and due date | 🟥 localStorage |
| Track a finding to closure | 🟥 localStorage |
| Review compliance posture | 🟥 re-export of a partly-mock page |
| See who can access a cabinet | ⛔ |
| Export evidence for a regulator | ⛔ would export fixtures |

### What's left, in order

1. **Build the audit module.** Model exists; needs `AuditService.log()` called from every
   mutating service, plus view and download logging.
2. **Implement the hash chain** and an INSERT-only database role.
3. **Add `GET /audit`** with filters, and a chain-verification endpoint.
4. **Build `Finding`** — model, endpoints, and wire `/auditor/findings` to it.
5. **Add a cabinet-access viewer** so `cabinet_access:view` becomes usable.
6. **Give `/auditor/compliance` its own view** rather than re-exporting management's.
7. **Add monthly partitioning** as the schema comments specify.
8. **Implement SoD detection**, which the older docs already claim exists.

> **This dashboard is the largest gap between what the product claims and what it does.**
> The schema is already correct — this is a build, not a redesign.

---

## 6. SchullTech Platform Admin (`schulltech_admin`)

**Landing:** `/platform` · **Sidebar:** Operations / Commercial / Release / Governance
**Overall: 🟥 Entirely fixture data — by design, this is Phase 2.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/platform` | 347 | `tenants`, `plans`, `addTenant`, `updateTenant` | **none** | 🟥 Mock |
| `/platform/plans` | 116 | `plans`, `tenants`, `updateTenant` | **none** | 🟥 Mock |
| `/platform/billing` | 133 | `tenants` | **none** | 🟥 Mock |
| `/platform/sysconfig` | 203 | `featureFlags`, `updateFeatureFlag` | **none** | 🟥 Mock |
| `/platform/audit` | 89 | `audit`, `tenants`, `users` | **none** | 🟥 Mock |
| `/platform/flags` | 7 | — | ↪️ **re-exports `/platform/sysconfig`** | 🟥 ⚠️ **wrong page** |

> ⚠️ Note the inversion: `updateFeatureFlag` is destructured by **`/platform/sysconfig`**,
> not by `/platform/flags`. The flags route re-exports sysconfig, so the feature-flag
> controls live under "Platform Health" and the "Feature Flags" nav item shows the same
> screen. Either finish the split or drop the duplicate nav entry.

> ⚠️ **`/platform/flags` renders the Platform Health screen.** Clicking "Feature Flags" in
> the sidebar shows system configuration. `updateFeatureFlag` exists in the store and no
> screen calls it. Either build the flags page or remove the nav entry.

### APIs wired

**None.** Not one page calls the backend.

### Why — and why it's defensible

The backend runs in **single-tenant mode by design**. `edms-backend/docs/edms_architecture.md`
§1 describes the "True Silo" target — one isolated PostgreSQL instance per tenant, the
database itself as the boundary, **no `tenant_id` columns anywhere** — and §2 states the
migration cost is *one line per controller* because `db` is passed as a parameter rather
than imported.

**That claim is verifiably true.** `db` is imported only in controllers, middlewares and
workers; every service and repository takes it as a parameter. §6 records that a teammate's
premature multi-tenancy infrastructure was **removed** rather than carried as dead code.

Platform-level tables (`tenants`, `usage_events`, `platform_audit_log`) are explicitly
documented as belonging to a **separate control-plane database** that has not been built.

### The permission contradiction

`schulltech_admin` has **3 backend grants**: `workflow:view`, `workflow:route`,
`audit:view`. It is **deliberately excluded** from `CABINET_ACCESS_BYPASS_ROLES` and every
confidentiality tier — **the vendor cannot read customer documents.** That is a strong,
correct decision.

The frontend contradicts it: `usePermissions.ts:24` returns `true` for every check for this
role. It goes unnoticed only because no `/platform` page calls the API. **Wiring any
`/platform` page to a real endpoint will surface this immediately as unexplained 403s.**

### What's left

This is a **phase**, not a backlog item:

1. Control-plane database: `tenants`, `usage_events`, `platform_audit_log`
2. `resolveTenant` middleware resolving a `PrismaClient` per subdomain → `req.db`
3. Update every controller to pass `req.db` instead of the imported singleton
4. Automated per-tenant database provisioning + migration
5. Plan/entitlement model with actual enforcement
6. Usage metering (`DocumentVersion.fileSize` is the only ingredient that exists)
7. Feature-flag model and evaluation — **and fix the `/platform/flags` re-export**
8. Real health checks: DB probe, Redis probe, queue depth, worker heartbeat
9. Audited, time-boxed impersonation for support access
10. Align the frontend permission model with the backend's 3 grants

---

## Shared pages (used by multiple roles)

| Page | LOC | Roles | Store reads | API | Status |
|---|---:|---|---|---|---|
| `/` (login) | 316 | all | `currentUser`, `setCurrentUser` | `authService` ✅ | ✅ Live ⚠️ **all 12 test accounts are wrong** |
| `/doc/[id]` | 776 | all | `currentUser` | 5 real ✅ · 3 mock 🟥 · `@ts-nocheck` | 🟨 Hybrid |
| `/search` | 258 | all | `docTypes`, `savedSearches` | `useDocumentSearch`, `useDocuments`, `useCabinets` ✅ · `@ts-nocheck` | 🟨 Hybrid — **and always empty** |
| `/upload` | 475 | staff, supervisor, management, client_admin | `docTypes`, `session`, `users` | `useCabinets`, `useCabinetFolders`, `documentsService`, `s3` ✅ | ✅ Live |
| `/notifications` | 106 | all | `notifications`, `session` | **none** | 🟥 Mock |
| `/circulars` | 107 | all | `circulars`, `session`, `users` | **none** | 🟥 Mock |
| `/unauthorized` | 58 | all | — | — | static |

### `/doc/[id]` — the most complex page in the app

| Feature | Status |
|---|---|
| Load document | ✅ `GET /documents/:id` |
| Metadata panel | ✅ `GET /documents/:id/metadata` |
| Version history | ✅ `GET /documents/:id/versions` |
| Edit document | ✅ `PATCH /documents/:id` |
| Checkout / check-in | ✅ |
| Task action from this screen | ✅ `POST /tasks/:id/action` |
| Cabinet + folder context | ✅ |
| **Comments** | ⛔ `POST /documents/:id/comments` → 404 |
| **Signatures** | ⛔ `POST /documents/:id/signatures` → 404 |
| **Activity timeline** | 🟥 `SEED.audit` |
| **Policies (confidentiality options)** | 🟥 `SEED.policies` — offers `Top Secret`, which the upload form correctly omits |
| **File preview / download** | ⛔ no endpoint exists |
| Type safety | ⚠️ `@ts-nocheck` |

### `/notifications` — note the detail

The page reads `useStore` **only**. It does not even call the broken notification API — so
it silently renders `SEED.notifications` and never errors. The staff *dashboard* does call
`useNotifications`, which 404s. **Two screens, two different failure modes, for the same
missing module.**

---

## Backend endpoints with no UI

Built, permission-gated, and unreachable from the product.

| Endpoint | Capability | Effort to expose |
|---|---|---|
| `POST /cabinets/:id/metadata-fields` (+ PATCH, DELETE) | Custom metadata schema | Medium — designer panel + dynamic form renderer |
| `GET/POST /cabinets/:id/access`, `DELETE /:id/access/:grantId` | **The entire cabinet permission model** | Medium — **ship with backend read enforcement** |
| `POST /documents/:id/versions/:versionId/restore` | Version rollback | **Low** — one button in the version panel |
| `DELETE /documents/:id` | Archive | **Low** |
| `GET/POST /delegations`, `POST /delegations/:id/end` | Out-of-office delegation | Medium — new page; backend is complete |
| `GET /workflow-history`, `GET /workflow-history/:id` | Immutable stage-transition timeline | **Low** — a tab on `/doc/[id]` |
| `PUT /roles/:id/permissions` | Role matrix persistence | **Low** — repoint the existing editor |

**`GET /workflow-history` is the quiet win.** It is the closest thing the backend has to a
real audit trail — actor, from-stage, to-stage, note, `elapsedSeconds` — and it would
immediately replace the fabricated activity timeline on `/doc/[id]` while the real audit
module is built.

---

## Frontend calls with no backend

| Call | Result today | Fix |
|---|---|---|
| `POST /api/v1/auth/logout` | HTML 404, swallowed by `try/catch` | Build it with a refresh-token denylist |
| ~~`POST /workflow-instances/start`~~ | ✅ **resolved** | Frontend now uses the two-call sequence |
| `POST /documents/:id/comments` | HTML 404 | Build the endpoint |
| `POST /documents/:id/signatures` | HTML 404 | Build the endpoint |
| ~~`GET /notifications`~~ | ✅ **resolved** | Backend module built; frontend rewired |
| ~~`PATCH /notifications/:id/read`~~ | ✅ **resolved** | — |
| ~~`POST /notifications/mark-all-read`~~ | ✅ **resolved** | Route is `POST /notifications/read-all`; **fixed on the frontend** |
| ~~`POST /notifications`~~ | 🔒 **withdrawn** | Deliberately removed — see below |

**Revised 2026-09-04.** Five of the original eight are resolved. **Two remain**
(`comments`, `signatures`), and one was withdrawn rather than fixed.

> 🔒 **Why `POST /notifications` was withdrawn.** The frontend used it to notify a
> document's owner when someone requested access, passing an arbitrary `userId` and
> arbitrary message text. Implemented server-side as called, it would let any
> authenticated user send a notification addressed to anyone, with content of their
> choosing, rendered with full system credibility — a phishing vector. The client call was
> removed; the "Request access" button now records the audit action only, and **the owner
> is not notified** until a server-side endpoint that derives both recipient and text from
> the document exists (`BACKEND_REQUESTS.md` → BE-1).

⚠️ **The 404s that remain still return an HTML body**, because `app.ts` has no JSON 404
handler — the `errorHandler` is a 4-arg error middleware and is skipped on the happy path.
Axios then fails parsing the HTML, so each surfaces as a confusing parse error rather than
a clean 404. **Adding a JSON 404 handler is a five-line change** and still worth doing:
it makes every *future* wrong URL legible, which is exactly how the routing bug above hid
for as long as it did.

---

## Consolidated build backlog

### 🔴 P0 — do this week

| # | Item | Owner | Effort | Why |
|---|---|---|---|---|
| 1 | `npx prisma generate` | Backend | 2 min | Unblocks the build; stops every user being silently narrowed to `department` scope |
| 2 | Two-call create-then-start in `workflowInstancesService.start()` | Frontend | 1 hr | **Unblocks the entire approval half of the product** |
| 3 | `requirePermission` on all **25** workflow routes + role checks in definitions/instances services | Backend | 1 day | Any staff user can currently publish/archive workflows and drive any instance |
| 4 | Fix the 12 login test-account emails to the `tjoel+…` set | Frontend | 10 min | Every autofill button fails today |
| 5 | JSON 404 handler in `app.ts` | Backend | 5 min | Makes 8 broken calls fail legibly |
| 6 | Make `usePermissions` parse three-segment strings | Frontend | 30 min | **Must ship before `/auth/me` returns `permissions`**, or every `<Guard>` goes dark at once |
| 7 | Fix `effStatus()` — one copy, derive overdue from `dueAt`/`stageDueAt`, normalise status casing | Frontend | 2 hr | Every overdue badge, count and ageing bucket in the product currently reads zero (DRIFT-13) |

*Items 1, 2, 4, 5 and 6 total under two hours and move the product from "demo with a broken
core loop" to "working document workflow". Item 7 adds two more and restores every SLA and
ageing indicator.*

### 🟠 P1 — the next two to three weeks

| # | Item | Owner | Unblocks |
|---|---|---|---|
| 8 | Presigned upload endpoint + async Textract + **unconditional** search indexing | Both | OCR **and** search together |
| 9 | Notifications module + wire the SLA worker to it | Backend | Task assignment, SLA warnings, circular acks |
| 10 | Audit module: `AuditService.log()` everywhere + hash chain + `GET /audit` | Backend | **The entire auditor dashboard and the compliance claim** |
| 11 | Next.js `middleware.ts` for server-side route protection | Frontend | Closes the forgeable-role hole |
| 12 | Cabinet access-grant UI **+ backend read-path enforcement, shipped together** | Both | Need-to-know actually works |
| 13 | Delegation UI | Frontend | Supervisors can take leave |
| 14 | Repoint the role matrix editor at `PUT /roles/:id/permissions` | Frontend | Stops silent data loss |
| 15 | `POST /users/invite` + mail transport + password reset + login rate limiting | Backend | Removes admin password handling |

### 🟡 P2 — the following month

| # | Item | Owner |
|---|---|---|
| 16 | Aggregation/reporting endpoints; then delete `fetchAllPages.ts` | Backend |
| 17 | `Finding` model + endpoints + a management-oriented view | Both |
| 18 | Cabinet metadata-field designer + dynamic upload form | Frontend |
| 19 | Comments and signatures endpoints | Backend |
| 20 | Document download/export/print, gated by the existing tier allowlists | Backend |
| 21 | Circulars: model, endpoints, audience targeting, ack tracking | Both |
| 22 | Retention policy endpoints + enforcement job | Backend |
| 23 | Branding model + endpoints + logo upload | Both |
| 24 | Version-restore and archive buttons (backend already done) | Frontend |
| 25 | `GET /workflow-history` tab on `/doc/[id]` — replaces the fake timeline | Frontend |
| 26 | Paginate cabinets, folders, roles, departments | Backend |
| 27 | Remove `@ts-nocheck` from the three files that carry it | Frontend |
| 28 | Fix `/platform/flags` re-exporting the wrong page | Frontend |
| 29 | Role switcher in the Topbar for multi-role users | Frontend |
| 30 | **Tests.** There are currently zero in either codebase. | Both |

### ⚪ P3 — Phase 2

| # | Item |
|---|---|
| 31 | Multi-tenancy: control-plane DB, `resolveTenant`, `req.db` injection |
| 32 | Plans, entitlements and enforcement |
| 33 | Usage metering and billing |
| 34 | Feature flags: model + evaluation |
| 35 | Real platform health: DB/Redis probes, queue depth, worker heartbeat |
| 36 | Audited, time-boxed support impersonation |
| 37 | SSO (`User.passwordHash` is already nullable for this) |
| 38 | Separation-of-duties enforcement |

---

## The one-paragraph summary

**The document half of this EDMS is real.** Capture, filing, versioning, checkout,
classification, task queues and approval decisions all work end to end, and the backend's
layer discipline is genuinely good — `db` passed as a parameter everywhere, RBAC scope
resolved in SQL, confidentiality filtered in the query rather than after it.

**The governance half is a convincing UI over fixture data.** Audit, notifications,
circulars, policies, findings and platform operations account for 20 of 42 pages rendering
`initialData.ts` — and they cluster: the Auditor dashboard is 4/4 mock, Platform is 6/6.

**Four defects sit on the seam and matter more than any individual gap:** workflow routes
have **no authorization at all**; the audit trail the product's compliance positioning
rests on has **never recorded a single event**; document routing — the hinge between filing
and approval — **calls a URL that does not exist**; and `effStatus()` silently returns zero
for every overdue indicator because it looks for a due-date field the backend never had.
The third is one hour of work and unblocks the other half of the product; the fourth is two
hours and restores every SLA and ageing view.
