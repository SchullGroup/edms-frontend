# Backend Requests — from the Frontend Team

**Raised:** 2026-08-29 · **Updated:** 2026-09-21
**Frontend:** `edms-frontend` @ `dev`
**Backend checked against:** `edms-backend` @ `dev` (`b1b0b68`) — **106 routes**

> **Update after `feat(workflow): close workflow gaps 1-10`.** Thank you — **BE-3 is
> done**, and it was the critical item on this list. Closing it introduced one new
> problem, raised below as **BE-12**, which is a one-line fix and currently blocks
> document routing entirely. Please take BE-12 first.

Everything below was verified against the code on both sides on the date above, not
assumed. Each item states what the frontend does today, what it needs, and why.

**Please read BE-12 first** — it is one line and the product's core loop is broken without
it. Then BE-1 and BE-4, which are security items rather than features.

---

## Summary

> **Resolved (2026-09-18):** this doc used to have two unrelated items both numbered
> BE-12 — "Split `WORKFLOW_DEFINITION_VIEW_ROLES`" and "password recovery". The
> password-recovery one is renumbered to **BE-13** below; BE-12 now refers only to the
> workflow-roles split.

| ID        | Ask                                               | Type         | Priority    | Blocking?                  |
| --------- | ------------------------------------------------- | ------------ | ----------- | -------------------------- |
| ~~BE-1~~  | ~~`POST /documents/:id/access-request`~~          | ✅ **Done**  | —           | —                          |
| **BE-2**  | `POST /auth/logout` + refresh-token revocation    | New endpoint | 🔴 High     | No — fails silently today  |
| **BE-12** | Split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES` | Small fix | 🔴 **Critical** | **Yes — routing is dead**  |
| ~~BE-3~~  | ~~Authorization on the workflow routes~~          | ✅ **Done**  | —           | —                          |
| **BE-4**  | Enforce confidentiality for download/print/export | Security fix | 🔴 High     | No                         |
| **BE-5**  | `GET /documents/:id/download`                     | New endpoint | 🟠 Med      | Yes — no way to get a file |
| **BE-18** | Recovery sweep for OCR jobs stuck at `ocrStatus: 'pending'` | Reliability fix | 🟠 Med | No — 1 of 8 documents affected so far |
| **BE-9**  | `policies` module                                 | New module   | 🟠 Med      | No — frontend on fixtures  |
| **BE-10** | JSON 404 handler                                  | Small fix    | 🟡 Low      | No                         |
| ~~BE-11~~ | ~~`audit` module~~                                | ✅ **Done**  | —           | —                          |
| ~~BE-13~~ | ~~`forgot-password` / `reset-password`~~          | ✅ **Done**  | —           | —                          |
| **BE-14** | Confidentiality-tier clearance option on roles    | New field/endpoint | 🟠 Med | No — per-document grants work meanwhile |
| **BE-15** | Revoke a granted `DocumentAccessGrant`            | New endpoint | 🟠 Med      | No — grants just accumulate |
| **BE-16** | Optional `signature` on the `review` task action  | Schema change | 🟠 Med      | No — "Mark reviewed" ships comment-only meanwhile |
| **BE-17** | Support >1 document per workflow instance         | Data model change | 🟡 Low | No — single-document version upload covers the common case |

---

## ✅ Already resolved — thank you

These were broken and are now working. Frontend has been repointed accordingly.

- **Notifications module** — all six routes live. We now use `GET /notifications`,
  `/unread-count`, `/preferences` (GET+PUT), `PATCH /:id/read` and `POST /read-all`.
- **Workflow instance start** — we were calling a non-existent
  `POST /workflow-instances/start`; the two-call `POST /workflow-instances` →
  `POST /:id/start` sequence is now used correctly.
- **Cabinet access grants** and **cabinet metadata fields** — both wired.
- **Delegations** and **workflow history** — both wired.
- **`/tasks/stats`** and **`/workflow-instances/stats`** — both consumed.
- **Workflow authorization (BE-3)** — all five workflow services now assert roles and
  return a named `403`. We had asked for `requirePermission` on the routes; you enforced
  it in the services instead, which works. One note for whoever verifies it next: a
  route-level grep for `requirePermission` still returns zero, so it reads as unfixed
  unless you know to grep `_FORBIDDEN`. Worth a comment in `workflows.router.ts`.
- **Asynchronous OCR** — `StartDocumentTextDetectionCommand` replaces the synchronous
  call, so multi-page PDFs work.
- **Presigned download URLs** (`getSignedDownloadUrl`) and **OCR text archiving**
  (`saveOcrText`) — both noted.
- **Eight aggregation endpoints** — instance stats, status counts, bottlenecks-ageing,
  team-status-matrix, open-items-by-cabinet, task stats, `GET /sla/breaches` and document
  stats. This is more than we asked for and it retires our client-side aggregation
  problem. **We have only adopted `/tasks/stats` so far — that is on us**, and we are
  tracking it.
- **Access requests (BE-1)** — `POST/GET /documents/:id/access-requests`, grant, deny, and
  the admin inbox, all confirmed live 2026-09-18. See BE-1 below.
- **Audit module (BE-11)** — `GET /audit`, `/audit/:id`, `/audit/export`, `/audit/verify`,
  all confirmed live 2026-09-18, entries written automatically. See BE-11 below for the
  full note (including a swagger path-prefix quirk worth a fix).
- **Password recovery (BE-13)** — `POST /auth/forgot-password` / `reset-password`, both
  confirmed live 2026-09-18. Also doubles as the invitation-acceptance flow. See BE-13
  below — the shipped body shape differs from what we asked for, which caused a
  frontend-side bug we've since fixed.

One naming note: we were calling `/notifications/mark-all-read`; the route is
`/notifications/read-all`. **We changed our side** — `read-all` is the better name and
pairs with `unread-count`. No action needed.

---

## ✅ BE-1 · `POST /documents/:id/access-request` — **DONE, thank you (confirmed 2026-09-18)**

Built, as `POST /documents/:id/access-requests` (plural — small naming difference from what
we asked, no action needed on our side, we matched it). Verified live end-to-end: create →
appears in `GET /documents/:id/access-requests` and the admin inbox
`GET /documents/access-requests` → `grant`/`deny` both work and set `reviewedBy`/`reviewedAt`.
Frontend wired 2026-09-18: the "Request access" button on `/doc/[id]` is real now, and
`/admin/access-requests` (new page, client_admin-only) handles grant/deny.

**One thing we couldn't verify:** whether the document owner actually gets notified.
The shipped design is a manual client_admin review queue rather than the auto-notify-owner
flow we originally sketched (point 3 below) — which may be the better design (auditable,
actionable, no risk of the owner missing a fly-by notification), but we don't have
visibility into whether `notifyUser` fires on creation, since checking would require
logging in as the specific document's owner. Flagging as unverified, not broken.

**Original ask, for reference:**

**Priority: High. This is a security item, not a feature request.**

### What we found

The document detail page had a "Request access" button that called
`POST /api/v1/notifications` with an arbitrary `userId` in the body — the document owner's.
That route does not exist, so it 404'd silently and nobody was ever notified.

**We have removed that call rather than asking you to build the endpoint it wanted.**

### Why we did not just ask for `POST /notifications`

Because it would let any authenticated user create a notification addressed to any other
user, with arbitrary text. That is a phishing and spoofing vector: a hostile user could
send "Your document was approved — click here" to anyone in the tenant, and it would render
in the notification centre with full system credibility.

The client should never be able to name the recipient.

### What we need instead

```
POST /api/v1/documents/:id/access-request
Body: { "reason"?: string }
```

The server should:

1. Resolve the requester from the session (never from the body)
2. Look up the document's `createdBy`
3. Call the existing `notificationsService.notifyUser(...)` — the helper already exists at
   `notifications.service.ts:30`
4. Write an audit entry once BE-11 lands
5. Return `204`

**Suggested payload for the notification:**

```json
{
  "title": "Access requested",
  "message": "<requester name> requested access to \"<document title>\".",
  "actionUrl": "/doc/<documentId>"
}
```

`NOTIFICATION_TYPES` in `workflow.constants.ts` has no suitable member — please add
something like `document.access_requested`.

### Until then

The button records the audit action and shows a toast. **The owner is never notified.**
The feature is effectively disabled.

---

## 🔴 BE-2 · `POST /auth/logout` + refresh-token revocation

> **Frontend update 2026-09-10.** The Sidebar "Sign out" button now actually calls
> `authService.logout()` → `POST /api/auth/logout` **with the `Authorization: Bearer`
> header**, then clears the React Query cache and local session. Our BFF deletes the
> `refreshToken` cookie and forwards to `${API_URL}/api/v1/auth/logout`. Everything on
> the frontend side is in place — we just need the backend route + denylist below.

### What we found

`auth.server.ts:24` calls `POST ${API_URL}/api/v1/auth/logout`. `auth.router.ts` registers
only `/login`, `/refresh` and `/me`. The call 404s, and our BFF swallows the failure in a
`try/catch`, so **logout appears to succeed**.

### Why it matters

The refresh token stays cryptographically valid for its full 7 days after the user logs
out. There is no denylist, no rotation and no revocation, so a token captured before
logout still mints access tokens afterwards. On a shared machine, "log out" does not end
the session.

`AUDIT_ACTIONS` already defines `user.logout`, which can never be written today.

### What we need

```
POST /api/v1/auth/logout
Header: Authorization: Bearer <access token>
Body:   { "refreshToken": "<token>" }   // we can send it from the BFF
```

Revoke the refresh token — Redis is already a dependency, so a denylist keyed on the token
`jti` with a TTL matching `JWT_REFRESH_EXPIRES` would be the cheapest correct fix. Return
`204` whether or not the token was already invalid (don't leak validity).

**Related, same area:** there is no rate limiting on `POST /auth/login`. Unlimited password
guessing is currently possible. `express-rate-limit` on that one route would close it.

---

## 🔴 BE-12 · Split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES`

