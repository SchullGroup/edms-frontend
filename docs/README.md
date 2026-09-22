# SchullTech EDMS — Documentation

**Written:** 2026-08-29 · **Revised:** 2026-09-04
**Verified against:** `EDMS-FRONTEND` (`src/`, 15,862 LOC, 42 pages) and
`edms-backend` (branch `tolu`, commit `2c8b901`, 11,393 LOC, 74 routes).
**Re-verified 2026-09-04 (evening) against** `edms-backend` @ `dev` (`e60c418`,
**90 routes**, 45 permissions) and `EDMS-FRONTEND` @ `dev` (`aec7863`, **46 pages**).

> **What changed on 2026-09-04.** Three scans happened in one day, because both
> codebases moved. In order:
>
> **Morning (frontend).** Document routing was fixed — the two-call create-then-start
> sequence shipped. The notifications module now exists on both sides, but nothing calls
> `notifyUser`, so no notification is ever created. The `feature/management` merge added a
> metadata-field editor, a cabinet-access editor, a shared route-to-workflow picker on
> three screens, and live workflow history.
>
> **Evening (backend).** `feat(workflow): close workflow gaps 1-10` plus two OCR commits
> landed, and they change the shape of this document set:
>
> - ✅ **The workflow authorization hole is closed.** It was ranked #1 here for a week. All
>   five workflow services now assert roles and return `403`.
> - 🔴 **A new critical finding replaced it.** The same commit made workflow definitions
>   readable only by `client_admin` and `schulltech_admin` — so `staff` and `supervisor`,
>   who hold `workflow:route`, can no longer list the workflows they need to route into.
>   **Document routing is broken again**, by a different cause.
> - 🔄 **Two findings changed owner from backend to frontend.** OCR now uses the
>   asynchronous Textract API against the correct bucket; the only remaining problem is
>   that the frontend still uploads elsewhere. And eight server-side aggregation endpoints
>   now exist, of which the frontend consumes one.
>
> Superseded text is struck through or marked in place rather than deleted, so each
> document reads as a history. Doc 01 carries the full revision table.

These five documents describe **what the code actually does today**, not the target design.
Every claim is anchored to a file and, where useful, a line number. Where the two codebases
disagree with each other — or with the older documentation — the disagreement is named and
ranked rather than smoothed over.

---

## Read in this order

| # | Document | What it answers | Length |
|---|---|---|---|
| **01** | [Architecture & Frontend↔Backend Drift](./01-architecture-and-drift.md) | How the pieces fit together, and every place the two sides disagree | ~870 lines |
| **02** | [User Stories](./02-user-stories.md) | What the product is for, per role, with build status per story | ~1,230 lines |
| **03** | [Onboarding Flow, End to End](./03-onboarding-flow-end-to-end.md) | What must happen, in order, for a tenant to go from nothing to operational | ~810 lines |
| **04** | [Per-Role Onboarding & Connections](./04-role-onboarding-and-connections.md) | Each role's own journey, and the seven handoffs between them | ~860 lines |
| **05** | [Implementation Status by Role Dashboard](./05-implementation-status-by-role.md) | Page-by-page: APIs wired, APIs missing, dummy data, flows, backlog | ~800 lines |

**If you only read one:** doc 01 for engineers, doc 05 for planning, doc 03 for anyone
setting up an environment.

---

## Status markers, used consistently across all five

| Marker | Meaning |
|---|---|
| ✅ **Live / Done** | Works end to end: UI → API → database |
| 🟨 **Partial / Hybrid** | Real in part; the specific gap is always named |
| 🟥 **Mock** | Renders `src/store/initialData.ts` fixtures. Nothing persists. |
| ⛔ **Broken / Not built** | Calls an endpoint that doesn't exist, or no implementation at all |
| ↪️ **Re-export** | The route renders another page's component |

---

## The short version

