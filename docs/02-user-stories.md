# 02 — User Stories

**Status:** Written 2026-08-29. Grounded in `EDMS-FRONTEND` and `edms-backend` as they exist today.

> **Re-checked 2026-10-16** against the live API: **DRIFT-14 does not block the live
> tenant.** `staff`, `supervisor`, `management` and `internal_auditor` accounts there hold
> `workflow:view:global` and get 200 from `GET /workflows`, so C1 completes on the live
> tenant. Only the seed (`prisma/seed-system.ts`) lacks the grant, so a freshly seeded
> database would still hit it. Persona grants below describe the **seed**.

**Revised 2026-09-04** against `edms-backend` @ `dev` (`b72e0bf`) and `EDMS-FRONTEND` @
`dev` (`f02c7b8`). Three stories changed status — **C1 broken → done**,
**J3 broken → partial**, **B3 gained a fixed confidentiality gate**. Counts in
[§15](#15-story-map-summary) were updated to match. Old statuses are kept inline as
*(was …)* so the backlog reads as a history rather than a snapshot.

**Revised again 2026-09-04** after `feature/management` merged into `EDMS-FRONTEND` @
`dev`. Frontend-only changes — no backend moved. **A4** and **E2** lost their
*(backend only)* qualifier: the Cabinet Designer now has a metadata-field editor and a
cabinet-access grant editor, both on live endpoints (both stories stay 🟨 Partial — the
remaining gaps are the capture form and read-path enforcement respectively). **C1**'s
route-to-workflow picker now also appears on the document screen and the upload screen,
not just `/staff/cabinets`. **B3**'s workflow activity trail is now read from live
`GET /workflow-history` rather than `SEED.audit` (the tamper-evident *audit* log is still
mock). One story added: **F4 — Monitor running workflows** (✅ Done, same DRIFT-05
authorization caveat as C1/C5). [§15](#15-story-map-summary) counts updated: Done 11 → 12.

**Revised a third time 2026-09-04**, after wiring the frontend to the backend's Workflow
Module read models (all endpoints confirmed live against the deployed Swagger doc; no
backend changes). **F1 (team workload) moves from Partial to Done** — `/supervisor/workload`
and `/supervisor` (Team Overview) now call `GET /tasks/workload` and
`GET /workflow-instances/team-status-matrix`/`open-items-by-cabinet` instead of walking
every task page in the browser. **F2 (SLA ageing)** ticks one more box — `/supervisor/bottlenecks`
now reads `GET /workflow-instances/bottlenecks-ageing` instead of computing ageing from
`SEED`, with SLA status and workflow status rendered as two separate badges — but stays
Partial: nothing still calls `notifyUser` on a breach *(→ it does since 2026-09-21,
DRIFT-10)*. **C4 (delegation) moves from
Partial-with-no-UI to a fuller Partial** — `/delegations` now exists (create, list, end;
"Delegated by you" / "Delegated to you"), leaving only the delegation-arrived visual marker
and the activation notification. `/supervisor/approvals` also moved onto the purpose-built
`GET /tasks/approvals` endpoint (with `scope=all`, fixing a real bug where it only showed
tasks assigned directly to the supervisor, plus a new escalated-tasks tab) and gained
pagination, error states and a retry, as did `/supervisor/bottlenecks`. [§15](#15-story-map-summary)
counts updated: Done 12 → 13, Partial 16 → 15.

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

**Backend rights (29 grants — 16 `own`, 9 `department`, 4 `global`; re-counted
2026-10-15 from `prisma/seed-system.ts`):** document view/search/download/export/print at
`department`, `document:create:own`; versions (view `department`, create `own`); locks
`own`; metadata, comments and signatures (view `department`, create `own`);
`document_access_request:create`; `cabinet:view`, `department:view`; folders (view, create
and edit `own`); `workflow_instance:view/create/route:own`; `task:view/action:own`;
`delegation:view/create/end:own`. **No `workflow:view` in the seed** — see DRIFT-14. *(2026-10-16: the live tenant's role does hold `workflow:view:global` — a row the seed no longer creates.)*
*(Was "14 grants … `workflow:view`, `workflow:route`" — the pre-2026-09-16 seed.)*
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

**Backend rights (40 grants — 34 `department`, 2 `own`, 4 `global`; re-counted
2026-10-15):** department-scoped document view/create/edit/search/download/export/print
and `view_confidential`; versions including `restore`; locks, metadata, comments,
signatures; `user:view:department`; `workflow_instance:view/create/route/close:department`;
`task:view/action/reassign:department` — which is what lets him see and reassign other
people's tasks; delegation; and circulars (`create:own`, `publish`/`withdraw:department`).
**No `workflow:view` in the seed** — see DRIFT-14. *(2026-10-16: the live tenant's role does hold `workflow:view:global` — a row the seed no longer creates.)* *(Was "18 grants … plus membership of
`TASK_VIEW_ALL_ROLES` and `TASK_REASSIGN_ROLES`" — those role lists no longer exist in the
backend; `task:view`/`task:reassign` grants replaced them.)*

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

**Backend rights (27 grants — 21 `global`, 6 `own`; re-counted 2026-10-15):** `global`
read across documents (view, search, `view_confidential`, download, export, print),
versions, metadata, comments, signatures, cabinets, folders, departments, users, workflow
instances, tasks and delegations — plus a small set of writes: `workflow_instance:create/route:own`,
`task:action:own`, `delegation:create/end:own`, `document_access_request:create`, and
circulars (`create:own`, `publish`, `withdraw`). **No `workflow:view` in the seed** — see DRIFT-14. *(2026-10-16: the live tenant's role does hold `workflow:view:global` — a row the seed no longer creates.)*
~~**Management cannot create, edit, or delete anything.**~~ *(Was "10 grants, all
read-only" — no longer true: management can act on its own tasks, route its own documents,
delegate, and publish circulars. It still cannot create or edit documents.)* (Fixed 2026-09-10: the
`usePermissions` role-name heuristic was deleted — the UI now derives each user's
`resource:action` keys from `GET /roles` and gates on those. Management's approve/reject
affordances only appear where the seeded grants actually allow them. See DRIFT-04.)

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

**Backend rights (26 grants — 21 `global`, 5 `own`; re-counted 2026-10-15):** the same
`global` read set as management, plus `audit:view`/`audit:export` (served by the
hash-chained `GET /audit` since 2026-09-18 — DRIFT-11), `cabinet_access:view` and
`circular:view`. `document:view_confidential:global` lets them read confidential-tier
documents (a permission since `edms-backend` `0dab81a`; it was a role list before).
**No `workflow:view` in the seed** — see DRIFT-14. *(2026-10-16: the live tenant's role does hold `workflow:view:global` — a row the seed no longer creates.)* *(Was "10 grants, read-only … `audit:view` (for which
no endpoint exists)" and "deliberately cannot mutate anything". The seed now also grants
`workflow_instance:create/route:own`, `task:action:own`, `delegation:create/end:own` and
`document_access_request:create`. The auditor still cannot change documents, cabinets or
users, but "cannot mutate anything" no longer holds — worth confirming with the product
owner that this is intended.)*

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

**Backend rights (72 grants, 71 `global` + 1 `own`; re-counted 2026-10-15 — was 45):**
effectively full control of the tenant, across all 20 resources including `role`,
`workflow`, `cabinet_access` and `circular`.
They are the **only** role in `CABINET_ACCESS_BYPASS_ROLES` (they see every cabinet
regardless of grants) and the only seeded role holding `document:view_restricted`.

---

### 👤 Adaeze — **SchullTech Platform Admin** (`schulltech_admin`)

*The vendor's own operations team. Not an employee of the customer.*

**Reality of their day:** Adaeze provisions new tenant organisations, manages commercial
plans and entitlements, watches platform health, and rolls features out behind flags.

**What success looks like:** a new tenant is live in minutes; usage and billing are
accurate; a bad release can be switched off without a deploy.

**What they fear:** being *able* to read a customer's confidential documents — that is a
liability, not a capability.

**Backend rights: 18 grants** *(re-counted 2026-10-15 — was "3 grants only")* —
`workflow:view/create/edit/publish/archive`, `workflow_instance:view/create/route/close`,
`task:view/action/reassign`, `delegation:view/end` plus `create:own`, `audit:view/export`,
and `document_access_request:create`. Still **no `document:*` grant of any kind.** This is
deliberate and important: the platform admin is
**excluded from `CABINET_ACCESS_BYPASS_ROLES`, from every confidentiality tier list, and
from all document permissions.** The vendor cannot read customer documents. The
architecture note in `access-control.constants.ts` is explicit that any future support
access must be a separate, audited, time-boxed impersonation mechanism — not a standing
role grant.

> ✅ Fixed 2026-09-10. The `usePermissions` "return true for schulltech_admin" heuristic
> is gone. `schulltech_admin`'s effective keys are now just its seeded grants
> (3 at the time; 18 as of 2026-10-15, none on `document`); `hasPermission('document', …)` etc.
> return `false`. The `/platform` portal is still `SEED`-backed so this is latent until
> those pages are wired, but the UI no longer *claims* the vendor can read documents. See
> DRIFT-04.

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
2. Each file gets a filing card for its title, document type, cabinet, folder,
   confidentiality and urgency, plus the destination cabinet's own metadata fields.
   *(Until 2026-10-14 this card also showed a fabricated "IDU" classification — a
   document type, cabinet, folder and confidence percentage with no ML behind it.)*
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
- [x] ~~⚠️ **The IDU classification is hardcoded.**~~ **Removed 2026-10-14** — the card no
      longer shows a confidence badge, a pre-filled classification, or "extracted metadata"
      chips, and no longer pre-selects a type/cabinet/folder from a fixture. The real
      cabinet-metadata fields below are what the form collects.
- [ ] ⚠️ **The due date is collected and discarded.** The form has a `due` field; it is
      never sent to the API, and the backend `Document` model has no due-date column.
- [x] Custom metadata is captured at upload — **2026-10-09, verified live**: the card shows
      the cabinet's fields and sends them with `POST /documents` (`metadata`, edms-backend
      `dd10017`), which refuses an upload missing a required field. *This box said the form
      never asked for them; it has rendered them since 2026-10-07, saved by a second call.*
- [x] ~~⚠️ **2 MB ceiling** (`s3.service.ts` `maxFileSize`), and only PDF and image types
      actually upload~~ — *re-checked 2026-10-15:* uploads go through the chunked
      presigned uploader, capped at 100 MB, accepting PDF, DOCX, XLSX, TIFF, JPEG and PNG
      (`src/constants/uploadTypes.ts`, `c8e9d24`, 2026-10-02).

**Known drift:** DRIFT-06 — the file lands in a third-party bucket the backend cannot read.

---

### A2 — Have the system read the document for me · ⬜ **Not built**

> **As** Chika,
> **I want** the system to extract the vendor name, invoice number and amount from a
> scanned invoice and pre-fill the metadata,
> **so that** I am confirming a machine's reading rather than typing from a page.

**Why this matters:** this is the difference between 60-second filing and 4-minute filing.
The removed "IDU" card claimed to tell this story; nothing behind it was real, which is why
it is gone.

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

### A4 — Define custom metadata per cabinet · 🟨 **Partial**

> **As** Bola,
> **I want to** define that the Invoices cabinet requires "Vendor Name", "Invoice Number"
> and "Contract Value",
> **so that** every invoice is captured consistently and those fields become searchable.

**Current state:** the backend is complete — `CabinetMetadataField` supports
`text | number | date | select | boolean`, required flags, select options and display
order, with full CRUD at `POST/PATCH/DELETE /cabinets/:id/metadata-fields`. Values are
type-validated and normalised on write (`normalizeMetadataValue`).

**The Cabinet Designer now has a metadata-schema panel** (`/admin/cabinets`, since the
`feature/management` merge). It lists a cabinet's fields and adds and removes them against
the live `POST /cabinets/:id/metadata-fields` and
`DELETE /cabinets/:cabinetId/metadata-fields/:fieldId`. What is still missing is
**editing/reordering an existing field** (`PATCH .../metadata-fields/:fieldId` exists but
no screen calls it) and, more importantly, **anything that captures the values**: neither
the upload form nor the document-detail screen renders a cabinet's fields, so a cabinet
with required metadata is still filed incomplete every time. *(Outdated: the upload form
captures them since 2026-10-07, sent with the upload since 2026-10-09 — see the criteria
below.)*

**Acceptance criteria**
- [x] Backend: fields definable per cabinet with all five types
- [x] Backend: values validated against the field type on write
- [x] Backend: required-field enforcement on update
- [x] Admin UI to add and delete fields (`/admin/cabinets` metadata panel; since 2026-10-06
      also the cabinet's **Metadata schema** tab on `/staff/cabinets` for its manager — 🟨 not
      verified live there)
- [x] Edit an existing field's name and required flag (`PATCH .../metadata-fields/:fieldId`)
      — *this box said the PATCH endpoint was unused; the Designer's "Edit" button has called it
      since at least 2026-09-21. Corrected 2026-10-06*
- [ ] Reorder fields (`displayOrder` is only set on create)
- [x] Upload form renders the target cabinet's fields and files them with the document —
      **2026-10-09, verified live as `staff`**: values go in `POST /documents` / `/batch`
      (`metadata`, edms-backend `dd10017`) under the upload permission alone. Required fields
      are enforced in the form and by the API (400). *Until then they were saved by a second
      `PUT`, which seeded `staff` couldn't make, so most uploaders only saw the field list*
- [ ] ⚠️ Metadata now drives **workflow routing** (backend conditional routing, merged
      2026-10-06): a branch condition on an empty field evaluates to "no match" without an
      error, so a document filed without its metadata silently skips that branch. Search also
      indexes metadata values; since `dd10017` it re-indexes after a metadata save or an upload
      with metadata, but still not after a title/type change, a restore, or failed OCR
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
after the fact. The frontend has a working search page, and since 2026-10-14 it sends every
facet to the search endpoint, not just Cabinet.

**Corrected 2026-10-14.** This section previously said the index is never built because it
is enqueued only from the OCR success path and "OCR always fails (DRIFT-06)". Both halves
were already wrong by 2026-09-21 — DRIFT-06's "OCR always fails" claim was retracted after
live verification (doc 01 §5), and OCR does succeed on real uploads. What was real: a
document was indexed only when OCR completed, so a job stuck at `pending`, or a file with no
extractable text at all (a DOCX), was invisible to search while sitting fine in
`GET /documents`. **edms-backend PR #51 (live 2026-10-14) closes that**: indexing happens at
create time, on a title change, on a metadata change and on a version restore, and the OCR
worker indexes on its final failed attempt. Not covered: versions already stranded before
that deploy (no backfill), and a stuck job still isn't retried — the reconciliation sweep
DRIFT-06 asks for is unbuilt.

**Acceptance criteria**
- [x] Full-text search over title + OCR text + metadata values
- [x] Results ranked by relevance
- [x] Confidentiality tier filtering applied in SQL
- [x] RBAC scope (`own`/`department`/`global`) applied in SQL
- [x] Paginated
- [x] The index is actually populated — **2026-10-14** (PR #51)
- [x] Re-index on title change, metadata update, and version restore — **2026-10-14** (PR #51)
- [x] Index by title regardless of OCR outcome, so a failed OCR never makes a document
      unfindable — **2026-10-14** (PR #51). *No backfill for versions stranded earlier*
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

**Current state:** `/doc/[id]` is the most complete screen in the product — wired to
~ten hooks. Preview, metadata, versions, workflow state, comments, signatures, actions,
and — since the `feature/management` merge — a workflow **stage rail** and an **activity
trail** fed from the live `GET /workflow-history` endpoint (`WorkflowActivityPanel`).

**Acceptance criteria**
- [x] Document loads from `GET /documents/:id`
- [x] Metadata, versions, cabinet and folder context render
- [x] Confidentiality enforced server-side by `requireConfidentiality('view')`
- [x] ✅ **Confidentiality policy now gates download and print in the UI** (fixed
      2026-09-03, commit `e3e3398`). The lookup previously matched
      `p.key === 'confidentiality.<tier>'` against an array, but `policies.service.ts`
      returns an **object** keyed by section — so every check silently fell through to
      permissive defaults and a `top_secret` document was downloadable by anyone who could
      open it. Fixed in the consumer, not the service: `/admin/policies` and
      `/admin/users` already read the object shape correctly. Tier casing is now
      normalised too — fixtures say `Top Secret`, the backend sends `top_secret`.
- [x] Checkout / check-in from this screen
- [x] **AI summary of the current version (2026-10-13, verified live)** — `GET /documents/:id/summary`
      (Gemini, written after OCR). The card says when it's still being written, when the file has no
      readable text, and when OCR or the summary failed. Since 2026-10-20 (verified live) a failed
      summary can be retried and a finished one regenerated (`POST /documents/:id/summary`)
- [x] Edit title, type, folder, confidentiality, urgency, status
- [x] Workflow stage rail + activity trail from live `GET /workflow-history` (since the
      `feature/management` merge)
- [x] ✅ **Comments and signatures stay workflow-trail-only — reaffirmed 2026-09-18.**
      `GET/POST /documents/:id/comments`/`/signatures` are real endpoints (confirmed
      live) and were briefly wired as `DocumentCommentsPanel`/`DocumentSignaturesPanel`
      the same day, then deliberately removed: product wants every comment and
      signature to live on the one workflow trail (`POST /tasks/:id/action`'s
      `comment`/`approve`'s `signature`), not split across a second thread. "Mark
      reviewed" now opens an optional-comment modal too — see DRIFT-08 in doc 01 and
      BE-16/BE-17 in `BACKEND_REQUESTS.md` for what's still needed (an optional
      signature on `review`; multi-document workflow instances shipped in the
      backend and were wired 2026-10-07 — DRIFT-19 in doc 01).
- [ ] 🟨 **The backend audit trail is real now (DRIFT-11 revised, 2026-09-18)** — it
      auto-writes hash-chained entries server-side and `/admin/audit` reads it live. But
      this page still calls the old no-op `useCreateAuditLog` (there's no write endpoint
      to point it at — entries are a side effect of other actions, not client-logged),
      and doesn't render anything from the real trail. Only the *workflow* history above
      is real on this page; whether document views/edits/downloads land in the real
      trail as backend-side actions is unverified.
- [x] Preview and download: `GET /documents/:id` returns a presigned `fileUrl` the viewer
      renders, and downloads go through the version endpoint (B4). *(This item said there
      was no such endpoint; stale, corrected 2026-10-08.)*
- [x] ✅ `@ts-nocheck` is gone — the file type-checks cleanly now (confirmed 2026-09-18,
      stale here; not dated when it was actually removed)

---

### B4 — Download, print or export a document · 🟨 **Partial** *(was ⬜ Not built)*

> **As** David (Supervisor),
> **I want to** download a contract to read offline, subject to my clearance,
> **so that** I can review it on a flight — and so the system records that I took a copy.

**Why this matters:** download is where confidentiality controls earn their keep, and it
is the most audit-sensitive action in the product.

**Current state (2026-10-08):** `edms-backend` `0dab81a` replaced the old per-tier role
allowlists (which no route used) with permissions. Viewing a tier above `internal` needs
`document:view_confidential` / `view_restricted` / `view_top_secret`, scoped like any other
grant; download, export and print each need `document:download` / `export` / `print` as
well. Old-version reads (`GET /documents/:id/versions/:versionId`) are gated and audited as
downloads, and `GET /documents/:id/export` and `/print` are new. Seeded: `staff` and
`supervisor` hold all three at `department` scope; `management`, `internal_auditor` and
`client_admin` at `global`.

The frontend's Download (document page, workflow viewer, each version's Open) now checks
the same rule and fetches through the version endpoint, so each download is audited.
Print (in the PDF viewer's toolbar) calls `GET /documents/:id/print` first and prints page
images with the watermark burned in; Export (document page) goes through
`GET /documents/:id/export`. Both shown only with the permission (2026-10-08).

**Acceptance criteria**
- [x] A short-lived presigned URL — via `GET /documents/:id/versions/:versionId` rather
      than a dedicated `/download` route
- [x] Gated by `requireConfidentiality('download')` and `document:download`
- [x] Writes a `document.downloaded` audit entry
- [x] Print and export paths gated by their own actions
- [ ] 🔴 **Download permission can be bypassed:** `GET /documents/:id`, the document list
      and the version list all return a signed URL to anyone who can view. Raised with the
      backend 2026-10-08
- [x] Print and Export buttons (2026-10-08). Print verified in the browser against the
      live API (audited call made, watermarked print frame built)
- [x] Download and Export clicked through end to end in the UI (2026-10-09): each made its
      audited call and opened the signed URL

---

## Epic C — Routing, Review & Approval

---

### C1 — Route a document into an approval workflow · ✅ **Done** *(was 🟥 Broken)*

> **As** Chika,
> **I want to** send a filed invoice into the "Standard Invoice Approval" workflow,
> **so that** it reaches my supervisor with a deadline attached instead of an email that
> might be missed.

**Why this matters:** this is the hinge of the entire product. Without it, EDMS is a
filing cabinet, not a workflow system.

**Current state (verified 2026-09-04): fixed.** `workflowInstances.service.ts` exposes
`createAndStart(workflowId, documentId)`, which performs the backend's real two-call
contract — `POST /workflow-instances` to create, then `POST /workflow-instances/:id/start`
to begin execution. Since the `feature/management` merge this is a shared
`useRouteToWorkflow` hook, and the "Route to workflow" picker (filtered to `published`
definitions) now appears on **three** surfaces — `/staff/cabinets`, the document screen
`/doc/[id]`, and `/upload` once a file is filed. DRIFT-09 is resolved.

*Previously:* the UI posted to a single-segment `POST /workflow-instances/start` that
matched no backend route, so routing a document 404'd. This was the highest
impact-to-effort defect in either codebase — the whole approval half of the product was
built and unreachable.

**Acceptance criteria**
- [x] Backend: instance creation validates the document exists and the definition is `published`
- [x] Backend: `start` creates the first stage's task(s), computes `stageDueAt` from the
      stage's SLA hours, and writes a `WorkflowHistory` row
- [x] Backend: role-pool assignment supported (`assignedRoleId`) as well as direct assignment
- [x] ✅ Frontend calls the correct two-step sequence
- [x] ✅ Workflow picker (filtered to `published`) on `/staff/cabinets`, `/doc/[id]` and
      `/upload`, via the shared `useRouteToWorkflow` hook
- [x] ✅ **Authorization now enforced** (2026-09-04). All five workflow services assert
      roles and return a named `403` — `instances.service` gates list, bottlenecks-ageing
      and team-status-matrix; `WORKFLOW_INSTANCE_MANAGE_ROLES` covers hold/resume/close.
      DRIFT-05 is resolved. ~~*(`requirePermission` is still absent from the 32 workflow
      routes — the checks live in the services, so grep `_FORBIDDEN`.)*~~ *(2026-10-15:
      `workflows.router.ts` now has 40 `requirePermission` calls across its 39 routes —
      the router-level checks landed with the 2026-09-16 RBAC refactor.)*
- [x] 🟨 **Not blocked on the live tenant (re-tested 2026-10-16)** — its four non-admin
      roles hold `workflow:view:global` and get 200 from `GET /workflows`. The gap below
      is real in the **seed**, so a freshly seeded database would still hit it (DRIFT-14,
      now 🟠 latent). *Was:* 🔴 ⚠️ **Blocked again, by a different cause (DRIFT-14).** `GET /workflows` — the
      list `useRouteToWorkflow` needs to build its picker — requires `workflow:view`, and
      `prisma/seed-system.ts` grants that only to `client_admin` and `schulltech_admin`
      (re-checked 2026-10-15). `staff`, `supervisor`, `management` and `internal_auditor`
      all hold `workflow_instance:route` but cannot list what to route into. The modal
      falls back to *"No published workflows"*, which is neither true nor the reason.
      *(Originally blamed on `WORKFLOW_DEFINITION_VIEW_ROLES = MANAGE_ROLES`; that constant
      is gone and the RBAC seed now causes the same symptom — see README correction
      2026-09-21.)*
- [x] Notification to the first assignee when the workflow starts (`task.assigned`, in
      `tasks.service.ts` since 2026-09-21 — DRIFT-10). *(Was: "No notification is sent to
      the new assignee".)*

---

### C2 — Work my task queue · 🟨 **Partial**

> **As** David (Supervisor),
> **I want** a single prioritised list of everything waiting on me, with the most urgent
> and most overdue at the top,
> **so that** I work the right thing first instead of whatever is most recent.

**Current state:** assignment is well built: `tasks.service` resolves both direct
assignment and role-pool assignment, and honours active delegations. Prioritising is
not: `GET /tasks` sorts oldest-created first, or by earliest deadline with `sort=dueAt`;
it has no urgency order or filter. *(Corrected 2026-10-19 — this said `tasks.repository`
"prioritises by document urgency then due date"; on `origin/dev` `listTasks` orders by
`createdAt` unless asked for `dueAt`.)*

**Acceptance criteria**
- [x] `GET /tasks` returns tasks assigned to me directly **or** to a role I hold
- [x] Oversight roles can request `scope=all` (holders of `task:view` wider than `own`; was `TASK_VIEW_ALL_ROLES`, removed 2026-09-16)
- [ ] 🟨 Prioritised — by due date only (`sort=dueAt`, most overdue first). The backend
      has no urgency sort, and My Tasks dropped its in-browser urgency sort and filter on
      2026-10-19: they only ever reordered the 20 tasks loaded. Since 2026-10-20 My Tasks
      opens on Open tasks (`status=pending`) and `/supervisor/approvals` asks for
      `sort=dueAt` (it was oldest first)
- [x] Due/overdue state visible per row
- [x] Paginated — `/staff/tasks` pages through `GET /tasks` (20 a page, Prev/Next) since
      2026-10-19. *Was:* it loaded only the first 20, oldest first, with no way to see more
- [x] Frontend: `/staff/tasks`, `/supervisor/approvals` both live
- [x] `/staff/tasks`'s Overdue filter and "Sort: Due date" are applied server-side
      (`overdue`, `sort=dueAt`, edms-backend PR #50), so they cover the whole queue, not
      just the page fetched (2026-10-14, verified live)
- [x] Sidebar badges come from the task API — fixed 2026-10-12 (doc 05). *Was:* computed
      from `SEED.documents`, with `approvalsCount` hardcoded to `assignee === 'u-david'`

---

### C3 — Approve, reject or request changes · ✅ **Done**

> **As** David,
> **I want to** approve a document with a note, or send it back with a reason,
> **so that** the decision and its justification live with the document permanently.

**Acceptance criteria**
- [x] `POST /tasks/:id/action` with `approve | reject | review | request_changes | close | delegate`
- [x] Only the assignee, a role-pool member, a delegate, or a `task:reassign` holder may act (was `TASK_REASSIGN_ROLES`, removed 2026-09-16)
- [x] Advances the instance to the next stage and recomputes `stageDueAt`
- [x] Writes a `WorkflowHistory` row with `fromStage`, `toStage`, actor, note and
      `elapsedSeconds`
- [x] Closing the final stage closes the instance
- [x] Notes are captured and stored
- [x] Notification to the next assignee (`task.assigned`) and the originator
      (`workflow.changes_requested`, `workflow.rejected`, `workflow.closed`) — in
      `tasks.service.ts` since 2026-09-21 (DRIFT-10); not clicked through end to end.
      *(Was: "No notification to the next assignee or the originator".)*
- [ ] ⚠️ Only `WorkflowHistory` is confirmed written here — a different table, different
      purpose, no hash chain. `audit_entries` is real and auto-written now (DRIFT-11
      revised, 2026-09-18 — confirmed for `user.login`/`user.invited`/
      `user.token_refreshed`), but whether a task action itself produces an entry is
      unverified

---

### C4 — Delegate my work while I'm away · 🟨 **Partial**

> **As** David,
> **I want to** hand my approvals to a colleague for the two weeks I'm on leave,
> **so that** nothing stalls behind an empty desk.

**Current state:** the backend is complete and thoughtful — `Delegation` with
`startsAt`/`endsAt`, an optional JSON `scope` limiting it to particular cabinets or
workflows, an `isActive` flag, and full CRUD at `GET/POST /delegations` and
`POST /delegations/:id/end`. `tasks.service` already resolves delegations when listing and
actioning tasks.

**A UI now exists** (`/delegations`, reachable from the Staff and Supervisor nav): create a
time-bounded delegation to a colleague, optionally scoped to specific cabinets; separate
"Delegated by you" / "Delegated to you" lists; end an active delegation. Self-delegation is
rejected client- and server-side. What's still missing is entirely cosmetic/notification —
nothing on the task itself shows it arrived by delegation, and the delegate isn't told when
one activates.

**Acceptance criteria**
- [x] Backend: date-bounded delegation with optional cabinet/workflow scoping
- [x] Backend: delegates see and can action delegated tasks
- [x] Backend: `DELEGATION_VIEW_ALL_ROLES` / `DELEGATION_MANAGE_ALL_ROLES` govern oversight
- [x] UI to create, list and end a delegation (`/delegations`)
- [ ] Visual marker on a task showing it arrived by delegation
- [ ] Notification to the delegate when a delegation activates. *(2026-10-15: still
      missing, but no longer "the same gap as everywhere else" — DRIFT-10 is resolved and
      per-task delegation does notify (`task.delegated`); the `delegations` module itself
      emits nothing when a date-bounded delegation starts.)*

---

### C5 — Design an approval workflow · 🟨 **Partial**

> **As** Bola (Client Admin),
> **I want to** define the stages an invoice passes through, who acts at each stage and how
> long they have,
> **so that** the process is enforced by the system rather than remembered by people.

**Current state:** `/admin/workflows` lists every workflow by status (Published / Drafts /
Archived, with search) and opens each in the designer at `/admin/workflows/[id]` (since
2026-10-20; before, a dropdown that only saw the first 20). The designer is wired to the real
`/workflows` endpoints. Definitions are versioned JSON with `draft → published → archived`
lifecycle.

**Acceptance criteria**
- [x] Create, edit, publish and archive definitions; since 2026-10-20 (verified live) delete a
      draft that was never started, and unarchive an archived one
- [x] Stages with sequential transitions, SLA hours and role/user assignment
- [x] Published definitions are immutable; edits require a new version
- [x] ✅ **Authorization now enforced** (2026-09-04). `definitions.service.ts` asserts on
      every method: `assertCanView` on list/getById, `assertCanManage` on
      create/update/publish/archive, with `WORKFLOW_DEFINITION_MANAGE_ROLES` =
      `client_admin` + `schulltech_admin`. DRIFT-05 resolved.
- [ ] 🟠 **Read access is over-restricted in the seed (DRIFT-14)** — *not on the live
      tenant, whose roles still hold `workflow:view:global` (re-tested 2026-10-16).* `GET /workflows` requires
      `workflow:view`, which the seed grants only to `client_admin` and
      `schulltech_admin` (re-checked 2026-10-15), so `staff`, `supervisor`, `management`
      and `internal_auditor` cannot list definitions to route into. *(Was described as
      "`WORKFLOW_DEFINITION_VIEW_ROLES` aliases `MANAGE_ROLES` … despite holding a seeded
      `workflow:view:global` grant". That constant is gone, and no non-admin role holds
      `workflow:view` in today's seed.)*
- [x] ✅ `// @ts-nocheck` removed 2026-10-08 — the page type-checks
- [ ] 🟨 Parallel branches — backend merged 2026-10-16 (edms-backend PR #54: unconditional
      fan-out, child executions with their own task and SLA, `join: 'all'` barrier stages).
      Designer since 2026-10-17: **"+ Add parallel branch"** and **Branches meet at** in
      `BranchEditorCard`; `applyStageRouting` saves the fork, its branches' onward routes and
      the join in one PATCH, and `validateParallelRouting` mirrors the backend's graph checks
      (`validateDefinition` adds each stage's fallback rules for stage add/delete/move,
      2026-10-20). The
      backend accepted and rejected the same definitions as the frontend in a live API check
      (2026-10-17), and the designer was clicked through in a browser on 2026-10-18 (TEST_PLAN
      TP-Q2, Q15–Q18). ⛔ **Running a parallel workflow fails on the live backend:** the first
      action at a fork stage returns 500, even on a minimal fork with no join (2026-10-18)
- [x] Conditional branches — backend conditional routing merged 2026-10-06
      (`definitions.validation.ts` condition rules, `matchesWorkflowCondition` in
      `tasks.service.ts`), and the designer has a branch editor since 2026-09-29
      (`BranchEditorCard`, `RuleValueInput`). *(Was: "Phase 1 is explicitly
      sequential-only". Not clicked through end to end in this pass.)*
- [ ] Visual graph editor — `WorkflowCanvas` now draws the stages, but editing is still
      done in side panels, not on the graph

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
- [x] Only the lock holder can check in — **or**, since `edms-backend` `b4a3f81`
      (2026-09-29), a `document_lock:delete` holder at `global` scope, or at `department`
      scope for the cabinet's department (`canReleaseLock`)
- [x] Uploading a version while someone else holds the lock is rejected (409)
- [x] 🟨 Force-release of a stale lock — "Force check in" on `/doc/[id]` (2026-10-02),
      shown to the holders above **only once the lock is past `expectedReturnAt`**. Built,
      not yet verified end to end. A lock taken without `expectedReturnAt` never becomes
      forceable from the UI.
- [x] 🟨 Overdue reminders instead of auto-expiry — `checkout-overdue.worker` (every 5
      min) sends `checkout.reminder` to the holder `CHECKOUT_REMINDER_HOURS` (24) before
      `expectedReturnAt`, then `checkout.overdue` to the holder and their department's
      supervisors once it passes. Locks are never released automatically. Backend-verified
      by code reading only
- [x] `GET /documents/:id` names the holder (`checkoutLock.locker`) — the banner shows it

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
- [x] Clearance is a permission per tier (`document:view_confidential` / `view_restricted` /
      `view_top_secret`, `edms-backend` `0dab81a`), so a custom role can be cleared from
      `/admin/roles`. Seeded: `confidential` → supervisor (`department`), management,
      internal_auditor, client_admin; `restricted` → client_admin; `top_secret` → nobody
- [ ] 🔴 **Anyone can set any tier.** No check that the writer is cleared for the tier they
      are assigning. A `staff` user can upload at `top_secret`, which no seeded role can
      read; it stays unreadable until an admin grants `view_top_secret` to some role.
- [x] The UI never offers a tier the user isn't cleared for: the upload form omits
      `top_secret`, and the document page's "Change classification" dialog (2026-10-08)
      disables uncleared tiers using the backend's rule. *(This item used to say the
      doc-detail edit form offered Top Secret from `SEED.policies`; no such form existed.)*

---

### E2 — Grant cabinet-level access · 🟨 **Partial**

> **As** Bola,
> **I want to** give the Legal team view access to the Contracts cabinet and upload access
> to nobody else,
> **so that** need-to-know is enforced by structure, not by trust.

**Current state:** `CabinetAccess` supports grants to a **role** or an **individual user**,
with a six-level permission hierarchy (`view < upload < edit < route < export < delete`).
Full CRUD exists at `GET/POST /cabinets/:id/access` and
`DELETE /cabinets/:id/access/:grantId`.

**The Cabinet Designer now has an access-grants panel** (`/admin/cabinets`, since the
`feature/management` merge) — it lists a cabinet's grants and adds and revokes them
(role or individual user, with the permission level) on the live endpoints. The
outstanding problem is the one that always mattered:

- **Grants are not enforced on every read.** *Partly stale — corrected 2026-10-06 from the
  backend code (not a live test):* the cabinet **list** now filters on grants
  (`buildCabinetWhere`), and cabinet **detail** and **folder** reads go through
  `requireCabinetAccess('view')`. Document listing, document detail and search were not
  re-checked and may still ignore grants. Backend fix if so.

**Delegated cabinet management (2026-10-06, ✅ tested by the user 2026-10-08).** The same access panel
now also appears as an **Access** tab on `/staff/cabinets` for anyone holding
`cabinet_access:create` and `edit` on that cabinet, so a client admin can hand a cabinet to
a records officer. The picker leaves out the user themselves, roles they hold, client admins
(who already reach every cabinet) and levels above their own. Since edms-backend `dd10017`
(2026-10-09) the API refuses the same three (403), so the rule no longer rests on the UI.

**Acceptance criteria**
- [x] Backend: role and user grants with a permission hierarchy
- [x] Backend: `client_admin` bypasses grants by design
- [x] Backend: enforced on document upload, edit, delete and routing
- [x] Admin UI to view, grant and revoke (`/admin/cabinets` access panel)
- [ ] 🟨 Delegated managers grant and revoke from `/staff/cabinets` (built 2026-10-06, not
      verified live); self-grant / escalation blocked in the UI and, since `dd10017`, by the API
- [ ] 🔴 Enforced on **read** paths — cabinet list/detail and folders now are (code-read
      2026-10-06); document list/detail/search unverified
- [ ] "Who can see this cabinet?" view for auditors — the endpoint exists
      (`GET /cabinets/:id/access`, gated on `cabinet_access:view`, which `internal_auditor`
      holds), but no auditor screen calls it. *(Was: "with no endpoint to use it" —
      re-checked 2026-10-15.)*

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

**Current state (updated 2026-09-10):** `PUT /roles/:id/permissions` exists and works, and
the `/admin/users` matrix editor calls it (`useSetRolePermissions`) — not the local store.
Role **create / rename / delete** and per-user **role assign / remove** are also wired
(`POST /roles`, `PATCH|DELETE /roles/:id`, `POST|DELETE /users/:id/roles`). The
`resource`/`action` vocabulary lives in `src/lib/permissions.ts` and the same keys now
drive the app's own route/nav/affordance gating (`usePermissions`), so a freshly created
role takes effect in the UI without a code change.

**Acceptance criteria**
- [x] Backend: `resource:action:scope` triples assignable per role
- [x] Backend: scopes `global | department | own`
- [x] Backend: permissions re-read from the DB on every request, so changes take effect
      immediately without re-login
- [x] The UI matrix editor calls the API instead of the local store
- [x] Create / rename / delete roles, assign / remove roles on a user
- [ ] Guard rails preventing an admin from removing their own admin rights
- [ ] `role.permissions_updated` audit entry (frontend writes a local `auditAction` only)

---

## Epic F — Oversight, SLA & Workload

---

### F1 — See my team's workload · ✅ **Done** *(was 🟨 Partial)*

> **As** David,
> **I want to** see how many open items each team member is carrying,
> **so that** I can rebalance before someone drowns.

**Current state (verified against the Workflow Module API guide): fixed.** The backend
shipped purpose-built read models — `GET /tasks/workload` (per-member `open`/`overdue`
against a real `capacity`/`utilizationPercent`) and `GET /workflow-instances/team-status-matrix`
/ `open-items-by-cabinet` for the Team Overview screen — and the frontend now calls them
directly instead of walking every page of `/tasks` and rolling counts up in the browser.
`/supervisor/workload` and `/supervisor` (Team Overview) both moved off the client-side
aggregation stopgap; a member's row still lazily fetches their actual task list (capped at
100) only once expanded/clicked, for the reassign action.

**Acceptance criteria**
- [x] `/supervisor/workload` renders per-person counts from a server-side aggregate
      (`GET /tasks/workload`), not a client-side walk of every task
- [x] `/supervisor` (Team Overview) renders the member × status matrix and open-items-by-
      cabinet from their own dedicated endpoints
- [x] Reassignment via `PATCH /tasks/:id/reassign`, gated by `task:reassign` (was `TASK_REASSIGN_ROLES`)
- [x] Supervisor omits `departmentId`; the backend resolves it — no department picker in
      the UI (per the API guide's §4 rule)

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

~~**And nobody is ever told.** The worker writes history rows and stops. There is no
notification module, so `sla.warning` and `sla.breach` — both defined in
`NOTIFICATION_TYPES` — are never delivered to anyone. **The SLA engine runs into a void.**~~
*(Re-checked 2026-10-15: `sla.service.ts` now sends `sla.warning` to the task's assignee
(`notifyAssignment`) and `sla.breach` to the supervisor role (`notifyRole`) — DRIFT-10,
resolved 2026-09-21.)*

**Acceptance criteria**
- [x] Scheduled reconciliation with warning and escalation tiers
- [x] Duplicate-alert suppression
- [x] Auto-escalation of overdue tasks
- [x] Breach resolution when the task completes
- [x] Anyone is actually notified — warning to the assignee, breach to supervisors
      *(in code since 2026-09-21, DRIFT-10; not clicked through end to end)*
- [x] `/supervisor/bottlenecks` reads real SLA data — `GET /workflow-instances/bottlenecks-ageing`
      (summary + ageing/stage distributions + paginated detail rows) rather than computing
      ageing from `SEED` documents. `slaStatus` (`healthy | due_soon | breached | paused |
      not_started`) and `workflowStatus` render as two separate badges, per the API guide's
      explicit "don't merge these" rule. The staff dashboard's Overdue/SLA tile and the
      bottleneck banner now also draw on the persisted `GET /sla/breaches` event feed, not
      ad-hoc `dueAt < now` math — though the guide itself notes the two totals
      (`bottlenecks-ageing.summary.breachedItems` vs `sla/breaches.pagination.total`) aren't
      guaranteed to agree, since one is a live calculation and the other a persisted event log
- [ ] Configurable SLA thresholds per workflow stage rather than one global env var

---

### F3 — Reassign work · ✅ **Done**

> **As** David,
> **I want to** move a task from one person to another with a reason,
> **so that** absence or overload doesn't stall a document.

**Acceptance criteria**
- [x] `PATCH /tasks/:id/reassign`, restricted to holders of `task:reassign`
      (supervisor at `department`, client_admin and schulltech_admin at `global`).
      *(Was `TASK_REASSIGN_ROLES`; that role list no longer exists in the backend.)*
- [x] Writes a history row recording the reassignment
- [x] UI at `/supervisor/workload`
- [x] Notification to the new assignee (`task.reassigned`, since 2026-09-21 — DRIFT-10)
- [ ] Notification to the old assignee — still not sent

---

### F4 — Monitor running workflows · ✅ **Done** *(new — shipped in `feature/management`)*

> **As** David (Supervisor) or Bola (Client Admin),
> **I want** one screen listing every workflow instance that is running, with its current
> stage and how long it has been there, and the ability to pause or close one,
> **so that** a stalled document is something I can see and act on rather than discover
> when someone chases it.

**Why this matters:** C1–C3 route and action individual tasks, but until now nothing gave
an operator the instance-level view — which documents are mid-workflow, where each one is
sitting, and which have stalled.

**Flow as built** (`/supervisor/instances`, re-exported at `/admin/workflows/instances`;
`WorkflowInstanceMonitor` / `WorkflowInstanceDetail` / `WorkflowStageProgress` /
`WorkflowHistoryTimeline`):
1. A server-paginated table of instances (`GET /workflow-instances?page=&limit=20&status=&workflowDefinitionId=&departmentId=`),
   filterable by status, by workflow definition and — for tenant-wide viewers — by
   department, which the management dashboards' **Workflows** links pre-set via `?dept=`.
2. Clicking a row opens a drawer: `GET /workflow-instances/:id` for the stage rail and
   `GET /workflow-history?workflowInstanceId=&scope=all&order=desc` for the activity trail.
3. Hold / resume / close act on `POST /workflow-instances/:id/hold | resume | close`.

**Acceptance criteria**
- [x] Instance list with status + definition filters, server-paginated
- [x] Per-instance stage rail and activity trail from live endpoints
- [x] Hold, resume and close, wired to the real lifecycle routes
- [x] Department filter and drill-down from `/management` (2026-10-14, verified live) —
      only for `global` `workflow_instance:view`; a department-scoped supervisor already
      sees just their own department
- [x] Skeleton loading state (`SkeletonTable`)
- [x] ✅ **DRIFT-05 resolved** (2026-09-04) — `instances.service.ts` gates every read and
      `WORKFLOW_INSTANCE_MANAGE_ROLES` gates hold/resume/close. *Previously* any
      authenticated user could hold, resume or close any instance, and this screen made
      that a two-click operation.
- [ ] ⚠️ Hold/resume/close are not audit-logged (`useCreateAuditLog` is a no-op, DRIFT-11)
- [ ] No error state — a failed instance fetch shows nothing rather than a retry
- [ ] SLA / ageing indicators per instance (the list shows status, not time-in-stage)

---

## Epic G — Executive Reporting

---

### G1 — Compare departments · 🟨 **Partial**

> **As** Eniola (Management),
> **I want to** see throughput, backlog and SLA compliance side by side across departments,
> **so that** I can direct attention where it is needed.

**Current state (re-checked 2026-10-15):** `/management`, `/management/departments` and
`/management/trends` read the server's aggregation endpoints — `useDocumentStats`,
`useTaskStats`, `useWorkflowInstanceStats`, `useOpenItemsByCabinet` (DRIFT-07, resolved
2026-09-21). `useAllTasks` and `useAllWorkflowInstances` were deleted.
`managementAggregation.ts` survives only to shape server results (department index, month
alignment), not to count records.

*Superseded:* "every number is computed **in the browser** … `fetchAllPages`, walking up to
50 pages of 100 records".

**Acceptance criteria**
- [x] Per-department document, task and instance counts
- [x] CSV export
- [x] Department tree flattened correctly, including nested children
- [x] Server-side aggregation endpoints — 8 exist and the management pages use them
      (DRIFT-07). ~~The backend has **no** statistics, reporting or aggregation routes of
      any kind.~~
- [ ] Bounded response time as data grows — likely now that counting is server-side, but
      not measured

---

### G2 — See trends over time · 🟨 **Partial**

> **As** Eniola,
> **I want to** see whether turnaround is improving quarter on quarter,
> **so that** I can tell whether a process change worked.

**Acceptance criteria**
- [x] `/management/trends` renders month-bucketed line charts
- [x] Buckets derived from real `createdAt` / `closedAt` timestamps
- [x] Computed server-side — `/management/trends` reads `useDocumentStats` and
      `useWorkflowInstanceStats` (DRIFT-07, 2026-09-21). *(Was: "Computed client-side; same
      scaling problem as G1".)*
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

> ~~⚠️ **This entire epic is currently a mock on both sides.**~~ *(2026-10-15: no longer
> true. The audit trail is real on both sides — H1 is 🟨. Findings (H2) are still mock and
> separation-of-duties checks (H3) are not built.)*

---

### H1 — See a complete, tamper-evident activity trail · 🟨 **Partial** *(was 🟥 Mock until 2026-10-15)*

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
- **Revised 2026-09-18 (DRIFT-11).** The above was true when written; confirmed wrong (or
  since shipped) against live behavior: `GET /audit`, `/audit/:id`, `/audit/export` and
  `/audit/verify` all exist and work, entries write automatically, and the hash chain
  checked out intact via `/audit/verify`. See doc 01 for the full writeup.
- ~~The frontend's `/auditor/trail` still renders `SEED.audit`~~ — **re-checked
  2026-10-15:** `/auditor/trail` reads `GET /audit` (`useAuditEntries`, `useExportAuditCsv`)
  and doc 05 lists it ✅ Live (confirmed in the product owner's testing, 2026-10-08).
  `/admin/audit` was wired to the real trail 2026-09-18. The status was left at 🟥 Mock
  after both moved; it is 🟨 rather than ✅ because several criteria below are unverified.
- `useCreateAuditLog()` still resolves after a 400 ms `setTimeout` and does nothing — the
  "action logged" toasts it drives are not audit entries.

**Acceptance criteria**
- [ ] Every mutating service writes an audit entry *(not audited service by service)*
- [x] Document view and download are logged — `documents.router.ts` records
      `document.viewed` and `document.downloaded` *(in code; not checked live)*
- [ ] Entries capture actor, actor type, action, object type, object ID, before/after diff,
      IP address and user agent
- [x] `entryHash` chains to `prevHash`; a verification endpoint proves chain integrity —
      `GET /audit/verify`, chain checked intact live 2026-09-18 (DRIFT-11)
- [ ] The database role used by the app cannot `UPDATE` or `DELETE` the table
- [x] `GET /audit` with filters by actor, object, action and date range — exists, and
      `/auditor/trail` uses it. ~~**`internal_auditor` is already granted
      `audit:view:global` and there is no endpoint to use it**~~
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

### I2 — Onboard a new employee · 🟨 **Partial** *(re-checked 2026-10-15 — most of this story has shipped)*

> **As** Bola,
> **I want to** invite a new joiner by email and have them set their own password,
> **so that** I never handle their credentials.

**Current state (re-checked 2026-10-15):** `POST /users` without a password emails the new
user a single-use, expiring set-password link (`authService.sendInvitation`, TTL
`INVITATION_TOKEN_TTL_HOURS`, since 2026-09-18). The user is **Pending** until they set a
password (PR #49), and `/admin/users` can resend the invitation. Self-service reset works
through `POST /auth/forgot-password` → the emailed `/reset-password` link, which
`next.config.ts` redirects to `/set-password`.

*Superseded:* "`POST /users` creates the account with an admin-supplied password. That is the
whole flow." — and the first three "missing" bullets below.

**Missing, and each is a genuine security gap:**
- ~~No invite token, no email, no magic link~~ — shipped 2026-09-18
- ~~No forced password change on first login~~ — moot: the user sets their own
- ~~No self-service password reset~~ — works (DRIFT-15 fixed 2026-09-18)
- No password-complexity policy (Zod validates a minimum length of 8 only)
- No account lockout or rate limiting on `POST /auth/login` — unlimited password guessing
- No SSO, though `User.passwordHash` is nullable specifically to accommodate it in Phase 4

**Acceptance criteria**
- [x] Admin can create a user with department and roles
- [x] A signed, expiring, single-use invitation token — sent by `POST /users` itself and
      resent by `POST /users/:id/invitation` (not a separate `POST /users/invite`)
- [x] Email delivery — `src/config/mailer.ts`, through a shared mailing Lambda
- [x] First-login password set — `/set-password?token=…`
- [x] Password reset — `POST /auth/forgot-password` + `POST /auth/reset-password`
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

> ✅ **Circulars wired 2026-10-05** against the backend `circulars` module (model,
> 15 routes, delivery and reminder workers), *(confirmed by the product owner’s testing, 2026-10-09)*, so J1/J2 are ✅.

---

### J1 — Broadcast a circular · ✅ **Done** *(was 🟥 Mock)*

> **As** Bola,
> **I want to** send a policy update to all staff and require acknowledgement,
> **so that** I have proof everyone was told.

**Current state (2026-10-05):** authoring lives at `/circulars/manage` (shared by
`client_admin`, `supervisor`, `management`, and read-only for `internal_auditor`;
`/admin/circulars` redirects there). A circular is written as a draft, then published now
or scheduled; recipients are fixed at publication. Published circulars change by
**revision** (same reference number, next version, everyone acknowledges afresh) or are
**withdrawn** with a reason.

**Acceptance criteria**
- [x] `Circular` model: title, body, audience, urgency, acknowledgement, publish/expiry dates — plus versioning, confidentiality and attachments
- [x] CRUD + publish endpoints — plus schedule, cancel, withdraw, revise
- [x] Audience targeting by role, department (optionally with sub-departments) or explicit user list
- [x] Fan-out to notifications on publish (backend delivery worker)
- [x] Acknowledgement endpoint — `POST /circulars/inbox/:id/acknowledge`
- [x] Acknowledgement compliance dashboard — stats, per-department breakdown and recipients report on `/circulars/manage/[id]`, with reminders
- [x] `circular.acknowledged` audit entry (backend `audit` middleware, with the version acknowledged)
- [x] Verified end to end against a live backend *(confirmed by the product owner’s testing, 2026-10-09)*

---

### J2 — Acknowledge a circular · ✅ **Done** *(was 🟥 Mock)*

> **As** Chika,
> **I want to** mark a circular as read,
> **so that** my compliance obligation is discharged and recorded.

**Acceptance criteria**
- [x] UI exists — `/circulars` inbox and `/circulars/[id]` reading view (the store's `markCircularAck` was removed 2026-10-05)
- [x] Persisted — `POST /circulars/inbox/:id/acknowledge`; opening a circular records the read receipt
- [x] Pending-acknowledgement badge driven by real data — `GET /circulars/inbox/summary`
- [x] Verified end to end against a live backend *(confirmed by the product owner’s testing, 2026-10-09)*

---

### J3 — Be notified when something needs me · 🟨 **Partial** *(was 🟥 Broken)*

> **As** any user,
> **I want** an in-app notification when a task is assigned to me, an SLA is about to
> breach, or a circular needs acknowledging,
> **so that** I don't have to poll the system to find out I'm blocking someone.

**Current state (re-checked 2026-10-15 against `edms-backend` `dev` `9998e05`): the pipe
is built and is now fed.** `notifyUser` / `notifyAssignment` / `notifyRole` are called from
`tasks.service.ts` (task assigned, changes requested, rejected, reassigned, delegated,
workflow completed), `sla.service.ts` (SLA warning and breach), `documents.service.ts`
(access requested, granted, denied), `checkout-overdue.service.ts` (overdue checkouts) and
`circulars.service.ts` (published, reminders). Doc 01 records this as DRIFT-10, resolved
2026-09-21. Stays 🟨 because nobody has yet clicked through a notification arriving end
to end (doc 05 lists `/notifications` as 🟨 for the same reason).

*Superseded (2026-09-04): "the pipe is built end to end and nothing is ever put into it."*

`src/modules/notifications/` now exists in full — router, controller, service, repository,
validation, types, swagger and an email worker — exposing **6 routes**. The frontend was
rewired to them on 2026-09-03 (commit `e07d8c3`): the bell badge and notification centre
read the live API instead of `SEED`, and delivery preferences got a UI for the first time.

~~**The one thing missing is the thing that matters.** There are **zero references to
`notifyUser` outside the notifications module itself.** No upload, task assignment,
approval, reassignment, delegation or SLA breach calls it. Every screen is correctly
wired to an endpoint that correctly returns an empty list, forever.~~ *(True on
2026-09-04; the call sites landed by 2026-09-21 — see above.)*

**Acceptance criteria**
- [x] `GET /notifications` (paginated, `unreadOnly` filter)
- [x] `GET /notifications/unread-count`
- [x] `PATCH /notifications/:id/read`, `POST /notifications/read-all`
      *(the frontend had been calling `mark-all-read`; fixed on our side —
      `read-all` pairs with `unread-count`)*
- [x] `GET`/`PUT /notifications/preferences`
- [x] Unread badge driven by the API rather than `SEED`
- [x] `NotificationPreference` model respected by the read/write endpoints
- [x] **Notifications actually emitted** on task assignment, completion, reassignment,
      delegation, SLA warning/breach and workflow outcomes *(in code since 2026-09-21,
      DRIFT-10; not yet clicked through end to end)*. ~~**nothing calls `notifyUser`**~~
- [ ] Notification when a date-bounded `Delegation` activates — `delegations` emits
      nothing; only per-task delegation (`task.delegated`) notifies
- [ ] Digest mode honoured by a scheduled job — *in code* (`notifications/workers/digest.workers.ts`,
      `pending_digest` status), not verified live
- [ ] Email channel — *in code* (`src/config/mailer.ts` sends through a shared mailing
      Lambda), not verified live. *(Was "no mail transport exists".)*
- [ ] Add a JSON 404 handler to `app.ts` so missing routes fail legibly (DRIFT-10b — still
      open 2026-10-15: `app.ts` mounts only `errorHandler` after the routers)

> ~~⚠️ **A demo caveat.** Where a demo previously showed a fabricated unread count from
> `SEED`, it now correctly shows **0** until something writes a notification.~~ No longer
> applies: real events write notifications now.

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

**Current state:** 🟥 `/platform/flags` is its own page since 2026-10-08 (it used to
re-export `/platform/sysconfig`): rollout slider, promote and kill-switch, all writing to
`SEED` through `updateFeatureFlag`. No model, no endpoint, no evaluation anywhere.

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
- [x] No frontend file is `@ts-nocheck` — `doc/[id]` and `search` lost it in September,
      `admin/workflows` on 2026-10-08
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
| B — Retrieval & Search | 1 | 3 | 0 | 0 | Search indexes every document since PR #51 (2026-10-14); download gated and audited (2026-10-08) |
| C — Routing & Approval | 2 | 3 | 0 | 0 | Task execution solid; workflow routes authorized (DRIFT-05); ~~routing **blocked for non-admins** by the RBAC seed~~ routing works on the live tenant; the seed lacks `workflow:view` for non-admins, so a fresh database would block it (DRIFT-14, re-tested 2026-10-16) |
| D — Version & Custody | 2 | 1 | 0 | 0 | Strongest area of the product |
| E — Access Control | 1 | 3 | 0 | 0 | Well designed; under-enforced on reads |
| F — Oversight & SLA | 3 | 1 | 0 | 0 | Workload, ageing and the instance monitor all on real read models; SLA warnings and breaches notify (in code, DRIFT-10) |
| G — Executive Reporting | 0 | 3 | 0 | 0 | On server aggregation endpoints (DRIFT-07); no PDF export or forecasting |
| H — Audit & Compliance | 0 | 1 | 1 | 1 | Audit trail real (H1 🟨, 2026-10-15); findings mock; SoD not built |
| I — Tenant Admin | 1 | 1 | 2 | 0 | Structure real; policy/branding mock |
| J — Circulars & Notifications | 2 | 1 | 0 | 0 | Circulars live (confirmed 2026-10-09); notifications emitted from real events (in code, DRIFT-10), not yet clicked through |
| K — Platform Ops | 0 | 0 | 5 | 0 | **Entirely mock** by design (Phase 2) |
| **Total** | **14** | **18** | **8** | **2** | 42 functional stories |

*(2026-10-15: H1 moved 🟥 → 🟨, so Partial 16 → 17 and Mock 9 → 8. 2026-10-19: C2 moved
✅ → 🟨 (no urgency ordering), so Done 15 → 14 and Partial 17 → 18. Totals re-tallied from
the story headings, not carried forward.)*

**The honest one-paragraph summary (revised 2026-10-15):** the *document* half of this EDMS
— capture, filing, versioning, checkout, classification, search, task execution and
approval — is genuinely built and mostly works. Audit, notifications and circulars have
since moved onto real backends. What is still a UI over fixture data is policies (except
the SLA tab), findings, branding and platform operations. ~~The one defect that still sits
across the seam is **DRIFT-14**: the roles that route documents cannot list workflow
definitions, because the RBAC seed grants `workflow:view` only to the two admin roles.~~
*Re-tested 2026-10-16:* DRIFT-14 doesn't affect the live tenant, whose roles still hold
`workflow:view:global`; it is a seed gap that a freshly seeded database would hit.

*Superseded (written 2026-08-29):* "Two defects … **workflow routes have no authorization at
all**, and **the audit trail … has never recorded a single event.**" The first was fixed
2026-09-04 (DRIFT-05) and the second was confirmed wrong 2026-09-18 (DRIFT-11).

**Revised 2026-09-04.** Two stories moved. **C1 (routing) is fixed** — the two-call
create-then-start sequence shipped, which released the entire approval half of the
product. **J3 (notifications) moved from broken to partial** — the backend module, its six
endpoints and the whole frontend surface now exist, but nothing calls `notifyUser`, so the
list is correctly and permanently empty. Neither of the two cross-cutting defects above
has changed, and fixing C1 made the authorization hole *reachable from the UI* rather than
merely present in the API.

**Revised again 2026-09-04**, after `feature/management` merged into `dev`. Frontend only —
no backend moved, so the two cross-cutting defects still stand. **F4 (monitor running
workflows) is new and Done**, bringing the Done total to 12. **A4** and **E2** gained
admin UI (metadata-field editor, cabinet-access editor) and lost their *(backend only)*
tag, though both stay Partial — A4 still captures no values and E2 still isn't enforced on
reads. **C1**'s route-to-workflow picker reached the document and upload screens. **B3**'s
workflow activity trail is now live data. The F4 monitor exposes hold/resume/close in the
UI, which widens the blast radius of the unchanged DRIFT-05 authorization hole: pausing or
closing any tenant's workflow instance is now a two-click operation for any signed-in user.

**Re-scanned 2026-09-04 (evening)**, after `feat(workflow): close workflow gaps 1-10`
landed on the backend. This is the first revision where a *cross-cutting* defect moved.

- ✅ **The workflow authorization hole is closed.** All five workflow services —
  definitions, instances, tasks, delegations, sla — now assert roles and throw a named
  `403`. C1, C5 and F4 have lost the caveat they carried since this document was written.
  It was the highest-severity finding here for a week.
- 🔴 **C1 is blocked again, by a new cause (DRIFT-14).** The same commit set
  `WORKFLOW_DEFINITION_VIEW_ROLES = WORKFLOW_DEFINITION_MANAGE_ROLES`, so only
  `client_admin` and `schulltech_admin` can read definitions. `staff` and `supervisor`
  hold `workflow:route` and can no longer list what to route into; the picker reports
  "no published workflows". **C1 stays Done as built** — the frontend is correct — but the
  journey does not complete. Tracked as DRIFT-14, not as a story regression.
- 🔄 **G1–G3 are now a frontend task.** Eight server-side aggregation endpoints exist
  (instance stats, status counts, bottlenecks-ageing, team-status-matrix,
  open-items-by-cabinet, task stats, SLA breaches, document stats). The frontend consumes
  one. These stories stay Partial, but the reason changed from "the backend has nothing"
  to "the frontend has not adopted it".
- 🔄 **B1's dependency moved.** OCR now uses the asynchronous Textract API against the
  correct bucket, so multi-page documents are supported. Search still returns nothing
  because the upload still goes to a third-party gateway — now a frontend-only fix.
- **Unchanged:** the audit trail (H1, H2) has still never recorded an event, and nothing
  still calls `notifyUser` (J3). *(Both later changed: the audit trail is real since
  2026-09-18 (DRIFT-11) and `notifyUser` is called since 2026-09-21 (DRIFT-10).)*

Story statuses themselves are unchanged by this scan. What changed is *why* several of
them are where they are, and who owns moving them.

**Revised again**, after the frontend was wired to the backend's Workflow Module read
models (`status-counts`, `team-status-matrix`, `open-items-by-cabinet`,
`bottlenecks-ageing`, `tasks/approvals`, `tasks/workload`, `sla/breaches`, `delegations`) —
all confirmed live against the deployed Swagger doc, no backend changes. **F1 moves to
Done**; **F2** and **C4** both tick further boxes without changing status. Done climbs to
13, Partial drops to 15. The client-side `/tasks` page-walking stopgap (`useAllTasks` /
`fetchAllPages`) is now retired from every supervisor screen except the three
`/management/*` dashboards, which this pass deliberately left alone — the Workflow Module
API guide itself scopes Team Performance metrics and the Management Dashboard as separate
modules (§11), and its own §10 flags that several of these read models (including
`tasks/stats` and `workflow-instances/stats`, which back those dashboards) aren't yet
department-scoped for supervisors server-side. DRIFT-14 (workflow definitions unreadable
by `staff`/`supervisor`) is unaffected by this pass — C1 still doesn't complete end to end.
