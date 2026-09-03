# Backend Requests — from the Frontend Team

**Raised:** 2026-08-29
**Frontend:** `edms-frontend` @ `dev` (`e3e3398`)
**Backend checked against:** `edms-backend` @ `dev` (`b72e0bf`) — 83 routes

Everything below was verified against the code on both sides on the date above, not
assumed. Each item states what the frontend does today, what it needs, and why.

**Please read BE-1 and BE-4 before the others** — they are security items, not features.

---

## Summary

| ID        | Ask                                               | Type         | Priority    | Blocking?                  |
| --------- | ------------------------------------------------- | ------------ | ----------- | -------------------------- |
| **BE-1**  | `POST /documents/:id/access-request`              | New endpoint | 🔴 High     | Yes — feature disabled     |
| **BE-2**  | `POST /auth/logout` + refresh-token revocation    | New endpoint | 🔴 High     | No — fails silently today  |
| **BE-3**  | `requirePermission` on the 25 workflow routes     | Security fix | 🔴 Critical | No — but wide open         |
| **BE-4**  | Enforce confidentiality for download/print/export | Security fix | 🔴 High     | No                         |
| **BE-5**  | `GET /documents/:id/download`                     | New endpoint | 🟠 Med      | Yes — no way to get a file |
| **BE-6**  | `POST /documents/:id/comments`                    | New endpoint | 🟠 Med      | Yes — UI built, 404s       |
| **BE-7**  | `POST /documents/:id/signatures`                  | New endpoint | 🟠 Med      | Yes — UI built, 404s       |
| **BE-8**  | Presigned upload URL                              | New endpoint | 🟠 Med      | Yes — OCR/search broken    |
| **BE-9**  | `policies` module                                 | New module   | 🟠 Med      | No — frontend on fixtures  |
| **BE-10** | JSON 404 handler                                  | Small fix    | 🟡 Low      | No                         |
| **BE-11** | `audit` module                                    | New module   | 🟡 Low      | No — but nothing is logged |

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

One naming note: we were calling `/notifications/mark-all-read`; the route is
`/notifications/read-all`. **We changed our side** — `read-all` is the better name and
pairs with `unread-count`. No action needed.

---

## 🔴 BE-1 · `POST /documents/:id/access-request`

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

## 🔴 BE-3 · Authorization on the workflow routes

**This is the most serious item in this document.**

### What we found

`workflows.router.ts` has **25 routes and zero `requirePermission` calls**. We re-verified
on `b72e0bf`:

```
GET|POST   /workflows
GET|PATCH  /workflows/:workflowId
POST       /workflows/:workflowId/publish
POST       /workflows/:workflowId/archive
GET|POST   /workflow-instances
GET        /workflow-instances/stats
GET        /workflow-instances/:instanceId
POST       /workflow-instances/:instanceId/{start,hold,resume,close}
GET        /tasks · /tasks/stats · /tasks/:taskId
POST       /tasks/:taskId/action
PATCH      /tasks/:taskId/reassign
GET|POST   /delegations · GET /delegations/:id · POST /delegations/:id/end
GET        /workflow-history · /workflow-history/:historyId
```

Tasks, delegations and history do check roles inside their services
(`TASK_VIEW_ALL_ROLES`, `TASK_REASSIGN_ROLES`, `DELEGATION_*`). **Definitions and instances
do not** — neither `definitions.service.ts` nor `instances.service.ts` reads `actor.roles`
at all.

### Impact

Any authenticated user — including a brand-new `staff` account — can create, edit, publish
and archive workflow definitions, and start, hold, resume or close any workflow instance in
the tenant.

The `workflow:view|create|edit|publish|archive|route` permissions **are already seeded** in
`seed-system.ts` and are never consulted.

Our `/admin/workflows` designer is gated to `client_admin`, but that is a client-side route
guard — anyone can call the API directly.

### What we need

`requirePermission('workflow', <action>)` on all 25 routes, plus role checks in the
definitions and instances services. The permissions already exist, so this should be
mechanical.

Also: **`GET /documents/stats` has no authorization either** and returns tenant-wide
document counts grouped by department.

---

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

## 🟠 BE-6 · `POST /documents/:id/comments`

The document detail page has a comments UI wired to `POST /documents/:id/comments`. No such
route exists; it 404s.

Needs a `DocumentComment` model (no comment model exists in the schema today) and probably:

```
GET  /api/v1/documents/:id/comments      (paginated)
POST /api/v1/documents/:id/comments      { body: string }
```

Author from the session, not the body. Worth deciding whether comments are visible to
everyone who can view the document, or scoped further.

---

## 🟠 BE-7 · `POST /documents/:id/signatures`

Same situation: UI is built, `POST /documents/:id/signatures` 404s, no signature model
exists.

Before building, we'd like to agree what a signature _is_ here — an acknowledgement
(name + timestamp + hash of the version signed), or a cryptographic signature? The
approach differs a lot, and the PRD isn't specific. Happy to spec it together.

---

## 🟠 BE-8 · Presigned upload URL

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

## 🟡 BE-11 · `audit` module

`src/middlewares/audit.middleware.ts` is a **0-byte file**. There are zero references to
`auditEntry` anywhere in `src/`. The `audit_entries` table has never been written to.

The schema is well designed — hash-chained via `prevHash`/`entryHash`, documented as
INSERT-only, indexed for object history and actor timeline, intended to be
month-partitioned. `AUDIT_ACTIONS` lists 25 action types. None are ever emitted.

Meanwhile `internal_auditor` is granted `audit:view:global` and **there is no `/audit`
endpoint to use it**, and our auditor dashboard renders fixtures.

We're flagging this as Low priority only because nothing is _blocked_ on it. In terms of
product risk it is arguably the most significant gap: the compliance story rests on it.

What we'd eventually need:

```
GET /api/v1/audit          filters: actor, objectType, objectId, action, from, to
GET /api/v1/audit/verify   chain-integrity proof
```

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
# in edms-backend
find src/modules -name '*.router.ts' -exec grep -hoE \
  "(\w*[Rr]outer|router)\.(get|post|patch|put|delete)\(" {} + | wc -l   # -> 83

# routes with no authorization middleware  -> 32
```

---

_Questions on any of this — particularly BE-7's definition of a signature, and BE-9's
response shape — are welcome. We'd rather agree the contract before either side builds._