**51 frontend pages · 106 backend routes · 6 roles · 0 tests.**
*(Re-derived 2026-09-18 — was 42 pages / 90 routes at last full count. Route count is
solid, from the live Swagger spec. Page count is solid; the 9 newly-counted pages beyond
`/admin/access-requests` haven't been individually classified — see doc 05's Portfolio
summary.)*

```
The DOCUMENT half is real
  capture · filing · versioning · checkout · classification
  task queues · approval decisions · SLA detection
                                                    ✅ works end to end

The GOVERNANCE half is a UI over fixtures
  notifications · circulars · policies
  findings · retention · platform operations
                                                    🟥 at least 19 of 51 pages
```

### The four defects that matter most

| # | Defect | Where | Effect |
|---|---|---|---|
| 1 | **Staff and supervisors cannot read workflow definitions** | `WORKFLOW_DEFINITION_VIEW_ROLES` is set equal to `MANAGE_ROLES` — `client_admin` and `schulltech_admin` only — in `src/shared/constants/workflow.constants.ts` | **Document routing is unreachable for the roles that do it.** `useRouteToWorkflow` gets a `403`, so its picker says "no published workflows" — neither true nor the reason. Also contradicts `management` and `internal_auditor`'s seeded `workflow:view:global` |
| ~~2~~ | ✅ **Resolved 2026-09-18.** ~~The real audit trail is invisible to the role whose job is to read it~~ | Backend is real and auto-writing (DRIFT-11 in doc 01); `/admin/audit`, `/auditor/trail` and `management/compliance` all read it now. `/platform/audit` stays mocked by design — no cross-tenant backend exists to read | The compliance story now has real data behind it, and the auditor role can see it |
| 3 | **Nothing ever creates a notification** | The module, its 6 routes, the queue, the worker and the whole frontend surface exist — but there are **zero references to `notifyUser` outside `src/modules/notifications/`** | Task assignment, returned work and SLA breaches are all silent; the list is permanently empty |
| 4 | **`effStatus()` is a no-op on real data** | Two divergent copies; `Document` has no due-date field; status compares are capitalized against lowercase values | Every overdue badge, count and ageing bucket reads zero across 8 call sites |

**#1 is a one-line fix and it currently disables the product's core loop** — give read its
own role list instead of aliasing manage. Verify it against the seeded `workflow:view` and
`workflow:route` grants rather than choosing a list by hand.
**#3 is much smaller than it was** — the plumbing is built; only the call sites are missing.
**#4 is roughly two hours and restores every SLA and ageing view.**

> ✅ **Resolved since 2026-08-29.** Two items have left this list.
>
> *"Document routing calls a URL that doesn't exist"* — fixed. The shared
> `useRouteToWorkflow` hook now performs the correct two-call sequence and is wired into
> `/upload`, `/staff/cabinets` and `/doc/[id]`.
>
> *"Workflow routes have no authorization"* — fixed, and it was #1 here for a week. All
> five workflow services now assert roles and return a named `403`.
> **⚠️ Note for anyone verifying this:** `requirePermission` still appears **0 times** in
> `workflows.router.ts`. Authorization lives in the service layer, so grep for
> `_FORBIDDEN`, not `requirePermission`. A route-level grep will make you re-report a
> finding that is closed.
>
> Read #1 above alongside this: fixing the authorization hole is what introduced it.

### Two more worth knowing before you debug anything

- **Run `npx prisma generate` in `edms-backend` before anything else.** The checked-in
  generated client predates the `scope` migration. Without it the build fails — and in dev
  (where `tsx` skips typechecking) every user is silently narrowed to `department` scope.
- **The 12 test-account buttons on the login screen all fail.** The backend seed creates
  `tjoel+…@schulltech.com` accounts, password `Fixture123!`. See doc 03, Phase 1.

---

## Where the numbers come from

