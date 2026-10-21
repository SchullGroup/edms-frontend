# Backend Requests — from the Frontend Team

> **2026-10-08: the open asks are now one implementable spec,
> [`docs/specs/backend-api-spec-2026-10-08.md`](specs/backend-api-spec-2026-10-08.md)**, checked
> against `edms-backend` `dev` at `2db7e19`.

**Raised:** 2026-08-29 · **Updated:** 2026-10-21
**Frontend:** `edms-frontend` @ `dev`
**Backend checked against:** `edms-backend` @ `origin/dev` (`d14f250`)

> **2026-10-21: this file now lists open asks only.** Every item was re-checked against
> `d14f250`. Done and removed: BE-1 (access requests), BE-3 (workflow authorization), BE-5
> (download, shipped as `GET /documents/:id/versions/:versionId`), BE-11 (audit), BE-13
> (password recovery), BE-14 (tier clearance), BE-15 (revoke a grant, `550feda`) and BE-17
> (several documents per workflow). Their write-ups are in git history. BE-4 and BE-18 were
> partly done and keep only their open part. The upload-allowlist ask, briefly numbered
> BE-19 alongside the fork bug, is BE-20.

Each item states what the frontend does today, what it needs, and why.

**Take BE-19 first** — no parallel workflow can run without it. Then BE-2 and BE-4, which
are security items rather than features.

---

## Summary

