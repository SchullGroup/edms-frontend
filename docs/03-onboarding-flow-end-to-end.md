# 03 — Onboarding Flow, End to End (All Roles)

**Status:** Written 2026-08-29 against the current code.

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
                                    │  produces: 6 roles, 45 permissions, 100 grants
                                    ▼
PHASE 2   Client Admin (Bola)  ·  ✅ REAL
          Create the department tree
          ─────────────────────────────────────────────────────────────────
                                    │  produces: departments  ──┐
                                    ▼                            │ needed by cabinets
PHASE 3   Client Admin  ·  ✅ REAL (metadata designer missing)   │ AND by users
          Create cabinets → assign to departments → build folders│
          ─────────────────────────────────────────────────────────────────
                                    │  produces: cabinets, folders
                                    ▼
PHASE 4   Client Admin  ·  ⛔ NO UI
          Grant cabinet access to roles and users
          ─────────────────────────────────────────────────────────────────
                                    │  produces: CabinetAccess grants
                                    ▼
PHASE 5   Client Admin  ·  🟨 PARTIAL (no invite flow)
          Create users → assign department → assign roles
          ─────────────────────────────────────────────────────────────────
                                    │  produces: user accounts
                                    ▼
PHASE 6   Client Admin  ·  🟨 PARTIAL (no authorization on the endpoint)
          Design workflow definitions → publish
          ─────────────────────────────────────────────────────────────────
                                    │  produces: published workflows
                                    ▼
PHASE 7   Every role  ·  ✅ REAL (test accounts are wrong — DRIFT-12)
          First login → JWT → role-based landing page
          ─────────────────────────────────────────────────────────────────
                                    │
                                    ▼
PHASE 8   Staff → Supervisor → (Management/Auditor observe)
          Upload ✅ → OCR ⛔ → Route ⛔ → Approve ✅ → Close ✅
          ─────────────────────────────────────────────────────────────────
                                    │
                                    ▼
PHASE 9   Steady state: search 🟥 · notifications ⛔ · SLA half-real
                                    │
                                    ▼
PHASE 10  Governance: audit 🟥 · findings 🟥 · reporting 🟨
```

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
| 0.6 | Send the admin their credentials | email | ⛔ No mail transport exists in the backend. |

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
npx prisma migrate deploy    # 3 migrations
npm run seed:system          # roles, permissions, role_permissions
npm run db:bootstrap         # pgcrypto extension + seed:system in one shot
npx prisma db seed           # optional: demo users, cabinets, documents
```

### What `seed:system` creates

**6 system roles** (`prisma/seed-system.ts`):

| Role | Grants | Character |
|---|---|---|
| `client_admin` | 45 | Full tenant control, all `global` scope |
| `supervisor` | 18 | Department oversight + approval |
| `staff` | 14 | Mixed `own` / `department` scope |
| `management` | 10 | Read-only `global` + `workflow:route` |
| `internal_auditor` | 10 | Read-only `global`, cannot mutate anything |
| `schulltech_admin` | **3** | `workflow:view`, `workflow:route`, `audit:view` only |

**45 permissions** across `document`, `document_version`, `document_lock`,
`document_metadata`, `cabinet`, `cabinet_metadata_field`, `cabinet_access`, `folder`,
`department`, `user`, `role`, `workflow`, `audit`.

**100 role-permission grants**, each carrying a scope of `global | department | own`.

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

### ⛔ Seeded demo accounts vs. the login screen (DRIFT-12)

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

The login screen (`src/app/page.tsx`) offers twelve autofill buttons across two sets —
`chika@firstatlantic.com` etc. (fixture personas from `initialData.ts`) and
`boyebamiji+staff@schulltech.com` etc. **None of the twelve exist in the backend.**

**Every autofill button on the login screen fails.** This is the first wall a new developer
hits, and it is a ten-minute fix.

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
| 2.2 | Create sub-departments | `POST /departments` `{name, parentId}` | Self-referencing hierarchy, arbitrary depth |
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
**Screen:** `/admin/cabinets` (Cabinet Designer)
**Status:** ✅ **Real** for cabinets and folders · ⛔ **No UI** for metadata fields

### Steps

