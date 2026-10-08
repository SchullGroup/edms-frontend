# Backend API spec: changes the frontend is waiting on

**Date:** 2026-10-08 · **Checked against:** `edms-backend` `dev` at `2db7e19` · **Author:** frontend

Each item says what is wrong today, the change, the contract, who may call it, and how we will
know it is done. Code pointers are to `dev` at `2db7e19`. The frontend side of every item is
already built, or will be the day the endpoint ships; nothing here needs a frontend decision first.

Items marked **Decide** need a call from the backend team before building. Everything else is a
direct ask.

## Summary

| # | Change | Endpoints | Priority | Size |
|---|---|---|---|---|
| S1 | Stop returning users' password hashes | `GET /cabinets/:id`, cabinet access lists | **P0 security** | XS |
| S2 | Only hand a download URL to callers with `document:download` | `GET /documents/:id`, `GET /documents`, version list, `/export`, `/print` | **P0 security** | M |
| S3 | Enforce grant rules on cabinet access | `POST /cabinets/:id/access` | **P0 security** | S |
| W1 | Per-document stage, status and due date in task lists | `GET /tasks`, `GET /tasks/approvals` | P1 | XS |
| W2 | Per-document executions in the workflow instance list | `GET /workflow-instances` | P1 | XS |
| W3 | On-time reporting endpoint | new `GET /sla/outcomes/summary` | P1 | M |
| D1 | Accept metadata on upload | `POST /documents`, `POST /documents/batch` | P1 | S |
| D2 | Let a metadata value be cleared | `PUT /documents/:id/metadata` | P2 | XS |
| D3 | Re-index search when a document changes | metadata, title, restore | P1 | S |
| D4 | Move documents between cabinets and to the cabinet root | `PATCH /documents/:id` | P2 | S |
| D5 | `departmentId` filter on lists | `GET /documents`, `GET /workflow-instances` | P2 | S |
| D6 | All filters on full-text search | `GET /documents/search` | P2 | S |
| O1 | `departmentId` on the signed-in user | `POST /auth/login`, `GET /auth/me` | P1 | XS |
| O2 | Limit departments to one level of nesting | `POST /departments`, `PATCH /departments/:id` | P2 | XS |
| T1 | Optional signature on the review action | `POST /tasks/:id/action` | P2 | XS |
| I1 | Keep OCR word positions | OCR worker + new read endpoint | P2 | M |
| I2 | Office/email previews, text extraction, ZIP intake | upload pipeline | P2 | L |
| X1 | **Decide:** watermark downloaded copies | download path | P3 | M |
| X2 | Delete unused access rules | `listInstanceDocuments` | P3 | XS |
| M1 | Check the edited migrations before the next deploy | deploy | **Before next deploy** | XS |

---

## Security

### S1. Stop returning users' password hashes

**Problem.** `cabinets.repository.ts` includes the whole `user` record on access grants at
lines 38, 89 and 101 (`include: { role: true, user: true }`). `GET /cabinets/:id` therefore
returns every user grantee's full row, `passwordHash` included.

**Change.** Replace `user: true` with a select of safe fields in all three places:

```ts
user: { select: { id: true, name: true, email: true, status: true, departmentId: true } }
```

Worth a grep for any other `user: true` include that reaches a response.

**Done when** no response from `/cabinets` contains `passwordHash`, and a repo-wide grep finds no
`user: true` include on a path that is returned to a client.

### S2. Only hand a download URL to callers with `document:download`

**Problem.** `0dab81a` made downloading need `document:download`, and
`GET /documents/:id/versions/:versionId` checks it. But every other document response still
carries a signed S3 URL that downloads the file:

| Where | Code |
|---|---|
| `GET /documents/:id` | `documents.service.ts` line 248, `withFileUrl(document.currentVersion)` |
| Every row of `GET /documents` | line 272 |
| Version list | lines 344 and 385, `withFileUrlList` |
| `/export`, `/print` | return `getDocumentById`, so the same URL |

A viewer without `document:download` can save the file from that URL.

**Change.** Two kinds of URL:

- **Preview:** on `GET /documents/:id` only, a short-lived URL served inline
  (`ResponseContentDisposition: 'inline'`), for anyone who can view the document. Suggested
  name `currentVersion.previewUrl`; 5 minutes is enough (the viewer loads the file once).
- **Download:** an attachment URL (`ResponseContentDisposition: 'attachment; filename="…"'`),
  returned only by `GET /documents/:id/versions/:versionId` and only to callers that pass
  `requireConfidentiality('download')`. Suggested name `downloadUrl`.
- `GET /documents` rows and the version list return neither.

An inline URL can still be saved by a determined user, so this narrows the gap rather than
closing it. Closing it fully means streaming the file through the API.

