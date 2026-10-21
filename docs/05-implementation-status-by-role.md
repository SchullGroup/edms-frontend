# 05 — Implementation Status by Role Dashboard

**Status:** Written 2026-08-29. Every row verified against the source.

> **Re-checked 2026-10-16** — every open backlog item, against `edms-backend` `origin/dev`
> (`a88f279`), this repo, and the live API signed in as the seeded test accounts.
>
> **Wrong, now corrected:**
> - **DRIFT-14 does not block the live tenant** (P0 #3). `staff_finance`,
>   `supervisor_finance`, `management_ops` and `auditor` hold `workflow:view:global` and get
>   200 from `GET /workflows`. Only the seed lacks the grant, so a freshly seeded tenant
>   would be blocked. 🔴 → 🟠.
> - **#19b is done.** List deadlines and `GET /sla/outcomes/summary` shipped in backend PR
>   #50 (live 2026-10-13, verified in TEST_PLAN Phase U).
> - **#20 understated the signed-URL bypass:** the version list leaks signed URLs too.
>
> **Re-confirmed still open:** P0 #5 (an unknown route returns a `text/html` 404, checked
> live), #12 (document list/detail/search check no cabinet grants), #15 (no login rate
> limiting), #17 (no `Finding` model), #19a (`review` takes no signature), #22
> (`RetentionPolicy` model only — no router, no job), #23 (no branding model), #26 (see the
> row), #30 (no tests in either repo), the OCR stuck-job sweep (DRIFT-06: 3 attempts with
> backoff, nothing re-queues a job stuck at `pending`), and the 14 mock pages.

> **Re-checked 2026-10-15** against `edms-backend` `dev` (`9998e05`, 134 routes) and this
> repo (58 pages). The dated revision notes below are history, and several of their
> statements no longer hold:
>
> - **Notifications are emitted.** `notifyUser` / `notifyAssignment` / `notifyRole` are
>   called from tasks, SLA, documents, checkout-overdue and circulars (DRIFT-10, resolved
>   2026-09-21). *Not* "nothing calls `notifyUser`".
> - **Workflow routes are guarded at the router too.** `workflows.router.ts` has 40
>   `requirePermission` calls across 39 routes. *Not* "a route-level grep still shows zero".
> - **DRIFT-14 has a different cause.** `WORKFLOW_DEFINITION_VIEW_ROLES` no longer exists.
>   `GET /workflows` requires `workflow:view`, and the seed grants it only to
>   `client_admin` and `schulltech_admin`. The symptom is unchanged.
> - **OCR works, and the upload never went to the wrong bucket** (DRIFT-06's claim was
>   retracted 2026-09-21). Search indexes at create since PR #51 (2026-10-14).
> - **The management dashboards use the aggregation endpoints** (DRIFT-07, 2026-09-21).
>
> Corrections from this pass are marked *(re-checked 2026-10-15)* where they occur.

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

**Re-scanned 2026-10-12** against `edms-backend` @ `dev` (`ee5fb51`, PR #47 →
`3014b89` "improve routing and access controls"). The live API already serves it: its
swagger describes department task assignment and "Restricted document" entries. Three
contract changes break or change frontend behaviour today (doc 01 → DRIFT-20…22):

- ✅ ~~**Request access is broken (DRIFT-20).**~~ *Fixed 2026-10-12.* `POST /documents/:id/access-requests` now
  requires `permission: 'view' | 'route'`; the frontend sent only `{ reason }`, so every
  request was refused (422; this said 400 until checked live). *Fixed on both pages
  2026-10-12, verified live.* Document grants are per permission now: a `route` grant lets someone
  act on a document in a workflow without being able to open it.
- ✅ ~~**The workflow page crashes on a document the user can't see (DRIFT-21).**~~ *Fixed
  2026-10-12, verified live.*
  `GET /tasks/:id` and `GET /workflow-instances/:id` now return every document, with Restricted
  documents as `title: 'Restricted document'`, `confidentiality: null`, no version, and an
  `access` object (`canView`, `canRoute`, `canRequestView`, `canRequestRoute`).
  `ConfBadge` calls `titleCase(null)` and throws. Workflow history also blanks comments,
  notes and signatures for workflows holding a document the reader can't see.
- 🟠 **Starting a workflow no longer lets you see it (DRIFT-22, backend; confirmed intended 2026-10-12).** At `own` scope,
  `GET /workflow-instances` and access to `/workflow-instances/:id` now follow task
  assignment only; the old "you created one of its documents" rule is gone. A `staff` user
  who routes a document to a supervisor stage loses sight of that workflow.
- 🆕 **Stages can be assigned to a department** (`department_id` on a stage, alone or with
  a role; tasks carry `assignedDepartmentId`). **Department-only built 2026-10-13** (backlog
  14a); **role + department and sub-departments built 2026-10-16** on edms-backend PR #52
  (`sub_department_id`). One department per stage, matched exactly (decision 2026-10-16).

Two page rows were also stale and are corrected below: `/notifications` (wired to the
real API since `bba1e2d`, not mock) and `/supervisor/bottlenecks` (reads the server's
ageing endpoint; the "overdue is always 0" bug is gone).



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

**59 pages across 6 role dashboards** (`find src/app -name 'page.tsx' | wc -l`, re-derived
2026-10-20 — +1: the `/admin/workflows` list, the designer moving to `/admin/workflows/[id]`;
58 on 2026-10-05, 53 on 2026-10-02, 51 on 2026-09-18, 42 at last full classification). The
+4 on 2026-10-05 are the circulars pages `/circulars/[id]`, `/circulars/manage`,
`/circulars/manage/new` and `/circulars/manage/[id]` (classified under Shared pages). The +2
on 2026-10-02 were the notification-link landing pages `/tasks/[id]` (redirect-only) and
`/workflow-instances/[id]` (DRIFT-17) — the latter became the full workflow page later the
same day. All are listed under Shared pages below.

> ✅ **Every page has a row (2026-10-08).** The last seven without one were classified:
> `/admin/departments`, `/admin/workflows/instances`, `/supervisor/instances`,
> `/delegations`, `/forgot-password`, `/set-password` and `/user-stories`. The table below
> was re-tallied from the page rows, not carried forward. The "By data source" bars further
> down were re-derived over all 58 pages on 2026-10-15.

Every classification below was verified by inspecting what each page destructures from
`useStore` versus which API hooks it calls.

> **Classification rule.** Reading `currentUser` / `prefs` from the store is *legitimate
> client session state* and does not make a page hybrid. A page is **Hybrid** only when it
> renders `SEED` **domain** data (documents, users, findings, audit, tenants…) alongside
> live API data, or depends on one of the four mock service modules.

| Dashboard | Pages | ✅ Live | 🟨 Partial / Hybrid | 🟥 Mock | ↪️ / static | Verdict |
|---|---:|---:|---:|---:|---:|---|
| Staff Workspace | 4 | 4 | — | — | — | **Strongest.** Real data throughout. |
| Supervisor Console | 7 | 5 | 1 | 1 | — | Approvals, ageing and the Workflow Monitor real; exceptions/performance fixture. |
| Management Portal | 7 | 5 | 1 | 1 | — | The only fully API-driven pages — and the ones that don't scale. |
| Client Administration | 13 | 8 | 2 | 1 | 2 | Structure real; branding mock, policies Hybrid (SLA tab real). `/admin/circulars` and `/admin/workflows/instances` are redirect/re-export. |
| Audit & Compliance | 4 | 1 | 1 | 2 | — | Trail real; dashboard and findings fixture. |
| Platform Admin | 6 | — | — | 6 | — | Mock by design (Phase 2). |
| Shared | 18 | 9 | 5 | — | 4 | Login, upload, search, circulars and the workflow page live; delegations, notifications and the password pages 🟨 not re-verified; `/doc/[id]` Hybrid. |
| **Total** | **59** | **32** | **10** | **11** | **6** | |

*(Re-tallied 2026-10-08 from each page's row in this doc: all 57 `page.tsx` files. Later the
same day `/admin/policies` (SLA tab) and `/management/reports` moved 🟥 → 🟨, and `/help`
(static) was added, making 58. 2026-10-13: `/supervisor/instances` 🟨 → ✅, `/supervisor/performance` 🟥 → ✅.
2026-10-20: the workflow list `/admin/workflows` added ✅, the designer now `/admin/workflows/[id]`, making 59.)*

*Confirmed by the product owner's own testing, 2026-10-08:* the admin setup checklist, the SLA
settings, sub-folders, batch upload ("File all") and multi-document workflows. Page markers
are unchanged where the page has other unverified parts.

*Confirmed by the product owner's own testing, 2026-10-09:* circulars (all five pages),
management reports, the SLA settings tab, the audit record-type/action filters, search
results (including routing a selection), sub-folders, and the workflow page's approve,
reject, request changes and review-with-upload. That moved seven pages 🟨 → ✅: the five
circulars pages, `/search` and `/management/reports`; plus `/workflow-instances/[id]`, whose
remaining unverified parts (delegate, close, the access overlay) are listed on its own rows.
`/admin/policies` stays 🟨 Hybrid: its other tabs are still `SEED`. Re-tallied from the page
rows: 29 ✅, 10 🟨, 13 🟥, 6 static.

*Corrected 2026-10-12:* `/notifications` was listed 🟥 Mock, but it has called the real API
since `bba1e2d` (list, unread filter, mark read / all read, delivery preferences). It moves to
🟨 (API-only, not verified end to end): 29 ✅, 11 🟨, 12 🟥, 6 static.
*(🟨
counts Hybrid pages and API-only pages not yet verified end to end — Partial, not ✅, per
house rule 1. ↪️ / static: `/admin/circulars`, `/admin/workflows/instances`, `/tasks/[id]`,
`/unauthorized`, `/user-stories`. `/admin/cabinets` and `/staff/cabinets` moved 🟨 → ✅
after the user tested cabinet management end to end.)*

### By data source

```
Renders live API data      ██████████████████████████████░░░░░░░░░░  44 pages (75%)
Renders fixture data       ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14 pages (24%)
Both, on the same page     ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3 pages (5%)
Neither (redirect/static)  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4 pages (7%)
```

*Re-derived 2026-10-15 over all 58 pages (the bars it replaces — 21 / 23 / 6 / 3 — were
from the 42-page pass). Method: the AGENTS.md per-page commands, then three adjustments.
(1) A re-export counts as the page it renders: `/admin/workflows/instances` and
`/supervisor/instances` render `WorkflowInstanceMonitor` (API); `/auditor/compliance`
renders `/management/compliance` (both); `/management/findings` renders
`/auditor/findings` (fixture). (2) "Fixture data" is `SEED` domain keys destructured from
`useStore` (`findings`, `audit`, `users`, `tenants`, `plans`, `featureFlags`), a mock
service (`useBranding`, `usePolicies`) or an inline array (`/supervisor/exceptions`,
`/platform/sysconfig`). Session state (`currentUser`, `prefs`) and the `auditAction`
pseudo-log don't count, per the classification rule above. (3) `/admin/branding` and
`/supervisor/exceptions` import from `@/apis/hooks` but only reach mocks, so they count as
fixture-only. Both: `/management/compliance`, `/auditor/compliance`, `/admin/policies`.
Neither: `/admin/circulars` (redirect), `/help`, `/user-stories`, `/unauthorized`.
Check: 40 API-only + 11 fixture-only + 3 both + 4 neither = 58, and the 11 fixture-only
pages are exactly the 11 🟥 in the portfolio table. 2026-10-20: the `/admin/workflows`
list is API-only, so 41 + 11 + 3 + 4 = 59.*

