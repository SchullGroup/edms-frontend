# SchullTech EDMS — Documentation

**Written:** 2026-08-29 · **Revised:** 2026-09-04
**Verified against:** `EDMS-FRONTEND` (`src/`, 15,862 LOC, 42 pages) and
`edms-backend` (branch `tolu`, commit `2c8b901`, 11,393 LOC, 74 routes).
**Re-verified 2026-09-04 against** `edms-backend` @ `dev` (`b72e0bf`, **83 routes**) and
`EDMS-FRONTEND` @ `dev` (`f02c7b8`).

> **What changed in the 2026-09-04 revision.** Two findings moved and one was recounted:
> **document routing is fixed** (the two-call create-then-start sequence shipped and is
> wired in), **the notifications module now exists** on both sides but nothing ever calls
> `notifyUser`, and the unguarded workflow routes number **25**, not 23. Superseded text is
> struck through or marked in place rather than deleted, so each document reads as a
> history. Doc 01 carries the full revision table.

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

**42 frontend pages · 74 backend routes · 6 roles · 0 tests.**

```
The DOCUMENT half is real
  capture · filing · versioning · checkout · classification
  task queues · approval decisions · SLA detection
                                                    ✅ works end to end

The GOVERNANCE half is a UI over fixtures
  audit · notifications · circulars · policies
  findings · retention · platform operations
                                                    🟥 20 of 42 pages
```

### The four defects that matter most

| # | Defect | Where | Effect |
|---|---|---|---|
| 1 | **Workflow routes have no authorization** | `workflows.router.ts` — 0 of **25** routes call `requirePermission`; `definitions.service` and `instances.service` never read roles | Any `staff` account can publish or archive workflow definitions and drive any instance |
| 2 | **The audit trail has never recorded an event** | `audit.middleware.ts` is a **0-byte file**; zero `auditEntry` references in the backend `src/` | The product's compliance positioning is currently unsupported by the code |
| 3 | **Nothing ever creates a notification** | The module, its 6 routes, the queue, the worker and the whole frontend surface exist — but there are **zero references to `notifyUser` outside `src/modules/notifications/`** | Task assignment, returned work and SLA breaches are all silent; the list is permanently empty |
| 4 | **`effStatus()` is a no-op on real data** | Two divergent copies; `Document` has no due-date field; status compares are capitalized against lowercase values | Every overdue badge, count and ageing bucket reads zero across 8 call sites |

**#1 is now the most urgent item in either codebase.** Fixing the routing bug (below) made
this hole reachable from the UI rather than merely present in the API.
**#3 is much smaller than it was** — the plumbing is built; only the call sites are missing.
**#4 is roughly two hours and restores every SLA and ageing view.**

> ✅ **Resolved since 2026-08-29.** *"Document routing calls a URL that doesn't exist"* was
> #3 in this list. `workflowInstances.service.ts` now performs the correct two-call
> sequence via `createAndStart`, wired in through `useStartWorkflowInstance` at
> `staff/cabinets/page.tsx:53`. The approval half of the product is reachable.

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