**S3 CORS: no change needed.** The bucket answers `Access-Control-Allow-Origin: *` for `GET`
with a `range` preflight (checked 2026-10-08), which is what the new pdf.js viewer needs.

**Frontend follow-up.** The viewer reads `previewUrl`; Download already goes through the
versions endpoint. Until this ships the frontend keeps reading `currentVersion.fileUrl`, so
please keep `fileUrl` on `GET /documents/:id` until we confirm the switch (or alias it).

**Done when** a user with `document:view` but without `document:download` gets no attachment URL
from any document endpoint, and still sees the document in the viewer.

### S3. Enforce grant rules on cabinet access

**Problem.** `cabinets.service.ts` `grantAccess` (line 84) checks only that the cabinet exists
and a role or user is given. The UI stops people granting themselves access, granting a role they
hold, or granting a level above their own, but the API accepts all three.

**Change.** For callers without the cabinet-access bypass (`client_admin`):

- Reject `userId` equal to the caller: `403 FORBIDDEN_SELF_GRANT`.
- Reject `roleId` that the caller holds: `403 FORBIDDEN_OWN_ROLE_GRANT`.
- Reject a `permission` above the caller's own level on this cabinet, using the same
  `PERMISSION_HIERARCHY` as `cabinet-access.middleware.ts`: `403 FORBIDDEN_LEVEL`.

**Done when** each of the three returns 403 for a non-admin, and a client_admin can still grant
anything.

---

## Workflow data (since multi-document routing, `919d0ef`)

Since `919d0ef` the list endpoints return no stage or deadline, so the frontend cannot show due
dates, overdue filters, the Workflow Monitor's Stage/Due columns, or on-time rates.

### W1. Per-document stage, status and due date in task lists

**Problem.** `Task.dueAt` is gone; deadlines live on `WorkflowDocumentExecution.stageDueAt`.
`workflowTaskListInclude` (`tasks.repository.ts` line 19) selects only the execution `id`, so
`GET /tasks` and `GET /tasks/approvals` (both use it) return no deadline.

**Change.** In `workflowTaskListInclude` → `documents.select.workflowDocumentExecution.select`, add:

```ts
currentStage: true,
status: true,
stageDueAt: true,
```

**Optional, makes the lists correct across pages.** Both lists are paginated by `createdAt asc`,
so the frontend can only sort or filter the page it holds:

- `sort=dueAt` on both: earliest `stageDueAt` among the task's active executions.
- `overdue=true` on `GET /tasks`: tasks with any active execution whose `stageDueAt` is past.

**Done when** `GET /tasks?limit=1` returns `documents[].workflowDocumentExecution.stageDueAt`.

### W2. Per-document executions in the workflow instance list

**Problem.** `WorkflowInstance` no longer has `currentStage` or `stageDueAt`. `listInstances`
(`instances.repository.ts` line 16) selects each document's `id`, `status` and dates, but no
executions.

**Change.** In `listInstances` → `include.documents.select`, add:

```ts
executions: {
  where: { status: { in: ['pending', 'in_progress', 'on_hold', 'waiting'] } },
  select: { id: true, parentExecutionId: true, currentStage: true, status: true, stageDueAt: true },
},
```

The `where` keeps the payload small on long-running workflows; drop it if completed executions
are cheap. Not needed on `GET /workflow-instances/:id`.

**Done when** `GET /workflow-instances?limit=1` returns `documents[].executions[].stageDueAt`.

### W3. On-time reporting endpoint

**Problem.** The frontend computed on-time % from `Task.completedAt` vs `Task.dueAt`; `dueAt` is
gone. `WorkflowSlaOutcome` (`workflow.prisma` line 242) records one row per completed execution
SLA cycle with `isOnTime`, `departmentId`, `stage` and `completedAt`, but nothing reads it. This
also replaces the per-user stats `GET /tasks/stats` can't give (it groups by department only and
its schema is strict).

**Contract.**

```http
GET /api/v1/sla/outcomes/summary?from=2026-09-01&to=2026-09-30&groupBy=user&departmentId=<uuid>&userId=<uuid>
```

| Parameter | Meaning |
|---|---|
| `from`, `to` | Range on `completedAt`, inclusive dates (required) |
| `groupBy` | `user`, `department` or `stage` (optional; omit for one total) |
| `departmentId` | Narrow to one department (optional) |
| `userId` | Narrow to one person (optional) |

```json
{
  "total": 42, "onTime": 37, "late": 5, "onTimeRate": 0.881,
  "groups": [
    { "key": "<userId>", "label": "Ada Obi", "total": 12, "onTime": 11, "late": 1, "onTimeRate": 0.917 }
  ]
}
```

