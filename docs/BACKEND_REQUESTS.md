# Backend Requests — from the Frontend Team

> **2026-10-08: the open asks are now one implementable spec,
> [`docs/specs/backend-api-spec-2026-10-08.md`](specs/backend-api-spec-2026-10-08.md)**, checked
> against `edms-backend` `dev` at `2db7e19`.

**Raised:** 2026-08-29 · **Updated:** 2026-11-12 (BE-27, BE-28)
**Frontend:** `edms-frontend` @ `dev`
**Backend checked against:** `edms-backend` @ `origin/dev` (`4da2980`, 2026-11-11)

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

**Take BE-28 first** (it blocks parallel workflows), **then BE-2, BE-4, BE-21, BE-24 and
BE-27**: they are security items rather than features. BE-22 is a product decision (no automatic AI
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
| **BE-24** | Admins require MFA per user; users can't turn it off        | Security change | 🔴 High  | No — today every user turns MFA on/off     |
| **BE-25** | Task notifications name the stage, not its id               | Small fix       | 🟡 Low   | No                                         |
| **BE-26** | Mark a request `revoked` when its grant is revoked          | Small fix       | 🟡 Low   | No                                         |
| **BE-27** | Acting on a document requires being able to open it         | Security fix    | 🔴 High  | No — the frontend enforces it; the API doesn't |
| **BE-28** | Intermittent 500 when a parallel fork splits (BE-19 again)  | Bug             | 🔴 High  | **Yes** — a fork with 2+ documents never moves on |

**Parked, not for sending yet:** AI-1…AI-6 (the last section, before the appendix). Hold
them until the PM confirms the AI features are in scope.

---

## 🔴 BE-24 · Admins require MFA per user; users can't turn it off — **new, 2026-11-11**

Checked against `edms-backend` `dev` at `4da2980` (PR #69, multiple MFA methods).

### What happens today

MFA is entirely self-service. Every route in `src/modules/mfa/mfa.router.ts` needs only
`authenticate`, except the admin reset (`DELETE /auth/mfa/users/:userId`, `user:edit`). So:

- any user can turn MFA **off** for themselves (`POST /auth/mfa/disable`, password + code);
- an admin can't **require** it: nothing on `User`, `Role` or the tenant says it's required,
  and `auth.service.ts` asks for a second factor only when `mfaEnabled` is already true;
- `GET /users` and `GET /users/:id` don't return `mfaEnabled`, so the admin page can't tell
  who has MFA on (our **Reset two-step** button shows for everyone).

### What the product wants

An admin (`user:edit`) decides who must use MFA. The user chooses the method (authenticator
app or email) and sets it up themselves, because that needs their phone or inbox. Only an
admin can remove it. The frontend has already hidden the user's own **Turn off** (2026-11-11),
but that's cosmetic until the API refuses it.

### What we need

Shape suggestions only; the backend team owns the design.

1. **`User.mfaRequired`** (boolean, default `false`).
2. **Admin sets it:** `PATCH /users/:id` accepts `mfaRequired`, or a dedicated
   `PUT /auth/mfa/users/:userId/requirement { required }`. Gate on `user:edit`, audit it
   (`user.mfa_required`, `user.mfa_requirement_removed`).
   **On invite too:** `POST /users` (`user:create`) accepts `mfaRequired`, so the admin can tick
   "Require two-step sign-in" when inviting.
3. **List it:** `mfaRequired` and `mfaEnabled` on each `GET /users` row and on `GET /users/:id`.
4. **Sign-in forces set-up:** when `mfaRequired && !mfaEnabled`, `POST /auth/login` returns no
   tokens, e.g. `{ mfaSetupRequired: true, mfaToken }`. The client then sets up a method with
   that token: authenticator (`secret`, `otpauthUri`, then a code) or email (send code, then
   code). A successful confirm returns the usual login body (tokens + user) **plus**
   `recoveryCodes`. Today `/setup`, `/enable`, `/email/setup` and `/email/enable` all need an
   access token, which this user doesn't have yet.
   **New users:** an invited user sets a password on `/reset-password` (invite token), then signs
   in; that first sign-in hits this step, so they set up MFA before their first session. The
   invite link already proves the inbox, so email is the easy choice for them.
5. **Users can't turn it off:** `POST /auth/mfa/disable` returns 403 (e.g.
   `MFA_DISABLE_ADMIN_ONLY`) for everyone, or at least while `mfaRequired` is true. Admins keep
   `DELETE /auth/mfa/users/:userId`. If `mfaRequired` is still true after a reset, the user sets
   MFA up again at their next sign-in. That's the lost-phone flow.
6. **Method switching stays self-service** (`/method-change/*`): the user picks how they get
   their code.

Side effect: this closes a PR #69 gap. `POST /disable` checks `code` only against the
authenticator secret, and `activateOtpMethod` clears that secret for email users, so an email
user can turn MFA off only with a recovery code.

**Open question for the product owner:** may users still turn MFA **on** voluntarily when an
admin hasn't required it? The frontend allows it for now (it only adds security). If not,
`/setup`, `/enable`, `/email/setup` and `/email/enable` should refuse unless `mfaRequired`.

### How to verify

As `client_admin`: require MFA for `management_ops` → their next password sign-in returns
`mfaSetupRequired` and no tokens → set up email or app → signed in with recovery codes.
`POST /auth/mfa/disable` as `management_ops` → 403. Admin reset → next sign-in asks for set-up
again. `GET /users` shows both flags. Invite a user with `mfaRequired: true` → accept the
invite, set a password → first sign-in goes straight to set-up.

---

## 🔴 BE-27 · Acting on a document requires being able to open it — **new, 2026-11-12**

Checked against `edms-backend` `dev` at `c95b9fb` and on live. **Product decision (2026-11-12):
nobody may approve, review, reject or otherwise act on a document they aren't allowed to open.**

### What happens today

A `staff` user who can't open an `internal` document (another department's cabinet, no grant)
can still act on it at a stage assigned to their role. On 2026-11-11 such a user **rejected** a
workflow and closed it with no access granted.