Nothing here is estimated. The classification in doc 05 was produced by inspecting, for
every one of the 42 pages, what it destructures from `useStore` versus which API hooks it
calls — and by distinguishing *legitimate session state* (`currentUser`, `prefs`) from
*rendered `SEED` domain data*. The endpoint inventory in doc 01 was extracted from both
codebases and diffed route by route.

Two claims in an earlier draft were wrong and have been corrected in place:
`/supervisor/bottlenecks` uses **live** API data (not `SEED`) — which is how defect #4
above was found; and the three "7-line stub" pages are **re-exports**, one of which
(`/platform/flags`) renders the wrong screen entirely.

**Correction (2026-09-10).** Doc 05 stated `/admin/users` "writes the role matrix to
`SEED`" and listed `useRole`/`useUpdateRole`/`useDeleteRole` etc. as dead — both were
stale. The matrix already used `PUT /roles/{id}/permissions` via `useSetRolePermissions`;
this session then wired role **rename/delete** and user **role assign/remove**, the
`/doc/[id]` **versions/metadata/archive** surface, `/admin/cabinets` **folder rename +
metadata-field edit**, and the `/tasks/stats` · `/workflow-instances/stats` ·
`/documents/stats` tiles on the management dashboards. Frontend gating was also
rebuilt to be **permission-key based** (`src/lib/permissions.ts`), retiring the
`usePermissions` role-name heuristics — see DRIFT-03 / DRIFT-04 in doc 01.

**Correction (2026-09-15).** DRIFT-03's remaining backend half is done: `POST /auth/login`
and `GET /auth/me` now return a scoped `permissions: string[]` array. That live payload
is the precise per-user source of truth; `useHydratePermissions` (role-derived, from
`GET /roles`) is a gap-filler only. It previously *replaced* `currentUser.permissions`
outright on any mismatch with the role-derived set — harmless while the payload was
empty, but silently scope-dropping the moment it wasn't — so it was fixed to only add
genuinely missing keys. See DRIFT-03 in doc 01.

**Correction (2026-09-18).** Every doc previously stated the backend audit module was
entirely unbuilt — `audit_entries` "never written to," `audit.middleware.ts` "0 bytes,"
`GET /audit` "no endpoint." All wrong, confirmed live against
`edms-backend-zmfm.onrender.com`: `GET /audit`, `GET /audit/:id`, `GET /audit/export` and
`GET /audit/verify` exist, entries are written automatically as a side effect of other
actions (no client call needed), and the hash chain checked out intact via
`GET /audit/verify`. `/admin/audit` was wired to it the same day. This was re-checked
against **live API behavior**, not by re-reading `edms-backend/src/` — so DB-level
specifics (an INSERT-only Postgres role, monthly partitioning) are marked unverified
rather than confirmed. `auditor/trail`, `platform/audit` and `management/compliance`
still read the old `SEED`-backed mock and are unchanged; see DRIFT-11 (revised) in doc 01
for the full writeup, and doc 05 §4/§5 for the per-page detail. Doc 04's H7 section
(`Every role → Internal Auditor`) and its Role 4/Role 6 sections still describe the old,
now-wrong state in several places — corrected only where doc 04 is read as the
authoritative cross-role summary (H7, and the Role 4/Role 6 headline claims); the
per-step tables in those sections weren't individually swept and may still say "no
endpoint" in places doc 05 has already corrected.

**Correction (2026-09-18, later the same day).** `auditor/trail` and
`management/compliance`'s sensitive-activity panel are migrated now too — pulled a
78-entry live sample first to get the *real* action vocabulary (`user.login`,
`document.viewed`, `document.edited`, `role.permissions_updated`,
`document.access_denied`, 15 others) rather than guessing; the old
`REDACT_RELEASE`/`SIGN`/`PRINT`/`DOWNLOAD`/`SLA_ESCALATION` codes matched nothing real.
`platform/audit` stays on `SEED.audit`, confirmed as a genuine backend gap rather than
unfinished frontend work: `GET /audit` is tenant-scoped with no cross-tenant query, and
no platform-level multi-tenant API exists anywhere in this backend. Docs 01, 04 and 05
updated accordingly.

