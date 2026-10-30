# 01 — Architecture & Frontend↔Backend Drift

**Status:** Written 2026-08-29 against `EDMS-FRONTEND` @ `src/` (15,862 LOC) and `edms-backend` @ `tolu` branch, commit `2c8b901` (11,393 LOC).

**Revised 2026-09-04 (morning)** against `edms-backend` @ `dev` (`b72e0bf`, 83 routes) and
`EDMS-FRONTEND` @ `dev` (`f02c7b8`):

| Was | Now |
|---|---|
| DRIFT-09 — routing 404s | ✅ **Resolved** — two-call sequence shipped and wired |
| DRIFT-10 — notifications module missing | 🟨 **Revised** — module and UI both exist; **nothing emits** *(→ ✅ emits since 2026-09-21)* |
| DRIFT-05 — 23 workflow routes unguarded | 🔴 recounted to 25 *(→ ✅ resolved the same evening)* |

**Re-scanned 2026-09-04 (evening)** against `edms-backend` @ `dev` (`e60c418`,
**90 routes** over 9 routers, 45 permissions) and `EDMS-FRONTEND` @ `dev` (`aec7863`,
**46 pages**). The backend moved substantially — `feat(workflow): close workflow gaps 1-10`
plus two OCR commits — and **the single most urgent finding in this document is now
fixed**:

| Finding | Change | Where |
|---|---|---|
| DRIFT-05 — workflow routes unguarded | ✅ **RESOLVED** — every workflow service now enforces roles | [§4](#4-authorization-four-independent-layers) |
| DRIFT-06 — OCR reads the wrong bucket | 🔄 **Owner flips to Frontend** — the backend half is now correct | [§5](#5-the-document-storage-path-and-why-ocr-cannot-work) |
| DRIFT-07 — client-side aggregation | 🔄 **Owner flips to Frontend** — 8 aggregation endpoints now exist | [§10](#10-drift-register--ranked-with-owners) |
| **DRIFT-14 (new)** | 🔴 Workflow definitions are now **admin-only to read**, which breaks routing for the roles that are granted it | [§4](#4-authorization-four-independent-layers) |

> ⚠️ *(Superseded 2026-09-21 — the router now has 40 `requirePermission` calls across 39
> routes, re-counted 2026-10-15; kept for history.)* ~~**Do not re-derive DRIFT-05 from a
> route-level grep.** `requirePermission` still appears **0 times** in
> `workflows.router.ts`~~, and that no longer means what it used to.
> Authorization moved into the **service layer** — `definitions.service.ts`,
> `instances.service.ts`, `tasks.service.ts`, `delegations.service.ts` and
> `sla.service.ts` each assert roles and throw `403` with a named code. Grep for
> `_FORBIDDEN` rather than `requirePermission` when checking the workflow module.

Route counts throughout this document were 74 when written, 83 this morning, and **90**
then. Counts below have been updated.

**Re-scanned 2026-09-21** against `edms-backend` @ `dev` (`b1b0b68`, **106 routes**
over 10 routers). The workflow module moved from service-layer-only enforcement to
real `requirePermission()` checks at the router (all 5 `_FORBIDDEN` service checks from
DRIFT-05 are still there too, so it's now defended in both places), notifications
started actually firing, and a fresh audit turned up one severe frontend-only
regression that this scan's earlier passes never tested for:

| Finding | Change | Where |
|---|---|---|
| **DRIFT-16 (new)** — frontend route guard referenced permission keys no backend role can ever hold | ✅ **Resolved (frontend, 2026-09-21)** — real supervisors and management users were being redirected to `/unauthorized` by the app's own guard | [§4](#4-authorization-four-independent-layers) |
| DRIFT-14 — workflow definitions unreadable by the roles that route documents | 🔄 **Re-diagnosed** — the hardcoded role list is gone, but the RBAC seed data that replaced it has the same gap. **Owner: Backend**, unchanged *(→ 🟠 latent 2026-10-16: the live tenant holds the grant; only the seed lacks it)* | [§4](#4-authorization-four-independent-layers) |
| DRIFT-10 — nothing ever called `notifyUser` | ✅ **RESOLVED** — task assignment, reassignment, delegation, access-request grant/deny and SLA warning/breach all notify now | [§7](#7-the-complete-api-drift-matrix) |
| DRIFT-07 — client-side aggregation via `fetchAllPages` | ✅ **RESOLVED (frontend)** — the four management dashboards and Performance Overview now read the server aggregation endpoints directly; `useAllTasks`/`useAllWorkflowInstances` and `tasksService.getAllPages` deleted as dead code | [§6](#6-state-architecture-on-the-frontend) |
| **New** — `auditor/trail` never stopped loading | ✅ **Resolved (frontend, 2026-09-21)** — an unmemoized `Date.now()` changed the query key every render | [§7](#7-the-complete-api-drift-matrix) |
| DRIFT-13 (partial) — `effStatus()` no-op | ✅ **Resolved (frontend, 2026-09-21)** — two broken implementations deleted; task rows use the already-correct (but previously unimported) `taskStatusLabel`/`isOverdue`; document rows get a proper status-only label with no fabricated `Overdue` | [§6](#6-state-architecture-on-the-frontend) |
| Cabinet access-grant CRUD "has no UI" | ✅ **Corrected — already built.** `admin/cabinets` has a full "Access" card (grant modal, revoke button) wired to `useCabinetAccessGrants`/`useGrantCabinetAccess`/`useRevokeCabinetAccess`. The doc's claim was stale, not the product. | [§7](#7-the-complete-api-drift-matrix) |
| **DRIFT-06 — retracted.** Live-verified 2026-09-21 against the deployed backend: OCR works. The "third-party gateway writes to a bucket Textract can't read" claim was never checked against a real document and was wrong — every real upload's `fileUrl` resolves to `env.S3_BUCKET`. One document out of eight was stuck at `ocrStatus: 'pending'` for 3 days — a real, narrower reliability gap, not the systemic break this doc previously asserted. | 🟡 **Re-diagnosed**, no backend fix built (the planned one would have solved a non-problem) | [§5](#5-the-document-storage-path-and-why-ocr-cannot-work) |
| **Upload mechanism — the whole "what the code does" step 1 was describing dead code.** The chunked multipart uploader (`uploader.ts`/`useMultipartUploader.ts`) replaced the single-shot base64 flow on **2026-08-31** — two days after this doc's original 2026-08-29 write-up. Every revision since (both 2026-09-04 scans, 2026-09-18, 2026-09-21) kept describing the pre-08-31 mechanism; `s3.service.ts#uploadFile()` has had zero real callers this entire time. Found while checking whether the upload progress bar reflects real percentages (it does — real `XMLHttpRequest` byte progress per 5 MB part, not simulated) | ✅ **Corrected (frontend, 2026-09-21)** — no behavior changed, only the documentation | [§5](#5-the-document-storage-path-and-why-ocr-cannot-work) |

> **Re-checked 2026-10-16** against `edms-backend` `origin/dev` (`a88f279`) and the live API,
> signed in as the seeded `tjoel+…` test accounts. Three statements below were wrong:
>
> - **DRIFT-14 does not block the live tenant.** `staff_finance`, `supervisor_finance`,
>   `management_ops` and `auditor` all hold `workflow:view:global`, and `GET /workflows`
>   returns 200 for each — which is why staff routing worked in the 2026-10-08 test. The seed
>   still lacks those rows, so a freshly seeded database would show the bug. Downgraded from
>   🔴 Critical to 🟠 latent; see the DRIFT-14 section.
> - **DRIFT-19 is resolved.** Deadlines in the task and workflow lists and the on-time
>   endpoint (`GET /sla/outcomes/summary`) shipped in backend PR #50 (live 2026-10-13); §7
>   already said so, but the register still listed them as missing.
> - **DRIFT-10b re-confirmed live:** an unknown route returns a `text/html` 404.

This document describes **what actually exists in the code today**, not the target design.
Where the two systems disagree, the disagreement is named explicitly and marked with a
severity. Nothing here is aspirational — every claim is anchored to a file and line.

> ⚠️ **Supersedes `../../out/DOCUMENTATION.md` and `../../out/USER_FLOWS.md`.**
> Those two documents describe endpoints that were never built
> (`POST /documents/:id/route`, `POST /workflows/instances/:id/approve`,
> `POST /users/invite`, `POST /circulars/:id/ack`) and a
> `multipart/form-data` upload path that does not exist. Treat them as design
> intent from an earlier phase, not as a description of the system. (`POST /circulars`
> was later built, as a *draft* create with a separate publish step; acknowledgement is
> `POST /circulars/inbox/:id/acknowledge` — see §7 Circulars.)

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
│   │ • 1,466 lines of │   │ • tasks           │   │                         │  │
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
│  Sole responsibility:         │              │  149 routes over 12 modules (10-29)    │
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
                                               │      • delegation-reconcile (5 min)    │
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
| Web app | `EDMS-FRONTEND` | Next.js 16.2.10 / Node | 3000 | App Router, `(app)` route group, 64 pages (60 authed + 4 public: `/`, `/forgot-password`, `/set-password`, `/user-stories`) — re-counted 2026-10-29 (+5: the `/control-exceptions` pages); 59 on 2026-10-20, 58 on 2026-10-15, 46 before |
| API | `edms-backend` | Express 5.2 / Node | 3001 (`PORT` in `.env`) | 149 routes over 12 router files — re-counted 2026-10-29 (140 on 2026-10-26, 134 on 2026-10-15, 90 before). Swagger at `/api-docs` |
| Worker | `edms-backend` | `node dist/worker.js` | — | Separate process; OCR + search + SLA + out-of-office delegation (since `436ea83`, 2026-10-29) |
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

### Path B — everything else (132 routes, re-counted 2026-10-15; was 66)

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

**Note the asymmetry.** Only 3 routes go through the Next.js server (login, refresh and
logout — and the backend has no logout route, DRIFT-01). The other 132 backend routes are
plain browser→Express cross-origin calls *(re-counted 2026-10-15; was "the other 71")*. There is no SSR data fetching anywhere in the
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

**Update 2026-09-10 (frontend).** The Sidebar "Sign out" button previously only did
`setCurrentUser(null)` + redirect. It now `await`s `authService.logout()` — which POSTs
`/api/auth/logout` **with the `Authorization: Bearer` header** — then clears the React
Query cache and the local session. The BFF route deletes the `refreshToken` cookie and
forwards to the backend. So the frontend side of BE-2 is done; the backend route and a
refresh-token denylist are still outstanding, so the token remains cryptographically
valid until it expires.

**What actually breaks:** the refresh token remains cryptographically valid for its full
7 days. Because the backend has no denylist, revocation table, or rotation, a refresh
token captured before "logout" still mints access tokens afterwards. The backend also
defines a `user.logout` audit action in `workflow.constants.ts` that can never be
written.

**Fix:** either build `POST /auth/logout` with a refresh-token denylist (Redis is already
a dependency), or delete the call and document that logout is client-side only.

### ✅ DRIFT-15 — `POST /auth/reset-password` sent the wrong field name — **Resolved (frontend 2026-09-18)**

`auth.service.ts#resetPassword` sent `{ token, newPassword, confirmPassword }`. The
backend's schema requires `{ token, password }` — confirmed live against
`edms-backend-zmfm.onrender.com`:

| Payload | Result |
|---|---|
| `{token, newPassword, confirmPassword}` (old) | `422 VALIDATION_ERROR` — `"password": "Invalid input: expected string, received undefined"` |
| `{token, password}` (correct) | Passes validation; reaches the token check (`400 INVALID_OR_EXPIRED_TOKEN` on a bogus token, as expected) |

**Blast radius was total.** Per the backend's own description, this one endpoint is the
shared landing point for **both** flows — "consumes a one-time token from either an
invitation or a password-reset email." So until this fixed, **no user could ever
complete a password reset or accept an invitation**, regardless of role — the
`/set-password` page always failed at the final submit with no working path forward. This
predates today's session; it surfaced while wiring `POST /users/:id/invitation`
(the "Resend invite" feature — see §7 Identity), since that feature's emailed link lands
on this same page.

**What shipped:** `auth.service.ts#resetPassword` now sends `{ token, password }`;
`set-password/page.tsx` passes its `newPassword` field under that name.
`confirmPassword` was never a real backend field — password-match checking stays a
client-side-only guard before submit, as it already was.

Also removed a stale comment on `forgotPassword`/`resetPassword` claiming both were "not
in the deployed Swagger doc yet" — both are live and documented now;
`forgotPassword`'s `{ email }` payload was already correct.

---

## 4. Authorization: four independent layers

> **Note (2026-09-21).** A fifth layer — `src/proxy.ts` — was added after this
> section was named; kept as "Layer 0" below rather than renumbering 1-4, since
> several other sections of this document link to `§4` by this exact anchor.
> The heading undercounts by one; the content below doesn't.

Authorization is enforced in five places that do **not** know about each other. Understanding
which layer denies a request is the single most common source of confusion in this codebase.

```
┌─ LAYER 0 ── Server-side proxy (the real gate, added 2026-09-21) ───────────────┐
│ WHERE   src/proxy.ts — Next.js 16 renamed middleware.ts to proxy.ts; the        │
│         exported function is `proxy`, not `middleware` (heed the deprecation)  │
│ INPUT   GET /auth/me, called fresh on every protected navigation — never       │
│         cached, so a permission toggled off for a user takes effect on their   │
│         very next request, not after some staleness window                     │
│ EFFECT  redirect('/') on a CONFIRMED 401/403 (a responding backend says the     │
│         token is dead); redirect('/unauthorized') if evaluateRouteAccess()     │
│         (src/lib/routeAccess.ts — the same rule-matching Layer 1 uses) denies;  │
│         NextResponse.next() — fails OPEN, not closed — if the backend is       │
│         merely unreachable (network error / 5xx). See DRIFT-02 below for why   │
│         that distinction is the entire point, not a shortcut.                  │
│ TRUST   ✅ REAL. Runs before any page is served; reads nothing the browser     │
│         controls. Cannot be spoofed by editing localStorage.                   │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 1 ── Frontend route guard ──────────────────────────────────────────────┐
│ WHERE   src/components/layout/AppShell.tsx (a useEffect), config/routes.config │
│ INPUT   currentUser.permissions (resource:action keys) via routeConfig          │
│         anyPermissions/permissions; /platform still by role name                │
│ EFFECT  router.replace('/unauthorized')  (only once permissions have resolved)  │
│ TRUST   ⚠️ ZERO on its own — forgeable via localStorage exactly as before.      │
│         Layer 0 now backs it up for every real request, so what was the whole  │
│         control is now a same-tick UX nicety (this fires the instant           │
│         permissions resolve client-side; Layer 0 already redirected the        │
│         initial page load). See DRIFT-02 (resolved).                           │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 2 ── Frontend component guard ──────────────────────────────────────────┐
│ WHERE   src/hooks/usePermissions.ts, src/lib/permissions.ts, useNavigation      │
│ INPUT   currentUser.permissions (live from login/`/auth/me`; gaps topped up     │
│         from GET /roles by useHydratePermissions); SYSTEM_ROLE_PERMISSIONS      │
│         fallback pre-hydration                                                  │
│ EFFECT  renders/hides nav items & controls; picks the portal shell             │
│ TRUST   ⚠️ ZERO. Cosmetic only. DRIFT-03/04 format+heuristic issues fixed.      │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 3 ── Backend RBAC ──────────────────────────────────────────────────────┐
│ WHERE   middlewares/role.middleware.ts → requirePermission(resource, action)     │
│ INPUT   req.user.permissions, rebuilt from the DB on every request              │
│ EFFECT  403 FORBIDDEN, or sets req.permissionScope                              │
│ TRUST   ✅ REAL — used by 8 of 9 routers. Workflows enforce in-service instead. │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ LAYER 4 ── Backend row/instance-level filters ────────────────────────────────┐
│ 4a  RBAC scope    → documents.repository buildDocumentWhere / applyAccessScope  │
│                     own → createdBy = me; department → cabinet.departmentId     │
│ 4b  Confidentiality → requireConfidentiality middleware + tier allowlists        │
│ 4c  Cabinet grants  → requireCabinetAccess middleware (CabinetAccess table)      │
│ TRUST   ✅ REAL — but 4c is only on WRITE routes. See backend analysis.         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### ✅ DRIFT-02 — All frontend route protection was client-side and forgeable — **Resolved (frontend, 2026-09-21)**

*Original finding:* there was **no `middleware.ts`** anywhere in `EDMS-FRONTEND`. Route
guarding ran only in a `useEffect` inside `AppShell` against `currentUser`, rehydrated
from the `edms-state-v3` localStorage key. Editing that key to
`currentUser.roles = ['schulltech_admin']` unlocked every portal in the UI — contained for
API-backed pages (the backend re-derives roles from the JWT + DB and returns `403`), but
fully exposing every `SEED`-backed page (`/platform`, `/auditor`, most of `/admin`), since
that data never left the browser to begin with.

**What shipped:** `src/proxy.ts` — Layer 0 in §4 above. Every protected navigation now
resolves the user's real, live roles and permissions from `GET /auth/me` server-side,
before the page is served, and runs the exact same rule-matching `routeConfig` logic the
old client-only guard used (extracted into `src/lib/routeAccess.ts` — `evaluateRouteAccess()`
— so `AppShell` and `proxy.ts` share one implementation and can't drift apart). Editing
`localStorage` no longer has any effect on what the server actually sends back.

**The one design decision that took real thought: fail-open vs. fail-closed.** An
unreachable backend (network error, timeout, cold start, `5xx`) is not the same thing as a
token that's actually invalid. The first version of this treated them identically — any
failure to reach `/auth/me` redirected to `/` — which meant a routine backend blip logged
out every signed-in user on their very next navigation. That's a worse failure mode than
the forgeable guard it replaced, and it was caught by live-testing against a deliberately
unreachable backend before shipping, not by inspection. The shipped version distinguishes:
a **confirmed** `401`/`403` from a backend that's actually responding fails closed
(redirect — the token really is dead); a response that can't be obtained at all — network
exception, or any status the two auth calls don't explicitly recognize — fails **open**.
`AppShell`'s own separate "verify session" effect had the identical conflation bug
(a network error right after login forced a logout) and was fixed the same way, since it
runs independently of `proxy.ts` and would have undone the fix on the client side.

**What backs up a fail-open decision, so it isn't just "let the user in and hope":**
`SessionExpiredModal` (dismiss = logout, same as clicking "sign in again" — there's no
consequence-free way to close it, since a session that's actually dead has nothing
sensible to fall back to) fires only on the confirmed-401 path, replacing a silent
`Cookies.remove` + `window.location.href` in `api-client.ts`'s interceptor.
`ServiceUnavailableOverlay` watches for repeated infrastructure-level query failures
(network error or `5xx` — not ordinary `403`/`404`/`422`, which are a working backend
saying no) across *any* query via `QueryCache`'s global `onError`/`onSuccess`
(`react-query-provider.tsx`), and shows one calm "we're having trouble connecting"
message instead of a dashboard full of individually broken widgets — clearing itself
the moment any query succeeds again. **2026-10-28 (browser-verified, API calls blocked):**
"Try again" allows 3 failed checks; after the 3rd it is replaced by **Sign in again**, which
runs `performLogout` (the Sign out teardown) and lands on `/`. The count restarts each time
the overlay reappears.

**Live-verified** (headless Chromium against the actual dev server, not just `tsc`):
unauthenticated → protected page → redirected to `/`; login → correct portal; navigation
within a portal → `GET /auth/me` fires fresh on every request, confirmed via network log;
a role-gated page a role doesn't hold → `/unauthorized`; a garbage refresh token (backend
reachable, confirms rejection) → still redirects, confirming the fail-open change didn't
weaken the fail-closed path; and — the case that mattered most — a **real prior session
against a backend that's genuinely unreachable**: no redirect, no logout, the shell
rendered from cache, and `ServiceUnavailableOverlay` appeared after three failed queries.

### ✅ DRIFT-23 — "Your session ended" modal survived a re-login — **Resolved (frontend, 2026-10-14)**

`sessionExpired` (the flag behind `SessionExpiredModal`) was set in two places —
`api-client.ts`'s interceptor, when a 401 survived a failed refresh, and `AppShell`'s
`/auth/me` effect, on 401/403 — but cleared in only one: `performLogout`, which runs when
the user signs out or acts on the modal itself. **The proxy's redirect to `/` for a dead
token is not a logout**, so a session that ended by bounce left the flag `true`.

Reported symptom: the notification bell's `GET /notifications/unread-count` (polled every
60 s and on window focus) 401'd, the interceptor's `/api/auth/refresh` 401'd, the user was
bounced to `/`, and after signing in the "session ended" modal covered the app. Nothing was
wrong with the *new* session — the modal was the old session's flag, which had outlived the
condition it described. `useUIStore` isn't persisted, so the flag survives exactly as long
as the tab does, which is why only an in-page logout → login showed it.

Fix: clear the flag where a session *begins* rather than only where it ends —
`authService.login()`'s success block (next to `invalidateInFlightAuth`, the same "the
session changed" boundary the refresh epoch uses) and `AppShell`'s `/auth/me` success path,
so a live `/auth/me` also retires a flag left by an earlier 401.

**Verified live 2026-10-14** (headless Chromium against the dev server, session killed in
place with `POST /api/auth/logout` + a garbage `accessToken` cookie, then the bell's 60 s
poll): `401 /notifications/unread-count` → one `401 /api/auth/refresh` → modal; a
**client-side** navigation then bounced through the proxy (`307 …/approvals?_rsc=…` →
`200 /`) onto the login screen with the stores still alive; signing in again showed
**no modal**. The counterfactual is what makes that meaningful — with **both** clears
disabled the modal reappears over the new session (`modalAfterLogin: 1`), which is the
report, and with either one enabled it doesn't. TEST_PLAN Phase Y (TP-Y1, TP-Y2).

### ✅ DRIFT-24 — A dead session could leave the app unopenable — **Resolved (frontend, 2026-10-14)**

Found while setting up the DRIFT-23 repro, and severe on its own. The store persists
`currentUser` to `localStorage` (no `partialize` — that's deliberate, so a reload doesn't
bounce a signed-in user out), but the login page treated it as proof of a session:
`if (currentUser) return null` plus a push to the portal home. With the cookie dead, the
proxy bounced that push back to `/`, and the page rendered `null` for as long as the stale
user was set.

Observed: `/` with a persisted `currentUser` and no valid session renders **nothing at all**
(`bodyTextLength: 0`), and it survives a reload — the only way in was clearing site data or
an incognito window. Reachable by anyone whose refresh token expires and who reloads the tab
or reopens a restored session; the proxy also left the dead `accessToken`/`refreshToken`
cookies in place, so every later request re-sent them.

Fix, in two parts that depend on each other:

1. `proxy.ts` deletes both auth cookies when it redirects for a **confirmed** dead session.
   It already tells "a responding backend rejected it" apart from "unreachable" — only the
   former deletes, so the documented fail-open behaviour is untouched.
2. The login page drops a persisted `currentUser` that has no `accessToken` cookie behind it,
   and renders the form.

**Verified live 2026-10-14:** `/supervisor` with a dead session → `307` to `/` with both
cookies deleted → login form renders, stale user cleared from `localStorage`. Before the fix
the same steps gave a blank page.

### ✅ DRIFT-03 — Permission string formats do not match — **Resolved (backend 2026-09-15)**

| Side | Format | Example | Source |
|---|---|---|---|
| Backend emits | `resource:action:scope` | `document:view:global` | `auth.middleware.ts:56` |
| Frontend compares | `resource:action` (scope parsed separately) | `document:view` | `src/lib/permissions.ts` |

*Original finding:* `usePermissions.ts` compared whole strings
(`p === "${resource}:${action}"`), so a three-segment `document:view:global` never
matched and the moment `/auth/me` returned a `permissions` array every `<Guard>` would
go dark.

*What shipped on the frontend (2026-09-10):*

- `src/lib/permissions.ts` — `normalizePermission()` drops the scope segment for
  gating; `parseScope()` keeps it; `permissionMatches()` compares only the first two
  segments and honours `*` wildcards.
- `usePermissions` now sources `currentUser.permissions`, exposes `can` / `hasAny` /
  `hasAll` / `scopeFor` / `isReady` / `portal`, and no longer has a role-name heuristic
  block (that was DRIFT-04). A small `SYSTEM_ROLE_PERMISSIONS` fallback approximates the
  six seeded roles only until real permissions load.

*What shipped on the backend (confirmed 2026-09-15):* `POST /auth/login` and
`GET /auth/me` both now return a scoped `permissions: string[]` array
(`"document:view:department"`, `"document_version:create:own"`, …), including
resources (`document_version`, `document_lock`, `document_metadata`, `department`, …)
outside the write-side enum — see `RolePermissionResource`/`RolePermissionAction` in
`types/models.ts`. This is the precise, per-user grant set and is written straight to
`currentUser.permissions` (`app/page.tsx` on login, `AppShell`'s `authService.me()`
callback thereafter).

`useHydratePermissions` (role-derived, un-scoped `resource:action` keys from
`GET /roles`) is now strictly a gap-filler on top of that live data, not the primary
source — it used to *replace* `currentUser.permissions` wholesale on any mismatch,
which would have silently discarded real scopes and per-user grants the moment the
backend started sending them. Fixed 2026-09-15 to only append derived keys that are
actually missing.

> **Why `GET /roles` keeps showing up in the network log (checked 2026-09-21, not a
> bug).** `useHydratePermissions` mounts once, app-wide, from `AppShell` — it does not
> remount on navigation, since `AppShell` lives in the `(app)` layout and Next.js
> layouts persist across route changes within a group. But `admin/roles`,
> `admin/workflows`, `admin/cabinets` and `admin/users` each *also* call `useRoles()`
> independently, sharing the same query key. React Query's default `refetchOnMount:
> true` means every fresh subscription to a stale query refetches in the background —
> invisible in the UI (cached data renders instantly while it revalidates) but visible
> in the network tab. With the query's default `staleTime` of 60s, navigating between
> admin pages (or just staying logged in for a minute) is enough to trigger this.
> Bumped `useRoles`' `staleTime` to 5 minutes 2026-09-21 — role definitions rarely
> change mid-session, and every mutation that changes them already invalidates the
> query on success, so a longer window doesn't risk showing stale data after an edit.
> It reduces the chatter; it doesn't (and shouldn't) eliminate an occasional background
> revalidation entirely — that's React Query doing its job, not a leak.

### 🟨 DRIFT-04 — The frontend's role heuristics contradict the backend's grants — **REVISED (frontend fixed 2026-09-10)**

The `usePermissions` role-name heuristic block described below was **deleted** on
2026-09-10. Gating now runs off `resource:action` permission keys
(`currentUser.permissions`, derived from `GET /roles`), and route rules
(`src/config/routes.config.ts`) declare `anyPermissions` / `permissions` instead of
`roles` — except `/platform`, which stays role-gated (`schulltech_admin`) because there
is no `platform` resource in the vocabulary. A `SYSTEM_ROLE_PERMISSIONS` map in
`src/lib/permissions.ts` still approximates the six seeded roles, but only as a
pre-hydration fallback, and its `client_admin` entry is the honest "all resources ×
all actions". The portal shell a user lands in is chosen by `resolvePortal()` — by role
name for the six built-ins (their permission sets overlap too much to disambiguate),
by entry permission for custom roles.

**Scope floors on routes (2026-10-13).** A rule's permission may carry a `minScope`
(`{ resource, action, minScope }`), as sidebar items already could: `evaluateRouteAccess`
then also requires the grant at that scope or wider, read from the raw
`"resource:action:scope"` keys (`/auth/me` in the proxy, the store in AppShell). A grant with no
known scope (the role-based approximation before `/auth/me` answers) passes, so nobody is
bounced on first paint; the API still enforces the scope. Used by `/supervisor/approvals`
(`task:action` + `task:view` at department, since `GET /tasks/approvals` 403s at `own`) and the
Workflow Monitor (`/supervisor/instances`, `/admin/workflows/instances`: `workflow_instance:view`
at department), and Team Performance (`/supervisor/performance`: `task:view` at department, which
all three of its calls need; it used to accept `task:view` at any scope or
`workflow_instance:view`). Verified live: `staff_finance` is sent to `/unauthorized` from both (Approvals
used to let them in); the Finance supervisor and client admin open both.

*Original finding, for history:*

`usePermissions.ts:26-31` grants `client_admin` **everything** except `resource === 'platform'`.
`routes.config.ts` gives `schulltech_admin` the entire `/platform` prefix.

The backend disagrees on both counts *(grant counts as of 2026-08-29; today's seed has 72 /
18 / 26 / 27 / 40 / 29 in this table's row order — see doc 03 Phase 1)*:

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
never granted. Those calls now fail correctly with a `403` (see DRIFT-05 below), so the
drift is cosmetic — the UI promises a right the backend refuses.

### ✅ DRIFT-05 — RESOLVED 2026-09-04

*The original finding:* `workflows.router.ts` contained **zero** `requirePermission`
calls, and neither `definitions.service.ts` nor `instances.service.ts` read roles at all.
Any authenticated user, including plain `staff`, could create, edit, publish or archive a
workflow definition and drive any instance. This was the highest-severity finding in the
pair of codebases.

*What shipped* (`feat(workflow): close workflow gaps 1-10`): authorization moved into the
**service layer**, where it now covers all five workflow services.

| Service | Asserts | Error codes |
|---|---|---|
| `definitions.service.ts` | `assertCanView` on list/getById; `assertCanManage` on create/update/publish/archive | `WORKFLOW_DEFINITION_VIEW_FORBIDDEN`, `WORKFLOW_DEFINITION_MANAGE_FORBIDDEN` |
| `instances.service.ts` | list, bottlenecks-ageing, team-status-matrix | `WORKFLOW_INSTANCE_LIST_FORBIDDEN`, … |
| `tasks.service.ts` | list, approval queue, workload, stats | `TASK_LIST_FORBIDDEN`, … |
| `delegations.service.ts` | list, create, end | `DELEGATION_*_FORBIDDEN` |
| `sla.service.ts` | breach list | `SLA_BREACH_LIST_FORBIDDEN` |

~~Role membership comes from `src/shared/constants/workflow.constants.ts` —
`WORKFLOW_DEFINITION_MANAGE_ROLES`, `WORKFLOW_OVERSIGHT_ROLES`,
`WORKFLOW_ORGANIZATION_WIDE_ROLES`, `TASK_REASSIGN_ROLES`.~~ *(Re-checked 2026-10-15: none
of these role lists exist in the backend any more. Since the 2026-09-16 RBAC refactor,
authorization comes from `workflow`, `workflow_instance`, `task` and `delegation`
permissions and their scope.)* A new `shared/utils/workflow-scope.ts` additionally narrows a
**pure supervisor** to their own department on reads, while leaving organisation-wide roles
unrestricted.

> ~~⚠️ **The route-level grep is now misleading.** `requirePermission` is still absent from
> all 32 workflow routes~~ — *superseded 2026-09-21:* `workflows.router.ts` now has 40
> `requirePermission` calls across its 39 routes (re-counted 2026-10-15), so the route-level
> grep is meaningful again, and the service-layer `_FORBIDDEN` checks remain as a second
> layer.

### 🟠 DRIFT-14 — Workflow definitions unreadable by the roles that route documents *(seed only — re-tested live 2026-10-16)*

**Re-diagnosed 2026-09-21.** The mechanism changed; the symptom didn't. The original
finding (below) was a hardcoded constant in the frontend-facing sense that
`WORKFLOW_DEFINITION_VIEW_ROLES` and `MANAGE_ROLES` were the same array. That constant
is **gone** — `src/shared/constants/workflow.constants.ts` no longer defines either
one, and its replacement comment says plainly: *"Authorization now comes from the
`task` and `workflow_instance` permissions and their scope, not from role names."*
`workflows.router.ts` now gates `GET /workflows` with a real
`requirePermission('workflow', 'view')` at the router — which is the architecturally
correct fix for DRIFT-05's original complaint that the workflow module had zero
router-level checks.

**But the RBAC seed data shipped in the same refactor (`4c07479`,
`refactor: retire  permission and update role permissions to reflect new structure`,
2026-09-16) dropped the `workflow` resource grant from every non-admin role.**
`prisma/seed-system.ts` now grants `workflow:view/create/edit/publish/archive` to
`client_admin` and `schulltech_admin` only. Before that commit, `staff` and
`supervisor` held `workflow:route` and `management`/`internal_auditor` held
`workflow:view` — all of that was deleted, replaced by grants on `workflow_instance`,
`task` and `delegation` instead, with no equivalent grant added back on `workflow`
itself.

Net effect, unchanged from the original finding: `staff`, `supervisor`, `management`
and `internal_auditor` still get a 403 from `GET /workflows`. `useRouteToWorkflow`
(`src/hooks/useRouteToWorkflow.tsx`, shared by `/upload`, `/staff/cabinets`,
`/doc/[id]` and `/search`) still shows its empty state — *"No published workflows. A workflow has to
be published in the Workflow Designer before anything can be routed to it"* — to
exactly the roles that do the routing.

**Re-checked 2026-10-15 against `edms-backend` `dev` `9998e05`: still open.** The seed
still grants `workflow:view` only to `client_admin` and `schulltech_admin`. One open
question: doc 04 records staff routing as confirmed in testing on 2026-10-08, which this
finding says a seeded staff account can't do. Either that test ran as an admin, or the live
database's grants differ from `seed-system.ts`. A re-test as
`tjoel+staff_finance@schulltech.com` would settle it.

**Re-tested live 2026-10-16 — settled: the live database differs from the seed.** Signed in
as `tjoel+staff_finance`, `supervisor_finance`, `management_ops` and `auditor`, each login
returns `workflow:view:global` in `permissions` and `GET /workflows` returns 200. Routing
works on the live tenant, and the 2026-10-08 test was right. The seed on `dev` (`a88f279`)
still grants `workflow:view` only to the two admin roles. `seed-system.ts` upserts
permissions and never deletes any, so the live rows are most likely left over from the
pre-2026-09-16 seed, which granted `workflow:view` — not proven, since that seed's
`workflow:route` grants are gone from the live tenant. **So nobody is blocked today, but a
freshly seeded database (a new tenant, a reset, a local setup) would hit this.** The seed fix
below is still the fix; it is a provisioning gap, not an outage. Downgraded from 🔴 Critical
to 🟠.

**Owner: Backend, unchanged.** This is not a frontend bug and there is nothing to fix
on this side — the frontend's `GET /workflows` call, its 403 handling, and its empty
state are all correct; the account genuinely doesn't have the permission. The fix is
one seed-data change: add `{ role, resource: 'workflow', action: 'view', scope:
'global' }` for `staff`, `supervisor`, `management` and `internal_auditor` in
`prisma/seed-system.ts`, mirroring what they already hold on `workflow_instance`.
`MANAGE` (`create`/`edit`/`publish`/`archive`) should stay `client_admin` +
`schulltech_admin` only — only `view` needs widening.

*Original finding, for history — the finding below predates the 2026-09-16 refactor
and no longer describes the current code, but the underlying gap it identified was
never actually closed:*

```ts
// src/shared/constants/workflow.constants.ts (removed 2026-09-16)
export const WORKFLOW_DEFINITION_MANAGE_ROLES = ['client_admin', 'schulltech_admin'];
export const WORKFLOW_DEFINITION_VIEW_ROLES  = WORKFLOW_DEFINITION_MANAGE_ROLES;
```

Read access was set equal to manage access. Two consequences:

**1. It breaks document routing for the roles granted it.** `staff` holds
`workflow:route:own` and `supervisor` holds `workflow:route:department`, but neither can
now call `GET /workflows`. The frontend's shared `useRouteToWorkflow` hook
(`src/hooks/useRouteToWorkflow.tsx`, used by `/upload`, `/staff/cabinets` and `/doc/[id]`)
lists definitions to build its picker and filters to `status === 'published'`. On a 403,
`data` is `undefined`, so `publishedWorkflows` is `[]` and the modal renders its empty
state:

> *"No published workflows. A workflow has to be published in the Workflow Designer before
> anything can be routed to it."*

**Which is not true, and not the reason.** A staff officer is told the organisation has no
workflows when in fact they are simply not allowed to see them. Routing is unreachable
again for exactly the roles that do it — a different cause from DRIFT-09, same outcome.

**2. It contradicts the seeded permission model.** `management` and `internal_auditor` are
both granted `workflow:view:global` in `prisma/seed-system.ts`, and both are refused by
this hardcoded list. The RBAC table says yes; the constant says no.

*(That constant-based fix no longer applies — see the 2026-09-21 re-diagnosis above for
the current fix: a seed-data change, not a code change.)* ~~**This remains the
highest-severity open finding**, because it silently disables the product's core loop.~~
*Re-tested 2026-10-16: it doesn't on the live tenant, which holds the grant (see above); it
would on a freshly seeded database.*

### ✅ DRIFT-16 — Frontend route guard referenced permission keys no backend role can hold — **Resolved (frontend, 2026-09-21)**

Two of the client-side route rules in `src/config/routes.config.ts` (Layer 1) and the
matching `PORTALS` entries in `src/lib/permissions.ts` (used by `resolvePortal` for
custom roles) gated on permission strings that do not — and in one case, never did —
correspond to anything the backend can issue:

| Rule | Gated on | Problem |
|---|---|---|
| `/supervisor` prefix | `workflow:route` | Retired by the same 2026-09-16 backend refactor that reshaped DRIFT-14 (see above) — split into `workflow_instance:route` / `task:*` / `delegation:*`. No role holds `workflow:route` in the current seed at all. |
| `/management` whitelist | `dashboard:view` | `dashboard` was never a real backend resource — zero hits anywhere in `permissions.constants.ts` or `prisma/seed-system.ts`. |

**Why this wasn't cosmetic, unlike the rest of DRIFT-02.** `usePermissions.ts` discards
the offline fallback the instant `currentUser.permissions` has any live entries
(`if (live.length > 0) return { granted: live }` — no merge with the fallback), and
both `/auth/login` and `/auth/me` have embedded real permissions since DRIFT-03 shipped
(2026-09-15). So for any account that has actually logged in, the fallback's
approximate grants — which is where `workflow:route` still meant something, pre-2026-09-16
— never apply. **A real `supervisor` visiting any `/supervisor/*` page, and a real
`management` user visiting `/management` or any of its six whitelisted subpages, was
being redirected to `/unauthorized` by the app's own guard** — nothing to do with what
the backend would actually allow.

**What shipped:** both rules now gate on permissions that exist and match what those
pages actually do — `/supervisor` on `anyPermissions: ['workflow_instance:route',
'task:action']`, `/management` on the union of what its pages fetch
(`document:view`, `workflow_instance:view`, `task:view`, `department:view`). The
`PORTALS` entries and the `SYSTEM_ROLE_PERMISSIONS` pre-hydration fallback in
`src/lib/permissions.ts` were updated to match, so the brief pre-hydration window is
consistent with the live data that immediately replaces it.

**Also fixed (2026-09-21, same pass):** `PERMISSION_RESOURCES` in `src/lib/permissions.ts`
and `MODULE_MAP` in `admin/roles/page.tsx` both listed a `dashboard` resource. Confirmed
against `permissions.constants.ts` on the backend: `dashboard` matches zero entries in
`SYSTEM_PERMISSIONS`, and `PUT /roles/:id/permissions` validates against exactly that
list (`SYSTEM_PERMISSION_KEYS` — "Unknown permission" on anything else) — so it would
have been rejected on write regardless. In practice this was already unreachable, not
just wrong: `admin/roles`'s permission matrix is data-driven from every role's *actual*
granted permissions (`GET /roles`), not from this static list, so `dashboard` could
never have appeared as an option — no role has ever been seeded with it. Removed from
both places as dead weight rather than left in.

**Known, not addressed in this pass:** `MODULE_MAP`'s `Workflow` group only lists
`resources: ['workflow']`. The newer `workflow_instance`, `task` and `delegation`
resources (see DRIFT-14 above) fall through to the matrix's "Other" bucket instead of
being grouped under "Workflow" — cosmetic, not incorrect.

---

## 5. The document storage path (and why OCR cannot work)

### What the code actually does

> ⚠️ **Correction (2026-09-21).** Step 1 below was wrong in every revision of this
> document, including the very first one. `src/apis/services/uploader.ts` and
> `src/apis/hooks/useMultipartUploader.ts` — the chunked multipart uploader now
> described below — were added **2026-08-31** (`aa11682`, "added multipart uploader"),
> **two days after this doc's original 2026-08-29 write-up**, and `upload/page.tsx` was
> wired to it in the same commit. Every subsequent revision (2026-09-04 morning,
> 2026-09-04 evening, 2026-09-18, 2026-09-21) kept describing the single-shot
> base64-to-gateway flow this replaced, and none of them noticed the switch. That old
> path — `s3.service.ts#uploadFile()` — is now **dead code**: zero callers anywhere in
> `src/` outside its own JSDoc example. Found while answering a question about whether
> the upload progress bar reflects real percentages (it does — see below).

```
1. Browser  src/app/(app)/upload/page.tsx  →  IDUCard.fileDoc()
   ├─ calculateChecksum(file.file)          SHA-256 via crypto.subtle              ✅
   └─ useMultipartUploader().startUpload({file, fileName, folderName:'edmsDocuments'})
        └─ Uploader  (src/apis/services/uploader.ts) — chunked multipart, 5 MB/part
             ├─ POST {gatewayBaseURL}/initialize      { name, contentType, folderName }
             │    → { fileId, fileKey }
             ├─ POST {gatewayBaseURL}/presigned-url   { uploadId, filePath, parts }
             │    → one presigned PUT url per part
             ├─ N × PUT <part bytes> → part.signedUrl   (5 concurrent, retry ≤6× w/
             │    XHR `upload.onprogress` → real sent/total → the % the UI bar shows    exponential backoff)
             ├─ POST {gatewayBaseURL}/finalize        { fileId, fileKey, parts:[{PartNumber,ETag}] }
             │    → { data: { Location } }             ← this becomes `fileUrl` below
             └─ documentsService.create({ …, fileUrl: Location, mimeType, fileSize, checksum })
                  └─ POST /api/v1/documents

   `{gatewayBaseURL}` — **correction, 2026-09-22**: this is a *different* third-party
   gateway from the old single-shot flow, not the same host with a different path as
   this section previously claimed. That claim was written from `useMultipartUploader.ts`'s
   hardcoded fallback default (`qerhd0lxje.execute-api.us-east-1.amazonaws.com`) without
   checking whether `.env` overrides it — it does. The live value is
   `NEXT_PUBLIC_UPLOAD_BASE_URL=https://4c73wdutl4.execute-api.us-west-1.amazonaws.com/staging/fileupload/multipart`
   (see §9) — a different host, in `us-west-1` rather than `us-east-1`, which is exactly
   the region the real uploaded documents' buckets resolved to during the DRIFT-06
   live-verification. Everything from here down is unaffected by which exact host this
   is; only the specific hostname claim was wrong.

2. Express  DocumentService.uploadDocument
   ├─ generateDocumentReference(db)        DOC-YYYYMMDD-HHmmss
   ├─ extractFileKey(input.fileUrl)        new URL(fileUrl).pathname minus leading '/'
   ├─ createDocumentWithFirstVersion(...)  document + version v1, in one transaction
   └─ ocrQueue.add('ocr', {documentId, versionId}, {attempts:3, backoff:exponential})

3. Worker   ocr.workers.ts  processOcrJob
   ├─ version.ocrStatus = 'processing'
   ├─ TextractClient.send(new StartDocumentTextDetectionCommand({
   │     DocumentLocation: { S3Object: { Bucket: env.S3_BUCKET, Name: fileKey } } }))
   ├─ pollUntilDone(JobId)                 polls GetDocumentTextDetectionCommand, ~5 min cap
   ├─ on success: ocrText saved, ocrStatus='completed', searchIndexQueue.add('index')
   └─ on failure: ocrStatus='failed', rethrow for BullMQ retry — see DRIFT-06 below for
        what actually happens when this job never runs at all

4. Worker   search-index.workers.ts
   └─ UPDATE documents SET search_vector = to_tsvector('english', title ‖ ocrText ‖ metadata)
```

### 🟡 DRIFT-06 — Re-diagnosed 2026-09-21: OCR works; retracting the "always fails" claim

**This finding was wrong, and it was wrong for exactly the reason the house rules at the
top of this doc set warn about: it was never verified end-to-end, only read from code.**
Every prior revision of this section (2026-09-04 morning through evening) reasoned from
the code — `s3.service.ts` posts to a URL outside `edms-backend`, therefore the file
"must" land somewhere other than `env.S3_BUCKET`, therefore Textract "must" fail. That
chain of *therefores* was never checked against a live document, and it was wrong.

**What live verification actually showed (2026-09-21).** Logged in as `client_admin`
against the deployed backend (`edms-backend-zmfm.onrender.com`) and pulled every
document via `GET /documents`:

| Document | `fileKey` | `ocrStatus` | Has `ocrText` | `fileUrl` resolves to |
|---|---|---|---|---|
| DN-2026-0921 delivery note | `edmsdocuments/DN-2026-0921_…pdf` | `completed` | ✅ (full real text) | `obj-uploads-staging.s3.us-west-1.amazonaws.com` |
| PO-2026-04417 purchase order | `edmsdocuments/PO-2026-04417_…pdf` | `completed` | ✅ | same bucket |
| INV-2026-1839 invoice | `edmsdocuments/INV-2026-1839_…pdf` | **`pending`**, unchanged since 2026-09-18 | ❌ | same bucket |
| 5 seeded fixture docs | `fixtures/doc-N.pdf` | `completed` | ✅ | same bucket |

The two `edmsdocuments/…` documents are real uploads through the actual browser →
gateway-multipart → `POST /documents` path described above (not seed data — the key
pattern matches exactly what that flow produces), and Textract successfully read and
OCR'd both of them.
Every `fileUrl` — a presigned GET the backend mints fresh on each request — resolves to
`env.S3_BUCKET` (`obj-uploads-staging`, `us-west-1`). **So the third-party gateway and
`env.S3_BUCKET` are, in practice, the same storage.** This document has no visibility
into *why* — that's the gateway's own Lambda configuration, which lives outside both
repos — only that the live result is consistent with them being connected, not the
"completely different, backend-configured bucket" this section previously asserted.

**What's real, from the same evidence:** `INV-2026-1839_invoice.pdf`, uploaded
2026-09-18, is still sitting at `ocrStatus: 'pending'` three days later — never advanced
to `processing`, `completed`, or `failed`. Confirmed invisible to
`GET /documents/search?q=invoice` (which finds the *other* two invoice-ish documents,
not this one) while sitting fine in the plain `GET /documents` list — so the
browse/search-disagreement *mechanism* described in the original finding is real, it
just isn't universal. `pending` (rather than `failed`) points at the job never being
durably picked up at all — not Textract rejecting it — which is consistent with the
worker process or its Redis queue not persisting through a Render free-tier
restart/idle cycle, though that's inference, not something confirmed from either repo
(no access to Render's runtime logs from here).

**No backend fix is being built for this.** The "upload through the backend instead of
the gateway" plan from the earlier revision, and the presigned-PUT endpoint it depended
on, would have solved a problem that doesn't exist in this deployment — dropped in
favour of the reliability fix below.

**Fix (forward-looking, not yet built) — a self-healing sweep, since a stuck job gives
no other signal to anyone:**

1. A scheduled job (cron, e.g. every 5–10 minutes) that finds `DocumentVersion` rows with
   `ocrStatus IN ('pending', 'processing')` and `createdAt`/`updatedAt` older than a
   threshold (e.g. 10 minutes — well past normal Textract turnaround), and re-enqueues
   the OCR job for each. This is the one piece that actually prevents "stuck forever":
   BullMQ's own `attempts: 3` retry only fires for a job that made it into the queue and
   got picked up at least once — it does nothing for a job that was lost before that
   point (worker down, Redis not durable across a restart).
2. An admin-facing "Retry OCR" action on a specific document/version, so a human can
   unstick one immediately rather than waiting for the next sweep — small, and useful
   independently of #1.
3. Confirm the worker process and its Redis instance are configured to persist/stay up
   continuously — an infra question (Render dyno type, Redis persistence mode), not a
   code change, but worth checking given `pending` (never even started) is the failure
   mode observed, not `failed` (started and Textract rejected it).
4. Some observability for "N documents stuck past threshold" — right now nothing
   surfaces this to a human; it took a live API pull to find the one that's been stuck
   for three days.

Both #1 and #2 are backend (`edms-backend`) changes — not built in this pass.

**Update 2026-10-14 — the browse/search disagreement is fixed; the reliability sweep is not.**
PR #51 (live 2026-10-14) makes search indexing independent of OCR: `POST /documents` and
`/batch` enqueue the search-index job as soon as the document is created (title + metadata
are already indexable), `PATCH` re-indexes when the `title` actually changes, restoring a
version re-indexes, and the OCR worker's *final* failed attempt indexes anyway so a file
with no extractable text (a DOCX, say) is still found by its title and metadata
(`documents.service.ts`, `ocr.workers.ts`, `search-index.workers.ts` on `origin/dev`).
That closes the *mechanism* this finding described — a document can no longer be stranded
out of search just because its OCR job never ran.

What it does **not** do: backfill. A version already stuck at `pending` before this
deploy still has an empty `search_vector` until something re-indexes it (an edit, a
metadata change, a restore) — the reconciliation sweep in #1 and the manual retry in #2
above are still unbuilt, and still the only thing that unsticks one.

### Related storage problems

Re-audited 2026-09-21 against the actual live uploader (`uploader.ts`/
`useMultipartUploader.ts`), not the dead `s3.service.ts#uploadFile()` every prior
revision checked this against:

| # | Issue | Detail |
|---|---|---|
| a | ~~2 MB limit~~ — **resolved, limits changed** | The dead `uploadFile()`'s `maxFileSize = 2_000_000` no longer applies to anything. The live path's `validateUpload()` (`useMultipartUploader.ts`) caps images at 10 MB and PDFs at 50 MB. See new problem **h** below — the UI advertises neither of these numbers. |
| b | ~~Base64 in memory~~ — **resolved** | The live path sends raw `Blob` slices (`file.slice()`) straight to each part's presigned PUT via `XMLHttpRequest` — no base64 anywhere, no ~33% inflation, no JS-string-sized-like-the-file problem. |
| c | **No presigned-PUT endpoint — *on `edms-backend`*** | Re-scoped: the frontend does now have a presigned-PUT-based upload (`POST {gateway}/presigned-url` returns one signed PUT URL per 5 MB part) — it's just issued by the third-party gateway, not by `edms-backend`. The backend itself still only ever issues presigned **GET**s (`getSignedDownloadUrl`). Not blocking anything today; the gateway stays load-bearing with no backend-owned fallback if it ever goes away. |
| d | **`fileUrl` is unvalidated** | Unchanged, and independent of which uploader produced the URL — `extractFileKey` accepts any URL, from any host. Nothing checks it matches `S3_BUCKET`/the gateway. A crafted request could still point a version at an arbitrary key. |
| e | **Multi-page PDFs** | Resolved — `StartDocumentTextDetectionCommand` (async) replaced the single-page-only synchronous call. Unrelated to which uploader is used; this is entirely backend-side. |
| f | ~~**Most non-image/PDF types silently rejected**~~ — **now the intended policy**: PDF and images only (PM, 2026-10-21), stated up front in the dropzone text | Same behavior, new gatekeeper: `validateUpload()` in `useMultipartUploader.ts` only allows 6 image MIME types and `application/pdf`; anything else — Word, Excel, plain text — throws `"Unsupported file type"` before any network call. The dead `uploadFile()`'s equivalent check is no longer where this actually happens; the rejection itself hasn't gone anywhere. |
| g | **Stale index on edit** | Unchanged — `updateDocument` (title), `updateDocumentMetadata`, and `restoreVersion` never re-enqueue indexing. `search_vector` drifts from the row. Entirely backend-side, independent of the uploader. |
| h | ~~**New — the dropzone advertises capabilities the validator doesn't have**~~ — **resolved 2026-10-02**: one list (`src/constants/uploadTypes.ts`) feeds the validator, every `accept` and the dropzone text | `upload/page.tsx`'s dropzone text reads *"PDF, DOCX, XLSX, TIFF, JPG up to 100 MB."* `validateUpload()` accepts none of DOCX/XLSX/TIFF (not in either allowlist — TIFF isn't even in the image one) and caps out at 50 MB for PDF / 10 MB for images, both well under the advertised 100 MB. A user follows the on-screen instructions, picks a 60 MB PDF or any `.docx`, and gets rejected with no indication beforehand that the dropzone's own text was wrong. |

### Viewing a file (2026-10-08)

PDFs are drawn in the browser by pdf.js (`src/components/documents/PdfViewer.tsx`,
`pdfjs-dist` 6.3.289), which fetches the pre-signed `currentVersion.fileUrl` straight from
S3. That works because the bucket's CORS answers `Access-Control-Allow-Origin: *` for `GET`
(and allows a `range` preflight), checked live 2026-10-08. It doesn't expose `Content-Range`,
so the viewer fetches each file whole (`disableRange`). The viewer reloads only when the
file's path changes, not when a refetch re-signs the same URL.

pdf.js's worker and the files it loads at runtime (WebAssembly decoders for JBIG2 and
JPEG 2000 images, standard fonts, character maps, colour profiles) are served from
`/pdfjs/`. `scripts/copy-pdfjs-assets.mjs` copies them out of `node_modules` at the start of
`npm run dev` and `npm run build`; `public/pdfjs/` is git-ignored. `proxy.ts`'s matcher
excludes `/pdfjs/`, and static assets generally by file extension (images, fonts, media),
so those requests don't trigger a backend session check — the login page's brand logo
(`/gbb-logo.jpg`) has to load before any session exists.

Printing renders each page to an image with the watermark drawn in and prints those from a
hidden frame, after `GET /documents/:id/print` succeeds. Images still render as a plain
`<img>`; other types show "can't be previewed yet" with Download.

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
| **Demo-mode server data** | `documents`, `users`, `cabinets`, `workflows`, `audit`, `notifications`, `findings`, `tenants`, `plans`, `featureFlags`, `policies`, `rolesMatrix` (`circulars` removed 2026-10-05 — now server state via the API) | ❌ No — this is server state |

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

### ✅ DRIFT-07 — `fetchAllPages` client-side aggregation — **Resolved (frontend, 2026-09-21)**

*Original finding:* `src/apis/utils/fetchAllPages.ts` walked every page of a list
endpoint (up to 50 pages × 100 items) and concatenated in the browser.
`managementAggregation.ts` then did department rollups, month bucketing, and SLA maths
client-side. Every management dashboard depended on it, and only one of the eight
aggregation endpoints added by `feat(workflow): close workflow gaps 1-10` had a caller.

**What shipped:** `management/page.tsx` (Organization Overview), `management/departments`
(Department Comparison), `management/trends` (Trends & Forecast) and
`management/performance` (Performance Overview) were rewired to call the aggregation
endpoints directly instead of walking full lists:

| Page | Was | Now |
|---|---|---|
| Organization Overview | `useAllDocuments` + `useAllTasks` + `useAllWorkflowInstances` | `useDocumentStats` (month + department) + `useTaskStats` (department) + `useOpenItemsByCabinet` + `useWorkflowInstanceStats` |
| Department Comparison | same three, filtered/bucketed client-side per department | `useDocumentStats({groupBy:'department'})` + `useTaskStats({groupBy:'department'})` for the two bar charts; `useQueries` over `workflowInstancesService.getStats({departmentId})` per department shown, for the one chart that genuinely needs a time series per department (`GET /workflow-instances/stats` only returns one department at a time — a hook can't be called in a loop, so this is `useQueries`, not N hook calls) |
| Trends & Forecast | same three | `useDocumentStats({groupBy:'month', departmentId, from})` for inflow, `useWorkflowInstanceStats({departmentId})` for closed; the forecast/backlog math (linear projection, running backlog) still runs client-side — that part isn't server aggregation, it's derived from two already-aggregated series |
| Performance Overview | `useAllTasks` (for the one org-wide SLA number; the by-department table already used `useTaskStats`) | org SLA is now summed from `useTaskStats()`'s own buckets — `total`/`onTime` across departments — instead of a second full task walk |

`useAllTasks`, `useAllWorkflowInstances` and `tasksService.getAllPages` had no other
callers once these four pages were rewired, so they were deleted rather than left
dead. `useAllDocuments` stays — `admin/cabinets` and `staff/cabinets` still use it
legitimately, to list every document *in one cabinet* for a folder-assignment UI,
which none of the aggregate endpoints answer.

**One real trade-off, not hidden:** the Organization Overview's per-department
Pending/In-Progress/Closed table used to come from an exact client-side count.
No backend aggregate cross-tabs department × document-status, so `closed` is now
`totalDocsInDept − (pending + inProgress)` — a derived figure, off by whatever
`includeArchived`/edge-case documents don't fit that arithmetic cleanly. Pending and
In-Progress themselves are exact (`GET /workflow-instances/open-items-by-cabinet`,
rolled up by department from its per-cabinet rows).

**Also fixed in passing:** `DocumentStatsResponse` (`src/types/models.ts`) claimed a
shape (`total`, `byStatus`, `byConfidentiality`, `byDepartment`) that never matched
`GET /documents/stats`'s real response (`{ buckets: [{key, count, departmentId?,
departmentName?}] }`, confirmed against `documents.service.ts` on the backend). The old
`docStats?.total != null` check in Organization Overview could never be true — the
field doesn't exist on the wire — so the "server-computed aggregates" panel that
depended on it silently never rendered. The type is corrected now and the panel was
folded into the KPI tiles rather than kept as a separate, always-empty section.

---

## 7. The complete API drift matrix

Legend: ✅ works · ⚠️ exists on one side only · 🔴 called but missing/wrong

### Auth

| Frontend call | Backend route | Status |
|---|---|---|
| `POST /api/auth/login` → `/api/v1/auth/login` | ✅ exists — since PR #51 (live 2026-10-14) the login response's `user` also carries `departmentId` | ✅ — the login page stores the whole `user`, so `useMyDepartmentId` is answered from the login itself; AppShell refreshes it from `/auth/me` |
| `POST /api/auth/refresh` → `/api/v1/auth/refresh` | ✅ exists | ✅ |
| `POST /api/auth/logout` → `/api/v1/auth/logout` | ❌ **not registered** | 🟨 **DRIFT-01** — frontend now *calls* it (Sidebar sign-out → `authService.logout()`, with the bearer token, 2026-09-10); backend route still missing so revocation is still a no-op |
| `GET /auth/me` | ✅ exists — since PR #50 (live 2026-10-13) also `departmentId` (null when none); login carries it too since PR #51 (live 2026-10-14) | ✅ (`permissions` now included — DRIFT-03 resolved). **`departmentId` adopted 2026-10-13, verified live:** AppShell copies it into the store; `useMyDepartmentId` replaces the `GET /users/:id` lookups in `useConfidentialityClearance`, `useDepartmentColleagues` and `/admin/cabinets`, and the first-page lookup on `/doc/[id]` |
| `POST /auth/forgot-password` | ✅ exists | ✅ |
| `POST /auth/reset-password` | ✅ exists | ✅ **DRIFT-15 resolved (frontend, 2026-09-18)** — was sending `newPassword`/`confirmPassword`; backend wants `password`. Fixed both sides of the shared invitation/reset-link landing page |

### Documents

| Frontend call | Backend route | Status |
|---|---|---|
| `GET /documents` | ✅ — since PR #51 (live 2026-10-14) also takes `departmentId` (documents whose cabinet belongs to that department); it only narrows, scope and clearance still apply. Since PR #53 (live 2026-10-20) each document carries `creator {id,name,email}`, readable without `user:view` | ✅ — `/staff/cabinets` "Uploaded by" reads `creator` since 2026-10-20 (verified live as `staff_finance`); before, it looked the id up in `GET /users`, a 403 for staff, so every row said "Unknown" |
| `GET /documents/search` | ✅ — since PR #51 (live 2026-10-14) takes every list filter (`cabinetId`, `departmentId`, `folderId`, `status`, `confidentiality`, `urgency`, `documentType`) alongside `q`, all AND'd with clearance and scope. Carries `creator` since PR #53 (live 2026-10-20) | ✅ — **wired 2026-10-14**: `/search` sends the same filters to both the list and the search endpoint, so the facet panel stays live while text is typed (it used to fall back to Cabinet only). DRIFT-06's browse/search disagreement is closed for anything indexed since the re-index work — indexing no longer waits on OCR |
| `GET /documents/:id` | ✅ — since PR #53 (live 2026-10-20) also `creator` and `currentVersion.uploader` (`{id,name,email}`) | ✅ — embeds `checkoutLock` + `locker {id,name,email}` since `edms-backend` `b4a3f81` (2026-09-29); before that only `isCheckedOut` came back, so even the lock holder couldn't check the document back in (TEST_PLAN "Things to check"). **2026-10-20 (verified live as `staff_finance`):** the owner reads `creator`, the lock holder `locker` and signers the embedded `signer`, so `/doc/[id]` no longer calls `GET /users`. That call is a 403 for staff and auditors, who saw the owner as "System" |
| `POST /documents` | ✅ — since `edms-backend` `dd10017` (2026-10-09) takes `metadata: [{ fieldId, value }]`, checked against the cabinet's fields and saved in the same transaction. A missing **required** field fails the upload (400), so a client that sends no metadata can't file into a cabinet with required fields. **Since `82c4707` (on `dev` 2026-10-29)** `mimeType` must be `application/pdf`, `image/jpeg`, `image/png` or `image/tiff`, and a `fileUrl` extension must match it (400 otherwise); the same rule covers `POST /documents/batch` and `POST /documents/:id/versions`. Circular attachments and signatures are unchanged | ✅ — `src/constants/uploadTypes.ts` already allowed exactly these four types, so nothing changed here. `metadata` sent from `/upload` and the workflow picker's "Upload from computer" since 2026-10-09. **Verified live 2026-10-09** on `/upload`: a `staff` user (no `document_metadata:edit`) filed with a value, `GET /documents/:id/metadata` returned it, no `PUT` was made. The picker was confirmed by the product owner's testing 2026-10-09 |
| `POST /documents/batch` (≤ 20, one transaction) | ✅ — each item takes `metadata` too (`dd10017`) | ✅ wired 2026-10-08 — `/upload`'s "File all", in chunks of 20; confirmed in testing 2026-10-08. Each item carries its card's metadata since 2026-10-09, **verified live** (two documents, two values stored). *This row was missing from the matrix* |
| `POST /documents/versions/batch` (≤ 20) | ✅ | ⚠️ backend only — nothing uploads several new versions at once |
| `PATCH /documents/:id` | ✅ — since `dd10017` (2026-10-09) also moves documents: `cabinetId` changes the cabinet (the folder is cleared unless a folder in the new cabinet is given) and `folderId: null` moves to the cabinet root; a folder from another cabinet is a 400. ✅ **Request item 7 fixed in PR #51 (live 2026-10-14):** a cross-cabinet move now needs edit on the document's **current** cabinet as well as the destination (`requireSourceCabinetAccessOnMove`), so no one can pull a document out of a cabinet they can't edit — 403 with "You need edit access to the document's current cabinet to move it" | ✅ — also, from 2026-10-08, the document page's "Change classification" dialog (`confidentiality`, `urgency`; 🟨 not verified live). Moves still send only `folderId` within the cabinet — a cross-cabinet Move UI was never built; the backend blocker for one is gone |
| `POST /documents/:id/checkout` | ✅ | ✅ |
| `POST /documents/:id/checkin` | ✅ | ✅ — holder, **or** a `document_lock:delete` holder at `global` scope / `department` scope for the cabinet's department (`canReleaseLock`). Frontend offers that "Force check in" only once the lock is past `expectedReturnAt` (2026-10-02) |
| `GET /documents/:id/metadata` | ✅ | ✅ |
| `PUT /documents/:id/metadata` | ✅ — re-indexes search after a change since `dd10017`, and since PR #51 (live 2026-10-14) `POST /documents`/`/batch` index at create time rather than waiting for OCR, `PATCH` re-indexes when the title actually changes, and restoring a version re-indexes (re-running OCR first if the source's never finished). An OCR failure indexes anyway, so a document with no extractable text is still findable by title and metadata | ✅ (cannot clear values — see backend analysis). Since 2026-10-09 only the document page's metadata editor calls it; uploads send metadata with the create call |
| `GET /documents/:id/versions` | ✅ — each version carries `uploader {id,name,email}` since PR #53 (live 2026-10-20) | ✅ — the versions panel (`/doc/[id]`, the workflow page) names uploaders from `uploader` since 2026-10-20 (verified live); before, from `GET /users`, so staff saw "User" |
| `GET /documents/:id/summary` | ✅ — PR #49 (live 2026-10-13): Gemini summary of the current version, written after OCR; `summaryStatus` pending → processing → completed / failed / skipped. Older versions are queued the first time it's asked for. Each call is audited (`document.summary_viewed`). A failed summary can be re-queued with `POST` on the same path since PR #56 (row below; backend spec N2) | ✅ wired 2026-10-13, verified live — `/doc/[id]` "AI summary" card; polls every 10 s for at most a minute per version while it's being written, then offers "Check again". Also on `/workflow-instances/[id]` for the selected document since 2026-10-23 (verified live; never for a Restricted one). **Since 2026-10-23 called only after the user asks** (product decision: no automatic summaries): `GET` queues a missing summary, so the card reads `currentVersion.aiSummary`/`summaryStatus` from `GET /documents/:id` and offers **Summarize**; `GET …/summary` only follows a `POST` it made. Verified with mocked `/summary` responses: no call on load in any state. The OCR worker still summarises every upload (BE-22) |
| `POST /documents/:id/summary` | ✅ — PR #56 (live 2026-10-20): queues a fresh summary of the current version, **202** with `summaryStatus: 'pending'` and the old text, which `GET` keeps returning until the new one replaces it. Same access as `GET`; audited `document.summary_requested`. 409 `OCR_IN_PROGRESS` / `SUMMARY_IN_PROGRESS`, 422 `NO_EXTRACTABLE_TEXT`, 503 `SUMMARY_UNAVAILABLE` | ✅ wired 2026-10-20, verified live — "Try again" on a failed summary, "Regenerate" on a finished one; the old text stays up while the new one is written. A real Regenerate on `e8e22fcd…` returned 202 and the card moved to the new summary by polling. `OCR_IN_PROGRESS` and `NO_EXTRACTABLE_TEXT` confirmed on the API (`487006a2…`, `dcca68ff…`); the 503 and `SUMMARY_IN_PROGRESS` states checked with mocked responses |
| `GET /documents/:id/versions/:versionId` | ✅ — since `edms-backend` `0dab81a` (2026-10-08) needs `document:download` on top of confidentiality clearance, and is audited as `document.downloaded` | 🟨 **wired 2026-10-08** as the only download path (`useDownloadDocumentVersion`): `/doc/[id]`'s Download, the workflow viewer's Download, and each version's Open in `DocumentVersionsPanel`. Permissions confirmed live on `/auth/me`. ✅ **Clicked through 2026-10-09** (Finance supervisor, `department` scope): Download on `/doc/[id]` and in the workflow viewer each called this route (200) and sent the new tab to the signed S3 URL. *Was marked ✅ before, but nothing called it: the versions panel opened the list's own signed `fileUrl`. Corrected 2026-10-08* |
| `POST /documents/:id/versions` | ✅ | ✅ |
| `GET /documents/:id/export`, `GET /documents/:id/print` | ✅ new in `0dab81a` — `document:export` / `document:print` plus clearance; audited as `document.exported` / `document.printed`; return the document like `GET /documents/:id` | ✅ `/print` — wired 2026-10-08 (`usePrintDocument`): the PDF viewer's Print calls it first and only prints if it succeeds; verified in a browser against the live API · ✅ `/export` — wired 2026-10-08 (`useExportDocument`), `/doc/[id]`'s Export button; **clicked through 2026-10-09**: the call returned 200 and the new tab went to the signed S3 URL |
| `GET/POST /documents/:id/comments`, `/signatures` | ✅ both exist, real endpoints | 🟥 **deliberately unused (reverted 2026-09-18, same day)** — briefly wired as `DocumentCommentsPanel`/`DocumentSignaturesPanel` earlier the same day, then removed: product decision to keep every comment/signature scoped to the workflow trail (`POST /tasks/:id/action`'s `comment`/`approve`'s `signature`) rather than split across a second, task-independent thread. See DRIFT-08's note below and BE-16/BE-17 in `BACKEND_REQUESTS.md` |
| `GET/POST /documents/:id/access-requests`, `/grant`, `/deny`, admin inbox `GET /documents/access-requests` | ✅ — since `3014b89` (PR #47, live by 2026-10-12) the POST body **requires** `permission: 'view' \| 'route'`, and a grant is per permission (unique on document + user + permission). A `route` grant lets the user act on the document in a workflow despite its tier; it never allows download/export/print | ✅ **DRIFT-20 fixed 2026-10-12, verified live.** Wired 2026-09-18; from `3014b89` until the fix the frontend posted only `{ reason }` and every request was refused (422 `VALIDATION_ERROR`). `/doc/[id]` asks for View access (`permission: 'view'`); the workflow page's Restricted document card offers "Open the document" and "Act on this document" tick boxes (both pre-ticked for the task's holder) and sends one request per kind, one toast each, a 409 reading "Already pending". `/admin/access-requests` shows the kind (Open / Act) and a kind-specific grant confirmation |
| — | `DELETE /documents/:id/access-grants/:userId?permission=view\|route` (query required since `3014b89`) | No UI — nothing revokes a document grant |
| `DELETE /documents/:id` (archive) | ✅ | ✅ wired — "Archive document" in `/doc/[id]`'s overflow menu (`useArchiveDocument`) |
| `POST /documents/:id/versions/:versionId/restore` | ✅ | ✅ wired — "Restore" in `DocumentVersionsPanel` (`useRestoreDocumentVersion`). Both rows were stale here — caught in passing 2026-09-18, not otherwise part of that day's work |

### Workflows, instances, tasks

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST /workflows`, `GET/PATCH /workflows/:id` | ✅ — since `3014b89` a stage may carry `department_id` (alone, or with `role`; never with `user_id`); create, update and publish check that the department exists (422). **PR #52 (live 2026-10-15):** optional `sub_department_id`, a direct child of `department_id` (422 `WORKFLOW_SUB_DEPARTMENT_MISMATCH` otherwise); the task's `assignedDepartmentId` is then the child | ✅ — **department-only stages since 2026-10-13, verified live**. **2026-10-16 (verified live):** Department picks a top-level department, then optionally one of its sub-departments, saved as `department_id` + `sub_department_id`; Role takes an optional department the same way (role + department), and "Any department" clears both. Stages saved earlier with a sub-department in `department_id` alone are read as the pair (no false "unsaved") and saved that way. One department per stage, matched exactly: a parent doesn't include its sub-departments (product decision 2026-10-16, superseding spec Q2's answer). Department labels, here and in task holder labels (`useDepartmentNames`), show the path ("Operations › Finance"): names can repeat across trees. Tasks: `assignedDepartmentId` drives "is this my task" (`isTaskForUser`, the backend's rule, with the department from `/auth/me`) and the holder label ("Finance", "supervisor · Finance") on the workflow page, the Monitor drawer and the reassign dialogs. Matching is exact: a stage for Operations doesn't reach Operations › Finance **List paging (2026-10-20, verified live):** `GET /workflows` returns 20 per page by default and takes `status`, `search` (name contains) and `limit` ≤ 100. Two callers read only the default first page, which on the live tenant held 19 archived workflows: the designer's dropdown (replaced by the `/admin/workflows` list) and the "Route to workflow" picker (`useRouteToWorkflow`), which filtered that page to published ones and so offered staff 1 of 12. The picker now asks for `status=published&limit=100` and lists all 12 |
| `POST /workflows/:id/publish` `/archive` | ✅ — publish takes only a `draft` (409 `WORKFLOW_NOT_DRAFT`), archive only a `published` one (409 `WORKFLOW_NOT_PUBLISHED`). **PR #59 (live 2026-10-26):** publish takes only the **latest** draft of its family (409 `WORKFLOW_VERSION_CONFLICT`) and, in the same serializable transaction, archives the version that was published (409 `WORKFLOW_PUBLISH_CONFLICT` on a race) | ✅ — since 2026-10-20 the designer offers Archive only on a published workflow and Publish never on an archived one; both used to be offered and 409. **2026-10-26 (verified live):** when another version is active, Publish asks first ("v1 is active now and will be archived…"); `usePublishWorkflow` refreshes every cached workflow, since the old version changes too |
| `DELETE /workflows/:id` | ✅ — PR #55 (live 2026-10-20): **204**; only a `draft` that was never started (409 `WORKFLOW_NOT_DRAFT` / `CONFLICT`); `workflow:edit`; audited `workflow.deleted` | ✅ wired 2026-10-20, verified live — "Delete draft" in the designer's ⋮ menu, drafts only, with a confirm that says it's permanent |
| `POST /workflows/:id/unarchive` | ✅ — PR #55 (live 2026-10-20): back to `published`, keeping `version` and `publishedAt`; re-checks stage departments (422 if one was deleted); `workflow:archive`; audited `workflow.unarchived`. **PR #59 (live 2026-10-26):** only the family's **latest** version, and only while no version is published (409 `WORKFLOW_VERSION_CONFLICT`) | ✅ wired 2026-10-20, verified live — "Unarchive" replaces Publish on an archived workflow. The 422 toast says to clone the workflow and fix the stage in the copy (only drafts can be edited) instead of showing the raw department id |
| `POST /workflows/:id/versions`, `GET /workflows/:id/versions`, `GET /workflows/:id/versions/latest-published` | ✅ — PR #59 (live 2026-10-26, in the live Swagger). Every definition has a `familyId` shared by its versions (`(familyId, version)` unique; the migration gave each existing workflow its own family). `POST` copies the latest **published** version into a draft numbered v+1 (`workflow:create`, 201; 409 `WORKFLOW_VERSION_NOT_LATEST` / `WORKFLOW_NOT_PUBLISHED` / `WORKFLOW_VERSION_CONFLICT`; re-checks stage departments; audited `workflow.version_created`). `GET …/versions` lists the family newest first (`page`, `limit` ≤ 100); `…/latest-published` returns the active one or 404 (`workflow:view`). `GET /workflows` still lists every version as its own row; since PR #60 (`6ced046`, live 2026-10-28) each row also carries the family's `latestVersion` and `publishedVersion` (or null) | ✅ wired 2026-10-26, verified live (`client_admin`, throwaway "ZZ versioning test (throwaway)", both versions left archived): ⋮ → **New version** on a published workflow (201, opens draft v2); on v1 it then reads **Open draft v2**; a version picker (`useWorkflowVersions`, `limit=100`) sits beside the status badge once there are two; Unarchive is disabled, with the reason on hover, on a version that isn't the latest. `…/latest-published` isn't called. **2026-10-28 (verified live):** the `/admin/workflows` list uses `latestVersion` / `publishedVersion` to label a replaced version "Replaced by vN" and disable its Unarchive |
| `GET /workflow-instances`, `GET /workflow-instances/:id` | ✅ — since PR #51 (live 2026-10-14) the list also takes `departmentId` (instances with a document in a cabinet of that department); a **department-scoped** caller passing someone else's department gets 403 `WORKFLOW_DEPARTMENT_SCOPE_FORBIDDEN`, while at `own` scope a requested department only narrows the participant list. Since `919d0ef` an instance has `documents[]` and no `documentId`/`currentStage`/`stageDueAt`; the list doesn't return per-document executions (DRIFT-19). Since `3014b89`: each document carries `isLocked` + `access`, Restricted documents redacted to that title; and at `own` scope visibility follows task assignment only (direct, role, role + department, department), no longer document ownership (**DRIFT-22**). Attaching to a *pending* workflow is limited to the first-stage assignee or `global` scope | ✅ reshaped 2026-10-07 (DRIFT-19), not verified live. ✅ **DRIFT-21** fixed 2026-10-12: restricted entries render (lock tab, request card, no fetch) and stage actions cover only documents with Action access; verified live **PR #50 (live 2026-10-13):** the list returns each document's active `executions` (stage, status, `stageDueAt`) and redacts documents the caller can't view (`isLocked`, `access`, "Restricted document"); the detail returns every attached document. The list defaults to `scope=mine` (workflows the caller holds a task in), and `scope=all` is a **403** for anyone whose `workflow_instance:view` is `own`. The Workflow Monitor and `/doc/[id]`'s Workflows card sent no scope, so a client admin's Monitor was empty; since 2026-10-13 both send `scope=all` with oversight (department/global) and `mine` otherwise (verified live: admin Monitor 0 → 4 in progress, supervisor 3 for their department, staff `/doc/[id]` still 200). Stage and Next due columns fill from `executions`. **2026-10-14 (verified live):** the Monitor sends `departmentId` — from `?dept=` (the management dashboards' new **Workflows** / **View workflows** links) or its Department picker — but only for a viewer whose `workflow_instance:view` is `global`; a department-scoped viewer gets no picker and a foreign `?dept=` is ignored, so it can't trip the 403 |
| ~~`POST /workflow-instances/start`~~ | now the two-call `POST /workflow-instances` **then** `POST /:instanceId/start`; since `919d0ef` the create body is `{ workflowDefinitionId, documents: [{ documentId, comment? }] }` | ✅ **DRIFT-09 resolved**; body updated 2026-10-07 — documents routed together go into one workflow (DRIFT-19). **Who may route what (2026-10-16, verified live):** create checks each document against the caller's `workflow_instance:create` scope: any document at `global` (client_admin), only documents they uploaded at `own` (staff, management, internal_auditor), and at `department` one whose cabinet is in their department; otherwise 403 `WORKFLOW_INSTANCE_CREATE_FORBIDDEN`. `useRouteToWorkflow` now applies the `own` rule (`mayRouteDocument`): the document page disables "Route to workflow" on someone else's document, and a Search/Cabinets selection leaves those out with a note. `department` is left to the backend. Before, staff got the 403 after picking a workflow |
| `POST /workflow-instances/:id/hold` `/resume` `/close` | ✅ | ✅ |
| `GET /tasks`, `GET /tasks/:id` | ✅ — since `919d0ef` no `Task.dueAt`; documents come through `documents[].workflowDocumentExecution`, and only `/:id` carries their stage and deadline (DRIFT-19). Since `3014b89`: tasks carry `assignedDepartmentId`; `/:id` returns **every** document, each with `access: { canView, canRoute, canRequestView, canRequestRoute }`, and a document the caller can't view comes back as "Restricted document" with null confidentiality, cabinet and version (before, it was left out). Acting on a document above your tier needs a `route` grant | ✅ reshaped 2026-10-07, not verified live. ✅ **DRIFT-21, fixed 2026-10-12** — the workflow page reads `access`, shows Restricted documents as lock tabs with the request card and never fetches them; `ConfBadge`/`UrgBadge` render nothing for a null level. Verified live (staff: no `GET /documents/:id` for the restricted one, no error; client admin: unchanged). Stage actions cover only documents with Action access (`canRoute`) and name them explicitly whenever any is held back; close and delegate (whole-task) are disabled meanwhile. Verified live: approving the viewable document of a two-document task returned 200, the restricted one stayed at the stage in a new task for the same user (before PR #52). **PR #52 (live 2026-10-15):** a partial action keeps the same task open with the rest; `/:id` still lists the actioned documents, with `actionedAt` and `canRoute`/`canRequestRoute` false (the lists drop them). **2026-10-16:** the workflow page treats those as done ("· Done" tab; out of the actions, the held-back count and the deadline) instead of as needing Action access, which also disabled Delegate and Close. A Restricted document has no `actionedAt`, so it counts as done once its execution has left the task's stage (backend ask T2). Verified in the browser on task `27f8a97d…` with `GET /tasks/:id` edited to mark one document actioned (no live partial action made); the unfixed page showed "One document needs Action access". ✅ **Backend ask T3 fixed** (edms-backend `3832e4b`, PR #54; verified live 2026-10-20): sending an actioned document back to a stage whose task is still open reuses that task and re-opens the document there (`actionedAt: null`, actionable again); before, a 409. Checked on a throwaway two-document workflow: partial review at A, Request changes at B → 200, one open task at A holding both, and the workflow page shows the returned document with its changes-requested marker, not "· Done". **PR #50 (live 2026-10-13):** `GET /tasks` and `/tasks/approvals` return each document's `currentStage`, `status`, `stageDueAt` (W1), accept `sort=createdAt\|dueAt` and `overdue=true\|false`, and redact documents the caller can't view like `/:id` does. Task rows show the deadline (only on open tasks — a closed task's documents have moved to someone else's stage) and "Overdue" past it; verified live. **2026-10-14 (verified live):** `/staff/tasks` sends `overdue=true` for Overdue, `status=pending&overdue=false` for Pending / In Progress / On Hold (split by `taskStatusLabel`), and `sort=dueAt` for "Sort: Due date", so those cover every task rather than the one page fetched. Before, In Progress and On Hold sent `status=in_progress`/`on_hold`, which aren't task statuses — a 400 `VALIDATION_ERROR`, shown as "Failed to load tasks" |
| `POST /tasks/:id/action` | ✅ | ✅ — `request_changes` sends `documents: [{documentId}]` from the workflow page's document picker since 2026-10-02 (**DRIFT-18** fixed; the field became required in `edms-backend` `5144fc7`). Not yet verified e2e |
| — | `POST /workflow-instances/:id/documents` `{documentId, comment?}` (`5144fc7`) | ✅ wired — "Mark reviewed" attaches the reviewer's documents through it (`useWorkflowTaskActions`); optional since 2026-10-16 (the `review` action never required any). *This row said "no UI yet"; stale, corrected 2026-10-07* |
| `PATCH /tasks/:id/reassign` | ✅ | ✅ |
| `GET /tasks/approvals` | ✅ — refused (403 `TASK_APPROVAL_QUEUE_FORBIDDEN`) to anyone whose `task:view` is `own` | ✅ — `/supervisor/approvals` (`sort=dueAt` since 2026-10-20; it was oldest first), and the sidebar badge. **2026-10-13:** the badge and the nav item require `task:action` *and* `task:view` at department or wider; before, the badge fired for anyone with `task:action`, so staff got a hidden 403 on every page. Verified live: no request for staff, badge still 1 for the Finance supervisor |
| `GET /sla/outcomes/summary` | ✅ PR #50 (live 2026-10-13, `task:view`): on-time vs late stage results from `workflow_sla_outcomes` over `from`–`to` (UTC dates), optional `groupBy=user\|department\|stage`, `departmentId`, `userId`; `own` scope is limited to the caller | ✅ wired 2026-10-13, verified live — staff dashboard "SLA compliance (30d)" and My Performance (rate, on time, breached; 88% = 7 of 8 for the Finance staff fixture). `/supervisor/performance` since 2026-10-13 (`groupBy=user`, plus the previous 30 days for the change; verified live: team 79%, 11 of 14). Not yet on the management pages |
| `GET /sla/breaches` | ✅ (`workflow_instance:view`). Since `99a059f` (on `dev` 2026-10-28) an overdue breach on a stage whose breach action is `escalate` also moves a `pending` task to `escalated`; before, only the breach row was written | ✅ wired — staff dashboard Overdue tile, My Tasks, My Performance. *Row missing from this matrix until 2026-10-08*. The `escalated` status feeds `/supervisor/approvals`' Escalated tab (not verified live) |
| `GET/PATCH /sla/configuration` | ✅ (`workflow:view` / `workflow:edit`) | ✅ wired 2026-10-08, confirmed in testing 2026-10-08 — `/admin/policies` → Urgency & SLA (`SlaSettingsPanel`). Only changed fields are sent |
| `GET/POST /sla/holidays`, `DELETE /sla/holidays/:holidayId` | ✅ (`workflow:view` / `workflow:edit`) | ✅ wired 2026-10-08, confirmed in testing 2026-10-08 — same tab, Holidays card |
| `GET/POST /delegations`, `POST /delegations/:id/end` | ✅ — since `436ea83` (on `dev` 2026-10-29) a delegation in effect also moves the delegator's open tasks to the delegate: new assignments at once, existing ones through the `delegation-reconcile` worker (every `DELEGATION_RECONCILE_INTERVAL_MS`). Only tasks whose pending documents all fall inside the delegation's scope move | ✅ wired — `/delegations` (344 lines) exists; this row was stale, caught 2026-09-18 while investigating DRIFT-11 |
| `GET /delegations/eligible-users?search=` | ✅ new in `436ea83`, live (checked 2026-10-29 as `staff_finance`): active users other than the caller, name/email match, max 20, `{id,name,email}`. Needs `delegation:create`, not `user:view`; `search` must be 2–100 characters | ✅ wired 2026-10-29 — `/delegations` "Delegate to" (`DelegatePicker`, `useEligibleDelegates`); one typed character sends nothing |
| — | `GET /workflow-history`, `GET /workflow-history/:id` | ✅ wired — the activity trail (`WorkflowHistoryTimeline`), and since 2026-10-07 each document's live stage and deadline (`useWorkflowDocumentPositions`). *This row said "no UI at all"; stale, corrected 2026-10-07* |

**DRIFT-09 — ✅ RESOLVED (verified 2026-09-04).**

*The original finding:* `workflowInstancesService.start()` posted to
`/workflow-instances/start` with `{workflowId, documentId}`. Inside
`workflowInstancesRouter` the registered POST routes are `/` and `/:instanceId/start` — a
single segment `/start` matched neither, so it 404'd. Document routing did not work from
the UI at all, which made the entire approval half of the product unreachable.

*What shipped:* `workflowInstances.service.ts` now exposes `start(instanceId)` for the
second call and a `createAndStart(workflowId, documentId)` convenience that performs the
correct sequence — `POST /workflow-instances` then `POST /workflow-instances/:id/start`.
It is wired into the UI through `useStartWorkflowInstance` (`useWorkflowInstances.ts:67`),
consumed at `src/app/(app)/staff/cabinets/page.tsx:53`.

> ✅ ~~**Two of the compounding problems remain.** The endpoint still performs
> **no authorization check** (DRIFT-05), and the assignee is still **never notified**
> (DRIFT-10)~~ — both resolved: authorization 2026-09-04 (DRIFT-05) and `task.assigned`
> notifications 2026-09-21 (DRIFT-10). Re-checked 2026-10-15. ~~What blocks routing today
> is DRIFT-14.~~ *Re-tested 2026-10-16: nothing blocks routing on the live tenant; DRIFT-14 is
> a seed-only gap.*

### Identity

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST /users`, `GET/PATCH/DELETE /users/:id` | ✅ — since PR #49 (live 2026-10-13) a user is `pending` from an emailed invitation until they set a password (then `active`); `invitedAt` records the first invitation; `?status=pending` filters. Existing invited users without a password were migrated to `pending` | ✅ — `/admin/users` shows Pending with the invitation date, filters by it, offers Resend invite and no Activate for them; "Invite user" toasts "Invitation sent to …". Verified live 2026-10-13 |
| `GET /users?search=` (name or email, case-insensitive; backend PR #48) | ✅ | ✅ wired 2026-10-13: `/admin/users` search box, and `UserPicker` (Delegations "Delegate to" until 2026-10-29, when it moved to `GET /delegations/eligible-users`). The actor filter on `/admin/audit` and `/auditor/trail` is `UserSearchCombobox` since 2026-10-16: a search box that queries from the third character. Results stay inside the caller's `user:view` scope |
| `POST /users/:id/roles`, `DELETE /users/:id/roles/:roleId` | ✅ | ✅ |
| `POST /users/:id/invitation` | ✅ — since PR #49 accepts `pending` or `active` users (409 otherwise) | ✅ wired 2026-09-18 — "Resend invite" button, shown for pending users and for active users with no `lastLoginAt` (since 2026-10-13; before, only the latter, so a pending user couldn't be re-invited) |
| `GET/POST /roles`, `GET/PATCH/DELETE /roles/:id` | ✅ — since PR #49 `schulltech_admin` is never listed or returned, and assigning it through `POST /users` or `/users/:id/roles` is a 404 | ✅ — no frontend change: the role pickers list what the API returns. A user who already holds the role still shows it in their roles, and editing them keeps it |
| `PUT /roles/:id/permissions` | ✅ | ✅ |
| `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` | ✅ — since PR #51 (live 2026-10-14) departments nest **one level only**: a parent must itself be top-level and a department with sub-departments can't be moved under another, both 422 `DEPARTMENT_DEPTH`. Editing a department that predates the rule only fails when its parent actually changes | ✅ — `/admin/departments` already offered exactly one level (its parent picker lists top-level departments only and pins "has sub-departments" rows), so no change was needed; the 422 message is shown verbatim via the mutation's error toast |

### Filing

| Frontend call | Backend route | Status |
|---|---|---|
| `GET/POST/PATCH/DELETE /cabinets(/:id)` | ✅ | ✅ |
| `GET/POST /cabinets/:cabinetId/folders` | ✅ | ✅ |
| `GET/PATCH/DELETE /folders/:id` | ✅ | ✅ |
| `POST/PATCH/DELETE /cabinets/:id/metadata-fields` | ✅ | ✅ — Cabinet Designer's metadata panel (`/admin/cabinets`) and, since 2026-10-06, the cabinet's **Metadata schema** tab on `/staff/cabinets` |
| `GET/POST /cabinets/:id/access`, `DELETE /:id/access/:grantId` | ✅ — since `dd10017` (2026-10-09) `POST` refuses (403) a grant to yourself, to a role you hold, or above your own level on the cabinet; admins (`CABINET_ACCESS_BYPASS_ROLES`) are exempt. The grants' `user` is now `{ id, name, email }` only — it used to be the whole row, password hash included (spec item S1) | ✅ — Cabinet Designer's **Access** card and the cabinet's **Access** tab on `/staff/cabinets`. The UI already left out the choices the API now refuses |

*These two rows said "backend only — no UI", with a paragraph calling the access gap out
twice. Both screens have existed since at least 2026-09-21 (see the 2026-09-21 correction in
§1 and the DRIFT register). Rows corrected 2026-10-09.*

### Circulars *(wired 2026-10-05)*

Backend `src/modules/circulars/` — 15 routes, two BullMQ workers (delivery fan-out and a
reconcile/expiry/reminder sweep), and `circular:view|create|publish|withdraw` permissions
seeded for `client_admin`, `supervisor`, `management` and `internal_auditor`. Frontend:
`circulars.service.ts` + `useCirculars.ts`. Every row is ✅ — built 2026-10-05, *(confirmed by the product owner’s testing, 2026-10-09)*.
| Frontend call | Backend route | Status |
|---|---|---|
| `getInbox` | `GET /circulars/inbox` | ✅ |
| `getInboxSummary` | `GET /circulars/inbox/summary` | ✅ sidebar badge = `unacknowledged` |
| `getInboxItem` | `GET /circulars/inbox/:id` (first open = read receipt) | ✅ |
| `acknowledge` | `POST /circulars/inbox/:id/acknowledge` | ✅ |
| `getAll` | `GET /circulars` (`circular:view`) | ✅ |
| `getById` | `GET /circulars/:id` | ✅ |
| `create` · `update` · `remove` | `POST /circulars` · `PATCH`/`DELETE /circulars/:id` (`circular:create`, drafts only) | ✅ |
| `publish` · `cancelSchedule` | `POST /circulars/:id/publish` · `/cancel-schedule` (`circular:publish`) | ✅ |
| `withdraw` | `POST /circulars/:id/withdraw` (`circular:withdraw`) | ✅ |
| `revise` | `POST /circulars/:id/revisions` (`circular:create`) | ✅ |
| `getRecipients` | `GET /circulars/:id/recipients` | ✅ |
| `sendReminders` | `POST /circulars/:id/reminders` (`circular:publish`) | ✅ |

Contract notes: list endpoints use the standard paginated envelope; `archived` is sent as
the string `'true'|'false'` (axios serialises the boolean); a `PATCH` that includes
`attachments` replaces the whole list, so the form only sends it when the list changed;
an existing uploaded attachment round-trips by re-sending its signed `fileUrl`, since
`extractFileKey` reads only the URL's path. `GET /roles` needs `role:view`, which
supervisors and management lack, so their audience editor offers department groups and
named people but not role groups. Circular notifications carry `actionUrl: /circulars/:id`
(published, reminder) or `/circulars` (withdrawn) — both are real routes here.

### Internal control *(backend on `dev` 2026-10-29; UI built the same day, not live)*

`edms-backend` `51e9d85` adds `control_exceptions` (migration
`20261029090000_add_control_exceptions`). An exception is open → reported → acknowledged →
resolved. The `internal_auditor` raises, edits (while open) and reports it; reporting notifies
every active `management` user (`control_exception.reported`); `management` acknowledges and
resolves it, with a required note. `client_admin` can read. Each action is audited as
`control_exception.*`. **Not usable on live yet:** on 2026-10-29 the live `auditor` login
held no `control_exception:*` permission (so `seed:system` hasn't run there), and the list
route timed out twice. Live deployment is unverified.

**Frontend (2026-10-29):** `controlExceptions.service.ts` / `useControlExceptions.ts` and five
shared pages under `/control-exceptions` (doc 05, Shared pages); the auditor's and
management's Findings menu items open them. 🟨 everywhere below: verified only against a
local mock of these routes (with the grants added to `/auth/me`), never against live.

| Frontend call | Backend route | Status |
|---|---|---|
| `getAll` | `GET /control-exceptions` (`view`; `status`, `category`, `severity`, `departmentId`, `from`/`to`, `page`/`limit` ≤ 100) | 🟨 the register. `to` is compared with `lte` on a timestamp, so the page sends the end of the chosen day |
| `getReport` | `GET /control-exceptions/report` (`view`; same filters): counts by status, category, severity, department | 🟨 `/control-exceptions/report` |
| `getById` | `GET /control-exceptions/:id` (`view`) | 🟨 detail page; also the notification's `actionUrl` |
| `create` | `POST /control-exceptions` (`create`): `title`, `description`, `category`, `severity?`, optional `departmentId`/`documentId`/`workflowInstanceId` | 🟨 `/control-exceptions/new`. The form links a department and a document, not a workflow |
| `update` | `PATCH /control-exceptions/:id` (`edit`, while `open`) | 🟨 `/[id]/edit`; sends `null` to unlink |
| `report` | `POST /control-exceptions/:id/report` (`report`) | 🟨 "Report to permanent secretary", after a confirm |
| `acknowledge`, `resolve` | `POST /control-exceptions/:id/acknowledge`, `POST /control-exceptions/:id/resolve` `{resolutionNote}` (`respond`) | 🟨 detail page; Resolve opens an inline note |

Gap: the responses embed `raiser` but give only ids for the reporter, acknowledger and
resolver, so the history can't name them (management can't read `GET /users`).

Categories: `missing_competitive_quotes`, `missing_approval`, `missing_documentation`,
`policy_breach`, `sla_breach`, `other`. Severities: `low`, `medium` (default), `high`,
`critical`. This is not the `Finding` model doc 02 H2 asks for: there's no owner or due date.

### Modules with no backend at all

| Frontend service | Endpoints called | Backend | Status |
|---|---|---|---|
| `policies.service.ts` | none — returns `SEED.policies` | **module directory is empty** | 🔴 — since 2026-10-08 only its `watermark` flag is read. Download now follows the `document:download` permission and clearance, so `/admin/policies`' Download and Print toggles change nothing |
| `branding.service.ts` | none — returns `SEED.branding` | no module, no schema | 🔴 |

**DRIFT-10 (notifications) — ✅ RESOLVED (verified 2026-09-21).**

*The original finding:* the frontend called four notification endpoints for real via
`apiClient` against an **empty backend module directory**, so all four 404'd. The bell
badge and the staff notification panel were permanently broken.

*What changed on both sides:*

- **Backend** — `src/modules/notifications/` now exists in full (router, controller,
  service, repository, validation, types, swagger, email worker) and registers **6 routes**:
  `GET /notifications`, `GET /notifications/unread-count`,
  `GET /notifications/preferences`, `PUT /notifications/preferences`,
  `PATCH /notifications/:id/read`, `POST /notifications/read-all`.
- **Frontend** — rewired to those routes on 2026-09-03 (commit `e07d8c3`). The badge and
  panel now read the live API instead of `SEED`; `getUnreadCount`, `getPreferences` and
  `updatePreferences` gained callers for the first time.

*As of the 2026-09-21 re-scan, one of the two remaining gaps is closed:*

1. ✅ **RESOLVED — `notifyUser` is called now.** `documents.service.ts` calls it for
   access-request grant/deny; `tasks.service.ts` calls it (via `notifyAssignment`) for
   the initial task assignment on workflow start, reassignment, delegation, and the
   outcome (approve/reject/request-changes) back to the document creator;
   `sla.service.ts` calls it (`notifyAssignment`/`notifyRole`) for SLA warning and
   breach. The module, queue, worker and UI were already complete — this was the
   missing wiring, and it's wired now.
2. 🟠 **DRIFT-10b, still open.** `app.ts` mounts `errorHandler` (a 4-arg error
   middleware, skipped on the happy path) and nothing else, so Express returns its default
   **HTML** body and the frontend's axios tries to read `.data.data` off an HTML string.
   Any future missing route (e.g. the still-missing `POST /auth/logout`, DRIFT-01) fails
   as a confusing parse error rather than a clean 404.

> **Naming note.** The frontend had been calling `POST /notifications/mark-all-read`; the
> backend route is `POST /notifications/read-all`. This was fixed **on the frontend** —
> `read-all` pairs with `unread-count` and is the better name.

> ⚠️ **Deliberate removal.** `notificationsService.send()` was deleted rather than pointed
> at a backend endpoint. It POSTed to `/notifications` with an arbitrary `userId` and
> arbitrary text; served server-side, that would let any authenticated user send a
> notification addressed to anyone, rendered with full system credibility. The
> "Request access" button on `/doc/[id]` therefore **no longer notifies the document
> owner** — it records the audit action only, pending a server-side endpoint
> (BE-1 — since built as `POST /documents/:id/access-requests`, live 2026-09-18).

**DRIFT-11 (audit) — ✅ RESOLVED (verified 2026-09-18).**

*The original finding:* the backend `audit_entries` table was designed as a
hash-chained, append-only compliance trail (`prevHash`/`entryHash`, INSERT-only DB
role), but nothing ever wrote to it, and `audit.service.ts` returned `SEED.audit` with
no backend behind it at all — "the compliance story of the product is currently a mock
on both sides."

*What changed on both sides:*

- **Backend** — the audit module is now real and writes automatically. `GET /audit`
  (search/filter, `audit:view`), `GET /audit/:id`, `GET /audit/export` (CSV,
  `audit:export`) and `GET /audit/verify` (recomputes the hash chain over a window) all
  exist and were confirmed live 2026-09-18. Unlike notifications (DRIFT-10), entries are
  **written server-side automatically** as a side effect of other actions — a live pull
  against a real tenant showed 27 real entries (`user.login`, `user.invited`,
  `user.token_refreshed`, …) with an intact hash chain, no explicit "log this" call
  required from the frontend. There is still no POST endpoint — nor should there be; a
  client-writable audit log defeats the point.
- **Frontend** — `audit.service.ts` gained `search`/`getEntryById`/`exportCsv`/
  `verifyChain` against the real endpoints (`useAuditEntries`, `useAuditEntry`,
  `useExportAuditCsv`, `useVerifyAuditChain` in `useAudit.ts`), and `/admin/audit` (Tenant
  Audit) now reads and paginates the real trail, with a "Verify integrity" action.

*Update 2026-10-20:* `GET /audit` and `GET /audit/:id` return `actor {id,name,email}` next to
`actorId` (edms-backend PR #53; null for system entries and deleted users). The Actor
column on `/admin/audit`, `/auditor/trail` and the compliance activity panel reads it.
Before, they looked actors up in `GET /users`, a 403 for `internal_auditor`, so the
auditor's own trail showed UUIDs. Verified live as `auditor` and `client_admin`.

*Update 2026-09-18 (later the same day):* `auditor/trail` and `management/compliance`'s
"sensitive activity" panel are both migrated now. Pulled a 78-entry live sample first to
get the *real* action vocabulary (`user.login`, `document.access_denied`,
`role.permissions_updated`, `document.viewed`, `document.comment_added`, …) rather than
guessing — the old `REDACT_RELEASE`/`SIGN`/`PRINT`/`DOWNLOAD`/`SLA_ESCALATION`/
`ACCESS_REQUEST` codes were entirely app-invented and matched nothing real.
`auditor/trail` now reads `useAuditEntries` with real pagination, actor/action/date
filters and CSV export; `management/compliance`'s panel filters on a confirmed-real
`SENSITIVE_ACTIONS` list (access-control and role/permission-change events specifically,
not a generic recent-activity feed).

**Regression found and fixed 2026-09-21: `auditor/trail` never stopped loading.**
`GET /audit` was returning data fine — this was never a backend problem. The page
computed its `from` filter inline, `new Date(Date.now() - days * 86400000).toISOString()`,
on every render. `useAuditEntries`' query key includes the whole `filters` object, so a
`from` timestamp that changes by a few milliseconds on every render meant the query key
changed on every render — React Query never got to reuse a previous result, so the
"current" query was permanently a brand-new one that had never been fetched, and
`isLoading` for it was permanently `true`. `admin/audit` (`from`/`to` from `useState`,
only set by the date pickers) and `management/compliance` (a fixed `{limit:100, page:1}`,
no date math) never had this problem — only `auditor/trail` computed a filter from
`Date.now()` inline. Fixed by memoizing `from` on `days` alone
(`useMemo(() => …, [days])`), so the query key is stable until the user actually
changes the day-range dropdown.

`platform/audit` is the one exception, and stays on `SEED.audit` — not an oversight.
Confirmed its whole premise has no backend equivalent: `GET /audit` is scoped to the
caller's own tenant with no cross-tenant query, and there is no platform-level
multi-tenant API anywhere in this backend at all — every other `/platform/*` page
(tenants, provisioning, billing, flags) is equally fixture-only. Migrating audit alone
wouldn't be meaningful without the rest of the platform module having something real to
query first; that's a separate, materially bigger backend ask than "point this hook at
an endpoint." `useCreateAuditLog()` is still a no-op mock for the reason already given
above: there is no write endpoint to point it at, by design.

### 🟡 Backend capabilities with no UI

> ⚠️ **Correction (2026-09-18).** Every item previously listed here (version restore,
> archive, cabinet access grants, cabinet metadata fields, delegations, workflow history)
> is wired now — verified by reading the actual consuming pages, not re-derived from
> scratch. Control exceptions sat here for one day (backend 2026-10-29) and got their UI
> the same day.

Nothing currently known to be backend-complete with zero UI.

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

### ✅ 8.2 Enum casing — **Resolved (frontend), 2026-09-21/22**

*Original finding:*

| Concept | Backend | Frontend `SEED` / `initialData.ts` |
|---|---|---|
| Confidentiality | `public` `internal` `confidential` `restricted` `top_secret` | `Public` `Internal` `Confidential` `Restricted` `Top Secret` |
| Urgency | `low` `normal` `high` `critical` | `Low` `Normal` `High` `Critical` |
| Status | `pending` `in_progress` `on_hold` `closed` | `Pending` `In Progress` `On Hold` `Closed` `Overdue` |

The upload page mapped between them by hand (`CONF_LEVELS`), correctly, but only in that
one component. Every other page rendering a badge or filtering a list was comparing
against whichever casing its data source happened to use.

**What shipped:** `StatusBadge`/`ConfBadge`/`UrgBadge` (`components/ui/Badges.tsx`) now
run a shared `titleCase()` (`@/utils/helpers`) on their display text before rendering —
`_` → space, then Title Case each word. Idempotent on input that's already correctly
cased (SEED fixtures), correct on raw backend enums (`'in_progress'` → `'In Progress'`),
and correct even when a caller had already half-mangled it (`'Top_secret'` still becomes
`'Top Secret'`, since the underscore-to-space step doesn't care what already ran before
it). This fixes display at every current call site — 34 of them — without needing to
touch most of them individually.

**A real functional bug fell out of checking this, not just a display one:**
`search/page.tsx`'s facet filter and per-facet count computed
`confidentiality = d.confidentiality.charAt(0).toUpperCase() + d.confidentiality.slice(1)`
— correct for single-word values, but `'top_secret'` → `"Top_secret"`, which matches
nothing in the Title-Case `CONF_LEVELS` facet list (`'Top Secret'`, with a space). A
`top_secret` document could never be found via that filter and its facet count always
showed 0 — silently, since the filter itself never errored. Fixed by using `titleCase()`
for the comparison value too, not just display.

#### ✅ DRIFT-13 — `effStatus()` was a no-op on all real data — **Resolved (frontend, 2026-09-21)**

`Overdue` is a frontend-only status, previously computed by `effStatus()`, of which there
were **two divergent implementations** (`useStore.ts` and `helpers.ts`), both broken
against backend data for two independent reasons: the backend `Document` model has no
due-date field at all (`Task.dueAt`/`WorkflowInstance.stageDueAt` do, `Document` doesn't),
so the epoch/ISO-string due-date branch was always unreachable; and the status comparisons
were capitalized (`'Closed'`) while the backend emits lowercase (`'closed'`), so even the
non-`Overdue` early returns never fired. Net effect: an identity function on every
API-sourced document, working only on `SEED` fixtures.

**What shipped:** both implementations deleted. Task-bearing views
(`staff/tasks`, `TaskRow`) now use `taskStatusLabel`/`isOverdue` (`@/utils/supervisor`) —
correct code that already existed in the repo, just never imported anywhere until this
fix, so it had been dead since it was written. Document-only views (`staff/cabinets`,
`search`) get `documentStatusLabel` (`@/utils/helpers`) — casing-correct, and honestly
drops the `Overdue` claim entirely rather than fabricating one, since a document truly
has no due date to be overdue against. The fictional `Document.dueDate` field (never
real, confirmed against `filing.prisma`) was removed from `models.ts`.

Of the eight call sites the original finding named, three (`supervisor/bottlenecks`,
`supervisor`, `staff/performance`) turned out to already compute overdue-ness correctly
inline, independently of `effStatus()` — the finding's "eight sites, all broken" was
itself somewhat stale by the time this was fixed. The actual broken set was four:
`staff/tasks`, `staff/cabinets`, `search`, and `TaskRow` (shared by `staff`'s dashboard).

### 8.3 `top_secret` is settable but unreadable

The backend's Zod schema accepts `top_secret`. Since `edms-backend` `0dab81a` (2026-10-08),
reading a tier above `internal` needs a permission rather than membership of a role list:
`document:view_confidential`, `document:view_restricted` or `document:view_top_secret`,
whose scope narrows it (`department` = documents in the caller's department's cabinets,
`own` = documents they uploaded). No seeded role holds `view_top_secret`, so a document
filed at that tier is unreadable until an admin ticks it on some role in `/admin/roles`.
That is now recoverable, but still a trap.

The frontend copies the backend's check as `isConfidentialityActionAllowed` in
`src/constants/documentLevels.ts`, fed by `useConfidentialityClearance` (permissions from
`/auth/me`, department from `GET /users/:id`). The upload form never offers `top_secret`
(`CONF_LEVELS` omits it). The document page's "Change classification" dialog disables any
tier the caller couldn't open the document at, and lists Top Secret only for a caller
cleared for it. The API still accepts any tier on `PATCH /documents/:id`, so the backend
fix below stands. *(This paragraph used to describe a doc-detail edit form driven by
`SEED.policies`; no such form existed. Corrected 2026-10-08.)*

**Fix:** backend should verify the writer's clearance for whatever tier they assign.

### ✅ 8.4 DRIFT-17 — Notification `actionUrl`s used the backend's path vocabulary — **Resolved (frontend, 2026-10-02)**

Every backend `actionUrl` (in-app notification payloads **and** the branded emails, both
resolved against `APP_URL`) named a path this app does not have:

| Backend writes | Written by | Now lands on |
|---|---|---|
| `/tasks/:id` | task assign/delegate/next-stage, SLA warning/breach/escalation, instance reassign | `src/app/(app)/tasks/[id]` → `GET /tasks/:id` → `/workflow-instances/{workflowInstanceId}?task={id}` |
| `/workflow-instances/:id` | workflow completed / rejected | `src/app/(app)/workflow-instances/[id]` — the workflow page itself (same path, no redirect) |
| `/documents/:id` | access grant/deny, checkout reminder/overdue | `next.config.ts` redirect → `/doc/:id` |
| `/documents/:id/access-requests` | access requested | redirect → `/admin/access-requests` |
| `/reset-password?token=` | password-reset email | redirect → `/set-password?token=` (same `POST /auth/reset-password` flow) |
| `/login` | password set / reset emails | redirect → `/` |

The four path-only mappings are `redirects()` in `next.config.ts`, which run **before**
`proxy.ts`, so they work for email links too — verified 2026-10-02 against `next start`
(307s to the right targets, query string kept). `/tasks/[id]` is a thin lookup page.
Previously every one of these 404'd.

**Still open:** `/admin/access-requests` is gated on `document_access_request:view` since
2026-10-12 (it was `user:edit`, which no access-request route checks). But the
access-requested notification goes to the document's **creator**, who usually lacks that
permission and lands on `/unauthorized`. There is no per-document review UI. A backend change to target
`/doc/:id`, or a per-document requests panel, would close it.

### 8.5 Date/number types

`DocumentVersion.fileSize` is a Prisma `BigInt`. `app.ts` installs a JSON replacer
converting `bigint` → `Number`, so the wire format is a JS number — fine below 2^53, and
undocumented in Swagger. All timestamps are ISO strings from `@db.Timestamptz`; the
frontend `SEED` uses epoch milliseconds (`d()` helper in `initialData.ts`). Any component
reading both must handle both.

---

## 9. Configuration & environment drift

### `EDMS-FRONTEND/.env`

> ✅ **Corrected (2026-09-22).** Everything below this note used to describe a
> duplicate `NEXT_PUBLIC_API_URL` key plus three dead keys (`API_URL`,
> `LOCAL_API_URL`, `STAGING_URL`). None of that is true of the current file —
> flagged directly by the user, who'd just checked it. The `.env` in the repo
> today is:
>
> ```env
> NEXT_PUBLIC_API_URL=https://edms-backend-zmfm.onrender.com
> NEXT_PUBLIC_UPLOAD_BASE_URL=https://4c73wdutl4.execute-api.us-west-1.amazonaws.com/staging/fileupload/multipart
> NEXT_PUBLIC_BRAND=schulltech
> ```
>
> `.env` is gitignored (`.gitignore`: `.env*`), so this is a *local* build setting rather
> than something in the repo — the quoted `NEXT_PUBLIC_BRAND` said `galaxybackbone` until
> 2026-10-14, and it is whatever brand the developer is building. Corrected 2026-10-14.
>
> Three keys, no duplicates, nothing dead. `NEXT_PUBLIC_API_URL` points straight at
> the deployed backend (not `localhost:3001` — that only ever appears as
> `api-client.ts`/`auth.server.ts`'s `||` fallback, used when the env var is
> unset, e.g. a fresh local clone before this file exists). `NEXT_PUBLIC_UPLOAD_BASE_URL`
> is newer than the last time this section was written — it's what the chunked
> multipart uploader (§5) actually calls; the `qerhd0lxje.execute-api.us-east-1…`
> host quoted in `uploader.ts`'s own fallback default is not what's live in this
> deployment, since the env var overrides it. §5's upload-path diagram previously
> asserted the multipart flow hits "the same third-party gateway host" as the old
> single-shot one — that was written from the code's fallback default without
> checking `.env`, and is wrong: they're different hosts, in different regions
> (`us-east-1` or `us-west-1`, depending which fallback vs. `us-west-1` for the
> real one), which matches the `us-west-1` bucket region confirmed live during
> the DRIFT-06 investigation.

*Original finding, for history — no longer describes the current file:*

```env
API_URL=https://edms-backend-zmfm.onrender.com     # unused by any code
LOCAL_API_URL=                                      # unused
STAGING_URL=https://edms-kappa.vercel.app/          # unused
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=                                # duplicate key — this one won
```

`auth.server.ts` — which runs **server-side** in the route handler — reads
`NEXT_PUBLIC_API_URL`, same as the client. That still works, but it means the backend
URL used for server-to-server calls is baked into the client bundle rather than kept in
a separate non-public variable. Not urgent enough to be its own finding on its own.

`.env` itself is **git-ignored** (`.gitignore:34`), so none of these values are committed —
a fresh clone builds with `NEXT_PUBLIC_BRAND` unset, i.e. SchullTech, and the backend URL
falls back to `api-client.ts`'s `||` default.

### `NEXT_PUBLIC_BRAND` — the white-label switch (added 2026-10-14)

| | |
|---|---|
| Values | `schulltech` (default) · `galaxybackbone` |
| Unset or unknown | resolves to `schulltech` — `getBrandPreset()` maps anything that isn't exactly `galaxybackbone` to it |
| Read by | `src/lib/brand.ts`, the only place that reads it. `src/app/layout.tsx`, `AuthShell`, `Sidebar`, `Topbar`, `useNavigation`, `app/page.tsx` and the Policies page all go through its exports |
| Build-time | `NEXT_PUBLIC_*` is inlined at compile: restart `next dev` after changing it, and redeploy on Vercel. It cannot be switched per request |

What the preset drives: the app name and tab title, sidebar sub-line, logo (`logoUrl`, else
the `logoText` wordmark, else the app name's first letter), favicon, the sidebar/tenant
colours written onto `<html>`, and the login hero copy and footer credit. It also carries the
`features` flags that hide or show whole surfaces: `brandingPage` (`/admin/branding`),
`tenantStorage`, `productGuide`, `extendedPolicyTabs` (Confidentiality/Retention/Controls on
`/admin/policies` — Urgency & SLA always stays) and `loginTestAccounts`.

Colour fields are **optional and deliberately sparse**: `schulltech` sets none of
`ctaBg`/`ctaBgHover`/`focus`, so `globals.css` keeps deciding those per theme (near-black
buttons and a blue focus in light, the violet gradient in dark). Only `galaxybackbone`
re-paints them, and its `focus`/`focusDark` pair is composed by `:root` and
`[data-theme="dark"]` — an inline `--focus` would beat the dark rule, which is exactly the
bug that was fixed on 2026-10-14.

**Not every surface follows the brand.** Toasts are the deliberate exception: they use
`--toast-bg` (`#23252E`, defined once in `:root` and never per theme or brand) rather than
`--cta-bg`. Inheriting the CTA colour meant `galaxybackbone`'s green painted light-mode
toast panels green, while dark mode had to override the violet gradient back to a neutral
anyway — so the two themes disagreed, and a brand could repaint a surface that was already
being forced. Corrected 2026-10-14; verified by raising a real "Search saved" toast with
`--cta-bg` forced green: panel `#23252E`, text white, the green status tick and the 60%-white
close button unchanged.

Persisted branding: `src/store/useStore.ts` persists the whole state under `edms-state-v3`,
`branding` included. The stored copy carries `brandKey` (which preset wrote it) and `source`
(`preset` or `custom`), and `AppShell` drops it when the key doesn't match the active preset —
so a browser that ran one brand can't keep it under the other — or when it is preset-owned and
its values have changed. A `custom` copy is the `/admin/branding` page's publish and survives.

### Backend worker settings (`edms-backend/src/config/env.ts`)

| Variable | Default | Used by |
|---|---|---|
| `SLA_WARNING_HOURS` | `4` | `sla-breach.worker` — warn this long before a task's `dueAt` |
| `SLA_RECONCILE_INTERVAL_MS` | `300000` | `sla-breach.worker` schedule |
| `DELEGATION_RECONCILE_INTERVAL_MS` | `300000` (min `60000`) | `delegation-reconcile.worker` schedule — moves open tasks to the delegate of a delegation in effect (added `436ea83`, 2026-10-29) |
| `CHECKOUT_REMINDER_HOURS` | `24` | `checkout-overdue.worker` — `checkout.reminder` to the holder this long before `expectedReturnAt` (added `b4a3f81`, 2026-09-29) |
| `CHECKOUT_OVERDUE_RECONCILE_INTERVAL_MS` | `300000` | `checkout-overdue.worker` schedule; once past due it sends `checkout.overdue` to the holder and to `supervisor`s in the holder's department |
| `APP_URL` | `https://edms-kappa.vercel.app` (was `http://localhost:3000` until PR #49) | Base for every notification/email `actionUrl` — must be this app's origin, or `notificationHref` drops the link as cross-origin (see §8.4). Links from the deployed backend now open the Vercel app, so a notification clicked while testing on `localhost:3000` leaves the local app |
| `GEMINI_API_KEY` | unset | `summary.workers` — AI document summaries. Without it every summary is `skipped`. Set on the live backend (summaries complete, checked 2026-10-13) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | `ai-summarizer` |
| `SUMMARY_MAX_INPUT_CHARS` | `120000` | Cap on OCR text sent for a summary |

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

### ✅ DRIFT-12 — The login page's test accounts (resolved)

**Resolved in code by 2026-09-15; the docs caught up 2026-10-14.** Set 2 moved to the
`tjoel+…` addresses in `aa11682` (2026-08-31) and Set 1 was deleted in `ce4d968`
(2026-09-15). `src/app/page.tsx` now renders one row of seven autofill buttons (dev
builds, and only when the brand preset's `loginTestAccounts` is on), one per seeded
account below. **Verified live 2026-10-14:** `POST /auth/login` succeeds for all seven.

*Was:* two rows of autofill buttons — Set 1 (`chika@firstatlantic.com` etc., the
`initialData.ts` fixture personas) and Set 2 (`boyebamiji+staff@schulltech.com` etc.) —
none of which existed in the backend, so every button failed.

The backend seed creates, all with password `Fixture123!`:

```
tjoel+staff_finance@schulltech.com        → staff
tjoel+staff_hr@schulltech.com             → staff
tjoel+supervisor_finance@schulltech.com   → supervisor
tjoel+management_ops@schulltech.com       → management
tjoel+clientadmin@schulltech.com          → client_admin
tjoel+schulltechadmin@schulltech.com      → schulltech_admin
tjoel+auditor@schulltech.com              → internal_auditor
```

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
| **DRIFT-14** | 🟠 **Med — latent** *(was 🔴 Critical; re-tested live 2026-10-16)* | Workflow definitions are readable only by `client_admin`/`schulltech_admin`, so `staff` and `supervisor` cannot list the workflows they hold `workflow_instance:route` for | Backend | *2026-10-16:* **not affecting the live tenant**, whose four roles still hold `workflow:view:global` (most likely left over from the pre-2026-09-16 seed) and get 200 from `GET /workflows`. On a freshly seeded database, **document routing is unreachable.** The picker reports "no published workflows", which is neither true nor the reason. Re-diagnosed 2026-09-21: the hardcoded role list is gone (replaced by real `requirePermission`), but the RBAC seed data that replaced it never re-granted `workflow:view` to non-admin roles |
| ~~DRIFT-20~~ | ✅ **Resolved (frontend, 2026-10-12)**, verified live | `POST /documents/:id/access-requests` requires `permission: 'view' \| 'route'` since `edms-backend` `3014b89`; `documentsService.requestAccess` sent only `{ reason }` | Frontend | Was: **Request access refused for everyone (422)**, on `/doc/[id]` and the workflow page. Fix: send `view` from the document page; on the workflow page, ask for whichever of `view`/`route` the document's `access` lacks. Show the permission in `/admin/access-requests` |
| ~~DRIFT-21~~ | ✅ **Resolved (frontend, 2026-10-12)**, verified live | `GET /tasks/:id` and `GET /workflow-instances/:id` now return documents the caller can't see, redacted ("Restricted document", `confidentiality: null`, no version) with an `access` object | Frontend | **The workflow page throws** for anyone whose task holds such a document: the access overlay renders `ConfBadge` with `null`, and `titleCase(null)` calls `.replace` on null. Fix: drive the overlay from `access`/`isLocked`, guard null fields, and keep locked documents out of the action pickers unless `canRoute`. Workflow history also blanks comments, notes and signatures in workflows holding such a document (by design) |
| **DRIFT-22** | 🟠 Med (found 2026-10-12; **intended**, per the backend developer the same day) | At `own` scope, workflow visibility (`buildInstanceAccessFilter`, `canActorAccessInstance`) follows task assignment only; `3014b89` dropped the "created one of its documents" clause | Backend (decision) | A `staff` user who routes a document to a supervisor stage can't see or open that workflow; `/doc/[id]`'s Workflows card goes empty and offers "Route to workflow" again. Confirmed intended; the frontend follow-up is explaining the empty state (doc 05 backlog 14b) |
| ~~DRIFT-23~~ | ✅ **Resolved (frontend, 2026-10-14)**, verified live incl. the counterfactual | `sessionExpired` was cleared only by `performLogout`, but a session can also end via `proxy.ts`'s redirect to `/` (a dead token on a navigation) — not a logout | Frontend | Was: the "your session ended" modal covered the app immediately after a *successful* re-login, because the flag set during the dead session outlived it (`useUIStore` isn't persisted, so it persisted for the tab's lifetime). Fix: clear it on login success and on a live `GET /auth/me` — see §3 |
| ~~DRIFT-24~~ | ✅ **Resolved (frontend, 2026-10-14)**, verified live | The login page trusted the store's persisted `currentUser` as proof of a session, and `proxy.ts` left dead cookies in place on its redirect | Frontend | Was: **with a dead session `/` rendered nothing at all and stayed that way across reloads** — the persisted user made the page return `null` while its portal push was bounced back by the proxy, so signing in was impossible without clearing site data. Fix: the proxy deletes the dead cookies, and the login page drops a persisted user with no `accessToken` behind it — see §3 |
| ~~DRIFT-18~~ | ✅ **Resolved (frontend, 2026-10-02)** | `request_changes` required a `documents` array the frontend didn't send (`5144fc7`, multi-document workflows) | Frontend | Was: "Send back" failed validation for every user. Fixed as part of the doc/workflow page split — the new `/workflow-instances/[id]` asks which of the task's documents need changes. Not yet verified e2e |
| ~~DRIFT-17~~ | ✅ **Resolved (frontend, 2026-10-02)** | Notification/email `actionUrl`s (`/tasks/:id`, `/workflow-instances/:id`, `/documents/:id…`, `/reset-password`, `/login`) named routes this app doesn't have | Frontend | Was: every notification deep-link and the password-reset email 404'd. One gap left: access-request links go to a page the document's creator usually can't open — see [§8.4](#8-contract-shape-drift-same-url-different-meaning) |
| ~~DRIFT-16~~ | ✅ **Resolved (frontend, 2026-09-21)** | Frontend route guard (`routes.config.ts`, `PORTALS`) gated `/supervisor` and `/management` on `workflow:route`/`dashboard:view` — retired/fictional keys no role could ever hold | Frontend | Was: real supervisors and management users redirected to `/unauthorized` by the app's own guard, independent of what the backend allowed |
| ~~DRIFT-11~~ | ✅ **Resolved** | Backend audit module real & auto-writing; `/admin/audit`, `auditor/trail` and `management/compliance` all migrated 2026-09-18 | — | `platform/audit` stays on `SEED` — no cross-tenant `GET /audit` exists, and no platform-level API exists at all to migrate it *to* |
| ~~DRIFT-15~~ | ✅ **Resolved** | ~~`POST /auth/reset-password` sent `newPassword`/`confirmPassword`~~ — backend wants `password` | Frontend | Was: blocked **every** password reset and invitation acceptance, on every role |
| DRIFT-06 | 🟨 **Half-resolved (backend, PR #51 live 2026-10-14)** — the search half is fixed, the reliability half isn't | Live-verified against the deployed backend: OCR works, real uploads get real extracted text, every `fileUrl` resolves to `env.S3_BUCKET`. The "wrong bucket" claim was code-level speculation, never checked live, and was wrong. Real, narrower finding: one document out of eight sat at `ocrStatus: 'pending'` for 3 days — a lost/never-picked-up job, not a Textract rejection. **Fixed 2026-10-14:** indexing no longer waits on OCR (index at create; re-index on title change, metadata change and restore; index even when OCR finally fails), so nothing is invisible to search because its OCR job died. Still open: the reconciliation sweep + manual "Retry OCR" that would unstick a job in the first place, and no backfill for versions already stranded | Backend (reliability, not architecture) | Was overstated as "OCR always fails" — see [§5](#5-the-document-storage-path-and-why-ocr-cannot-work) |
| ~~DRIFT-05~~ | ✅ **Resolved** | ~~Workflow routes have zero permission checks~~ — router-level `requirePermission` added 2026-09-16 on top of the five services' own `_FORBIDDEN` assertions | Backend | Was: any staff account could publish or archive workflow definitions |
| ~~DRIFT-02~~ | ✅ **Resolved (frontend, 2026-09-21)** | `src/proxy.ts` (Next.js 16's `middleware.ts` replacement) resolves real roles/permissions from `GET /auth/me` server-side on every protected navigation, fails closed only on a confirmed 401/403, fails open on an unreachable backend — backed by `SessionExpiredModal` and `ServiceUnavailableOverlay` so fail-open doesn't mean "silently broken." Live-verified against a real dev server, including a genuinely unreachable backend. | Frontend | Was: any role forgeable via localStorage; fully exposed all `SEED`-backed portals |
| ~~DRIFT-09~~ | ✅ **Resolved** | ~~`POST /workflow-instances/start` 404s~~ — two-call sequence shipped 2026-09 | Frontend | Was: document routing did not work from the UI at all |
| ~~DRIFT-10~~ | ✅ **Resolved (verified 2026-09-21)** | Notifications module and UI both exist, and `notifyUser`/`notifyAssignment`/`notifyRole` are now called from task assignment, reassignment, delegation, task outcomes, access-request grant/deny, and SLA warning/breach | Backend | Was: task assignment, SLA warnings and returned work were all silent |
| DRIFT-10b | 🟠 Med | No JSON 404 handler — Express returns HTML *(re-confirmed live 2026-10-16: an unknown route returns a `text/html` 404)* | Backend | Any missing route surfaces as an axios parse error, not a clean 404 |
| DRIFT-03 | ✅ **Resolved 2026-09-15** | `resource:action` vs `resource:action:scope` | — | `src/lib/permissions.ts` compares first two segments + parses scope; backend now sends scoped `permissions` on login + `/auth/me` |
| DRIFT-01 | 🟨 **Frontend fixed 2026-09-10** | `POST /auth/logout` missing | Backend | Sidebar sign-out now calls it with the bearer token; backend route + denylist still outstanding — confirmed still absent from `auth.router.ts` 2026-09-21 |
| DRIFT-08 | ✅ **Resolved (frontend 2026-09-10, reaffirmed 2026-09-18)** | `/documents/:id/comments` + `/signatures` 404 | Frontend | Neither is a document operation. Comments = `comment` on `POST /tasks/:id/action`; signature = `signature` image on its `approve` action. `/doc/[id]` and the supervisor approvals queue rewired; a signature pad (`SignaturePad` + `useSignAndApprove`) captures/uploads the image. Dead `documents.service` methods + hooks removed. **2026-09-18 same-day update:** the dedicated `GET/POST /documents/:id/comments`/`/signatures` endpoints turned out to be real (not 404) and were briefly wired, then deliberately un-wired again — product wants one trail, not two. See BE-16/BE-17. |
| DRIFT-04 | ✅ **Frontend resolved 2026-09-10** | Frontend role heuristics contradict backend grants | Frontend | Heuristic block deleted; gating is permission-key based (`routes.config` `anyPermissions`), `/platform` still role-gated by design |
| ~~DRIFT-12~~ | ✅ **Resolved (frontend, by 2026-09-15)**, verified live 2026-10-14 | Login test accounts didn't exist in the backend | Frontend | Was: every autofill button failed, blocking new-dev onboarding. The seven buttons now use the seeded `tjoel+…` accounts; this row went stale until 2026-10-14 |
| — | 🟠 Med | Prisma client stale → all users forced to `department` scope | Backend | Run `npx prisma generate` |
| ~~DRIFT-13~~ | ✅ **Resolved (frontend, 2026-09-21)** | `effStatus()` deleted from both `useStore.ts` and `helpers.ts`. Task rows (`staff/tasks`, `TaskRow`) now use `taskStatusLabel`/`isOverdue` (`@/utils/supervisor`) — already correct, just never imported. Document rows (`staff/cabinets`, `search`) get `documentStatusLabel` — casing fixed, no fabricated `Overdue` since `Document` has no due-date field anywhere in the backend schema. The fictional `Document.dueDate` field removed from `models.ts` | Frontend | Was: "Pending"/"Overdue" status filters on `/staff/tasks` matched nothing; badges showed raw lowercase status |
| ~~DRIFT-07~~ | ✅ **Resolved (frontend, 2026-09-21)** | Client-side aggregation via `fetchAllPages` replaced by the server aggregation endpoints in all four management dashboards + Performance Overview | **Frontend** | Was: management dashboards fired up to 50 sequential requests; 7 of 8 aggregation endpoints had no caller |
| — | 🟡 Low | `top_secret` settable but unreadable by anyone | Backend | Documents can be permanently orphaned |
| ~~— Cabinet access-grant CRUD has no UI~~ | ✅ **Corrected (2026-09-21) — already built** | `admin/cabinets` has a full "Access" card: grant modal (role/user picker + permission select), grant table, revoke button with confirm. Wired to `useCabinetAccessGrants`/`useGrantCabinetAccess`/`useRevokeCabinetAccess`, which already existed too. This doc's claim was stale, not a real gap | — | — |
| ~~— Enum casing mismatch~~ | ✅ **Resolved (frontend, 2026-09-22)** | `StatusBadge`/`ConfBadge`/`UrgBadge` now run a shared `titleCase()` (`@/utils/helpers`) on their display text — handles snake_case → words and lowercase → Title Case in one pass, idempotent on already-correct input, so every current and future caller is right regardless of which casing its data source used. Also fixed a real functional bug this uncovered: `search/page.tsx`'s facet filter/count used a naive `charAt(0).toUpperCase() + slice(1)`, which mishandled `'top_secret'` (→ `"Top_secret"`, matching nothing in the Title-Case facet list) — a `top_secret` document could never be found via that filter, and its count always showed 0 | Frontend | Was: badges showed raw lowercase/snake_case text on some pages; `top_secret` documents were invisible to the confidentiality facet specifically |
| — | 🟡 Low | `roles` has three shapes across endpoints | Both | Defensive shims scattered through components |
| ~~DRIFT-19~~ | ✅ **Resolved (backend PR #50, live 2026-10-13)** — this row was stale until 2026-10-16 | Multi-document workflows (`edms-backend` `919d0ef`): list responses carry no stage or deadline | Both | **Frontend done 2026-10-07, confirmed in testing 2026-10-08:** routing sends `documents[]` (one workflow per routed group); types rebuilt (`WorkflowDocumentExecution`); `@/utils/workflowDocuments` derives titles, deadlines and stages; the workflow page and Monitor drawer rebuild each document's position from workflow history; approve/reject/review can act on chosen documents. ~~**Still missing (backend):** deadlines in `GET /tasks` and executions in `GET /workflow-instances`, so task due labels, the Overdue filter (now backed by open SLA breaches), the Monitor's stage/due columns show "—"; and no endpoint over `workflow_sla_outcomes`, so on-time % shows "—". Requested 2026-10-07~~ **Shipped in PR #50:** both lists carry each document's execution with `stageDueAt` (re-checked live 2026-10-16), read by `taskDueAt`/`instanceDueAt` in `@/utils/workflowDocuments`; `GET /sla/outcomes/summary` gives on-time %. Verified 2026-10-13 (TEST_PLAN Phase U: TP-U1, U3, U4) |
| ~~— Duplicate `NEXT_PUBLIC_API_URL` in `.env`~~ | ✅ **Corrected (2026-09-22) — not real, doc was stale** | The user checked the live `.env` directly: one `NEXT_PUBLIC_API_URL` key, no duplicate, no dead `API_URL`/`LOCAL_API_URL`/`STAGING_URL` keys either. See §9. | — | — |

### Suggested order of attack

*Re-ordered 2026-09-21. DRIFT-07, DRIFT-10 and DRIFT-16 are done; DRIFT-14 is
re-diagnosed but still open and still item 1.* *2026-10-16: item 1 no longer blocks the live
tenant, which holds the grant; it is still needed so a freshly seeded database works.*

**Do first — one seed-data change, and the core loop comes back (backend)**
1. 🔴 **Add `workflow:view` back to `staff`, `supervisor`, `management` and
   `internal_auditor` in `prisma/seed-system.ts`** (DRIFT-14). Not a code change — the
   router-level `requirePermission('workflow', 'view')` is already correct; the RBAC
   seed just never re-granted it to non-admin roles when `workflow:route` was split into
   `workflow_instance:route`/`task:*`/`delegation:*` on 2026-09-16. ~~**This one seed
   change currently blocks document routing entirely.**~~ *(2026-10-16: only on a freshly
   seeded database; the live tenant holds the grant.)* `MANAGE` (`create`/`edit`/
   `publish`/`archive`) should stay `client_admin` + `schulltech_admin` only.
2. ✅ ~~`npx prisma generate`~~ — done
3. ✅ ~~Add authorization to the workflow routes~~ — **done**, twice over: the five
   services' `_FORBIDDEN` checks (DRIFT-05) plus router-level `requirePermission` added
   2026-09-16
4. Add a JSON 404 handler to `app.ts` so missing routes fail legibly (DRIFT-10b)

**Then — frontend**
5. ✅ ~~Two-call create-then-start~~ — done (DRIFT-09 resolved)
6. ✅ ~~Upload through the backend instead of the third-party gateway~~ — **retracted**
   2026-09-21 (DRIFT-06). Live-verified the gateway upload already works; there was
   never a bucket mismatch to fix. Replaced with a narrower ask: a reconciliation sweep
   for OCR jobs stuck at `ocrStatus: 'pending'` (backend, not built in this pass — see
   §5).
7. ✅ ~~Adopt the eight aggregation endpoints and delete `fetchAllPages.ts`~~ — **done**
   2026-09-21 (DRIFT-07). The four management dashboards + Performance Overview now read
   `useDocumentStats`/`useTaskStats`/`useWorkflowInstanceStats`/`useOpenItemsByCabinet`
   directly; `useAllTasks`/`useAllWorkflowInstances` deleted as dead code.
   `useAllDocuments` stays for its one legitimate remaining use (listing every document
   in one cabinet for a folder-assignment UI).
8. ✅ ~~Fix the login test-account emails to the `tjoel+…` set~~ — **done** (DRIFT-12
   resolved; verified live 2026-10-14)
9. ✅ ~~Make `usePermissions` parse three-segment strings before anyone touches
   `/auth/me`~~ — **done**; backend now sends scoped `permissions` on login/`/auth/me`
   (DRIFT-03 resolved)
10. Fix `effStatus()` — one implementation, against a field that exists (DRIFT-13)
11. ✅ ~~Fix the `/supervisor` and `/management` route guards~~ — **done** 2026-09-21
    (DRIFT-16). Also fixed the audit trail's infinite-refetch bug on `auditor/trail`
    (unmemoized `Date.now()` in the query filter) while in this area.

**Then — make the governance half real**
12. ~~Build the audit module~~ — **done** (DRIFT-11 resolved). `/admin/audit`,
    `auditor/trail` and `management/compliance` all migrated to the real trail
    2026-09-18. `platform/audit` stays mocked by design — no cross-tenant backend
    exists to migrate it to.
13. ✅ ~~Build the notifications module~~ and ~~call it~~ — **both done.** `notifyUser`/
    `notifyAssignment`/`notifyRole` now fire from task assignment, reassignment,
    delegation, task outcomes, access-request grant/deny and SLA warning/breach
    (DRIFT-10 resolved, verified 2026-09-21).
14. ✅ ~~`middleware.ts` for server-side route protection~~ — **done** 2026-09-21
    (DRIFT-02), as `proxy.ts` per Next.js 16's rename. Fail-open on an unreachable
    backend, `SessionExpiredModal`/`ServiceUnavailableOverlay` covering the gap that
    would otherwise leave.

**Then — close the feature gaps**
15. ✅ ~~Comments + signatures endpoints~~ — resolved, and deliberately left un-wired
    (DRIFT-08); a gated `GET /documents/:id/download`
16. ~~Circulars~~ (wired 2026-10-05, pending a live check), policies and branding —
    policies and branding still mock on both sides