- `isConfidentialityActionAllowed` (`src/shared/constants/access-control.constants.ts:107`) skips
  the tier check for `public` and `internal`, and `route` has no entry in `ACTION_PERMISSION`
  (line 53), so it returns `true`. `POST /tasks/:id/action` relies on it
  (`assertTaskRouteConfidentiality`, `tasks.service.ts`), and so does `canRoute` in
  `GET /tasks/:id`. Viewing uses the stricter check (department, cabinet access, grants).
- The two endpoints report different flags for the same document and user. Seen on live as
  `staff_finance` on instance `8a218839-f1ef-4421-974e-f46158166c95`:
  - `GET /workflow-instances/:id` → `{ canView: false, canRoute: false, canRequestView: true }`
    (hard-coded for locked documents, `workflow-document-access.ts`)
  - `GET /tasks/:id` → `{ canView: false, canRoute: true, canRequestView: true, canRequestRoute: false }`

The frontend now treats a document as actionable only when `canView && canRoute` (2026-11-12), so
the page no longer offers the actions. The API still accepts them.

### What we need

1. **Route clearance includes view.** A document is routable by a user only if they can also
   view it (the same department / cabinet / grant check `GET /documents/:id` uses). An approved
   `view` grant counts. `POST /tasks/:id/action` returns 403 for any document that fails it,
   like it does for a tier the user isn't cleared for.
2. **One answer for `canRoute`.** `GET /tasks/:id` and `GET /workflow-instances/:id` report the
   same `canRoute` for the same user and document, and `canRoute` is never `true` while
   `canView` is `false`.
3. **Request flags follow from it.** For a document the user can't open, `canRequestView: true`;
   `canRequestRoute` only when a `route` grant would still be needed once they can view it.

### How to verify

As `staff_finance` on a task whose document sits in another department's cabinet (e.g. instance
`8a218839…`, task `b36072de-1f47-43ca-b743-3c597ac6ecab`, document "test 48mb"): both endpoints
report `canRoute: false`, and `POST /tasks/:id/action { action: 'reject' }` returns 403. Approve a
`view` access request for them: both report `canView: true, canRoute: true`, and the action
succeeds.

---

## 🔴 BE-28 · Intermittent 500 when a parallel fork splits (BE-19 again) — **new, 2026-11-12**

BE-19 was removed on 2026-11-11 as fixed in `ae08ef5` (PR #58). It isn't. Measured on live
2026-11-12 with three definitions, fresh instances, as `staff_finance` (`review` with a real
signature; the time is the action request alone, after sign-in):

| Action | Definition | Documents | Results |
|---|---|---|---|
| Review at the fork stage (the split) | `fa6a0f43…` (TP-Q15 layout, fork + `join: all`) | 2 | **500 ×6** (6.5–7.2 s) |
| Review at the fork stage | `fa6a0f43…` | 1 | 500, 500, then **200** (6.8 s) |
| Review at the fork stage | `90c37c8e…` (new: fork to two branches, no join) | 1 | 500, 500, then **200** (6.8 s) |
| Review at the fork stage | `5f9fa178…` (new: same shape as TP-Q15, built fresh) | 1 | **200** first time |
| Branch reviews, incl. the last one arriving at the join | `5f9fa178…` | 1 | 200, 200 (4.4 s) |

So it isn't one definition, the actor, or their access: the **same request fails and then succeeds**,
and two documents (twice the fork work) always fail. A failed attempt writes nothing; the task
stays `pending`.

**Likely cause (unconfirmed without the server log):** `completeTaskAndRouteDestinationGroups` runs
the whole routing in one interactive `db.$transaction` (`tasks.service.ts` ~1962–2274) with no `timeout`, so Prisma's
default **5 s** applies. Forking does many sequential round trips per document and branch
(`forkDocumentExecution`, history entries, new tasks, SLA), and against the hosted database a
one-document fork sits right at 5 s. A timed-out transaction throws `P2028` ("Transaction already
closed"), which surfaces as the generic 500.

**Ask:**
1. Confirm in the server log (search `P2028` / "Transaction already closed" around 2026-11-12
   12:23–13:10Z for `POST /tasks/:id/action`).
2. Give the action transaction a realistic budget (`db.$transaction(fn, { timeout: 20000, maxWait:
   5000 })`) and batch the per-document writes (`createMany`), so the time doesn't grow with
   documents × branches.
3. Map a transaction timeout to a retryable error (e.g. 503 `TRANSACTION_TIMEOUT`) rather than
   a 500, so the frontend can say "try again".

Still open on live for the log search: instance `1054af51-e92e-4a9f-bec5-a8298ef2475e` (2 documents,
task `58967a8d-2f2a-4c46-a194-11dfc0c40876`, still at Intake). TP-Q19 (`docs/TEST_PLAN.md`) with
two documents is the check.

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

## 🟡 BE-26 · Mark a request `revoked` when its grant is revoked — **new, 2026-11-11**

`DELETE /documents/:id/access-grants/:userId` deletes the `DocumentAccessGrant` row and leaves the
`DocumentAccessRequest` `approved`. There is no grant list, so `/admin/access-requests` (where Revoke
now lives) keeps showing revoked access as approved, and a second Revoke 404s. A `revoked` status (or
`GET /documents/:id/access-grants`) would fix it.

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