The split is clean: most pages are decisively one thing or the other. The **11 mock pages
cluster in three places** — Platform (6/6, by design), the auditor's dashboard and
findings (plus management's re-export of findings), and two Client Admin/Supervisor
screens (`/admin/branding`, `/supervisor/exceptions`). *(Was "20 mock pages … Auditor (4/4),
Platform (6/6), and the governance half of Client Admin (4/8)".)*

### The ~~four~~ three mock service modules

Some pages appear "wired" because they call a hook, but the hook resolves a fixture
(was four — `circulars.service.ts` moved onto the real API 2026-10-05):

| Hook | Service | Actually returns |
|---|---|---|
| `useAuditLogs`, `useCreateAuditLog` | `audit.service.ts` (`getAll`, `logAction` only — the same file's `search`/`getById`/`export`/`verify` are real) | `SEED.audit` / a no-op after `setTimeout(400)` |
| `usePolicies`, `useUpdatePolicy*` | `policies.service.ts` | `SEED.policies` |
| `useBranding`, `useUpdateBranding` | `branding.service.ts` | `SEED.branding` |

`useCreateAuditLog()` in particular *(re-counted 2026-10-15)* is called directly from
**six** pages (`/doc/[id]`, `/supervisor`, `/supervisor/approvals`,
`/supervisor/bottlenecks`, `/supervisor/exceptions`, `/supervisor/workload`), and also
from `useRouteToWorkflow` and `useWorkflowTaskActions`, so every page that routes a
document or acts on a task reaches it too. It resolves successfully every time without
doing anything, so those actions show a success toast for a log entry that was never
written. *(The backend does audit the underlying actions itself — DRIFT-11 — so the
real trail is not missing them; only this extra frontend "log" is fake.)* `useAuditLogs`
has no page callers left.

## The three kinds of dummy data

Not all fixtures are the same, and the fix differs for each.

### Type 1 — `SEED` in the Zustand store *(the big one)*

`src/store/initialData.ts` — **1,466 lines** *(re-counted 2026-10-15; was 1,520)*, spread
into `useStore` and **persisted to `localStorage` under `edms-state-v3`**.

Contains (`SEED`): `users`, `cabinets`, `docTypes`, `documents`, `notifications`,
`workflows`, `rolesMatrix`, `tenants`, `findings`, `audit`, `policies`, `featureFlags`,
`plans`, `branding`, plus the per-user `savedSearches`, `recentDocuments` and
`pinnedDocuments`. Most of the domain keys have no page readers left — see "By data
source" for the eight that do.

**Why it's the worst kind:** it is persisted, so a stale snapshot survives rebuilds and
redeploys. *(Re-checked 2026-10-15: the persist config is now `version: 5` with a `migrate`
function, so "`version: 3` … there is no migration" no longer holds.)* Roughly 25 store mutators
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
| ~~`upload/page.tsx`~~ | ~~`IDU_GUESSES`~~ | **Removed 2026-10-14** — presented a fabricated document type, cabinet, folder, confidence badge and "extracted metadata" chips in the product's most prominent flow, with nothing signalling it was fixed data |
| `supervisor/exceptions/page.tsx` | `useState([...])` (3 rows) | Control failures, SLA breaches, access anomalies *(SoD row removed 2026-10-21 — out of scope)* |
| ~~`management/reports/page.tsx`~~ | ~~`DEPTS`~~ | **Removed 2026-10-08** — departments come from `useDepartments` |

**Why it's the sneakiest kind:** the fixtures in this table present fabricated output that
looks computed. `IDU_GUESSES` gave every queued file a made-up classification and a
confidence percentage, in the flow the whole product hinges on — nothing in the UI said so.
It was removed rather than relabelled on 2026-10-14 exactly for that reason, and the upload
card now starts blank; `supervisor/exceptions` is the only entry left here.

---

## 1. Staff Workspace (`staff`)

**Landing:** `/staff` · **Sidebar:** Workspace / Documents / Communication / Insights
**Overall: 🟨 The strongest dashboard.** Capture and filing genuinely work.

### Page inventory

*Owned pages. `/upload`, `/search`, `/doc/[id]`, `/circulars` and `/notifications` are
shared — see [Shared pages](#shared-pages-used-by-multiple-roles).*

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/staff` | 427 | `currentUser`, `recentDocuments`, `pinnedDocuments`, `savedSearches` (per-user browser state, not `SEED`) | `useTasks`, `useWorkflowInstanceStatusCounts`, `useWorkflowInstances`, `useSlaBreaches`, `useNotifications` ✅ | ✅ Live — **2026-10-08 (confirmed by the product owner’s testing, 2026-10-12):** the Pending / In Progress / Closed tiles count workflows, and clicking one now lists those workflows (`GET /workflow-instances?status=`, `mine` scope; In Progress adds `on_hold`), each opening its workflow page. Before, a click filtered the *task* list, so Closed was always empty. Overdue still filters tasks by open SLA breach. "Closed (30d)" relabelled "Closed": the count isn't limited to 30 days. "View all" goes to My Tasks, not Search. *(The "notification panel dead" note was stale: notifications are wired.)* **Quick access card (2026-10-08, 🟨 not verified live):** action buttons, pinned and recently opened documents, saved searches — kept per user in the browser, since the API has no favourites or view history **SLA compliance (2026-10-13, verified live):** the donut reads `GET /sla/outcomes/summary` for the last 30 days ("—" with no results) **2026-10-13:** the empty workflow list explains that workflows show only while you hold a task in them |
| `/staff/tasks` | 120 | `currentUser` | `useTasks` ✅ | ✅ Live — **2026-10-20 (verified live in a browser as `supervisor_finance`):** Status defaults to **Open** (`status=pending`), with Overdue and All. Under All, completed tasks filled the oldest-first pages (that account's page 1: 16 completed, 3 pending, 1 escalated). `status` takes one value, so an escalated task shows only under All · **2026-10-19 (verified live as `supervisor_finance`):** paginated through `GET /tasks` (`page`, `limit=20`, shared `Pagination`), and only API-backed controls remain — Status: All / Overdue (`overdue=true`), Sort: Oldest first / Due date (`sort=createdAt|dueAt`). Removed: Urgency (no API filter), Pending (always empty: a task's workflow has always started), In Progress / On Hold and Sort by urgency / Newest (applied in the browser, so they only reordered or split the current page). *Was:* one request with the default page, so it showed the oldest 20 tasks and nothing newer · *Earlier:* **2026-10-13 (verified live):** rows show each open task's deadline and "Overdue" past it (PR #50); documents the user can't open show as "Restricted document" · **2026-10-14 (verified live):** Overdue and "Sort: Due date" are server-side (`overdue`, `sort=dueAt`), so they cover every task, not just the page fetched; In Progress and On Hold, which used to fail (400 — not task statuses), fetch open tasks that aren't overdue and split by workflow state |
| `/staff/cabinets` | 821 | `auditAction` only | `useCabinets`, `useCabinet`, `useCabinetFolders`, `useDocuments` ✅ · folder create/rename/delete, `documentsService.update` (move), metadata-field + access-grant hooks via the shared `components/cabinets/` cards | ✅ Live — cabinet management added 2026-10-06 (see below), tested end to end by the user 2026-10-08. **Sub-folders 2026-10-08 (confirmed by the product owner's testing 2026-10-08 and 2026-10-09):** the tree nests folders by `parentId`, an open folder lists its sub-folders and offers **+ New sub-folder**, breadcrumbs show the full path, and a folder with sub-folders can't be deleted (the API would orphan them). Folder pickers on Move, `/upload` and the workflow document picker show paths ("Finance / Invoices"), as does the `/doc/[id]` breadcrumb. *Uploader names come from `useUsers`, not `SEED.USERS` as this row used to say — corrected 2026-10-06.* **2026-10-20 (verified live as `staff_finance`):** "Uploaded by" reads each document's `creator` (edms-backend PR #53) and the page no longer calls `GET /users`, a 403 for staff that left every row "Unknown" |
| `/staff/performance` | 225 | `currentUser` | `useTasks`, `useSlaBreaches`, `useSlaOutcomeSummary` ✅ | ✅ Live — **2026-10-08:** the hard-coded "Rework rate 4.2%" and "-0.4 d vs last period" are gone; it shows **Changes requested** (share of the user's completed tasks closed with `request_changes`, from `Task.action`). SLA compliance stays "—" (DRIFT-19) **On-time figures (2026-10-13, verified live):** SLA compliance, On time and Breached come from `GET /sla/outcomes/summary` (last 30 days); were "—" |

### APIs wired ✅

```
GET  /tasks                                  task queue · ?page&limit=20&status=pending|overdue=true&sort=createdAt|dueAt (My Tasks, 2026-10-20)
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
POST  /circulars/inbox/:id/acknowledge   ✅ wired 2026-10-05, confirmed 2026-10-09
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
Since edms-backend `dd10017` (2026-10-09) the API enforces the grant rules too (no granting
to yourself, to a role you hold, or above your own level: 403), and `PATCH /documents/:id`
can move a document to another cabinet (`cabinetId`) or to the cabinet root
(`folderId: null`). The move dialog still offers only this cabinet's other folders:
cross-cabinet Move waits on the backend checking edit on the **source** cabinet, not just the
destination (request doc item 7).

### APIs missing ⛔

| Needed | Status | Impact |
|---|---|---|
| ~~`POST /workflow-instances` + `/:id/start`~~ | ✅ Resolved (DRIFT-09) | — |
| ~~`GET/PATCH /notifications*`~~ | ✅ **Built and wired** — this row was stale (corrected 2026-10-12). The module exists and fires on assignment, outcomes, delegation, access requests, SLA warning/breach (doc 01 DRIFT-10); `/notifications` and the bell call it | — |
| ~~`POST /documents/:id/access-requests` with `permission`~~ | ✅ **DRIFT-20 fixed 2026-10-12** — `/doc/[id]` sends `view`; the workflow page sends `view` and/or `route` (verified live) | — |
| ~~`POST /documents/:id/comments`~~ | Not a real endpoint — use the `comment` field on `POST /tasks/:id/action` | — |
| ~~`GET /documents/:id/download`~~ | ✅ Not needed — downloads go through `GET /documents/:id/versions/:versionId`, which checks `document:download` + clearance (`0dab81a`); see What's left #5 *(row stale until 2026-10-15)* | — |
| `workflow:view` for non-admin roles | 🟠 **Seed gap (DRIFT-14)** — `GET /workflows` needs it, and the seed grants it only to `client_admin`/`schulltech_admin` | On a freshly seeded tenant, the route picker can't list workflows for staff. The live tenant's staff role holds the grant (re-tested 2026-10-16) *(added 2026-10-15)* |
| ~~`GET /circulars`, `POST /circulars/:id/ack`~~ | ✅ **Built** (backend `circulars` module) and wired 2026-10-05 — the real routes are `/circulars/inbox*` (see APIs wired) | — |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| ~~Sidebar "My Tasks" badge~~ | ✅ **Fixed 2026-10-12** — counts the caller's pending tasks (`GET /tasks?scope=mine&status=pending&limit=1` → `pagination.total`); verified live (staff: 1, matching the API) | Was `SEED.documents`, which didn't match the real task queue. *The Notifications, Approvals and Circulars badges are real (re-checked 2026-10-12); this row used to include `SEED.notifications`* |
| ~~`/upload` IDU card~~ | ~~`IDU_GUESSES` inline~~ | **Removed 2026-10-14** — the card now starts blank and the only extra inputs are the cabinet's own metadata fields. Was: a fake classification with a fake confidence score |
| ~~`/staff/performance`, `/staff`~~ | ~~hard-coded "Rework rate 4.2%" and a turnaround delta~~ | **Removed 2026-10-08** — replaced by a real "Changes requested" rate (`changesRequestedRate`, `utils/supervisor.ts`) |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Log in → land on `/staff` | ✅ | |
| Browse cabinets → folders → documents | ✅ | ⚠️ cabinet grants enforced on cabinet/folder reads, not document reads *(re-checked 2026-10-15)* |
| Upload → checksum → storage → create | ✅ | Cabinet metadata sent with the create call since 2026-10-09 (verified live). Chunked presigned upload; **PDF and images only since 2026-10-21** (PM) — PDF/TIFF ≤100 MB, JPEG/PNG ≤10 MB, Textract's async image cap *(2026-10-02 → 10-21: PDF/DOCX/XLSX/TIFF/JPEG/PNG at 100 MB, `uploadTypes.ts` since `c8e9d24`; before that "⚠️ 2 MB cap, PDF/images only, external gateway")* |
| Open a document, view metadata + versions | ✅ | |
| Check out → edit → check in | ✅ | ⚠️ only the holder can release the lock |
| Upload a new version | ✅ | Auto-increments |
| **Route for approval** | 🟨 | Two-call create-then-start; several documents per workflow since 2026-10-07 (DRIFT-19), confirmed in testing 2026-10-08. ~~🔴 *2026-10-15:* the seed gives staff no `workflow:view`, so a seeded staff user's picker should be empty (DRIFT-14). Re-test as `tjoel+staff_finance@…` to settle which is true~~ *Settled 2026-10-16:* the live `staff_finance` holds `workflow:view:global` and gets 200 from `GET /workflows`; only a freshly seeded tenant would be blocked (DRIFT-14) |
| Search by content | ✅ | **Corrected 2026-10-14.** Was "⛔ Index never built (OCR always fails)" — wrong since the 2026-09-21 retraction, and fixed properly by edms-backend PR #51 (live 2026-10-14): indexed at create, on title/metadata change, on restore, and on a final OCR failure. A version stranded at `pending` *before* that deploy has no backfill |
| Work the task queue | ✅ | Oldest first or by due date, with an Overdue filter, all server-side and paginated (2026-10-19). *Corrected 2026-10-20: said "prioritised by urgency then due date"; the backend has no urgency order* |
| Act on a task | ✅ | |
| Receive a notification | 🟨 | Backend fires them and the bell + `/notifications` read them (corrected 2026-10-12; was "⛔ 404"). Not clicked through end to end. Arrives within 60 s (polling, no push). The bell's menu shows skeleton rows (one per unread, up to 7) while it loads, and a retry line if it fails (2026-10-13) |
| Request access to a document | ✅ | Verified live 2026-10-12: from `/doc/[id]` (View access: 201, then 409 → "Already pending") and from a Restricted document on the workflow page (View and/or Action access, one request and toast per kind) |
| Comment on a document | ✅ | The `comment` field on `POST /tasks/:id/action` (DRIFT-08; What's left #4). *(Was "⛔ 404" — stale.)* |
| Read/acknowledge a circular | ✅ | Wired 2026-10-05 to `/circulars/inbox*` — read receipt on open, acknowledgement recorded and audited server-side. *(confirmed by the product owner’s testing, 2026-10-09)* |

### What's left, in order

1. ~~**Fix routing** — two-call `POST /workflow-instances` then `/:id/start`.~~ **Done** (`workflowInstancesService.createAndStart`); this line was stale until 2026-10-08.
2. ~~**Fix the upload→OCR bucket** so search works at all.~~ **Retracted 2026-09-21** (there was never a bucket mismatch — doc 01 §5) and **all but done 2026-10-14**: edms-backend PR #51 makes indexing independent of OCR, so search no longer depends on that job at all. What's left of it is the reliability sweep: retry an OCR job stuck at `pending` (DRIFT-06), and backfill versions stranded before PR #51.
3. ~~**Build notifications** (backend module + wire the bell).~~ **Done** on both sides; this
   line was stale until 2026-10-12. Still owed: an end-to-end click-through.
3a. ~~**Fix Request access (DRIFT-20)**~~ — **done 2026-10-12**, verified live.
4. ~~Add `POST /documents/:id/comments`~~ — **done differently (2026-09-10):** comments are the `comment` field on `POST /tasks/:id/action`; the stage-action modals now send it.
5. ~~**Add a download endpoint** gated by `requireConfidentiality('download')`.~~ **Done:** `GET /documents/:id/versions/:vid` checks `document:download` + clearance (edms-backend `0dab81a`); the frontend downloads only through it, clicked through 2026-10-09.
6. ~~**Replace `IDU_GUESSES`** with real extraction, or clearly label it as a preview.~~ **Done differently 2026-10-14** — removed rather than relabelled: there is no extraction to replace it with, it produced a fabricated classification, and the real cabinet-metadata fields (item 7) already collect what the form must.
7. ~~**Render cabinet metadata fields** in the upload form.~~ **Done 2026-10-09**, sent with the upload and verified live.
8. ~~**Drive the My Tasks badge from the API**~~ — **done 2026-10-12**, verified live.
9. ~~**Raise the file-size cap** and support the document types the allowlist already claims.~~ **Done** — chunked upload, 100 MB cap, PDF/DOCX/XLSX/TIFF/JPEG/PNG (`src/constants/uploadTypes.ts`, `c8e9d24`, 2026-10-02); stale until 2026-10-15. **Narrowed 2026-10-21** to PDF and images (PDF/TIFF ≤100 MB, JPEG/PNG ≤10 MB) by PM decision, so every upload can be OCR'd.
10. **Get `workflow:view` seeded for staff** (DRIFT-14) — backend seed change; see doc 03 fix 3b. *(2026-10-16: the live tenant's role already holds it; this is so a freshly seeded tenant works.)*

---

## 2. Supervisor Console (`supervisor`)

**Landing:** `/supervisor` · **Sidebar:** Oversight / Quality / Documents
**Overall: 🟨 Approvals are real; oversight is half-fixture.**

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/supervisor` | 362 | — | `useTeamStatusMatrix`, `useOpenItemsByCabinet`, `useTasks`, `useAllUsers`, `useDepartmentColleagues`, `useReassignTask` ✅ · `useCreateAuditLog` 🟥 *(hooks re-read 2026-10-15; was `useDocuments`, `useUsers`, `useCabinets`)* | 🟨 Hybrid — audit hook is a no-op · Quick access card (pinned / recent / saved searches, browser-only) added 2026-10-08 |
| `/supervisor/approvals` | 210 | — | `useApprovalTasks` (`GET /tasks/approvals?sort=dueAt`), `useAllUsers`, `useDepartmentColleagues`, `useReassignTask` ✅ · `useCreateAuditLog` 🟥 *(re-read 2026-10-15; was `useTasks`, `useDocuments`)* | ✅ Live — **2026-10-20 (verified live in a browser):** sends `sort=dueAt`, so the queue is nearest deadline first. *Was:* oldest first, while the code comment and empty state claimed "urgency then due date", an order the backend doesn't have · **2026-10-02:** the per-row "Approve" button was removed (approving from a list meant signing without reading the documents); rows keep Reassign and Open, and Open goes to the workflow page |
| `/supervisor/bottlenecks` | 266 | `currentUser` | `useBottlenecksAgeing` (`GET /workflow-instances/bottlenecks-ageing`), `useUsers`, `useReassignTask` ✅ · `useCreateAuditLog` 🟥 | ✅ Live — server-side ageing buckets, stuck items and an active-SLA-breach banner. *Corrected 2026-10-12: this row still described the old client-side version over `useDocuments`, whose "Overdue" was always 0* |
| `/supervisor/workload` | 252 | — | `useTaskWorkload` (`GET /tasks/workload`), `useTasks`, `useAllUsers`, `useDepartmentColleagues`, `useReassignTask` ✅ · `useCreateAuditLog` 🟥 | ✅ Live *(hooks re-read 2026-10-15; was `useDocuments`, `useUsers`)* |
| `/supervisor/exceptions` | 73 | — | **inline `useState` array** | 🟥 Mock |
| `/supervisor/performance` | 324 | — | `useSlaOutcomeSummary` (`groupBy=user`, this and the previous 30 days), `useTaskWorkload` (roster), `GET /tasks?scope=all` walked with `fetchAllPages` ✅ | ✅ Live — **rebuilt 2026-10-13, verified live** (was static markup with invented people). KPIs: team SLA % (on-time stage results), items closed and average turnaround (raised → completed) over 30 days, each against the 30 days before; weekly closures vs new tasks over 6 weeks; a member table (SLA % with on-time/total, closed, turnaround, 6-week sparkline) credited by `completedBy`; Export CSV. Finance supervisor: team 79% (11/14), Finance Staff 88% (7/8, 11 closed), the supervisor 67% (4/6, 9 closed). Walks every task in scope: fine for a department, slow for a large tenant at global scope |
| `/supervisor/instances` | 15 | — | `WorkflowInstanceMonitor` → `useWorkflowInstances`, `useWorkflows`, `useWorkflowInstanceLifecycle` ✅ | ✅ Live — the Workflow Monitor (hold / resume / close). **2026-10-13, verified live:** Current stage and Next due fill from the executions `GET /workflow-instances` returns since PR #50, with an "N of the M shown have passed the stage SLA" banner; it now sends `scope=all`, without which a client admin saw no workflows and a supervisor only their own. *Was 🟨 Partial* · **2026-10-14, verified live:** a Department picker (path-labelled) for viewers with `global` `workflow_instance:view`, pre-set from `?dept=` by the management dashboards' Workflows links; department-scoped viewers get no picker and a foreign `?dept=` is ignored |

### APIs wired ✅

```
GET   /tasks                    ?scope=all for oversight roles
POST  /tasks/:id/action         approve | reject | request_changes | close
PATCH /tasks/:id/reassign       gated by task:reassign (was TASK_REASSIGN_ROLES)
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
                                circulars ✅ wired 2026-10-05, confirmed 2026-10-09 — supervisors write
                                circulars at `own` scope and publish/withdraw at `department` scope
```

### APIs missing ⛔

| Needed | Status | Impact |
|---|---|---|
| `GET /sla/breaches` | ✅ **Wired** (`sla.service.ts`). `/supervisor/bottlenecks` now reads the server's `bottlenecks-ageing` endpoint, which carries the breach count (corrected 2026-10-12) | — |
| `GET/POST /delegations`, `POST /delegations/:id/end` | ✅ **Wired** — `/delegations` (344 lines, `useDelegations`/`useCreateDelegation`/`useEndDelegation`) exists; was stale here. Not re-verified end-to-end in this pass. | — |
| ~~Team aggregation endpoint~~ | ✅ **Exists and wired** — `GET /tasks/workload` and `GET /workflow-instances/team-status-matrix` feed `/supervisor/workload` and `/supervisor` *(row stale until 2026-10-15)*. Only `/supervisor/performance` still walks `GET /tasks?scope=all` with `fetchAllPages` | — |
| `workflow:view` for supervisors | 🟠 **Seed gap (DRIFT-14)** | On a freshly seeded tenant, supervisors can't list workflows to route into; the live tenant's can (re-tested 2026-10-16) *(added 2026-10-15)* |
| ~~Notifications~~ | ✅ Built — SLA warning/breach notifications fire (doc 01 DRIFT-10, resolved 2026-09-21; row stale until 2026-10-12) | — |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/supervisor/exceptions` | 3 hardcoded rows in `useState` | Control failures, SLA breaches and access anomalies are entirely invented *(the SoD row went 2026-10-21)* |
| `useCreateAuditLog` (6 pages + 2 shared hooks; re-counted 2026-10-15) | `audit.service.ts#logAction` stub | Every "action logged" toast is false — though the backend audits the underlying action itself (DRIFT-11) |

### ✅ ~~The overdue bug — `/supervisor/bottlenecks`~~ *(resolved; kept for history)*

> **Resolved.** `effStatus()` was deleted 2026-09-21 (DRIFT-13), and the page was later
> rebuilt on `GET /workflow-instances/bottlenecks-ageing`, so it no longer computes ageing
> in the browser at all. The analysis below describes the old page.

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
| Open and review a document | ✅ | Download through `GET /documents/:id/versions/:versionId` (gated and audited, 2026-10-08). *(Was "⛔ no download" — stale.)* |
| Approve / reject / request changes with a note | ✅ | History written with `elapsedSeconds` |
| Reassign a task | ✅ | Gated correctly |
| See team workload | ✅ | `GET /tasks/workload`. *(Was 🟨 "walks up to 50 pages client-side" — stale.)* |
| See ageing / bottlenecks | ✅ | Server-side ageing and breach count (corrected 2026-10-12; was "overdue permanently 0") |
| Get warned before an SLA breach | 🟨 | The SLA worker notifies (DRIFT-10 resolved 2026-09-21); arrives in the bell. Not clicked through end to end |
| Delegate while on leave | ✅ | `/delegations` exists and is wired — was stale here; not re-verified end-to-end |
| Review exceptions | 🟥 | Hardcoded |
| Export team stats | ✅ | CSV |

> ✅ **Re-audited 2026-10-15.** This note used to warn that the bottlenecks math, workload
> paging and exceptions/performance status had not been re-checked since 2026-09-18. They
> have now: bottlenecks and workload are server-side, performance is live, exceptions is
> still mock. The page table's hook lists were re-read from the code.

### What's left, in order

1. ~~Build the delegation UI~~ — **exists**; verify it end-to-end and demote/remove this
   item if confirmed working.
2. ~~**Fix `effStatus()`**~~ — **done 2026-09-21** (DRIFT-13): deleted for
   `taskStatusLabel`/`isOverdue` in `utils/supervisor.ts`. Stale here until 2026-10-15.
3. ~~**Expose SLA breach data** and point `/supervisor/bottlenecks` at it.~~ **Done**
   (server-side `bottlenecks-ageing`); ticked 2026-10-12.
4. ~~**Build notifications** so SLA warnings actually arrive.~~ **Done** (DRIFT-10); ticked
   2026-10-12.
5. **Replace `/supervisor/exceptions`** with real control-failure detection, or remove it. *(SoD dropped from scope 2026-10-21.)*
6. ~~**Give `/supervisor/performance` a data source.**~~ **Done 2026-10-13** (SLA outcomes + team tasks).
7. ~~**Add a team-aggregation endpoint**~~ — `GET /tasks/workload` and the team-status
   matrix exist and are wired. What's left: move `/supervisor/performance` off
   `fetchAllPages` (it walks every task for the 30-day window).
8. ~~**Allow an admin/supervisor to force-release a stale checkout lock**~~ — **built 2026-10-02.**
   Backend `canReleaseLock` (`document_lock:delete` at `global`, or `department` for the
   cabinet's department); `/doc/[id]` shows "Force check in" to those holders **only once the
   lock is past `expectedReturnAt`**. Supervisors are also notified (`checkout.overdue`) when a
   team member's checkout goes overdue. Not yet verified end to end — a lock with no
   `expectedReturnAt` can never become forceable from the UI (by design, per product call).
9. **Get `workflow:view` seeded for supervisors** (DRIFT-14). *(2026-10-16: the live tenant's role already holds it; this is so a freshly seeded tenant works.)*

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
| `/management` | 356 | **none** | `useDepartments`, `useDocumentStats`, `useTaskStats`, `useOpenItemsByCabinet`, `useWorkflowInstanceStats` ✅ | ✅ Live — server-aggregated · Quick access card (pinned / recent / saved searches, browser-only) added 2026-10-08 · **2026-10-14 (verified live, TP-X3 / TP-Z4):** the department table gained a **Records** column with **Documents** (`/search?dept=<id>`) and, for `global` `workflow_instance:view`, **Workflows** (`/supervisor/instances?dept=<id>`) — the `departmentId` list filters, edms-backend PR #51; a bar click still scopes the dashboard |
| `/management/departments` | 218 | **none** | `useDepartments`, `useDocumentStats`, `useTaskStats`, `useQueries`-over-`workflowInstancesService.getStats` (one per department shown) ✅ | ✅ Live — server-aggregated · **2026-10-14 (verified live, TP-X4 / TP-Z5):** with one department selected, **View records** opens `/search?dept=<id>` and **View workflows** (`global` `workflow_instance:view` only) the Workflow Monitor for it |
| `/management/trends` | 171 | **none** | `useDepartments`, `useDocumentStats`, `useWorkflowInstanceStats` ✅ | ✅ Live — server-aggregated (the forecast/backlog math is still client-side, but it's arithmetic on two already-aggregated series, not a full-list walk) |
| `/management/performance` | 85 | **none** | `useTaskStats` ✅ | ✅ Live — server-aggregated |
| `/management/compliance` | 196 | **`findings`** | `useAllUsers` ✅ · `useAuditEntries` ✅ (migrated 2026-09-18) | 🟨 Hybrid — `findings`/hbar chart still `SEED`. **2026-10-13 (verified live):** the sensitive-activity panel reads `GET /audit` only with `audit:view`; the seeded `management` role lacks it, so the panel now says so instead of a 403 and an empty list. Whether management should hold `audit:view` is a question for the backend/PM (backend spec Q5). **2026-10-20:** the panel names actors from each entry's `actor` (PR #53); `useAllUsers` stays for the `SEED` findings' Owner column |
| `/management/reports` | 322 | — | `useDepartments` ✅ · `getOpenItemsByCabinet`, `getBottlenecksAgeing` (paged, up to 2,000 rows), `tasksService.getStats`, `getTeamStatusMatrix` ✅ | ✅ Live — **rebuilt 2026-10-08, (confirmed by the product owner’s testing, 2026-10-09):** four real reports (open items by cabinet, ageing register, SLA compliance by department, workload by member), each filterable by department, previewed in a table and downloaded as CSV (with a BOM so Excel reads it as UTF-8). Scheduled reports were fake and are now a "not available yet" note: there's no report-job backend |
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
GET /workflow-instances ?departmentId=  the Workflow Monitor behind the Workflows links (2026-10-14)
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
                                        circulars ✅ wired 2026-10-05, confirmed 2026-10-09 — management
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
| Scheduled/emailed reports | No report scheduler. A mail transport exists now (`src/config/mailer.ts`, used for invitations and notification emails) *(re-checked 2026-10-15)* |
| `workflow:view` for management | 🟠 Seed gap (DRIFT-14) — on a freshly seeded tenant management holds `workflow_instance:route:own` but can't list definitions; the live tenant's management role can (re-tested 2026-10-16) *(added 2026-10-15)* |
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
   (`staff/cabinets`: listing every document in one cabinet for a folder-assignment UI,
   which no aggregate endpoint answers; `admin/cabinets` stopped using it in the 2026-10-06
   rework), and `/supervisor/performance` calls `fetchAllPages` directly to walk tasks.
2. **Build `Finding`** — model, endpoints, and a management-oriented view (owner, ageing, department rollup) rather than a re-export. *Now the largest single gap for this role.*
3. ~~**Make `/management/reports` generate real reports.**~~ **Done 2026-10-08** (browser-built CSV; scheduling still needs a backend job).
4. ~~**Correct the frontend permission heuristic**~~ — **done 2026-09-10** (DRIFT-04): the
   role heuristic was deleted; the UI gates on the permission keys from `GET /roles`. Stale
   here until 2026-10-15.
5. **Get `workflow:view` seeded for management** (DRIFT-14). *(2026-10-16: the live tenant's role already holds it; this is so a freshly seeded tenant works.)*

---

## 4. Client Administration (`client_admin`)

**Landing:** `/admin` · **Sidebar:** Administration / Configuration / Communication / Governance
**Overall: 🟨 Structure is real. Branding and the retention/confidentiality policies are browser-side; circulars and the SLA settings are server state.** *(Was "Policy, branding and circulars are localStorage" — circulars moved to the API 2026-10-05, SLA settings 2026-10-08.)*

### Page inventory

| Page | LOC | Store reads | API hooks | Status |
|---|---:|---|---|---|
| `/admin` | 168 | — | `useUsers`, `useCabinets`, `useWorkflows` (published + drafts), `useDepartments`, `useAccessRequestsInbox` ✅ | ✅ Live — **2026-10-08 (confirmed in testing 2026-10-08):** the setup checklist and pending tasks were hard-coded ("SSO enrolment (2 users outstanding)", "812 GB", "+2 this month", three invented tasks) despite this row saying Live. Now the checklist follows doc 03's setup chain against live data (departments, cabinets, a folder in every cabinet, users beyond the first, a published workflow), and pending tasks are real: access requests waiting, unpublished workflow drafts, cabinets with no folder. The storage tile became a departments count |
| `/admin/users` | 515 | `auditAction` only | `useUsers` + mutations, `useRoles` (picker), `useAssign/RemoveUserRole`, `useResendInvitation` ✅ | ✅ Live — users only since 2026-09-10 (roles split out); "Resend invite" added 2026-09-18. **Several roles per user (2026-10-09, verified live):** the invite/edit modal's single role dropdown is now a checkbox list (`RolePicker`); on save, newly ticked roles are added in one `POST /users/:id/roles`, then unticked ones removed one by one with `DELETE /users/:id/roles/:roleId`, so a user is never briefly role-less. Tested by adding `supervisor` to an HR staff user and removing it again. Before, the modal read and wrote only the first role, so a second role could not be given from the UI. **Search (2026-10-13, verified live):** a name-or-email box sends `GET /users?search=` (debounced, back to page 1); "supervisor" narrowed 12 users to 3. **Pending users (2026-10-13, verified live):** an invited user without a password is `pending` (PR #49). The page showed them as Inactive with an Activate button and no Resend invite; now it shows a Pending badge with the invitation date, a Pending filter, Resend invite, and no Activate (activating would leave an account with no password). Resend invite was not clicked: the only pending user is a real person. **Last login and Created columns (2026-10-13, verified live):** from `lastLoginAt` and `createdAt`, both sortable; "Never" for someone who hasn't signed in; hover shows the full date and time |
| `/admin/roles` | ~470 | `auditAction` only | `useRoles`, `useCreate/Update/DeleteRole`, `useSetRolePermissions` ✅ | ✅ Live — rail + data-driven permission matrix; catalog derived from the `GET /roles` union (no `GET /permissions` exists); built-in roles read-only |
| `/admin/cabinets` | 448 | `auditAction` only | `useCabinets`, `useDepartments`, `useCreateFolder` (seeds "General") ✅ · metadata-field + access-grant hooks via the shared `components/cabinets/` cards | ✅ Live — reworked 2026-10-06: folder tools and the document browser moved to `/staff/cabinets`; schema and access cards extracted into shared components. Tested end to end by the user 2026-10-08 |
| `/admin/workflows` | 241 | — | `useWorkflows` (`status`, `search`, `page`), `useCreateWorkflow` + the shared actions (clone, archive, unarchive, delete) ✅ | ✅ Live — **new 2026-10-20 (verified live as `client_admin`)**: the workflow list. Status tabs (Published · Drafts · Archived, count on the open tab), name search and paging all go to `GET /workflows`; the tab and search live in the URL. A row opens the designer; each row's ⋮ menu offers what its status allows. Replaces the designer's dropdown, which held only the first page of 20: on the live tenant (40 workflows, 19 archived on page 1) it reached 1 of the 18 drafts and published ones. Checked: tab counts match the API (12 / 6 / 22), search, back link to the right tab, New workflow → designer → Delete draft → Drafts tab, a deleted id's link says it no longer exists |
| `/admin/workflows/[id]` | 497 | `auditAction` only | `useWorkflow`, update / publish + the shared actions ✅ | ✅ Live — the designer, at its own URL since 2026-10-20 (was `/admin/workflows`); a "Workflows" back link replaces the dropdown and asks first if there are unsaved edits. History below kept from the old row: authorized since 2026-09-04 (DRIFT-05; the "⚠️ no authorization on the endpoints" note here was stale until 2026-10-15). `@ts-nocheck` removed 2026-10-08; the page now type-checks **Department-only stages (2026-10-13, verified live):** Assign to → Department saves `department_id`; tested on "TEST – department stage": the stage stored Finance with no role, and the canvas reads "Finance · 24h". **Sub-departments and role + department (2026-10-16, verified live):** `StageDepartmentPicker` picks a top-level department, then optionally one of its sub-departments (`department_id` + `sub_department_id`, edms-backend PR #52); Role has the same picker with "Any department". On a throwaway draft, "TEST — sub-department picker (draft)": Department → Operations › Finance saved both ids (200) and the canvas read "Operations › Finance · 24h"; Role staff + the same read "staff · Operations › Finance · 24h"; Any department cleared both. "TEST – department stage" (Finance stored in `department_id` alone) opens as Operations › Finance, not marked unsaved. **Parallel branches — designer ✅ verified in a browser 2026-10-18** (TEST_PLAN TP-Q2, Q15–Q18 against the live API; ⛔ **Running one fails on the live backend (2026-10-18):** the first action at a fork stage returns `500 INTERNAL_SERVER_ERROR`, every time, even on a minimal three-stage fork with no join (single document, `review`). A sequential workflow on the same backend works, so it is the fork path in edms-backend PR #54; the cause needs the server logs): Transitions has **"+ Add parallel branch"** (unconditional; not mixable with conditions) and **Branches meet at**. `applyStageRouting` writes the fork, points each branch on to the join and sets `join: 'all'` in one PATCH, since the backend revalidates the whole graph and every step in between is a 422; `normalizeJoins` clears stale join flags on stage add/delete. `validateParallelRouting` mirrors the backend's graph checks (unreachable stage, a stage that can't reach a last stage, join with < 2 routes in, converging branches without a join, branch ending before the join, nested fork); `validateDefinition` adds every stage's branch rules (one fallback, priorities) for stage add/delete/move. *2026-10-20, browser-verified on throwaway workflows (deleting a conditional stage's fallback target is refused with the reason and nothing is saved; moving the stage after a join saves and the join moves with it): before this, add/delete/move ran only the parallel checks, so deleting a conditional stage's fallback target or leaving a loop with no exit still came back 422.* Checked against the live API on draft "ZZ test — parallel routing (safe to archive)": the no-join version came back 422 with the same reason the designer shows, and the fork + join saved (200). Canvas: blue "Parallel" lines, "· waits for all" on the join. 2026-10-18 fix: after a save the tab no longer stays "unsaved" — the definition comes back from `jsonb` with its keys reordered, and the comparison is now key-order-insensitive. **2026-10-19 (browser-verified, TEST_PLAN TP-Q21–Q25):** deleting or adding a stage that would break the routing is refused with the reason in a toast (was: a 422 toast reading only "Validation failed"); create/update toasts now show the backend's `errors[0].message`; making a fork on a stage that wasn't one no longer adopts the stage its single route led to as the join (it could add a loop); and after **Add stage** the new stage no longer reads as unsaved, which had popped a "Discard unsaved changes?" prompt on the next click. **Stage reordering (2026-10-19, browser-verified, TEST_PLAN TP-Q28):** drag-to-reorder went with the 2026-09-29 rework (`1bf7e46`), leaving no way to change the order — including which stage is first, where the backend starts every document (`stages[0]`). The Properties tab now has **Move earlier / Move later** (`moveStage`): swaps the stage with its neighbour along the route, rewiring the transitions (conditions kept) and the `stages` order, saved at once. Refused, with the reason on hover, where the stage or its neighbour branches or routes meet; a parallel meeting point moves with the position. A stage moved to the start loses "Request changes" **Delete draft / Unarchive (2026-10-20, verified live as `client_admin`):** the ⋮ menu offers "Delete draft" on a draft (`DELETE /workflows/:id`, 204, edms-backend PR #55) and Archive only on a published workflow; an archived one shows Unarchive instead of Publish (`POST …/unarchive`, 200). Before, Archive was offered on drafts and Publish on archived workflows, and both 409'd. Checked on a fresh draft (deleted, then 404) and "ZZ test — designer check B" (unarchived, then archived again). ⚠️ **Open (found 2026-10-20):** `useWorkflows()` fetches only the first page (20, newest first). The live tenant has 40 (22 archived, 12 published, 6 drafts) and page 1 holds 19 archived ones, so the switcher reaches 1 of the 18 drafts and published workflows; the rest can't be opened here. ✅ **Fixed 2026-10-20** by the `/admin/workflows` list (row above) |
| `/admin/workflows/instances` | 7 | — | — | ↪️ re-exports `/supervisor/instances` (the Workflow Monitor) — intentional, so client admins reach it from their own portal. *Classified 2026-10-08* |
| `/admin/departments` | 460 | `auditAction` only | `useDepartments`, `useCreate/Update/DeleteDepartment` ✅ | 🟨 Partial — API-only, no `SEED`: create, edit, delete, one level of sub-departments (TEST_PLAN "Things to check"). *Classified 2026-10-08*, not verified end to end in that pass |
| `/admin/policies` | 208 | `auditAction` | `usePolicies` 🟥 · `useSlaConfiguration`, `useUpdateSlaConfiguration`, `useSlaHolidays`, `useCreate/DeleteSlaHoliday` ✅ | 🟨 Hybrid — **2026-10-08 (SLA tab confirmed by the product owner's testing 2026-10-08 and 2026-10-09):** the Urgency & SLA tab is the real SLA policy (time zone, working hours and days, holidays, warning window, breach action, urgency multipliers), replacing a mock "Default SLA hours" table. Confidentiality, Retention and Controls tabs are still `SEED.policies` |
| `/admin/branding` | 397 | `auditAction` | `useBranding` 🟥 | 🟥 Mock (browser-only) — **2026-10-12:** "Publish branding" now saves to the persisted store, so the app name, monogram and colours apply across the app and survive a reload, in that browser only; other users and the login page are unaffected. Verified live. *Before, the save returned the fixture and the page snapped back; nothing outside the page changed* |
| `/admin/circulars` | 20 | — | — | ↪️ redirect to `/circulars/manage` (2026-10-05) — management moved to a shared area because supervisors and management author and publish circulars too, and can't enter this portal |
| `/admin/audit` | 232 | — | `useAuditEntries`, `useExportAuditCsv`, `useVerifyAuditChain` ✅ · `UserSearchCombobox` (`GET /users?search=`) ✅ | ✅ Live — wired 2026-09-18 (was `SEED.audit`). **2026-10-08 (confirmed by the product owner's testing 2026-10-09):** record-type and action dropdowns replace the free-text action box. That box sent partial text to `GET /audit`, which only accepts exact action names, so typing "doc" was a 400 and the table showed "Failed to load". The record types' **Configuration** group (roles, departments, cabinets, folders, workflow designs, users) is the configuration history (18.7). Export sends the same filters. SLA settings aren't audited by the backend, so they can't appear. **Actor filter (2026-10-13, verified live):** a searchable `UserPicker` replaces the select, which listed only the first 20 users. Searching "finance" and picking Finance Staff User sent `GET /audit?actorId=`. The Actor column then named people from a `GET /users` lookup; since 2026-10-20 it reads each entry's `actor` (edms-backend PR #53), verified live. **Actor search box (2026-10-16, verified live):** `UserSearchCombobox` replaces the `UserPicker`. You type into the box itself; under 3 characters it shows a hint and sends nothing, from 3 it sends `GET /users?search=` (debounced, 20 results). The list is at most 300px tall and sits above modals and toasts (z-index 1100). Picking sets `actorId`; emptying the box or ✕ goes back to all actors. Verified: "tj" sent no request, "tjo" sent `search=tjo`, picking Finance Staff User sent `GET /audit?actorId=…` and only their rows showed |
| `/admin/access-requests` | ~200 | — | `useAccessRequestsInbox`, `useGrantAccessRequest`, `useDenyAccessRequest` ✅ | ✅ Live — **new page, 2026-09-18**. Grant/deny inbox for `POST /documents/:id/access-requests`. **Gated on `document_access_request:view` since 2026-10-12** (was `user:edit`, which no access-request route checks), with a sidebar link in any portal whose user holds it; Grant/Deny need `:grant`. Seeded, only `client_admin` holds either (verified live: client admin in, staff and supervisor sent to `/unauthorized`). Since `3014b89` each request is for `view` (View access) or `route` (Action access: act on the document in a workflow without opening it). **2026-10-12:** an **Access** column shows "Open" or "Act" (older requests read "Open"), and the grant confirmation describes that kind; verified live 2026-10-12 for both kinds: "Open" and "Act" rows, both confirmations, and granting an Act request (200) |

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
                                            `client_admin` holds in today's seed
                                            (re-checked 2026-10-15)
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
                                                     circulars ✅ wired 2026-10-05, confirmed 2026-10-09
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
| Branding model + endpoints | Not built | Theming is per-browser (survives reload since 2026-10-12; other users never see it) |
| ~~Circulars model + endpoints~~ | ✅ **Built** (backend `circulars` module, 15 routes) and wired 2026-10-05 | Confirmed in the product owner's testing 2026-10-09 |
| `GET /audit` | ✅ **Built & wired 2026-09-18** | Tenant audit view is real now |

### Dummy data 🟥

| Where | Fixture | Consequence |
|---|---|---|
| `/admin/policies` | `SEED.policies` | Confidentiality/retention/control config is decorative. *(The urgency table was replaced by the real SLA settings 2026-10-08.)* Only the confidentiality table's Watermark flag is read anywhere; since 2026-10-08 download follows the `document:download` permission, so the Download and Print toggles change nothing |
| `/admin/branding` | `SEED.branding` → the persisted store (`edms-state-v3`) | ⚠️ **Theming genuinely applies** via CSS custom properties in `AppShell`, including a dark-mode `lighten()`, and since 2026-10-12 a save sticks in that browser — so it looks completely real but is per-browser, not shared. Needs the branding API (backlog #23) |
| ~~Role matrix editor~~ | ~~`SEED.rolesMatrix` via `updateRoleMatrix`~~ | ✅ Not dummy — `/admin/roles` saves through `PUT /roles/:id/permissions` (see the page row and APIs table above). This row contradicted both until 2026-10-15 |

### Flows

| Flow | Status | Detail |
|---|---|---|
| Create departments | ✅ | ⚠️ 200 cap. One level of nesting since `4a1373c` (2026-10-12, `422 DEPARTMENT_DEPTH`), so cycles can't form *(was "no cycle detection")* |
| Create cabinets, assign to departments | ✅ | ⚠️ 100 cap |
| Build folder trees | 🟨 | Moved 2026-10-06 from `/admin/cabinets` to `/staff/cabinets`, for whoever the cabinet is delegated to; not yet verified live. ⚠️ `POST /documents` still doesn't check that `folderId` belongs to `cabinetId`; `PATCH /documents/:id` does since `dd10017` |
| Define cabinet metadata fields | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18. Also on `/staff/cabinets` since 2026-10-06 (tested by the user 2026-10-08) |
| Grant cabinet access | ✅ | Wired in `admin/cabinets/page.tsx` — row was stale, caught 2026-09-18. Also on `/staff/cabinets` since 2026-10-06 (tested by the user 2026-10-08) |
| Create users with dept + roles | ✅ | An invitation is emailed on creation (since 2026-09-18); the user is Pending until they set a password (PR #49). *(Was "new users get a default password" — stale; doc 04 was corrected 2026-10-13.)* |
| Resend a user's invitation email | ✅ | Added 2026-09-18; shown for active users with no `lastLoginAt` |
| Assign / remove roles | ✅ | |
| Deactivate a user | ✅ | Login then 403 |
| Edit the role permission matrix | ✅ | `PUT /roles/:id/permissions` via `useSetRolePermissions` — row was stale, caught 2026-09-18 |
| Design and publish a workflow | ✅ | Admin-only since DRIFT-05 (2026-09-04). ⚠️ On a freshly seeded tenant, non-admins can't *list* published workflows to route into (DRIFT-14); the live tenant's roles can (re-tested 2026-10-16). *(Was "⛔ but so can any authenticated user".)* |
| Configure retention policy | 🟥 | |
| Apply branding | 🟥 | Applies visually and persists in this browser only (since 2026-10-12) |
| Publish a circular | ✅ | Wired 2026-10-05 at `/circulars/manage` — draft → publish now or schedule → recipients' inbox, acknowledgement report, reminders, withdraw, revise. *(confirmed by the product owner’s testing, 2026-10-09)* |
| Review the tenant audit trail | ✅ | Wired 2026-09-18 — filter by actor/action/date, paginated, "Verify integrity" action; "Export" works — `client_admin` holds `audit:export` in today's seed *(was "403s … no `audit:export` grant"; re-checked 2026-10-15, not clicked through)* |

### What's left, in order

1. ~~Build the cabinet access-grant UI~~ — **done**, wired in `admin/cabinets/page.tsx`.
   These three items (1–3) were all stale, caught 2026-09-18; not otherwise part of that
   day's work. *Read-path enforcement, re-checked 2026-10-15 by reading the backend:* cabinet
   list/detail and folders check grants; document list/detail/search don't (doc 03 Phase 4).
2. ~~Point the role matrix editor at `PUT /roles/:id/permissions`.~~ — **done**, via
   `useSetRolePermissions` (contradicted this doc's own `/admin/roles` row above).
3. ~~Build the cabinet metadata-field designer~~ — **done**, wired in
   `admin/cabinets/page.tsx`.
4. ~~**Make new-user creation send a real invite email**~~ — **done**: creation has
   emailed an invitation since 2026-09-18 (stale here until 2026-10-15). Login rate
   limiting is still unaddressed.
5. ~~**Add authorization to the workflow endpoints**~~ — **done 2026-09-04** (DRIFT-05).
   **Replacement item:** seed `workflow:view` for the non-admin roles (DRIFT-14). *(2026-10-16: the live tenant's role already holds it; this is so a freshly seeded tenant works.)*
6. **Build branding**: model, endpoints, logo upload.
7. ~~**Build circulars**: model, endpoints, audience targeting, acknowledgement tracking.~~
   **Wired 2026-10-05**; confirmed in the product owner's testing 2026-10-09.
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
| `/auditor` | 132 | `findings`, `audit`, `users` | **none** | 🟥 Mock · Quick access card (pinned / recent / saved searches, browser-only) added 2026-10-08 |
| `/auditor/trail` | 290 | `auditAction` (finding-raise only) | `useAuditEntries`, `useExportAuditCsv` ✅ · `UserSearchCombobox` (`GET /users?search=`) 🟨 | ✅ Live — migrated 2026-09-18. **2026-10-08 (confirmed by the product owner's testing 2026-10-09):** same record-type/action dropdowns as `/admin/audit` (`AuditTypeActionFilters`), fixing the same free-text 400. **2026-10-13:** the actor filter is the same searchable `UserPicker`; since 2026-10-16 the same `UserSearchCombobox` as `/admin/audit`. Not verified as the auditor: `internal_auditor` gets 403 on `GET /users` (seed gap), so the picker shows "Couldn't load people." until the backend grants `user:view`. **2026-10-20 (verified live as `auditor`):** the Actor column reads each entry's `actor` (edms-backend PR #53). It used to look actors up in `GET /users`, the same 403, so the auditor saw UUIDs |
| `/auditor/findings` | 367 | `findings`, `users`, `addFinding`, `updateFinding` | **none** | 🟥 Mock — no backend model regardless |
| `/auditor/compliance` | 7 | — | ↪️ re-exports `/management/compliance` | 🟨 Hybrid — inherits the now-real sensitive-activity panel |

*The auditor also uses the shared `/staff/cabinets` (✅ live) and `/search` (✅ rebuilt 2026-09-30, confirmed 2026-10-09).*

### APIs wired

**`/auditor/trail`**: `GET /audit` (search/filter, `useAuditEntries`) and `GET
/audit/export` (`useExportAuditCsv`) — the same real integration `admin/audit` (§4) uses.
Migrating this page wasn't a hook swap: it now filters on the real, confirmed action
vocabulary (`user.login`, `document.viewed`, `role.permissions_updated`, …) instead of
the old app-invented codes (`REDACT_RELEASE`, `SIGN`, …), which matched nothing real. The
"Raise a finding" feature is untouched — it still writes to the local `auditAction`
pseudo-log, since findings has no real backend to migrate *to* either.

**Circulars** (✅ wired 2026-10-05, confirmed 2026-10-09): the recipient inbox
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
| `GET /cabinets/:id/access` (who can see this cabinet) | Endpoint exists and `/admin/cabinets`'s Access card calls it; **no auditor screen does**, though `cabinet_access:view` is granted *(re-checked 2026-10-15)* |
| Document view logging | ✅ confirmed — `document.viewed` is a real, auto-emitted action (seen live 2026-09-18). Downloads are logged too: `document.downloaded` since the gated download landed (2026-10-08; in code, not yet seen in a live pull). *(Was "no download endpoint exists to log downloads".)* |

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
                                                 logged as document.downloaded since
                                                 2026-10-08 (in code, not seen live yet)
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
| Search for evidence | ✅ `/search` confirmed 2026-10-09; indexed at create since PR #51. *(Was "⛔ index never built" — stale until 2026-10-15.)* |
| Raise a finding | 🟥 localStorage |
| Assign an owner and due date | 🟥 localStorage |
| Track a finding to closure | 🟥 localStorage |
| Review compliance posture | 🟨 re-export of `/management/compliance` — its sensitive-activity panel is real now too |
| See who can access a cabinet | ⛔ on auditor screens — the endpoint exists and the admin Access card uses it |
| Export evidence for a regulator | ✅ confirmed live 2026-09-18 — `internal_auditor` holds `audit:export:global` and a real export succeeds. *(`client_admin` holds it too in today's seed — the "unlike `client_admin`" note was stale, re-checked 2026-10-15.)* |

### What's left, in order

1. ~~Build the audit module~~ and ~~migrate `/auditor/trail`~~ — **both done** (DRIFT-11
   resolved, 2026-09-18).
2. ~~Implement the hash chain.~~ **Done** — confirmed live via `GET /audit/verify`.
3. ~~Add `GET /audit` with filters, and a chain-verification endpoint.~~ **Done.**
4. **Build `Finding`** — model, endpoints, and wire `/auditor/findings` to it.
5. **Add a cabinet-access viewer** so `cabinet_access:view` becomes usable.
6. **Give `/auditor/compliance` its own view** rather than re-exporting management's.
7. **Add monthly partitioning** as the schema comments specify.
8. ~~**Implement SoD detection**, which the older docs already claim exists.~~ **Dropped
   from scope 2026-10-21** (PM decision), with redaction.

> ~~**This dashboard is the largest gap between what the product claims and what it does.**~~
> *Re-checked 2026-10-15:* the trail — the part the product's claim rests on — is real. What
> remains is findings, the dashboard and a cabinet-access viewer: builds, not a
> redesign.

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

### ~~The permission contradiction~~ — resolved 2026-09-10 (DRIFT-04)

`schulltech_admin` has **18 backend grants** *(re-counted 2026-10-15; this said "3 backend
grants")* — workflow definitions, instances, tasks, delegation and audit — and **no
`document:*` grant of any kind**. It is **deliberately excluded** from
`CABINET_ACCESS_BYPASS_ROLES` and every confidentiality tier — **the vendor cannot read
customer documents.** That is a strong, correct decision.

~~The frontend contradicts it: `usePermissions.ts:24` returns `true` for every check for
this role.~~ Fixed 2026-09-10: the role heuristic was deleted, and this role's keys come from
its seeded grants like every other role's.

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
10. ~~Align the frontend permission model with the backend's 3 grants~~ — done 2026-09-10 (DRIFT-04)

---

## Shared pages (used by multiple roles)

| Page | LOC | Roles | Store reads | API | Status |
|---|---:|---|---|---|---|
| `/` (login) | 316 | all | `currentUser`, `setCurrentUser` | `authService` ✅ | ✅ Live — the 7 autofill accounts match the backend's `tjoel+…` fixtures (re-checked 2026-10-08; the "12 wrong accounts" note was stale). **2026-10-14:** those autofill buttons render only outside production *and* only under the SchullTech preset — a white-labelled build (`NEXT_PUBLIC_BRAND=galaxybackbone`, `features.loginTestAccounts`) never shows our fixture logins, even in `next dev` |
| `/doc/[id]` | 707 | all | `currentUser` | `useDocument`, versions, `useDownloadDocumentVersion`, checkout, `useWorkflowInstances`, `useDocumentSummary` (+ `POST …/summary`) ✅ · `usePolicies` 🟥 mock (watermark only) | 🟨 Hybrid (policies) — **made view-only 2026-10-02**: workflow actions, signing and the activity trail moved to `/workflow-instances/[id]`. **AI summary card (2026-10-13, verified live):** `GET /documents/:id/summary`; while the summary is being written it says so and polls every 10 s for up to a minute, then offers "Check again". Seen as `supervisor_finance`: a Confidential invoice went from "Writing the summary" to a summary in one poll. Also states no readable text, OCR failed and generation failed. **Try again / Regenerate (2026-10-20, verified live as `staff_finance`):** a failed summary offers "Try again" and a finished one "Regenerate" (`POST /documents/:id/summary`, edms-backend PR #56); the earlier summary stays up while the new one is written. Regenerate on Backup Power Proposal returned 202 and the card showed the new summary by polling. **Re-routing a closed document (2026-10-16, verified live):** "Route to workflow" was hidden once a document was `closed` (its workflow ended), though the backend allows it and Search/Cabinets already offered it; now it shows for any document not in a running workflow. Seen on "Invoice A" as `staff_finance`: the button shows and opens the workflow picker (not routed). **Closed no longer blocks edits (2026-10-16, verified live):** `closed` only means the workflow ended (product decision), so check out, metadata, classification and version restore are offered as on any other document; the backend never blocked them. On "Invoice A" as `client_admin`: check out (201) and check in (200) went through, Edit metadata and Change were offered. Restore still waits for no running workflow and no one else's checkout. **Only your own uploads at `own` scope (2026-10-16, verified live):** staff, management and auditors may route only documents they uploaded (backend 403 otherwise), so "Route to workflow" is disabled on anyone else's, titled "You can only route documents you uploaded". Seen as `staff_finance`: disabled on Invoice A (uploaded by the Finance supervisor), enabled on Backup Power Proposal. **People's names (2026-10-20, verified live as `staff_finance`):** owner, version uploaders, the lock holder and signers come from the `creator`/`uploader`/`locker`/`signer` objects the API embeds (edms-backend PR #53), and the page no longer calls `GET /users`. That call is a 403 for staff and auditors, who saw the owner as "System" and uploaders as "User" |
| `/search` | 540 | all | `currentUser`, `savedSearches` (per-user, user-created — not `SEED`) | `useDocuments` (server-side filters + pagination), `useDocumentSearch` (same filters + text), `useCabinets`, `useDepartments` ✅ | ✅ Live — rebuilt 2026-09-30: no `SEED` reads, no `@ts-nocheck`; types from `constants/documentTypes.ts`. *(confirmed by the product owner’s testing, 2026-10-09)* **2026-10-08:** results can be ticked (for anyone with `workflow_instance:create`); the selection survives paging, new searches and filter changes, and **Route to workflow** sends it all into one workflow — the only way to route documents from different folders or cabinets together (confirmed 2026-10-09). **2026-10-14:** the facets no longer grey out while text is typed — `/documents/search` takes the whole filter set (edms-backend PR #51) — and a **Department** facet (`?dept=`, saved with the search) backs the management drill-downs. 🟨 not verified live. **Routing a selection (2026-10-16, verified live):** documents someone else uploaded are left out at `own` scope, with a note in the route dialog (the backend would 403 the whole request). As `staff_finance`, Invoice A + Backup Power Proposal: the dialog offered only the latter (not routed). The workflow picker no longer shows "(v1)": the backend never moves a workflow past version 1 |
| `/upload` | 926 | staff, supervisor, management, client_admin | `docTypes`, `session`, `users` | `useCabinets`, `useCabinet`, `useCabinetFolders`, `documentsService` (`POST /documents` and `/batch` with `metadata`), `s3` ✅ | ✅ Live — **2026-10-09: metadata files with the document.** The chosen cabinet's fields (`useUploadMetadata`) are offered to everyone who can upload, and their values go in the create call (`metadata: [{ fieldId, value }]`, edms-backend `dd10017`), so the document and its metadata are saved together or not at all. Required fields must be filled before filing; the backend also refuses the upload without them. **Verified live 2026-10-09** as a `staff` user, single and "File all": values stored, no `PUT` made. *2026-10-07 to 2026-10-09 the values were saved by a second `PUT /documents/:id/metadata`, which needs `document_metadata:edit` + `edit`, so staff only saw the field list. Once `dd10017` made required fields mandatory on upload, that form couldn't file into a cabinet with required fields at all.* **2026-10-08: batch filing** — with two or more files waiting, an "Apply to all" bar sets cabinet/folder/confidentiality/urgency on every card, and **File all (N)** checks every card first, uploads three at a time, then files them through `POST /documents/batch` in chunks of 20 (one transaction each; a failed chunk's cards return to editable and reuse their upload on retry). Each card's metadata rides in the batch item (since 2026-10-09); when it's done, a banner offers to route everything that run filed into **one** workflow. Progress now shows inside the card, which stays mounted — previously it was unmounted mid-upload, so the bar didn't move (🟨 not yet verified live).  **2026-10-02:** accepted types unified in `src/constants/uploadTypes.ts` — PDF, DOCX, XLSX, TIFF, JPG, PNG up to 100 MB (was PDF ≤50 MB + images ≤10 MB, despite the page text claiming DOCX/XLSX/TIFF). **2026-10-21:** narrowed to PDF and images — PDF/TIFF ≤100 MB, JPEG/PNG ≤10 MB (PM decision; OCR reads only these). DOCX/XLSX/TIFF upload but **don't preview** in the viewer and **aren't OCR'd** (Textract can't read DOCX/XLSX), so they're not text-searchable |
| `/notifications` | 214 | all | — | `useNotifications`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useNotificationPreferences`, `useUpdateNotificationPreferences` → `GET /notifications`, `PATCH /:id/read`, `POST /read-all`, `GET/PUT /preferences` ✅ | 🟨 API-only, no `SEED` — all/unread filter, paging, links to the task, workflow or circular, and **Delivery preferences** (in-app, email, digest). Not clicked through end to end. *Corrected 2026-10-12: this row said 🟥 Mock reading `SEED.notifications`; the page has called the API since `bba1e2d`* |
| `/circulars` | 226 | all | — | `useCircularInbox`, `useCircularInboxSummary` → `GET /circulars/inbox`, `/inbox/summary` | ✅ Live — **rewired 2026-10-05** (was `SEED.circulars`) — in-force / archive tabs, read-state filters, search. *(confirmed by the product owner’s testing, 2026-10-09)* |
| `/circulars/[id]` | 181 | all | — | `useCircularInboxItem`, `useAcknowledgeCircular` → `GET /circulars/inbox/:id`, `POST …/acknowledge` | ✅ Live — **new 2026-10-05** — reading view and landing page for the backend's circular notification links (`actionUrl: /circulars/:id`). Opening it records the read receipt. *(confirmed by the product owner’s testing, 2026-10-09)* |
| `/circulars/manage` | 206 | `circular:view` | — | `useCirculars` → `GET /circulars` | ✅ Live — **new 2026-10-05** — the archive, any status, within scope. *(confirmed by the product owner’s testing, 2026-10-09)* |
| `/circulars/manage/new` | 41 | `circular:create` | — | `useCreateCircular` → `POST /circulars` · `useDepartments`, `useRoles` (only with `role:view`), `useAllUsers`, `useDocuments`, multipart upload | ✅ Live — **new 2026-10-05** — compose a draft: audience (all staff / department+role groups / named people), acknowledgement + deadline + reminders, expiry, file and linked-document attachments. *(confirmed by the product owner’s testing, 2026-10-09)* |
| `/circulars/manage/[id]` | 712 | `circular:view` | — | `useCircular`, `useCircularRecipients`, update / delete / publish / cancel-schedule / withdraw / revise / reminders mutations | ✅ Live — **new 2026-10-05** — detail, inline draft editing, lifecycle actions gated per permission, stats + per-department breakdown + recipients report. *(confirmed by the product owner’s testing, 2026-10-09)* **2026-10-12 (verified live):** the recipients report has **Download CSV**: every recipient matching the current filter and search (all pages, 100 at a time), with department, read and — when the circular asks for it — acknowledged, reminders sent and last reminded |
| `/unauthorized` | 58 | all | — | — | static |
| `/forgot-password` | 96 | signed out | — | `authService.forgotPassword` → `POST /auth/forgot-password` | 🟨 API-only, no `SEED`. Doc 04 records the reset flow as working; not re-verified in the 2026-10-08 classification pass |
| `/set-password` | 145 | signed out | — | `authService.resetPassword` → `POST /auth/reset-password` (invitation and reset tokens) | 🟨 API-only, no `SEED`; DRIFT-15 fixed its payload 2026-09-18. Not re-verified in the 2026-10-08 pass |
| `/user-stories` | 413 | all | — | — | static — in-app guide built from a local data module (the stories in doc 02), outside the app shell |
| `/delegations` | 364 | `delegation:view` | `currentUser` | `useDelegations`, `useCreateDelegation`, `useEndDelegation`, `useUsers`, `useCabinets`, `UserPicker` (`GET /users?search=`) ✅ | 🟨 API-only, no `SEED`. *Row added 2026-10-08* — the page was wired by 2026-09-18 (backlog #13) but never had an inventory row; not re-verified end to end. **2026-10-13:** "Delegate to" is a searchable `UserPicker` (active users, not yourself). The old select listed only the first 20 users. As `supervisor_finance`, searching "staff" offered Finance Staff User (department scope) and picking it filled the field; creating the delegation was not re-run |
| `/help` | 516 | none (every signed-in user) | — | none — static content | ↪️ Static — **new 2026-10-08**: help topics ordered for the reader's portal (other roles' topics appear when searched), search box, anchors per topic. The Topbar's "?" opens the topic for the current page (`helpTopicForPath` in `src/constants/helpTopics.ts`), and the sidebar's Help & support goes here instead of a stale demo-build message |
| `/tasks/[id]` | 33 | all | — | `useTask` → `GET /tasks/:id` | ↪️ redirect to `/workflow-instances/{instanceId}?task={id}` — landing page for backend `/tasks/:id` notification links (DRIFT-17). Not yet verified live |
| `/workflow-instances/[id]` | 539 | all | `currentUser` | `useWorkflowInstance`, `useTask`, `useDocument`, `useTaskAction`, versions ✅ | ✅ Live — **new 2026-10-02** — the workflow page (see below). Was a 33-line redirect earlier the same day. Read side verified in a browser 2026-10-09; approve, reject, request changes and review-with-upload confirmed by the product owner's testing 2026-10-09. Delegate, close and the access overlay not yet exercised **Department tasks (2026-10-13, verified live):** "is this my task" follows the backend's rule, department included (`isTaskForUser`). On a Finance-only task, Finance staff and the Finance supervisor got Approve/Reject, client admin saw them disabled with "Assigned to Finance", and HR staff couldn't open the workflow (backend). Before, nobody could act on a department-only task from the UI, and a role + department task offered the buttons to that role in every department. **Partial actions (2026-10-16):** documents already actioned on the open task (edms-backend PR #52) show as "· Done" tabs and are left out of the actions, the held-back count and the deadline; before, they read as "needs Action access" and disabled Delegate and Close. Verified with an edited `GET /tasks/:id` (see doc 01 §7). **2026-10-20:** the versions panel names uploaders from each version's `uploader` (PR #53) instead of `GET /users` |

### `/doc/[id]` — view-only document page *(split 2026-10-02)*

Everything that moves a workflow moved to `/workflow-instances/[id]` (below). This page is
the document on its own: file, details, versions, custody, archive.

| Feature | Status |
|---|---|
| Load document | ✅ `GET /documents/:id` |
| No access (confidentiality 403) | 🟨 full-page "You don't have access" ✅ + **Request access** (`useRequestAccessPrompt`, shared with the workflow page) ✅ **fixed 2026-10-12, verified live**: asks for View access (`permission: 'view'`), says "Your request will be reviewed and you will be notified of the decision", and turns a 409 into an "Already pending" toast. The mock `ACCESS_REQUEST` audit call is gone; the backend audits `document.access_requested` (DRIFT-20) |
| Metadata panel | ✅ `GET` + inline editor `PUT /documents/:id/metadata` (when `document:edit`) |
| Pin | 🟨 **new 2026-10-08** — toolbar **Pin** keeps the document in the Quick access card, which is on the staff, supervisor, management, auditor and admin homes (not platform: that role can't open documents). Opening the page also records it under Recently opened. Browser-only, per user: pins don't follow you to another browser or device. Verified in a browser for admin and management |
| Change classification | 🟨 **new 2026-10-08, not verified live** — Details card → **Change** on the Classification row → dialog for confidentiality and urgency → `PATCH /documents/:id`. Shown with `document:edit` + Edit on the cabinet, not while the document is closed or checked out by someone else. Tiers the user couldn't open the document at are disabled (they'd lose access), by the backend's own rule: the tier's `document:view_*` permission and its scope (`useConfidentialityClearance`, 2026-10-08). Top Secret is listed only for someone holding `view_top_secret` |
| Version history | ✅ `GET /documents/:id/versions` · `POST /versions/:vid/restore` · 🟨 **Open (2026-10-08)** goes through `GET /versions/:vid` (needs `document:download`, audited as a download) and is hidden without download permission; it used to open the list's own signed URL, skipping both |
| Version upload / restore gating | 🟨 **changed 2026-10-02** — "New version" is never offered here; revisions are uploaded on the workflow page in answer to a `request_changes`. Restore is blocked while a workflow is running, so the file can't be swapped mid-review. Not yet verified e2e |
| Archive | ✅ `DELETE /documents/:id` (toolbar, when `document:delete`) |
| Checkout / check-in | ✅ — banner names the holder (`checkoutLock.locker`, embedded since backend `b4a3f81`) and flags an overdue lock |
| Force check-in (someone else's overdue lock) | 🟨 **built 2026-10-02, not yet verified e2e** — shown only to `document_lock:delete` at `global` scope, or `department` scope matching the cabinet's department, and only once `expectedReturnAt` has passed. Same `POST /documents/:id/checkin`; the backend authorises it via `canReleaseLock` |
| Workflows card | 🟨 **new 2026-10-02** — `GET /workflow-instances?documentId=` → every workflow the document is in, each linking to its workflow page; "Open workflow" in the toolbar for the live one, "Route to workflow" when none. **Unverified:** whether that filter matches a document that was *attached* rather than primary. ⚠️ **Since `3014b89` (DRIFT-22)** an `own`-scope user sees only workflows where they hold a task. **Handled 2026-10-13 (backlog 14b, verified live):** a document whose own status is `in_progress`/`on_hold` with no running workflow visible to a viewer without oversight is "marked as in a running workflow you can't open", and neither "Route to workflow" nor version restore is offered. The status isn't always in step (a document left `pending` in a workflow that closes stays `in_progress`, e.g. `487006a2`; backend spec N4), so the wording says "probably". With oversight the card asks for `scope=all` and sees every workflow |
| Cabinet + folder context | ✅ |
| **Policies (watermark)** | 🟥 `SEED.policies` — only its Watermark flag is still read. Download no longer follows it (2026-10-08) |
| **Preview fallback** | 🟨 **2026-10-08, not verified live** — a file the viewer can't show (TIFF, or a DOCX/XLSX uploaded before 2026-10-21) reads "Word documents can't be previewed yet" instead of the raw MIME type. Its button is the page's **Download**, hidden without download permission (the old "Open file" link ignored it). Same on the workflow page's viewer |
| **File preview** | ✅ **PDFs: pdf.js viewer (`PdfViewer`), 2026-10-08, verified in a browser against the live API** — pages drawn as they scroll into view, "Find in document" with highlights and match count (Enter / Shift+Enter, Ctrl+F inside the viewer), page box, zoom, watermark on every page. Text can be selected only by someone with download permission. Replaces an `<iframe>` of the browser's PDF viewer with its toolbar hidden, which had no search. Images: 🟨 `<img>` of the pre-signed `currentVersion.fileUrl`, not re-verified |
| **Find in a scanned PDF** | ✅ **2026-10-08, verified in a browser on the tenant's scanned delivery note** — a scan has no text of its own, so find searches the version's `ocrText` (returned on `GET /documents/:id`) and switches to a **Scanned text** view: the OCR text on a sheet with matches highlighted, a note that it was read by OCR, and the watermark. A toolbar toggle switches between page images and text. Highlighting on the page images themselves needs the backend to keep Textract's word positions (it stores plain text only) |
| **Print** | ✅ **2026-10-08, verified against the live API** — viewer toolbar, shown with `document:print` + clearance. Calls `GET /documents/:id/print` (audited `document.printed`), then prints page images from a hidden frame with the watermark drawn into them, so it survives "Save as PDF". Ctrl+P inside the viewer does the same |
| **Export** | ✅ **2026-10-08, clicked through 2026-10-09** (Finance supervisor: 200, new tab sent to the signed URL) — toolbar button, shown with `document:export` + clearance. `GET /documents/:id/export` (audited `document.exported`), then opens the fresh signed URL |
| **Download** | ✅ **changed 2026-10-08, clicked through 2026-10-09** (Finance supervisor: `GET /documents/:id/versions/:vid` 200, new tab sent to the signed URL) — enabled only with `document:download` and clearance for the tier (`useConfidentialityClearance`, a copy of the backend's `isConfidentialityActionAllowed`). Fetches the current version through `GET /documents/:id/versions/:vid`, which re-checks both and audits `document.downloaded`, then opens its signed URL. Replaces the mock policy's download flag and a mock `auditService.logAction` call. The live permissions were confirmed on `/auth/me` (client_admin `global`, Finance supervisor `department`). Print and Export: rows below |

### `/workflow-instances/[id]` — the workflow page *(new 2026-10-02)*

Reached from `TaskRow` (staff task queue, dashboard, approvals, workload), the supervisor
team drawer, bottlenecks, the workflow monitors ("Open workflow"), and notification links
(`/tasks/:id` forwards here with `?task=`). Keyed on the instance id because a task id changes
every time the stage moves. Built 2026-10-02; the read side (task choice, document tabs, viewer,
Download) was verified in a browser against the live API on 2026-10-09, and the stage actions
by the product owner's testing the same day. Rows still 🟨 are unverified end to end.

| Feature | Status |
|---|---|
| Which task the page is about | ✅ *(verified 2026-10-09: a supervisor landed on their own active Finance Review task)* the `?task=` one if still active → else the caller's own active task → else whoever holds the current stage → else the latest task (finished workflows) |
| Documents | ✅ *(verified 2026-10-09 on a 4-document workflow whose task holds 2: two tabs, each loading its own document, versions and urgency badge)* from `GET /tasks/:id` `documents` (each pinned to the version under review); tabs when there's more than one. Falls back to the primary document alone if the caller can see the workflow but not its task (403) |
| Per-document access overlay | ✅ **Fixed 2026-10-12, verified live** (DRIFT-21): a Restricted document is a lock tab titled "Restricted document" that opens straight to the request card without fetching it; the page title leaves it out; no badge, version, document-page link or revision upload. A fully cleared user sees the page unchanged. *Was:* ⛔ **Crashed after `3014b89`.** `GET /tasks/:id` now includes documents the caller can't see, as `title: 'Restricted document'`, `confidentiality: null`, `documentVersion: null` plus `access: { canView, canRoute, canRequestView, canRequestRoute }` (before, they were left out). The page passes `confidentiality: null` to the overlay's `ConfBadge`, and `titleCase(null)` throws. Needed: read `access`/`isLocked` instead of waiting for a 403, guard null confidentiality, keep locked documents out of the approve/reject/request-changes pickers unless `canRoute`, and offer **Request access** for `view` or `route` |
| Download (viewer) | ✅ **2026-10-08, clicked through 2026-10-09** — same rule and path as `/doc/[id]`'s Download: `document:download` + clearance, through `GET /documents/:id/versions/:vid`. The versions panel's Open likewise |
| PDF viewer, Print | ✅ **2026-10-08** — the same `PdfViewer` as `/doc/[id]` (find, page box, zoom, audited Print). Renders here with the watermark (seen 2026-10-09); Print itself was verified on `/doc/[id]` |
| Stage actions | ✅ approve, reject, request changes and review *(confirmed by the product owner’s testing, 2026-10-09)*; 🟨 delegate and close not yet exercised. Review / approve (signature) / request changes / delegate / close / reject, filtered by the stage definition's `actions`; enabled only for the active task's assignee or a holder of its role, with `task:action`. **2026-10-12 (verified live):** actions offer only documents the user has Action access to, and name them explicitly whenever any is held back (the API otherwise applies an action to the whole task and refuses it); a note counts the held-back documents, which stay at the stage (since edms-backend PR #52, in the same task, which stays open; documents already actioned on it show as "Done" and count as neither actionable nor held back). Delegate and close cover the whole task, so they're disabled while any document is held back; with none actionable every action is disabled, with a Request access link |
| **Request changes ("Send back")** | ✅ **DRIFT-18 fixed 2026-10-02**, *(confirmed by the product owner’s testing, 2026-10-09)* — picker of the task's documents (min 1, the viewed one pre-ticked) + required reason → `documents: [{documentId}]`. **Hidden on the first stage** (nothing to send back to — backend 409 `WORKFLOW_PREVIOUS_STAGE_NOT_FOUND`); the designer also greys it out for stage 1 and strips it on save **Backend fix 2026-10-16 (edms-backend PR #54):** sending a document back to a stage whose task was still open (another of its documents not yet actioned) failed — the task was reused, but its `TaskDocument` row for the returning execution already existed, so the insert hit the unique key. It is now upserted with `actionedAt` cleared, so the document shows as pending on that task again; `isActionedTaskDocument` already read it that way. ✅ **Verified end to end 2026-10-18** on a two-document sequential workflow: Check (management) requested changes on Invoice C only; the Check task stayed open with Invoice D; the owner uploaded v2 on the workflow page (201) and re-reviewed (200); Invoice C came back to the *same* Check task with `actionedAt` cleared, and management's page listed both invoices with v2 under review and its actions enabled. Inside a parallel branch, see TEST_PLAN TP-Q20 |
| **Mark reviewed — attachments optional** | ✅ **new 2026-10-02**, *(confirmed by the product owner’s testing, 2026-10-09)*, including **Upload from computer**, — was a product rule that a review must attach ≥1 document; **optional since 2026-10-16** (product owner): the backend's `review` never required one. `review` itself takes no new documents, so a two-step modal — 1) `WorkflowDocumentPicker` (optional; Next works with nothing picked), with two tabs: **From a cabinet** (debounced title search via `GET /documents/search?q=&cabinetId=` — full-text over title + OCR + metadata, so a brand-new document isn't findable until OCR has run and the index job follows) and **Upload from computer** (multipart upload → `POST /documents` into a chosen cabinet/folder, defaulting to the primary document's cabinet, confidentiality and urgency — the document is filed immediately, even if the review is then cancelled); 2) optional comment + confirm, with Back keeping the selection — attaches each via `POST /workflow-instances/:id/documents`, then sends `review`. Attaching needs `workflow_instance:create`, which **the seeded `supervisor` role doesn't hold**: until 2026-10-16 that blocked a supervisor-held review stage outright; now such a reviewer goes straight to step 2 and reviews without attaching. Seen 2026-10-16 as `staff_finance` (dialog only, not submitted): step 1 reads "attach documents (optional)", Next with nothing picked opens step 2 with a plain "Mark reviewed" button |
| Revision uploads | 🟨 `pendingDocumentRevisions` from `GET /tasks/:id`: banner + per-document "Changes requested" card + `DocumentVersionsPanel` upload, only for the active task's holder **with `document_version:create`** — what the backend route checks. Was gated on `document:edit`, which the seeded `staff` role doesn't hold, so staff never saw the button (found in testing 2026-10-02; the old `/doc/[id]` had the same bug). Restore is likewise gated on `document_version:restore` now. Uploading resolves the revision (backend) and refetches the task ⚠️ **Found 2026-10-18:** `can('document_version', 'create')` ignores scope, so a `staff` stage holder sees **New version** on a document someone else owns, and the upload fails with `POST /documents/:id/versions` 403 (staff hold it at `own` scope). That stage then can't be moved on: the backend refuses `review` until a new version exists (409 `WORKFLOW_DOCUMENT_REVISION_REQUIRED`) |
| Activity trail / stage progress | ✅ `WorkflowActivityPanel` (moved from `/doc/[id]`). Trail is a fixed 340px scroll area and the viewer column is sticky on wide screens, so a long trail no longer pushes the page far below the document. **2026-10-12 (verified live):** when the workflow includes a Restricted document for the viewer, the backend blanks every comment, note and signature in its history; one line above the trail says so (shown to Finance staff, not to client admin) |
| **Parallel branches** | ⛔ **Blocked by the backend (2026-10-18)** — the first action at a fork stage returns `500 INTERNAL_SERVER_ERROR`, every time, even on a minimal three-stage fork with no join (single document, `review`). A sequential workflow on the same backend works, so it is the fork path in edms-backend PR #54; the cause needs the server logs. Re-checked over the API on 2026-10-20 (same 500) and reported as **BE-19** in `docs/BACKEND_REQUESTS.md`. The rail changes below are unverified on a parallel run; on a sequential workflow the rail was checked 2026-10-18 ("Preparation ✓ done · Check current, 2 documents, management"). A fork gives one document a live execution per branch, each with its own task. The stage rail now reads "done" from the routing graph (a finished branch shows done while its sibling runs), names each current stage's own holder from `instance.tasks`, and shows a branch parked at its join as "waiting for the other branches" with no deadline. "Assigned to …" names the focused task's holder, not the first live task's. Task choice was already parallel-safe |
| **Attach an additional document** | 🟨 only as part of "Mark reviewed" (above). No standalone attach button yet — multi-document *start* is being added on the backend |
| **Comments / signatures** | ✅ unchanged — `comment` on any action, signature image on `approve` only (BE-16). **2026-10-08 (typed and uploaded confirmed by the product owner’s testing, 2026-10-12):** the signature can be drawn, **typed** (the name is rendered in a script face onto a canvas, which becomes the same PNG) or uploaded |

### `/notifications` — ~~note the detail~~ *(corrected 2026-10-12)*

~~The page reads `useStore` **only** … renders `SEED.notifications` and never errors.~~ That
was true of an early version. Since `bba1e2d` the page, the bell and the sidebar badge all
read the real notifications API, and the backend fires notifications from task assignment,
outcomes, delegation, access requests and SLA warnings/breaches (doc 01 DRIFT-10). New
notifications are picked up by polling every 60 s (`useUnreadNotificationCount`); there's
no push channel.

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
| 1 | ✅ ~~`npx prisma generate`~~ — **done** (doc 03 fix 1); ticked 2026-10-15 | Backend | — | Was: unblocks the build; stops every user being silently narrowed to `department` scope |
| 2 | ✅ ~~Two-call create-then-start in `workflowInstancesService.start()`~~ — **done**: `createAndStart` posts the instance then `/:id/start` (ticked 2026-10-08; the row was stale) | Frontend | — | Was: unblocks the approval half of the product |
| 3 | ~~Authorization on the workflow routes~~ — ✅ **done 2026-09-04**, enforced in all five workflow services (and by `requirePermission` on every route since 2026-09-16). **New:** grant `workflow:view` to `staff`, `supervisor`, `management` and `internal_auditor` in `prisma/seed-system.ts`, then re-seed (DRIFT-14). *(Was "split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES`" — that constant is gone; re-checked 2026-10-15.)* | Backend | 4 seed rows | ~~**Routing is blocked for every non-admin role that holds `workflow_instance:route`**~~ *Re-tested 2026-10-16:* not on the live tenant, whose roles hold `workflow:view:global`; a freshly seeded tenant would be blocked |
| 4 | ✅ ~~Fix the 12 login test-account emails to the `tjoel+…` set~~ — **done**: 7 autofill buttons, all matching the backend seed (ticked 2026-10-08) | Frontend | — | Was: every autofill button failed |
| 5 | JSON 404 handler in `app.ts` | Backend | 5 min | Makes 8 broken calls fail legibly |
| 6 | ✅ ~~Make `usePermissions` parse three-segment strings~~ — **done 2026-09-10, backend caught up 2026-09-15.** `src/lib/permissions.ts` normalises/matches on `resource:action`, parses scope separately; role-name heuristics removed; gating now permission-key based (`routes.config` `anyPermissions`). Login + `GET /auth/me` now return a live, scoped `permissions` array — that's the source of truth; `useHydratePermissions` (from `GET /roles`) only tops up keys it's missing | Frontend + Backend | — | Was: every `<Guard>` would go dark the moment `/auth/me` returned `permissions`; that day has arrived and it didn't |
| 7 | ✅ ~~Fix `effStatus()`~~ — **done 2026-09-21** (DRIFT-13): `effStatus` deleted for `taskStatusLabel`/`isOverdue` in `utils/supervisor.ts`. Since `919d0ef` list responses lack deadlines again, so list overdue counts come from open SLA breach events (DRIFT-19) (ticked 2026-10-08) | Frontend | — | Was: every overdue badge read zero |

| 7a | ✅ ~~**Send `permission` with access requests**~~ — **done 2026-10-12, verified live** (DRIFT-20). `documentsService.requestAccess` posted `{ reason }`; `3014b89` made `permission: 'view' \| 'route'` required, so Request access was refused everywhere (422; this said 400 until checked live). `/doc/[id]` asks for `view`; the workflow page asks for `view` or `route` depending on what the document's `access` says is missing | Frontend | 1–2 h | Request access is broken on the live API |
| 7b | ✅ ~~**Handle Restricted documents on the workflow page**~~ — **done 2026-10-12, verified live** (DRIFT-21). Use `access` / `isLocked` from `GET /tasks/:id` and `GET /workflow-instances/:id`; guard `confidentiality: null` (`ConfBadge` → `titleCase(null)` throws); keep Restricted documents out of the action pickers unless `canRoute`; show "Restricted document" tabs with the request-access card instead of fetching them | Frontend | ½–1 day | The workflow page crashes for anyone whose task holds a document above their clearance |

*Re-checked 2026-10-15: every P0 item is done except **3** (the DRIFT-14 seed rows) and
**5** (the JSON 404 handler, still missing from `app.ts`). Both are small backend changes.*
*Re-checked 2026-10-16: still both open. **3** blocks only a freshly seeded tenant — the live
one's roles hold the grant. **5** confirmed live: an unknown route returns a `text/html` 404.*

### 🟠 P1 — the next two to three weeks

| # | Item | Owner | Unblocks |
|---|---|---|---|
| 8 | Presigned upload endpoint + async Textract + **unconditional** search indexing — **search indexing done** (edms-backend PR #51, live 2026-10-14): `POST /documents`/`/batch` index at create, `PATCH` on a title change, restore, and the OCR worker's final failure. The presigned-upload half was retired (DRIFT-06); Textract is already async | Both | Was: OCR **and** search together. Left: see 8a |
| 9 | ✅ ~~Notifications module + wire the SLA worker to it~~ — **done 2026-09-21** (DRIFT-10): tasks, SLA, documents, checkout-overdue and circulars all notify. Stale here until 2026-10-15. Left: an end-to-end click-through | Backend | Was: task assignment, SLA warnings, circular acks |
| 10 | ✅ ~~Audit module: `AuditService.log()` everywhere + hash chain + `GET /audit`~~ — **done, both halves** (DRIFT-11 resolved, 2026-09-18). `admin/audit`, `auditor/trail` and `management/compliance` all read the real trail; `platform/audit` stays mocked by design (no cross-tenant backend exists) | — | **The auditor dashboard and the compliance claim are both real now** for every tenant-scoped role |
| 11 | ✅ ~~Next.js `middleware.ts` for server-side route protection~~ — **done** 2026-09-21, as `proxy.ts` (Next.js 16's rename). Fails closed only on a confirmed 401/403, fails open on an unreachable backend, covered by a session-expired modal and a service-unavailable overlay. See DRIFT-02 (resolved) in doc 01 §4. | — | Closed the forgeable-role hole |
| 12 | 🟨 Cabinet access-grant UI **+ backend read-path enforcement** — the UI is done (Access card, 2026-09-04; delegated managers 2026-10-06) and cabinet/folder reads check grants. **Left:** document list/detail/search don't (doc 03 Phase 4) *(re-checked 2026-10-15)* | Backend | Need-to-know actually works |
| 13 | ✅ ~~Delegation UI~~ — `/delegations` exists, wired to `useDelegations`/`useCreateDelegation`/`useEndDelegation`. Was stale here; caught 2026-09-18. Not re-verified end-to-end. | Frontend | Supervisors can take leave |
| 14 | ✅ ~~Repoint the role matrix editor~~ — already on `PUT /roles/:id/permissions` via `useSetRolePermissions`. **2026-09-10** also added role **rename**/**delete** (`useUpdateRole`/`useDeleteRole`), user **role assign/remove** on save (`POST`/`DELETE /users/:id/roles`), and moved the resource/action vocabulary into `src/lib/permissions.ts` | Frontend | Was: silent data loss |
| 14a | ✅ **Assign a stage to a department** (2026-10-12) — **department-only done 2026-10-13, verified live**: Designer option, "is this my task" and holder labels. **Role + department and sub-departments done 2026-10-16, verified live** (saved and reloaded in the Designer; routing through a sub-department stage not exercised): a top-level department then an optional sub-department (edms-backend PR #52 `sub_department_id`), on Department and, optionally, on Role. One department per stage, matched exactly (decision 2026-10-16). Since `3014b89` a stage takes `department_id`, alone (anyone in that department) or with a role (that role, in that department); the backend checks the department exists. The Workflow Designer's **Assign to** offers only role or person. Add a department option (and role + department), and show the department on task rows (`Task.assignedDepartmentId`) | Frontend | Tracker 6.4 |
| 14b | ✅ ~~**Explain why a routed workflow disappears**~~ — **done 2026-10-13**: `/doc/[id]` explains it and stops offering routing, the staff dashboard's empty workflow list says why workflows leave it, and bulk routing (search, cabinets, upload) leaves out documents already in a workflow. (DRIFT-22.) At `own` scope, `3014b89` dropped the "created one of its documents" rule from workflow visibility; only task assignees see it. **The backend developer confirmed this is intended (2026-10-12).** So the staff dashboard tiles and `/doc/[id]`'s Workflows card need an explanation instead of a silent empty state (and "Route to workflow" shouldn't invite routing a document that's already in one) | Frontend | Staff aren't misled by an empty list |
| 15 | ✅ ~~`POST /users/invite`~~ + mail transport + password reset — **`POST /users/:id/invitation`**, **`POST /auth/reset-password`** and the initial invite on creation all work since 2026-09-18 (the "hardcoded default password" remainder was stale, corrected 2026-10-15). **Left:** login rate limiting | Backend | Was: removes most of the admin password handling |

### 🟡 P2 — the following month

| # | Item | Owner |
|---|---|---|
| 16 | ✅ ~~Aggregation/reporting endpoints; then delete `fetchAllPages.ts`~~ — **backend half done** (8 endpoints exist); **frontend half done for management** (2026-09-21) — all four management dashboards rewired onto them, `useAllTasks`/`useAllWorkflowInstances` deleted. `fetchAllPages.ts` itself stays: `useAllDocuments` still legitimately lists every document in one cabinet for `staff/cabinets`, which no aggregate endpoint answers. Supervisor-side adoption (§2) not yet checked. | — |
| 17 | `Finding` model + endpoints + a management-oriented view | Both |
| 17a | ✅ ~~`departmentId` filter on `GET /documents` (and `GET /workflow-instances`) so management charts can drill down to the records behind a department's bar (21.6, 22.3)~~ — **backend done 2026-10-14** (edms-backend PR #51): both lists take `departmentId`, and `/documents/search` now takes the whole list filter set. **Frontend done 2026-10-14:** `/management`'s department table has a **Records** column and `/management/departments` a **View records** button, both opening `/search?dept=<id>`; `/search` gained a Department facet (URL `?dept=`, saved with the search). The workflow side followed the same day: **Workflows** / **View workflows** open the Workflow Monitor filtered by `departmentId` (22.3). Was (until 2026-10-08): a bar click only scoped the dashboard to that department | Frontend + Backend |
| 18 | ✅ ~~Cabinet metadata-field designer + dynamic upload form~~ — **done 2026-10-09**: fields offered to every uploader and sent with `POST /documents` / `/batch` (edms-backend `dd10017`), verified live as `staff`. The workflow picker's upload form does the same (confirmed by the product owner's testing 2026-10-09) | Frontend |
| 19 | ✅ ~~Comments and signatures endpoints~~ — task-action fields suffice (`comment` string on any action, `approve`'s required `signature` image). Dedicated `GET/POST /documents/:id/comments`/`/signatures` exist and were briefly wired 2026-09-18, then deliberately un-wired the same day: product wants one workflow trail, not a second task-independent thread. | — |
| 19a | Optional `signature` on the `review` task action (BE-16) — "Mark reviewed" already has an optional-comment modal; needs the backend to accept a signature there too, the same way `approve` does | Backend |
| 19b | ✅ ~~Support more than one document per workflow instance (BE-17)~~ — **backend done** (`5144fc7`, then per-document routing and SLA in `919d0ef`, 2026-10-06). **Frontend done 2026-10-07, confirmed in testing 2026-10-08** (DRIFT-19): routing several documents makes one workflow; the workflow page lists its documents with each one's stage and deadline; approve/reject/review/request-changes act on chosen documents. ~~Open on the backend: deadlines in the task and instance **lists**, and an on-time endpoint — until then list due dates, the Monitor's stage/due columns and SLA % show "—"~~ **Done:** backend PR #50 (live 2026-10-13) puts each document's `stageDueAt` in both lists (re-checked live 2026-10-16) and adds `GET /sla/outcomes/summary`; verified in TEST_PLAN Phase U. This row was stale until 2026-10-16 | Frontend |
| 20 | 🟨 Document download/export/print — **backend done** (`0dab81a`, 2026-10-08): `document:download`/`export`/`print` permissions plus per-tier `document:view_*` clearance, `GET /documents/:id/export` and `/print`, and old-version reads audited as downloads. **Frontend done 2026-10-08:** Download (not clicked through), Print in the pdf.js viewer (verified against the live API), Export on `/doc/[id]` (not clicked through). **Still open on the backend:** `GET /documents/:id`, the document list **and the version list** (`GET /documents/:id/versions`) hand everyone a signed URL, so download permission can be bypassed *(re-checked 2026-10-16 on `dev` `a88f279`: `getDocumentById`, `listDocuments` and `listVersions` all attach a signed `fileUrl` behind only `requireConfidentiality('view')`)* | Frontend |
| 20a | ~~**Full ingestion format support**~~ **Dropped 2026-10-21** (PM decision): uploads are PDF and images only — PDF/TIFF ≤100 MB, JPEG/PNG ≤10 MB — because every file goes through OCR and Textract reads exactly those. Word/Excel users save as PDF. What's left of this item: a TIFF preview (Chrome/Edge can't draw TIFF), and the backend enforcing the same allowlist (it accepts any `mimeType`). *Original entry, kept for history:* (logged 2026-10-08). The PRD and tracker require PDF, Office (Word/Excel/PowerPoint), JPG/PNG/TIFF and email (EML/MSG), plus ZIP archives expanded on ingestion, all with validation and preview rendering, and OCR on image-based/scanned files. **Today:** upload accepts PDF, DOCX, XLSX, TIFF, JPG, PNG; only PDF and JPG/PNG preview; PowerPoint, legacy .doc/.xls/.ppt, EML, MSG and ZIP are refused. Every file is sent to Textract, which fails on DOCX/XLSX, and the search index is only built after OCR succeeds — so DOCX/XLSX (and any file whose OCR fails) are **not searchable at all, not even by title**. **Agreed approach:** *backend* — at upload, render a PDF preview copy (LibreOffice for Office; message header + body for email, each attachment filed as its own linked document), extract text directly from born-digital files, OCR only images and scanned PDFs, and index title + metadata even when there's no text; *frontend* — accept the new types, expand ZIPs in the browser into one upload card per file (nested ZIPs too, unsupported entries flagged), show the preview copy in the existing PDF viewer, and until then a readable fallback ("Word documents can't be previewed yet" + Download) instead of the raw MIME type. Rejected: Microsoft's Office viewer (sends documents to a third party). Optional stopgap if the backend is far off: in-browser previews for DOCX/XLSX/TIFF only | Both |
| 21 | ✅ ~~Circulars: model, endpoints, audience targeting, ack tracking~~ — **backend module built; frontend wired 2026-10-05** (inbox, reader, manage area), *(confirmed by the product owner’s testing, 2026-10-09)*. (The Roles editor already offers `circular:*` — its matrix is built from the `GET /roles` union, and the backend accepts any seeded key — grouped under "Communication" in `MODULE_MAP`) | Frontend |
| 22 | Retention policy endpoints + enforcement job | Backend |
| 23 | Branding model + endpoints + logo upload | Both |
| 24 | ✅ ~~Version-restore and archive buttons~~ — **done 2026-09-10.** `/doc/[id]` right column has a `DocumentVersionsPanel` (list · open · restore · upload new version) and an "Archive document" item in the More menu; `DocumentDetailsPanel` gains an inline metadata editor when the user holds `document:edit` | Frontend |
| 25 | ✅ ~~`GET /workflow-history` tab on `/doc/[id]`~~ — **already done**, this row was inconsistent with the page's own feature table above (which correctly marked it ✅) | — |
| 26 | Paginate cabinets, folders, roles, departments — *re-checked 2026-10-16:* none of the four takes `page`/`limit`; each list is silently cut off (cabinets 100, roles 100, departments 200, folders 500 per cabinet) | Backend |
| 27 | ✅ ~~Remove `@ts-nocheck`~~ — **done 2026-10-08**: `search` lost it in its 2026-09-30 rebuild, `admin/workflows` on 2026-10-08. No file carries it now | Frontend |
| 28 | ✅ ~~Fix `/platform/flags` re-exporting the wrong page~~ — **done 2026-10-08** | Frontend |
| 29 | ✅ ~~Role switcher in the Topbar for multi-role users~~ — **built 2026-10-08, verified live 2026-10-09** (a `staff` user given `supervisor` for the test, then removed: switched portals both ways, choice survived a reload): one portal per built-in role held, choice kept per user in `prefs` (doc 04, Multi-role users) | Frontend |
| 29a | ✅ **Fixed 2026-10-08 (frontend rule):** a custom-role user now goes by what their permissions *do*: changes tenant setup (create/edit users, roles, workflows, departments, cabinets) → admin; reassigns tasks → supervisor; acts on tasks, files or routes → staff; reads the audit trail → auditor; `department:view` → management; then any portal they can enter (`customRolePortalOrder` in `src/lib/permissions.ts`). Budget Officer now lands in the Staff Workspace. A per-role home-portal setting (backend) would still be the exact answer. *Original finding:* **Where custom roles land** (found 2026-10-08). A user whose roles are all custom gets the first portal in `PORTALS` (`src/lib/permissions.ts`) whose entry permissions they hold, in the order admin → auditor → management → supervisor → staff. Admin's entry includes `workflow:view`, which most document roles need, and management's includes `document:view`. So the tenant's "Budget Officer" (16 grants, including `workflow:view`) lands in **Client Administration**; a role without `workflow:view` but with `document:view` lands in **Management**; and the Staff Workspace and Supervisor Console are in practice unreachable for custom roles. Needs a decision: a better rule on the frontend, or a home-portal setting per role (backend field) | Frontend / Both |
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

**Most of the governance half is real now too** *(re-written 2026-10-15)*. The audit trail,
notifications, circulars and the SLA settings all run on the backend. What is still a UI
over fixture data is **14 of the 59 pages** (11 entirely, 3 in part — "By data source"
above): Platform (6/6, by design), the auditor's dashboard and findings, management's
findings re-export, branding, `/supervisor/exceptions`, and the retention/confidentiality
tabs of `/admin/policies`.

**DRIFT-14 is a provisioning gap, not an outage** *(re-tested 2026-10-16)*. On the live
tenant the roles that route documents hold `workflow:view:global` and can list workflow
definitions — which is why the 2026-10-08 staff routing test passed. The RBAC seed grants
`workflow:view` only to `client_admin` and `schulltech_admin`, so a freshly seeded tenant
would block routing for everyone else. It is four seed rows, and it must land before a new
tenant is provisioned.

*Superseded (2026-10-15):* "One defect sits on the seam and matters more than any individual
gap: DRIFT-14 … There's an open question to settle first" — settled 2026-10-16 as above.

*Superseded (2026-08-29 / 2026-09-04):* "Four defects … workflow routes have **no
authorization at all**; the audit trail … has **never recorded a single event**; document
routing … **calls a URL that does not exist**; and `effStatus()` silently returns zero."
All four were fixed or retracted: DRIFT-05 (2026-09-04), DRIFT-11 (2026-09-18), DRIFT-09
(2026-09-04) and DRIFT-13 (2026-09-21).