**Permissions.** Suggested `task:view` with its scope: `own` sees only their own figures,
`department` their department, `global` everything. Staff need `own`, so it must not require
oversight the way `/tasks/stats` does.

**Decide.** Outcomes have `taskId` but no person. Grouping by user needs a join to
`Task.completedBy`, or a `completedBy` column on `workflow_sla_outcomes` (simpler to query and
index; backfill from `Task`).

**Done when** a staff user gets their own on-time rate for a month, and a supervisor gets their
department grouped by user.

---

## Documents

### D1. Accept metadata on upload

**Problem.** `UploadDocumentInputSchema` (`documents.validation.ts` line 30) has no metadata.
The upload form saves metadata afterwards with `PUT /documents/:id/metadata`, which needs
`document_metadata:edit` and edit on the cabinet, so staff (who can upload) can't save metadata
at all. A workflow condition on an empty field then silently doesn't match.

**Change.** Add to `UploadDocumentInputSchema` (and so to each item of `/batch`):

```ts
metadata: z.array(z.object({
  fieldId: z.uuid(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})).optional(),
```

Validate and normalise with the same per-field logic as `updateDocumentMetadata`, inside the same
transaction as the document, under the upload permission. Reject unknown fields and missing
required fields with 400, as the update does.

**Done when** a staff user's upload with required metadata saves it, and an upload missing a
required field fails with 400 and creates nothing.

### D2. Let a metadata value be cleared

**Problem.** In `updateDocumentMetadata` (`documents.service.ts` around line 559) a value that
normalises to `null` is skipped, so a wrong value can be overwritten but never removed.

**Change.** `value: null` (or `""`) on a non-required field deletes that field's stored value.
On a required field it is a 400.

**Done when** `PUT … [{ fieldId, value: null }]` removes an optional field's value.

### D3. Re-index search when a document changes

**Problem.** Only OCR completion queues indexing (`ocr.workers.ts` line 105,
`searchIndexQueue.add`). Changing metadata, the title, or restoring a version never re-indexes,
so search goes stale. Files whose OCR fails (all DOCX/XLSX today) are never indexed, so they
can't be found even by title.

**Change.** Queue `searchIndexQueue.add('index', { documentId })` after
`updateDocumentMetadata`, after `updateDocument` when `title` or `documentType` changes, after
`restoreVersion`, and when OCR fails (index title and metadata with no body text).

**Done when** a document is findable by a metadata value set after upload, and a DOCX is findable
by its title.

### D4. Move documents between cabinets and to the cabinet root

**Problem.** `UpdateDocumentInputSchema` (line 79) has no `cabinetId` and `folderId` can't be
`null`. Cross-cabinet moves are dropped, nothing checks the folder belongs to the cabinet, and a
document can't be moved out of a folder.

**Change.** Accept `cabinetId?: uuid` and `folderId?: uuid | null`. Check the target folder
belongs to the target cabinet (400 `FOLDER_NOT_IN_CABINET`), and require upload on the target
cabinet plus edit on the source.

**Done when** a move to another cabinet's folder works, a mismatched folder is rejected, and
`folderId: null` puts the document at the cabinet root.

### D5. `departmentId` filter on lists

**Problem.** Management charts are per department, but a bar can't open the records behind it:
`ListDocumentsQuerySchema` (line 62) and the instance list take no department.

**Change.** `departmentId?: uuid` on `GET /documents` (documents whose cabinet is in that
department) and `GET /workflow-instances` (instances with any document in such a cabinet). Scope
rules still apply on top.

**Done when** both lists return only that department's records.

### D6. All filters on full-text search

**Problem.** `SearchDocumentsQuerySchema` (line 131) takes only `q` and `cabinetId`. With words
typed, the Search page can't also filter by type, status, confidentiality or urgency.

**Change.** Accept the same `documentType`, `status`, `confidentiality`, `urgency` and `folderId`
as `ListDocumentsQuerySchema`, applied in the same query.

**Done when** `GET /documents/search?q=invoice&status=closed` returns only closed matches.

---

## Users and organisation

### O1. `departmentId` on the signed-in user

**Problem.** Login and `/auth/me` (the user object built in `auth.service.ts` around line 298)
carry no `departmentId`. The frontend makes an extra `GET /users/:id` to learn it, which needs
`user:view`. A custom role with department-scoped clearance but no `user:view` therefore gets
fewer options in the UI than the API would allow.

**Change.** Add `departmentId` (nullable) to the user object returned by `POST /auth/login` and
`GET /auth/me` (and by the token refresh, if it returns the user).

**Done when** `GET /auth/me` returns `user.departmentId`.

### O2. Limit departments to one level of nesting

