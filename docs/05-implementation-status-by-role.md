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

**57 pages across 6 role dashboards** (`find src/app -name 'page.tsx' | wc -l`, re-derived
2026-10-05 — was 53 on 2026-10-02, 51 on 2026-09-18, 42 at last full classification). The
+4 on 2026-10-05 are the circulars pages `/circulars/[id]`, `/circulars/manage`,
`/circulars/manage/new` and `/circulars/manage/[id]` (classified under Shared pages). The +2
on 2026-10-02 were the notification-link landing pages `/tasks/[id]` (redirect-only) and
`/workflow-instances/[id]` (DRIFT-17) — the latter became the full workflow page later the
same day. All are listed under Shared pages below.

> ✅ **Every page has a row (2026-10-08).** The last seven without one were classified:
> `/admin/departments`, `/admin/workflows/instances`, `/supervisor/instances`,
> `/delegations`, `/forgot-password`, `/set-password` and `/user-stories`. The table below
> was re-tallied from the page rows, not carried forward. The "By data source" bars further
> down are still from the 42-page pass.

Every classification below was verified by inspecting what each page destructures from
`useStore` versus which API hooks it calls.

> **Classification rule.** Reading `currentUser` / `prefs` from the store is *legitimate
> client session state* and does not make a page hybrid. A page is **Hybrid** only when it
> renders `SEED` **domain** data (documents, users, findings, audit, tenants…) alongside
> live API data, or depends on one of the four mock service modules.

| Dashboard | Pages | ✅ Live | 🟨 Partial / Hybrid | 🟥 Mock | ↪️ / static | Verdict |
|---|---:|---:|---:|---:|---:|---|
| Staff Workspace | 4 | 4 | — | — | — | **Strongest.** Real data throughout. |
| Supervisor Console | 7 | 3 | 2 | 2 | — | Approvals, ageing and the Workflow Monitor real; exceptions/performance fixture. |
| Management Portal | 7 | 4 | 2 | 1 | — | The only fully API-driven pages — and the ones that don't scale. |
| Client Administration | 12 | 7 | 2 | 1 | 2 | Structure real; branding mock, policies Hybrid (SLA tab real). `/admin/circulars` and `/admin/workflows/instances` are redirect/re-export. |
| Audit & Compliance | 4 | 1 | 1 | 2 | — | Trail real; dashboard and findings fixture. |
| Platform Admin | 6 | — | — | 6 | — | Mock by design (Phase 2). |
| Shared | 17 | 2 | 11 | 1 | 3 | Login and upload real; circulars, delegations and the workflow page wired but 🟨 not verified live; notifications fixture. |
| **Total** | **57** | **21** | **18** | **13** | **5** | |

*(Re-tallied 2026-10-08 from each page's row in this doc: all 57 `page.tsx` files. Later the
same day `/admin/policies` (SLA tab) and `/management/reports` moved 🟥 → 🟨.)*
*(🟨
counts Hybrid pages and API-only pages not yet verified end to end — Partial, not ✅, per
house rule 1. ↪️ / static: `/admin/circulars`, `/admin/workflows/instances`, `/tasks/[id]`,
`/unauthorized`, `/user-stories`. `/admin/cabinets` and `/staff/cabinets` moved 🟨 → ✅
after the user tested cabinet management end to end.)*

### By data source

```
Calls the backend API      █████████████████████░░░░░░░░░░░░░░░░░░░  21 pages (50%)
Renders SEED domain data   ███████████████████████░░░░░░░░░░░░░░░░░  23 pages (55%)
Both, on the same page     ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   6 pages (14%)
Neither (inline / nothing) ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3 pages (7%)
```

*These bars are from the 42-page classification and were **not** re-derived on
2026-10-05. Known movement since: the five circulars pages now call the API and none of
them reads `SEED`; `/admin/circulars` is a redirect.*

The split is cleaner than it first looks: most pages are decisively one thing or the other.
The **20 mock pages cluster almost entirely in three dashboards** — Auditor (4/4), Platform
(6/6), and the governance half of Client Admin (4/8). The operational dashboards — Staff,
Supervisor, Management — are largely wired.

### The four mock service modules

Three pages appear "wired" because they call a hook, but the hook resolves a fixture
(was four — `circulars.service.ts` moved onto the real API 2026-10-05):

| Hook | Service | Actually returns |
|---|---|---|
| `useAuditLogs`, `useCreateAuditLog` | `audit.service.ts` | `SEED.audit` after `setTimeout(400)` |
| `usePolicies`, `useUpdatePolicy*` | `policies.service.ts` | `SEED.policies` |
| `useBranding`, `useUpdateBranding` | `branding.service.ts` | `SEED.branding` |

`useCreateAuditLog()` in particular is called from **seven** pages and resolves
successfully every time without doing anything. That is why so many admin and supervisor
actions produce a success toast for an operation that was never recorded.

## The three kinds of dummy data

Not all fixtures are the same, and the fix differs for each.

### Type 1 — `SEED` in the Zustand store *(the big one)*

`src/store/initialData.ts` — **1,520 lines**, spread into `useStore` and **persisted to
`localStorage` under `edms-state-v3`**.

Contains: `USERS`, `documents`, `cabinets`, `workflows`, `audit`, `notifications`,
`findings`, `tenants`, `plans`, `featureFlags`, `policies`, `rolesMatrix`,
`branding`, `prefs`, `docTypes`, `session`, `seq`.

**Why it's the worst kind:** it is persisted, so a stale snapshot survives rebuilds and
redeploys. `version: 3` bumps the key but there is no migration. Roughly 25 store mutators
(`updateTenant`, `addFinding`, `updateBranding`, …) write to it, so the UI produces
convincing success toasts for operations that never leave the browser.

### Type 2 — mock service modules

Three files in `src/apis/services/` return `SEED` slices after a `setTimeout(400)` to
simulate latency (re-derived 2026-10-05 with `grep -l setTimeout src/apis/services/*.ts`,
excluding `uploader.ts`'s retry back-off; the old "Five" didn't match its own four-row
table):