**This is now the most serious item in this document, and it is one line.**

### What we found

In `src/shared/constants/workflow.constants.ts`:

```ts
export const WORKFLOW_DEFINITION_MANAGE_ROLES = ['client_admin', 'schulltech_admin'] as const;
export const WORKFLOW_DEFINITION_VIEW_ROLES  = WORKFLOW_DEFINITION_MANAGE_ROLES;
```

Read access was aliased to manage access, and `definitions.service.ts` calls
`assertCanView` on both `list` and `getById`. So `GET /workflows` now returns `403
WORKFLOW_DEFINITION_VIEW_FORBIDDEN` for every role except `client_admin` and
`schulltech_admin`.

### Impact — document routing is unreachable for the roles that do it

`staff` holds `workflow:route:own` and `supervisor` holds `workflow:route:department`.
Neither can list the definitions they are supposed to route into.

Our shared `useRouteToWorkflow` hook (`src/hooks/useRouteToWorkflow.tsx`, used by
`/upload`, `/staff/cabinets` and `/doc/[id]`) calls `GET /workflows` and filters to
`status === 'published'` to build its picker. On a `403` the query returns no data, the
filtered list is empty, and the modal renders its empty state:

> *"No published workflows. A workflow has to be published in the Workflow Designer before
> anything can be routed to it."*

