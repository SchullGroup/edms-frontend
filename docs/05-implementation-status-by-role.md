# 05 — Implementation Status by Role Dashboard

**Status:** Written 2026-08-29. Every row verified against the source.

**Revised 2026-09-04** against `edms-backend` @ `dev` (`b72e0bf`, 83 routes) and
`EDMS-FRONTEND` @ `dev` (`f02c7b8`). Two findings changed: **document routing is fixed**
(the two-call create-then-start sequence shipped) and **the notifications module now
exists** on both sides — but nothing calls `notifyUser`, so no notification is ever
created. Superseded statements are struck through or marked in place rather than
deleted. See `01-architecture-and-drift.md` for the full revision table.

**Re-scanned 2026-09-04 (evening)** against `edms-backend` @ `dev` (`e60c418`, 90 routes).
The backend moved after the morning revision above. Two changes affect this document:

- ✅ **Workflow authorization is now enforced** in all five workflow services, so the
  "no authorization on the endpoint" caveat attached to the workflow phases is resolved
  (DRIFT-05). Note it is enforced in the *services*, not via `requirePermission` on the
  routes — a route-level grep still shows zero.
- 🔴 **A new blocker replaced it (DRIFT-14).** `WORKFLOW_DEFINITION_VIEW_ROLES` was set
  equal to `MANAGE_ROLES`, so `staff` and `supervisor` can no longer read workflow
  definitions. Routing a document is unreachable for the roles that hold
  `workflow:route`, and the picker reports "no published workflows" — which is neither
  true nor the reason.
- 🔄 **OCR's backend half is correct now** — asynchronous Textract, correct bucket,
  presigned download URLs, OCR text archived. The upload still goes to a third-party
  gateway, so the failure is unchanged but is now a frontend-only fix.
- 🔄 **Eight server-side aggregation endpoints now exist**; the frontend consumes one.



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

**51 pages across 6 role dashboards** (`find src/app -name 'page.tsx' | wc -l`, re-derived
2026-09-18 — was 42 at last full classification).

> ⚠️ **Count updated, classification not yet caught up.** Of the +9 pages, this document
> classifies one (`/admin/access-requests`, below). The other eight —
> `admin/workflows/instances`, `staff/performance`, `staff/tasks`, `supervisor/instances`,
> `user-stories`, and others — have **not** been individually classified (data source,
> API hooks, mock vs. live). That's a full doc 05 re-audit, not yet done. Every count and
> percentage below this line that's derived from "42 pages" (portfolio ratios, the "20 of
> 42" mock-page tally, etc.) is a **known undercount** until that re-audit happens —
> flagged rather than guessed at.

Every classification below was verified by inspecting what each page destructures from
`useStore` versus which API hooks it calls.

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
| ~~`POST /documents/:id/comments`~~ | Not a real endpoint — use the `comment` field on `POST /tasks/:id/action` | — |
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
4. ~~Add `POST /documents/:id/comments`~~ — **done differently (2026-09-10):** comments are the `comment` field on `POST /tasks/:id/action`; the stage-action modals now send it.
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
| `GET /sla/breaches` | ✅ **Wired** (`sla.service.ts`) — was stale here; not yet consumed by `/supervisor/bottlenecks`, which still recomputes ageing client-side instead of reading it | Bottlenecks page invents ageing from `SEED`-derived math instead of the real breach table |
| `GET/POST /delegations`, `POST /delegations/:id/end` | ✅ **Wired** — `/delegations` (344 lines, `useDelegations`/`useCreateDelegation`/`useEndDelegation`) exists; was stale here. Not re-verified end-to-end in this pass. | — |
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
| Get warned before an SLA breach | ⛔ | Worker detects it and tells nobody (notifications gap, DRIFT-10) — `GET /sla/breaches` itself is wired |
| Delegate while on leave | ✅ | `/delegations` exists and is wired — was stale here; not re-verified end-to-end |
| Review exceptions | 🟥 | Hardcoded |
| Export team stats | ✅ | CSV |

> ⚠️ **This whole section (`Supervisor Console`) predates recent wiring work** — the
> delegation UI and `GET /sla/breaches` corrections above were caught only because they
> surfaced while investigating the audit module (DRIFT-11) on 2026-09-18. The rest of
> this section (bottlenecks math, workload paging, exceptions/performance mock status)
> was **not** re-audited in this pass and may also be stale.

