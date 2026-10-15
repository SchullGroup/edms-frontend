# 03 — Onboarding Flow, End to End (All Roles)

**Status:** Written 2026-08-29 against the current code.

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
> Phases 1, 4, 6, 8, 9, 10, the critical path and the runbook were corrected in place in
> this pass.

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



This document follows a **single organisation from nothing to fully operational**, in
sequence, across all six roles. It answers the question *"what has to happen, in what
order, before a Staff Officer can file their first document and have it approved?"*

Doc 04 covers each role's individual onboarding in isolation and the handoffs between
them. **This document is the chain.** Read this one first.

Every step names:
- **Who** performs it
- **Which screen** they use
- **Which API calls** fire (or would fire)
- **What must already exist** for it to work
- **What is blocked today** ⛔ and why

---

## Table of contents

- [The dependency chain at a glance](#the-dependency-chain-at-a-glance)
- [Phase 0 — Platform provisioning (SchullTech)](#phase-0--platform-provisioning-schulltech)
- [Phase 1 — System bootstrap (engineering)](#phase-1--system-bootstrap-engineering)
- [Phase 2 — Organisation structure (Client Admin)](#phase-2--organisation-structure-client-admin)
- [Phase 3 — Filing architecture (Client Admin)](#phase-3--filing-architecture-client-admin)
- [Phase 4 — Access model (Client Admin)](#phase-4--access-model-client-admin)
- [Phase 5 — People (Client Admin)](#phase-5--people-client-admin)
- [Phase 6 — Process design (Client Admin)](#phase-6--process-design-client-admin)
- [Phase 7 — First login (every role)](#phase-7--first-login-every-role)
- [Phase 8 — First document, end to end](#phase-8--first-document-end-to-end)
- [Phase 9 — Steady-state operation](#phase-9--steady-state-operation)
- [Phase 10 — Governance layer activates](#phase-10--governance-layer-activates)
- [The critical path, and where it breaks today](#the-critical-path-and-where-it-breaks-today)
- [Day-one runbook for a real tenant](#day-one-runbook-for-a-real-tenant)

---

## The dependency chain at a glance

Nothing in this chain can be reordered. Each phase produces the input the next one needs.

```
PHASE 0   Platform Admin (Adaeze)  ·  🟥 MOCK
          Provision tenant → database → plan → first client_admin account
          ─────────────────────────────────────────────────────────────────
                                    │  produces: an empty tenant + one admin login
                                    ▼
PHASE 1   Engineering  ·  ✅ REAL (CLI, not UI)
          prisma migrate deploy → seed roles, permissions, role_permissions
          ─────────────────────────────────────────────────────────────────
                                    │  produces: 6 roles, 73 permissions, 212 grants
                                    ▼
PHASE 2   Client Admin (Bola)  ·  ✅ REAL
          Create the department tree
          ─────────────────────────────────────────────────────────────────
                                    │  produces: departments  ──┐
                                    ▼                            │ needed by cabinets
PHASE 3   Client Admin  ·  ✅ REAL (incl. metadata designer)     │ AND by users
          Create cabinets → assign to departments → build folders│
          ─────────────────────────────────────────────────────────────────
                                    │  produces: cabinets, folders
                                    ▼
PHASE 4   Client Admin  ·  🟨 UI exists; not enforced on document reads
          Grant cabinet access to roles and users
          ─────────────────────────────────────────────────────────────────
                                    │  produces: CabinetAccess grants
                                    ▼
PHASE 5   Client Admin  ·  🟨 PARTIAL (no login rate limit)
          Create users → assign department → assign roles
          ─────────────────────────────────────────────────────────────────
                                    │  produces: user accounts
                                    ▼
PHASE 6   Client Admin  ·  ✅ REAL (authorized since 09-04)
          Design workflow definitions → publish
          ─────────────────────────────────────────────────────────────────
                                    │  produces: published workflows
                                    ▼
PHASE 7   Every role  ·  ✅ REAL (test accounts fixed — DRIFT-12)
          First login → JWT → role-based landing page
          ─────────────────────────────────────────────────────────────────
                                    │
                                    ▼
PHASE 8   Staff → Supervisor → (Management/Auditor observe)
          Upload ✅ → OCR ✅ → Route ⛔ non-admins (DRIFT-14) → Approve ✅ → Close ✅
          ─────────────────────────────────────────────────────────────────
                                    │
                                    ▼
PHASE 9   Steady state: search ✅ · notifications 🟨 (emitted, not clicked through)
                        · SLA ✅ (detects and notifies)
                                    │
                                    ▼
PHASE 10  Governance: audit ✅ · findings 🟥 · reporting ✅
```

*Statuses re-checked 2026-10-15 — see the critical path at the end for what changed.*

---

## Phase 0 — Platform provisioning (SchullTech)

**Actor:** Adaeze — `schulltech_admin`
**Screen:** `/platform`
**Status:** 🟥 **Entirely mock**

### What should happen

| # | Step | Intended API | Reality |
|---|---|---|---|
| 0.1 | Create the tenant record (name, subdomain, plan) | `POST /platform/tenants` | ⛔ No control-plane DB, no endpoint. `addTenant()` writes to `SEED.tenants` in localStorage. |
| 0.2 | Provision an isolated PostgreSQL database | automated | ⛔ Backend is single-tenant. One DB, no `tenant_id` columns, no tenant resolution. |
| 0.3 | Run migrations against the new database | automated | ⛔ Manual only (Phase 1). |
| 0.4 | Assign a commercial plan and entitlements | `POST /platform/plans` | ⛔ Mock. No plan model, no enforcement anywhere. |
| 0.5 | Create the tenant's first `client_admin` | `POST /users` on the tenant DB | ⛔ Done by the seed script today. |
| 0.6 | Send the admin their credentials | email | 🟨 A mail transport exists now (`src/config/mailer.ts`, via a shared mailing Lambda), and user invitations use it, but nothing provisions a tenant to send for. *(Was: "No mail transport exists in the backend" — re-checked 2026-10-15.)* |

### Why it is mock, and why that is defensible

This is **deliberate sequencing, not neglect.** `edms-backend/docs/edms_architecture.md`
§1 states the target explicitly: *"True Silo"* — one isolated PostgreSQL instance per
tenant, with the database itself as the tenant boundary and **no `tenant_id` columns
anywhere**. §2 quantifies the migration:

> 1. Write a `resolveTenant` middleware that resolves the right `PrismaClient` per
>    subdomain and sets it on `req.db`
> 2. Update the augmented Request type
> 3. Update every controller to pass `req.db` instead of the imported singleton
>
> *"Services and repositories stay exactly as written. Schema stays exactly as designed."*

That claim is **verifiably true in the code.** A sweep of `src/` confirms `db` is imported
only in controllers, middlewares and workers — never in a service or repository. Every
service and repository method takes `db` as its first parameter. The discipline required
to make multi-tenancy a one-line-per-controller change has actually been maintained.

§6 records that a teammate previously built tenant-resolution infrastructure before it was
needed, and that it was **removed** rather than carried as dead weight.

**Implication for onboarding:** today a "tenant" is the entire database. Phase 0 is a
manual engineering task, and the `/platform` portal is a design prototype for Phase 2.

---

## Phase 1 — System bootstrap (engineering)

**Actor:** a developer or CI job
**Interface:** CLI
**Status:** ✅ **Real and working**

This is the only phase that touches roles and permissions, and it is not exposed in any UI
by design — system roles are `isSystemRole: true` and are not tenant-editable.

```bash
cd edms-backend

npx prisma generate          # ⚠️ REQUIRED. See the warning below.
npx prisma migrate deploy    # 32 migrations (2026-10-15)
npm run seed:system          # roles, permissions, role_permissions
npm run db:bootstrap         # pgcrypto extension + seed:system in one shot
npx prisma db seed           # optional: demo users, cabinets, documents
```

### What `seed:system` creates

**6 system roles** (`prisma/seed-system.ts`):

*Re-counted 2026-10-15 from `prisma/seed-system.ts` and
`src/shared/constants/permissions.constants.ts` on `edms-backend` `dev` (`9998e05`). The
previous table (45 / 18 / 14 / 10 / 10 / 3 grants, 45 permissions, 100 grants) described
the seed before the 2026-09-16 RBAC refactor.*

| Role | Grants | Character |
|---|---|---|
| `client_admin` | 72 | Full tenant control — 71 `global`, 1 `own` |
| `supervisor` | 40 | Department oversight + approval — 34 `department`; reassigns tasks, publishes circulars |
| `staff` | 29 | Mixed `own` (16) / `department` (9) scope |
| `management` | 27 | `global` read, plus own-scope routing, task action, delegation, and circular publishing |
| `internal_auditor` | 26 | `global` read + `audit:view/export`; own-scope routing, task action and delegation |
| `schulltech_admin` | 18 | Workflow definitions, instances, tasks, delegation, audit — **no `document:*` grant** |

Only `client_admin` and `schulltech_admin` hold `workflow:view` — the cause of DRIFT-14.

**73 permissions** across 20 resources: `document`, `document_version`, `document_lock`,
`document_metadata`, `document_comment`, `document_signature`, `document_access_request`,
`cabinet`, `cabinet_metadata_field`, `cabinet_access`, `folder`, `department`, `user`,
`role`, `workflow`, `workflow_instance`, `task`, `delegation`, `audit`, `circular`.

**212 role-permission grants**, each carrying a scope of `global | department | own`.

### The scope model — the thing to understand before anything else

A permission is not a boolean. It is a **triple**: `resource:action:scope`.

```
staff  → document:view:department     "see documents filed in my department's cabinets"
staff  → document:create:own          "create documents, which I will then own"
mgmt   → document:view:global         "see every document in the tenant"
```

At request time `requirePermission('document','view')` scans the user's permission list for
the prefix `document:view:` and picks the **most permissive** scope across all their roles
(`global > department > own`). It stores the winner on `req.permissionScope`, and the
repository layer turns that into a SQL `WHERE` clause:

```ts
// documents.repository.ts — applyAccessScope
own        → where.createdBy = access.userId
department → where.cabinet = { is: { departmentId: access.departmentId } }
global     → no additional restriction
// A 'department' scope on a user with no department falls back to 'own' — fail closed.
```

> ### ⚠️ Run `npx prisma generate` first, every time
>
> The checked-in generated Prisma client predates the `add_scope_to_role_permission`
> migration. Without regenerating:
> - `npm run build` **fails** (`auth.middleware.ts:56` — `Property 'scope' does not exist`)
> - `npm run dev` **succeeds** (tsx skips typechecking) but `rp.scope` is `undefined`
> - Every permission becomes `"document:view:undefined"`
> - `requirePermission` still matches on the prefix and sets `permissionScope = 'undefined'`
> - `applyAccessScope` treats that as the `department` branch
>
> **Result: every user is silently narrowed to department scope**, including `management`
> and `internal_auditor` who are supposed to see the whole tenant. This presents as
> "management can't see all documents" and is very hard to trace back to a stale client.

### ✅ Seeded demo accounts vs. the login screen (DRIFT-12, resolved)

`prisma/seed.ts` creates seven demo users, **all with password `Fixture123!`**:

| Email | Role | Department |
|---|---|---|
| `tjoel+staff_finance@schulltech.com` | `staff` | Finance |
| `tjoel+staff_hr@schulltech.com` | `staff` | HR |
| `tjoel+supervisor_finance@schulltech.com` | `supervisor` | Finance |
| `tjoel+management_ops@schulltech.com` | `management` | Executive |
| `tjoel+clientadmin@schulltech.com` | `client_admin` | IT |
| `tjoel+schulltechadmin@schulltech.com` | `schulltech_admin` | — |
| `tjoel+auditor@schulltech.com` | `internal_auditor` | Compliance |

The login screen (`src/app/page.tsx`) offers seven autofill buttons in dev builds, one per
account above (hidden when the brand preset turns `loginTestAccounts` off, as
galaxybackbone does). **Verified live 2026-10-14:** all seven sign in.

*Was:* twelve buttons across two sets — `chika@firstatlantic.com` etc. (fixture personas
from `initialData.ts`) and `boyebamiji+staff@schulltech.com` etc. — none of which existed in
the backend, so every one failed. Fixed in code by 2026-09-15; this section went stale until
2026-10-14.

---

## Phase 2 — Organisation structure (Client Admin)

**Actor:** Bola — `client_admin`
**Screen:** `/management/departments`
**Status:** ✅ **Real**

### Why this is first

Departments are the spine of the access model. Until they exist:
- Users cannot be placed, so `department`-scoped permissions have nothing to resolve
  against and fail closed to `own`
- Cabinets cannot be attached to a department, so document scoping cannot work
- Every management report groups by department and would show one "Unassigned" bucket

### Steps

| # | Action | API | Notes |
|---|---|---|---|
| 2.1 | Create top-level departments | `POST /departments` `{name}` | Finance, Operations, HR, Legal, IT, Compliance |
| 2.2 | Create sub-departments | `POST /departments` `{name, parentId}` | Self-referencing hierarchy, **one level deep only since edms-backend PR #51 (live 2026-10-14)**: a parent must itself be top-level, and a department with children can't be re-parented — 422 `DEPARTMENT_DEPTH`. Before PR #51 the API accepted arbitrary depth while the UI offered one |
| 2.3 | Verify the tree | `GET /departments` | Returns top-level nodes with nested `children` |

### Gotchas

- ⚠️ `GET /departments` is capped at `take: 200` with **no pagination**. An organisation
  with more than 200 departments silently truncates.
- ⚠️ **No cycle detection.** Setting a department's `parentId` to one of its own
  descendants creates a loop that will hang the recursive flatten in
  `buildDepartmentIndex()`.
- The frontend flattens the tree correctly (`managementAggregation.ts` `buildDepartmentIndex`).

---

## Phase 3 — Filing architecture (Client Admin)

**Actor:** Bola
**Screen:** `/admin/cabinets` (Cabinet Designer); folder trees on `/staff/cabinets`
**Status:** ✅ **Real** for cabinets, metadata fields and access grants · 🟨 folder trees moved to
`/staff/cabinets` 2026-10-06 (not yet verified live). *This header said "⛔ No UI for metadata
fields" until 2026-10-06 — stale since the field editor shipped (2026-09-18).*

### Steps

| # | Action | API | Status |
|---|---|---|---|
| 3.1 | Create a cabinet | `POST /cabinets` `{name, description, departmentId, retentionPolicyId?}` | ✅ |
| 3.2 | Attach to a department | same payload | ✅ — **this is what makes department-scoped document access work** |
| 3.3 | Delegate the cabinet: grant its manager (role or user) `upload` / `edit` / `delete` | `POST /cabinets/:id/access` | ✅ Access card |
| 3.4 | Define custom metadata fields | `POST /cabinets/:id/metadata-fields` | ✅ Metadata schema card (*was "⛔ backend only", stale — corrected 2026-10-06*) |
| 3.5 | Build the folder tree — normally the cabinet's manager, on `/staff/cabinets` | `POST /cabinets/:cabinetId/folders` `{name, parentId?}` | ✅ needs `folder:create` **and** `upload` on the cabinet; sub-folders confirmed in testing 2026-10-08 |
| 3.6 | Attach a retention policy | — | ⛔ no endpoint, no UI, no enforcement job |

### The metadata gap in practice

The backend supports a genuinely capable per-cabinet metadata schema:

```
CabinetMetadataField
  name          "Invoice Number"
  fieldType     text | number | date | select | boolean
  isRequired    true
  options       ["NGN","USD","GBP"]   (select only)
  displayOrder  1
```

Values are type-validated and normalised on write (`normalizeMetadataValue` coerces
numbers, parses dates to ISO, validates select options against the allowlist, enforces
required fields). It is well built.

> *Superseded 2026-09-18:* the Cabinet Designer (and, since 2026-10-06, the Cabinets page
> for a cabinet's manager) now has a metadata-schema editor. The consequences below describe
> a tenant where nobody has defined fields yet.

**Until someone defines fields, a cabinet has none.** Consequences:
- No cabinet has metadata fields, so `GET /documents/:id/metadata` returns `[]` for
  everything
- The upload form has no fields to render, so documents are filed with title and type only
- Metadata-based search (`document_metadata` is indexed on `(fieldId, value)`) has nothing
  to search

**Recommendation:** this is a high-leverage, low-risk build. The backend is done; it needs
a designer panel in the Cabinet screen and a dynamic field renderer in the upload form.

### ⚠️ The cabinet/folder integrity gap

The backend **never validates that a document's `folderId` belongs to its `cabinetId`** —
not on upload, not on update. A document in Cabinet A can be filed into a folder in
Cabinet B, which quietly crosses the boundary the entire access model depends on. Worth
fixing before the folder tree gets deep.

---

## Phase 4 — Access model (Client Admin)

**Actor:** Bola
**Screen:** `/admin/cabinets` → access panel (and, for delegated managers, `/staff/cabinets`)
**Status:** 🟨 **UI exists; enforced on cabinet and folder reads, not on document reads**
*(re-checked 2026-10-15 against `edms-backend` `dev` `9998e05`. Was ⛔ "Backend complete, no
UI, and not enforced on reads" — the grant editor shipped with `feature/management` on
2026-09-04, and Phase 3 above already said so.)*

This is the phase where need-to-know is supposed to be established. It was the largest
structural hole in the onboarding chain; half of it is now closed.

### What the backend offers

`CabinetAccess` grants a **permission level** on a **cabinet** to either a **role** or an
**individual user**:

```
view (1) < upload (2) < edit (3) < route (4) < export (5) < delete (6)
```

A user's effective level on a cabinet is the **maximum** across all grants that match their
user ID or any of their role IDs. `client_admin` bypasses the check entirely
(`CABINET_ACCESS_BYPASS_ROLES`).

Endpoints: `GET /cabinets/:id/access`, `POST /cabinets/:id/access`,
`DELETE /cabinets/:id/access/:grantId` — all working, all permission-gated.

### ~~Two problems~~ — one fixed, one half-fixed

**1. ~~No screen can create a grant.~~** Fixed: `/admin/cabinets` has an access panel that
lists, grants and revokes (live endpoints). Delegated managers can grant from
`/staff/cabinets` (built 2026-10-06, tested by the user 2026-10-08).

**2. Grants are checked on cabinet and folder reads, but not document reads.** Re-checked
2026-10-15: `GET /cabinets/:id`, `GET /cabinets/:id/access`, `GET /folders` and
`GET /folders/:id` run `requireCabinetAccess('view')`, and `GET /cabinets` filters the list
by grant in `cabinets.repository.ts#buildCabinetWhere`. No `GET /documents…` route checks a
cabinet grant. The table below is the original 2026-08-29 one, with the cabinet rows
corrected:

| Route | Cabinet grant checked? |
|---|---|
| `POST /documents` | ✅ `upload` |
| `PATCH /documents/:id` | ✅ `edit` |
| `DELETE /documents/:id` | ✅ `delete` |
| `POST /documents/:id/versions` | ✅ `upload` |
| `POST /documents/:id/checkout` `/checkin` | ✅ `edit` |
| **`GET /documents`** | ❌ |
| **`GET /documents/:id`** | ❌ |
| **`GET /documents/search`** | ❌ |
| `GET /cabinets` | ✅ filtered by grant (repository) — *was ❌* |
| `GET /cabinets/:id` | ✅ `view` — *was ❌* |

So a user with `document:view:global` still reads **every document** regardless of cabinet
grants, though they now only *see* the cabinets they're entitled to. Organisation-wide
cabinets (no department) stay visible to everyone, by design.

*Superseded:* "The moment the read paths are fixed **without** first building the grant
UI, every non-admin user loses access to everything. These two fixes must ship together."
The grant UI shipped first, so this risk no longer applies to the remaining document-read
fix.

---

## Phase 5 — People (Client Admin)

**Actor:** Bola
**Screen:** `/admin/users` (423 lines, fully wired)
**Status:** 🟨 **Works; emailed invitations since 2026-09-18, no login rate limit** *(corrected 2026-10-13: this said there was no invite flow)*

### Steps

| # | Action | API | Status |
|---|---|---|---|
| 5.1 | Invite the user | `POST /users` `{email, name, departmentId, roleIds}` (no password) | ✅ emails a set-password link; the user is `pending` until they use it, then `active` (PR #49). Department and roles validated; `schulltech_admin` can't be given |
| 5.2 | Assign additional roles | `POST /users/:id/roles` `{roleIds}` | ✅ |
| 5.3 | Remove a role | `DELETE /users/:id/roles/:roleId` | ✅ |
| 5.4 | Deactivate | `PATCH /users/:id` `{status:'inactive'}` | ✅ — login then returns 403 `ACCOUNT_INACTIVE` |
| 5.5 | Resend an invitation | `POST /users/:id/invitation` | ✅ pending or active users; "Resend invite" on `/admin/users` |
| 5.6 | Force password change on first login | — | Moot: invited users choose their own |
| 5.7 | Self-service password reset | `POST /auth/forgot-password` → `/set-password` | ✅ |

### The credential-handling problem

Today the only way to onboard a person is: **the admin types their password and tells them
what it is.** That is a genuine security defect, not a missing nicety:

- The admin knows every user's password
- There is no forced rotation, so it stays known
- No complexity policy beyond a Zod minimum length
- No account lockout and **no rate limiting on `POST /auth/login`** — unlimited guessing
- No mail transport exists anywhere in the backend, so nothing can be sent

The schema already anticipates the fix: `User.passwordHash` is **nullable**, commented
*"null when SSO is active (Phase 4)"*.

**Minimum viable fix:** `POST /users/invite` issuing a signed, expiring token (Redis is
already a dependency), an email transport, a `/accept-invite` page, and rate limiting on
login.

### Multi-role users

A user may hold several roles. Two things follow:

1. **At the API**, the most permissive scope wins per permission (`SCOPE_RANK` in
   `role.middleware.ts`).
2. **In the UI**, a single "primary role" is chosen by a fixed priority list in
   `useNavigation.ts`:
   `schulltech_admin > client_admin > management > internal_auditor > supervisor > staff`.
   That role alone determines the sidebar and the post-login landing page.

So a user who is both `supervisor` and `internal_auditor` lands on `/auditor` with the
**Audit & Compliance** sidebar. Since 2026-10-08 the Topbar's portal label becomes a switcher
for such users, so they can move to the Supervisor Console (see doc 04, Multi-role users).

---

## Phase 6 — Process design (Client Admin)

**Actor:** Bola
**Screen:** `/admin/workflows` (Workflow Designer, 493 lines)
**Status:** ✅ **Works, and is authorized** *(was 🟨 "with no authorization whatsoever" —
fixed 2026-09-04, DRIFT-05; re-checked 2026-10-15)*

### Steps

| # | Action | API | Status |
|---|---|---|---|
| 6.1 | Create a draft definition | `POST /workflows` | ✅ |
| 6.2 | Define stages, SLA hours, assignees | in the `definition` JSON | ✅ |
| 6.3 | Edit while draft | `PATCH /workflows/:id` | ✅ |
| 6.4 | Publish | `POST /workflows/:id/publish` | ✅ sets `publishedAt`, `status='published'` |
| 6.5 | Archive an old version | `POST /workflows/:id/archive` | ✅ |

### The definition shape

```jsonc
{
  "stages": [
    { "id": "review",   "name": "Records Review",
      "assignedRole": "records_officer", "slaHours": 24,
      "actions": ["approve","reject","request_changes"] },
    { "id": "approve",  "name": "Supervisor Approval",
      "assignedRole": "supervisor",      "slaHours": 48,
      "actions": ["approve","reject"] }
  ],
  "transitions": [ { "from": "review", "on": "approve", "to": "approve" } ]
}
```

~~Phase 1 is **sequential only** — no parallel branches, no conditional routing.~~
*(2026-10-15: conditional routing exists. Backend conditional routing merged 2026-10-06:
a transition can carry condition rules on `urgency`, `confidentiality` or a cabinet
`metadata` field, combined with `all`/`any` (`WORKFLOW_CONDITION_*` in
`workflow.constants.ts`). The designer has edited branches since 2026-09-29
(`BranchEditorCard`). Since 2026-10-13 a stage can also be assigned to a department alone.
Parallel branches still don't exist.)*

### ✅ ~~The critical defect~~ — resolved 2026-09-04 (DRIFT-05), kept for history

**Re-checked 2026-10-15:** `workflows.router.ts` now has **40 `requirePermission` calls
across its 39 routes** (`workflow:view` / `create` / `edit` / `publish` / `archive` on the
definition routes), and the workflow services assert roles as well. Everything below
described the code on 2026-08-29.

~~`workflows.router.ts` contains **zero `requirePermission` calls across all 23 routes.**~~
Tasks, delegations and history compensate with in-service role checks. **Definitions and
instances do not** — `definitions.service.ts` and `instances.service.ts` never read
`actor.roles`.

Consequence: **any authenticated user — including a brand-new `staff` account — can create,
edit, publish and archive workflow definitions, and can start, hold, resume and close any
workflow instance in the tenant.**

The `workflow:view / create / edit / publish / archive / route` permissions **are seeded**
and are never consulted. The frontend gates `/admin/workflows` to `client_admin`, but that
is a client-side `useEffect` (DRIFT-02) — anyone can call the API directly.

~~**This is the single highest-severity finding across both codebases.** It should be fixed
before any pilot, and it is a small change: add `requirePermission('workflow', …)` to the
23 routes and role checks to the two services.~~ Done — see the re-check above.

**What still blocks this phase's output from being used:** DRIFT-14. The definitions Bola
publishes here can be listed only by `client_admin` and `schulltech_admin`, because the
seed grants `workflow:view` to no other role, so staff and supervisors can't route into them
(Phase 8).

---

## Phase 7 — First login (every role)

**Status:** ✅ **Real** (except the test-account emails)

### The sequence

```
1. Browser: user submits email + password at `/`
2. axios → POST /api/auth/login           (same-origin, Next.js route handler)
3. Route handler → fetch POST ${API_URL}/api/v1/auth/login   (server-to-server)
4. Express AuthService.login:
     • findForLogin(db, email)        → 401 INVALID_CREDENTIALS if absent
     • bcrypt.compare                 → 401 INVALID_CREDENTIALS if wrong
     • user.status !== 'active'       → 403 ACCOUNT_INACTIVE
     • sign accessToken  (JWT_SECRET,        15m)
     • sign refreshToken (JWT_REFRESH_SECRET, 7d)
     • updateLastLogin (fire-and-forget; failures swallowed)
     ← { user:{id,email,name,status,roles}, accessToken, refreshToken }
5. Route handler strips refreshToken → HttpOnly cookie (7d, sameSite lax)
                  returns the rest to the browser
6. Browser: Cookies.set('accessToken')   ← js-cookie, readable by JS
            useStore.setCurrentUser(user) ← persisted to localStorage
7. LoginPage useEffect redirects by role
```

### Landing pages

| Role | Lands on | Sidebar (`useNavigation.ts`) |
|---|---|---|
| `staff` | `/staff` | Staff Workspace |
| `supervisor` | `/supervisor` | Supervisor Console |
| `management` | `/management` | Management Portal |
| `client_admin` | `/admin` | Client Administration |
| `internal_auditor` | `/auditor` | Audit & Compliance |
| `schulltech_admin` | `/platform` | SchullTech Platform Admin |

### What happens on every subsequent page load

`AppShell` runs three effects in order:

1. **Wait for Zustand rehydration** (`persist.onFinishHydration`) — renders `null` until
   then, which correctly prevents a flash of the wrong portal or a spurious redirect.
2. **Route guard** — walks `routeConfig` for the first matching rule
   (`exact` / `prefix` / `whitelist`), compares `currentUser.roles`, and
   `router.replace('/unauthorized')` on failure.
3. **Session verification** — calls `authService.me()` in the background; on failure
   clears `currentUser` and pushes to `/`.

> ✅ **Resolved (2026-09-21).** This route guard used to be purely cosmetic — no
> `middleware.ts` in the project, just a client-side `useEffect` reading a
> localStorage-persisted role array, so editing `edms-state-v3` to claim
> `schulltech_admin` unlocked every portal. `src/proxy.ts` (Next.js 16 renamed
> `middleware.ts` to `proxy.ts`) now resolves real roles/permissions from
> `GET /auth/me` server-side on every protected navigation, before the page is
> served — editing `localStorage` no longer has any effect on what the server
> sends back. The client-side guard above is now a same-tick UX nicety, not the
> control. See DRIFT-02 (resolved) in doc 01 §4.

---

## Phase 8 — First document, end to end

This is the moment of truth: the chain that proves the system works. Here is exactly where
it succeeds and where it stops.

> **Re-checked 2026-10-15** against `edms-backend` `dev` (`9998e05`) and this repo. The
> diagram below was written 2026-08-29 and patched once on 2026-09-04. Superseded lines
> are now marked `~~` with the current state beside them. In short: the upload goes through
> the chunked presigned uploader (since 2026-08-31, doc 01 §5); OCR works (DRIFT-06's
> "wrong bucket" claim was retracted 2026-09-21); search indexes at create (PR #51); every
> step is authorized (DRIFT-05); notifications fire (DRIFT-10); and audit entries are
> written for upload, view, download, task actions (approve, reject, request changes, review) and the workflow lifecycle (DRIFT-11).

```
┌─ STEP 1 · Chika (staff) uploads ──────────────────────────────── ✅ WORKS ──┐
│ /upload                                                                     │
│   • drag file → filing card (title, type, cabinet, folder, metadata)        │
│     ⚠️ was an "IDU" card with a hardcoded classification — removed 2026-10-14│
│   • calculateChecksum()          SHA-256 via crypto.subtle                  │
│   • ~~uploadFile() → third-party API Gateway, base64, 2 MB cap~~            │
│     useMultipartUploader() → chunked presigned multipart upload to S3       │
│     (uploader.ts, since 2026-08-31 — see doc 01 §5)                         │
│   • POST /api/v1/documents { title, cabinetId, folderId, confidentiality,   │
│                              urgency, fileUrl, mimeType, fileSize, checksum}│
│   Backend: requirePermission('document','create')                           │
│            validate(UploadDocumentInputSchema)                              │
│            requireCabinetAccess('upload')     ← the one read/write gate     │
│            generateDocumentReference() → DOC-20260829-142317                │
│            createDocumentWithFirstVersion()   ← one transaction             │
│            ocrQueue.add('ocr', {documentId, versionId})                     │
│            searchIndexQueue.add()  ← at create, since PR #51 (2026-10-14)   │
│   ✅ Audit entry `document.uploaded` is written (was: "defined and unused") │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 2 · OCR worker ───────── ✅ WORKS (was ⛔ FAILS — retracted 2026-09-21) ┐
│ ✅ Live-verified 2026-09-21: OCR succeeds on real uploads; every fileUrl     │
│    resolves to env.S3_BUCKET; Textract runs asynchronously, so multi-page    │
│    documents work. Search no longer waits on OCR (indexed at create and on   │
│    OCR's final failure — PR #51). Still open (DRIFT-06): no sweep or "Retry  │
│    OCR" for a job stuck at `pending`, and no backfill for older versions.    │
│ Everything below in this box is the original, wrong, 2026-08-29 diagnosis.  │
│                                                                             │
│ ocr.workers.ts                                                              │
│   • ocrStatus = 'processing'                                                │
│   • Textract DetectDocumentText on s3://${S3_BUCKET}/${fileKey}             │
│                                                                             │
│   ⛔ THE FILE IS NOT IN THAT BUCKET. It was uploaded to a third-party        │
│      API Gateway hard-coded in s3.service.ts. Textract raises                │
│      InvalidS3ObjectException. 3 retries. ocrStatus = 'failed'.             │
│                                                                             │
│   ⛔ CONSEQUENCE: searchIndexQueue.add() is on the SUCCESS path only,        │
│      so no index job is ever enqueued and search_vector stays NULL.         │
│      The document is visible in GET /documents and invisible in             │
│      GET /documents/search — permanently.                                    │
│                                                                             │
│   ⚠️ Also: DetectDocumentText is Textract's SYNCHRONOUS API — single page   │
│      only. Multi-page PDFs need StartDocumentTextDetection regardless.      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 3 · Chika routes it to a workflow ──────────────────── ✅ FIXED 09-04 ┐
│ /staff/cabinets → useStartWorkflowInstance()                                │
│   • workflowInstancesService.createAndStart(workflowId, documentIds)        │
│     1. POST /workflow-instances { workflowDefinitionId, documents: [...] }   │
│        (since 919d0ef: documents routed together = ONE workflow)             │
│     2. POST /workflow-instances/:instanceId/start                            │
│                                                                             │
│   Was: a single-segment POST /workflow-instances/start that matched no       │
│   backend route and 404'd. Routing a document did not work from the UI at    │
│   all, which made the whole approval half of the product unreachable.        │
│                                                                             │
│   ~~STILL MISSING: a workflow picker on /doc/[id]~~ — the shared             │
│      useRouteToWorkflow picker is on /staff/cabinets, /doc/[id], /upload     │
│      and /search.                                                            │
│   🔴 DRIFT-14: the picker's GET /workflows needs workflow:view, which only   │
│      client_admin and schulltech_admin hold — so Chika sees "No published   │
│      workflows". Routing completes today only for an admin.                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 4 · Backend starts the instance ────────────────────────── ✅ WORKS ──┐
│ instances.service.start()                                                   │
│   • validates the definition is 'published'                                 │
│   • per DOCUMENT (since 919d0ef): an execution at the first stage,          │
│     stageDueAt = now + stage.slaHours; status = 'in_progress'               │
│   • creates Task(s): assigneeId or assignedRoleId (no dueAt any more)       │
│   • writes WorkflowHistory { fromStage:null, toStage:'review' }             │
│   ✅ Assignee notified (`task.assigned`) — DRIFT-10, resolved 2026-09-21     │
│   ✅ Audit entries `workflow.instance_created` / `workflow.started`          │
│   ✅ Authorized — requirePermission('workflow_instance', …) (DRIFT-05)       │
│   (All three were ⛔ when this diagram was drawn.)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 5 · David (supervisor) sees the task ─────────────────────── ✅ WORKS ┐
│ /supervisor/approvals → GET /tasks/approvals                                │
│   ✅ Resolves direct assignment AND role-pool assignment AND delegations     │
│   ✅ Prioritised by document urgency, then due date                          │
│   ✅ In-app notification (`task.assigned`); the Approvals badge counts       │
│      GET /tasks/approvals (useNavigation.ts), no longer SEED.documents      │
│   (Was ⛔ "He was never told … badge hardcoded to assignee === 'u-david'".)  │
│   Notification arrival not yet clicked through end to end.                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 6 · David approves ─────────────────────────────────────── ✅ WORKS ──┐
│ POST /tasks/:id/action { action:'approve', note:'Verified against PO' }      │
│   ✅ Authorization: task:action, plus assignee / role-pool / delegate check │
│   ✅ Task → completed; completedBy, completedAt, note recorded               │
│   ✅ Instance advances; stageDueAt recomputed for the next stage             │
│   ✅ WorkflowHistory row with fromStage, toStage, actor, note,               │
│      elapsedSeconds                                                          │
│   ✅ Final stage → instance closed → document status 'closed'                │
│   ✅ Next assignee notified (`task.assigned`); originator notified on        │
│      changes requested / rejected / closed (DRIFT-10)                        │
│   ✅ Audit entry `workflow.approved` (or `.rejected` / `.changes_requested`  │
│      / `task.reviewed`) — the router's `audit()` middleware maps each task  │
│      action — written to hash-chained audit_entries beside WorkflowHistory  │
│   (Both were ⛔ when this diagram was drawn.)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 7 · SLA monitoring, in parallel ─────────────────────────── ✅ WORKS ─┐
│ sla-breach.worker.ts, every SLA_RECONCILE_INTERVAL_MS (default 5 min)       │
│   ✅ Finds tasks within SLA_WARNING_HOURS (default 4) of dueAt              │
│   ✅ Creates SlaBreach 'warning'; if past due, 'escalation' + escalates      │
│      the task                                                                │
│   ✅ Unique (taskId, breachType) prevents duplicate alerts                   │
│   ✅ Writes WorkflowHistory                                                  │
│   ✅ Resolves breaches when the task completes                               │
│   ✅ sla.service.ts notifies: sla.warning → the assignee, sla.breach →       │
│      the supervisor role (DRIFT-10, resolved 2026-09-21). Was ⛔ "NOBODY IS  │
│      EVER TOLD".                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Summary of the first-document journey

| Step | Status |
|---|---|
*Re-checked 2026-10-15. The "Was" column is the 2026-09-04 table.*

| Step | Status | Was |
|---|---|---|
| 1. Upload and file | ✅ works | ✅ |
| 2. OCR and index | ✅ OCR works; indexed at create (PR #51). 🟨 stuck jobs aren't retried (DRIFT-06) | ⛔ always fails; unsearchable forever |
| 3. Route to workflow | 🔴 works for admins; **blocked for staff/supervisor by DRIFT-14** | ✅ fixed 2026-09 |
| 4. Instance start | ✅ works, authorized | ✅ but **unauthorized** |
| 5. Task appears | ✅ appears, assignee notified (not clicked through) | 🟨 nobody notified |
| 6. Approve / reject | ✅ works | ✅ |
| 7. SLA monitoring | ✅ detects and notifies (not clicked through) | 🟨 tells nobody |
| — audit trail | ✅ upload, view, download, task actions and workflow lifecycle recorded | ⛔ nothing recorded |

**Revised 2026-09-04.** Step 3 is fixed, so the chain now runs unbroken from upload to
closure. What remains splits cleanly in two: **one frontend/infrastructure fix** (the
upload bucket, which unblocks OCR *and* search together) and **two backend builds**
(emitting notifications, and writing audit entries). Note that the notifications *module*
is no longer a build — it exists and works; only the call sites are missing.
*(2026-10-15: all three have since landed — upload/OCR (2026-08-31 / retracted 2026-09-21),
notifications (2026-09-21), audit (confirmed 2026-09-18). The one break left in the chain
is step 3 for non-admin roles: DRIFT-14.)*

---

## Phase 9 — Steady-state operation

Once documents are flowing, this is what daily use looks like and what it costs.

*Rows re-checked 2026-10-15; the old status is kept in italics where it changed.*

| Capability | Status | Note |
|---|---|---|
| Browse cabinets and folders | ✅ | 🟨 cabinet grants enforced on cabinet list/detail and folders (code-read 2026-10-06); document list/detail/search unverified — doc 02 E2. *Was: "not enforced on reads"* |
| Open a document | ✅ | `GET /documents/:id` returns a signed `fileUrl`; download is permission-gated and audited (`document.downloaded`, 2026-10-08). *Was: "no download/preview endpoint exists"* |
| Full-text search | ✅ | indexed at create, on title/metadata change and restore (PR #51, 2026-10-14); search confirmed in the product owner's testing 2026-10-09. *Was ⛔ "index never built"* |
| Filter documents | ✅ | cabinet, folder, status, urgency, type, creator, archived |
| Check out / check in | ✅ | Overdue locks can be force-released by `document_lock:delete` holders (global, or department for the cabinet's department) — 🟨 built 2026-10-02, not yet verified e2e. Holder + supervisors notified as the due date nears/passes |
| Upload a new version | 🟨 | ✅ works, but **narrowed 2026-09-18** — only offered once the previous stage has sent the document back with "Request changes" onto the caller's current task; also blocked if someone else holds the lock (correct) |
| Restore a version | ✅ | UI shipped since this table was written — `DocumentVersionsPanel`'s "Restore" |
| Comment on a document | ✅ | optional `comment` on `POST /tasks/:id/action`, prompted by "Mark reviewed"/"Approve"/etc. and shown on the workflow trail. (A dedicated `/documents/:id/comments` endpoint exists too but is deliberately unused — see BE-16/BE-17 in `BACKEND_REQUESTS.md`.) |
| Sign a document | 🟨 | `approve` only — `signature` is required there, not offered on `review`/`reject`/etc. (BE-16 asks for that gap to close). A dedicated `/documents/:id/signatures` endpoint exists too but is deliberately unused. |
| Notifications | 🟨 | module built, wired in the UI, and emitted from task, SLA, access-request, checkout and circular events (DRIFT-10); not clicked through end to end. *Was ⛔ "module missing"* |
| Delegate while away | 🟨 | `/delegations` UI since 2026-09-04 (create, list, end); no task marker or activation notification — doc 02 C4. *Was: "no UI at all"* |
| Supervisor workload view | ✅ | reads `GET /tasks/workload` (doc 02 F1). *Was: "walks every page of `/documents` client-side"* |
| Management reports | ✅ | four real reports with CSV export, rebuilt 2026-10-08 *(confirmed by the product owner’s testing, 2026-10-09)* |
| Circulars | ✅ | backend module built; frontend wired 2026-10-05 (`/circulars`, `/circulars/manage`) *(confirmed by the product owner’s testing, 2026-10-09)* |

### ~~The performance cliff worth planning for~~ — mostly resolved (DRIFT-07)

**Re-checked 2026-10-15.** The management dashboards and the supervisor workload view now
read server aggregation endpoints (`useDocumentStats`, `useTaskStats`,
`useWorkflowInstanceStats`, `useOpenItemsByCabinet`, `GET /tasks/workload`).
`useAllTasks` and `useAllWorkflowInstances` were deleted 2026-09-21. Two `fetchAllPages`
callers remain: `/supervisor/performance`, which walks every task (`scope: 'all'`), and
`/staff/cabinets`, which lists every document in one cabinet via `useAllDocuments`. The
first is the one to watch as the tenant grows.

*Superseded (2026-08-29):* "Management and supervisor dashboards call `fetchAllPages` …
**up to 150 sequential HTTP requests to render one dashboard** … **The backend has no
aggregation, statistics or reporting endpoints of any kind**." Eight aggregation endpoints
existed by 2026-09-04 evening.

---

## Phase 10 — Governance layer activates

This is what the organisation expects after 30 days of use — and it is the weakest part of
the product.

*Rows re-checked 2026-10-15.*

| Expectation | Reality |
|---|---|
| "Show me everything Chika did last month" | ✅ `audit_entries` is real and auto-written (DRIFT-11, confirmed live 2026-09-18), and `/auditor/trail` reads it (`GET /audit`, filter by actor/action/object) — ✅ Live in doc 05, confirmed in the product owner's testing 2026-10-08. *Was 🟨: "/auditor/trail still renders `SEED.audit`".* |
| "Prove this trail hasn't been altered" | 🟨 `GET /audit/verify` exists, works, and confirmed the hash chain intact live — but no auditor-facing screen calls it (`/admin/audit`'s "Verify integrity" does). |
| "Track this finding to closure" | ⛔ No `Finding` model in Prisma. `/auditor/findings` (367 lines) operates entirely on `SEED.findings`. |
| "Which documents are past retention?" | ⛔ `RetentionPolicy` exists in the schema and a cabinet can reference one (`retentionPolicyId`), but no endpoint manages policies, no UI shows them and no job applies them. |
| "Enforce separation of duties" | ⛔ Described in the older docs as a platform feature. No SoD logic exists in either codebase. |
| "Department SLA compliance this quarter" | 🟨 Server-side now — `/management` reads per-department on-time/total buckets from `GET /tasks/stats` (DRIFT-07). The figure is all-time, not per quarter. *Was: "Computed in the browser from paginated lists".* |
| "Who can see the Contracts cabinet?" | 🟨 `GET /cabinets/:id/access` exists (gated on `cabinet_access:view`, which `internal_auditor` holds), and the admin cabinet screen uses it. No auditor screen does. *Was: "There is no endpoint to use it".* |

**The gap between positioning and reality is narrower than it was.** The audit trail —
the claim this product is sold on — is real, hash-chained and readable by the auditor.
What remains are findings, retention and separation of duties, which are all builds.

*Superseded (2026-08-29):* "A product sold on 'every action logged immutably for compliance'
has, today, logged zero actions." Confirmed wrong 2026-09-18 (DRIFT-11).

---

## The critical path, and where it breaks today

```
Phase 0  Provision tenant        🟥 MOCK       → manual engineering workaround
Phase 1  Bootstrap roles/perms   ✅            → ⚠️ MUST run `npx prisma generate`
Phase 2  Departments             ✅
Phase 3  Cabinets + folders      ✅            → ✅ metadata designer (since 09-04)
Phase 4  Cabinet access grants   🟨            → ✅ UI; ⚠️ not enforced on document reads
Phase 5  Users                   🟨            → ⛔ no login rate limit (invite + reset exist)
Phase 6  Workflows               ✅            → ✅ authorization FIXED 09-04
                                               → ⛔ but staff/supervisor/management/
                                                 auditor can't READ definitions (DRIFT-14)
Phase 7  First login             ✅            → ✅ test accounts FIXED (DRIFT-12)
Phase 8  First document          🟨            → ✅ OCR works; ⛔ routing blocked for
                                                 non-admins (DRIFT-14)
Phase 9  Steady state            ✅            → ✅ search; 🟨 notifications emitted,
                                                    not clicked through
Phase 10 Governance              🟨            → ✅ audit trail real; ⛔ findings,
                                                    retention, SoD
```

*Re-drawn 2026-10-15. The 2026-09-04 version showed Phase 3 "no metadata designer", Phase 4
"NO UI", Phase 8 "OCR fails", Phase 9 "search dead … notifications never emitted" and
Phase 10 "audit never written". None of those hold now.*

### Six fixes that unblock the whole chain

Ordered by *(impact ÷ effort)*, highest first:

| # | Fix | Owner | Effort | Unblocks | Status |
|---|---|---|---|---|---|
| 1 | `npx prisma generate` | Backend | 2 min | The build; un-narrows every user's scope | ✅ done |
| 2 | Two-call create-then-start in `workflowInstancesService` | Frontend | 1 hr | **The entire approval half of the product** | ✅ done |
| 3 | ~~Authorization on the workflow routes~~ | Backend | ~~1 day~~ | Closed the critical authorization hole | ✅ **done** — in the services, and since 2026-09-16 also `requirePermission` on every route |
| 3b | **Grant `workflow:view` to `staff`, `supervisor`, `management` and `internal_auditor` in `prisma/seed-system.ts`** so the roles holding `workflow_instance:route` can read definitions *(was "Split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES`" — that constant is gone; the seed is now the cause)* | Backend | **4 seed rows + re-seed** | **Document routing** — unreachable for every non-admin role | 🔴 **open, most urgent** (DRIFT-14) |
| 4 | Fix login test-account emails to the `tjoel+…` set | Frontend | 10 min | New-developer onboarding | ✅ done by 2026-09-15 (DRIFT-12) |
| 5 | ~~Presigned-upload endpoint + async Textract~~ + unconditional search indexing | Both | 3 days | OCR **and** search, together | ✅ the upload (2026-08-31) and OCR (retracted 2026-09-21) were never the blocker; indexing done in PR #51 (2026-10-14). 🟨 Stuck-job retry still open (DRIFT-06) |
| 6 | ~~Build the notifications module~~ → **call `notifyUser` from real events** | Backend | ~~3 days~~ **~2 days** | Task assignment, SLA warnings, returned work | ✅ done 2026-09-21 (DRIFT-10) |

**Revised 2026-09-04.** Items 1 and 2 are done, and they moved the product from "demo with
a broken core loop" to "working document workflow". Item 6 shrank considerably: the
module, its six endpoints, the queue, the email worker and the entire frontend surface all
exist — what is missing is the call sites. **Item 3 is now the most urgent thing in either
codebase**, and fixing item 2 made that hole reachable from the UI rather than merely
present in the API.

**Re-checked 2026-10-15.** Every item is done except **3b**. It is the one open item and
still the most urgent: it is the only break left in the Phase 8 chain for the roles that
do the work.

---

## Day-one runbook for a real tenant

What an implementation consultant would actually do today, in order, with the workarounds
each step currently requires.

```bash
# ─── Engineering (Phase 0–1) ─────────────────────────────────────────────
createdb edms_acme
cd edms-backend
cp .env.example .env       # set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET,
                           # REDIS_URL, AWS_REGION, S3_BUCKET, PORT=3001
npx prisma generate        # ⚠️ NOT OPTIONAL — see Phase 1
npx prisma migrate deploy
npm run db:bootstrap       # pgcrypto + 6 roles + 73 permissions + 212 grants

# Create the first client_admin by hand — there is no UI for this and no
# platform-provisioning flow. Adapt prisma/seed.ts or use a one-off script.

npm run dev                # API   :3001
npm run dev:worker         # OCR + search-index + SLA workers

cd ../EDMS-FRONTEND
# .env — set NEXT_PUBLIC_API_URL (one key since at least 2026-10-15; the old
# duplicate-key note no longer applies) and NEXT_PUBLIC_UPLOAD_BASE_URL.
npm run dev                # Web   :3000
```

**Then, in the UI, as the client_admin:**

| # | Do | Where | Watch out for |
|---|---|---|---|
| 1 | Create the department tree | `/admin/departments` *(was `/management/departments`, which is the management report)* | 200-row cap. One level of nesting only since `4a1373c` (2026-10-12) — a deeper parent is refused with `422 DEPARTMENT_DEPTH`, so cycles can't form |
| 2 | Create cabinets, assign each to a department | `/admin/cabinets` | 100-row cap |
| 3 | Define metadata fields | `/admin/cabinets` → Metadata schema | (*was "⛔ backend only" — stale, corrected 2026-10-06*) |
| 4 | Delegate each cabinet — grant its manager `upload`/`edit`/`delete` | `/admin/cabinets` → Access | Grants to users need step 6 first; grants to roles don't. Cabinet and folder reads honour grants; document reads don't (Phase 4, re-checked 2026-10-15) |
| 5 | Build folder trees (or leave to each cabinet's manager) | `/staff/cabinets` — not in a client_admin's sidebar; reach it via the URL or the Designer's "Open in Cabinets" | `folderId` isn't validated against `cabinetId`. 🟨 moved 2026-10-06, not verified live |
| 6 | Invite users, assign departments and roles | `/admin/users` | Invitations are emailed (since 2026-09-18); the user sets their own password. *(Was: "You will set and communicate each password by hand.")* |
| 7 | Design and publish workflows | `/admin/workflows` | Only `client_admin`/`schulltech_admin` can publish or archive (DRIFT-05, fixed 09-04). **Only they can list them, too** — staff and supervisors can't route until DRIFT-14 is fixed. |
| 8 | Set branding | `/admin/branding` | 🟥 **Saved in this browser only** — survives a reload since 2026-10-12, but other users and the login page don't see it. |
| 9 | ~~Set retention policy~~ | ⛔ | Mock. No enforcement job exists. |

**Then hand over to staff — with these caveats stated up front:**

*Caveats re-checked 2026-10-15; the 2026-08-29 list is kept struck through.*

- ✅ Upload and filing work
- ✅ Search works (indexes every document since PR #51). ~~**Search returns nothing.**~~
- ⛔ **Routing to a workflow fails for staff and supervisors** — DRIFT-14 (no
  `workflow:view` in the seed). An admin can route. ~~fails until the two-call fix ships~~
  (that fix shipped 2026-09-04).
- 🟨 Notifications are sent for task assignment, returned work, SLA warnings and breaches,
  but have not been clicked through end to end. ~~**No notifications.**~~
- ✅ The audit trail is real and hash-chained (DRIFT-11). ~~**No audit trail.**~~ Findings,
  retention and separation of duties are still not built — don't oversell compliance.
- ⚠️ Accepted types: PDF, DOCX, XLSX, TIFF, JPEG, PNG (`src/constants/uploadTypes.ts`).
  Uploads are chunked; the cap is 100 MB (`MAX_UPLOAD_BYTES`). ~~Files over 2 MB will be
  rejected; only PDF and images upload.~~
- ⚠️ A checked-out document can only be force-released once it is **overdue** — set an expected return date when checking out, or nobody but the holder can release it.