**Correction (2026-09-18, later still).** Found and fixed a real, active bug while
investigating why custom roles can't be granted confidentiality-tier clearance:
`PUT /roles/:id/permissions` accepts an optional `scope` (`own`/`department`/`global`,
default `global`) per the live schema, and `GET /roles`' raw response carries it on the
`rolePermissions[]` join row — but `roles.service.ts#normalizeRole` only ever mapped
`rp => rp.permission`, dropping `scope` on every read. Since the role editor never had
scope to send back, and a missing `scope` defaults to `global`, **every save through
`/admin/roles` was silently widening every one of that role's grants to `global` scope**,
not just the permission being edited — including for built-in system roles, which this
page allows editing. Checked the six seeded roles plus one real custom role
("Budget Officer") already in this tenant for signs of prior corruption — all show a
healthy mix of scopes, no evidence of damage. Fixed: `normalizeRole` now lifts `scope`
onto each permission, and `/admin/roles`'s editor tracks and lets an admin choose scope
per permission instead of dropping it. Verified end-to-end against the live API (create
role → set mixed `own`/`department` scopes → confirm they round-trip → clean up).

Also: `POST /users` no longer needs a `password` — confirmed live it now accepts
omitting it entirely and returns `{invited: true}`, triggering a real invite email
instead of the frontend setting a hardcoded default. `admin/users/page.tsx`'s
create-user flow stopped sending one.

Also found and fixed while wiring the above: `POST /auth/reset-password` — the shared
landing point for both password-reset **and** invitation-acceptance links — was sending
`newPassword`/`confirmPassword` instead of the backend's required `password` field,
confirmed via a live `422` before the fix. This blocked every reset/invitation completion
on every role and predates this session; it surfaced only because `POST
/users/:id/invitation` ("Resend invite") was being wired at the same time. See DRIFT-15
in doc 01.

**Correction (2026-09-18, later the same day).** Continued integrating the rest of the
endpoints found unwired: document access-requests (`POST/GET
/documents/:id/access-requests`, grant, deny, admin inbox — new page
`/admin/access-requests`) and dedicated document comments/signatures
(`GET/POST /documents/:id/comments` / `/signatures`, both new panels on `/doc/[id]`,
separate from the pre-existing task-action `comment` field and `approve`-action
signature). All verified live via real create/list/grant/deny/comment/sign round-trips
against `edms-backend-zmfm.onrender.com` before being called done — see BE-1 in
`BACKEND_REQUESTS.md` (the comments/signatures entries there, BE-6/BE-7, were later
deleted from that doc — withdrawn and superseded, not worth keeping once resolved).

While wiring these, a much larger cluster of **unrelated stale claims** surfaced —
things already wired that the docs still described as missing: cabinet access-grant UI,
cabinet metadata-field designer, the role-permission-matrix editor (this one directly
contradicted another line in the *same* doc), document version-restore, document
archive, and the `/delegations` page. All corrected in place across docs 01, 04 and 05,
each tagged with "stale, caught 2026-09-18" rather than presented as new work. One open
question flagged, not resolved: whether cabinet access grants are enforced on the
**read** path (not just written via the CRUD UI) is unverified.

Also: `find src/app -name 'page.tsx' | wc -l` now returns **51**, not the **42** this
whole document's portfolio counts are built on — one of the nine is
`/admin/access-requests` (classified above), the other eight were not individually
re-classified in this pass. Every count in doc 05 derived from "42" is now a known
undercount until a full re-audit happens; see doc 05's "Portfolio summary" for the same
flag in place.