### What's left, in order

1. ~~Build the delegation UI~~ — **exists**; verify it end-to-end and demote/remove this
   item if confirmed working.
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
| `/management/compliance` | 169 | **`findings`** | `useUsers` ✅ · `useAuditEntries` ✅ (migrated 2026-09-18) | 🟨 Hybrid — `findings`/hbar chart still `SEED` |
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
| `/management/compliance` | `findings`/hbar chart still `SEED.findings` — the sensitive-activity panel is real now (migrated 2026-09-18) |
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
| `/admin/users` | ~320 | `auditAction` only | `useUsers` + mutations, `useRoles` (picker), `useAssign/RemoveUserRole`, `useResendInvitation` ✅ | ✅ Live — users only since 2026-09-10 (roles split out); "Resend invite" added 2026-09-18 |
| `/admin/roles` | ~470 | `auditAction` only | `useRoles`, `useCreate/Update/DeleteRole`, `useSetRolePermissions` ✅ | ✅ Live — rail + data-driven permission matrix; catalog derived from the `GET /roles` union (no `GET /permissions` exists); built-in roles read-only |
| `/admin/cabinets` | 346 | `auditAction` only | `useCabinets`, `useCabinetFolders`, `useDepartments` ✅ | ✅ Live |
| `/admin/workflows` | 493 | `auditAction` only | `useWorkflows` + mutations ✅ · `@ts-nocheck` | ✅ Live ⚠️ **no authorization on the endpoints** |
| `/admin/policies` | 244 | `auditAction` | `usePolicies` 🟥 | 🟥 Mock |
| `/admin/branding` | 397 | `auditAction` | `useBranding` 🟥 | 🟥 Mock |
| `/admin/circulars` | 263 | `auditAction`, `currentUser` | `useCirculars` 🟥 | 🟥 Mock |
| `/admin/audit` | 150 | — | `useAuditEntries`, `useExportAuditCsv`, `useVerifyAuditChain` ✅ · `useUsers` ✅ | ✅ Live — wired 2026-09-18 (was `SEED.audit`) |
| `/admin/access-requests` | ~200 | — | `useAccessRequestsInbox`, `useGrantAccessRequest`, `useDenyAccessRequest` ✅ | ✅ Live — **new page, 2026-09-18**. client_admin-only grant/deny inbox for `POST /documents/:id/access-requests` |

### APIs wired ✅

```
GET/POST/PATCH/DELETE  /users              full lifecycle
POST   /users/:id/roles                    role assignment
DELETE /users/:id/roles/:roleId            role removal
POST   /users/:id/invitation               resend invite email (added 2026-09-18)
GET    /roles                              role list
GET/POST/PATCH/DELETE  /cabinets
GET/POST  /cabinets/:cabinetId/folders
PATCH/DELETE /folders/:id
GET/POST/PATCH/DELETE  /departments
GET/POST/PATCH  /workflows
POST   /workflows/:id/publish  /archive
GET    /audit                              search/filter (added 2026-09-18)
GET    /audit/:id
GET    /audit/export                       CSV — requires `audit:export`, which
                                            `client_admin` does not hold by default
GET    /audit/verify                       hash-chain integrity check
POST   /documents/:id/access-requests/:reqId/grant   client_admin-only (added 2026-09-18)
POST   /documents/:id/access-requests/:reqId/deny    client_admin-only
GET    /documents/access-requests                    admin inbox, all documents
```

### APIs missing ⛔