**That message is wrong and misleading.** A staff officer is told their organisation has no
workflows, when in fact they are simply not permitted to see them. We would rather show a
permission error, but we cannot distinguish the two cases from an empty list — which is
itself an argument for BE-10 (a JSON 404/error shape we can branch on).

This is the same outcome as the routing bug you fixed last week, from a different cause.

### It also contradicts the seeded permission model

`seed-system.ts` grants `workflow:view` at `global` scope to **`management`** and
**`internal_auditor`**. Both are refused by this constant. The RBAC table and the hardcoded
role list disagree, and the hardcoded list wins.

### What we are asking for

Give read its own membership rather than aliasing manage:

```ts
export const WORKFLOW_DEFINITION_MANAGE_ROLES = ['client_admin', 'schulltech_admin'] as const;

// Everyone who holds workflow:view or workflow:route needs to read definitions.
// Routing a document requires listing published definitions to choose one.
export const WORKFLOW_DEFINITION_VIEW_ROLES = [
    'staff',
    'supervisor',
    'management',
    'internal_auditor',
    'client_admin',
    'schulltech_admin',
] as const;
```

Ideally derive this from the seeded `workflow:view` / `workflow:route` grants rather than
maintaining a parallel list by hand — the drift above is exactly what a second source of
truth produces. If you would rather restrict `list` to published definitions for
non-managing roles, that works for us: the picker only ever shows `published`.