**Correction (2026-09-18, later still the same day).** The document comments/signatures
panels described two paragraphs above were reverted a few hours after being wired. On
review, the product decision is that every comment and signature should live on the one
workflow trail (`comment`/`signature` on `POST /tasks/:id/action`, read back via
`GET /workflow-history`) rather than split across that trail *and* a second,
task-independent thread. `DocumentCommentsPanel`/`DocumentSignaturesPanel` and their
hooks/services/types were deleted; `document_comment:*`/`document_signature:*` no longer
appear anywhere in the frontend. The endpoints themselves are still real and live on the
backend — this is a frontend product choice not to consume them, not a drift finding.
Two things came out of the same pass: `WorkflowHistoryTimeline` now renders each entry's
`comment` and, when present, `task.signature`'s image (both confirmed live in the
`GET /workflow-history` response shape, previously only `note` was read); and "Mark
reviewed" gained an optional-comment modal, but **not** a signature — the backend's
`review`/`reject`/`request_changes`/`close` action schema is `additionalProperties:
false` with no `signature` property, confirmed against the live OpenAPI spec, so a
review can't carry one today. See BE-16 (optional signature on `review`) and BE-17
(support more than one document per workflow instance, for the "request changes because
a document is missing, not wrong" case) in `BACKEND_REQUESTS.md`. Corrected in docs 01,
02, 03, 05 and here.

**Correction (2026-09-21).** Doc 01's `DRIFT-07` section described `GET /documents/stats`
as an unverified shape (guessing at `total`, `byStatus`, `byConfidentiality`,
`byDepartment`). None of those fields exist on the wire. Confirmed against
`documents.service.ts#getDocumentStats` on `edms-backend` `dev`: the real shape is
`{ buckets: [{key, count, departmentId, departmentName}] }`. The frontend's
`docStats?.total != null` check could never be true, so a whole panel on the
Organization Overview dashboard had been silently dead since it was added.
`DocumentStatsResponse` in `src/types/models.ts` is corrected. Found while rewiring the
four management dashboards off `fetchAllPages` onto the real aggregation endpoints
(DRIFT-07, resolved this session).

Also corrected: `DRIFT-14` was previously described as fixed by deleting a hardcoded
constant (`WORKFLOW_DEFINITION_VIEW_ROLES`). The constant really is gone, replaced by
real `requirePermission('workflow', 'view')` at the router — but the RBAC seed data
shipped in the same backend commit (`4c07479`, 2026-09-16) never re-granted
`workflow:view` to `staff`/`supervisor`/`management`/`internal_auditor`, so the
user-visible symptom is unchanged: the routing picker still reports "no published
workflows" to the roles that route documents. Re-diagnosed, not reopened as new — same
finding, corrected mechanism.

A related, genuinely new finding from the same pass: the frontend's own route guard
(`routes.config.ts`, `src/lib/permissions.ts`) gated `/supervisor` on `workflow:route`
and `/management` on `dashboard:view` — the first retired by that same backend commit,
the second never a real backend resource at all (confirmed zero matches anywhere in
`permissions.constants.ts` or `prisma/seed-system.ts`). Because `usePermissions.ts`
discards its pre-hydration fallback the instant live permissions load, and both
`/auth/login` and `/auth/me` have carried real permissions since DRIFT-03 shipped
(2026-09-15), this meant **real supervisors and management users were being redirected
to `/unauthorized` by the app's own guard**, independent of what the backend would
actually allow. Fixed frontend-side (new finding, DRIFT-16) — see doc 01 §4.

Also corrected: doc 01's drift register still listed "Cabinet access-grant CRUD has no
UI" as open. It was already stale by 2026-09-18 per this log's own earlier entry (see
above) but the register table itself was never updated to match — `admin/cabinets` has
had a full "Access" card (grant modal, revoke button, wired to
`useCabinetAccessGrants`/`useGrantCabinetAccess`/`useRevokeCabinetAccess`) since then.

