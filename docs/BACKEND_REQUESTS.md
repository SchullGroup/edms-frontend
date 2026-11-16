# Backend Requests — from the Frontend Team

> **2026-10-08: the open asks are now one implementable spec,
> [`docs/specs/backend-api-spec-2026-10-08.md`](specs/backend-api-spec-2026-10-08.md)**, checked
> against `edms-backend` `dev` at `2db7e19`.

**Raised:** 2026-08-29 · **Updated:** 2026-11-16 (BE-24, BE-26 and BE-27 done; BE-29, BE-30 and two questions added)
**Frontend:** `edms-frontend` @ `dev`
**Backend checked against:** `edms-backend` @ `origin/dev` (`e033b58`, re-checked 2026-11-16)

> **2026-11-16: BE-24 and BE-26 done and removed.** Both shipped in PR #71 (`142be0b`), live
> 2026-11-12, and the frontend uses both since 2026-11-13. BE-24: admins set `mfaRequired` per
> user and set-up happens at sign-in. Its open question is answered: users can't turn MFA on
> (or off) themselves. Its item 6 (self-service method switching) didn't survive: PR #72
> removed `/auth/mfa/method-change/*` (Q-1). BE-26: revoking a grant marks its approved requests
> `revoked`. Raised: BE-29 and questions Q-1, Q-2. Write-ups of the done items are in git history.

