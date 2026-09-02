# 01 — Architecture & Frontend↔Backend Drift

**Status:** Written 2026-08-29 against `EDMS-FRONTEND` @ `src/` (15,862 LOC) and `edms-backend` @ `tolu` branch, commit `2c8b901` (11,393 LOC).

This document describes **what actually exists in the code today**, not the target design.
Where the two systems disagree, the disagreement is named explicitly and marked with a
severity. Nothing here is aspirational — every claim is anchored to a file and line.

> ⚠️ **Supersedes `../../out/DOCUMENTATION.md` and `../../out/USER_FLOWS.md`.**
> Those two documents describe endpoints that were never built
> (`POST /documents/:id/route`, `POST /workflows/instances/:id/approve`,
> `POST /users/invite`, `POST /circulars`, `POST /circulars/:id/ack`) and a
> `multipart/form-data` upload path that does not exist. Treat them as design
> intent from an earlier phase, not as a description of the system.

---

## Table of contents

1. [System map — the three deployables](#1-system-map--the-three-deployables)
2. [The request lifecycle, end to end](#2-the-request-lifecycle-end-to-end)
3. [Authentication architecture (the BFF split)](#3-authentication-architecture-the-bff-split)
4. [Authorization: four independent layers](#4-authorization-four-independent-layers)
5. [The document storage path (and why OCR cannot work)](#5-the-document-storage-path-and-why-ocr-cannot-work)
6. [State architecture on the frontend](#6-state-architecture-on-the-frontend)
7. [The complete API drift matrix](#7-the-complete-api-drift-matrix)
8. [Contract-shape drift (same URL, different meaning)](#8-contract-shape-drift-same-url-different-meaning)
9. [Configuration & environment drift](#9-configuration--environment-drift)
10. [Drift register — ranked, with owners](#10-drift-register--ranked-with-owners)

---

## 1. System map — the three deployables

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                      │
│                                                                               │
│  Next.js 16 App Router · React 19 · Zustand (persisted) · TanStack Query v5    │
│                                                                               │
│   ┌──────────────────┐   ┌───────────────────┐   ┌─────────────────────────┐  │
│   │ Zustand `useStore│   │ TanStack Query    │   │ Zustand `useUIStore`    │  │
│   │ (persist:        │   │ cache             │   │ toasts/modals/drawers   │  │
│   │  localStorage    │   │ (server state)    │   │ (ephemeral)             │  │
│   │  key             │   │                   │   │                         │  │
│   │  edms-state-v3)  │   │                   │   │                         │  │
│   │                  │   │                   │   │                         │  │
│   │ • currentUser    │   │ • documents       │   │                         │  │
│   │ • 1,520 lines of │   │ • tasks           │   │                         │  │
│   │   SEED demo data │   │ • cabinets        │   │                         │  │
│   │   (initialData)  │   │ • users, roles    │   │                         │  │
│   └──────────────────┘   └───────────────────┘   └─────────────────────────┘  │
│            │                       │                                           │
└────────────┼───────────────────────┼───────────────────────────────────────────┘
             │                       │
    ┌────────┘                       └──────────────────────────┐
    │ (a) axios → same-origin                                   │ (b) axios → cross-origin
    │     `/api/auth/*`                                         │     apiClient, baseURL
    │     ONLY 3 routes                                         │     `${NEXT_PUBLIC_API_URL}/api/v1`
    ▼                                                           ▼
┌───────────────────────────────┐              ┌────────────────────────────────────────┐
│ NEXT.JS ROUTE HANDLERS (BFF)  │              │  EXPRESS 5 BACKEND (edms-backend)      │
│ src/app/api/auth/             │              │  :3001                                 │
│                               │──── fetch ──▶│                                        │
│  POST /api/auth/login         │              │  POST /api/v1/auth/login    ✅          │
│  POST /api/auth/refresh       │              │  POST /api/v1/auth/refresh  ✅          │
│  POST /api/auth/logout        │              │  POST /api/v1/auth/logout   ❌ 404      │
│                               │              │                                        │
│  Sole responsibility:         │              │  74 routes over 8 modules              │
│  hold `refreshToken` in an    │              │  ┌──────────────────────────────────┐  │
│  HttpOnly cookie so JS never  │              │  │ Router → Controller → Service →  │  │
│  sees it.                     │              │  │ Repository → PrismaClient        │  │
│                               │              │  └──────────────────────────────────┘  │
│  Everything else bypasses     │              │                                        │
│  this layer entirely.         │              │  Prisma 7.9 ─┬─▶ PostgreSQL            │
└───────────────────────────────┘              │              └─▶ (pg driver adapter)   │
                                               │                                        │
                                               │  BullMQ ──▶ Redis ──▶ worker.js:       │
                                               │      • ocr (AWS Textract)              │
                                               │      • search-index (tsvector)         │
                                               │      • sla-breach (every 5 min)        │
                                               └────────────────────────────────────────┘

                     ┌──────────────────────────────────────────┐
                     │ THIRD-PARTY AWS API GATEWAY              │
                     │ qerhd0lxje.execute-api.us-east-1...      │
                     │ /prod/upload-file · /prod/upload-image   │
                     │                                          │
                     │ ⚠️ Hard-coded in s3.service.ts.          │
                     │    Not owned by, configured by, or       │
                     │    known to edms-backend.                │
                     └──────────────────────────────────────────┘
```

### Deployable inventory

| Deployable | Path | Runtime | Port (dev) | Notes |
|---|---|---|---|---|
| Web app | `EDMS-FRONTEND` | Next.js 16.2.10 / Node | 3000 | App Router, `(app)` route group, 42 pages |
| API | `edms-backend` | Express 5.2 / Node | 3001 (`PORT` in `.env`) | 74 routes, Swagger at `/api-docs` |
| Worker | `edms-backend` | `node dist/worker.js` | — | Separate process; OCR + search + SLA |
| Design reference | `EDMS-HTML` | static | 8080 | Original HTML/JS prototype; source of the CSS design system. Not deployed. |

---

## 2. The request lifecycle, end to end

Two distinct paths exist. Knowing which one you are on determines where to debug.

### Path A — authentication (3 routes only)

```
Browser
  │  axios.post('/api/auth/login', {email, password})     ← same-origin, no CORS
  ▼
Next.js Route Handler  src/app/api/auth/login/route.ts
  │  authServer.loginWithBackend(body)
  │  fetch(`${API_URL}/api/v1/auth/login`)                ← server-to-server
  ▼
Express  POST /api/v1/auth/login
  │  validate(LoginInputSchema)              → 422 on bad shape
  │  AuthController.login → AuthService.login
  │  • authRepository.findForLogin(db, email)
  │  • bcrypt.compare
  │  • status !== 'active'  → 403 ACCOUNT_INACTIVE
  │  • jwt.sign × 2 (access 15m / refresh 7d, different secrets)
  │  • updateLastLogin (fire-and-forget, errors swallowed)
  ▼
  { success, data: { user:{id,email,name,status,roles}, accessToken, refreshToken } }
  │
  ▼
Next.js Route Handler
  │  strips refreshToken from the JSON body
  │  res.cookies.set('refreshToken', …, { httpOnly:true, sameSite:'lax', maxAge:7d })
  ▼
Browser
  │  authService.login() → Cookies.set('accessToken', …)   ← js-cookie, NOT HttpOnly
  │  useStore.setCurrentUser(data.user)                    ← persisted to localStorage
  ▼
  LoginPage useEffect redirects by role → /staff | /supervisor | /management |
                                          /admin | /platform | /auditor
```

### Path B — everything else (66 routes)

```
Browser
  │  useDocuments() → TanStack Query → documentsService.getAll()
  │  apiClient.get('/documents', { params })
  │
  │  request interceptor: Authorization: Bearer <Cookies.get('accessToken')>
  ▼  ── CORS boundary ──────────────────────────────────────────────────────
Express  GET /api/v1/documents
  │
  │  app.use(express.json())
  │  app.use(cors({ origin: env.ALLOWED_ORIGINS.split(','), credentials:true }))
  │  app.use('/api/v1', authenticate)          ← global; every non-auth route
  │       • jwt.verify(token, JWT_SECRET)
  │       • re-reads user + roles + rolePermissions from the DB on EVERY request
  │       • builds req.user = { id, email, departmentId, roles[], roleIds[],
  │                             permissions[] as "resource:action:scope" }
  │
  │  requirePermission('document','view')      ← per-route
  │       • scans req.user.permissions for prefix "document:view:"
  │       • picks the most permissive scope (global > department > own)
  │       • sets req.permissionScope
  │
  │  validate(ListDocumentsQuerySchema,'query')
  │       • parsed result lands on res.locals.query (Express 5: req.query is read-only)
  │
  │  [requireCabinetAccess] [requireConfidentiality]   ← only on some routes
  │
  │  DocumentsController.listDocuments
  │       • buildAccessContext(req) from req.user + req.permissionScope
  │       • passes the imported `db` singleton down as an argument
  ▼
  DocumentService.listDocuments → DocumentsRepository.findManyAndCount
  │       • buildDocumentWhere() applies confidentiality tier + RBAC scope
  ▼
  Prisma → PostgreSQL
  │
  ▼  ApiResponse.paginated(res, data, {page,limit,total})
  { success:true, message:'Success', data:[…], pagination:{page,limit,total,totalPages} }
  │
  ▼
Browser — response interceptor
  │  200 → return
  │  401 → refreshAccessToken() singleton
  │         • axios.post('/api/auth/refresh')  ← back through the BFF
  │         • on success: re-set accessToken cookie, replay the original request,
  │           and drain `failedQueue` so concurrent 401s ride the same refresh
  │         • on failure: check localStorage `__edms_last_refresh_ts` — if another
  │           tab refreshed within 4s, reuse its cookie instead of logging out
  │         • otherwise: Cookies.remove + window.location.href = '/'
```

**Note the asymmetry.** Only 3 routes go through the Next.js server. The other 71 are
plain browser→Express cross-origin calls. There is no SSR data fetching anywhere in the
app: every page is `'use client'`.

---

## 3. Authentication architecture (the BFF split)

### Token custody

| Token | Where it lives | HttpOnly | Lifetime | Set by | Read by |
|---|---|---|---|---|---|
| `accessToken` | browser cookie via `js-cookie` | **No** | `expires: 1` day (cookie) but JWT expires in **15m** | `authService.login/refresh` | axios request interceptor |
| `refreshToken` | browser cookie | **Yes** | 7 days | Next.js route handler | Next.js route handler only |

**The design intent is sound** — the long-lived credential is unreachable from JS, and only
the short-lived one is exposed. Two things weaken it in practice:

1. **The cookie TTL and the JWT TTL disagree.** The cookie says 1 day; the JWT inside says
   15 minutes. For 23 hours 45 minutes the client believes it is authenticated and only
   discovers otherwise when a request 401s. That is what the refresh interceptor is for,
   so it works — but every session's *first* action after 15 minutes idle costs an extra
   round trip.
2. **`accessToken` is readable by any script on the origin.** That is the deliberate
   trade-off of the `js-cookie` approach (the interceptor needs to read it). An
   `Authorization`-header-from-memory scheme would be stricter.

### Refresh coordination — the good part

`src/lib/api-client.ts` implements three mechanisms that are easy to get wrong and are
correct here:

- **A refresh singleton** (`_refreshPromise`) so N concurrent 401s trigger exactly one
  refresh call.
- **A `failedQueue`** so all N original requests are replayed once the new token lands,
  rather than being dropped.
- **Cross-tab coordination** via a `localStorage` timestamp (`__edms_last_refresh_ts`).
  If tab A refreshes and rotates the cookie, tab B's in-flight refresh will 401 — but B
  checks the timestamp, sees A refreshed <4s ago, re-reads the cookie and retries instead
  of logging the user out. This is a real bug class that most apps ship with.

### 🔴 DRIFT-01 — `POST /api/v1/auth/logout` does not exist

`src/apis/server/auth.server.ts:19` calls `POST ${API_URL}/api/v1/auth/logout`.
`edms-backend/src/modules/auth/auth.router.ts` registers only `/login`, `/refresh`, `/me`.

The call returns Express's default HTML 404. `logoutWithBackend` wraps it in
`try/catch` and only `console.error`s, so **logout appears to succeed**: the HttpOnly
cookie is cleared client-side and the user is signed out of the UI.

**What actually breaks:** the refresh token remains cryptographically valid for its full
7 days. Because the backend has no denylist, revocation table, or rotation, a refresh
token captured before "logout" still mints access tokens afterwards. The backend also
defines a `user.logout` audit action in `workflow.constants.ts` that can never be
written.

**Fix:** either build `POST /auth/logout` with a refresh-token denylist (Redis is already
a dependency), or delete the call and document that logout is client-side only.

---

## 4. Authorization: four independent layers

Authorization is enforced in four places that do **not** know about each other. Understanding
which layer denies a request is the single most common source of confusion in this codebase.

```
┌─ LAYER 1 ── Frontend route guard ──────────────────────────────────────────────┐
│ WHERE   src/components/layout/AppShell.tsx (a useEffect), config/routes.config │
│ INPUT   currentUser.roles, from localStorage-persisted Zustand                  │
│ EFFECT  router.replace('/unauthorized')                                         │
│ TRUST   ⚠️ ZERO. Cosmetic only — see DRIFT-02.                                  │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 2 ── Frontend component guard ──────────────────────────────────────────┐
│ WHERE   src/hooks/usePermissions.ts, src/components/common/Guard.tsx            │
│ INPUT   currentUser.permissions if non-empty, else role heuristics              │
│ EFFECT  renders children or a fallback                                          │
│ TRUST   ⚠️ ZERO. Cosmetic only — and see DRIFT-03 for a format mismatch.        │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 3 ── Backend RBAC ──────────────────────────────────────────────────────┐
│ WHERE   middlewares/role.middleware.ts → requirePermission(resource, action)     │
│ INPUT   req.user.permissions, rebuilt from the DB on every request              │
│ EFFECT  403 FORBIDDEN, or sets req.permissionScope                              │
│ TRUST   ✅ REAL — but absent from all 23 workflow routes.                       │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 4 ── Backend row/instance-level filters ────────────────────────────────┐
│ 4a  RBAC scope    → documents.repository buildDocumentWhere / applyAccessScope  │
│                     own → createdBy = me; department → cabinet.departmentId     │
│ 4b  Confidentiality → requireConfidentiality middleware + tier allowlists        │
│ 4c  Cabinet grants  → requireCabinetAccess middleware (CabinetAccess table)      │
│ TRUST   ✅ REAL — but 4c is only on WRITE routes. See backend analysis.         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 🔴 DRIFT-02 — All frontend route protection is client-side and forgeable

There is **no `middleware.ts`** anywhere in `EDMS-FRONTEND`. Route guarding runs in a
`useEffect` inside `AppShell` (`src/components/layout/AppShell.tsx:52-99`) against
`currentUser`, which is rehydrated from the `edms-state-v3` localStorage key.

Editing that key to `currentUser.roles = ['schulltech_admin']` unlocks every portal in the
UI. What the attacker gets depends entirely on where that page's data comes from:

| Page data source | Consequence of forging a role |
|---|---|
| Backend API (`/documents`, `/tasks`, `/users`…) | **Contained.** The backend re-derives roles from the JWT + DB and returns 403. The page renders empty or errors. |
| Zustand `SEED` (all of `/platform`, `/auditor`, most of `/admin`) | **Fully exposed.** Every tenant, plan, billing record, finding and audit row renders, because it never leaves the browser. |

Today the exposed data is fixture data, so the impact is a demo-integrity problem, not a
breach. It becomes a real vulnerability the moment those pages are wired to live endpoints.

**Fix:** add a Next.js `middleware.ts` that validates the `refreshToken` cookie
server-side (or calls `/auth/me`) and redirects before the page is ever served. Keep the
`AppShell` guard as a UX nicety, not as the control.

### 🔴 DRIFT-03 — Permission string formats do not match

| Side | Format | Example | Source |
|---|---|---|---|
| Backend emits | `resource:action:scope` | `document:view:global` | `auth.middleware.ts:56` |
| Frontend compares | `resource:action` | `document:view` | `usePermissions.ts:12` |

```ts
// src/hooks/usePermissions.ts
return p === `${resource}:${action}` || p === `${resource}:*` || p === `*:*`;
//     "document:view:global" === "document:view"  → false, always
```

The mismatch is currently **latent, not active**, for one reason: the backend's
`POST /auth/login` and `GET /auth/me` responses return only
`{ id, email, name, status, roles }` — **no `permissions` array**
(`auth.service.ts`, `LoginResponse`/`UserResponse`). So `currentUser.permissions` is
always empty, `usePermissions` falls through to its role-heuristic branch, and the UI
behaves plausibly.

**This is a trap.** The moment anyone adds `permissions` to the `/auth/me` payload —
an obvious, desirable change — `hasPermission()` starts returning `false` for
*everything*, and every `<Guard>` in the app goes dark simultaneously. The failure will
look like a permissions regression, not a string-format bug.

**Fix (do both, in this order):**
1. Make `usePermissions` split on `:` and compare only the first two segments, keeping
   the third as the scope. Ship this **before** step 2.
2. Add `permissions` to the `/auth/me` response so the UI stops guessing.

### 🟠 DRIFT-04 — The frontend's role heuristics contradict the backend's grants

`usePermissions.ts:26-31` grants `client_admin` **everything** except `resource === 'platform'`.
`routes.config.ts` gives `schulltech_admin` the entire `/platform` prefix.

The backend disagrees on both counts:

| Role | Backend permission grants (`prisma/seed-system.ts`) | Frontend assumption |
|---|---|---|
| `client_admin` | 45 grants, all `global` — genuinely broad | "everything" ✅ close enough |
| `schulltech_admin` | **3 grants only**: `workflow:view`, `workflow:route`, `audit:view` | "super access, returns true for all" ❌ |
| `internal_auditor` | 10 read-only `global` grants | read-only ✅ |
| `management` | 10 read-only `global` grants + `workflow:route` | can approve/reject ❌ |
| `supervisor` | 18 grants | can approve/reject ✅ |
| `staff` | 14 grants, mixed `own`/`department` | broad document rights ⚠️ over-permissive |

The `schulltech_admin` row is the sharp one. `usePermissions` returns `true` for every
check, and `routes.config` opens all of `/platform` — but that user cannot call
`GET /users`, `GET /documents`, or `GET /cabinets` at all (403). The platform portal only
appears to work because **every `/platform` page reads from `SEED`**, never from the API.

`management` is the subtle one: the UI offers approve/reject affordances the backend
never granted. Because the workflow routes have no `requirePermission` at all
(DRIFT-05), those actions currently succeed — for the wrong reason.

### 🔴 DRIFT-05 — 23 workflow routes have no permission check

`edms-backend/src/modules/workflows/workflows.router.ts` contains **zero** `requirePermission`
calls. Tasks, delegations and history compensate with in-service role checks
(`TASK_VIEW_ALL_ROLES`, `TASK_REASSIGN_ROLES`, `DELEGATION_*`). **Definitions and instances
do not** — neither `definitions.service.ts` nor `instances.service.ts` reads roles at all.

Any authenticated user, including plain `staff`, can today:

- `POST /workflows` — create a workflow definition
- `PATCH /workflows/:id` — edit one
- `POST /workflows/:id/publish` / `/archive`
- `POST /workflow-instances` and `/:id/start` `/hold` `/resume` `/close`

The `workflow:view/create/edit/publish/archive/route` permissions **are seeded** and are
never consulted. The frontend Workflow Designer at `/admin/workflows` is gated to
`client_admin` in `routes.config.ts` — Layer 1 only, which DRIFT-02 makes forgeable.

**This is the highest-severity finding in the pair of codebases.** Owner: backend.

---

## 5. The document storage path (and why OCR cannot work)

### What the code actually does

```
1. Browser  src/app/(app)/upload/page.tsx  →  fileDoc()
   ├─ calculateChecksum(file)              SHA-256 via crypto.subtle          ✅
   ├─ uploadFile(file, {folderName:'edms-documents'})
   │    └─ s3.service.ts
   │         ├─ sanitizeFileName()
   │         ├─ convertToBase64(file)      ⚠️ whole file into a JS string
   │         └─ axios.post(
   │              'https://qerhd0lxje.execute-api.us-east-1.amazonaws.com/prod/upload-file'
   │              ?fileName=…&projectFolder=edms-documents,
   │              { file: <base64> },
   │              { timeout: 30_000 })
   │         └─ returns response.data.responseObj.pdf_url
   │
   └─ documentsService.create({ …, fileUrl: <that url>, mimeType, fileSize, checksum })
        └─ POST /api/v1/documents

2. Express  DocumentService.uploadDocument
   ├─ generateDocumentReference(db)        DOC-YYYYMMDD-HHmmss
   ├─ extractFileKey(input.fileUrl)        new URL(fileUrl).pathname minus leading '/'
   ├─ createDocumentWithFirstVersion(...)  document + version v1, in one transaction
   └─ ocrQueue.add('ocr', {documentId, versionId}, {attempts:3, backoff:exponential})

3. Worker   ocr.workers.ts  processOcrJob
   ├─ version.ocrStatus = 'processing'
   ├─ TextractClient.send(new DetectDocumentTextCommand({
   │     Document: { S3Object: { Bucket: env.S3_BUCKET, Name: version.fileKey } } }))
   │                                       ⚠️⚠️  ← THE BREAK
   ├─ on success: ocrText saved, ocrStatus='completed', searchIndexQueue.add('index')
   └─ on failure: ocrStatus='failed', rethrow for BullMQ retry

4. Worker   search-index.workers.ts
   └─ UPDATE documents SET search_vector = to_tsvector('english', title ‖ ocrText ‖ metadata)
```

### 🔴 DRIFT-06 — The file is never in the bucket Textract reads from

The browser uploads to a **third-party API Gateway hard-coded in `s3.service.ts`**. That
gateway writes to whatever bucket it owns and returns a `pdf_url`. The backend then
extracts the URL *path* as `fileKey` and asks Textract to read
`s3://${env.S3_BUCKET}/${fileKey}`.

`env.S3_BUCKET` is a completely different, backend-configured bucket. Textract will raise
`InvalidS3ObjectException`, the job retries three times, `ocrStatus` lands on `'failed'`,
and — because `searchIndexQueue.add` only runs on the OCR **success** path —
**the document is never indexed at all, not even by its title.**

Consequence chain:
```
OCR fails  →  no search-index job  →  search_vector stays NULL
           →  the document is invisible to GET /documents/search, forever
           →  but it IS visible in GET /documents (plain Prisma list)
```
So search and browse silently disagree about what exists. This will read as "search is
broken/flaky" long before anyone traces it to the bucket.

### Related storage problems

| # | Issue | Detail |
|---|---|---|
| a | **2 MB limit** | `s3.service.ts` `maxFileSize = 2_000_000`. A document management system that rejects a 3 MB scanned PDF. |
| b | **Base64 in memory** | `convertToBase64` inflates the payload ~33% and holds the whole file as a JS string. Combined with a 30 s axios timeout this fails on slow connections well under the size cap. |
| c | **No presigned-URL endpoint** | The backend never issues an upload URL. Clients have no sanctioned path to storage, so the external gateway is load-bearing. |
| d | **`fileUrl` is unvalidated** | `extractFileKey` accepts any URL. Nothing checks the host matches `S3_BUCKET`. A crafted request can point a version at an arbitrary key. |
| e | **Multi-page PDFs unsupported** | `DetectDocumentTextCommand` is Textract's *synchronous* API — single-page only. Multi-page needs `StartDocumentTextDetection` + polling. Most real EDMS uploads are multi-page. |
| f | **`uploadFile` silently rejects most types** | The dispatcher only routes images and `application/pdf`. Word/Excel/text pass `validateFile` but hit `"Unsupported file type"` in `uploadFile`. |
| g | **Stale index on edit** | `updateDocument` (title), `updateDocumentMetadata`, and `restoreVersion` never re-enqueue indexing. `search_vector` drifts from the row. |

**Recommended target:** `POST /api/v1/documents/upload-url` on the backend returns a
presigned PUT for `env.S3_BUCKET`; the browser PUTs the raw file (no base64); the backend
validates the returned key belongs to its own bucket; OCR switches to the async Textract
API; the search-index job is enqueued on *create/update/restore* regardless of OCR outcome.

---

## 6. State architecture on the frontend

Three state systems coexist, and the boundary between the first two is the main source of
confusion for anyone new to the codebase.

### 6.1 `useStore` — Zustand + `persist`

`src/store/useStore.ts`, key `edms-state-v3`, spread from `SEED` in
`src/store/initialData.ts` (**1,520 lines of fixture data**).

It holds two very different kinds of thing:

| Kind | Examples | Should it be here? |
|---|---|---|
| **Genuine client session state** | `currentUser`, `prefs` (theme, density), `branding` | ✅ Yes |
| **Demo-mode server data** | `documents`, `users`, `cabinets`, `workflows`, `audit`, `notifications`, `circulars`, `findings`, `tenants`, `plans`, `featureFlags`, `policies`, `rolesMatrix` | ❌ No — this is server state |

Plus ~25 synchronous mutators (`updateDocumentStatus`, `addTenant`, `updateFinding`, …)
that write to the persisted copy and are never sent anywhere.

**The three consequences that bite:**

1. **Stale fixtures survive a rebuild.** Because it is `persist`ed, a developer who loaded
   the app weeks ago is still looking at that day's `SEED` snapshot. `version: 3` bumps
   the key but there is no migration.
2. **Two sources of truth on one page.** Most pages read *both* — e.g.
   `supervisor/page.tsx` pulls documents from `useDocuments()` (API) but `userById` from
   the store; `doc/[id]/page.tsx` pulls the document from the API but `currentUser` from
   the store. Which one wins is per-line.
3. **Mutators create phantom writes.** Clicking "Suspend tenant" on `/platform` calls
   `updateTenant`, the row updates, a toast fires — and nothing was persisted anywhere
   but localStorage. The UI is indistinguishable from a working feature.

### 6.2 TanStack Query — real server state

13 hook modules in `src/apis/hooks/`. This layer is well built: query keys are namespaced,
mutations invalidate correctly, and `useAllX` variants exist for the aggregation cases.

### 6.3 `useUIStore` — ephemeral UI

Toasts, modals, drawers, confirms, page title. Not persisted. Clean.

### 🟡 DRIFT-07 — `fetchAllPages` is client-side aggregation standing in for missing endpoints

`src/apis/utils/fetchAllPages.ts` walks every page of a list endpoint (up to 50 pages ×
100 items) and concatenates in the browser. `managementAggregation.ts` then does
department rollups, month bucketing, and SLA maths client-side.

The file's own header is candid about this and should be read in full — it correctly
identifies that this reconstructs in JS what one SQL `GROUP BY` would do on the server,
and that it does not scale.

Every management and supervisor dashboard depends on it. **The backend has no aggregation,
reporting, or statistics endpoints of any kind.** This is the single largest backend gap
for the management role.

---

## 7. The complete API drift matrix

Legend: ✅ works · ⚠️ exists on one side only · 🔴 called but missing/wrong

### Auth

| Frontend call | Backend route | Status |
|---|---|---|
| `POST /api/auth/login` → `/api/v1/auth/login` | ✅ exists | ✅ |
| `POST /api/auth/refresh` → `/api/v1/auth/refresh` | ✅ exists | ✅ |
| `POST /api/auth/logout` → `/api/v1/auth/logout` | ❌ **not registered** | 🔴 **DRIFT-01** |
| `GET /auth/me` | ✅ exists | ✅ (payload lacks `permissions` — DRIFT-03) |

### Documents

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /documents` | ✅ | ✅ |
| `GET /documents/search` | ✅ | ✅ (returns nothing while OCR fails — DRIFT-06) |
| `GET /documents/:id` | ✅ | ✅ |
| `POST /documents` | ✅ | ✅ |
| `PATCH /documents/:id` | ✅ | ✅ |
| `POST /documents/:id/checkout` | ✅ | ✅ |
| `POST /documents/:id/checkin` | ✅ | ✅ |
| `GET /documents/:id/metadata` | ✅ | ✅ |
| `PUT /documents/:id/metadata` | ✅ | ✅ (cannot clear values — see backend analysis) |
| `GET /documents/:id/versions` | ✅ | ✅ |
| `GET /documents/:id/versions/:versionId` | ✅ | ✅ |
| `POST /documents/:id/versions` | ✅ | ✅ |
| `POST /documents/:id/comments` | ❌ **no such route** | 🔴 **DRIFT-08** |
| `POST /documents/:id/signatures` | ❌ **no such route** | 🔴 **DRIFT-08** |
| — | `DELETE /documents/:id` (archive) | ⚠️ backend only, UI never calls it |
| — | `POST /documents/:id/versions/:versionId/restore` | ⚠️ backend only |

### Workflows, instances, tasks

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST /workflows`, `GET/PATCH /workflows/:id` | ✅ | ✅ |
| `POST /workflows/:id/publish` `/archive` | ✅ | ✅ |
| `GET /workflow-instances`, `GET /workflow-instances/:id` | ✅ | ✅ |
| **`POST /workflow-instances/start`** | ❌ backend is `POST /workflow-instances` **then** `POST /:instanceId/start` | 🔴 **DRIFT-09** |
| `POST /workflow-instances/:id/hold` `/resume` `/close` | ✅ | ✅ |
| `GET /tasks`, `GET /tasks/:id` | ✅ | ✅ |
| `POST /tasks/:id/action` | ✅ | ✅ |
| `PATCH /tasks/:id/reassign` | ✅ | ✅ |
| — | `GET/POST /delegations`, `POST /delegations/:id/end` | ⚠️ backend only — **no UI at all** |
| — | `GET /workflow-history`, `GET /workflow-history/:id` | ⚠️ backend only — **no UI at all** |

**DRIFT-09 detail:** `workflowInstancesService.start()` posts to `/workflow-instances/start`
with `{workflowId, documentId}`. Inside `workflowInstancesRouter` the registered POST routes
are `/` and `/:instanceId/start` — a single segment `/start` matches neither, so this 404s.
Routing a document to a workflow is a **two-call sequence**:
`POST /workflow-instances` (create) → `POST /workflow-instances/:id/start`.
**Document routing does not currently work from the UI.**

### Identity

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST /users`, `GET/PATCH/DELETE /users/:id` | ✅ | ✅ |
| `POST /users/:id/roles`, `DELETE /users/:id/roles/:roleId` | ✅ | ✅ |
| `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id` | ✅ | ✅ |
| `PUT /roles/:id/permissions` | ✅ | ✅ |
| `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` | ✅ | ✅ |

### Filing

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST/PATCH/DELETE /cabinets(/:id)` | ✅ | ✅ |
| `GET/POST /cabinets/:cabinetId/folders` | ✅ | ✅ |
| `GET/PATCH/DELETE /folders/:id` | ✅ | ✅ |
| — | `POST/PATCH/DELETE /cabinets/:id/metadata-fields` | ⚠️ backend only — **no UI** |
| — | `GET/POST /cabinets/:id/access`, `DELETE /:id/access/:grantId` | ⚠️ backend only — **no UI** |

The cabinet-access gap is worth calling out twice: `CabinetAccess` is the table that makes
per-cabinet need-to-know work, the backend exposes full CRUD for it, and **no screen in the
product can grant or revoke a cabinet permission.** The Cabinet Designer at
`/admin/cabinets` manages cabinets but not their access grants.

### Modules with no backend at all

| Frontend service | Endpoints called | Backend | Status |
|---|---|---|---|
| `notifications.service.ts` | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/mark-all-read`, `POST /notifications` | **module directory is empty** | 🔴 **DRIFT-10** |
| `audit.service.ts` | none — returns `SEED.audit` after a 400 ms `setTimeout` | **module directory is empty** | 🔴 **DRIFT-11** |
| `policies.service.ts` | none — returns `SEED.policies` | **module directory is empty** | 🔴 |
| `branding.service.ts` | none — returns `SEED.branding` | no module, no schema | 🔴 |
| `circulars.service.ts` | none — returns `SEED.circulars` | no module, no schema | 🔴 |

**DRIFT-10 (notifications):** the four endpoints are called for real via `apiClient` and
will 404. Compounding it, the backend has **no JSON 404 handler** — `app.ts` mounts
`errorHandler` (a 4-arg error middleware, skipped on the happy path) and nothing else, so
Express returns its default **HTML** body. The frontend's axios then tries to read
`.data.data` off an HTML string. The staff dashboard's notification panel and the bell
badge are permanently broken, and the failure mode is a confusing parse error rather than
a clean 404.

**DRIFT-11 (audit):** more serious than it looks. The backend `audit_entries` table is
designed as a hash-chained, append-only compliance trail (`prevHash`/`entryHash`,
INSERT-only DB role). **Nothing in the backend ever writes to it** —
`src/middlewares/audit.middleware.ts` is a 0-byte file and there are zero references to
`auditEntry` in `src/`. Meanwhile the auditor portal renders `SEED.audit` and
`useCreateAuditLog()` resolves successfully without doing anything. **The compliance
story of the product is currently a mock on both sides.**

### 🟡 Backend capabilities with no UI

Worth a backlog line each:

- `POST /documents/:id/versions/:versionId/restore` — version rollback
- `DELETE /documents/:id` — archive
- `GET/POST /cabinets/:id/access` — the entire cabinet-permissions model
- `POST/PATCH/DELETE /cabinets/:id/metadata-fields` — custom metadata schema designer
- `GET/POST /delegations`, `POST /delegations/:id/end` — out-of-office delegation
- `GET /workflow-history` — the immutable stage-transition timeline

---

## 8. Contract-shape drift (same URL, different meaning)

These are worse than 404s because they fail *quietly*.

### 8.1 `roles` is sometimes a string, sometimes an object

`src/types/models.ts` documents this honestly:

```ts
export interface User {
  roles?:     { id: string; name: string; … }[];
  /** What `GET /users` actually returns — the join rows, not a flat `roles` array. */
  userRoles?: { userId: string; roleId: string; role: Role }[];
}
export interface AuthUser {
  roles: string[];        // ← login/me return plain strings
}
```

So `AuthUser.roles` is `string[]` but `User.roles` is an object array, and `GET /users`
actually returns neither — it returns `userRoles` join rows
(`users.repository.ts` `USER_SELECT`). `src/app/page.tsx:32-36` already carries a defensive
shim for this (`typeof roles[0] === 'string' ? roles[0] : roles[0].name`). Consumers must
each handle three shapes.

**Fix:** have `GET /users` flatten to `roles: string[]` to match `AuthUser`, or introduce
one `normalizeRoles()` helper and route every read through it.

### 8.2 Enum casing

| Concept | Backend | Frontend `SEED` / `initialData.ts` |
|---|---|---|
| Confidentiality | `public` `internal` `confidential` `restricted` `top_secret` | `Public` `Internal` `Confidential` `Restricted` `Top Secret` |
| Urgency | `low` `normal` `high` `critical` | `Low` `Normal` `High` `Critical` |
| Status | `pending` `in_progress` `on_hold` `closed` | `Pending` `In Progress` `On Hold` `Closed` `Overdue` |

The upload page maps between them by hand (`CONF_LEVELS` with explicit
`{label, value}` pairs) — correct, but done locally in one component. Every other page
that renders a badge or filters a list is comparing against whichever casing its data
source happens to use.

#### 🔴 DRIFT-13 — `effStatus()` is a no-op on all real data

`Overdue` is a frontend-only status. It is computed by `effStatus()`, of which there are
**two divergent implementations**, both exported and both in use:

```ts
// src/store/useStore.ts:235          — imported by supervisor/bottlenecks, search,
                                      //   staff/cabinets, staff/performance, supervisor
export const effStatus = (doc: any) => {
  if (doc.status === 'Closed' || doc.status === 'On Hold') return doc.status;
  if (doc.due && doc.due < Date.now()) return 'Overdue';   // epoch ms
  return doc.status;
};

// src/utils/helpers.ts:1             — imported by staff, staff/tasks, TaskRow
export function effStatus(doc: any) {
  if (doc.status === 'Closed') return 'Closed';
  if (doc.status === 'On Hold') return 'On Hold';
  if (doc.dueDate && Date.now() > Date.parse(doc.dueDate)) return 'Overdue';  // ISO string
  return doc.status;
}
```

Both are broken against backend data, for two independent reasons:

1. **The backend `Document` model has no due-date field at all.** `grep due` over
   `filing.prisma` returns nothing. `Task` has `dueAt` and `WorkflowInstance` has
   `stageDueAt`, but documents do not. So `doc.due` and `doc.dueDate` are always
   `undefined` and the `Overdue` branch is unreachable.
2. **The status comparisons are capitalized** (`'Closed'`, `'On Hold'`) while the backend
   emits lowercase (`'closed'`, `'on_hold'`), so the early returns never fire either.

**Net effect: `effStatus()` is an identity function on every API-sourced document.** It
only works on `SEED` fixtures, which use capitalized statuses and epoch `due` values.

This is the mechanism behind "the ageing and SLA views look wrong". Eight call sites —
`supervisor/bottlenecks`, `supervisor`, `staff`, `staff/tasks`, `staff/cabinets`,
`staff/performance`, `search` and `components/ui/TaskRow` — all show a permanent zero for
overdue counts, badges and buckets against real data.

**Fix:** delete one of the two implementations; derive overdue from the task's `dueAt` or
the instance's `stageDueAt` (which do exist); and normalise status casing at the API
boundary. Consider adding a due date to `Document` if document-level deadlines are wanted
— the upload form already collects one and throws it away.

### 8.3 `top_secret` is settable but unreadable

The backend's Zod schema accepts `top_secret`, but
`TOP_SECRET_TIER_ROLES` in `access-control.constants.ts` is `[]` **by design**. A document
uploaded at that tier becomes permanently unreadable by every role including
`client_admin`. The frontend upload form (`upload/page.tsx` `CONF_LEVELS`) correctly omits
it — but `PATCH /documents/:id` accepts it, and the doc-detail edit form is driven by
`usePolicies()` → `SEED.policies.confidentiality`, which **does** include `Top Secret`.

**Fix:** backend should reject `top_secret` on write until a role is cleared for it, and
should verify the writer's clearance for whatever tier they assign.

### 8.4 Date/number types

`DocumentVersion.fileSize` is a Prisma `BigInt`. `app.ts` installs a JSON replacer
converting `bigint` → `Number`, so the wire format is a JS number — fine below 2^53, and
undocumented in Swagger. All timestamps are ISO strings from `@db.Timestamptz`; the
frontend `SEED` uses epoch milliseconds (`d()` helper in `initialData.ts`). Any component
reading both must handle both.

---

## 9. Configuration & environment drift

### `EDMS-FRONTEND/.env`

```env
API_URL=https://edms-backend-zmfm.onrender.com     # unused by any code
LOCAL_API_URL=                                      # unused
STAGING_URL=https://edms-kappa.vercel.app/          # unused
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=                                # ⚠️ duplicate key — this one wins
```

`NEXT_PUBLIC_API_URL` is declared twice; the later (empty) assignment wins. Because an
empty string is falsy, both `api-client.ts` and `auth.server.ts` fall through to their
`|| 'http://localhost:3001'` default — so it **works by accident** and will break the day
someone "fixes" the duplicate by deleting the wrong line. `API_URL`, `LOCAL_API_URL` and
`STAGING_URL` are dead keys not referenced anywhere in `src/`.

Note also that `auth.server.ts` — which runs **server-side** in the route handler — reads
`NEXT_PUBLIC_API_URL`. That works, but it means the backend URL used for server-to-server
calls is baked into the client bundle. A separate non-public `API_URL` would be correct.

### Port alignment

| Process | Port | Set where |
|---|---|---|
| Next.js dev | 3000 | Next default |
| Express | 3001 | `edms-backend/.env` `PORT=3001` |
| Frontend expects backend at | 3001 | `api-client.ts` fallback |

✅ Aligned. But `env.ts`'s **schema default is `3000`** — a deploy without an explicit
`PORT` collides with the frontend.

`ALLOWED_ORIGINS` defaults to
`http://localhost:3000,http://127.0.0.1:3000,https://edms-kappa.vercel.app` — correct for
local dev and the Vercel staging origin.

### 🟠 DRIFT-12 — The login page's test accounts do not exist in the backend

`src/app/page.tsx` renders two rows of autofill buttons:

| Set | Emails | Exists in `prisma/seed.ts`? |
|---|---|---|
| Set 1 | `chika@firstatlantic.com`, `david@…`, `eniola@…`, `bola@…`, `femi@…`, `adaeze@schulltech.com` | ❌ No — these are `initialData.ts` fixture personas |
| Set 2 | `boyebamiji+staff@schulltech.com` … password `Fixture123!` | ❌ No — the seed creates `tjoel+…` addresses |

The backend seed actually creates, all with password `Fixture123!`:

```
tjoel+staff_finance@schulltech.com        → staff
tjoel+staff_hr@schulltech.com             → staff
tjoel+supervisor_finance@schulltech.com   → supervisor
tjoel+management_ops@schulltech.com       → management
tjoel+clientadmin@schulltech.com          → client_admin
tjoel+schulltechadmin@schulltech.com      → schulltech_admin
tjoel+auditor@schulltech.com              → internal_auditor
```

**Every autofill button on the login screen fails against a freshly seeded backend.**
This is a 10-minute fix and it is the first thing every new developer hits.

### 🟠 Backend build is currently broken locally

`npx tsc --noEmit` fails with one error at `auth.middleware.ts:56` —
`Property 'scope' does not exist`. The generated Prisma client in `node_modules` (20 Aug,
00:35) predates the `add_scope_to_role_permission` migration (20 Aug, 09:35).

CI passes because `.github/workflows/ci.yml` runs `npx prisma generate` first. Local dev
via `tsx` skips type-checking entirely — so at runtime `rp.scope` is `undefined`, every
permission string becomes `"document:view:undefined"`, `requirePermission` still passes
(the prefix matches) but sets `permissionScope = 'undefined'`, which `applyAccessScope`
treats as the `department` branch. **Every user is silently narrowed to department scope
until someone runs `npx prisma generate`.** Frontend symptom: global-scope roles see
suspiciously few documents.

---

## 10. Drift register — ranked, with owners

| ID | Severity | Title | Owner | Blast radius |
|---|---|---|---|---|
| DRIFT-05 | 🔴 **Critical** | 23 workflow routes have zero permission checks | Backend | Any staff user can publish/archive workflow definitions and drive any instance |
| DRIFT-11 | 🔴 **Critical** | Audit trail unimplemented on both sides | Backend | The product's compliance claim is a mock; `audit_entries` is never written |
| DRIFT-06 | 🔴 **Critical** | Upload target ≠ Textract source bucket | Both | OCR always fails → search index never built → search silently returns nothing |
| DRIFT-02 | 🔴 High | Frontend route guard is client-side only, no `middleware.ts` | Frontend | Any role forgeable via localStorage; fully exposes all `SEED`-backed portals |
| DRIFT-09 | 🔴 High | `POST /workflow-instances/start` 404s | Frontend | Document routing to a workflow does not work from the UI |
| DRIFT-10 | 🔴 High | Notifications module missing; no JSON 404 handler | Backend | Bell badge + notification panel permanently broken with a parse error |
| DRIFT-03 | 🔴 High | `resource:action` vs `resource:action:scope` | Both | Latent — detonates the moment `/auth/me` returns `permissions` |
| DRIFT-01 | 🟠 Med | `POST /auth/logout` missing | Backend | Refresh token stays valid 7 days after "logout"; no revocation |
| DRIFT-08 | 🟠 Med | `/documents/:id/comments` + `/signatures` 404 | Backend | Two prominent doc-detail actions fail |
| DRIFT-04 | 🟠 Med | Frontend role heuristics contradict backend grants | Frontend | `schulltech_admin` and `management` UIs promise rights they don't have |
| DRIFT-12 | 🟠 Med | Login test accounts don't exist | Frontend | Every autofill button fails; blocks new-dev onboarding |
| — | 🟠 Med | Prisma client stale → all users forced to `department` scope | Backend | Run `npx prisma generate` |
| DRIFT-13 | 🟠 Med | `effStatus()` is a no-op on real data — two divergent copies, no `due` field on `Document`, capitalized status compares | Frontend | Every overdue count, badge and ageing bucket is permanently zero across 8 call sites |
| DRIFT-07 | 🟡 Low | Client-side aggregation via `fetchAllPages` | Backend | Management dashboards fire up to 50 sequential requests |
| — | 🟡 Low | `top_secret` settable but unreadable by anyone | Backend | Documents can be permanently orphaned |
| — | 🟡 Low | Cabinet access-grant CRUD has no UI | Frontend | Need-to-know model unusable in the product |
| — | 🟡 Low | Enum casing mismatch (`Pending` vs `pending`) | Both | Badge/filter mismatches on mixed-source pages |
| — | 🟡 Low | `roles` has three shapes across endpoints | Both | Defensive shims scattered through components |
| — | 🟡 Low | Duplicate `NEXT_PUBLIC_API_URL` in `.env` | Frontend | Works by accident; a trap |

### Suggested order of attack

**Week 1 — stop the bleeding (backend)**
1. `npx prisma generate` (2 minutes, unblocks the build and un-narrows every scope)
2. Add `requirePermission` to all 23 workflow routes + role checks in
   `definitions.service` / `instances.service` (DRIFT-05)
3. Add a JSON 404 handler to `app.ts` so missing routes fail legibly (DRIFT-10 half)

**Week 1 — stop the bleeding (frontend)**
4. Fix `workflowInstancesService.start()` to do the two-call create-then-start (DRIFT-09)
5. Fix the login test-account emails to the `tjoel+…` set (DRIFT-12)
6. Make `usePermissions` parse three-segment strings **before** anyone touches
   `/auth/me` (DRIFT-03)

**Weeks 2–3 — make the core real**
7. Presigned upload endpoint + async Textract + unconditional search indexing (DRIFT-06)
8. Build the audit module and call `AuditService.log()` from every mutating service
   (DRIFT-11)
9. Build the notifications module and wire the SLA worker to it (DRIFT-10)
10. `middleware.ts` for server-side route protection (DRIFT-02)

**Week 4+ — close the feature gaps**
11. Aggregation/reporting endpoints, then delete `fetchAllPages.ts` (DRIFT-07)
12. Cabinet access-grant UI; comments + signatures endpoints (DRIFT-08)
13. Circulars, policies and branding — currently mock on both sides