**Correction (2026-09-21, later the same day) — the big one: `DRIFT-06` retracted.**
Every prior revision of `DRIFT-06` ("the file is never in the bucket Textract reads
from") reasoned from the code — `s3.service.ts` posts to a URL outside `edms-backend`,
therefore the file must land somewhere other than `env.S3_BUCKET`, therefore Textract
must fail — and never checked a real document. It was wrong. Logged in as `client_admin`
against the deployed backend (`edms-backend-zmfm.onrender.com`), pulled every document
via `GET /documents`: 7 of 8 have `ocrStatus: 'completed'` with real, substantial
extracted OCR text, and every `fileUrl` (a presigned GET the backend mints fresh) points
at `env.S3_BUCKET`. Two of the completed ones have the exact `edmsdocuments/<filename>`
key pattern the real browser-upload path produces, so this isn't seed data — the
third-party gateway and `env.S3_BUCKET` are, in practice, the same storage in this
deployment. This document has no visibility into *why* (that's the gateway's own,
uninspected Lambda configuration), only that live behavior contradicts what every
earlier revision of `DRIFT-06` asserted.

What the same pull *did* show real: one document, uploaded 2026-09-18, has sat at
`ocrStatus: 'pending'` for three days — never advanced to `processing`/`completed`/
`failed` — and is confirmed invisible to `GET /documents/search` while sitting fine in
the plain list. That's a real, narrower reliability gap (a job that never got durably
picked up, not one Textract rejected), not the systemic architecture break this section
previously described. The backend-side "upload through the backend instead of the
gateway" plan that followed from the wrong diagnosis was dropped before any code was
written. See doc 01 §5 for the corrected write-up and the reconciliation-sweep
recommendation that replaces it.

**Correction (2026-09-21, later still) — doc 01 §5 described dead upload code in every
revision, including the first one.** `src/apis/services/uploader.ts` and
`src/apis/hooks/useMultipartUploader.ts` — a chunked, presigned-PUT multipart uploader
(5 MB parts, 5 concurrent, real `XMLHttpRequest` byte-progress) — replaced the
single-shot base64-to-gateway upload (`s3.service.ts#uploadFile()`) on **2026-08-31**
(`aa11682`), and `upload/page.tsx` was wired to it the same commit. This doc's original
write-up is dated **2026-08-29** — two days *before* that switch — and none of the four
re-scans since (2026-09-04 ×2, 2026-09-18, 2026-09-21) caught it; `uploadFile()` has had
zero real callers the entire time. Found while confirming the upload progress bar
reflects genuine byte-level progress (it does) rather than a simulated animation.
Doc 01 §5's flow diagram and "Related storage problems" table are corrected to describe
the live path; two of the old table's entries (2 MB limit, base64-in-memory) no longer
apply at all, and a new one was found in the process: the dropzone's own UI text
advertises file types (DOCX/XLSX/TIFF) and a 100 MB cap that the live validator has
never actually allowed.

**Correction (2026-09-21, later still).** Doc 05's Management Portal section stated
"`/management`, `/departments`, `/trends` and `/performance` compute every aggregate
client-side" and "the backend has no aggregation, statistics or reporting endpoints of
any kind." Both were already wrong by the time this was read — eight aggregation
endpoints exist (`GET /documents/stats`, `/tasks/stats`, `/workflow-instances/stats`
and four more), and this session rewired all four pages onto them (DRIFT-07 in doc 01,
resolved). Doc 05's page inventory, "APIs wired/missing," "Flows" and "What's left"
subsections for that role are corrected to match, and backlog item 16 is marked done
for management (backend half was already done; the frontend half — supervisor-side
adoption of the same endpoints — is unverified, not claimed done).

