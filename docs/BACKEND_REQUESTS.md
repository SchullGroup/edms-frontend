# Backend Requests — from the Frontend Team

**Raised:** 2026-08-29 · **Updated:** 2026-09-04 (evening)
**Frontend:** `edms-frontend` @ `dev` (`aec7863`)
**Backend checked against:** `edms-backend` @ `dev` (`e60c418`) — **90 routes**

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
| ~~BE-6~~  | ~~`POST /documents/:id/comments`~~ — **withdrawn**: it's `comment` on `POST /tasks/:id/action` | — | — | No — frontend rewired |
| ~~BE-7~~  | ~~`POST /documents/:id/signatures`~~ — **withdrawn**: it's `signature` on the `approve` task action | — | — | No — frontend rewired |
| **BE-8**  | Presigned upload URL                              | New endpoint | 🟠 Med      | Yes — OCR/search broken    |
| **BE-9**  | `policies` module                                 | New module   | 🟠 Med      | No — frontend on fixtures  |
| **BE-10** | JSON 404 handler                                  | Small fix    | 🟡 Low      | No                         |
| ~~BE-11~~ | ~~`audit` module~~                                | ✅ **Done**  | —           | —                          |
| ~~BE-13~~ | ~~`forgot-password` / `reset-password`~~          | ✅ **Done**  | —           | —                          |
| **BE-14** | Confidentiality-tier clearance option on roles    | New field/endpoint | 🟠 Med | No — per-document grants work meanwhile |
| **BE-15** | Revoke a granted `DocumentAccessGrant`            | New endpoint | 🟠 Med      | No — grants just accumulate |

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
  call, so multi-page PDFs work. This was the second half of our BE-8 ask.
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

## ~~BE-6 · `POST /documents/:id/comments`~~ — WITHDRAWN (2026-09-10)

Comments are not a document operation. The live spec has no `comments` path anywhere; a
comment is the optional `comment` string on `POST /tasks/:id/action` (`minLength 1`,
`maxLength 2000`), persisted to the workflow activity trail, and read back via
`GET /workflow-instances/:id/history`. The frontend's free-text comment box on
`/doc/[id]` (which posted to the non-existent route) has been removed; the stage-action
modals now send their note as `comment`. No backend work required.

> **Update 2026-09-18 — you built it anyway, as a separate thing.** A dedicated
> `GET/POST /documents/:id/comments` now exists — confirmed live, real document-level
> comment thread, independent of any task. This isn't a contradiction of the withdrawal
> above: the task-action `comment` is still the only thing tied to the approval trail;
> this is a second, general-purpose thread. Wired on `/doc/[id]` as `DocumentCommentsPanel`.

---

## ~~BE-7 · `POST /documents/:id/signatures`~~ — WITHDRAWN (2026-09-10)

Also already defined in the live spec, and also not a document operation. `POST
/tasks/:id/action` with `action: "approve"` **requires**
`signature: { fileUrl: <uri>, mimeType: "image/png" | "image/jpeg" | "image/webp" }`
(422 without it; the backend validates the URL extension matches the MIME type).
`comment` is optional alongside it. The frontend now captures a drawn/uploaded signature
image (`SignaturePad`), uploads it via the multipart uploader, and sends it on the
approve action (`useSignAndApprove`, used by `/doc/[id]` and the supervisor approvals
queue). No backend work required.

> **Update 2026-09-18 — same story as BE-6.** `GET/POST /documents/:id/signatures` now
> exists — confirmed live. It's a flat `{signedBy, signer, url, createdAt}` record with
> **no positional/field-placement data**, unlike the task-action signature which the
> viewer places at a specific spot on the document image. Useful for a sign-off that
> isn't tied to any pending workflow task. Wired as `DocumentSignaturesPanel` on
> `/doc/[id]`, reusing the same `SignaturePad` capture UI.

---

## 🟠 BE-8 · Presigned upload URL — **half done**