| # | Action | API | Status |
|---|---|---|---|
| 3.1 | Create a cabinet | `POST /cabinets` `{name, description, departmentId, retentionPolicyId?}` | ✅ |
| 3.2 | Attach to a department | same payload | ✅ — **this is what makes department-scoped document access work** |
| 3.3 | Build the folder tree | `POST /cabinets/:cabinetId/folders` `{name, parentId?}` | ✅ |
| 3.4 | Define custom metadata fields | `POST /cabinets/:id/metadata-fields` | ⛔ **backend only, no UI** |
| 3.5 | Attach a retention policy | — | ⛔ no endpoint, no UI, no enforcement job |

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

**Nothing in the product can create a field.** The Cabinet Designer does not expose them.
Consequences:
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
**Screen:** ⛔ **none exists**
**Status:** ⛔ **Backend complete, no UI, and not enforced on reads**

This is the phase where need-to-know is supposed to be established, and it is the largest
structural hole in the onboarding chain.

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

### Two problems

**1. No screen can create a grant.** The model is unreachable from the product. Every
tenant therefore operates with zero `CabinetAccess` rows.

**2. Grants are not checked on read paths.** `requireCabinetAccess` is applied only to
write routes:

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
| **`GET /cabinets`** | ❌ |
| **`GET /cabinets/:id`** | ❌ |

So a user with `cabinet:view:global` sees **every cabinet in the tenant** regardless of
grants, and a user with `document:view:global` reads **every document**. Only two of the
four intended gates — RBAC scope and confidentiality tier — actually apply to reads.

**Net effect on onboarding:** because zero grants exist *and* reads don't check them, the
system behaves as though cabinet-level access control is not a feature. The moment the read
paths are fixed **without** first building the grant UI, **every non-admin user loses
access to everything.** These two fixes must ship together.

---

## Phase 5 — People (Client Admin)

**Actor:** Bola
**Screen:** `/admin/users` (423 lines, fully wired)
**Status:** 🟨 **Works, but there is no invite flow**

### Steps

| # | Action | API | Status |
|---|---|---|---|
| 5.1 | Create the user | `POST /users` `{email, name, password, departmentId, roleIds}` | ✅ bcrypt-hashed; department and role existence validated |
| 5.2 | Assign additional roles | `POST /users/:id/roles` `{roleIds}` | ✅ |
| 5.3 | Remove a role | `DELETE /users/:id/roles/:roleId` | ✅ |
| 5.4 | Deactivate | `PATCH /users/:id` `{status:'inactive'}` | ✅ — login then returns 403 `ACCOUNT_INACTIVE` |
| 5.5 | **Send an invitation** | — | ⛔ **does not exist** |
| 5.6 | **Force password change on first login** | — | ⛔ |
| 5.7 | **Self-service password reset** | — | ⛔ |

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

So a user who is both `supervisor` and `internal_auditor` gets the **Audit & Compliance**
sidebar and lands on `/auditor` — their supervisor duties become invisible even though the
API would permit them. Worth knowing before assigning combined roles.

---

## Phase 6 — Process design (Client Admin)

**Actor:** Bola
**Screen:** `/admin/workflows` (Workflow Designer, 493 lines)
**Status:** 🟨 **Works — with no authorization whatsoever**

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

Phase 1 is **sequential only** — no parallel branches, no conditional routing.
`workflow.prisma` states this explicitly.

### ⛔ The critical defect

`workflows.router.ts` contains **zero `requirePermission` calls across all 23 routes.**
Tasks, delegations and history compensate with in-service role checks. **Definitions and
instances do not** — `definitions.service.ts` and `instances.service.ts` never read
`actor.roles`.

Consequence: **any authenticated user — including a brand-new `staff` account — can create,
edit, publish and archive workflow definitions, and can start, hold, resume and close any
workflow instance in the tenant.**

The `workflow:view / create / edit / publish / archive / route` permissions **are seeded**
and are never consulted. The frontend gates `/admin/workflows` to `client_admin`, but that
is a client-side `useEffect` (DRIFT-02) — anyone can call the API directly.

**This is the single highest-severity finding across both codebases.** It should be fixed
before any pilot, and it is a small change: add `requirePermission('workflow', …)` to the
23 routes and role checks to the two services.

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

> ⛔ **The route guard is cosmetic.** There is no `middleware.ts` in the project. The guard
> is a client-side `useEffect` reading a localStorage-persisted role array. Editing
> `edms-state-v3` to claim `schulltech_admin` unlocks every portal.
>
> For API-backed pages this is contained — the backend re-derives roles from the JWT and
> returns 403. For `SEED`-backed pages (all of `/platform`, all of `/auditor`, much of
> `/admin`) **everything renders**, because that data never leaves the browser.