**Correction (2026-09-21, later still) — DRIFT-02 resolved.** Docs 01, 03 and 05 all
described the frontend route guard as purely cosmetic — "no `middleware.ts` in the
project," forgeable by editing `localStorage`. Built and live-tested a real fix:
`src/proxy.ts` (not `middleware.ts` — Next.js 16 deprecated and renamed the file
convention mid-session, caught from a dev-server log warning) resolves live
roles/permissions from `GET /auth/me` server-side on every protected navigation, sharing
its rule-matching with `AppShell` via a new `evaluateRouteAccess()` (`src/lib/
routeAccess.ts`) so the two can't disagree. The one design decision that took real
thought: it fails closed only on a *confirmed* 401/403 from a responding backend, and
fails **open** on an unreachable one (network error, timeout, `5xx`) — the first version
conflated the two and would have logged out every signed-in user on the next navigation
during any backend blip, caught by live-testing against a deliberately unreachable
backend before shipping, not by inspection. `AppShell`'s own separate session-verify
effect had the identical bug and needed the same fix independently. Fail-open is backed
by two new pieces so it doesn't mean "silently broken": `SessionExpiredModal` (no
dismissal path except full logout) for a confirmed-dead session, and
`ServiceUnavailableOverlay` (a `QueryCache`-level counter across all queries) for a
backend that's actually down. Live-verified end-to-end, including the one scenario that
mattered most — a real prior session against a genuinely unreachable backend — not just
type-checked. Doc 01 §4 and its DRIFT-02 write-up, doc 03's onboarding flow, and doc 05's
backlog item 11 are all corrected to match.

**Correction (2026-09-22) — enum casing fixed, and two more stale claims corrected.**
Fixed the confidentiality/urgency/status casing mismatch at its root: `StatusBadge`/
`ConfBadge`/`UrgBadge` now run a shared `titleCase()` on their display text, correct
regardless of which casing the underlying data source used, and correct on every one of
their 34 call sites without needing to touch most of them. Found a real functional bug
in the process, not just a display one: `search/page.tsx`'s confidentiality facet used a
naive capitalize-first-letter transform that turned `'top_secret'` into `"Top_secret"`,
matching nothing in the Title-Case facet list — a `top_secret` document could never be
found via that filter, silently, with no error. Fixed alongside the display issue.

Also corrected two more doc 01 claims the user caught/prompted a check on: **the
"duplicate `NEXT_PUBLIC_API_URL`" finding isn't real** — the user checked the live
`.env` directly; it has one `NEXT_PUBLIC_API_URL` key pointed at the deployed backend,
plus `NEXT_PUBLIC_UPLOAD_BASE_URL` for the multipart uploader, no duplicates, no dead
keys. And while confirming that, found the multipart-uploader host claim from the
2026-09-21 upload-path correction was *also* wrong: it asserted the chunked uploader
hits "the same third-party gateway host" as the old single-shot flow, written from
`uploader.ts`'s hardcoded fallback default without checking whether `.env` overrides
it — it does. The live host (`.env`'s `NEXT_PUBLIC_UPLOAD_BASE_URL`) is a different
gateway in a different region than the code's fallback, consistent with the `us-west-1`
bucket region confirmed during the DRIFT-06 live-verification. Doc 01 §5, §8.2, §9, and
the register table are all corrected.

---

## Relationship to the older docs

These supersede two files in `../../out/`:

- `out/DOCUMENTATION.md`
- `out/USER_FLOWS.md`

Both describe endpoints that were never built — `POST /documents/:id/route`,
`POST /workflows/instances/:id/approve`, `POST /users/invite`, `POST /circulars`,
`POST /circulars/:id/ack` — and a `multipart/form-data` upload path that does not exist
(the real flow is a client-side upload to a third-party gateway, then a JSON `fileUrl`).
They also state that separation-of-duties enforcement is a platform feature; no such logic
exists in either codebase.

Treat them as **design intent from an earlier phase**. They are still useful for
understanding what was originally aimed at.

Still authoritative, and worth reading alongside these:

- `edms-backend/docs/edms_architecture.md` — the True Silo multi-tenancy design and the
  four-layer rule. Its central claim (that `db` is always passed as a parameter, making
  multi-tenancy a one-line-per-controller change) **is verifiably upheld in the code**.
- `edms-backend/docs/codebase_rules.md` — the backend's layering and naming conventions,
  which are followed almost perfectly.