### How to verify

```bash
# Sign in as the seeded staff account, then:
curl -s -H "Authorization: Bearer $STAFF_TOKEN" \
  http://localhost:3001/api/v1/workflows | jq .
# Today: 403 WORKFLOW_DEFINITION_VIEW_FORBIDDEN
# Wanted: 200 with the published definitions
```

---

## ✅ BE-3 · Authorization on the workflow routes — **DONE, thank you**

This was the critical item on the list for a week. All five workflow services now assert
roles and return a named `403`:

| Service | Asserts |
|---|---|
| `definitions.service.ts` | `assertCanView` on list/getById, `assertCanManage` on create/update/publish/archive |
| `instances.service.ts` | list, bottlenecks-ageing, team-status-matrix |
| `tasks.service.ts` | list, approval queue, workload, stats |
| `delegations.service.ts` | list, create, end |
| `sla.service.ts` | breach list |

We had asked for `requirePermission` on the routes and you enforced it in the services
instead. That closes the hole, so we are not asking you to redo it — but two notes:

1. **A route-level grep still shows zero `requirePermission` in `workflows.router.ts`**,
   which reads as unfixed to anyone auditing quickly. The other eight routers use
   `requirePermission`, so the workflow module is now the exception. A comment at the top
   of `workflows.router.ts` pointing at the service-layer checks would save the next
   reviewer from re-filing this.
2. **Service-layer checks use role names, not the seeded permissions.** That is what
   produced BE-12 above: the permission grants and the role constants can now disagree
   silently. Worth considering whether `requirePermission` should still guard the routes
   with the service checks as defence in depth.


## 🔴 BE-4 · Enforce confidentiality for download, print and export

### What we found

`CONFIDENTIALITY_ACCESS` in `access-control.constants.ts` is a well-built per-tier,
per-action allowlist covering `view`, `export`, `print` and `download`, with `restricted`
and `top_secret` denied for everything but view.

**All 12 call sites use `requireConfidentiality('view')`.** The other three actions are
never checked. No `document:download|export|print` permissions are seeded, and no download
route exists (see BE-5).

We also found and fixed a **frontend** bug in the same area: our policy lookup used a shape
nothing produces, so client-side download/print gating silently never applied. Fixed in
`e3e3398`. That was defence in depth on a control that isn't enforced server-side at all —
so please treat the server-side gap as the real one.

### What we need

Once BE-5 exists, gate it with `requireConfidentiality('download')`, and gate any
export/print route similarly. The policy table is already written; it just isn't consulted.

### Related: tier assignment is unchecked

Nothing verifies that the user setting a confidentiality tier is cleared for it. A `staff`
user can upload at `top_secret` — and since `TOP_SECRET_TIER_ROLES` is empty by design,
that document becomes permanently unreadable **by everyone, including `client_admin`**,
with no recovery path. Please reject tiers the writer isn't cleared for.

---

## 🟠 BE-5 · `GET /documents/:id/download`

There is no route that serves file bytes or returns a signed URL for a download.
`getSignedDownloadUrl()` exists in `shared/utils/storage.ts` and is used only to hydrate
`fileUrl` on version responses.

```
GET /api/v1/documents/:id/download   →  { url, expiresAt }   (or a 302)
```

Should be gated by `requireConfidentiality('download')` (BE-4) and write a
`document.downloaded` audit entry (BE-11) — download is the single most audit-sensitive
action in the product.

---

## 🟠 BE-9 · `policies` module

`src/modules/policies/` is an empty directory. Our `policies.service.ts` returns fixtures.

We need confidentiality tiers (watermark/download/print per tier), urgency levels, retention
rules and SoD controls to be real and editable from `/admin/policies`. Today an admin can
"save" a policy change and nothing persists.

`RetentionPolicy` exists in the schema with `retentionDays` and
`actionOnExpiry: archive | delete | flag_for_review`, and cabinets can reference one — but
there's no endpoint and no job that ever applies it. Nothing expires.

**Shape request:** please return something stable and keyed, e.g.