---

## Phase 8 — First document, end to end

This is the moment of truth: the chain that proves the system works. Here is exactly where
it succeeds and where it stops.

```
┌─ STEP 1 · Chika (staff) uploads ──────────────────────────────── ✅ WORKS ──┐
│ /upload                                                                     │
│   • drag file → IDU card (⚠️ classification is hardcoded fixture data)      │
│   • calculateChecksum()          SHA-256 via crypto.subtle                  │
│   • uploadFile() → ⚠️ third-party API Gateway, base64, 2 MB cap             │
│   • POST /api/v1/documents { title, cabinetId, folderId, confidentiality,   │
│                              urgency, fileUrl, mimeType, fileSize, checksum}│
│   Backend: requirePermission('document','create')                           │
│            validate(UploadDocumentInputSchema)                              │
│            requireCabinetAccess('upload')     ← the one read/write gate     │
│            generateDocumentReference() → DOC-20260829-142317                │
│            createDocumentWithFirstVersion()   ← one transaction             │
│            ocrQueue.add('ocr', {documentId, versionId})                     │
│   ⛔ No audit entry is written. `document.uploaded` is defined and unused.  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 2 · OCR worker ─────────────────────────────────────────── ⛔ FAILS ──┐
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
┌─ STEP 3 · Chika routes it to a workflow ──────────────────────── ⛔ 404 ────┐
│ /doc/[id] → "Route for approval"                                            │
│   • workflowInstancesService.start(workflowId, documentId)                   │
│     → POST /workflow-instances/start        ⛔ matches no backend route      │
│                                                                             │
│   The backend contract is TWO calls:                                         │
│     1. POST /workflow-instances { documentId, workflowDefinitionId }         │
│     2. POST /workflow-instances/:instanceId/start                            │
│                                                                             │
│   ⛔ DOCUMENT ROUTING DOES NOT WORK FROM THE UI. This is a small frontend    │
│      fix and it unblocks the entire approval half of the product.            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                   (assume the two-call fix is applied)
                                    │
┌─ STEP 4 · Backend starts the instance ────────────────────────── ✅ WORKS ──┐
│ instances.service.start()                                                   │
│   • validates the definition is 'published'                                 │
│   • currentStage = first stage; status = 'in_progress'                      │
│   • stageDueAt = now + stage.slaHours                                       │
│   • creates Task(s): assigneeId or assignedRoleId, dueAt                    │
│   • writes WorkflowHistory { fromStage:null, toStage:'review' }             │
│   ⛔ No notification to the assignee (no notifications module)              │
│   ⛔ No audit entry                                                          │
│   ⛔ No authorization check at all (DRIFT-05)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 5 · David (supervisor) sees the task ───────────────────── 🟨 PARTIAL ┐
│ /supervisor/approvals → GET /tasks                                          │
│   ✅ Resolves direct assignment AND role-pool assignment AND delegations     │
│   ✅ Prioritised by document urgency, then due date                          │
│   ⛔ He was never told. No email, no in-app notification, no badge from      │
│      the API — the sidebar badge is computed from SEED.documents and is      │
│      hardcoded to assignee === 'u-david'.                                   │
│      He only sees it if he happens to open the page.                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 6 · David approves ─────────────────────────────────────── ✅ WORKS ──┐
│ POST /tasks/:id/action { action:'approve', note:'Verified against PO' }      │
│   ✅ Authorization: assignee, role-pool member, or TASK_REASSIGN_ROLES       │
│   ✅ Task → completed; completedBy, completedAt, note recorded               │
│   ✅ Instance advances; stageDueAt recomputed for the next stage             │
│   ✅ WorkflowHistory row with fromStage, toStage, actor, note,               │
│      elapsedSeconds                                                          │
│   ✅ Final stage → instance closed → document status 'closed'                │
│   ⛔ No notification to the next assignee or the originator                  │
│   ⛔ No audit entry (workflow_history ≠ audit_entries — different table,      │
│      different purpose, no hash chain)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ STEP 7 · SLA monitoring, in parallel ────────────────────────── 🟨 HALF ───┐
│ sla-breach.worker.ts, every SLA_RECONCILE_INTERVAL_MS (default 5 min)       │
│   ✅ Finds tasks within SLA_WARNING_HOURS (default 4) of dueAt              │
│   ✅ Creates SlaBreach 'warning'; if past due, 'escalation' + escalates      │
│      the task                                                                │
│   ✅ Unique (taskId, breachType) prevents duplicate alerts                   │
│   ✅ Writes WorkflowHistory                                                  │
│   ✅ Resolves breaches when the task completes                               │
│   ⛔ NOBODY IS EVER TOLD. sla.warning and sla.breach are defined in          │
│      NOTIFICATION_TYPES and there is no notifications module.               │
│      The SLA engine runs into a void.                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Summary of the first-document journey

| Step | Status |
|---|---|
| 1. Upload and file | ✅ works |
| 2. OCR and index | ⛔ always fails; document unsearchable forever |
| 3. Route to workflow | ⛔ 404 — the UI calls a route that doesn't exist |
| 4. Instance start | ✅ works (once step 3 is fixed) — but unauthorized |
| 5. Task appears | 🟨 appears, but nobody is notified |
| 6. Approve / reject | ✅ works |
| 7. SLA monitoring | 🟨 detects correctly, tells nobody |
| — audit trail | ⛔ nothing recorded at any step |

**Two frontend-side fixes (step 3's two-call sequence, and the upload bucket) plus two
backend builds (notifications, audit) turn this from a demo into a working system.**

---

## Phase 9 — Steady-state operation

Once documents are flowing, this is what daily use looks like and what it costs.

| Capability | Status | Note |
|---|---|---|
| Browse cabinets and folders | ✅ | ⚠️ cabinet grants not enforced on reads |
| Open a document | ✅ | ⚠️ no download/preview endpoint exists |
| Full-text search | ⛔ | index never built (Phase 8 step 2) |
| Filter documents | ✅ | cabinet, folder, status, urgency, type, creator, archived |
| Check out / check in | ✅ | ⚠️ no admin force-release; a stale lock blocks forever |
| Upload a new version | ✅ | ⚠️ blocked if someone else holds the lock (correct) |
| Restore a version | 🟨 | backend works, no UI |
| Comment on a document | ⛔ | `POST /documents/:id/comments` 404s |
| Sign a document | ⛔ | `POST /documents/:id/signatures` 404s |
| Notifications | ⛔ | module missing; returns an HTML 404 that axios can't parse |
| Delegate while away | 🟨 | backend complete, no UI at all |
| Supervisor workload view | 🟨 | works, but walks every page of `/documents` client-side |
| Management reports | 🟨 | works, but computes all aggregates in the browser |
| Circulars | 🟥 | mock on both sides |

### The performance cliff worth planning for

Management and supervisor dashboards call `fetchAllPages`, which walks up to **50 pages ×
100 records = 5,000 rows** per resource, then aggregates in JavaScript. With three
resources on one page (`useAllDocuments` + `useAllTasks` + `useAllWorkflowInstances`) that
is **up to 150 sequential HTTP requests to render one dashboard.**

At demo scale it is invisible. At 10,000 documents it is a 30-second page load. The
`fetchAllPages` header says so plainly and asks to be deleted once aggregation endpoints
exist. **The backend has no aggregation, statistics or reporting endpoints of any kind** —
this is the largest single gap for the management role.

---

## Phase 10 — Governance layer activates

This is what the organisation expects after 30 days of use — and it is the weakest part of
the product.

| Expectation | Reality |
|---|---|
| "Show me everything Chika did last month" | ⛔ `audit_entries` has never been written to. `audit.middleware.ts` is a 0-byte file. `/auditor/trail` renders `SEED.audit`. |
| "Prove this trail hasn't been altered" | ⛔ The hash chain (`prevHash`/`entryHash`) is designed, indexed, documented — and empty. |
| "Track this finding to closure" | ⛔ No `Finding` model in Prisma. `/auditor/findings` (367 lines) operates entirely on `SEED.findings`. |
| "Which documents are past retention?" | ⛔ `RetentionPolicy` exists in the schema; no endpoint, no UI, no job ever applies it. |
| "Enforce separation of duties" | ⛔ Described in the older docs as a platform feature. No SoD logic exists in either codebase. |
| "Department SLA compliance this quarter" | 🟨 Computed in the browser from paginated lists. |
| "Who can see the Contracts cabinet?" | ⛔ `internal_auditor` holds `cabinet_access:view:global`. There is no endpoint to use it. |

**The gap between positioning and reality is at its widest here.** A product sold on
"every action logged immutably for compliance" has, today, logged zero actions. This is the
single most important thing to fix after the workflow authorization hole — and unlike most
of the list, it is a build, not a repair: the schema is already right.

---

## The critical path, and where it breaks today

```
Phase 0  Provision tenant        🟥 MOCK       → manual engineering workaround
Phase 1  Bootstrap roles/perms   ✅            → ⚠️ MUST run `npx prisma generate`
Phase 2  Departments             ✅
Phase 3  Cabinets + folders      ✅            → ⛔ no metadata designer
Phase 4  Cabinet access grants   ⛔ NO UI      → and not enforced on reads
Phase 5  Users                   🟨            → ⛔ no invite, no reset, no rate limit
Phase 6  Workflows               🟨            → ⛔ NO AUTHORIZATION (critical)
Phase 7  First login             ✅            → ⛔ test accounts wrong (DRIFT-12)
Phase 8  First document          🟨            → ⛔ OCR fails, ⛔ routing 404s
Phase 9  Steady state            🟨            → ⛔ search dead, ⛔ notifications dead
Phase 10 Governance              🟥            → ⛔ audit never written
```

### Six fixes that unblock the whole chain

Ordered by *(impact ÷ effort)*, highest first:

| # | Fix | Owner | Effort | Unblocks |
|---|---|---|---|---|
| 1 | `npx prisma generate` | Backend | 2 min | The build; un-narrows every user's scope |
| 2 | Two-call create-then-start in `workflowInstancesService.start()` | Frontend | 1 hr | **The entire approval half of the product** |
| 3 | `requirePermission` on all 23 workflow routes + role checks in definitions/instances services | Backend | 1 day | Closes the critical authorization hole |
| 4 | Fix login test-account emails to the `tjoel+…` set | Frontend | 10 min | New-developer onboarding |
| 5 | Presigned-upload endpoint + async Textract + unconditional search indexing | Both | 3 days | OCR **and** search, together |
| 6 | Build the notifications module and wire the SLA worker to it | Backend | 3 days | Task assignment, SLA warnings, circular acks |

Items 1, 2 and 4 total **under two hours** and move the product from "demo with a broken
core loop" to "working document workflow".

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
npm run db:bootstrap       # pgcrypto + 6 roles + 45 permissions + 100 grants

# Create the first client_admin by hand — there is no UI for this and no
# platform-provisioning flow. Adapt prisma/seed.ts or use a one-off script.

npm run dev                # API   :3001
npm run dev:worker         # OCR + search-index + SLA workers

cd ../EDMS-FRONTEND
# .env — note the duplicate NEXT_PUBLIC_API_URL key; the empty one wins and
# the code falls back to http://localhost:3001, so it works by accident.
npm run dev                # Web   :3000
```

