# 04 — Per-Role Onboarding & How the Roles Connect

**Status:** Written 2026-08-29 against the current code.

**Revised 2026-09-04** against `edms-backend` @ `dev` (`b72e0bf`, 83 routes) and
`EDMS-FRONTEND` @ `dev` (`f02c7b8`). Two findings changed: **document routing is fixed**
(the two-call create-then-start sequence shipped) and **the notifications module now
exists** on both sides — but nothing calls `notifyUser`, so no notification is ever
created. Superseded statements are struck through or marked in place rather than
deleted. See `01-architecture-and-drift.md` for the full revision table.


Doc 03 followed the organisation as a single chain. **This document goes role by role** —
what each person's first day, first week and steady state actually look like — and then
maps the **handoffs** where work passes from one role to another.

The handoff map matters more than it sounds: every gap in this product sits on a seam
between two roles, not inside one role's screens.

---

## Table of contents

- [Reading this document](#reading-this-document)
- [The role interaction map](#the-role-interaction-map)
- [Role 1 — SchullTech Platform Admin](#role-1--schulltech-platform-admin-schulltech_admin)
- [Role 2 — Client Administrator](#role-2--client-administrator-client_admin)
- [Role 3 — Staff Officer](#role-3--staff-officer-staff)
- [Role 4 — Supervisor](#role-4--supervisor-supervisor)
- [Role 5 — Management](#role-5--management-management)
- [Role 6 — Internal Auditor](#role-6--internal-auditor-internal_auditor)
- [The seven handoffs](#the-seven-handoffs)
- [Cross-role data dependencies](#cross-role-data-dependencies)
- [Multi-role users](#multi-role-users)
- [What each role would notice first](#what-each-role-would-notice-first)

---

## Reading this document

Each role section has the same six parts:

1. **Identity** — who they are, what the backend grants them, where they land
2. **Day one** — the first session, step by step
3. **First week** — the habits that form
4. **Steady state** — the daily loop
5. **What they can and cannot do** — a rights table grounded in the seed data
6. **Where their experience breaks today** — ranked by how soon they'd hit it

Status markers are the same as doc 02: ✅ Done · 🟨 Partial · 🟥 Mock · ⛔ Blocked/absent.

---

## The role interaction map

```
                      ┌──────────────────────────────┐
                      │  SCHULLTECH_ADMIN (Adaeze)   │  🟥 mock portal
                      │  Vendor operations           │  3 permission grants only
                      │  /platform                   │  Cannot read customer documents
                      └──────────────┬───────────────┘
                                     │  H1: provisions the tenant
                                     │      + the first admin account
                                     ▼
                      ┌──────────────────────────────┐
                      │  CLIENT_ADMIN (Bola)         │  45 grants, all global
                      │  Tenant system owner         │  Only role bypassing
                      │  /admin                      │  cabinet access checks
                      └──┬────────┬────────┬─────────┘
                         │        │        │
         H2: creates     │        │        │  H3: defines cabinets,
         users, assigns  │        │        │      folders, workflows,
         roles + depts   │        │        │      policies, branding
                         │        │        │
        ┌────────────────┘        │        └──────────────────┐
        ▼                         ▼                           ▼
┌──────────────────┐   ┌──────────────────┐      ┌─────────────────────────┐
│  STAFF (Chika)   │   │ SUPERVISOR(David)│      │  MANAGEMENT (Eniola)    │
│  14 grants       │   │  18 grants       │      │  10 grants, read-only   │
│  own / department│   │  department      │      │  global                 │
│  /staff          │   │  /supervisor     │      │  /management            │
└────────┬─────────┘   └────────┬─────────┘      └────────────┬────────────┘
         │                      │                              │
         │  H4: routes a        │  H5: reassigns work          │  H6: reads
         │      document for    │      back down to staff      │      aggregates
         │      approval        │                              │      produced by
         │─────────────────────▶│                              │      staff+supervisor
         │                      │─────────────────────────────▶│      activity
         │◀─────────────────────│                              │
         │   returns rejected   │                              │
         │   or changes-requested                              │
         │                      │                              │
         └──────────┬───────────┴──────────────────────────────┘
                    │
                    │  H7: every action above SHOULD emit an audit entry
                    ▼            ⛔ nothing is ever written
         ┌──────────────────────────────┐
         │  INTERNAL_AUDITOR (Femi)     │  10 grants, read-only global
         │  Independent assurance       │  Cannot mutate anything, by design
         │  /auditor                    │  🟥 portal reads SEED fixtures
         └──────────────────────────────┘
```

**The two structural observations:**

1. **Every arrow into the auditor is broken.** H7 is the only handoff that is 100%
   non-functional, and it is the one the product's compliance positioning depends on.
2. **`client_admin` is a single point of failure.** Five of the seven handoffs originate
   with them, and they are the only role that can perform any configuration. There is no
   delegated administration, no "cabinet owner" role, no read-only admin.

---

## Role 1 — SchullTech Platform Admin (`schulltech_admin`)

> **Persona:** Adaeze · vendor-side operations · not an employee of the customer
> **Landing page:** `/platform` · **Sidebar:** SchullTech Platform Admin
> **Overall status:** 🟥 **Entire portal is fixture data**

### Identity and rights

**Backend grants — exactly three:**

```
workflow:view:global
workflow:route:global
audit:view:global
```

That is the complete list. This role **cannot** call `GET /users`, `GET /documents`,
`GET /cabinets`, or `GET /departments` — all return 403.

**And that is correct.** `access-control.constants.ts` documents the reasoning explicitly:
`schulltech_admin` is **deliberately excluded** from `CABINET_ACCESS_BYPASS_ROLES` and from
every confidentiality tier list, including `TOP_SECRET_TIER_ROLES` (which is empty by
design). The comment states that any future support access should be a *time-boxed, audited
impersonation flow* — its own mechanism, not a standing role grant.

**The vendor cannot read customer documents.** For a multi-tenant SaaS handling regulated
records, that is a serious and correct architectural decision.

> ⛔ **The frontend contradicts this completely.** `usePermissions.ts:24` returns `true` for
> every permission check when the user holds `schulltech_admin`, and `routes.config.ts`
> opens the whole `/platform` prefix. The portal only *appears* to work because every
> `/platform` page reads from `SEED` and never calls the API. See DRIFT-04 in doc 01.

### Day one

| # | Step | Screen | Status |
|---|---|---|---|
| 1 | Log in | `/` | ✅ (⛔ the autofill button uses a non-existent email) |
| 2 | Land on the Tenant Directory | `/platform` | 🟥 `SEED.tenants` |
| 3 | Review platform health | `/platform/sysconfig` | 🟥 `SEED` |
| 4 | Check plans and entitlements | `/platform/plans` | 🟥 `SEED.plans` |
| 5 | Review billing and usage | `/platform/billing` | 🟥 `SEED` |
| 6 | Check feature flags | `/platform/flags` | 🟥 ⚠️ **re-exports `/platform/sysconfig` — wrong page** |
| 7 | Review the platform audit log | `/platform/audit` | 🟥 `SEED.audit` |

### First week — what they would try to do

| Task | Reality |
|---|---|
| Provision a new tenant | ⛔ `addTenant()` writes to localStorage. No control-plane DB, no per-tenant provisioning. |
| Suspend a delinquent tenant | ⛔ `updateTenant()` — same. The row changes, a toast fires, nothing persists. |
| Change a tenant's plan | ⛔ Mock. No plan model, no entitlement enforcement anywhere. |
| Enable a feature for one tenant | ⛔ No flag model, no evaluation logic in either codebase. |
| Investigate a customer's issue | ⛔ Correctly cannot — no document access. Would need the impersonation flow that doesn't exist yet. |
| Check queue depth / worker health | ⛔ `GET /health` returns `{status:'ok', timestamp}`. No DB probe, no Redis probe, no queue metrics. |

### Why this is Phase 2 work, not neglect

The backend runs in **single-tenant mode by design**. `docs/edms_architecture.md` §1–2
describes "True Silo" — one isolated database per tenant, the database itself as the
boundary, **no `tenant_id` columns anywhere** — and states the migration is *one line per
controller* because `db` is passed as a parameter rather than imported.

That claim holds up: a sweep of `src/` confirms `db` is imported only in controllers,
middlewares and workers, never in a service or repository. §6 records that a teammate's
premature multi-tenancy infrastructure was **removed** rather than carried as dead code.

The `/platform` portal is a design prototype for a phase that hasn't started.

### Where it breaks, ranked

1. ⛔ **Every screen is fixture data.** Nothing this role does persists.
2. ⛔ **The frontend grants unlimited permissions** the backend explicitly withholds — a
   correctness bug waiting to surface the day `/platform` is wired to real endpoints.
3. ⛔ **No control-plane database.** Phase 0 of doc 03 is entirely manual.
4. ⛔ **`audit:view:global` is granted with no `/audit` endpoint** to use it.

---

## Role 2 — Client Administrator (`client_admin`)

> **Persona:** Bola · the tenant's own system owner, usually IT or Operations management
> **Landing page:** `/admin` · **Sidebar:** Client Administration
> **Overall status:** 🟨 **Structure is real; policy, branding and circulars are mock**

### Identity and rights

**45 grants, every one `global` scope.** Documents, versions, locks, metadata, cabinets,
metadata fields, cabinet access, folders, departments, users, roles, workflows, audit.

Two unique properties:
- The **only** role in `CABINET_ACCESS_BYPASS_ROLES` — sees every cabinet regardless of grants
- The **only** role in `RESTRICTED_TIER_ROLES` — the sole reader of `restricted` documents

This is the most powerful role in the tenant, and appropriately so.

### Day one — the setup sequence

This must be done in order; each step produces the input for the next.

| # | Step | Screen | API | Status |
|---|---|---|---|---|
| 1 | Log in, land on Admin Home | `/admin` | `GET /users`, `GET /cabinets` | ✅ |
| 2 | **Create the department tree** | `/management/departments` | `POST /departments` | ✅ |
| 3 | **Create cabinets, assign to departments** | `/admin/cabinets` | `POST /cabinets` | ✅ |
| 4 | **Build folder trees** | `/admin/cabinets` | `POST /cabinets/:id/folders` | ✅ |
| 5 | Define cabinet metadata fields | — | `POST /cabinets/:id/metadata-fields` | ⛔ **no UI** |
| 6 | Grant cabinet access to roles/users | — | `POST /cabinets/:id/access` | ⛔ **no UI** |
| 7 | **Create users, assign dept + roles** | `/admin/users` | `POST /users`, `POST /users/:id/roles` | 🟨 no invite flow |
| 8 | **Design and publish workflows** | `/admin/workflows` | `POST /workflows`, `/publish` | 🟨 **no authorization** |
| 9 | Set retention and confidentiality policy | `/admin/policies` | — | 🟥 `SEED.policies` |
| 10 | Apply branding | `/admin/branding` | — | 🟥 `SEED.branding` |
| 11 | Publish a welcome circular | `/admin/circulars` | — | 🟥 `SEED.circulars` |
| 12 | Review the tenant audit trail | `/admin/audit` | — | 🟥 `SEED.audit` |

**Steps 2, 3, 4, 7 and 8 are real.** Everything else is either missing a UI or writes only
to localStorage.

### First week

| Task | Status | Note |
|---|---|---|
| Onboard staff in batches | 🟨 | Works — but Bola sets and communicates every password by hand |
| Adjust the role permission matrix | 🟨 | `PUT /roles/:id/permissions` exists; **the UI writes to `SEED.rolesMatrix` instead** |
| Create a new cabinet for a new business line | ✅ | |
| Fix a workflow that stalls | ✅ | Create a new version; published definitions are immutable |
| Deactivate a leaver | ✅ | `PATCH /users/:id {status:'inactive'}` → login returns 403 |
| Reset someone's password | ⛔ | No reset flow. Only `PATCH /users/:id` with a new password. |
| Answer "who can see the Contracts cabinet?" | ⛔ | `GET /cabinets/:id/access` exists; **no screen calls it** |
| Configure retention | ⛔ | Model exists, no endpoint, no enforcement job |

### Steady state

Bola opens the system a few times a week: add a joiner, remove a leaver, adjust a workflow,
answer an access question. Most of that works. The access question is the one that
consistently fails.

### What they can and cannot do

| Capability | Backend | UI |
|---|---|---|
| Full document CRUD across the tenant | ✅ | ✅ |
| Manage users, roles, departments | ✅ | ✅ |
| Manage cabinets and folders | ✅ | ✅ |
| Manage cabinet metadata fields | ✅ | ⛔ |
| Manage cabinet access grants | ✅ | ⛔ |
| Manage workflow definitions | ✅ | ✅ ⚠️ *but so can everyone else* |
| Read `restricted` documents | ✅ | ✅ |
| Read `top_secret` documents | ❌ **nobody can** | — |
| Configure retention | ❌ | 🟥 |
| Configure branding | ❌ | 🟥 |
| Publish circulars | ❌ | 🟥 |
| View the audit trail | ❌ no endpoint | 🟥 |

### Where it breaks, ranked

1. ⛔ **The workflow designer they own has no authorization** — any `staff` account can
   publish or archive the definitions Bola created (DRIFT-05).
2. ⛔ **They cannot grant cabinet access**, which is the core of the need-to-know model
   they are responsible for.
3. ⛔ **The role matrix editor writes to localStorage**, so permission changes appear to
   work and silently don't.
4. ⛔ **No invite flow** — they handle every user's password personally.
5. 🟥 **Branding, policies and circulars all reset on cache clear.**
6. ⛔ **Their audit view is fabricated data.**

---

## Role 3 — Staff Officer (`staff`)

> **Persona:** Chika · operations desk officer · 15–40 documents a day
> **Landing page:** `/staff` · **Sidebar:** Staff Workspace
> **Overall status:** ✅ **The strongest role in the product** — capture and filing genuinely work

### Identity and rights

**14 grants, and the scopes are the important part:**

```
document:view:department          document:create:own
document:search:department        document_version:view:department
document_version:create:own       document_lock:create:own
document_lock:delete:own          document_metadata:view:department
document_metadata:edit:own        cabinet:view:department
folder:view:department            workflow:view:global
workflow:route:global
```

`department` scope resolves in SQL to `where.cabinet.departmentId = user.departmentId`.
`own` resolves to `where.createdBy = user.id`.

> ⚠️ **A staff user with no `departmentId` fails closed to `own`.** This is deliberate
> (`applyAccessScope`: *"fail closed rather than silently widening access"*) — but it means
> forgetting to set a department during user creation silently halves a person's access.
> Worth a checklist item in Phase 5 of doc 03.

### Day one

| # | Step | Screen | Status |
|---|---|---|---|
| 1 | Log in with the password the admin gave them | `/` | ✅ ⚠️ no forced change |
| 2 | Land on the Staff Dashboard | `/staff` | 🟨 tasks from API, notifications ⛔ 404 |
| 3 | Browse the cabinets they can see | `/staff/cabinets` | ✅ |
| 4 | Upload their first document | `/upload` | ✅ |
| 5 | Watch it appear in the cabinet | `/staff/cabinets` | ✅ |
| 6 | Open it and check the details | `/doc/[id]` | ✅ |
| 7 | Route it for approval | `/doc/[id]` | ⛔ **404 (DRIFT-09)** |
| 8 | Check their task queue | `/staff/tasks` | ✅ |
| 9 | Read circulars | `/circulars` | 🟥 `SEED` |
| 10 | Check notifications | `/notifications` | ⛔ HTML 404 |

### First week — habits that form

| Habit | Status | Note |
|---|---|---|
| File 20–30 documents a day | ✅ | The core loop works well |
| Search for a document by content | ⛔ | **Returns nothing.** OCR always fails, so the index is never built. |
| Browse to a document instead | ✅ | This becomes the workaround, and it works |
| Check out before editing | ✅ | Lock prevents concurrent edits, returns 409 |
| Upload a revised version | ✅ | Auto-increments the version number |
| Route for approval | ⛔ | 404 — the single biggest blocker for this role |
| Watch their own task queue | ✅ | ⚠️ manually, because no notification ever arrives |
| Check "my performance" | 🟨 | `/staff/performance` mixes API and `SEED` |

### Steady state — the daily loop

```
morning   → /staff        check dashboard   ⚠️ must remember to; nothing pings them
          → /staff/tasks  work the queue    ✅
during    → /upload       file arrivals     ✅  (⚠️ >2 MB rejected, PDF/images only)
          → /doc/[id]     add context       ⛔ comments 404
          → route         send for approval ⛔ 404
          → /search       find something    ⛔ empty
end       → /staff/tasks  clear the queue   ✅
```

### What they can and cannot do

| Capability | Status | Note |
|---|---|---|
| Upload and file | ✅ | The best-built flow in the product |
| See department documents | ✅ | ⚠️ but cabinet grants aren't enforced on reads, so scope is wider than intended |
| Edit documents they created | ✅ | `document:edit` is `own`-scoped |
| Check out / check in | ✅ | ⚠️ only they can release their own lock — no admin override |
| Upload new versions | ✅ | |
| Restore an old version | ⛔ | Backend works, no UI |
| Search by content | ⛔ | Index never built |
| Comment | ⛔ | 404 |
| Route to a workflow | ⛔ | 404 |
| Act on assigned tasks | ✅ | |
| Delete a document | ❌ | Not granted — correct |
| **Publish a workflow definition** | ⚠️ **YES** | **Should be ❌. No authorization on the endpoint (DRIFT-05).** |

### Where it breaks, ranked

1. ⛔ **Routing 404s** — they can file but not send anything for approval
2. ⛔ **Search is empty** — the feature that justifies scanning
3. ⛔ **No notifications** — they must poll their own queue
4. ⛔ **Comments 404** — no way to add context to a document
5. ⚠️ **2 MB limit, PDF/images only** — many real documents rejected
6. ⚠️ **No forced password change** on first login

---

## Role 4 — Supervisor (`supervisor`)

> **Persona:** David · operations team lead · 6–12 direct reports
> **Landing page:** `/supervisor` · **Sidebar:** Supervisor Console
> **Overall status:** 🟨 **Approval works well; oversight is half-real**

### Identity and rights

**18 grants**, mostly `department`-scoped, plus two memberships that matter more than the
grants:

- `TASK_VIEW_ALL_ROLES` → may request `GET /tasks?scope=all` and see the whole team's queue
- `TASK_REASSIGN_ROLES` → may `PATCH /tasks/:id/reassign`
- `CONFIDENTIAL_TIER_ROLES` → may read `confidential`-tier documents

Those three constants — not the permission table — are what actually make supervision work.

### Day one

| # | Step | Screen | Status |
|---|---|---|---|
| 1 | Log in, land on Team Overview | `/supervisor` | 🟨 API + `SEED` mixed |
| 2 | Open the approvals queue | `/supervisor/approvals` | ✅ |
| 3 | Open a document, review | `/doc/[id]` | ✅ (⛔ no download, ⛔ comments 404) |
| 4 | Approve with a note | `POST /tasks/:id/action` | ✅ |
| 5 | Check what's ageing | `/supervisor/bottlenecks` | 🟨 real documents, but **"Overdue" is always 0** (DRIFT-13); ignores `SlaBreach` |
| 6 | Check team workload | `/supervisor/workload` | 🟨 works, but walks all pages client-side |
| 7 | Reassign an overloaded person's task | `PATCH /tasks/:id/reassign` | ✅ |
| 8 | Review exceptions | `/supervisor/exceptions` | 🟨 |
| 9 | Review team performance | `/supervisor/performance` | 🟥 86 lines, no data source |

### First week

| Task | Status | Note |
|---|---|---|
| Clear the approvals queue daily | ✅ | Prioritised by urgency then due date — genuinely good |
| Approve / reject / request changes | ✅ | Notes recorded, history written |
| Spot ageing work | 🟨 | Ageing in days is real (computed from `createdAt` on live documents), but the **breach count is permanently zero**: `effStatus()` looks for a `due` field that `Document` does not have, and compares capitalized statuses against lowercase values (DRIFT-13). Separately, **`SlaBreach` rows exist in the DB and no screen reads them.** |
| Rebalance workload | ✅ | |
| Delegate while on leave | ⛔ | **Backend is complete. No UI, no service file, no hook.** |
| Get warned before a breach | ⛔ | The SLA worker detects it and tells nobody |
| Export team stats | ✅ | `exportCsv` |

### Steady state

```
morning   → /supervisor/approvals   clear the queue      ✅
          → /supervisor/bottlenecks check ageing         🟨 breaches always 0
weekly    → /supervisor/workload    rebalance            🟨 slow, client-side
          → /supervisor/performance review the team      🟥 no data
ad hoc    → reassign                                     ✅
          → delegate before leave                        ⛔ impossible
```

### The delegation gap deserves emphasis

The `Delegation` model is complete and thoughtful: `startsAt`/`endsAt`, an optional JSON
`scope` limiting it to specific cabinets or workflows, an `isActive` flag, an index for a
scheduled activate/deactivate job, and full CRUD at `GET/POST /delegations` and
`POST /delegations/:id/end`. `tasks.service` **already resolves delegations** when listing
and actioning tasks.

**There is no UI at all** — no page, no service, no hook. A supervisor going on leave has
no way to hand over, so their queue simply stops moving. For a role whose entire purpose is
being the approval bottleneck, this is the most consequential missing screen in the product.

### Where it breaks, ranked

1. ⛔ **No delegation UI** — leave stalls the whole team's work
2. ⛔ **SLA warnings reach nobody** — the engine works, the delivery doesn't
3. 🔴 **Overdue is permanently zero** — `effStatus()` checks a `due` field the backend
   never sends, and compares `'Closed'` against a lowercase `'closed'` (DRIFT-13).
   Affects 8 call sites, not just this page.
4. 🟨 **Bottlenecks recomputes ageing** instead of reading the real `SlaBreach` table
5. 🟨 **Workload view walks up to 50 pages** client-side to compute counts
6. ⛔ **No document download** for offline review
7. 🟥 **`/supervisor/performance` has no data source**

---

## Role 5 — Management (`management`)

> **Persona:** Eniola · executive, divisional or C-suite
> **Landing page:** `/management` · **Sidebar:** Management Portal
> **Overall status:** 🟨 **Works today, will not scale**

### Identity and rights

**10 grants, all `global`, all read-only** — plus one exception:

```
document:view:global          document:search:global
document_version:view:global  document_metadata:view:global
cabinet:view:global           folder:view:global
department:view:global        user:view:global
workflow:view:global          workflow:route:global   ← the only non-read grant
```

**Management cannot create, edit or delete anything.** They see the whole tenant and change
nothing.

> ⛔ **The frontend disagrees.** `usePermissions.ts` grants `management` the actions
> `view, approve, reject, route` on documents. The UI therefore offers approve/reject
> affordances the backend never granted. Those actions currently *succeed* — but only
> because the workflow routes have no permission checks at all (DRIFT-05). Fix DRIFT-05
> and management's approve buttons will start returning 403. **Fix the frontend heuristic
> at the same time**, or this will look like a regression.

### Day one

| # | Step | Screen | Status |
|---|---|---|---|
| 1 | Log in, land on Organization Overview | `/management` | 🟨 real data, client-side aggregation |
| 2 | Compare departments | `/management/departments` | 🟨 same |
| 3 | Review trends | `/management/trends` | 🟨 same |
| 4 | Check compliance posture | `/management/compliance` | 🟨 partly `SEED` |
| 5 | Review performance | `/management/performance` | 🟨 43-line thin page |
| 6 | Review findings | `/management/findings` | 🟥 re-export of `/auditor/findings` |
| 7 | Export a report | `/management/reports` | 🟨 CSV works |

### First week

| Question they ask | Answer today |
|---|---|
| "Which department is slowest?" | 🟨 Answerable — computed in the browser from up to 5,000 rows |
| "Is turnaround improving?" | 🟨 `/management/trends` buckets by month from real timestamps |
| "What's our SLA compliance?" | 🟨 Computed client-side; **ignores the real `SlaBreach` table** |
| "How many documents this quarter?" | 🟨 Counted client-side |
| "Show me open audit findings" | 🟥 Re-exports the auditor's findings screen, which runs on `SEED.findings`. **No `Finding` model exists.** |
| "Export this for the board" | ✅ CSV |
| "Email me this weekly" | ⛔ No scheduling, no mail transport |

### The scaling problem, quantified

Every management page uses `fetchAllPages`:

```
useAllDocuments()          → up to 50 requests × 100 records
useAllTasks()              → up to 50 requests × 100 records
useAllWorkflowInstances()  → up to 50 requests × 100 records
                             ────────────────────────────────
                             up to 150 sequential HTTP requests
                             up to 15,000 records into the browser
                             to render ONE dashboard
```

`fetchAllPages.ts`'s own header is candid: *"INTERIM STOPGAP — not a substitute for real
server-side aggregation… reconstructing in the browser what a single SQL aggregate query
would do on the server. Replace call sites with real aggregation endpoints once the backend
adds them, and delete this file."*

**The backend has no aggregation, statistics or reporting endpoints of any kind.** This is
the single largest backend gap for this role, and it is invisible at demo scale.

### Where it breaks, ranked

1. 🔴 **No aggregation endpoints** — dashboards degrade linearly with tenant size
2. 🟥 **Findings page re-exports the auditor's screen** — `SEED` data, and no
   management-oriented framing (ownership, ageing, department rollup)
3. ⛔ **SLA compliance ignores the real breach data** that already exists
4. ⛔ **Frontend promises approve/reject rights** the backend withholds
5. ⛔ **No scheduled or emailed reports**

---

## Role 6 — Internal Auditor (`internal_auditor`)

> **Persona:** Femi · compliance and assurance · independent of operations
> **Landing page:** `/auditor` · **Sidebar:** Audit & Compliance
> **Overall status:** 🟥 **Every screen is fixture data. The most broken role in the product.**

### Identity and rights

**10 grants, all `global`, all read-only:**

```
document:view:global          document:search:global
document_version:view:global  document_metadata:view:global
cabinet:view:global           cabinet_access:view:global
folder:view:global            department:view:global
workflow:view:global          audit:view:global
```

Plus membership of `CONFIDENTIAL_TIER_ROLES`, so they can read `confidential`-tier
documents. **Deliberately cannot mutate anything** — that independence is the point of the
role.

Two of these grants point at endpoints that don't exist:
- `audit:view:global` → **there is no `/audit` route**
- `cabinet_access:view:global` → the endpoint exists, but **no screen calls it**

### Day one

| # | Step | Screen | Status |
|---|---|---|---|
| 1 | Log in, land on Audit Dashboard | `/auditor` | 🟥 `SEED.findings`, `SEED.audit` |
| 2 | Open the audit trail | `/auditor/trail` | 🟥 `SEED.audit` — 172 lines of fixtures |
| 3 | Sample documents | `/staff/cabinets` | ✅ real (shared with staff) |
| 4 | Search for evidence | `/search` | ⛔ index never built |
| 5 | Raise a finding | `/auditor/findings` | 🟥 367 lines on `SEED.findings` |
| 6 | Review compliance posture | `/auditor/compliance` | 🟥 re-export of `/management/compliance` |

### First week — what they would try to do

| Task | Reality |
|---|---|
| "Show me everything Chika did last month" | ⛔ **`audit_entries` has never been written to.** `audit.middleware.ts` is a 0-byte file; there are zero `auditEntry` references in `src/`. |
| "Who viewed this confidential contract?" | ⛔ Document views are not logged. |
| "Who downloaded it?" | ⛔ There is no download endpoint to log. |
| "Prove the trail hasn't been altered" | ⛔ The hash chain (`prevHash`/`entryHash`) is designed, indexed and empty. |
| "Who can see the Contracts cabinet?" | ⛔ `cabinet_access:view` granted; no screen calls the endpoint. |
| "Track this finding to closure" | 🟥 No `Finding` model in Prisma. Everything is lost on cache clear. |
| "Verify separation of duties" | ⛔ No SoD logic exists in either codebase. |
| "Export evidence for the regulator" | ⛔ Would export fixture data. |

### The gap between design and reality

This is worth stating plainly, because the design here is **good** and the implementation
is **absent**:

```
DESIGNED (audit.prisma)                      BUILT
─────────────────────────────────────────    ─────────────────────────────────
Append-only, enforced by an INSERT-only      ⛔ Never created
  Postgres role — no application code,
  admin, or migration can UPDATE/DELETE
Hash-chained: entryHash = SHA-256 of         ⛔ Never computed
  id + actor + action + object + time
  + prevHash
Indexed for: object history, actor           ✅ Indexes exist (on an empty table)
  timeline, action filter, time range
Range-partitioned by month                   ⛔ Not applied
25 documented action types                   ⛔ None emitted
AuditService.log() on every create,          ⛔ No AuditService exists
  update, delete, view and download
```

**A product positioned on "every action logged immutably for compliance" has, to date,
logged zero actions.** The schema is already correct — this is a build, not a redesign, and
it is the highest-value item in the backlog after the workflow authorization hole.

### Where it breaks, ranked

1. 🔴 **The audit trail has never recorded a single event** — this role's entire purpose
2. 🔴 **No `Finding` model** — 367 lines of UI over localStorage
3. ⛔ **No `/audit` endpoint** despite the permission being granted
4. 🟥 **`/auditor/compliance` re-exports the management page** — partly `SEED`-backed
5. ⛔ **Search is empty**, so document sampling by content is impossible
6. ⛔ **No SoD enforcement** despite it being claimed in the older docs

---

## The seven handoffs

Each handoff is a seam where work or data crosses a role boundary. **Four of seven are
broken or partly broken** (was five — H4 was fixed on 2026-09-04), and every one of them
is a seam rather than a screen, which is why role-by-role testing misses them.

---

### H1 · Platform Admin → Client Admin · 🟥 **Mock**

**What passes:** a provisioned tenant, an isolated database, a commercial plan, and the
first `client_admin` account with credentials.

**Reality:** none of it. No control-plane DB, no provisioning, no plan model, no mail
transport. Today this handoff is a manual engineering task: run migrations, run the seed,
create the admin with a script.

**To fix:** Phase 2 multi-tenancy work — control-plane database, `resolveTenant`
middleware, `req.db` injection. `docs/edms_architecture.md` §2 scopes it as one line per
controller.

---

### H2 · Client Admin → All roles (user provisioning) · 🟨 **Partial**

**What passes:** a user account with a department, one or more roles, and working
credentials.

**Works:** `POST /users` with bcrypt hashing, department and role validation, role
assignment and removal, deactivation.

**Broken:**
- ⛔ **No invite flow.** The admin sets the password and communicates it personally.
- ⛔ **No forced change on first login**, so the admin permanently knows it.
- ⛔ **No password reset.**
- ⛔ **No rate limiting on login** — unlimited guessing against known credentials.
- ⚠️ **No department = silent scope collapse.** A staff user without a `departmentId`
  fails closed from `department` to `own` scope. They see only their own documents and
  nobody is told why.

**To fix:** `POST /users/invite` with a signed expiring token (Redis is already a
dependency), a mail transport, an `/accept-invite` page, and `express-rate-limit` on login.

---

### H3 · Client Admin → Staff/Supervisor (structure & process) · 🟨 **Partial**

**What passes:** the cabinets, folders, metadata schema, access grants and workflow
definitions that everyone else operates inside.

**Works:** cabinets, folders, workflow definitions.

**Broken:**
- ⛔ **Metadata fields have no UI** → no cabinet has any → the upload form captures title
  and type only → metadata search has nothing to search
- ⛔ **Cabinet access grants have no UI** → no tenant has any grants → need-to-know is not
  established
- ⛔ **Workflow definitions have no authorization** → any staff user can rewrite the
  process the admin designed
- 🟥 **Retention policy is mock** → nothing ever expires
- ⚠️ **`folderId` isn't validated against `cabinetId`** → the folder tree can cross cabinets

---

### H4 · Staff → Supervisor (routing for approval) · ✅ **FIXED 2026-09-04**

**What passes:** a filed document enters a workflow; a task appears in the supervisor's
queue with a deadline.

**This is the most important handoff in the product, and it now works.**

```
Chika routes from /staff/cabinets
  → useStartWorkflowInstance()
  → workflowInstancesService.createAndStart(workflowId, documentId)
  → 1. POST /workflow-instances        { documentId, workflowDefinitionId }
    2. POST /workflow-instances/:id/start
  → ✅ instance created, first stage computed, task assigned
```

*Previously:* the UI posted to a single-segment `POST /workflow-instances/start` that
matched no backend route and 404'd. Everything downstream was already real and working —
instance creation, stage computation, SLA deadlines, task creation with role-pool support,
history writes — so the approval half of the product was complete and unreachable because
of one wrong URL. It was the highest impact-to-effort fix in either codebase.

**⚠️ Two problems this fix did not solve, and one it made worse:**

1. ⛔ The supervisor is **still never notified** (DRIFT-10) — the task lands silently.
2. ⛔ **No authorization is checked** (DRIFT-05) on any of the 25 workflow routes.
3. 🔴 That authorization hole is now **reachable from the UI** rather than merely present
   in the API. Fixing the routing raised the priority of fixing the permissions.

**Still missing:** a workflow picker on `/doc/[id]`. Routing works from the cabinets
screen only, so the natural place a user would look for it does not offer it.

---

### H5 · Supervisor → Staff (reassignment & rejection) · 🟨 **Partial**

**What passes:** work returns downward — rejected, changes requested, or reassigned to a
different person.

**Works:** `PATCH /tasks/:id/reassign` gated by `TASK_REASSIGN_ROLES`;
`POST /tasks/:id/action` with `reject` / `request_changes`; both write history.

**Broken:**
- ⛔ **No notification** to the person receiving the work back — they discover it by
  chance. The notifications module now exists and the UI is wired to it, but
  `tasks.service` never calls `notifyUser`, so nothing is delivered (DRIFT-10).
- ⛔ **No delegation UI**, so a supervisor on leave cannot hand over at all
- ⛔ **No `audit_entries`** — workflow history is a different table with a different
  purpose and no hash chain

---

### H6 · Staff + Supervisor → Management (aggregate reporting) · 🟨 **Partial**

**What passes:** operational activity becomes executive-level numbers.

**Works:** the numbers are real — derived from actual documents, tasks and instances, with
correct department attribution through the cabinet→department hop.

**Broken:**
- 🔴 **Computed entirely in the browser.** Up to 150 sequential requests per dashboard.
- ⛔ **SLA compliance is recomputed client-side** and ignores the `SlaBreach` table that
  already holds the answer.
- ⛔ **No aggregation endpoints exist** on the backend.

---

### H7 · Every role → Internal Auditor (the audit trail) · ⛔ **COMPLETELY BROKEN**

**What should pass:** every create, update, delete, view, download, approval and permission
change, as an immutable hash-chained entry.

**What actually passes: nothing. Not one event, ever.**

```
Chika uploads a document      → ⛔ no entry  ("document.uploaded" defined, unused)
Chika views a document        → ⛔ no entry  ("document.viewed"   defined, unused)
David approves                → ⛔ no entry  ("workflow.approved" defined, unused)
Bola changes a permission     → ⛔ no entry
Anyone logs in                → ⛔ no entry  ("user.login"        defined, unused)
Anyone downloads              → ⛔ no endpoint to log
```

The `audit_entries` table, its hash chain, its indexes and its 25 documented action types
all exist. `src/middlewares/audit.middleware.ts` is a **0-byte file**. There are **zero**
references to `auditEntry` in the entire backend `src/`.

**This is the handoff that determines whether the product can be sold as a compliance
system.** It is currently a mock on both sides of the seam.

---

## Cross-role data dependencies

Which roles depend on which others' work, and what happens when the upstream role hasn't
acted yet.

| Depends on | Provided by | If missing… |
|---|---|---|
| Department assignment | `client_admin` | Staff and supervisors silently collapse from `department` to `own` scope |
| Cabinets | `client_admin` | Staff have nowhere to file; upload is impossible |
| Folders | `client_admin` | Documents pile into a flat cabinet |
| Metadata fields | `client_admin` (⛔ no UI) | Documents captured with title and type only |
| Cabinet access grants | `client_admin` (⛔ no UI) | Need-to-know is not enforced (⚠️ and reads don't check it anyway) |
| Published workflows | `client_admin` | Staff cannot route; supervisors get no tasks |
| Filed documents | `staff` | Supervisors have nothing to approve; management has nothing to report |
| Approval decisions | `supervisor` | Documents never close; management sees permanent backlog |
| Task activity | `staff` + `supervisor` | Management dashboards are empty |
| Audit entries | ⛔ **nobody** | The auditor has nothing to audit |
| Findings | `internal_auditor` (🟥 mock) | `/management/findings` just re-exports the auditor's screen, so both roles see the same `SEED` fixtures |

**Read the table bottom-up and the shape of the product becomes clear:** the operational
layer (staff → supervisor → management) is largely wired; the governance layer
(auditor ← everyone) is not wired at all.

---

## Multi-role users

A user may hold several roles simultaneously (`UserRole` is a many-to-many join). Two
different resolution rules apply, and they disagree.

### At the API — most permissive wins

`role.middleware.ts` scans **all** the user's permissions for the requested
`resource:action:` prefix and picks the highest-ranked scope:

```ts
const SCOPE_RANK = { global: 2, department: 1, own: 0 };
```

A user who is both `staff` (`document:view:department`) and `management`
(`document:view:global`) gets **global**. Correct and predictable.

### In the UI — a single primary role wins

`useNavigation.ts` picks exactly one role by a fixed priority list:

```ts
['schulltech_admin', 'client_admin', 'management',
 'internal_auditor', 'supervisor', 'staff']
```

That single role determines the **entire sidebar** and the **post-login landing page**.

### The consequence

| Roles held | API sees | UI shows | Problem |
|---|---|---|---|
| `supervisor` + `internal_auditor` | Both sets of rights | **Audit & Compliance only** | Their supervisor duties are invisible — no approvals queue in the nav |
| `staff` + `supervisor` | Both | **Supervisor Console only** | No Upload link in the sidebar, though upload works if they navigate directly |
| `management` + `client_admin` | Both | **Client Administration only** | No management dashboards in the nav |

**There is no role switcher.** A dual-role user simply cannot reach half their
functionality through navigation.

**Recommended fix:** a role switcher in the Topbar that lets the user choose which surface
to view, defaulting to the priority-list winner. This is a small, high-value UI addition —
and it becomes necessary the moment any real organisation assigns a combined role, which
they will.

---

## What each role would notice first

If each persona sat down with the product today, in order, this is the first thing that
would stop them:

| Role | First blocker | Time to hit it |
|---|---|---|
| **Staff** | "Route for approval" 404s | ~5 minutes |
| **Supervisor** | Nothing arrives in the queue, because staff can't route | ~1 minute |
| **Management** | Findings show fabricated data; SLA numbers don't reconcile | ~3 minutes |
| **Auditor** | The audit trail is obviously fabricated | ~30 seconds |
| **Client Admin** | Cannot grant cabinet access to anyone | ~10 minutes |
| **Platform Admin** | Every button they press does nothing | ~1 minute |

Fixing **H4** (the two-call routing sequence, one hour of work) unblocks the first two
rows — which between them are the entire operational core of the product.