**Problem.** The UI offers one level of sub-departments; the API accepts any depth
(`departments.service.ts` around lines 45 and 54 check only that the parent exists).

**Change.** On create and update, reject a `parentId` whose department itself has a parent
(400 `DEPARTMENT_DEPTH`), and reject giving a parent to a department that has children.

**Done when** creating a third-level department returns 400.

---

## Tasks

### T1. Optional signature on the review action

**Problem.** `taskActionSchema` (`tasks.validation.ts` line 161) allows a signature only on
`approve`. Reviewers want to sign when marking a document reviewed.

**Change.** Add `signature: taskApprovalSignatureSchema.optional()` to the `review` branch, and
store it the way approve does (`tasks.service.ts` line 1867).

**Done when** a review with a signature shows it in `GET /workflow-history`, and a review without
one still works.

---

## Ingestion and OCR

### I1. Keep OCR word positions

**Problem.** The OCR worker keeps only `LINE` text (`ocr.workers.ts` lines 51–52) in
`DocumentVersion.ocrText`. Textract also returns every `WORD` with its page and bounding box,
which is thrown away. The viewer can search a scan's OCR text (shipped 2026-10-08), but can't
highlight matches on the page images without positions.

**Change.**

- In the worker, also collect `WORD` blocks: `Text`, `Page`, `Geometry.BoundingBox`
  (`Left`, `Top`, `Width`, `Height`, already 0–1 ratios of the page), in the same `NextToken`
  loop that already collects the lines.
- Store per version, e.g. a JSONB column `ocrLayout` on `document_versions`:

  ```json
  { "pages": [ { "page": 1, "words": [ { "t": "Ridgeline", "x": 0.081, "y": 0.064, "w": 0.112, "h": 0.017 } ] } ] }
  ```

- Serve it from `GET /documents/:id/versions/:versionId/ocr-layout`, gated like viewing the
  document (`document:view` + `requireConfidentiality('view')`), not like downloading.

**Done when** the endpoint returns word boxes for the scanned delivery note
("DN 2026 0921 delivery note scanned") and existing versions can be backfilled by re-running OCR.

### I2. Office/email previews, text extraction and ZIP intake

**Problem.** The PRD needs PDF, Office (Word/Excel/PowerPoint), JPG/PNG/TIFF and email
(EML/MSG), plus ZIP archives expanded on ingestion, with previews and OCR for scans. Today every
file goes to Textract, which fails on DOCX/XLSX; those are never indexed (see D3) and only PDF and
JPG/PNG preview.

**Change (agreed approach).**

- At upload, render a PDF preview copy: LibreOffice for Office files; header + body for email,
  with each attachment filed as its own linked document.
- Extract text directly from born-digital files; OCR only images and scanned PDFs.
- Index title and metadata even when there is no text (D3).
- Expose the preview copy's URL on the version, so the viewer shows it in place of the original.

The frontend will accept the new types, expand ZIPs in the browser into one upload per file, and
show the preview copy in the existing viewer. Rejected: Microsoft's Office viewer (sends
documents to a third party).

**Done when** a DOCX uploads, previews as PDF, and is findable by its text.

---

## Optional

### X1. Decide: watermark downloaded copies

Confidential and higher documents carry the viewer's name as a watermark on screen and in print
(drawn by the frontend). A downloaded copy is the original file. If downloads should carry it too,
the download path would stamp a copy, e.g. with `pdf-lib`: tier + user name + timestamp, diagonal,
on every page. Non-PDF files can't be stamped this way; options are refusing download above a tier
or serving the PDF preview copy from I2. **Needs a product decision before building.**

### X2. Delete unused access rules

`instances.repository.ts` `listInstanceDocuments` builds a `documentAccessRules` array (line
1268) that the query never applies. That matches the agreed rule: anyone on a workflow stage sees
all its documents, and opening a file still goes through `GET /documents/:id`. Delete the array so
it isn't mistaken for live access control.

---

## Deploy

### M1. Check the edited migrations before the next deploy

`bca2a35` ("fixed migration issue") changed four migration files that the live database had
already applied. `prisma migrate deploy` normally refuses a migration whose file changed after it
ran, so the next deploy may fail with a checksum mismatch.

**Ask.** Run the next deploy against a copy of the live database before merging to the deploy
branch. If it fails, move the self-heal SQL into a new migration and restore the original files.

**Seeding note.** `0dab81a` added six document permissions (`view_confidential`,
`view_restricted`, `view_top_secret`, `download`, `export`, `print`). Each tenant needs
`db:setup` (or the seed) re-run before its roles get them; until then even client_admin can't
open Confidential documents. The test tenant has been re-seeded (checked 2026-10-08).