**Then, in the UI, as the client_admin:**

| # | Do | Where | Watch out for |
|---|---|---|---|
| 1 | Create the department tree | `/management/departments` | 200-row cap; no cycle detection |
| 2 | Create cabinets, assign each to a department | `/admin/cabinets` | 100-row cap |
| 3 | Build folder trees | `/admin/cabinets` | `folderId` isn't validated against `cabinetId` |
| 4 | ~~Define metadata fields~~ | ⛔ | **Backend only. Use the API directly or skip.** |
| 5 | ~~Grant cabinet access~~ | ⛔ | **No UI. Also not enforced on reads — skip for now.** |
| 6 | Create users, assign departments and roles | `/admin/users` | **You will set and communicate each password by hand.** |
| 7 | Design and publish workflows | `/admin/workflows` | **Anyone can publish or archive these. Restrict who has an account until fixed.** |
| 8 | Set branding | `/admin/branding` | 🟥 **localStorage only — resets on cache clear.** |
| 9 | ~~Set retention policy~~ | ⛔ | Mock. No enforcement job exists. |

**Then hand over to staff — with these caveats stated up front:**

- ✅ Upload and filing work
- ⛔ **Search returns nothing.** Use cabinet/folder browsing.
- ⛔ **Routing to a workflow fails** until the two-call fix ships.
- ⛔ **No notifications.** Users must check `/staff/tasks` manually.
- ⛔ **No audit trail.** Do not represent the system as compliance-ready.
- ⚠️ Files over 2 MB will be rejected; only PDF and images upload.
- ⚠️ A checked-out document cannot be force-released by an admin.