> **2026-11-13: BE-28 done and removed** (intermittent 500 when a parallel fork splits). Fixed
> in `9bdb9a6` (PR #73, a longer routing transaction timeout); confirmed on live by the product
> owner the same day. Its write-up is in git history.

> **2026-11-16: BE-27 done and removed.** Shipped in PR #72 (`9497fae`, merged as `bf24f1a`),
> live 2026-11-13. Verified live 2026-11-16 as `staff_finance`: an action on a task whose document
> they can't open returns 403 `TASK_DOCUMENT_VIEW_FORBIDDEN`, and `GET /tasks/:id` reports
> `canRoute: false` there, as `GET /workflow-instances/:id` does. DRIFT-25 is closed. Its write-up
> is in git history.

> **2026-11-11: re-checked against `4da2980`.** Done and removed: BE-19 (500 at a parallel
> fork), fixed in `ae08ef5` (PR #58, 2026-10-23) and confirmed working by the product owner.
> BE-2, BE-4, BE-10, BE-12, BE-18, BE-21 and BE-22 are still open in the code.

> **2026-10-21: this file now lists open asks only.** Every item was re-checked against
> `d14f250`. Done and removed: BE-1 (access requests), BE-3 (workflow authorization), BE-5
> (download, shipped as `GET /documents/:id/versions/:versionId`), BE-11 (audit), BE-13
> (password recovery), BE-14 (tier clearance), BE-15 (revoke a grant, `550feda`) and BE-17
> (several documents per workflow). Their write-ups are in git history. BE-4 and BE-18 were
> partly done and keep only their open part. Withdrawn 2026-10-22: BE-9 (`policies` module,
> not being built) and BE-20 (upload allowlist; the frontend enforces it). Done 2026-10-23:
> BE-16 (signature on `review`), shipped in `ae08ef5` as **required**, not optional. Raised
> 2026-10-27 and done 2026-10-28: BE-23 (`latestVersion` and `publishedVersion` on each
> `GET /workflows` row), shipped in PR #60 (`6ced046`) and used by `/admin/workflows`.

Each item states what the frontend does today, what it needs, and why.

**Take BE-2, BE-4 and BE-21 first**:
they are security items rather than features. BE-22 is a product decision (no automatic AI
summaries) and costs a Gemini call per upload until it ships.

---

## Summary

| ID        | Ask                                                         | Type            | Priority | Blocking?                                  |
| --------- | ----------------------------------------------------------- | --------------- | -------- | ------------------------------------------ |
| **BE-2**  | `POST /auth/logout` + refresh-token revocation              | New endpoint    | 🔴 High  | No — fails silently today                  |
| **BE-4**  | Reject confidentiality tiers the uploader isn't cleared for | Security fix    | 🔴 High  | No                                         |
| **BE-21** | Check cabinet grants when a document is read                | Security fix    | 🔴 High  | No — documents are over-shared today       |
| **BE-22** | Write AI summaries only when a user asks                    | Behaviour fix   | 🟠 Med   | No — every upload costs a Gemini call      |
| **BE-18** | Recovery sweep for OCR jobs stuck at `ocrStatus: 'pending'` | Reliability fix | 🟠 Med   | No — 1 of 8 documents affected when raised |
| **BE-12** | Seed `workflow:view` for the roles that route documents     | Seed fix        | 🟡 Low   | Only on a freshly seeded tenant            |
| **BE-10** | JSON 404 handler                                            | Small fix       | 🟡 Low   | No                                         |
| **BE-25** | Task notifications name the stage, not its id               | Small fix       | 🟡 Low   | No                                         |
| **BE-29** | Own error codes for the mid-session MFA responses           | Small fix       | 🟡 Low   | No — the frontend matches message text     |
| **BE-30** | Document count on paged folder rows                         | Small fix       | 🟡 Low   | No — folder cards show no count meanwhile  |

**Questions, not asks:** Q-1 (was removing MFA method change intended?) and Q-2 (storage bucket
versioning and who owns unique keys), after BE-29.

**Parked, not for sending yet:** AI-1…AI-6 (the last section, before the appendix). Hold
them until the PM confirms the AI features are in scope.

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

## 🟠 BE-22 · Write AI summaries only when a user asks — **new, 2026-10-23**

**Product decision (2026-10-23):** no document is summarised automatically. A summary is
written only when a user presses **Summarize** (or Try again / Regenerate), which is
`POST /documents/:id/summary`. Checked at `origin/dev` `cc56f40`.

### What happens today

Two paths summarise without anyone asking:

1. **After OCR, every version is summarised** — `ocr.workers.ts:108` calls
   `enqueueSummary(documentId, versionId)` once the text is saved. Every upload costs a Gemini
   call.
2. **`GET /documents/:id/summary` queues one** when the version is `summaryStatus: 'pending'`
   with OCR done (`getDocumentSummary`, `documents.service.ts:577`). Reading becomes writing.

The frontend has stopped triggering path 2 (it reads `currentVersion.aiSummary` /
`summaryStatus` from `GET /documents/:id` and calls `GET …/summary` only to follow a
request it made), but path 1 is server-side only.

### What we need

1. Remove the `enqueueSummary` call from the OCR worker.
2. Remove the lazy enqueue from `getDocumentSummary`; `GET` only reads.
3. A status for "nobody asked yet", distinct from "queued". Today both are `pending`. Suggest a
   new default `summaryStatus: 'none'` (migration: existing `pending` rows with no queued job →
   `none`); `POST` sets `pending` as now.
4. Keep `POST` as it is (its 409/422/503 codes are already handled).

**Frontend follow-up once it ships:** treat `none` like today's not-requested `pending` (show
Summarize). Until then the frontend shows Summarize for any `pending` version it hasn't asked
about; on a version the OCR worker already queued, pressing it gets 409
`SUMMARY_IN_PROGRESS`, which the panel shows as "Writing the summary".

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

## 🟡 BE-25 · Task notifications name the stage, not its id — **new, 2026-11-11**

`task.assigned` reads "A new stage_1789748379694 task requires your attention." and
`workflow.changes_requested` reads "Changes have been requested on your document workflow.", with no
document named. Seen live 2026-11-11 while clicking notifications through (frontend ticket 16); the
links themselves work.

**Cause:** the messages interpolate the stage **id** (`task.stage` / `candidate.currentStage`). The
stage schema accepts an optional `name` and stores it, but `readStoredWorkflowDefinition`
(`definitions.validation.ts`) drops it, so `StoredWorkflowStage` has no `name` to use. The designer
always sends one (new stages: `id: stage_<timestamp>`, `name: 'New stage'`).

**Ask:** map `name` into `StoredWorkflowStage`, then use `stage.name ?? stage.id` and the document
title at all five sites (checked on `origin/dev` `4da2980`):
- `instances.service.ts` ~1328, first task on start (`stage` in scope)
- `tasks.service.ts` ~1795, next task after an action (`targetStage` in scope); also name the
  document in the changes-requested text
- `tasks.service.ts` ~2712, task after parallel branches join (`targetStage` in scope)
- `sla.service.ts` ~929 and ~960, SLA warning and breach (needs the definition loaded)

---

## 🟡 BE-29 · Own error codes for the mid-session MFA responses — **new, 2026-11-16**

Checked against `edms-backend` `dev` at `e033b58`. `auth.middleware.ts` answers
`mfaRequired && !mfaEnabled` with `ApiResponse.forbidden` (403 `FORBIDDEN`) and a token whose
`mfaState` no longer matches with `ApiResponse.unauthorized` (401 `UNAUTHORIZED`). The refresh
path in `auth.service.ts` already uses `MFA_SETUP_REQUIRED` (403) and `SESSION_SECURITY_CHANGED`
(401) for the same two cases.

The frontend tells a user why their session ended (since 2026-11-13). For the 401 it calls refresh
and reads the code; for the 403 it compares the message text ("MFA setup is required before
accessing this account", `src/lib/sessionEnd.ts`). Rewording that message breaks it silently.

**Ask:** send the refresh path's codes from the middleware too: 403 `MFA_SETUP_REQUIRED` and 401
`SESSION_SECURITY_CHANGED`. The frontend then drops the message match.

---

## 🟡 BE-30 · Document count on paged folder rows — **new, 2026-11-16**

Checked against `edms-backend` `dev` at `bf6bf46`. `GET /cabinets/:cabinetId/folders` without
query params returns at most 500 folders (`findByCabinet`, `DEFAULT_TAKE`), each with
`_count.documents`. With `limit`, `cursor` or `parentId` it pages as `{ folders, nextCursor }`
(`findPageByCabinet`), but those rows select no `_count`.

Since 2026-11-16 the frontend always pages, so a cabinet with more than 500 folders lists them
all. The cost: the cabinet browser no longer shows how many documents each folder holds.

**Ask:** add `_count: { documents }` to the paged rows, the same count the unpaged list returns.
The frontend then shows it on folder cards again.

---

## ❓ Q-1 · Was removing MFA method change intended? — **new, 2026-11-16**

PR #72 (`9497fae`) removed all five `/auth/mfa/method-change/*` routes (404 on live since
2026-11-13). The service methods are still in `mfa.service.ts`, unrouted. BE-24 asked for
switching to stay self-service. If the removal is intended, a user changes method only through an
admin reset (`DELETE /auth/mfa/users/:userId`) and set-up at the next sign-in, which is what
`/account/security` now says. If not, which routes come back? And should a switch then return
fresh tokens? Before PR #72 a switch set `mfaEnabledAt`, which ended the session that made it.

---

## ❓ Q-2 · Storage bucket versioning, and who owns unique keys — **new, 2026-11-16**

The upload gateway stores a file at `edmsdocuments/<name>` and adds nothing unique, so two
uploads with the same name used to share one S3 object (the second replaced the first). The
frontend fixed it on 2026-11-13: every upload now sends `<name>-<12 hex digits>.<ext>` (doc 01
§5, item i). Two questions:

1. Is versioning on for the bucket? If yes, overwritten files from before 2026-11-13 can be
   recovered; on 2026-11-11, 26 live documents shared 19 keys.
2. Should the gateway or the backend make keys unique, rather than every client? Today any other
   client that uploads through the gateway can still overwrite a file.

---

## ⏸️ Parked — AI document understanding (AI-1…AI-6)

**Drafted:** 2026-10-23 · **Backend checked against:** `origin/dev` `cc56f40` ·
**Status: not sent.** Waiting on the PM to confirm these AI features (tracker items 7.2–7.4,
7.6–7.9) are wanted. The contracts below are suggestions; the backend team owns the design.

### What exists today

- **Summaries (7.5) are done:** `GET`/`POST /documents/:id/summary`, written by Gemini
  (`src/shared/utils/ai-summarizer.ts`, `GEMINI_MODEL` default `gemini-2.5-flash`) after
  Textract OCR. The frontend shows them on `/doc/[id]` and the workflow page.
- `DocumentVersion.checksum` (SHA-256) has `@@index([checksum])`, commented "duplicate file
  detection on upload", but no route or create-time check reads it.
- Nothing classifies, extracts fields, detects personal data or suggests a workflow. The
  summary worker's Gemini call writes no audit event; only the user-facing
  `document.summary_viewed` / `document.summary_requested` route actions are audited.

### Asks

| ID | For | Ask |
|---|---|---|
| **AI-1** | 7.2, 7.3, 7.7 | After OCR, one AI job writes a suggestion per version: `documentType`, `cabinetId`, `folderId`, `fields: { fieldId, value, confidence }[]`, `personalData: { kind, count }[]`, `suggestedConfidentiality`, overall `confidence`, and a `status` like `summaryStatus`. Read it with `GET /documents/:id/suggestions`; record the user's choice with `POST /documents/:id/suggestions/:sid/decision { accept, reject, edits }` |
| **AI-2** | 7.2, 7.3, 7.7 at upload | Suggestions *before* filing need an analyse call on the stored file (`POST /documents/analyse { fileUrl, mimeType }`, then poll), since the document doesn't exist yet. If suggestions may arrive *after* filing, AI-1 is enough. **Product decision** |
| **AI-3** | 7.6 | `GET /documents/duplicates?checksum=<sha256>`: documents the caller can see with that checksum (id, title, cabinet, version). Exact matches only; near-duplicates are a later ask |
| **AI-4** | 7.4 | `GET /documents/:id/routing-suggestion` → `{ workflowId, confidence, reason }` |
| **AI-5** | 7.8 | `GET /ai/review-queue?minConfidence=&status=`: suggestions below the tenant's threshold, behind a new permission (e.g. `ai_review:manage`) |
| **AI-6** | 7.9 | Audit every model call and decision as `ai.summary_generated`, `ai.suggestion_generated`, `ai.suggestion_accepted`, `ai.suggestion_rejected`, with the model name and version id (actor: system for generated ones) |

### Open product questions

1. Suggestions before filing (AI-2) or after?
2. Who works the review queue: records manager, cabinet owner, or the uploader?
3. One confidence threshold per tenant, or per document type?
4. Personal data: only suggest a higher confidentiality, or also block filing below it?

Any new AI job here should follow BE-22: it runs when a user asks, not on upload.

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