| Needed | Backend status | Impact |
|---|---|---|
| `POST/PATCH/DELETE /cabinets/:id/metadata-fields` | ✅ **Wired** — `admin/cabinets/page.tsx` has a metadata-field designer (this row was stale, caught 2026-09-18) | — |
| `GET/POST /cabinets/:id/access`, `DELETE .../:grantId` | ✅ **Wired** — `useCabinetAccessGrants`/`useGrantCabinetAccess` in `admin/cabinets/page.tsx` (stale here; caught 2026-09-18) | — |
| `PUT /roles/:id/permissions` | ✅ **Wired** via `useSetRolePermissions` — this row contradicted the page's own inventory entry above (`/admin/roles`), which already correctly said so; see the README's 2026-09-10 correction note | — |
| `POST /users/:id/invitation` | ✅ **Built & wired 2026-09-18** | "Resend invite" button, shown for active users with no `lastLoginAt` |
| Password reset | ✅ **Built** — `POST /auth/reset-password`; was broken by a field-name bug until fixed 2026-09-18 (DRIFT-15) | New users/resets both land on `/set-password` |
| Retention policy CRUD + enforcement job | Model only | Nothing ever expires |
| Branding model + endpoints | Not built | Theming resets on cache clear |
| Circulars model + endpoints | Not built | |
| `GET /audit` | ✅ **Built & wired 2026-09-18** | Tenant audit view is real now |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/admin/policies` | `SEED.policies` | Confidentiality/urgency/control config is decorative |
| `/admin/branding` | `SEED.branding` | ⚠️ **Theming genuinely applies** via CSS custom properties in `AppShell`, including a dark-mode `lighten()` — so it looks completely real and persists nowhere |
| `/admin/circulars` | `SEED.circulars` | |
| Role matrix editor | `SEED.rolesMatrix` via `updateRoleMatrix` | **Permission changes appear to save and don't** |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Create departments | ✅ | ⚠️ 200 cap, no cycle detection |
| Create cabinets, assign to departments | ✅ | ⚠️ 100 cap |
| Build folder trees | ✅ | ⚠️ `folderId` not validated against `cabinetId` |
| Define cabinet metadata fields | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18 |
| Grant cabinet access | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18 |
| Create users with dept + roles | ✅ | ⚠️ new users get a default password (`password`), not an emailed invite — see backlog |
| Resend a user's invitation email | ✅ | Added 2026-09-18; shown for active users with no `lastLoginAt` |
| Assign / remove roles | ✅ | |
| Deactivate a user | ✅ | Login then 403 |
| Edit the role permission matrix | ✅ | `PUT /roles/:id/permissions` via `useSetRolePermissions` — row was stale, caught 2026-09-18 |
| Design and publish a workflow | ✅ | ⛔ **but so can any authenticated user** |
| Configure retention policy | 🟥 | |
| Apply branding | 🟥 | Applies visually, persists nowhere |
| Publish a circular | 🟥 | |
| Review the tenant audit trail | ✅ | Wired 2026-09-18 — filter by actor/action/date, paginated, "Verify integrity" action; "Export" 403s for `client_admin` (no `audit:export` grant) |

### What's left, in order

1. ~~Build the cabinet access-grant UI~~ — **done**, wired in `admin/cabinets/page.tsx`.
   These three items (1–3) were all stale, caught 2026-09-18; not otherwise part of that
   day's work. Whether backend **read-path** enforcement actually uses these grants
   (not just the write-path CRUD) is unverified — worth a targeted check before
   trusting the need-to-know model end to end.
2. ~~Point the role matrix editor at `PUT /roles/:id/permissions`.~~ — **done**, via
   `useSetRolePermissions` (contradicted this doc's own `/admin/roles` row above).
3. ~~Build the cabinet metadata-field designer~~ — **done**, wired in
   `admin/cabinets/page.tsx`.
4. **Make new-user creation send a real invite email** instead of a hardcoded default
   password — `POST /users/:id/invitation` (resend) is wired; the *initial* invite on
   creation still isn't email-driven. Login rate limiting still unaddressed.
5. **Add authorization to the workflow endpoints** (backend — DRIFT-05).
6. **Build branding**: model, endpoints, logo upload.
7. **Build circulars**: model, endpoints, audience targeting, acknowledgement tracking.
8. **Build retention**: endpoints + an enforcement job.
9. ~~Build the audit module and point `/admin/audit` at it.~~ **Done 2026-09-18**
   (DRIFT-11 revised).
10. **Remove `@ts-nocheck`** from `/admin/workflows`.

---

## 5. Audit & Compliance (`internal_auditor`)

**Landing:** `/auditor` · **Sidebar:** Review / Findings / Posture
**Overall: 🟨 `/auditor/trail` now reads the real audit backend (migrated 2026-09-18).**
**`/auditor` (the dashboard) and `/auditor/findings` are still fixture-only — findings**
**tracking has no `Finding` model in Prisma at all, backend or frontend.**

> ⚠️ **Correction (2026-09-18).** This section previously stated the audit backend was
> entirely unbuilt (`GET /audit` "no endpoint", `audit.middleware.ts` "0 bytes", table
> "never written to"). Confirmed live against `edms-backend-zmfm.onrender.com`: `GET
> /audit`, `GET /audit/:id`, `GET /audit/export` and `GET /audit/verify` all exist and
> work, entries are written automatically as a side effect of other actions. A larger,
> later pull (78 entries) confirmed a real action vocabulary — `user.login`,
> `document.viewed`, `document.edited`, `role.permissions_updated`,
> `document.access_denied`, and 15 others — and `GET /audit/verify` confirmed the hash
> chain intact. See `01` → DRIFT-11 (resolved) for the full writeup. `/auditor/trail` was
> migrated onto it the same day (`useAuditEntries` in `useAudit.ts`), alongside
> `/admin/audit` and `management/compliance`'s sensitive-activity panel.

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/auditor` | 128 | `findings`, `audit`, `users` | **none** | 🟥 Mock |
| `/auditor/trail` | 277 | `auditAction` (finding-raise only) | `useAuditEntries`, `useExportAuditCsv` ✅ | ✅ Live — migrated 2026-09-18 |
| `/auditor/findings` | 367 | `findings`, `users`, `addFinding`, `updateFinding` | **none** | 🟥 Mock — no backend model regardless |
| `/auditor/compliance` | 7 | — | ↪️ re-exports `/management/compliance` | 🟨 Hybrid — inherits the now-real sensitive-activity panel |