```json
{
  "confidentiality": [
    { "level": "restricted", "download": false, "print": false, "watermark": true }
  ]
}
```

with **snake_case tier names matching `CONFIDENTIALITY_TIERS`**. Our fixtures use display
casing ("Top Secret") and we currently normalise on read; we'd rather not.

---

## 🟡 BE-10 · JSON 404 handler

`app.ts` mounts `errorHandler` (a four-argument error middleware, skipped on the happy
path) and nothing else, so an unmatched route returns Express's **default HTML** body. Our
axios client then fails parsing HTML as JSON, and a missing endpoint surfaces as a confusing
parse error rather than a clean 404.

Every broken call in this document was harder to find because of this. A five-line
catch-all returning the standard `ApiResponse` envelope would have made them obvious:

```ts
app.use((_req, res) => ApiResponse.notFound(res, 'Route not found', 'ROUTE_NOT_FOUND'));
// must sit after the routers, before errorHandler
```

---

## ✅ BE-11 · `audit` module — **DONE, thank you (confirmed 2026-09-18)**

Built, and more than we asked for: `GET /audit` (filters: `actorId`, `objectType`,
`objectId`, `action`, `from`, `to`), `GET /audit/:id`, `GET /audit/export` (CSV,
`audit:export`) and `GET /audit/verify` (hash-chain check) all exist and work — confirmed
live, not just against the swagger doc. A real pull returned entries auto-written for
`user.login`, `user.invited` and `user.token_refreshed`; `GET /audit/verify` recomputed
the chain and reported it intact.

One documentation-only note: the swagger spec lists these four paths with a literal
`/api/v1` baked into the path string (`/api/v1/audit`) while every other tag is relative
(`/documents`, `/cabinets`, …) under the `/api/v1` server URL — harmless once you know to
call the relative `/audit`, but worth fixing in the OpenAPI annotation so it doesn't trip
up the next integration.

Frontend wired `/admin/audit` to it the same day, and `/auditor/trail` and
`management/compliance` followed shortly after (`useAuditEntries` etc. in
`useAudit.ts`) — all three now read the real trail with a confirmed real action
vocabulary (`user.login`, `document.viewed`, `role.permissions_updated`, 17 others seen
in one sample). `/platform/audit` is the one page that stays mocked, and that's on us to
flag rather than fix: there's no cross-tenant `GET /audit`, and no platform-level
multi-tenant API in this backend at all, so there's nothing to migrate that page *to*.
Not asking for it here — just noting it so it doesn't read as an oversight.

---

## ✅ BE-13 · Self-service password recovery — **DONE, thank you (confirmed 2026-09-18)**

*Renumbered from BE-12 (2026-09-18) — this doc previously had two unrelated items both
numbered BE-12; see the note at the top of the Summary table.*

Built, and it doubles as the invitation-acceptance flow too — nice design, one endpoint
covers both cases. `POST /auth/forgot-password` (`{email}`, always 200) and
`POST /auth/reset-password` (`{token, password}`) both exist and work.

**One thing worth flagging: the shipped body shape differs from what we originally
asked for**, and it bit us. We'd requested
`{ token, newPassword, confirmPassword }` (below, for the record); the backend
reasonably shipped a single `{ token, password }` instead — simpler, and confirm-match
is a client-side concern anyway. But our frontend was never updated to match, and kept
sending the old three-field shape, so `/set-password` **completely failed for everyone**
(`422 VALIDATION_ERROR` — `password` "expected string, received undefined") until we
caught it 2026-09-18 wiring an unrelated feature (invite-resend) that shares this same
landing page. Fixed on our side (`auth.service.ts#resetPassword`, `set-password/page.tsx`)
— no backend action needed, just flagging the shape mismatch in case any other client
integration assumed the originally-requested shape. See DRIFT-15 in doc 01.

Original ask, for reference:

```
POST /api/v1/auth/forgot-password
  body: { email: string }

POST /api/v1/auth/reset-password
  body: { token: string, newPassword: string, confirmPassword: string }   ← not what shipped; shipped as { token, password }
```

---

## 🟡 BE-14 · Confidentiality-tier clearance for custom roles — **in progress, per conversation 2026-09-18**

