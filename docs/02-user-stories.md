# 02 — User Stories

**Status:** Written 2026-08-29. Grounded in `EDMS-FRONTEND` and `edms-backend` as they exist today.

Each story carries a **build status** so this document doubles as a backlog rather than a
wish list. Statuses are defined once, here:

| Marker | Meaning |
|---|---|
| ✅ **Done** | Works end to end: UI → API → database. Verified against the code. |
| 🟨 **Partial** | The UI exists and the flow reads correctly, but some part is mocked, drifted, or unreachable. The gap is named in the story. |
| 🟥 **Mock** | The screen renders from `src/store/initialData.ts` fixtures. Nothing is persisted. |
| ⬜ **Not built** | No UI, no endpoint, or both. |

---

## Table of contents

1. [Product context — what problem this solves](#1-product-context--what-problem-this-solves)
2. [The six personas](#2-the-six-personas)
3. [Epic A — Capture & Filing](#epic-a--capture--filing)
4. [Epic B — Retrieval & Search](#epic-b--retrieval--search)
5. [Epic C — Routing, Review & Approval](#epic-c--routing-review--approval)
6. [Epic D — Version Control & Custody](#epic-d--version-control--custody)
7. [Epic E — Access Control & Confidentiality](#epic-e--access-control--confidentiality)
8. [Epic F — Oversight, SLA & Workload](#epic-f--oversight-sla--workload)
9. [Epic G — Executive Reporting](#epic-g--executive-reporting)
10. [Epic H — Audit & Compliance](#epic-h--audit--compliance)
11. [Epic I — Tenant Administration](#epic-i--tenant-administration)
12. [Epic J — Communication & Circulars](#epic-j--communication--circulars)
13. [Epic K — Platform Operations](#epic-k--platform-operations)
14. [Cross-cutting non-functional stories](#14-cross-cutting-non-functional-stories)
15. [Story map summary](#15-story-map-summary)

---

## 1. Product context — what problem this solves

SchullTech EDMS is a **system of record for regulated, high-stakes paperwork** — the kind
of document flow found in banks, tax authorities, insurers and public agencies in Nigeria
and comparable markets.

The problem it replaces is a specific, recognisable one:

> A physical or semi-digital filing regime where documents live in shared drives and email
> threads; where "who approved this, and when?" is answered by searching someone's inbox;
> where a file sitting on a desk for three weeks is invisible until a customer complains;
> and where an external auditor's request for a six-month access history triggers a
> two-week manual reconstruction.

Five properties define whether the product succeeds:

1. **Every document has one canonical location and one canonical current version.**
   Not seven copies in seven inboxes.
2. **Every movement is a recorded event.** Who did what, to which document, when, from
   where — in an append-only trail that nobody, including a database administrator, can
   quietly rewrite.
3. **Approval is a modelled process, not a convention.** Stages, assignees, SLA clocks,
   escalation — defined once by an administrator, executed identically every time.
4. **Access is need-to-know, enforced in depth.** Role, department, per-cabinet grant, and
   document confidentiality tier are four independent gates that stack.
5. **Delay is visible before it becomes a complaint.** A supervisor sees ageing work while
   there is still time to act on it.

Everything in this backlog serves one of those five.

---

## 2. The six personas

The system defines exactly six roles. They are seeded as `isSystemRole: true` in
`prisma/seed-system.ts` and are not tenant-editable.

---

### 👤 Chika — **Staff Officer** (`staff`)

*Operations desk officer. Handles 15–40 documents a day.*

**Reality of their day:** Chika receives paperwork — invoices from vendors, customer
correspondence, internal memos — some scanned at a shared MFP, some as email attachments,
some as physical paper walked to their desk. Their job is to get each one into the right
place with the right labels and moving toward whoever must act on it.

**What success looks like:** filing a document takes under 60 seconds, they never have to
ask "where does this go?", and they can answer "where is that invoice?" without leaving
their desk.

**What they fear:** losing a document; being blamed for a delay that was actually sitting
in a supervisor's queue; having to re-key metadata a machine could have read.

**Backend rights (14 grants):** `document:view:department`, `document:create:own`,
`document:search:department`, `document_version:view:department`,
`document_version:create:own`, `document_lock:*:own`, `document_metadata:*`,
`cabinet:view`, `folder:view`, `workflow:view`, `workflow:route`.
Note the scopes — staff see their **department's** documents, not the whole tenant.

---

### 👤 David — **Supervisor** (`supervisor`)

*Operations team lead. Six to twelve direct reports.*

**Reality of their day:** David is the bottleneck by design — most documents pass through
an approval stage assigned to him. He also owns his team's throughput: if three invoices
have been sitting for a week, that is his problem before it is anyone else's.

**What success looks like:** he clears his approval queue by lunchtime, he can see which
items are ageing before they breach, and he can move work off an overloaded or absent team
member in two clicks.

**What they fear:** a breached SLA he never saw coming; approving something he should have
read more carefully; discovering a backlog only when a customer escalates.

**Backend rights (18 grants):** department-scoped document view/edit, `workflow:route`,
plus membership of `TASK_VIEW_ALL_ROLES` and `TASK_REASSIGN_ROLES`, which is what actually
lets him see and reassign other people's tasks.

---

### 👤 Eniola — **Management** (`management`)

*Executive. Divisional or C-suite.*

**Reality of their day:** Eniola never files a document and rarely approves one. They open
the system to answer questions like "is Finance slower than HR this quarter, and by how
much?", "what is our overall SLA compliance trend?", "which department has the most
overdue work?" — and then to export that into a board pack.

**What success looks like:** they get a defensible number in under a minute and can export
it without asking anyone.

**What they fear:** being surprised in a board meeting; numbers that don't reconcile with
what the operations team says.

**Backend rights (10 grants):** all read-only and `global`-scoped — `document:view`,
`document:search`, `document_version:view`, `document_metadata:view`, `cabinet:view`,
`folder:view`, `department:view`, `user:view`, `workflow:view`, plus `workflow:route`.
**Management cannot create, edit, or delete anything.** (The frontend's
`usePermissions` heuristic wrongly grants them approve/reject — see DRIFT-04 in doc 01.)

---

### 👤 Femi — **Internal Auditor** (`internal_auditor`)

*Compliance and assurance function. Independent of operations.*

**Reality of their day:** Femi samples documents, verifies that stated controls were
actually applied, and raises findings when they weren't. Periodically an external
regulator or auditor asks for evidence, and Femi must produce it.

**What success looks like:** they can pull a complete, tamper-evident history for any
document or user; they can prove the trail has not been altered; and their findings are
tracked to closure with named owners and dates.

**What they fear:** an audit trail with gaps; being unable to prove the trail is complete;
findings that quietly die.

**Backend rights (10 grants):** read-only and `global` — including `audit:view`
(**for which no endpoint exists**), `cabinet_access:view`, and `document:view` across the
whole tenant. Membership of `CONFIDENTIAL_TIER_ROLES` lets them read confidential-tier
documents. Deliberately **cannot mutate anything** — that independence is the point.

---

### 👤 Bola — **Client Administrator** (`client_admin`)

*The tenant's own system owner. Usually IT or Operations management.*

**Reality of their day:** Bola configures the system for their organisation — the
department tree, the cabinets and their folder structures, who has which role, which
approval workflows exist, what the retention and confidentiality policies say, and what
the product looks like in their brand.

**What success looks like:** they onboard a new team member in five minutes; they change
an approval chain without a support ticket; the system looks like their organisation's.

**What they fear:** granting someone too much access by accident; a misconfigured workflow
silently stalling every document in a cabinet.

**Backend rights (45 grants, all `global`):** effectively full control of the tenant.
They are the **only** role in `CABINET_ACCESS_BYPASS_ROLES` (they see every cabinet
regardless of grants) and the only role in `RESTRICTED_TIER_ROLES`.

---

### 👤 Adaeze — **SchullTech Platform Admin** (`schulltech_admin`)

*The vendor's own operations team. Not an employee of the customer.*

**Reality of their day:** Adaeze provisions new tenant organisations, manages commercial
plans and entitlements, watches platform health, and rolls features out behind flags.

**What success looks like:** a new tenant is live in minutes; usage and billing are
accurate; a bad release can be switched off without a deploy.

**What they fear:** being *able* to read a customer's confidential documents — that is a
liability, not a capability.

**Backend rights: 3 grants only** — `workflow:view:global`, `workflow:route:global`,
`audit:view:global`. This is deliberate and important: the platform admin is
**excluded from `CABINET_ACCESS_BYPASS_ROLES`, from every confidentiality tier list, and
from all document permissions.** The vendor cannot read customer documents. The
architecture note in `access-control.constants.ts` is explicit that any future support
access must be a separate, audited, time-boxed impersonation mechanism — not a standing
role grant.

> ⚠️ The frontend contradicts this. `usePermissions.ts:24` returns `true` for every
> permission check when the user has `schulltech_admin`. The entire `/platform` portal
> reads from `SEED` fixtures, so nothing enforces the real posture in the UI. See DRIFT-04.

---

## Epic A — Capture & Filing

> *Getting a document into the system, correctly labelled, in under a minute.*

---

### A1 — Upload a document into a cabinet · ✅ **Done**

> **As** Chika (Staff),
> **I want to** drag a scanned document onto the upload screen, confirm where it belongs
> and how sensitive it is, and file it,
> **so that** it stops being a loose file on my desktop and becomes a tracked record with
> an official reference number.

**Why this matters:** this is the entry point for every other capability in the product.
If filing is slow or ambiguous, people keep using shared drives and the system fails.

**Flow as built** (`src/app/(app)/upload/page.tsx`):
1. Drag-and-drop or browse. Multiple files queue independently.
2. Each file gets an "IDU" card (Intelligent Document Understanding) proposing a document
   type, cabinet and folder with a confidence percentage.
3. Chika reviews and corrects title, type, cabinet, folder, confidentiality, urgency.
4. On **File document**: SHA-256 is computed in-browser → the file uploads with a progress
   bar → `POST /api/v1/documents` creates the document and version 1 → toast → the card
   flips to "Filed" with a link to the document.

**Acceptance criteria**
- [x] Multiple files can be queued and filed independently
- [x] A SHA-256 checksum is computed client-side and stored with the version
- [x] Cabinet and folder dropdowns are populated from the live API (`useCabinets`, `useCabinetFolders`)
- [x] Folder options refresh when the cabinet changes
- [x] Backend generates a unique reference (`DOC-YYYYMMDD-HHmmss`)
- [x] Document + version 1 are created in a single transaction
- [x] Upload failure reverts the card to `ready` and surfaces the error
- [ ] ⚠️ **The IDU classification is hardcoded.** `IDU_GUESSES` in `upload/page.tsx` is a
      fixed array of four fake predictions cycled per file. No ML, no OCR, no backend call.
      The confidence badge is decoration.
- [ ] ⚠️ **The due date is collected and discarded.** The form has a `due` field; it is
      never sent to the API, and the backend `Document` model has no due-date column.
- [ ] ⚠️ **Custom metadata is not captured.** `PUT /documents/:id/metadata` exists and
      cabinets can define required fields, but the upload form never asks for them —
      so a cabinet with required metadata is filed incomplete every time.
- [ ] ⚠️ **2 MB ceiling** (`s3.service.ts` `maxFileSize`), and only PDF and image types
      actually upload despite a broader allowlist in `validateFile`.

**Known drift:** DRIFT-06 — the file lands in a third-party bucket the backend cannot read.

---

### A2 — Have the system read the document for me · ⬜ **Not built**

> **As** Chika,
> **I want** the system to extract the vendor name, invoice number and amount from a
> scanned invoice and pre-fill the metadata,
> **so that** I am confirming a machine's reading rather than typing from a page.

**Why this matters:** this is the difference between 60-second filing and 4-minute filing,
and it is the story the IDU card is *pretending* to tell.

**Current state:** the backend runs AWS Textract (`ocr.workers.ts`) purely for full-text
extraction into `search_vector`. It does not do form or key-value extraction
(`AnalyzeDocument` with `FeatureTypes: ['FORMS']`), and nothing feeds the result back to
the upload form. The frontend's confidence badges are fixtures.

**Acceptance criteria**
- [ ] Upload triggers extraction and returns candidate field values with per-field confidence
- [ ] Low-confidence fields are visually flagged for human confirmation
- [ ] The user can accept, correct or reject each suggestion
- [ ] Corrections are recorded so accuracy can be measured over time

**Blocked by:** DRIFT-06, plus multi-page Textract support (`StartDocumentTextDetection`).

---

### A3 — Organise cabinets into folders · ✅ **Done**

> **As** Bola (Client Admin),
> **I want to** create a folder hierarchy inside each cabinet,
> **so that** the filing structure mirrors how my organisation actually thinks about its
> records, and staff don't have to guess.

**Acceptance criteria**
- [x] Folders can be created inside a cabinet (`POST /cabinets/:cabinetId/folders`)
- [x] Folders can be nested (`parentId` self-relation on the `Folder` model)
- [x] Folders can be renamed and deleted (`PATCH` / `DELETE /folders/:id`)
- [x] Folder listing shows document counts (`_count` include)
- [ ] ⚠️ List is capped at `take: 100` with no pagination — a cabinet with more than 100
      folders silently truncates
- [ ] ⚠️ **A document's `folderId` is never checked against its `cabinetId`.** A document in
      Cabinet A can be filed into a folder belonging to Cabinet B, crossing the boundary
      that the whole access model depends on. Backend fix.

---

### A4 — Define custom metadata per cabinet · 🟨 **Partial** (backend only)

> **As** Bola,
> **I want to** define that the Invoices cabinet requires "Vendor Name", "Invoice Number"
> and "Contract Value",
> **so that** every invoice is captured consistently and those fields become searchable.

**Current state:** the backend is complete — `CabinetMetadataField` supports
`text | number | date | select | boolean`, required flags, select options and display
order, with full CRUD at `POST/PATCH/DELETE /cabinets/:id/metadata-fields`. Values are
type-validated and normalised on write (`normalizeMetadataValue`).

**There is no UI.** The Cabinet Designer at `/admin/cabinets` does not expose metadata
fields at all.

**Acceptance criteria**
- [x] Backend: fields definable per cabinet with all five types
- [x] Backend: values validated against the field type on write
- [x] Backend: required-field enforcement on update
- [ ] Admin UI to add/edit/reorder/delete fields
- [ ] Upload form renders the target cabinet's fields
- [ ] Document detail renders and edits them
- [ ] ⚠️ Backend bug: sending all-null values to clear metadata silently no-ops
      (`normalized.length === 0` short-circuits the write)

---

## Epic B — Retrieval & Search

---

### B1 — Find a document by its content · 🟨 **Partial**

> **As** Chika,
> **I want to** type "Meridian Interiors" and find the invoice even though that phrase is
> only inside the scanned page,
> **so that** I can answer a customer's question while they are still on the phone.

**Why this matters:** full-text search over OCR'd content is the single feature that makes
a scanned archive useful rather than a digital shoebox.

**Current state:** the plumbing is genuinely good. `documents.repository.search()` uses
Postgres `websearch_to_tsquery` against a GIN-indexed `tsvector`, ranks with `ts_rank`,
and applies confidentiality-tier and RBAC-scope filters **inside the SQL** rather than
after the fact. The frontend has a working search page with filters.

**It returns nothing, because the index is never built.** `search_vector` is populated by
a BullMQ job that is only enqueued from the **OCR success path**, and OCR always fails
(DRIFT-06). Documents are visible via `GET /documents` and invisible via
`GET /documents/search` — the two views disagree and the discrepancy looks like flakiness.

**Acceptance criteria**
- [x] Full-text search over title + OCR text + metadata values
- [x] Results ranked by relevance
- [x] Confidentiality tier filtering applied in SQL
- [x] RBAC scope (`own`/`department`/`global`) applied in SQL
- [x] Paginated
- [ ] 🔴 The index is actually populated (blocked on DRIFT-06)
- [ ] Re-index on title change, metadata update, and version restore — none of these
      currently re-enqueue, so the index drifts even once it works
- [ ] Index by title regardless of OCR outcome, so a failed OCR never makes a document
      unfindable
- [ ] Search-term highlighting in results
- [ ] `search.executed` audit event (defined in the schema, never written)

---

### B2 — Browse the filing structure · ✅ **Done**

> **As** Chika,
> **I want to** navigate cabinets and folders the way I would walk to a filing cabinet,
> **so that** I can find things by structure when I can't remember the words.

**Acceptance criteria**
- [x] Cabinet list with document and folder counts (`/staff/cabinets`)
- [x] Drill into folders; documents listed per folder
- [x] Status, urgency and confidentiality badges on each row
- [x] Backend filters the list by RBAC scope and confidentiality tier
- [ ] ⚠️ **Cabinet access grants are not enforced on reads.** `requireCabinetAccess` is
      only applied to write routes. `GET /cabinets`, `GET /cabinets/:id`, `GET /documents`
      and `GET /documents/:id` never consult the `CabinetAccess` table — so a user with
      `cabinet:view:global` sees every cabinet in the tenant regardless of grants. This is
      the need-to-know model not being enforced.
- [ ] ⚠️ Cabinet list is capped at 100 with no pagination

---

### B3 — Open a document and see everything about it · 🟨 **Partial**

> **As** any authenticated user,
> **I want** one screen showing the document, its metadata, its version history, its
> workflow position and its activity,
> **so that** I don't have to assemble the picture from four places.

**Current state:** `/doc/[id]` is the most complete screen in the product — 776 lines,
wired to eight different hooks. Preview, metadata, versions, workflow state, comments,
signatures, actions.

**Acceptance criteria**
- [x] Document loads from `GET /documents/:id`
- [x] Metadata, versions, cabinet and folder context render
- [x] Confidentiality enforced server-side by `requireConfidentiality('view')`
- [x] Checkout / check-in from this screen
- [x] Edit title, type, folder, confidentiality, urgency, status
- [ ] 🔴 **Comments 404.** `POST /documents/:id/comments` does not exist (DRIFT-08).
- [ ] 🔴 **Signatures 404.** `POST /documents/:id/signatures` does not exist (DRIFT-08).
- [ ] 🔴 **The activity timeline is fake** — it reads `SEED.audit` (DRIFT-11).
- [ ] ⚠️ **There is no download or preview endpoint.** The backend has no route that
      serves file bytes or issues a presigned GET. The preview pane renders a placeholder.
- [ ] ⚠️ The file is `// @ts-nocheck` — type safety is off for the whole page.

---

### B4 — Download, print or export a document · ⬜ **Not built**

> **As** David (Supervisor),
> **I want to** download a contract to read offline, subject to my clearance,
> **so that** I can review it on a flight — and so the system records that I took a copy.

**Why this matters:** download is where confidentiality controls earn their keep, and it
is the most audit-sensitive action in the product.

**Current state:** the backend has an unusually well-designed permission model for exactly
this — `CONFIDENTIALITY_ACCESS` defines per-tier, per-action allowlists for `view`,
`export`, `print` and `download`, with `restricted` and `top_secret` denied for all three
non-view actions. **All of it is dead code.** All twelve call sites use
`requireConfidentiality('view')`; there is no download, print or export route; and no
`document:download` / `export` / `print` permissions are seeded.

**Acceptance criteria**
- [ ] `GET /documents/:id/download` returning a short-lived presigned URL
- [ ] Gated by `requireConfidentiality('download')`
- [ ] Writes a `document.downloaded` audit entry with actor, IP and user agent
- [ ] Print and export paths gated by their own actions
- [ ] `restricted`-tier documents are view-only, per the existing policy table

---

## Epic C — Routing, Review & Approval

---

### C1 — Route a document into an approval workflow · 🟥 **Broken**

> **As** Chika,
> **I want to** send a filed invoice into the "Standard Invoice Approval" workflow,
> **so that** it reaches my supervisor with a deadline attached instead of an email that
> might be missed.

**Why this matters:** this is the hinge of the entire product. Without it, EDMS is a
filing cabinet, not a workflow system.

**Current state:** **the UI call 404s.** `workflowInstancesService.start()` posts to
`POST /workflow-instances/start`, which matches no backend route. The backend's actual
contract is a two-call sequence: `POST /workflow-instances` to create, then
`POST /workflow-instances/:id/start` to begin execution. See DRIFT-09.

**Acceptance criteria**
- [x] Backend: instance creation validates the document exists and the definition is `published`
- [x] Backend: `start` creates the first stage's task(s), computes `stageDueAt` from the
      stage's SLA hours, and writes a `WorkflowHistory` row
- [x] Backend: role-pool assignment supported (`assignedRoleId`) as well as direct assignment
- [ ] 🔴 Frontend calls the correct two-step sequence
- [ ] Workflow picker on the document detail screen, filtered to `published` definitions
- [ ] ⚠️ **No authorization on any of this.** `requirePermission` is absent from all 23
      workflow routes, and neither `definitions.service` nor `instances.service` checks
      roles. Any authenticated user can start, hold, resume or close any instance
      (DRIFT-05).
- [ ] ⚠️ No notification is sent to the new assignee (DRIFT-10)

---

### C2 — Work my task queue · ✅ **Done**

> **As** David (Supervisor),
> **I want** a single prioritised list of everything waiting on me, with the most urgent
> and most overdue at the top,
> **so that** I work the right thing first instead of whatever is most recent.

**Current state:** genuinely well built on both sides. `tasks.repository` prioritises by
document urgency then due date; `tasks.service` correctly resolves both direct assignment
and role-pool assignment, and honours active delegations.

**Acceptance criteria**
- [x] `GET /tasks` returns tasks assigned to me directly **or** to a role I hold
- [x] Oversight roles can request `scope=all` (`TASK_VIEW_ALL_ROLES`)
- [x] Prioritised by urgency then due date
- [x] Due/overdue state visible per row
- [x] Paginated
- [x] Frontend: `/staff/tasks`, `/supervisor/approvals` both live
- [ ] ⚠️ Badge counts in the sidebar are computed from `SEED.documents`, not the task API
      (`useNavigation.ts` `myOpenTasks`, `approvalsCount` — the latter is hardcoded to
      `assignee === 'u-david'`)

---

### C3 — Approve, reject or request changes · ✅ **Done**

> **As** David,
> **I want to** approve a document with a note, or send it back with a reason,
> **so that** the decision and its justification live with the document permanently.

**Acceptance criteria**
- [x] `POST /tasks/:id/action` with `approve | reject | review | request_changes | close | delegate`
- [x] Only the assignee, a role-pool member, or a `TASK_REASSIGN_ROLES` holder may act
- [x] Advances the instance to the next stage and recomputes `stageDueAt`
- [x] Writes a `WorkflowHistory` row with `fromStage`, `toStage`, actor, note and
      `elapsedSeconds`
- [x] Closing the final stage closes the instance
- [x] Notes are captured and stored
- [ ] ⚠️ No notification to the next assignee or the originator (DRIFT-10)
- [ ] ⚠️ No `audit_entries` row — only workflow history, which is a different table with a
      different purpose and no hash chain (DRIFT-11)

---

### C4 — Delegate my work while I'm away · 🟨 **Partial** (backend only)

> **As** David,
> **I want to** hand my approvals to a colleague for the two weeks I'm on leave,
> **so that** nothing stalls behind an empty desk.

**Current state:** the backend is complete and thoughtful — `Delegation` with
`startsAt`/`endsAt`, an optional JSON `scope` limiting it to particular cabinets or
workflows, an `isActive` flag, and full CRUD at `GET/POST /delegations` and
`POST /delegations/:id/end`. `tasks.service` already resolves delegations when listing and
actioning tasks.

**There is no UI whatsoever.** No page, no service file, no hook.

**Acceptance criteria**
- [x] Backend: date-bounded delegation with optional cabinet/workflow scoping
- [x] Backend: delegates see and can action delegated tasks
- [x] Backend: `DELEGATION_VIEW_ALL_ROLES` / `DELEGATION_MANAGE_ALL_ROLES` govern oversight
- [ ] Any UI at all — create, list, end
- [ ] Visual marker on a task showing it arrived by delegation
- [ ] Notification to the delegate when a delegation activates

---

### C5 — Design an approval workflow · 🟨 **Partial**

> **As** Bola (Client Admin),
> **I want to** define the stages an invoice passes through, who acts at each stage and how
> long they have,
> **so that** the process is enforced by the system rather than remembered by people.

**Current state:** `/admin/workflows` is a substantial 493-line designer wired to the real
`/workflows` endpoints. Definitions are versioned JSON with `draft → published → archived`
lifecycle.

**Acceptance criteria**
- [x] Create, edit, publish and archive definitions
- [x] Stages with sequential transitions, SLA hours and role/user assignment
- [x] Published definitions are immutable; edits require a new version
- [ ] 🔴 **No authorization.** Any authenticated user can publish or archive any definition
      (DRIFT-05). This is the highest-severity issue in either codebase.
- [ ] ⚠️ `// @ts-nocheck` on the page
- [ ] Parallel and conditional branches — Phase 1 is explicitly sequential-only
- [ ] Visual graph editor; today it is a form

---

## Epic D — Version Control & Custody

---

### D1 — Check out a document before editing · ✅ **Done**

> **As** Chika,
> **I want to** lock a document while I revise it,
> **so that** a colleague doesn't overwrite my work with a parallel edit.

**Acceptance criteria**
- [x] `POST /documents/:id/checkout` creates a `CheckoutLock` and flips `isCheckedOut`,
      atomically in one transaction
- [x] A second checkout attempt returns 409
- [x] Optional `expectedReturnAt` so others know when it frees up
- [x] `POST /documents/:id/checkin` releases both, atomically
- [x] Only the lock holder can check in
- [x] Uploading a version while someone else holds the lock is rejected (409)
- [ ] ⚠️ Supervisors and records officers cannot force-release a stale lock — there is an
      explicit `TODO` in `documents.service.ts` for this. A user who locks a document and
      goes on leave blocks it indefinitely.
- [ ] No lock-expiry job, despite `expectedReturnAt` being captured

---

### D2 — Keep every version · ✅ **Done**

> **As** Femi (Auditor),
> **I want** every revision retained with its uploader, timestamp and checksum,
> **so that** I can prove what a document said on a given date.

**Acceptance criteria**
- [x] Each upload creates a numbered `DocumentVersion` (unique on `documentId, versionNumber`)
- [x] SHA-256 checksum stored and indexed (enables duplicate detection)
- [x] `currentVersionId` on the document points at the head
- [x] Version list and single-version fetch endpoints, wired to the UI
- [ ] ⚠️ Duplicate detection is not implemented despite the checksum index existing
- [ ] No side-by-side version diff

---

### D3 — Roll back to a previous version · 🟨 **Partial** (backend only)

> **As** David,
> **I want to** restore the version from before a bad edit,
> **so that** a mistake is a two-click recovery rather than a re-scan.

**Current state:** `POST /documents/:id/versions/:versionId/restore` works and is correctly
modelled — it creates a **new** version pointing at the old file rather than mutating
history. **No UI calls it.**

**Acceptance criteria**
- [x] Backend: restore creates a new version; history is never rewritten
- [x] Backend: blocked if another user holds the lock
- [ ] A restore button in the version history panel
- [ ] Confirmation dialog naming which version is being restored
- [ ] ⚠️ Restore does not re-enqueue search indexing, so the index goes stale

---

## Epic E — Access Control & Confidentiality

---

### E1 — Classify a document by sensitivity · 🟨 **Partial**

> **As** Chika,
> **I want to** mark a document Confidential when it contains customer financial data,
> **so that** it is invisible to people who have no business reading it.

**Current state:** five tiers (`public → internal → confidential → restricted → top_secret`),
enforced by `requireConfidentiality` on single-document routes and by SQL filters on list
and search. The design is sound.

**Acceptance criteria**
- [x] Tier settable at upload and editable later
- [x] Enforced on read via middleware and in list/search SQL
- [x] `confidential` readable by supervisor, management, client_admin, internal_auditor
- [x] `restricted` readable by client_admin only
- [ ] 🔴 **Anyone can set any tier.** No check that the writer is cleared for the tier they
      are assigning. A `staff` user can upload at `top_secret` — and since
      `TOP_SECRET_TIER_ROLES` is empty by design, that document becomes permanently
      unreadable **by everyone, including `client_admin`**. There is no recovery path.
- [ ] ⚠️ The doc-detail edit form offers `Top Secret` because it is driven by
      `SEED.policies.confidentiality`; the upload form correctly omits it. Inconsistent.

---

### E2 — Grant cabinet-level access · 🟨 **Partial** (backend only)

> **As** Bola,
> **I want to** give the Legal team view access to the Contracts cabinet and upload access
> to nobody else,
> **so that** need-to-know is enforced by structure, not by trust.

**Current state:** `CabinetAccess` supports grants to a **role** or an **individual user**,
with a six-level permission hierarchy (`view < upload < edit < route < export < delete`).
Full CRUD exists at `GET/POST /cabinets/:id/access` and
`DELETE /cabinets/:id/access/:grantId`.

**Two problems:**

1. **No UI exists to manage grants.** The model is unreachable from the product.
2. **Grants are not enforced on reads.** `requireCabinetAccess` appears only on write
   routes. Cabinet listing, cabinet detail, document listing, document detail and search
   never consult the table. A user with `cabinet:view:global` sees everything.

**Acceptance criteria**
- [x] Backend: role and user grants with a permission hierarchy
- [x] Backend: `client_admin` bypasses grants by design
- [x] Backend: enforced on document upload, edit, delete and routing
- [ ] 🔴 Enforced on **read** paths — the whole point of the model
- [ ] Admin UI to view, grant and revoke
- [ ] "Who can see this cabinet?" view for auditors (`cabinet_access:view` is already
      granted to `internal_auditor` with no endpoint to use it)

---

### E3 — Assign users to roles · ✅ **Done**

> **As** Bola,
> **I want to** give a new joiner the Staff role and place them in Operations,
> **so that** they get exactly the access their job requires on day one.

**Acceptance criteria**
- [x] `POST /users` creates a user with bcrypt-hashed password, department and roles
- [x] `POST /users/:id/roles` and `DELETE /users/:id/roles/:roleId` manage assignments
- [x] Department and role existence validated on create and update
- [x] Multiple roles per user; the most permissive scope wins at request time
- [x] Frontend `/admin/users` is fully wired (423 lines)
- [ ] ⚠️ Admin sets an initial password directly — there is **no invite flow**, no email,
      no first-login password change, no reset. See story I2.

---

### E4 — Edit the role permission matrix · 🟨 **Partial**

> **As** Bola,
> **I want to** adjust exactly what each role can do,
> **so that** the system matches my organisation's separation-of-duties policy rather than
> a vendor's assumptions.

**Current state:** `PUT /roles/:id/permissions` exists and works. The frontend has a role
matrix editor — but it writes to **`SEED.rolesMatrix` in localStorage** via
`updateRoleMatrix`, not to the API.

**Acceptance criteria**
- [x] Backend: `resource:action:scope` triples assignable per role
- [x] Backend: scopes `global | department | own`
- [x] Backend: permissions re-read from the DB on every request, so changes take effect
      immediately without re-login
- [ ] 🔴 The UI matrix editor calls the API instead of the local store
- [ ] Guard rails preventing an admin from removing their own admin rights
- [ ] `role.permissions_updated` audit entry

---

## Epic F — Oversight, SLA & Workload

---

### F1 — See my team's workload · 🟨 **Partial**

> **As** David,
> **I want to** see how many open items each team member is carrying,
> **so that** I can rebalance before someone drowns.

**Acceptance criteria**
- [x] `/supervisor/workload` renders per-person counts from live `/documents` and `/users`
- [x] Reassignment via `PATCH /tasks/:id/reassign`, gated by `TASK_REASSIGN_ROLES`
- [ ] ⚠️ Counts are computed client-side by walking every page of `/documents`
      (`fetchAllPages`) — up to 50 sequential requests. No aggregation endpoint exists.
- [ ] ⚠️ Some panels still read `SEED.documents` rather than the API

---

### F2 — Catch ageing work before it breaches · 🟨 **Partial**

> **As** David,
> **I want to** see what is approaching its deadline,
> **so that** I intervene while it still matters.

**Current state:** the backend SLA engine is real and well built. `sla-breach.worker.ts`
runs on a BullMQ scheduler every `SLA_RECONCILE_INTERVAL_MS` (default 5 min); `sla.service`
finds tasks within `SLA_WARNING_HOURS` (default 4) of their deadline, creates `SlaBreach`
rows of type `warning` or `escalation`, escalates overdue tasks, writes history, and
resolves breaches that are no longer active. A unique constraint on `(taskId, breachType)`
prevents duplicate alerts.

**And nobody is ever told.** The worker writes history rows and stops. There is no
notification module, so `sla.warning` and `sla.breach` — both defined in
`NOTIFICATION_TYPES` — are never delivered to anyone. **The SLA engine runs into a void.**

**Acceptance criteria**
- [x] Scheduled reconciliation with warning and escalation tiers
- [x] Duplicate-alert suppression
- [x] Auto-escalation of overdue tasks
- [x] Breach resolution when the task completes
- [ ] 🔴 Anyone is actually notified (DRIFT-10)
- [ ] `/supervisor/bottlenecks` reads real SLA data rather than computing ageing from
      `SEED` documents
- [ ] Configurable SLA thresholds per workflow stage rather than one global env var

---

### F3 — Reassign work · ✅ **Done**

> **As** David,
> **I want to** move a task from one person to another with a reason,
> **so that** absence or overload doesn't stall a document.

**Acceptance criteria**
- [x] `PATCH /tasks/:id/reassign`, restricted to `TASK_REASSIGN_ROLES`
      (supervisor, client_admin, schulltech_admin)
- [x] Writes a history row recording the reassignment
- [x] UI at `/supervisor/workload`
- [ ] ⚠️ No notification to either the old or new assignee

---

## Epic G — Executive Reporting

---

### G1 — Compare departments · 🟨 **Partial**

> **As** Eniola (Management),
> **I want to** see throughput, backlog and SLA compliance side by side across departments,
> **so that** I can direct attention where it is needed.

**Current state:** `/management/departments` and `/management` are wired to real endpoints
— but every number is computed **in the browser**. `useAllDocuments`, `useAllTasks` and
`useAllWorkflowInstances` each call `fetchAllPages`, walking up to 50 pages of 100 records,
then `managementAggregation.ts` does department rollups, month bucketing and SLA maths in
JavaScript.

The utility's own header documents this honestly as an *"INTERIM STOPGAP — not a substitute
for real server-side aggregation"* and asks to be deleted once endpoints exist.

**Acceptance criteria**
- [x] Per-department document, task and instance counts
- [x] CSV export
- [x] Department tree flattened correctly, including nested children
- [ ] 🔴 Server-side aggregation endpoints. The backend has **no** statistics, reporting or
      aggregation routes of any kind.
- [ ] Bounded response time as data grows — today it degrades linearly with tenant size

---

### G2 — See trends over time · 🟨 **Partial**

> **As** Eniola,
> **I want to** see whether turnaround is improving quarter on quarter,
> **so that** I can tell whether a process change worked.

**Acceptance criteria**
- [x] `/management/trends` renders month-bucketed line charts
- [x] Buckets derived from real `createdAt` / `closedAt` timestamps
- [ ] 🔴 Computed client-side; same scaling problem as G1
- [ ] No forecasting despite the page being titled "Trends & Forecast"

---

### G3 — Export a board pack · 🟨 **Partial**

> **As** Eniola,
> **I want to** export what I'm looking at as CSV,
> **so that** I can drop it into a board deck without asking anyone.

**Acceptance criteria**
- [x] `exportCsv` utility, wired on management and supervisor pages
- [x] Exports the current filtered view
- [ ] PDF export
- [ ] Scheduled recurring reports by email
- [ ] Export is not audit-logged (it should be — it is data leaving the system)

---

## Epic H — Audit & Compliance

> ⚠️ **This entire epic is currently a mock on both sides.** It is the largest single gap
> in the product, and the one most at odds with its positioning.

---

### H1 — See a complete, tamper-evident activity trail · 🟥 **Mock**

> **As** Femi (Auditor),
> **I want** an append-only record of every view, edit, approval, download and permission
> change,
> **so that** I can reconstruct what happened and prove the record wasn't altered.

**Current state:**
- The **schema** is well designed: `audit_entries` with `prevHash` / `entryHash` forming a
  SHA-256 hash chain, documented as INSERT-only via a restricted Postgres role, indexed for
  object history, actor timeline and action filtering, and intended to be range-partitioned
  by month.
- The architecture doc mandates `AuditService.log()` on every create, update, delete, view
  and download.
- **`src/middlewares/audit.middleware.ts` is a 0-byte file.** There is no audit module.
  There are **zero** references to `auditEntry` anywhere in `src/`. Nothing has ever been
  written to that table.
- The frontend's `/auditor/trail` and `/admin/audit` render `SEED.audit`.
  `useCreateAuditLog()` resolves after a 400 ms `setTimeout` and does nothing.

**Acceptance criteria**
- [ ] Every mutating service writes an audit entry
- [ ] Document view and download are logged (the highest-value events for compliance)
- [ ] Entries capture actor, actor type, action, object type, object ID, before/after diff,
      IP address and user agent
- [ ] `entryHash` chains to `prevHash`; a verification endpoint proves chain integrity
- [ ] The database role used by the app cannot `UPDATE` or `DELETE` the table
- [ ] `GET /audit` with filters by actor, object, action and date range —
      **`internal_auditor` is already granted `audit:view:global` and there is no endpoint
      to use it**
- [ ] Monthly range partitioning as designed

---

### H2 — Track findings to closure · 🟥 **Mock**

> **As** Femi,
> **I want to** raise a finding against a document or process, assign an owner and a due
> date, and track it,
> **so that** issues are resolved rather than noted.

**Current state:** `/auditor/findings` is a 367-line screen operating entirely on
`SEED.findings` via `addFinding` / `updateFinding`. **There is no `Finding` model in the
Prisma schema and no endpoint.** Everything a user does here is lost on
`localStorage.clear()`.

**Acceptance criteria**
- [ ] `Finding` model: severity, status, owner, due date, linked document/workflow, evidence
- [ ] CRUD endpoints
- [ ] Findings visible to management — `/management/findings` is a 7-line **re-export**
      of `/auditor/findings`, so management sees the same mock screen, not a
      management-oriented view
- [ ] Notification to the assigned owner
- [ ] Ageing and overdue-finding reporting

---

### H3 — Verify separation of duties · ⬜ **Not built**

> **As** Femi,
> **I want** the system to prevent one person both approving and auditing the same
> document,
> **so that** the control is structural rather than a policy people remember.

**Current state:** SoD is described in `../../out/DOCUMENTATION.md` as a platform feature.
**No SoD logic exists in either codebase.** There is no rule preventing a user holding both
`supervisor` and `internal_auditor`, and nothing checks actor identity across workflow
stages.

**Acceptance criteria**
- [ ] Configurable mutually-exclusive role pairs
- [ ] Workflow stages cannot be actioned by the same user who actioned the previous stage
      (where configured)
- [ ] SoD violations surfaced as findings
- [ ] Attempted violations logged

---

## Epic I — Tenant Administration

---

### I1 — Set up the organisation structure · ✅ **Done**

> **As** Bola,
> **I want to** define our department hierarchy,
> **so that** document scoping and reporting reflect how we're actually organised.

**Acceptance criteria**
- [x] `Department` with self-referencing parent/child hierarchy
- [x] Full CRUD, wired to `/management/departments`
- [x] Users assigned to departments; drives `department`-scoped permissions
- [x] Cabinets assignable to departments
- [ ] ⚠️ Capped at `take: 200`, no pagination
- [ ] No cycle detection — a department can in principle be made its own ancestor

---

### I2 — Onboard a new employee · 🟨 **Partial**

> **As** Bola,
> **I want to** invite a new joiner by email and have them set their own password,
> **so that** I never handle their credentials.

**Current state:** `POST /users` creates the account with an admin-supplied password. That
is the whole flow.

**Missing, and each is a genuine security gap:**
- No invite token, no email, no magic link
- No forced password change on first login
- No self-service password reset
- No password-complexity policy (Zod validates a minimum length only)
- No account lockout or rate limiting on `POST /auth/login` — unlimited password guessing
- No SSO, though `User.passwordHash` is nullable specifically to accommodate it in Phase 4

**Acceptance criteria**
- [x] Admin can create a user with department and roles
- [ ] `POST /users/invite` issuing a signed, expiring token
- [ ] Email delivery (no mail transport exists in the backend at all)
- [ ] First-login password set
- [ ] Password reset
- [ ] Login rate limiting

---

### I3 — Configure retention and confidentiality policy · 🟥 **Mock**

> **As** Bola,
> **I want to** set how long each cabinet's documents are kept and what happens at expiry,
> **so that** we comply with our regulator's retention schedule automatically.

**Current state:** the `RetentionPolicy` model exists (`retentionDays`, `actionOnExpiry` of
`archive | delete | flag_for_review`) and cabinets can reference one. **There is no
endpoint, no UI wiring and no job that ever applies it.** `/admin/policies` reads
`SEED.policies`.

**Acceptance criteria**
- [x] Schema exists
- [ ] CRUD endpoints
- [ ] Retention enforcement job (nothing scans for expired documents)
- [ ] `/admin/policies` writes to the API
- [ ] Legal-hold override preventing deletion during litigation
- [ ] Notification before expiry action

---

### I4 — Brand the system · 🟥 **Mock**

> **As** Bola,
> **I want** the portal to carry our logo and colours,
> **so that** staff experience it as our system, not a vendor's.

**Current state:** `/admin/branding` is a 397-line editor writing to `SEED.branding` in
localStorage. `AppShell` genuinely applies the values as CSS custom properties, including a
`lighten()` function that keeps brand colours legible in dark mode — so **it works
beautifully and persists nowhere.** No `Branding` model, no endpoint.

**Acceptance criteria**
- [x] Live theming: primary, primaryLight, accent, app name
- [x] Dark-mode-aware colour adjustment
- [ ] `Branding` model and endpoints
- [ ] Logo upload
- [ ] Branding applied to emails and exported PDFs

---

## Epic J — Communication & Circulars

> ⚠️ **Entirely mock.** No model, no endpoint, no persistence.

---

### J1 — Broadcast a circular · 🟥 **Mock**

> **As** Bola,
> **I want to** send a policy update to all staff and require acknowledgement,
> **so that** I have proof everyone was told.

**Current state:** `/admin/circulars` (263 lines) and `/circulars` (107 lines) are fully
built against `SEED.circulars`. `circularsService` is four `setTimeout` stubs. There is no
`Circular` model in Prisma.

**Acceptance criteria**
- [ ] `Circular` model: title, body, audience, urgency, `requiresAck`, `publishedAt`
- [ ] CRUD + publish endpoints
- [ ] Audience targeting by role, department or explicit user list
- [ ] Fan-out to notifications on publish
- [ ] `POST /circulars/:id/ack`
- [ ] Acknowledgement compliance dashboard for the admin
- [ ] `circular.acknowledged` audit entry

---

### J2 — Acknowledge a circular · 🟥 **Mock**

> **As** Chika,
> **I want to** mark a circular as read,
> **so that** my compliance obligation is discharged and recorded.

**Acceptance criteria**
- [x] UI exists (`markCircularAck` in the store)
- [ ] Persisted anywhere
- [ ] Pending-acknowledgement badge driven by real data (currently `SEED`)

---

### J3 — Be notified when something needs me · 🟥 **Broken**

> **As** any user,
> **I want** an in-app notification when a task is assigned to me, an SLA is about to
> breach, or a circular needs acknowledging,
> **so that** I don't have to poll the system to find out I'm blocking someone.

**Current state:** `notifications.service.ts` calls four endpoints for real via
`apiClient`. **None of them exist.** `src/modules/notifications/` is an empty directory.
Compounding it, the backend has no JSON 404 handler, so Express returns an **HTML** body
that axios then fails to parse — the failure surfaces as a confusing parse error rather
than a clean 404.

The backend defines 16 `NOTIFICATION_TYPES`, both channels (`in_app`, `email`), a
`Notification` model and a `NotificationPreference` model with digest mode. All unused.

**Acceptance criteria**
- [ ] `GET /notifications` (paginated, filterable by read state)
- [ ] `PATCH /notifications/:id/read`, `POST /notifications/mark-all-read`
- [ ] Notifications emitted on task assignment, completion, reassignment, delegation,
      escalation, SLA warning/breach, and workflow transitions
- [ ] Unread badge driven by the API rather than `SEED`
- [ ] Email channel (no mail transport exists)
- [ ] `NotificationPreference` respected, including digest mode
- [ ] Add a JSON 404 handler to `app.ts` so missing routes fail legibly

---

## Epic K — Platform Operations

> ⚠️ **Entirely mock.** Consistent with the architecture: platform-level tables
> (`tenants`, `usage_events`, `platform_audit_log`) are explicitly documented as living in
> a **separate control-plane database** that has not been built.

---

### K1 — Provision a tenant · 🟥 **Mock**

> **As** Adaeze (Platform Admin),
> **I want to** create a new customer organisation with its own isolated database,
> **so that** onboarding is minutes rather than a manual DBA task.

**Current state:** `/platform` (347 lines) manages `SEED.tenants` in localStorage. The
backend runs in **single-tenant mode by design** — one database, no `tenant_id` columns
anywhere, no tenant-resolution middleware. `docs/edms_architecture.md` §1–2 describes the
"True Silo" target (one database per tenant) and states plainly that the migration cost is
one line per controller *because* `db` is passed as a parameter everywhere rather than
imported. That discipline is genuinely maintained in the code.

**Acceptance criteria**
- [ ] Control-plane database with `tenants`, `usage_events`, `platform_audit_log`
- [ ] `resolveTenant` middleware mapping subdomain → `PrismaClient`
- [ ] Automated per-tenant database provisioning and migration
- [ ] Tenant suspend / resume
- [ ] Every controller passes `req.db` instead of the imported singleton

---

### K2 — Manage plans and entitlements · 🟥 **Mock**

> **As** Adaeze, **I want to** define commercial plans with feature and usage limits,
> **so that** entitlements are enforced by the system.

**Acceptance criteria:** none met. `/platform/plans` is `SEED.plans`. No model, no endpoint,
no enforcement anywhere.

---

### K3 — Meter usage and bill · 🟥 **Mock**

> **As** Adaeze, **I want** accurate storage and seat metering per tenant,
> **so that** invoices are defensible.

**Current state:** `/platform/billing` is `SEED`. The only real ingredient is
`DocumentVersion.fileSize`, whose schema comment says it exists "for storage metering" —
nothing aggregates it.

---

### K4 — Feature flags · 🟥 **Mock**

> **As** Adaeze, **I want to** enable a feature for one tenant before all,
> **so that** a bad release is a toggle, not a rollback.

**Current state:** ⚠️ **`/platform/flags` renders the wrong page entirely** — it is a
7-line re-export of `/platform/sysconfig` (Platform Health). Clicking "Feature Flags" in
the sidebar shows the health screen. `updateFeatureFlag` exists in the store and writes to
`SEED`, but no screen calls it. No model, no endpoint, no evaluation anywhere.

---

### K5 — Platform health · 🟥 **Mock**

> **As** Adaeze, **I want** queue depth, worker status and error rates,
> **so that** I know a problem before a customer reports it.

**Current state:** `/platform/sysconfig` is `SEED`. The backend has `GET /health` returning
`{status:'ok', timestamp}` and nothing else — no DB probe, no Redis probe, no queue depth,
no metrics endpoint, no structured request logging (`logger` exists and is only called from
error paths and workers).

---

## 14. Cross-cutting non-functional stories

### N1 — The system tells me why something failed · 🟨 Partial
- [x] Consistent `ApiResponse` envelope with `success`, `message`, `code`
- [x] Zod validation returns per-field errors with a 422
- [x] Prisma errors mapped to sensible HTTP codes (P2002→409, P2025→404, P2003→400)
- [ ] 🔴 **No JSON 404 handler** — unmatched routes return Express's default HTML
- [ ] No request correlation ID to tie a user-visible error to a server log line

### N2 — The system is observable · ⬜ Not built
- [x] JSON-structured `logger`
- [ ] Request logging middleware (nothing logs an incoming request)
- [ ] Correlation IDs
- [ ] Metrics, tracing, error aggregation (no Sentry or equivalent)
- [ ] Health check that actually probes Postgres, Redis and queue depth

### N3 — Changes are safe to ship · 🟨 Partial
- [x] CI runs typecheck, Prettier, ESLint, `ls-lint`, and a module-structure check
- [x] Commitlint + Husky pre-commit hooks
- [x] Strict TypeScript, ESM, path aliases
- [ ] 🔴 **Zero tests in either codebase.** `npm test` is the default error stub.
- [ ] Three frontend files are `@ts-nocheck`, including the two most complex pages
      (`doc/[id]`, `admin/workflows`) and `search`
- [ ] No E2E tests, no API contract tests, no seeded test database

### N4 — The system stays fast as data grows · 🟨 Partial
- [x] Considered indexing throughout the Prisma schema, aimed at named access patterns
- [x] Document, task, user, workflow and history lists are paginated
- [ ] Cabinets, folders, roles and departments are **not** paginated — hardcoded
      `take: 100`/`200` caps that silently truncate
- [ ] Management dashboards fetch up to 5,000 records into the browser to compute
      aggregates (DRIFT-07)
- [ ] No caching layer; Redis is present but used only as a BullMQ backend

### N5 — Secrets and sessions are handled properly · 🟨 Partial
- [x] Refresh token in an HttpOnly cookie; access token separate; distinct signing secrets
- [x] Cross-tab refresh coordination
- [x] Passwords bcrypt-hashed
- [x] Env validated once at startup with Zod; process exits on invalid config
- [ ] 🔴 No refresh-token revocation or rotation — a leaked token is valid for 7 days
- [ ] 🔴 No rate limiting on login
- [ ] No `helmet` or comparable security headers
- [ ] No request body size limit on `express.json()`
- [ ] Access-token cookie TTL (1 day) disagrees with the JWT TTL (15 min)

---

## 15. Story map summary

| Epic | ✅ Done | 🟨 Partial | 🟥 Mock | ⬜ Not built | Verdict |
|---|---|---|---|---|---|
| A — Capture & Filing | 2 | 1 | 0 | 1 | Core works; enrichment missing |
| B — Retrieval & Search | 1 | 2 | 0 | 1 | Search built but returns nothing |
| C — Routing & Approval | 2 | 2 | 1 | 0 | Task execution solid; **routing broken**, **unauthorized** |
| D — Version & Custody | 2 | 1 | 0 | 0 | Strongest area of the product |
| E — Access Control | 1 | 3 | 0 | 0 | Well designed; under-enforced on reads |
| F — Oversight & SLA | 1 | 2 | 0 | 0 | Engine real; **nobody is notified** |
| G — Executive Reporting | 0 | 3 | 0 | 0 | Works today; will not scale |
| H — Audit & Compliance | 0 | 0 | 2 | 1 | **Entirely mock — the biggest gap** |
| I — Tenant Admin | 1 | 1 | 2 | 0 | Structure real; policy/branding mock |
| J — Circulars | 0 | 0 | 2 | 1 | **Entirely mock** |
| K — Platform Ops | 0 | 0 | 5 | 0 | **Entirely mock** by design (Phase 2) |
| **Total** | **10** | **15** | **12** | **4** | |

**The honest one-paragraph summary:** the *document* half of this EDMS — capture, filing,
versioning, checkout, classification, task execution and approval — is genuinely built and
mostly works. The *governance* half — audit, notifications, circulars, policies, findings,
platform operations — is a convincing UI over fixture data. Two defects sit across the
seam and matter more than any individual gap: **workflow routes have no authorization at
all**, and **the audit trail the product's compliance positioning rests on has never
recorded a single event.**