> **Update 2026-09-04.** The OCR half of this ask has shipped: Textract now uses
> `StartDocumentTextDetectionCommand` (asynchronous, multi-page), reads from the
> configured `S3_BUCKET`, and archives extracted text via `saveOcrText()`. You also added
> `getSignedDownloadUrl()` — a presigned **GET**.
>
> **What is still missing is a presigned PUT**, so files can reach the bucket your worker
> reads from. Until then the bucket mismatch below is unchanged, and OCR still fails on
> every document. We accept that the remaining fix is mostly ours — we have to stop using
> the third-party gateway — but we cannot do it without an upload path.
>
> One request while you are here: **move `searchIndexQueue.add()` off the OCR success
> path.** A document that fails text extraction should still be findable by title,
> reference and metadata. Right now one failure costs the document all searchability.

### What we found

The browser uploads files to a **third-party AWS API Gateway hard-coded in our
`s3.service.ts`** (`qerhd0lxje.execute-api.us-east-1.amazonaws.com`), then POSTs the
resulting URL to `POST /documents` as `fileUrl`.

The backend derives `fileKey` from that URL's path and asks Textract to read
`s3://${S3_BUCKET}/${fileKey}` — **a different bucket**. Textract raises
`InvalidS3ObjectException`, OCR retries three times and lands on `ocrStatus: 'failed'`.

Because `searchIndexQueue.add()` sits on the OCR **success** path only, no index job is ever
enqueued, `search_vector` stays `NULL`, and **`GET /documents/search` returns nothing,
permanently** — while `GET /documents` lists the same documents fine. The two views
disagree, which reads as flaky search rather than a bucket mismatch.

We noticed `saveOcrText()` was added in `b72e0bf`. It's downstream of `extractText()`, so
it never runs either.

### What we need

```
POST /api/v1/documents/upload-url
Body: { filename, mimeType, fileSize }
  →   { uploadUrl, fileKey, expiresAt }
```

We PUT the raw bytes to `uploadUrl` (no base64 — our current gateway forces base64, which
inflates payloads ~33% and contributes to a 2 MB ceiling), then send `fileKey` to
`POST /documents` instead of `fileUrl`. Please also validate on your side that the
submitted key belongs to `S3_BUCKET`; today `fileUrl` is unvalidated client input.

**Two things worth fixing at the same time:**

- `DetectDocumentTextCommand` is Textract's _synchronous_ API — single-page only.
  Multi-page PDFs need `StartDocumentTextDetection`. Most real uploads here are multi-page.
- Enqueue the search-index job on document **create/update/restore** regardless of OCR
  outcome, so a failed OCR doesn't make a document unfindable by title. Title changes and
  metadata edits currently don't reindex either, so the index drifts.

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

## Appendix A — frontend calls that currently 404

Verified against `b72e0bf`:

| Frontend call                           | Status                              |
| --------------------------------------- | ----------------------------------- |
| `POST /documents/:id/comments`          | BE-6                                |
| `POST /documents/:id/signatures`        | BE-7                                |
| `POST /auth/logout` (via our BFF)       | BE-2                                |
| ~~`POST /notifications`~~               | **Removed on our side** — see BE-1  |
| ~~`POST /notifications/mark-all-read`~~ | **Fixed on our side** → `/read-all` |

## Appendix B — backend routes we now consume

Previously built and unused; wired in `e07d8c3`:

- `GET /notifications/unread-count` → bell badge (was a fixture count)
- `GET /notifications/preferences`, `PUT /notifications/preferences` → new panel
- `POST /notifications/read-all` → "Mark all read"

Still unused: **`GET /documents/stats`**. It returns `{buckets: [{key, departmentId,
departmentName, count}]}` grouped by department or month. Our management dashboards need
SLA rates and task rollups too, so we currently page through `/documents` and aggregate in
the browser (up to 50 requests per dashboard). If you're extending stats, those two
dimensions would let us delete that code.

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

_Questions on any of this — particularly BE-7's definition of a signature, and BE-9's
response shape — are welcome. We'd rather agree the contract before either side builds._