*The auditor also uses the shared `/staff/cabinets` (✅ live) and `/search` (⛔ empty).*

### APIs wired

**`/auditor/trail`**: `GET /audit` (search/filter, `useAuditEntries`) and `GET
/audit/export` (`useExportAuditCsv`) — the same real integration `admin/audit` (§4) uses.
Migrating this page wasn't a hook swap: it now filters on the real, confirmed action
vocabulary (`user.login`, `document.viewed`, `role.permissions_updated`, …) instead of
the old app-invented codes (`REDACT_RELEASE`, `SIGN`, …), which matched nothing real. The
"Raise a finding" feature is untouched — it still writes to the local `auditAction`
pseudo-log, since findings has no real backend to migrate *to* either.

### APIs missing ⛔

| Needed | Backend status |
|---|---|
| `GET /audit` with actor / object / action / date filters | ✅ **Built and wired** — `/auditor/trail`, migrated 2026-09-18 |
| `GET /audit/verify` (hash-chain integrity proof) | ✅ **Built** — confirmed live, returns `{intact, entriesChecked, rangeStart, rangeEnd}`; not yet surfaced on `/auditor/trail` itself (only `/admin/audit`'s "Verify integrity" button calls it) |
| `GET/POST/PATCH /findings` | **No `Finding` model in Prisma at all** |
| `GET /cabinets/:id/access` (who can see this cabinet) | Endpoint exists; **no screen calls it**, though `cabinet_access:view` is granted |
| Document view logging | ✅ confirmed — `document.viewed` is a real, auto-emitted action (seen live 2026-09-18); no download endpoint exists to log downloads |
| SoD violation detection | No logic anywhere |

### The core problem (historical — see correction above)

```
DESIGNED in audit.prisma                     BUILT (as of 2026-09-18)
──────────────────────────────────────────   ─────────────────────────────
Append-only via an INSERT-only Postgres      unverified — not checked at the DB level
  role — no code, admin, or migration
  can UPDATE/DELETE
Hash chain: entryHash = SHA-256(id +         ✅ confirmed live — GET /audit/verify
  actor + action + object + time + prevHash)    recomputed and reported the chain intact
Indexes: object history, actor timeline,     ✅ exist — table now has real rows
  action filter, time range
Monthly range partitioning                   unverified — not checked at the DB level
25 documented action types                   ✅ 20 distinct actions confirmed in a single
                                                 78-entry sample, including document.viewed,
                                                 document.edited, role.permissions_updated
AuditService.log() on every mutation,        ✅ entries write automatically — confirmed for
  view and download                             auth/user/role/document actions; downloads
                                                 can't be logged (no download endpoint exists)
```

**This whole section was written against source inspection that's now stale — the
claims above were re-checked against live API behavior 2026-09-18, not by re-reading
`edms-backend/src/`.**

### Flows

| Flow | Status |
|---|---|
| View the audit trail | ✅ migrated 2026-09-18 |
| Filter by actor / action / date | ✅ against the real trail (`from`, `actorId`, `action`) |
| Verify chain integrity | ⛔ on this page — `GET /audit/verify` exists and works, but only `/admin/audit`'s "Verify integrity" button calls it |
| Sample documents | ✅ shared `/staff/cabinets` |
| Search for evidence | ⛔ index never built |
| Raise a finding | 🟥 localStorage |
| Assign an owner and due date | 🟥 localStorage |
| Track a finding to closure | 🟥 localStorage |
| Review compliance posture | 🟨 re-export of `/management/compliance` — its sensitive-activity panel is real now too |
| See who can access a cabinet | ⛔ |
| Export evidence for a regulator | ✅ confirmed live 2026-09-18 — `internal_auditor` holds `audit:export:global` (unlike `client_admin`, which doesn't) and a real export succeeds |

### What's left, in order

1. ~~Build the audit module~~ and ~~migrate `/auditor/trail`~~ — **both done** (DRIFT-11
   resolved, 2026-09-18).
2. ~~Implement the hash chain.~~ **Done** — confirmed live via `GET /audit/verify`.
3. ~~Add `GET /audit` with filters, and a chain-verification endpoint.~~ **Done.**
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
| `/platform/audit` | 89 | `audit`, `tenants`, `users` | **none** | 🟥 Mock — intentional, not a gap: no cross-tenant `GET /audit` exists, nor any platform-level multi-tenant API |
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
| `/doc/[id]` | 956 | all | `currentUser` | mostly real ✅ · `usePolicies` 🟥 mock | 🟨 Hybrid — grew substantially 2026-09-18 (access requests, comments, signatures); `@ts-nocheck` is gone, was stale here |
| `/search` | 258 | all | `docTypes`, `savedSearches` | `useDocumentSearch`, `useDocuments`, `useCabinets` ✅ · `@ts-nocheck` | 🟨 Hybrid — **and always empty** |
| `/upload` | 475 | staff, supervisor, management, client_admin | `docTypes`, `session`, `users` | `useCabinets`, `useCabinetFolders`, `documentsService`, `s3` ✅ | ✅ Live |
| `/notifications` | 106 | all | `notifications`, `session` | **none** | 🟥 Mock |
| `/circulars` | 107 | all | `circulars`, `session`, `users` | **none** | 🟥 Mock |
| `/unauthorized` | 58 | all | — | — | static |

### `/doc/[id]` — the most complex page in the app

| Feature | Status |
|---|---|
| Load document | ✅ `GET /documents/:id` |
| Metadata panel | ✅ `GET` + inline editor `PUT /documents/:id/metadata` (when `document:edit`) |
| Version history | ✅ `GET /documents/:id/versions` · open · `POST /versions/:vid/restore` · upload new version |
| Archive | ✅ `DELETE /documents/:id` (More menu, when `document:delete`) |
| Edit document | ✅ `PATCH /documents/:id` |
| Checkout / check-in | ✅ |
| Task action from this screen | ✅ `POST /tasks/:id/action` |
| Cabinet + folder context | ✅ |
| **Comments (task-tied)** | ✅ the `comment` field on `POST /tasks/:id/action`, part of the approval trail |
| **Comments (general)** | ✅ **added 2026-09-18** — dedicated `GET/POST /documents/:id/comments`, `DocumentCommentsPanel` |
| **Signatures (task-tied)** | ✅ `signature: {fileUrl,mimeType}` image on the `approve` task action — `SignaturePad` draws/uploads it (`useSignAndApprove`) |
| **Signatures (general)** | ✅ **added 2026-09-18** — dedicated `GET/POST /documents/:id/signatures` (flat record, no positional data), `DocumentSignaturesPanel`, reuses `SignaturePad` |
| **Access requests** | ✅ **added 2026-09-18** — "Request access" now really calls `POST /documents/:id/access-requests`; previously recorded an audit action only |
| **Activity timeline** | ✅ `GET /workflow-instances/:id/history` (`WorkflowHistoryTimeline`) |
| **Policies (confidentiality options)** | 🟥 `SEED.policies` — offers `Top Secret`, which the upload form correctly omits |
| **File preview / download** | ⛔ no endpoint exists |
| Type safety | ✅ `@ts-nocheck` is gone — was stale here, not dated when actually removed |

### `/notifications` — note the detail

The page reads `useStore` **only**. It does not even call the broken notification API — so
it silently renders `SEED.notifications` and never errors. The staff *dashboard* does call
`useNotifications`, which 404s. **Two screens, two different failure modes, for the same
missing module.**

---

## Backend endpoints with no UI

> ⚠️ **Correction (2026-09-18).** Every row previously listed here (cabinet
> metadata-fields, cabinet access, version restore, archive, delegations, workflow
> history, role matrix persistence) was checked against the actual consuming pages and
> is wired. Table left empty rather than deleted, so it's visible the category was
> checked, not skipped.

Nothing currently known to be backend-complete with zero UI.

**`GET /workflow-history` is the quiet win.** It is the closest thing the backend has to a
real audit trail — actor, from-stage, to-stage, note, `elapsedSeconds` — and it would
immediately replace the fabricated activity timeline on `/doc/[id]` while the real audit
module is built.

---

## Frontend calls with no backend

| Call | Result today | Fix |
|---|---|---|
| `POST /api/v1/auth/logout` | Now called with the bearer token (Sidebar sign-out, 2026-09-10); backend route still 404s | Build it with a refresh-token denylist |
| ~~`POST /workflow-instances/start`~~ | ✅ **resolved** | Frontend now uses the two-call sequence |
| ~~`POST /documents/:id/comments`~~ | ✅ **resolved (frontend)** | Not a real endpoint — comments are the `comment` field on `POST /tasks/:id/action`; box removed |
| ~~`POST /documents/:id/signatures`~~ | ✅ **resolved (frontend)** | Not a real endpoint — signature is the `signature` image on the `approve` task action |
| ~~`GET /notifications`~~ | ✅ **resolved** | Backend module built; frontend rewired |
| ~~`PATCH /notifications/:id/read`~~ | ✅ **resolved** | — |
| ~~`POST /notifications/mark-all-read`~~ | ✅ **resolved** | Route is `POST /notifications/read-all`; **fixed on the frontend** |
| ~~`POST /notifications`~~ | 🔒 **withdrawn** | Deliberately removed — see below |

**Revised 2026-09-04, again 2026-09-10.** All of the original eight are now resolved or
withdrawn. `comments` and `signatures` were never real endpoints — they are fields on
`POST /tasks/:id/action` (`comment` string; `signature` image on `approve`), and the
frontend was rewired accordingly on 2026-09-10.

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
| 3 | ~~Authorization on the workflow routes~~ — ✅ **done 2026-09-04**, enforced in all five workflow services. **New:** split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES` so `staff`/`supervisor` can read definitions (DRIFT-14) | Backend | 1 day | **Routing is blocked for the roles that hold `workflow:route`** |
| 4 | Fix the 12 login test-account emails to the `tjoel+…` set | Frontend | 10 min | Every autofill button fails today |
| 5 | JSON 404 handler in `app.ts` | Backend | 5 min | Makes 8 broken calls fail legibly |
| 6 | ✅ ~~Make `usePermissions` parse three-segment strings~~ — **done 2026-09-10, backend caught up 2026-09-15.** `src/lib/permissions.ts` normalises/matches on `resource:action`, parses scope separately; role-name heuristics removed; gating now permission-key based (`routes.config` `anyPermissions`). Login + `GET /auth/me` now return a live, scoped `permissions` array — that's the source of truth; `useHydratePermissions` (from `GET /roles`) only tops up keys it's missing | Frontend + Backend | — | Was: every `<Guard>` would go dark the moment `/auth/me` returned `permissions`; that day has arrived and it didn't |
| 7 | Fix `effStatus()` — one copy, derive overdue from `dueAt`/`stageDueAt`, normalise status casing | Frontend | 2 hr | Every overdue badge, count and ageing bucket in the product currently reads zero (DRIFT-13) |

*Items 1, 2, 4, 5 and 6 total under two hours and move the product from "demo with a broken
core loop" to "working document workflow". Item 7 adds two more and restores every SLA and
ageing indicator.*

### 🟠 P1 — the next two to three weeks

| # | Item | Owner | Unblocks |
|---|---|---|---|
| 8 | Presigned upload endpoint + async Textract + **unconditional** search indexing | Both | OCR **and** search together |
| 9 | Notifications module + wire the SLA worker to it | Backend | Task assignment, SLA warnings, circular acks |
| 10 | ✅ ~~Audit module: `AuditService.log()` everywhere + hash chain + `GET /audit`~~ — **done, both halves** (DRIFT-11 resolved, 2026-09-18). `admin/audit`, `auditor/trail` and `management/compliance` all read the real trail; `platform/audit` stays mocked by design (no cross-tenant backend exists) | — | **The auditor dashboard and the compliance claim are both real now** for every tenant-scoped role |
| 11 | Next.js `middleware.ts` for server-side route protection | Frontend | Closes the forgeable-role hole |
| 12 | Cabinet access-grant UI **+ backend read-path enforcement, shipped together** | Both | Need-to-know actually works |
| 13 | ✅ ~~Delegation UI~~ — `/delegations` exists, wired to `useDelegations`/`useCreateDelegation`/`useEndDelegation`. Was stale here; caught 2026-09-18. Not re-verified end-to-end. | Frontend | Supervisors can take leave |
| 14 | ✅ ~~Repoint the role matrix editor~~ — already on `PUT /roles/:id/permissions` via `useSetRolePermissions`. **2026-09-10** also added role **rename**/**delete** (`useUpdateRole`/`useDeleteRole`), user **role assign/remove** on save (`POST`/`DELETE /users/:id/roles`), and moved the resource/action vocabulary into `src/lib/permissions.ts` | Frontend | Was: silent data loss |
| 15 | ✅ ~~`POST /users/invite`~~ + mail transport + password reset — **`POST /users/:id/invitation`** (resend, not initial-creation invite) **and `POST /auth/reset-password` both wired 2026-09-18**; remaining: make *initial* user creation send a real invite instead of a hardcoded default password, and login rate limiting | Backend/Frontend | Removes most of the admin password handling |

### 🟡 P2 — the following month

| # | Item | Owner |
|---|---|---|
| 16 | Aggregation/reporting endpoints; then delete `fetchAllPages.ts` | Backend |
| 17 | `Finding` model + endpoints + a management-oriented view | Both |
| 18 | Cabinet metadata-field designer + dynamic upload form | Frontend |
| 19 | ✅ ~~Comments and signatures endpoints~~ — task-action fields sufficed as of 2026-09-10 (`comment` string, `approve`'s required `signature` image). **Update 2026-09-18:** dedicated `GET/POST /documents/:id/comments` and `/signatures` exist now too — separate, general-purpose records, wired as `DocumentCommentsPanel`/`DocumentSignaturesPanel`. | — |
| 20 | Document download/export/print, gated by the existing tier allowlists | Backend |
| 21 | Circulars: model, endpoints, audience targeting, ack tracking | Both |
| 22 | Retention policy endpoints + enforcement job | Backend |
| 23 | Branding model + endpoints + logo upload | Both |
| 24 | ✅ ~~Version-restore and archive buttons~~ — **done 2026-09-10.** `/doc/[id]` right column has a `DocumentVersionsPanel` (list · open · restore · upload new version) and an "Archive document" item in the More menu; `DocumentDetailsPanel` gains an inline metadata editor when the user holds `document:edit` | Frontend |
| 25 | ✅ ~~`GET /workflow-history` tab on `/doc/[id]`~~ — **already done**, this row was inconsistent with the page's own feature table above (which correctly marked it ✅) | — |
| 26 | Paginate cabinets, folders, roles, departments | Backend |
| 27 | Remove `@ts-nocheck` from the two files that still carry it (`admin/workflows`, `search`) — `doc/[id]` lost it already, count corrected 2026-09-18 | Frontend |
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

**The governance half is a convincing UI over fixture data.** Notifications, circulars,
policies, findings and platform operations account for at least 19 of the 51 pages
rendering `initialData.ts` (was 20 of 42 — `/admin/audit` moved off `SEED.audit`
2026-09-18; the other eight newly-counted pages aren't classified yet, so this is a
floor, not a final count) — and they cluster: the Auditor dashboard is still 4/4 mock,
Platform is still 6/6.

**Four defects sit on the seam and matter more than any individual gap:** workflow routes
have **no authorization at all**; the audit trail the product's compliance positioning
rests on has **never recorded a single event**; document routing — the hinge between filing
and approval — **calls a URL that does not exist**; and `effStatus()` silently returns zero
for every overdue indicator because it looks for a due-date field the backend never had.
The third is one hour of work and unblocks the other half of the product; the fourth is two
hours and restores every SLA and ageing view.