| File | Returns | Marked |
|---|---|---|
| `audit.service.ts` | `SEED.audit` | `// TODO: Replace with actual API call when backend is ready` |
| `branding.service.ts` | `SEED.branding` | same |
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
| ~~`management/reports/page.tsx`~~ | ~~`DEPTS`~~ | **Removed 2026-10-08** — departments come from `useDepartments` |

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
| `/staff` | 417 | `currentUser`, `recentDocuments`, `pinnedDocuments`, `savedSearches` (per-user browser state, not `SEED`) | `useTasks`, `useWorkflowInstanceStatusCounts`, `useWorkflowInstances`, `useSlaBreaches`, `useNotifications` ✅ | ✅ Live — **2026-10-08 (🟨 not verified live):** the Pending / In Progress / Closed tiles count workflows, and clicking one now lists those workflows (`GET /workflow-instances?status=`, `mine` scope; In Progress adds `on_hold`), each opening its workflow page. Before, a click filtered the *task* list, so Closed was always empty. Overdue still filters tasks by open SLA breach. "Closed (30d)" relabelled "Closed": the count isn't limited to 30 days. "View all" goes to My Tasks, not Search. *(The "notification panel dead" note was stale: notifications are wired.)* **Quick access card (2026-10-08, 🟨 not verified live):** action buttons, pinned and recently opened documents, saved searches — kept per user in the browser, since the API has no favourites or view history |
| `/staff/tasks` | 162 | `currentUser` | `useTasks` ✅ | ✅ Live |
| `/staff/cabinets` | 821 | `auditAction` only | `useCabinets`, `useCabinet`, `useCabinetFolders`, `useDocuments`, `useUsers` ✅ · folder create/rename/delete, `documentsService.update` (move), metadata-field + access-grant hooks via the shared `components/cabinets/` cards | ✅ Live — cabinet management added 2026-10-06 (see below), tested end to end by the user 2026-10-08. **Sub-folders 2026-10-08 (🟨 not verified live):** the tree nests folders by `parentId`, an open folder lists its sub-folders and offers **+ New sub-folder**, breadcrumbs show the full path, and a folder with sub-folders can't be deleted (the API would orphan them). Folder pickers on Move, `/upload` and the workflow document picker show paths ("Finance / Invoices"), as does the `/doc/[id]` breadcrumb. *Uploader names come from `useUsers`, not `SEED.USERS` as this row used to say — corrected 2026-10-06* |
| `/staff/performance` | 215 | `currentUser` | `useTasks`, `useSlaBreaches` ✅ | ✅ Live — **2026-10-08:** the hard-coded "Rework rate 4.2%" and "-0.4 d vs last period" are gone; it shows **Changes requested** (share of the user's completed tasks closed with `request_changes`, from `Task.action`). SLA compliance stays "—" (DRIFT-19) |

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
GET  /documents/search                       ⚠️ index now built on backend dev (search_vector + worker); not yet verified live
GET   /circulars/inbox             ?filter=&archived=&search=   recipient inbox (no permission — being sent it is the grant)
GET   /circulars/inbox/summary     unread / unacknowledged counts (sidebar badge)
GET   /circulars/inbox/:id         open a circular — records the read receipt
POST  /circulars/inbox/:id/acknowledge   🟨 wired 2026-10-05, not verified live
GET    /cabinets/:id                         cabinet detail — its embedded `access` grants give the caller's own level
POST   /cabinets/:cabinetId/folders          🟨 new folder        folder:create + `upload` on the cabinet
PATCH  /folders/:id                          🟨 rename folder     folder:edit   + `edit`
DELETE /folders/:id                          🟨 delete folder     folder:delete + `delete` (empty folders only)
PATCH  /documents/:id   { folderId }         🟨 move document     document:edit + `edit` (same cabinet only)
```

**Cabinet management on `/staff/cabinets` (2026-10-06, not yet verified live).** Folder
structure moved here from Cabinet Designer, so a client admin can delegate a cabinet to
staff instead of running every cabinet's structure themselves. Every action shows only when
the user holds **both** the role permission and the cabinet level in the table above (the
two checks the API makes). The level is read from the grants embedded in
`GET /cabinets/:id` by `useMyCabinetAccess` (`src/components/cabinets/cabinetAccess.ts`) —
client_admin has every level, otherwise the strongest grant to the user or one of their
roles, otherwise `view`. Users who can also manage the schema
(`cabinet_metadata_field:*` + `edit`) or grant access (`cabinet_access:create` + `edit`) get
**Metadata schema** / **Access** tabs on the cabinet — the same cards Cabinet Designer uses.
Known limits, all on the API side: documents can't move between cabinets or out of a folder
(`PATCH /documents/:id` drops `cabinetId` and rejects a null `folderId`), so the move dialog
offers only this cabinet's other folders; and the grant rules (no granting to yourself, to a
role you hold, or above your own level) are enforced by the UI only.

### APIs missing ⛔

| Needed | Status | Impact |
|---|---|---|
| `POST /workflow-instances` + `/:id/start` | Frontend calls the wrong URL (DRIFT-09) | **Cannot route a document for approval** |
| `GET/PATCH /notifications*` | Backend module is an empty directory | Bell badge and notification panel dead |
| ~~`POST /documents/:id/comments`~~ | Not a real endpoint — use the `comment` field on `POST /tasks/:id/action` | — |
| `GET /documents/:id/download` | Not built | No way to retrieve the file |
| ~~`GET /circulars`, `POST /circulars/:id/ack`~~ | ✅ **Built** (backend `circulars` module) and wired 2026-10-05 — the real routes are `/circulars/inbox*` (see APIs wired) | — |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| Sidebar badges | `SEED.documents`, `SEED.notifications` | Counts don't match the real task queue |
| `/upload` IDU card | `IDU_GUESSES` inline | Fake classification with a fake confidence score |
| ~~`/staff/performance`, `/staff`~~ | ~~hard-coded "Rework rate 4.2%" and a turnaround delta~~ | **Removed 2026-10-08** — replaced by a real "Changes requested" rate (`changesRequestedRate`, `utils/supervisor.ts`) |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Log in → land on `/staff` | ✅ | |
| Browse cabinets → folders → documents | ✅ | ⚠️ cabinet grants not enforced on reads |
| Upload → checksum → storage → create | ✅ | ⚠️ 2 MB cap, PDF/images only, external gateway |
| Open a document, view metadata + versions | ✅ | |
| Check out → edit → check in | ✅ | ⚠️ only the holder can release the lock |
| Upload a new version | ✅ | Auto-increments |
| **Route for approval** | 🟨 | Two-call create-then-start; several documents per workflow since 2026-10-07 (DRIFT-19). Not verified live — the live API still runs pre-`919d0ef` code |
| Search by content | ⛔ | Index never built (OCR always fails) |
| Work the task queue | ✅ | Prioritised by urgency then due date |
| Act on a task | ✅ | |
| Receive a notification | ⛔ | Endpoints 404 with an HTML body |
| Comment on a document | ⛔ | 404 |
| Read/acknowledge a circular | 🟨 | Wired 2026-10-05 to `/circulars/inbox*` — read receipt on open, acknowledgement recorded and audited server-side. Not yet verified live |

### What's left, in order

1. ~~**Fix routing** — two-call `POST /workflow-instances` then `/:id/start`.~~ **Done** (`workflowInstancesService.createAndStart`); this line was stale until 2026-10-08.
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
| `/supervisor/approvals` | 205 | `currentUser` | `useTasks`, `useDocuments` ✅ | ✅ Live — **2026-10-02:** the per-row "Approve" button was removed (approving from a list meant signing without reading the documents); rows keep Reassign and Open, and Open goes to the workflow page |
| `/supervisor/bottlenecks` | 164 | `currentUser` | `useDocuments`, `useUsers` ✅ | ✅ Live — ⚠️ **but "Overdue" is always 0** |
| `/supervisor/workload` | 191 | `currentUser` | `useDocuments`, `useUsers` ✅ | ✅ Live |
| `/supervisor/exceptions` | 73 | — | **inline `useState` array** | 🟥 Mock |
| `/supervisor/performance` | 86 | — | **none** | 🟥 Mock |
| `/supervisor/instances` | 15 | — | `WorkflowInstanceMonitor` → `useWorkflowInstances`, `useWorkflows`, `useWorkflowInstanceLifecycle` ✅ | 🟨 Partial — the Workflow Monitor (hold / resume / close). Stage, due and SLA % columns show "—" until `GET /workflow-instances` carries executions (DRIFT-19). *Classified 2026-10-08* |

### APIs wired ✅

```
GET   /tasks                    ?scope=all for oversight roles
POST  /tasks/:id/action         approve | reject | request_changes | close
PATCH /tasks/:id/reassign       gated by TASK_REASSIGN_ROLES
GET   /documents                team documents
GET   /users                    team roster
GET   /cabinets                 cabinet context
GET   /circulars/inbox             ?filter=&archived=&search=   recipient inbox (no permission — being sent it is the grant)
GET   /circulars/inbox/summary     unread / unacknowledged counts (sidebar badge)
GET   /circulars/inbox/:id         open a circular — records the read receipt
POST  /circulars/inbox/:id/acknowledge
GET   /circulars                   archive within circular:view scope
GET   /circulars/:id               detail + acknowledgement stats
POST  /circulars · PATCH/DELETE /circulars/:id    drafts (circular:create)
POST  /circulars/:id/publish  /cancel-schedule    publish now or schedule (circular:publish)
POST  /circulars/:id/withdraw  /revisions          withdraw · start a revision
GET   /circulars/:id/recipients    acknowledgement report
POST  /circulars/:id/reminders     remind outstanding recipients
                                circulars 🟨 wired 2026-10-05, not verified live — supervisors write
                                circulars at `own` scope and publish/withdraw at `department` scope
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
8. ~~**Allow an admin/supervisor to force-release a stale checkout lock**~~ — **built 2026-10-02.**
   Backend `canReleaseLock` (`document_lock:delete` at `global`, or `department` for the
   cabinet's department); `/doc/[id]` shows "Force check in" to those holders **only once the
   lock is past `expectedReturnAt`**. Supervisors are also notified (`checkout.overdue`) when a
   team member's checkout goes overdue. Not yet verified end to end — a lock with no
   `expectedReturnAt` can never become forceable from the UI (by design, per product call).

---

## 3. Management Portal (`management`)

**Landing:** `/management` · **Sidebar:** Dashboards / Governance / Reporting
**Overall: 🟨 The numbers are real, and — as of 2026-09-21 — so is the method.**

> ⚠️ **Correction (2026-09-21).** This whole section previously described
> `/management`, `/management/departments`, `/management/trends` and
> `/management/performance` as computing every aggregate client-side via
> `useAllDocuments`/`useAllTasks`/`useAllWorkflowInstances` walking every page of raw
> data (`fetchAllPages`) — and stated flatly that "the backend has no aggregation,
> statistics or reporting endpoints of any kind." Neither is true any more. Eight
> aggregation endpoints (`GET /documents/stats`, `/tasks/stats`,
> `/workflow-instances/stats`, `/status-counts`, `/team-status-matrix`,
> `/open-items-by-cabinet`, `/bottlenecks-ageing`, `/sla/breaches`) exist on the
> backend, and all four of these pages were rewired onto the relevant ones this
> session (DRIFT-07 in doc 01, resolved). See doc 01 §6/§10 for the full writeup; this
> section is updated to match.

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/management` | 297 | **none** | `useDepartments`, `useDocumentStats`, `useTaskStats`, `useOpenItemsByCabinet`, `useWorkflowInstanceStats` ✅ | ✅ Live — server-aggregated |
| `/management/departments` | 169 | **none** | `useDepartments`, `useDocumentStats`, `useTaskStats`, `useQueries`-over-`workflowInstancesService.getStats` (one per department shown) ✅ | ✅ Live — server-aggregated |
| `/management/trends` | 171 | **none** | `useDepartments`, `useDocumentStats`, `useWorkflowInstanceStats` ✅ | ✅ Live — server-aggregated (the forecast/backlog math is still client-side, but it's arithmetic on two already-aggregated series, not a full-list walk) |
| `/management/performance` | 85 | **none** | `useTaskStats` ✅ | ✅ Live — server-aggregated |
| `/management/compliance` | 169 | **`findings`** | `useUsers` ✅ · `useAuditEntries` ✅ (migrated 2026-09-18) | 🟨 Hybrid — `findings`/hbar chart still `SEED` |
| `/management/reports` | 322 | — | `useDepartments` ✅ · `getOpenItemsByCabinet`, `getBottlenecksAgeing` (paged, up to 2,000 rows), `tasksService.getStats`, `getTeamStatusMatrix` ✅ | 🟨 Partial — **rebuilt 2026-10-08, not verified live:** four real reports (open items by cabinet, ageing register, SLA compliance by department, workload by member), each filterable by department, previewed in a table and downloaded as CSV (with a BOM so Excel reads it as UTF-8). Scheduled reports were fake and are now a "not available yet" note: there's no report-job backend |
| `/management/findings` | 7 | — | ↪️ re-exports `/auditor/findings` | 🟥 Mock |

> **Management is the only dashboard with fully API-driven pages** — four of its seven
> read no fixtures at all, and (as of 2026-09-21) all four also let the database do the
> aggregating instead of the browser. The three still-mocked pages (`compliance`'s
> findings panel, `reports`, `findings`) share one root cause: no `Finding` model exists
> anywhere in the backend, not a wiring gap.

### APIs wired ✅

```
GET /departments                        tree, flattened client-side
GET /documents/stats   groupBy=month|department   inflow, volume, per-department totals
GET /tasks/stats       groupBy=department          SLA rate, on-time/overdue per department
GET /workflow-instances/stats           closed-per-month buckets + avg turnaround
GET /workflow-instances/open-items-by-cabinet      pending/in-progress rolled up by department
GET /users                              headcount per department
GET   /circulars/inbox             ?filter=&archived=&search=   recipient inbox (no permission — being sent it is the grant)
GET   /circulars/inbox/summary     unread / unacknowledged counts (sidebar badge)
GET   /circulars/inbox/:id         open a circular — records the read receipt
POST  /circulars/inbox/:id/acknowledge
GET   /circulars                   archive within circular:view scope
GET   /circulars/:id               detail + acknowledgement stats
POST  /circulars · PATCH/DELETE /circulars/:id    drafts (circular:create)
POST  /circulars/:id/publish  /cancel-schedule    publish now or schedule (circular:publish)
POST  /circulars/:id/withdraw  /revisions          withdraw · start a revision
GET   /circulars/:id/recipients    acknowledgement report
POST  /circulars/:id/reminders     remind outstanding recipients
                                        circulars 🟨 wired 2026-10-05, not verified live — management
                                        writes at `own` scope, publishes/withdraws at `global`
```

`useDocuments`/`useAllDocuments`/`useAllTasks`/`useAllWorkflowInstances`-style full-list
walks are gone from every page in this table. `useAllTasks`, `useAllWorkflowInstances`
and `tasksService.getAllPages` had no other callers once these four pages were rewired,
so they were deleted rather than left dead.

### APIs missing ⛔

| Needed | Currently |
|---|---|
| `GET /findings` | 🟥 No `Finding` model exists — affects this section, `/auditor/findings`, and `/management/findings` alike |
| `GET /audit` (for the findings/compliance panel specifically — the sensitive-activity half already reads it) | Partially addressed — see `/management/compliance` above |
| Scheduled/emailed reports | No scheduler, no mail transport |
| A department × document-status cross-tab | Doesn't exist — `/management`'s per-department Pending/In-Progress/Closed table derives `Closed` as `total − (pending + inProgress)` rather than an exact count, because no single endpoint returns document status broken out by department |

### One trade-off from the rewiring, not hidden

`/management`'s per-department drill-down table used to compute an exact
Pending/In-Progress/Closed split by walking every document. `pending`/`inProgress` are
now exact (rolled up from `open-items-by-cabinet`, which does carry that breakdown per
cabinet); `Closed` is derived as `totalDocsInDept − pending − inProgress` since no
backend endpoint cross-tabs department against document status. Off by whatever
archived-but-not-excluded edge cases don't fit that arithmetic — a documented
approximation, not a silent one.

### Dummy data 🟥

| Where | Fixture |
|---|---|
| `/management/compliance` | `findings`/hbar chart still `SEED.findings` — the sensitive-activity panel is real now (migrated 2026-09-18) |
| ~~`/management/reports`~~ | ~~inline `DEPTS`; the report builder produces nothing real~~ — real reports since 2026-10-08 |
| `/management/findings` | ↪️ auditor's page → `SEED.findings` |

### Flows

| Flow | Status |
|---|---|
| Organisation overview | ✅ real data, server-aggregated |
| Compare departments | ✅ same |
| Trends over time | ✅ same; forecast/backlog projection still client-side arithmetic on the two aggregated series (unchanged behavior, just no longer walking raw records to build them) |
| Performance overview | ✅ same; org SLA is now summed from `useTaskStats`'s own buckets rather than a second full task walk |
| Compliance posture | 🟨 sensitive-activity panel real, findings chart still mock |
| Findings review | 🟥 re-export of a mock page |
| Export CSV | ✅ |
| Scheduled report by email | ⛔ |

### What's left, in order

1. ~~Build aggregation endpoints, then delete `fetchAllPages.ts` as its header asks~~ —
   **done for this role's four dashboards** (2026-09-21). `fetchAllPages.ts` itself
   stays — `useAllDocuments` still has a legitimate remaining use elsewhere
   (`admin/cabinets`, `staff/cabinets`: listing every document in one cabinet for a
   folder-assignment UI, which no aggregate endpoint answers).
2. **Build `Finding`** — model, endpoints, and a management-oriented view (owner, ageing, department rollup) rather than a re-export. *Now the largest single gap for this role.*
3. ~~**Make `/management/reports` generate real reports.**~~ **Done 2026-10-08** (browser-built CSV; scheduling still needs a backend job).
4. **Correct the frontend permission heuristic** — `usePermissions` grants management
   approve/reject rights the backend never issued. Fix this *with* DRIFT-05, or management's
   buttons will start 403-ing and look like a regression.

---

## 4. Client Administration (`client_admin`)

**Landing:** `/admin` · **Sidebar:** Administration / Configuration / Communication / Governance
**Overall: 🟨 Structure is real. Policy, branding and circulars are localStorage.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/admin` | 164 | — | `useUsers`, `useCabinets`, `useWorkflows` (published + drafts), `useDepartments`, `useAccessRequestsInbox` ✅ | ✅ Live — **2026-10-08 (🟨 not verified live):** the setup checklist and pending tasks were hard-coded ("SSO enrolment (2 users outstanding)", "812 GB", "+2 this month", three invented tasks) despite this row saying Live. Now the checklist follows doc 03's setup chain against live data (departments, cabinets, a folder in every cabinet, users beyond the first, a published workflow), and pending tasks are real: access requests waiting, unpublished workflow drafts, cabinets with no folder. The storage tile became a departments count |
| `/admin/users` | ~320 | `auditAction` only | `useUsers` + mutations, `useRoles` (picker), `useAssign/RemoveUserRole`, `useResendInvitation` ✅ | ✅ Live — users only since 2026-09-10 (roles split out); "Resend invite" added 2026-09-18 |
| `/admin/roles` | ~470 | `auditAction` only | `useRoles`, `useCreate/Update/DeleteRole`, `useSetRolePermissions` ✅ | ✅ Live — rail + data-driven permission matrix; catalog derived from the `GET /roles` union (no `GET /permissions` exists); built-in roles read-only |
| `/admin/cabinets` | 448 | `auditAction` only | `useCabinets`, `useDepartments`, `useCreateFolder` (seeds "General") ✅ · metadata-field + access-grant hooks via the shared `components/cabinets/` cards | ✅ Live — reworked 2026-10-06: folder tools and the document browser moved to `/staff/cabinets`; schema and access cards extracted into shared components. Tested end to end by the user 2026-10-08 |
| `/admin/workflows` | 442 | `auditAction` only | `useWorkflows` + mutations ✅ | ✅ Live ⚠️ **no authorization on the endpoints** — `@ts-nocheck` removed 2026-10-08; the page now type-checks |
| `/admin/workflows/instances` | 7 | — | — | ↪️ re-exports `/supervisor/instances` (the Workflow Monitor) — intentional, so client admins reach it from their own portal. *Classified 2026-10-08* |
| `/admin/departments` | 460 | `auditAction` only | `useDepartments`, `useCreate/Update/DeleteDepartment` ✅ | 🟨 Partial — API-only, no `SEED`: create, edit, delete, one level of sub-departments (TEST_PLAN "Things to check"). *Classified 2026-10-08*, not verified end to end in that pass |
| `/admin/policies` | 208 | `auditAction` | `usePolicies` 🟥 · `useSlaConfiguration`, `useUpdateSlaConfiguration`, `useSlaHolidays`, `useCreate/DeleteSlaHoliday` ✅ | 🟨 Hybrid — **2026-10-08 (not verified live):** the Urgency & SLA tab is the real SLA policy (time zone, working hours and days, holidays, warning window, breach action, urgency multipliers), replacing a mock "Default SLA hours" table. Confidentiality, Retention and Controls tabs are still `SEED.policies` |
| `/admin/branding` | 397 | `auditAction` | `useBranding` 🟥 | 🟥 Mock |
| `/admin/circulars` | 20 | — | — | ↪️ redirect to `/circulars/manage` (2026-10-05) — management moved to a shared area because supervisors and management author and publish circulars too, and can't enter this portal |
| `/admin/audit` | 234 | — | `useAuditEntries`, `useExportAuditCsv`, `useVerifyAuditChain` ✅ · `useUsers` ✅ | ✅ Live — wired 2026-09-18 (was `SEED.audit`). **2026-10-08 (🟨 not verified live):** record-type and action dropdowns replace the free-text action box. That box sent partial text to `GET /audit`, which only accepts exact action names, so typing "doc" was a 400 and the table showed "Failed to load". The record types' **Configuration** group (roles, departments, cabinets, folders, workflow designs, users) is the configuration history (18.7). Export sends the same filters. SLA settings aren't audited by the backend, so they can't appear |
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
GET   /circulars/inbox             ?filter=&archived=&search=   recipient inbox (no permission — being sent it is the grant)
GET   /circulars/inbox/summary     unread / unacknowledged counts (sidebar badge)
GET   /circulars/inbox/:id         open a circular — records the read receipt
POST  /circulars/inbox/:id/acknowledge
GET   /circulars                   archive within circular:view scope
GET   /circulars/:id               detail + acknowledgement stats
POST  /circulars · PATCH/DELETE /circulars/:id    drafts (circular:create)
POST  /circulars/:id/publish  /cancel-schedule    publish now or schedule (circular:publish)
POST  /circulars/:id/withdraw  /revisions          withdraw · start a revision
GET   /circulars/:id/recipients    acknowledgement report
POST  /circulars/:id/reminders     remind outstanding recipients
                                                     circulars 🟨 wired 2026-10-05, not verified live
```

### APIs missing ⛔

| Needed | Backend status | Impact |
|---|---|---|
| `POST/PATCH/DELETE /cabinets/:id/metadata-fields` | ✅ **Wired** — `components/cabinets/CabinetSchemaCard.tsx`, used by `admin/cabinets` and (since 2026-10-06) `staff/cabinets` (this row was stale, caught 2026-09-18) | — |
| `GET/POST /cabinets/:id/access`, `DELETE .../:grantId` | ✅ **Wired** — `components/cabinets/CabinetAccessCard.tsx`, used by `admin/cabinets` and (since 2026-10-06) `staff/cabinets` (stale here; caught 2026-09-18). ⚠️ The API doesn't stop a non-admin granting to themselves, to a role they hold, or above their own level — only the card's pickers do | — |
| `PUT /roles/:id/permissions` | ✅ **Wired** via `useSetRolePermissions` — this row contradicted the page's own inventory entry above (`/admin/roles`), which already correctly said so; see the README's 2026-09-10 correction note | — |
| `POST /users/:id/invitation` | ✅ **Built & wired 2026-09-18** | "Resend invite" button, shown for active users with no `lastLoginAt` |
| Password reset | ✅ **Built** — `POST /auth/reset-password`; was broken by a field-name bug until fixed 2026-09-18 (DRIFT-15) | New users/resets both land on `/set-password` |
| Retention policy CRUD + enforcement job | Model only | Nothing ever expires |
| Branding model + endpoints | Not built | Theming resets on cache clear |
| ~~Circulars model + endpoints~~ | ✅ **Built** (backend `circulars` module, 15 routes) and wired 2026-10-05 | Not yet verified live |
| `GET /audit` | ✅ **Built & wired 2026-09-18** | Tenant audit view is real now |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/admin/policies` | `SEED.policies` | Confidentiality/retention/control config is decorative. *(The urgency table was replaced by the real SLA settings 2026-10-08)* |
| `/admin/branding` | `SEED.branding` | ⚠️ **Theming genuinely applies** via CSS custom properties in `AppShell`, including a dark-mode `lighten()` — so it looks completely real and persists nowhere |
| Role matrix editor | `SEED.rolesMatrix` via `updateRoleMatrix` | **Permission changes appear to save and don't** |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Create departments | ✅ | ⚠️ 200 cap, no cycle detection |
| Create cabinets, assign to departments | ✅ | ⚠️ 100 cap |
| Build folder trees | 🟨 | Moved 2026-10-06 from `/admin/cabinets` to `/staff/cabinets`, for whoever the cabinet is delegated to; not yet verified live. ⚠️ `folderId` not validated against `cabinetId` |
| Define cabinet metadata fields | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18. Also on `/staff/cabinets` since 2026-10-06 (tested by the user 2026-10-08) |
| Grant cabinet access | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18. Also on `/staff/cabinets` since 2026-10-06 (tested by the user 2026-10-08) |
| Create users with dept + roles | ✅ | ⚠️ new users get a default password (`password`), not an emailed invite — see backlog |
| Resend a user's invitation email | ✅ | Added 2026-09-18; shown for active users with no `lastLoginAt` |
| Assign / remove roles | ✅ | |
| Deactivate a user | ✅ | Login then 403 |
| Edit the role permission matrix | ✅ | `PUT /roles/:id/permissions` via `useSetRolePermissions` — row was stale, caught 2026-09-18 |
| Design and publish a workflow | ✅ | ⛔ **but so can any authenticated user** |
| Configure retention policy | 🟥 | |
| Apply branding | 🟥 | Applies visually, persists nowhere |
| Publish a circular | 🟨 | Wired 2026-10-05 at `/circulars/manage` — draft → publish now or schedule → recipients' inbox, acknowledgement report, reminders, withdraw, revise. Not yet verified live |
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
7. ~~**Build circulars**: model, endpoints, audience targeting, acknowledgement tracking.~~
   **Wired 2026-10-05** against the backend module; pending a live end-to-end check.
8. **Build retention**: endpoints + an enforcement job.
9. ~~Build the audit module and point `/admin/audit` at it.~~ **Done 2026-09-18**
   (DRIFT-11 revised).
10. ~~**Remove `@ts-nocheck`** from `/admin/workflows`.~~ **Done 2026-10-08.**

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
| `/auditor/trail` | 295 | `auditAction` (finding-raise only) | `useAuditEntries`, `useExportAuditCsv` ✅ | ✅ Live — migrated 2026-09-18. **2026-10-08 (🟨 not verified live):** same record-type/action dropdowns as `/admin/audit` (`AuditTypeActionFilters`), fixing the same free-text 400 |
| `/auditor/findings` | 367 | `findings`, `users`, `addFinding`, `updateFinding` | **none** | 🟥 Mock — no backend model regardless |
| `/auditor/compliance` | 7 | — | ↪️ re-exports `/management/compliance` | 🟨 Hybrid — inherits the now-real sensitive-activity panel |

*The auditor also uses the shared `/staff/cabinets` (✅ live) and `/search` (🟨 rebuilt 2026-09-30, pending end-to-end check).*

### APIs wired

**`/auditor/trail`**: `GET /audit` (search/filter, `useAuditEntries`) and `GET
/audit/export` (`useExportAuditCsv`) — the same real integration `admin/audit` (§4) uses.
Migrating this page wasn't a hook swap: it now filters on the real, confirmed action
vocabulary (`user.login`, `document.viewed`, `role.permissions_updated`, …) instead of
the old app-invented codes (`REDACT_RELEASE`, `SIGN`, …), which matched nothing real. The
"Raise a finding" feature is untouched — it still writes to the local `auditAction`
pseudo-log, since findings has no real backend to migrate *to* either.

**Circulars** (🟨 wired 2026-10-05, not verified live): the recipient inbox
(`/circulars/inbox*`) like every role, plus read-only `/circulars/manage` — auditors hold
`circular:view` at `global` scope, so they see the whole archive, each circular's stats and
its recipient/acknowledgement report (`GET /circulars`, `/circulars/:id`,
`/circulars/:id/recipients`), with no authoring buttons.

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
| `/platform/sysconfig` | 120 | `auditAction` | **none** | 🟥 Mock — health, services and jobs only since 2026-10-08 |
| `/platform/audit` | 89 | `audit`, `tenants`, `users` | **none** | 🟥 Mock — intentional, not a gap: no cross-tenant `GET /audit` exists, nor any platform-level multi-tenant API |
| `/platform/flags` | 130 | `featureFlags`, `updateFeatureFlag`, `auditAction` | **none** | 🟥 Mock — its own page since 2026-10-08 (was a re-export of `/platform/sysconfig`) |

> ✅ **Fixed 2026-10-08.** `/platform/flags` used to re-export `/platform/sysconfig`, so the
> "Feature Flags" nav item showed Platform Health with the flag table at the bottom. The flag
> table (rollout slider, promote, kill-switch) now lives only on `/platform/flags`, and
> sysconfig keeps health, services and jobs. Both stay 🟥 Mock: no flag model exists (#34).

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
7. Feature-flag model and evaluation (the `/platform/flags` re-export was fixed 2026-10-08)
8. Real health checks: DB probe, Redis probe, queue depth, worker heartbeat
9. Audited, time-boxed impersonation for support access
10. Align the frontend permission model with the backend's 3 grants

---

## Shared pages (used by multiple roles)

| Page | LOC | Roles | Store reads | API | Status |
|---|---:|---|---|---|---|
| `/` (login) | 316 | all | `currentUser`, `setCurrentUser` | `authService` ✅ | ✅ Live — the 7 autofill accounts match the backend's `tjoel+…` fixtures (re-checked 2026-10-08; the "12 wrong accounts" note was stale) |
| `/doc/[id]` | 570 | all | `currentUser` | `useDocument`, versions, checkout, `useWorkflowInstances` ✅ · `usePolicies` 🟥 mock | 🟨 Hybrid (policies) — **made view-only 2026-10-02**: workflow actions, signing and the activity trail moved to `/workflow-instances/[id]` |
| `/search` | 536 | all | `currentUser`, `savedSearches` (per-user, user-created — not `SEED`) | `useDocuments` (server-side filters + pagination), `useDocumentSearch` (text + cabinet), `useCabinets` ✅ | 🟨 Pending check — rebuilt 2026-09-30: no `SEED` reads, no `@ts-nocheck`; types from `constants/documentTypes.ts`. Not yet verified end to end, so not marked ✅ **2026-10-08:** results can be ticked (for anyone with `workflow_instance:create`); the selection survives paging, new searches and filter changes, and **Route to workflow** sends it all into one workflow — the only way to route documents from different folders or cabinets together (🟨 not yet verified live). |
| `/upload` | 926 | staff, supervisor, management, client_admin | `docTypes`, `session`, `users` | `useCabinets`, `useCabinet`, `useCabinetFolders`, `documentsService` (incl. `PUT /documents/:id/metadata`), `s3` ✅ | ✅ Live — **2026-10-07:** the chosen cabinet's metadata fields render on the card and save after filing, for users with `document_metadata:edit` + `edit` on the cabinet; everyone else sees the field list only (🟨 not yet verified live). **2026-10-08: batch filing** — with two or more files waiting, an "Apply to all" bar sets cabinet/folder/confidentiality/urgency on every card, and **File all (N)** checks every card first, uploads three at a time, then files them through `POST /documents/batch` in chunks of 20 (one transaction each; a failed chunk's cards return to editable and reuse their upload on retry). Metadata still saves per document afterwards; when it's done, a banner offers to route everything that run filed into **one** workflow. Progress now shows inside the card, which stays mounted — previously it was unmounted mid-upload, so the bar didn't move (🟨 not yet verified live).  **2026-10-02:** accepted types unified in `src/constants/uploadTypes.ts` — PDF, DOCX, XLSX, TIFF, JPG, PNG up to 100 MB (was PDF ≤50 MB + images ≤10 MB, despite the page text claiming DOCX/XLSX/TIFF). DOCX/XLSX/TIFF upload but **don't preview** in the viewer and **aren't OCR'd** (Textract can't read DOCX/XLSX), so they're not text-searchable |
| `/notifications` | 106 | all | `notifications`, `session` | **none** | 🟥 Mock |
| `/circulars` | 226 | all | — | `useCircularInbox`, `useCircularInboxSummary` → `GET /circulars/inbox`, `/inbox/summary` | 🟨 **rewired 2026-10-05** (was `SEED.circulars`) — in-force / archive tabs, read-state filters, search. built and type/build-checked 2026-10-05, not yet verified end to end against a live backend |
| `/circulars/[id]` | 181 | all | — | `useCircularInboxItem`, `useAcknowledgeCircular` → `GET /circulars/inbox/:id`, `POST …/acknowledge` | 🟨 **new 2026-10-05** — reading view and landing page for the backend's circular notification links (`actionUrl: /circulars/:id`). Opening it records the read receipt. built and type/build-checked 2026-10-05, not yet verified end to end against a live backend |
| `/circulars/manage` | 206 | `circular:view` | — | `useCirculars` → `GET /circulars` | 🟨 **new 2026-10-05** — the archive, any status, within scope. built and type/build-checked 2026-10-05, not yet verified end to end against a live backend |
| `/circulars/manage/new` | 41 | `circular:create` | — | `useCreateCircular` → `POST /circulars` · `useDepartments`, `useRoles` (only with `role:view`), `useAllUsers`, `useDocuments`, multipart upload | 🟨 **new 2026-10-05** — compose a draft: audience (all staff / department+role groups / named people), acknowledgement + deadline + reminders, expiry, file and linked-document attachments. built and type/build-checked 2026-10-05, not yet verified end to end against a live backend |
| `/circulars/manage/[id]` | 712 | `circular:view` | — | `useCircular`, `useCircularRecipients`, update / delete / publish / cancel-schedule / withdraw / revise / reminders mutations | 🟨 **new 2026-10-05** — detail, inline draft editing, lifecycle actions gated per permission, stats + per-department breakdown + recipients report. built and type/build-checked 2026-10-05, not yet verified end to end against a live backend |
| `/unauthorized` | 58 | all | — | — | static |
| `/forgot-password` | 96 | signed out | — | `authService.forgotPassword` → `POST /auth/forgot-password` | 🟨 API-only, no `SEED`. Doc 04 records the reset flow as working; not re-verified in the 2026-10-08 classification pass |
| `/set-password` | 145 | signed out | — | `authService.resetPassword` → `POST /auth/reset-password` (invitation and reset tokens) | 🟨 API-only, no `SEED`; DRIFT-15 fixed its payload 2026-09-18. Not re-verified in the 2026-10-08 pass |
| `/user-stories` | 413 | all | — | — | static — in-app guide built from a local data module (the stories in doc 02), outside the app shell |
| `/delegations` | 364 | `delegation:view` | `currentUser` | `useDelegations`, `useCreateDelegation`, `useEndDelegation`, `useUsers`, `useCabinets` ✅ | 🟨 API-only, no `SEED`. *Row added 2026-10-08* — the page was wired by 2026-09-18 (backlog #13) but never had an inventory row; not re-verified end to end |
| `/tasks/[id]` | 33 | all | — | `useTask` → `GET /tasks/:id` | ↪️ redirect to `/workflow-instances/{instanceId}?task={id}` — landing page for backend `/tasks/:id` notification links (DRIFT-17). Not yet verified live |
| `/workflow-instances/[id]` | 351 | all | `currentUser` | `useWorkflowInstance`, `useTask`, `useDocument`, `useTaskAction`, versions ✅ | 🟨 **new 2026-10-02** — the workflow page (see below). Was a 33-line redirect earlier the same day. Not yet verified e2e |

### `/doc/[id]` — view-only document page *(split 2026-10-02)*

Everything that moves a workflow moved to `/workflow-instances/[id]` (below). This page is
the document on its own: file, details, versions, custody, archive.

| Feature | Status |
|---|---|
| Load document | ✅ `GET /documents/:id` |
| No access (confidentiality 403) | ✅ full-page "You don't have access" + **Request access** (`useRequestAccessPrompt`, shared with the workflow page) |
| Metadata panel | ✅ `GET` + inline editor `PUT /documents/:id/metadata` (when `document:edit`) |
| Pin | 🟨 **new 2026-10-08** — toolbar **Pin** keeps the document in the staff dashboard's Quick access; opening the page also records it under Recently opened. Browser-only, per user |
| Change classification | 🟨 **new 2026-10-08, not verified live** — Details card → **Change** on the Classification row → dialog for confidentiality and urgency → `PATCH /documents/:id`. Shown with `document:edit` + Edit on the cabinet, not while the document is closed or checked out by someone else. Tiers above the user's clearance are disabled (they'd lose access); `top_secret` is never offered |
| Version history | ✅ `GET /documents/:id/versions` · open · `POST /versions/:vid/restore` |
| Version upload / restore gating | 🟨 **changed 2026-10-02** — "New version" is never offered here; revisions are uploaded on the workflow page in answer to a `request_changes`. Restore is blocked while a workflow is running, so the file can't be swapped mid-review. Not yet verified e2e |
| Archive | ✅ `DELETE /documents/:id` (toolbar, when `document:delete`) |
| Checkout / check-in | ✅ — banner names the holder (`checkoutLock.locker`, embedded since backend `b4a3f81`) and flags an overdue lock |
| Force check-in (someone else's overdue lock) | 🟨 **built 2026-10-02, not yet verified e2e** — shown only to `document_lock:delete` at `global` scope, or `department` scope matching the cabinet's department, and only once `expectedReturnAt` has passed. Same `POST /documents/:id/checkin`; the backend authorises it via `canReleaseLock` |
| Workflows card | 🟨 **new 2026-10-02** — `GET /workflow-instances?documentId=` → every workflow the document is in, each linking to its workflow page; "Open workflow" in the toolbar for the live one, "Route to workflow" when none. **Unverified:** whether that filter matches a document that was *attached* rather than primary |
| Cabinet + folder context | ✅ |
| **Policies (confidentiality options)** | 🟥 `SEED.policies` — offers `Top Secret`, which the upload form correctly omits |
| **Preview fallback** | 🟨 **2026-10-08, not verified live** — a file the viewer can't show (DOCX, XLSX, TIFF) reads "Word documents can't be previewed yet" instead of the raw MIME type. Its button is the page's audited **Download**, hidden when the confidentiality policy turns download off (the old "Open file" link ignored it). Same on the workflow page's viewer |
| **File preview / download** | 🟨 the code renders and downloads the pre-signed `currentVersion.fileUrl` that `GET /documents/:id` returns, so the old "no endpoint" claim looks stale — **not re-verified live** |

### `/workflow-instances/[id]` — the workflow page *(new 2026-10-02)*

Reached from `TaskRow` (staff task queue, dashboard, approvals, workload), the supervisor
team drawer, bottlenecks, the workflow monitors ("Open workflow"), and notification links
(`/tasks/:id` forwards here with `?task=`). Keyed on the instance id because a task id changes
every time the stage moves. **All 🟨 — built and type/build-checked, not yet verified end to
end against a live backend.**

| Feature | Status |
|---|---|
| Which task the page is about | 🟨 the `?task=` one if still active → else the caller's own active task → else whoever holds the current stage → else the latest task (finished workflows) |
| Documents | 🟨 from `GET /tasks/:id` `documents` (each pinned to the version under review); tabs when there's more than one. Falls back to the primary document alone if the caller can see the workflow but not its task (403) |
| Per-document access overlay | 🟨 a document above the viewer's clearance (`GET /documents/:id` 403) renders a blurred viewer with "You don't have access to this document" + **Request access** — the other documents and the stage actions stay usable |
| Stage actions | 🟨 review / approve (signature) / request changes / delegate / close / reject, filtered by the stage definition's `actions`; enabled only for the active task's assignee or a holder of its role, with `task:action` |
| **Request changes ("Send back")** | 🟨 **DRIFT-18 fixed 2026-10-02** — picker of the task's documents (min 1, the viewed one pre-ticked) + required reason → `documents: [{documentId}]`. **Hidden on the first stage** (nothing to send back to — backend 409 `WORKFLOW_PREVIOUS_STAGE_NOT_FOUND`); the designer also greys it out for stage 1 and strips it on save |
| **Mark reviewed — document required** | 🟨 **new 2026-10-02** — product rule: a review must attach ≥1 document. `review` itself takes no documents, so a two-step modal — 1) `WorkflowDocumentPicker`, with two tabs: **From a cabinet** (debounced title search via `GET /documents/search?q=&cabinetId=` — full-text over title + OCR + metadata, so a brand-new document isn't findable until OCR has run and the index job follows) and **Upload from computer** (multipart upload → `POST /documents` into a chosen cabinet/folder, defaulting to the primary document's cabinet, confidentiality and urgency — the document is filed immediately, even if the review is then cancelled); 2) optional comment + confirm, with Back keeping the selection — attaches each via `POST /workflow-instances/:id/documents`, then sends `review`. Needs `workflow_instance:create` — **the seeded `supervisor` role doesn't hold it**, so a supervisor-held review stage is blocked with an explanation until the seed grants it |
| Revision uploads | 🟨 `pendingDocumentRevisions` from `GET /tasks/:id`: banner + per-document "Changes requested" card + `DocumentVersionsPanel` upload, only for the active task's holder **with `document_version:create`** — what the backend route checks. Was gated on `document:edit`, which the seeded `staff` role doesn't hold, so staff never saw the button (found in testing 2026-10-02; the old `/doc/[id]` had the same bug). Restore is likewise gated on `document_version:restore` now. Uploading resolves the revision (backend) and refetches the task |
| Activity trail / stage progress | ✅ `WorkflowActivityPanel` (moved from `/doc/[id]`). Trail is a fixed 340px scroll area and the viewer column is sticky on wide screens, so a long trail no longer pushes the page far below the document |
| **Attach an additional document** | 🟨 only as part of "Mark reviewed" (above). No standalone attach button yet — multi-document *start* is being added on the backend |
| **Comments / signatures** | ✅ unchanged — `comment` on any action, signature image on `approve` only (BE-16). **2026-10-08 (🟨 not verified live):** the signature can be drawn, **typed** (the name is rendered in a script face onto a canvas, which becomes the same PNG) or uploaded |

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
| 2 | ✅ ~~Two-call create-then-start in `workflowInstancesService.start()`~~ — **done**: `createAndStart` posts the instance then `/:id/start` (ticked 2026-10-08; the row was stale) | Frontend | — | Was: unblocks the approval half of the product |
| 3 | ~~Authorization on the workflow routes~~ — ✅ **done 2026-09-04**, enforced in all five workflow services. **New:** split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES` so `staff`/`supervisor` can read definitions (DRIFT-14) | Backend | 1 day | **Routing is blocked for the roles that hold `workflow:route`** |
| 4 | ✅ ~~Fix the 12 login test-account emails to the `tjoel+…` set~~ — **done**: 7 autofill buttons, all matching the backend seed (ticked 2026-10-08) | Frontend | — | Was: every autofill button failed |
| 5 | JSON 404 handler in `app.ts` | Backend | 5 min | Makes 8 broken calls fail legibly |
| 6 | ✅ ~~Make `usePermissions` parse three-segment strings~~ — **done 2026-09-10, backend caught up 2026-09-15.** `src/lib/permissions.ts` normalises/matches on `resource:action`, parses scope separately; role-name heuristics removed; gating now permission-key based (`routes.config` `anyPermissions`). Login + `GET /auth/me` now return a live, scoped `permissions` array — that's the source of truth; `useHydratePermissions` (from `GET /roles`) only tops up keys it's missing | Frontend + Backend | — | Was: every `<Guard>` would go dark the moment `/auth/me` returned `permissions`; that day has arrived and it didn't |
| 7 | ✅ ~~Fix `effStatus()`~~ — **done 2026-09-21** (DRIFT-13): `effStatus` deleted for `taskStatusLabel`/`isOverdue` in `utils/supervisor.ts`. Since `919d0ef` list responses lack deadlines again, so list overdue counts come from open SLA breach events (DRIFT-19) (ticked 2026-10-08) | Frontend | — | Was: every overdue badge read zero |

*Items 1, 2, 4, 5 and 6 total under two hours and move the product from "demo with a broken
core loop" to "working document workflow". Item 7 adds two more and restores every SLA and
ageing indicator.*

### 🟠 P1 — the next two to three weeks

| # | Item | Owner | Unblocks |
|---|---|---|---|
| 8 | Presigned upload endpoint + async Textract + **unconditional** search indexing | Both | OCR **and** search together |
| 9 | Notifications module + wire the SLA worker to it | Backend | Task assignment, SLA warnings, circular acks |
| 10 | ✅ ~~Audit module: `AuditService.log()` everywhere + hash chain + `GET /audit`~~ — **done, both halves** (DRIFT-11 resolved, 2026-09-18). `admin/audit`, `auditor/trail` and `management/compliance` all read the real trail; `platform/audit` stays mocked by design (no cross-tenant backend exists) | — | **The auditor dashboard and the compliance claim are both real now** for every tenant-scoped role |
| 11 | ✅ ~~Next.js `middleware.ts` for server-side route protection~~ — **done** 2026-09-21, as `proxy.ts` (Next.js 16's rename). Fails closed only on a confirmed 401/403, fails open on an unreachable backend, covered by a session-expired modal and a service-unavailable overlay. See DRIFT-02 (resolved) in doc 01 §4. | — | Closed the forgeable-role hole |
| 12 | Cabinet access-grant UI **+ backend read-path enforcement, shipped together** | Both | Need-to-know actually works |
| 13 | ✅ ~~Delegation UI~~ — `/delegations` exists, wired to `useDelegations`/`useCreateDelegation`/`useEndDelegation`. Was stale here; caught 2026-09-18. Not re-verified end-to-end. | Frontend | Supervisors can take leave |
| 14 | ✅ ~~Repoint the role matrix editor~~ — already on `PUT /roles/:id/permissions` via `useSetRolePermissions`. **2026-09-10** also added role **rename**/**delete** (`useUpdateRole`/`useDeleteRole`), user **role assign/remove** on save (`POST`/`DELETE /users/:id/roles`), and moved the resource/action vocabulary into `src/lib/permissions.ts` | Frontend | Was: silent data loss |
| 15 | ✅ ~~`POST /users/invite`~~ + mail transport + password reset — **`POST /users/:id/invitation`** (resend, not initial-creation invite) **and `POST /auth/reset-password` both wired 2026-09-18**; remaining: make *initial* user creation send a real invite instead of a hardcoded default password, and login rate limiting | Backend/Frontend | Removes most of the admin password handling |

### 🟡 P2 — the following month

| # | Item | Owner |
|---|---|---|
| 16 | ✅ ~~Aggregation/reporting endpoints; then delete `fetchAllPages.ts`~~ — **backend half done** (8 endpoints exist); **frontend half done for management** (2026-09-21) — all four management dashboards rewired onto them, `useAllTasks`/`useAllWorkflowInstances` deleted. `fetchAllPages.ts` itself stays: `useAllDocuments` still legitimately lists every document in one cabinet for `admin/cabinets`/`staff/cabinets`, which no aggregate endpoint answers. Supervisor-side adoption (§2) not yet checked. | — |
| 17 | `Finding` model + endpoints + a management-oriented view | Both |
| 17a | `departmentId` filter on `GET /documents` (and `GET /workflow-instances`) so management charts can drill down to the records behind a department's bar (21.6, 22.3). Until then (2026-10-08) a bar click scopes the dashboard to that department | Backend |
| 18 | 🟨 ~~Cabinet metadata-field designer~~ (done) + dynamic upload form — **built 2026-10-07, not verified live**; only usable by uploaders with `document_metadata:edit` + `edit` on the cabinet until the backend accepts metadata on `POST /documents` | Frontend |
| 19 | ✅ ~~Comments and signatures endpoints~~ — task-action fields suffice (`comment` string on any action, `approve`'s required `signature` image). Dedicated `GET/POST /documents/:id/comments`/`/signatures` exist and were briefly wired 2026-09-18, then deliberately un-wired the same day: product wants one workflow trail, not a second task-independent thread. | — |
| 19a | Optional `signature` on the `review` task action (BE-16) — "Mark reviewed" already has an optional-comment modal; needs the backend to accept a signature there too, the same way `approve` does | Backend |
| 19b | 🟨 ~~Support more than one document per workflow instance (BE-17)~~ — **backend done** (`5144fc7`, then per-document routing and SLA in `919d0ef`, 2026-10-06). **Frontend done 2026-10-07, not verified live** (DRIFT-19): routing several documents makes one workflow; the workflow page lists its documents with each one's stage and deadline; approve/reject/review/request-changes act on chosen documents. Open on the backend: deadlines in the task and instance **lists**, and an on-time endpoint — until then list due dates, the Monitor's stage/due columns and SLA % show "—" | Frontend |
| 20 | Document download/export/print, gated by the existing tier allowlists | Backend |
| 20a | **Full ingestion format support** (logged 2026-10-08). The PRD and tracker require PDF, Office (Word/Excel/PowerPoint), JPG/PNG/TIFF and email (EML/MSG), plus ZIP archives expanded on ingestion, all with validation and preview rendering, and OCR on image-based/scanned files. **Today:** upload accepts PDF, DOCX, XLSX, TIFF, JPG, PNG; only PDF and JPG/PNG preview; PowerPoint, legacy .doc/.xls/.ppt, EML, MSG and ZIP are refused. Every file is sent to Textract, which fails on DOCX/XLSX, and the search index is only built after OCR succeeds — so DOCX/XLSX (and any file whose OCR fails) are **not searchable at all, not even by title**. **Agreed approach:** *backend* — at upload, render a PDF preview copy (LibreOffice for Office; message header + body for email, each attachment filed as its own linked document), extract text directly from born-digital files, OCR only images and scanned PDFs, and index title + metadata even when there's no text; *frontend* — accept the new types, expand ZIPs in the browser into one upload card per file (nested ZIPs too, unsupported entries flagged), show the preview copy in the existing PDF viewer, and until then a readable fallback ("Word documents can't be previewed yet" + Download) instead of the raw MIME type. Rejected: Microsoft's Office viewer (sends documents to a third party). Optional stopgap if the backend is far off: in-browser previews for DOCX/XLSX/TIFF only | Both |
| 21 | 🟨 ~~Circulars: model, endpoints, audience targeting, ack tracking~~ — **backend module built; frontend wired 2026-10-05** (inbox, reader, manage area). Remaining: verify end to end against a live backend. (The Roles editor already offers `circular:*` — its matrix is built from the `GET /roles` union, and the backend accepts any seeded key — grouped under "Communication" in `MODULE_MAP`) | Frontend |
| 22 | Retention policy endpoints + enforcement job | Backend |
| 23 | Branding model + endpoints + logo upload | Both |
| 24 | ✅ ~~Version-restore and archive buttons~~ — **done 2026-09-10.** `/doc/[id]` right column has a `DocumentVersionsPanel` (list · open · restore · upload new version) and an "Archive document" item in the More menu; `DocumentDetailsPanel` gains an inline metadata editor when the user holds `document:edit` | Frontend |
| 25 | ✅ ~~`GET /workflow-history` tab on `/doc/[id]`~~ — **already done**, this row was inconsistent with the page's own feature table above (which correctly marked it ✅) | — |
| 26 | Paginate cabinets, folders, roles, departments | Backend |
| 27 | ✅ ~~Remove `@ts-nocheck`~~ — **done 2026-10-08**: `search` lost it in its 2026-09-30 rebuild, `admin/workflows` on 2026-10-08. No file carries it now | Frontend |
| 28 | ✅ ~~Fix `/platform/flags` re-exporting the wrong page~~ — **done 2026-10-08** | Frontend |
| 29 | ✅ ~~Role switcher in the Topbar for multi-role users~~ — **built 2026-10-08, 🟨 not verified live**: one portal per built-in role held, choice kept per user in `prefs` (doc 04, Multi-role users) | Frontend |
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

**The governance half is a convincing UI over fixture data.** Notifications,
policies, findings and platform operations (circulars moved onto the real API
2026-10-05, not yet verified live) account for at least 19 of the 51 pages
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