**What we found:** `RESTRICTED_TIER_ROLES`/`CONFIDENTIAL_TIER_ROLES` are hardcoded role-*name*
allowlists (`confidential` → `supervisor`/`management`/`client_admin`/`internal_auditor`;
`restricted` → `client_admin` only), not permission-driven. A custom role created via
`POST /roles` can hold every `document:*` permission there is and still never pass the
confidentiality-tier gate on a `confidential`+ document — there's no mechanism, UI or
API, to grant a new role into those tiers. The only existing workaround is a per-document
`DocumentAccessGrant` via the access-request flow (BE-1), which is real but doesn't scale
to "this whole role should see this whole tier."

**Status:** you've said you're adding a way to set a confidentiality-clearance option on
a role, with system/seeded roles' clearance staying fixed (not admin-editable). No
endpoint for this exists yet as of 2026-09-18 — nothing to verify or wire up on our side
until it ships. Flagging here so it's tracked rather than lost in chat.

---

## 🟡 BE-15 · Revoke a granted `DocumentAccessGrant` — **in progress, per conversation 2026-09-18**

**What we found:** `POST /documents/:id/access-requests/:id/grant` creates a standing,
view-only access grant (BE-1), but there's no endpoint to revoke one afterward. Once
granted, always granted, with no admin-facing way to undo it short of a database change.

**Status:** you've said a revoke endpoint is being built. No shape confirmed yet
(`DELETE /documents/:id/access-requests/:id`? A dedicated revoke action?) — will wire it
into `/admin/access-requests` once it ships and the shape is known.

---

## 🟠 BE-16 · Optional `signature` on the `review` task action — **new, 2026-09-18**

### What we found

`POST /tasks/:id/action`'s request schema (confirmed against the live OpenAPI spec) is a
three-way `oneOf`:

```json
{
  "title": "Approve task",
  "required": ["action", "signature"],
  "additionalProperties": false,
  "properties": { "action": { "enum": ["approve"] }, "signature": { "...required..." }, "comment": {}, "note": {} }
},
{
  "title": "Review, reject, request changes, or close",
  "required": ["action"],
  "additionalProperties": false,
  "properties": { "action": { "enum": ["reject", "review", "request_changes", "close"] }, "comment": {}, "note": {} }
},
```

`additionalProperties: false` on the second variant means a `signature` field sent
alongside `{action: "review", ...}` would fail validation outright, not just be ignored.
Signing is `approve`-only.

### Why we're asking

We just built "Mark reviewed" as a modal with an optional comment field, matching how
`approve` already works — the plan was to let a reviewer optionally sign off too, not
just approve. We can't, today. A reviewer who wants their sign-off recorded has to use
`approve` instead of `review`, which isn't right where a stage is genuinely review-only
(no approval authority) — or has no way to sign at all.

### What we need

Extend the `oneOf`'s "review" branch (or split `review` into its own variant) to accept
the same optional `signature` object `approve` does, still not required:

```json
{
  "action": "review",
  "signature": { "fileUrl": "...", "mimeType": "image/png" },  // optional
  "comment": "..."                                              // optional, unchanged
}
```

`TaskActionSignature`'s validation (URL format, MIME allowlist, extension-matches-MIME)
can be reused as-is — we're not asking for new validation, just for the existing
`signature` shape to be legal on one more action.

### Until then

"Mark reviewed" ships comment-only. Not blocking — it's a nice-to-have, not a broken
flow — but flagging so it's tracked rather than re-discovered later.

---

## 🟡 BE-17 · Support more than one document per workflow instance — **new, 2026-09-18**

### What we found

`WorkflowInstance.documentId` is a single `uuid`, and `document` is a single nested
object — confirmed against the live OpenAPI spec, no array, no join table, no
`documentIds`. One instance is permanently tied to exactly one document.

### Why we're asking

Walking through the "Request changes" flow with the product owner: when a reviewer
requests changes, there are two different things that can be wrong —

1. **The existing document is wrong** (bad data, needs correcting) — already covered:
   the recipient uploads a new version of the same document (see the version-upload
   gating change landed alongside this request).