| ID        | Ask                                                         | Type            | Priority | Blocking?                                  |
| --------- | ----------------------------------------------------------- | --------------- | -------- | ------------------------------------------ |
| **BE-19** | 500 on the first action at a parallel fork (PR #54)         | Bug             | 🔴 High  | **Yes — no parallel workflow can run**     |
| **BE-2**  | `POST /auth/logout` + refresh-token revocation              | New endpoint    | 🔴 High  | No — fails silently today                  |
| **BE-4**  | Reject confidentiality tiers the uploader isn't cleared for | Security fix    | 🔴 High  | No                                         |
| **BE-18** | Recovery sweep for OCR jobs stuck at `ocrStatus: 'pending'` | Reliability fix | 🟠 Med   | No — 1 of 8 documents affected when raised |
| **BE-20** | Enforce the PDF-and-images upload allowlist                 | Validation      | 🟠 Med   | No — the frontend enforces it              |
| **BE-9**  | `policies` module                                           | New module      | 🟠 Med   | No — frontend on fixtures                  |
| **BE-16** | Optional `signature` on the `review` task action            | Schema change   | 🟠 Med   | No — "Mark reviewed" is comment-only       |
| **BE-12** | Seed `workflow:view` for the roles that route documents     | Seed fix        | 🟡 Low   | Only on a freshly seeded tenant            |
| **BE-10** | JSON 404 handler                                            | Small fix       | 🟡 Low   | No                                         |

---

## 🔴 BE-19 · `POST /tasks/:id/action` returns 500 at a parallel fork

**Raised:** 2026-10-20 · **Backend:** live API (`edms-backend-zmfm.onrender.com`); code read at
`origin/dev` `6700804`

### What we found

The first action at a stage with two or more unconditional transitions (a parallel fork, PR #54)
fails every time:

```
POST /api/v1/tasks/f83de22c-89ab-4873-a80f-880f1776cf2f/action
{"action":"review","comment":"parallel repro 2026-10-20"}

500 {"success":false,"message":"An unexpected error occurred","code":"INTERNAL_SERVER_ERROR"}
```

The task stays `pending` at the fork stage and no branch task is created. Sequential workflows on
the same backend work. First seen 2026-10-18 (TEST_PLAN TP-Q19), and reproduced over the API on
2026-10-20 with the smallest possible fork: no join, one document, `review` only.

### How to reproduce

1. As `client_admin`, `POST /workflows` with this definition, then `POST /workflows/:id/publish`.
   It saves and publishes cleanly:
   ```json
   {
     "stages": [
       { "id": "intake",  "name": "Intake",         "user_id": "<staff_finance id>", "sla_hours": 48, "actions": ["review"] },
       { "id": "finance", "name": "Finance review", "user_id": "<staff_finance id>", "sla_hours": 48, "actions": ["review"] },
       { "id": "legal",   "name": "Legal review",   "user_id": "<staff_finance id>", "sla_hours": 48, "actions": ["review"] }
     ],
     "transitions": [{ "from": "intake", "to": "finance" }, { "from": "intake", "to": "legal" }]
   }
   ```
2. As `staff_finance`, `POST /workflow-instances` with one document they own, then
   `POST /workflow-instances/:id/start` (both succeed; one task opens at `intake`).
3. As `staff_finance`, `POST /tasks/:taskId/action` with `{"action":"review"}`: **500**.

The 2026-10-20 run's IDs, for the server logs: workflow `d607c88e-85f9-4043-9c03-74c336341ff6`
(archived afterwards), instance `c86d381f-a2b9-4c55-bcfe-0404e86d250a` (closed afterwards), task
`f83de22c-89ab-4873-a80f-880f1776cf2f`. The response carries no request id.

### Where to look

The fork branch of the task action in `src/modules/workflows/tasks/tasks.service.ts` (the
`sourceOccurrences` loop that calls `instancesRepository.forkDocumentExecution`, then
`routeDestinationGroups`). We couldn't find the cause from the code alone. A 500 means an
uncaught error rather than an `AppError`, so the stack trace for the request above should name
it.

### What we need

The fork action to succeed: one task per branch, each document execution split into children
(`parentExecutionId` set), as PR #54 describes. The designer already builds and saves forks and
joins (live since 2026-10-17), so the frontend is waiting only on this.

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

## 🔴 BE-4 · Reject confidentiality tiers the uploader isn't cleared for

> The rest of BE-4 is done: export, print and download each check `requireConfidentiality`
> (`0dab81a`, 2026-10-08).

Nothing checks that the user setting a document's confidentiality tier is cleared for it
(`POST /documents` checks `document:create` and cabinet upload access, not the tier, at
`d14f250`). A `staff` user can upload at `top_secret` and immediately lose access to their own
upload. No seeded role holds `document:view_top_secret`, so nobody can read it until an admin
grants that clearance to some role in `/admin/roles`.

**Ask:** reject a `confidentiality` on create, edit or new version that the caller isn't
cleared to view, with a `403`.

---

## 🟡 BE-12 · Seed `workflow:view` for the roles that route documents

> Was "Split `WORKFLOW_DEFINITION_VIEW_ROLES` from `MANAGE_ROLES`". That constant was removed
> 2026-09-16 and the gap moved to the RBAC seed (DRIFT-14 in doc 01).

`prisma/seed-system.ts` grants `workflow:view` only to `client_admin` and `schulltech_admin`
(checked at `d14f250`). The live tenant's non-admin roles hold `workflow:view:global` and get
200 from `GET /workflows` (re-tested 2026-10-16), so nothing is blocked today. On a freshly
seeded tenant, though, `staff`, `supervisor`, `management` and `internal_auditor` can't list
workflow definitions, so they can't route a document.

**Ask:** add `workflow:view` rows for those four roles to the seed, at `global` scope as the
live tenant has them.

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

A silently-stuck document never gets its text extracted, summarised or searched, with no
signal to anyone that anything is wrong — we only found this one document by pulling the
raw list and diffing timestamps by hand. *(Since PR #51 it is at least indexed by title and
metadata at create, so it's findable that way — the part of this ask that shipped.)*

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

Two smaller, optional pieces while you're in this area:

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

## 🟠 BE-20 · Enforce the PDF-and-images upload allowlist — **new, 2026-10-21**

PM decision 2026-10-21: documents are **PDF and images only**, because every upload goes
through OCR. The frontend now accepts exactly what Textract's async API
(`StartDocumentTextDetection`, `ocr.workers.ts`) reads:

| MIME | Max size | Why |
|---|---|---|
| `application/pdf` | 100 MB | Textract async allows 500 MB / 3,000 pages; 100 MB is ours |
| `image/tiff` | 100 MB | Same as PDF, multi-page included |
| `image/jpeg`, `image/png` | 10 MB | Textract async caps JPEG/PNG at 10 MB |

`documents.validation.ts` accepts any non-empty `mimeType`, so a direct API call can still
file a DOCX that then fails OCR. **Ask:** reject other types (and over-size images) with a
`422` on `POST /documents` and on new versions, using the table above. Applies to circular
attachments too if they are OCR'd. Documents already stored as DOCX/XLSX stay as they are.

---

## 🟠 BE-9 · `policies` module

`src/modules/policies/` is an empty directory. Our `policies.service.ts` returns fixtures.

We need confidentiality tiers (watermark/download/print per tier), urgency levels and
retention rules to be real and editable from `/admin/policies`. *(SoD controls were in this
list; SoD and redaction were dropped from scope 2026-10-21 by PM decision.)* Today an admin can
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

## Appendix — how to reproduce the route inventory

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
