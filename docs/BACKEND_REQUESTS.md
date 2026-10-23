# Backend Requests — from the Frontend Team

> **2026-10-08: the open asks are now one implementable spec,
> [`docs/specs/backend-api-spec-2026-10-08.md`](specs/backend-api-spec-2026-10-08.md)**, checked
> against `edms-backend` `dev` at `2db7e19`.

**Raised:** 2026-08-29 · **Updated:** 2026-10-22
**Frontend:** `edms-frontend` @ `dev`
**Backend checked against:** `edms-backend` @ `origin/dev` (`d14f250`)

> **2026-10-21: this file now lists open asks only.** Every item was re-checked against
> `d14f250`. Done and removed: BE-1 (access requests), BE-3 (workflow authorization), BE-5
> (download, shipped as `GET /documents/:id/versions/:versionId`), BE-11 (audit), BE-13
> (password recovery), BE-14 (tier clearance), BE-15 (revoke a grant, `550feda`) and BE-17
> (several documents per workflow). Their write-ups are in git history. BE-4 and BE-18 were
> partly done and keep only their open part. Withdrawn 2026-10-22: BE-9 (`policies` module,
> not being built) and BE-20 (upload allowlist; the frontend enforces it). Done 2026-10-23:
> BE-16 (signature on `review`), shipped in `ae08ef5` as **required**, not optional.

Each item states what the frontend does today, what it needs, and why.

**Take BE-19 first** — no parallel workflow can run without it. Then BE-2, BE-4 and BE-21,
which are security items rather than features.

---

## Summary

| ID        | Ask                                                         | Type            | Priority | Blocking?                                  |
| --------- | ----------------------------------------------------------- | --------------- | -------- | ------------------------------------------ |
| **BE-19** | 500 on the first action at a parallel fork (PR #54)         | Bug             | 🔴 High  | **Yes — no parallel workflow can run**     |
| **BE-2**  | `POST /auth/logout` + refresh-token revocation              | New endpoint    | 🔴 High  | No — fails silently today                  |
| **BE-4**  | Reject confidentiality tiers the uploader isn't cleared for | Security fix    | 🔴 High  | No                                         |
| **BE-21** | Check cabinet grants when a document is read                | Security fix    | 🔴 High  | No — documents are over-shared today       |
| **BE-18** | Recovery sweep for OCR jobs stuck at `ocrStatus: 'pending'` | Reliability fix | 🟠 Med   | No — 1 of 8 documents affected when raised |
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

**Re-tested 2026-10-22 on `origin/dev` `2f42695`: still a 500.** The only workflow change since
the report is notification wiring (`c316ddb`, PR #57), which doesn't touch the fork path. A
sequential control run the same minute (intake → finance → legal, same user and document) returned
200 and opened the next task.

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
`f83de22c-89ab-4873-a80f-880f1776cf2f`. The 2026-10-22 run (action at about 08:26 UTC): workflow
`6312badb-ae27-4eae-8c3e-f279303de560`, instance `e0e52b86-b908-45d5-91d8-12f10cbdd6c5`, task
`dcab51d1-7c26-4f30-a744-bf24799917e8`; both archived/closed afterwards. The response carries no
request id.

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

## 🔴 BE-21 · Check cabinet grants when a document is read — **new, 2026-10-22**

Checked at `origin/dev` `cc56f40`. Tracker 5.4; doc 05 backlog #12.

Cabinet grants (`CabinetAccess`) are checked on every document **write** (`PATCH`, `DELETE`,
new version, restore, check-out/in, `PUT /metadata`) and on cabinet, folder and workflow reads.
They are never checked when a document is **read**:

- `GET /documents/:id` and its `/export`, `/print`, `/versions`, `/versions/:versionId`,
  `/summary` (GET and POST), `/metadata`, `/comments` and `/signatures` check the role permission
  and `requireConfidentiality` only (`documents.router.ts`).
- `GET /documents`, `/documents/search` and `/documents/stats` filter by RBAC scope and tier
  clearance (`buildAccessScopeWhere`, `buildScopeSqlFilter` in `documents.repository.ts`).
  Nothing in the documents module queries `cabinetAccess`.

`GET /cabinets` already applies both, entitlement **and** scope (`buildCabinetWhere`,
`cabinets.repository.ts`), so the two disagree. A user whose role holds `document:view` at
`global` scope, with no grant on another department's cabinet, doesn't see that cabinet in
`GET /cabinets` and gets 403 from `GET /cabinets/:id`, but can list, search and open every
document in it.

**Ask:** give every document read the same entitlement `requireCabinetAccess('view')` uses:
`CABINET_ACCESS_BYPASS_ROLES` skip it; an org-wide cabinet or the user's own department's cabinet
is implicitly viewable; anything else needs a `view`-or-higher grant, direct or through a role.

- **Single-document routes:** mount `requireCabinetAccess('view')` after `requireConfidentiality`
  and return `403 FORBIDDEN`. The frontend already shows "You don't have access" with
  **Request access** on any 403 from `GET /documents/:id`, so it needs no change.
- **List, search, stats:** add the same entitlement as a row filter, so counts and results only
  include documents the caller can open.
- **An approved access request overrides it** (product decision, 2026-10-22). A
  `DocumentAccessGrant` with `permission: 'view'` lets that user open that one document without
  cabinet view, just as it already overrides tier and scope. Without this, **Request access**
  can't help with a document that's blocked by its cabinet.
- Workflow reads (`tasks.service.ts`, `instances.service.ts`, `history.service.ts`) already
  filter by viewable cabinet. They need no change.

**To check:** take a user whose role has `document:view:global`, outside the department of a
department-mapped cabinet, with no grant on it. Today `GET /cabinets/:id` returns 403 while
`GET /documents/:id` for a document in that cabinet returns 200. After the fix both return 403.
Once an access request for that document is approved, `GET /documents/:id` returns 200.

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

_Questions on any of this are welcome. We'd rather agree the contract before either side
builds._