2. **Something is missing** — the reviewer needs an additional document (a supporting
   invoice, a signed cover sheet, whatever) that was never part of the original
   submission. Today there is no way to add a second document to an in-flight workflow;
   the only options are starting an entirely separate workflow (loses the connection to
   the original) or squeezing an unrelated file into a version slot on the existing
   document (loses the file's own identity, title, and type).

The ask is for a way to attach one or more additional documents to an *existing*
workflow instance — sharing that instance and landing in the same cabinet/folder as the
original — rather than only ever replacing the original document's content.

### What we need

Not fully specified yet — we don't want to hand you a shape sight-unseen for something
this structural. Roughly, we think it looks like either:

- `WorkflowInstance` gaining a `documentIds: uuid[]` (or a join table,
  `workflow_instance_documents`), with the existing `documentId`/`document` kept as the
  "primary" document for backward compatibility, or
- A new `POST /workflow-instances/:id/documents` endpoint that uploads/attaches an
  additional document to a running instance, visible alongside the primary one on
  `GET /workflow-instances/:id`.

Happy to workshop the exact contract before either side builds — flagging this now
mainly so it's tracked, not because we expect it imminently.

### Until then

Only single-document workflows are supported, same as today. The "Request changes"
recipient can upload a new version of the existing document; they cannot attach a
separate one to the same workflow.

---

## 🟠 BE-18 · Recovery sweep for OCR jobs stuck at `ocrStatus: 'pending'` — **new, 2026-09-21**

### What we found

While live-verifying whether OCR needed a presigned-upload fix (it didn't — the gateway
upload path already works end to end), we pulled every document via `GET /documents` as
`client_admin` against `edms-backend-zmfm.onrender.com`. 7 of 8 have
`ocrStatus: 'completed'` with real
extracted text. One — `INV-2026-1839_invoice.pdf`, uploaded 2026-09-18 — has sat at
`ocrStatus: 'pending'` for three days, never advancing to `processing`, `completed`, or
`failed`. Confirmed invisible to `GET /documents/search?q=invoice` (finds the other two
invoice-ish documents, not this one) while listed fine in the plain `GET /documents`.

`pending` rather than `failed` is the tell. `processOcrJob` in `ocr.workers.ts` sets
`ocrStatus: 'processing'` as its very first line, before Textract is ever called. A
document stuck at `pending` means that function never ran for this job at all — the
BullMQ job was never durably enqueued. The likeliest gap: the `DocumentVersion` row is
written (defaulting to `ocrStatus: 'pending'`) and the follow-up
`ocrQueue.add('ocr', {documentId, versionId}, ...)` is a separate call; if the process
dies or restarts between those two steps, the row says `pending` forever and BullMQ's
own `attempts: 3` retry config never applies — retries only fire for a job that made it
into the queue and was picked up at least once.

### Why it matters

A silently-stuck document is invisible to search forever (`searchIndexQueue.add()` only
runs on the OCR **success** path) with no signal to anyone that anything is wrong — we
only found this one document by pulling the raw list and diffing timestamps by hand.
At real scale this is a slow, undetectable leak of unsearchable documents.

### What we need

This exact failure mode is already solved elsewhere in this codebase, for a different
queue. `notifications/workers/email.workers.ts` has
`recoverPendingEmailNotifications()` / `startNotificationEmailRecovery()`: a
60-second sweep finding notifications stuck `pending` past a staleness window and
re-enqueuing them with a deterministic `jobId` (`recovery-${notificationId}`) so BullMQ
dedupes against a job that's legitimately still in flight. Its own comment names this
exact failure mode: *"a crash between the database write and the enqueue would
otherwise leave them pending forever."*

We'd like the same pattern applied to OCR:

```ts
// ocr.workers.ts — mirrors recoverPendingEmailNotifications / startNotificationEmailRecovery
const OCR_RECOVERY_INTERVAL_MS = 60_000;
const OCR_RECOVERY_STALE_MS = 2 * 60 * 1000; // your own MAX_POLL_ATTEMPTS ceiling is ~5 min

async function recoverPendingOcrJobs(): Promise<void> {
    const olderThan = new Date(Date.now() - OCR_RECOVERY_STALE_MS);
    const stale = await documentsRepository.findPendingOcrVersionIds(db, olderThan); // new — mirrors findPendingEmailNotificationIds

    for (const { id: versionId, documentId } of stale) {
        await ocrQueue.add(
            'ocr',
            { documentId, versionId },
            { jobId: `recovery-${versionId}`, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );
    }
}

export function startOcrRecovery(): ReturnType<typeof setInterval> {
    void recoverPendingOcrJobs().catch((error) => logger.error('Initial pending OCR recovery failed', { error }));
    const timer = setInterval(
        () => void recoverPendingOcrJobs().catch((error) => logger.error('Pending OCR recovery failed', { error })),
        OCR_RECOVERY_INTERVAL_MS,
    );
    timer.unref();
    return timer;
}
```

— and wire `startOcrRecovery()` into `worker.ts`'s `main()` alongside `emailRecovery`,
the same way that one already is.

Three smaller, optional pieces while you're in this area:

- Decouple search indexing from OCR success — `searchIndexQueue.add()` currently only
  runs on the OCR **success** path, so a document whose OCR job is `failed` (or, per
  this ask, recovering from `pending`) is unfindable by search on *anything*, not just
  its extracted text — not even its own title. Enqueueing the index job on
  create/update/restore regardless of OCR outcome would mean a document is always at
  least title/metadata-searchable, with OCR text as a bonus once/if it lands.
- An admin-facing "retry OCR" action for a single document/version would let someone
  unstick one immediately rather than waiting for the next sweep — useful
  independently of the sweep itself.
- If it's the worker process staying up (rather than just the write/enqueue gap) that's
  the actual cause, worth checking it's running continuously — we'd guess Render's
  free-tier idling/restart behaviour, but have no visibility into your infra to confirm
  it from here.

### How to verify

```bash
curl -s -H "Authorization: Bearer $CLIENT_ADMIN_TOKEN" \
  https://edms-backend-zmfm.onrender.com/api/v1/documents?limit=100 | \
  jq '.data[] | select(.currentVersion.ocrStatus == "pending") | {title, createdAt: .currentVersion.createdAt}'
# Today: INV-2026-1839_invoice.pdf, stuck since 2026-09-18.
# After the sweep ships: that document (or any future one that hits the same gap)
# should self-heal within OCR_RECOVERY_INTERVAL_MS plus one Textract turnaround, with
# no manual intervention.
```

---

## Appendix B — backend routes we now consume

Previously built and unused; wired in `e07d8c3`:

- `GET /notifications/unread-count` → bell badge (was a fixture count)
- `GET /notifications/preferences`, `PUT /notifications/preferences` → new panel
- `POST /notifications/read-all` → "Mark all read"

**Update 2026-09-21:** `GET /documents/stats` is adopted now, alongside
`GET /tasks/stats`, `GET /workflow-instances/stats` and
`GET /workflow-instances/open-items-by-cabinet` — all four management dashboards were
rewired off the browser-side aggregation this note used to describe. Thank you for
building the SLA-rate and task-rollup endpoints we asked for below; between them and
`documents/stats`, the client-side aggregation is gone.

## Appendix C — how to reproduce the route inventory

```bash
# in edms-backend, on dev @ e60c418

# total routes -> 90
find src -name '*.router.ts' -exec grep -hcE \
  "^\s*[a-zA-Z]*[Rr]outer\.(get|post|put|patch|delete)\(" {} + \
  | paste -sd+ | bc

# per-router routes vs requirePermission calls
for f in $(find src -name '*.router.ts' | sort); do
  printf "%-32s routes=%-3s requirePermission=%s\n" "$(basename $f)" \
    "$(grep -cE '^\s*[a-zA-Z]*[Rr]outer\.(get|post|put|patch|delete)\(' $f)" \
    "$(grep -c requirePermission $f)"
done
# -> workflows.router.ts shows routes=32 requirePermission=0.
#    That is EXPECTED as of 2026-09-04: the workflow module enforces in its
#    services, not on its routes. Confirm with:
grep -rn "_FORBIDDEN" src/modules/workflows --include=*.service.ts | wc -l

# seeded permissions -> 45
grep -cE "^\s+\{ resource: '[a-z_]+', action: '[a-z_]+' \}," prisma/seed-system.ts
```

---

_Questions on any of this — particularly BE-9's response shape — are welcome. We'd
rather agree the contract before either side builds._
