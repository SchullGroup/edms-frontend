# EDMS — End-to-End Test Plan

**Purpose:** a manual (later automatable) checklist that simulates a real tenant —
departments, a mix of system and custom roles, several staff/supervisors, two workflows —
and walks every module through its happy path plus the edge cases that actually break
systems like this: assignment, overdue/SLA, completion, checkout, and cross-department
authorization.

**Target:** the live deployment at `https://edms-backend-zmfm.onrender.com/api/v1`
(confirmed against its own OpenAPI spec — see `docs/BACKEND_REQUESTS.md` for how the
Swagger enum can lag the real validator; re-verify anything marked ⚠️ against the live
response, not this doc).

Every step lists: the call, who makes it, the expected result, and *why it matters*. Steps
are numbered so a bug report can cite one (`TP-C3`, `TP-I2`, …).

> **Scope note.** Sections 0–11 (Phases A–I) are the original workflow-module plan and are
> API-level (raw calls, curl-style). Sections 12+ (Phases J onward) cover everything
> integrated in the 2026-09-18 session — audit, access requests, comments/signatures,
> user/password flows, role permission scope, and the cabinet browser rework — and are
> **UI-level** (click through the actual app at whatever URL you're running it on), since
> that's what was actually built. Each still lists the underlying API call being exercised
> so you can fall back to curl if a UI step is ambiguous.

---

## 0. Before you start

- [ ] Confirm `POST /auth/login` works for a throwaway account and note the token TTL —
      the whole script re-logs-in per user rather than sharing tokens.
- [ ] **Check DRIFT-14 hasn't regressed:** log in as a plain `staff` user and call
      `GET /workflows?status=published`. If this 403s or returns empty for a workflow you
      know is published, stop — routing will fail at step TP-B3 for a reason that has
      nothing to do with your test, and it's worth confirming before you build anything on
      top of it.
- [ ] Note that `sla_hours` has a **minimum of 1** (hour) — you cannot script a sub-hour
      SLA breach. Phase I is designed around this; budget real wall-clock time for it or
      run it separately/overnight.

---

## 1. The simulated company

### Departments (`POST /departments`)

| Name | Used for |
|---|---|
| Finance | Invoice approval workflow, role-pool assignment |
| Legal | Contract review workflow, direct-user assignment, fast SLA testing |
| Operations | The "other department" for cross-department 403 tests |

### Cabinets (`POST /cabinets`, one per department — `departmentId` is what scopes a
supervisor's visibility to "their own department")

| Cabinet | departmentId |
|---|---|
| Finance — Vendor Invoices | Finance |
| Legal — Contracts | Legal |
| Operations — Facilities | Operations |

Add one folder to each cabinet (`POST /cabinets/{id}/folders`) — folder selection is
compulsory on upload.

### Users (`POST /users`, then `POST /users/{id}/roles`)

Use one password for the whole test tenant (e.g. `TestPass123!`) and a consistent email
scheme so scripts can derive credentials from role/department alone:

| Name (email pattern: `<slug>@acmetest.io`) | Department | Role(s) | Purpose |
|---|---|---|---|
| ada.finance (`supervisor_finance`) | Finance | `supervisor` | Approves Finance tasks; department-scope boundary tester |
| chinedu.finance (`staff_finance_1`) | Finance | `staff` | Role-pool contender #1 |
| ngozi.finance (`staff_finance_2`) | Finance | `staff` | Role-pool contender #2 — **same role, same stage, race-condition test** |
| bola.legal (`supervisor_legal`) | Legal | `supervisor` | Approves Legal tasks; the "other" supervisor for cross-dept tests |
| femi.legal (`staff_legal_1`) | Legal | `staff` | Direct `user_id`-assigned stage owner |
| tunde.ops (`supervisor_ops`) | Operations | `supervisor` | Exists only to be denied access to Finance/Legal data |
| adaeze.admin (`client_admin`) | — | `client_admin` | Creates departments, cabinets, workflows, roles |
| david.mgmt (`management`) | — | `management` | Read-only oversight checks |
| chika.audit (`internal_auditor`) | — | `internal_auditor` | Read-only oversight checks |
| kemi.reviewer (`finance_reviewer` — **custom role**) | Finance | custom | Proves a freshly created role actually works end to end |

### Custom role (this is the part the system-role set can't cover)

- [ ] **TP-0a.** `POST /roles` → `{name: "finance_reviewer", description: "..."}`.
- [ ] **TP-0b.** `PUT /roles/{id}/permissions` with a deliberately mixed payload:
      `document:view`, `document:create`, `workflow:route` (values from the documented
      enum) **plus** `role:view` and `document:upload` (values that are in the *live*
      runtime enum per our earlier investigation but missing from the stale Swagger doc).
      **Record which ones the live validator actually accepts.** This is a real open
      question, not a formality — the last time we checked, the Swagger doc and the
      runtime 400 disagreed with each other.
- [ ] **TP-0c.** Assign `finance_reviewer` to kemi.reviewer. Confirm `GET /auth/me` for
      kemi shows the new permission set immediately (no re-login needed, per the docs'
      claim that permissions are "rebuilt from the DB on every request").

### Workflows (`POST /workflows`, then `POST /workflows/{id}/publish` as client_admin)

**"Standard Invoice Approval"** (Finance) — tests role-pool assignment and a normal SLA:

```json
{
  "stages": [
    { "id": "review",  "role": "staff",      "sla_hours": 4, "actions": ["review", "request_changes"] },
    { "id": "approve", "role": "supervisor", "sla_hours": 8, "actions": ["approve", "reject", "request_changes"] }
  ],
  "transitions": [{ "from": "review", "to": "approve" }]
}
```

**"Contract Fast-Track Review"** (Legal) — tests direct `user_id` assignment and doubles
as the dedicated SLA-breach workflow (`sla_hours: 1`, the API's minimum):

```json
{
  "stages": [
    { "id": "legal_review", "user_id": "<femi.legal's id>", "sla_hours": 1, "actions": ["review", "request_changes", "delegate"] },
    { "id": "legal_approve", "role": "supervisor", "sla_hours": 2, "actions": ["approve", "reject"] }
  ],
  "transitions": [{ "from": "legal_review", "to": "legal_approve" }]
}
```

---

## 2. Phase A — Happy path (per workflow)

- [ ] **TP-A1.** Upload a document into the Finance cabinet/folder as chinedu.finance
      (`POST /documents`). Confirm `status: pending`, `isCheckedOut: false`.
- [ ] **TP-A2.** `POST /workflow-instances` for that document + the published Invoice
      workflow, as the document creator. Expect `201`, `status: pending`.
- [ ] **TP-A3.** `POST /workflow-instances/{id}/start` as the creator. Expect `200`,
      `status: in_progress`, `currentStage: review`, `stageDueAt` ≈ now + 4h, and a task
      created with `assignedRoleId` = Finance's `staff` role, `assigneeId: null`.
- [ ] **TP-A4.** Confirm the task shows up in `GET /tasks` for **both** chinedu and ngozi
      (same role, role-pool) but for neither bola nor tunde.
- [ ] **TP-A5.** chinedu actions it: `POST /tasks/{id}/action` `{action: "review"}`.
      Expect `200`; instance advances to `approve`, new task created for the Finance
      `supervisor` role (ada), old task `status: completed`, `completedBy: chinedu`.
- [ ] **TP-A6.** ada approves: `{action: "approve", signature: {...}}`. Expect `200`,
      instance `status: closed`, `closedAt` set, and — check this explicitly — the
      **document's** `status` also reflects closure (`GET /documents/{id}`).
- [ ] **TP-A7.** `GET /workflow-history?workflowInstanceId=...` — confirm a clean
      `workflow_started → review → approve → workflow_closed` trail, each with the right
      `actorId`, and the approval row carries the signature reference.
- [ ] **TP-A8.** Repeat A1–A7 for the Legal workflow, confirming the `legal_review` task
      is assigned by **`assigneeId` = femi's id** (not a role), and that nobody else
      (bola included) sees it in their own `GET /tasks`.

## 3. Phase B — Assignment race condition

- [ ] **TP-B1.** Start a fresh Invoice instance. Have chinedu and ngozi both fetch the
      same `review` task, then both submit `{action: "review"}` as close together as you
      can manage. Expect exactly one `200`; the second call should fail — confirm whether
      it's `404` (task no longer pending) or `409` (state conflict) and record which,
      since the docs don't commit to one.

## 4. Phase C — Reassignment vs. task-level delegation vs. out-of-office delegation

- [ ] **TP-C1 (reassign).** As ada, `PATCH /tasks/{id}/reassign` a Finance task to ngozi.
      Expect the **original** task to end at `status: reassigned` (not deleted — check
      it's still fetchable by ID) and a **new** `pending` task to exist for ngozi.
- [ ] **TP-C2 (reassign, cross-department, expect denial).** As ada (Finance supervisor),
      try to reassign a **Legal** task, or reassign a Finance task to tunde.ops (wrong
      department). Expect `403` both ways.
- [ ] **TP-C3 (task-level delegate).** As femi, on his `legal_review` task:
      `{action: "delegate", delegateId: "<bola's id>"}`. Expect `200`, femi's task
      `status: delegated`, a new task created for bola at the **same stage**.
- [ ] **TP-C4 (out-of-office delegation, broad).** `POST /delegations` as femi:
      `{delegateId: bola, startsAt: now, endsAt: +7d, scope: null}`. Confirm femi's
      *existing and future* tasks become actionable by bola without any per-task delegate
      call — this is the automatic path, distinct from C3.
- [ ] **TP-C5 (self-delegation, expect rejection).** femi delegates to himself, both via
      C3's shape and C4's shape. Expect both to be rejected (client- or server-side —
      confirm which).
- [ ] **TP-C6 (delegation scoping).** Create a delegation scoped to `{cabinets: [Finance
      cabinet id]}` for a Legal user who has no Finance tasks. Confirm it simply has no
      effect (no tasks appear) rather than erroring.
- [ ] **TP-C7 (end early).** `POST /delegations/{id}/end`. Confirm `isActive` flips to
      `false` and the delegate immediately stops seeing the delegator's tasks.

## 5. Phase D — Hold / resume

- [ ] **TP-D1.** Mid-instance, `POST /workflow-instances/{id}/hold` as ada. Expect
      `status: on_hold`. Confirm the bottlenecks-ageing read model now reports this item's
      SLA status as `paused`, not `breached`, even if the original `stageDueAt` has
      already passed.
- [ ] **TP-D2.** `POST .../resume`. Confirm `stageDueAt` is **recalculated from the resume
      time**, not the original start time (per the spec: "restarts its current-stage SLA").
- [ ] **TP-D3 (wrong state, expect 409).** Try to hold an already-`on_hold` instance, and
      resume an `in_progress` one. Both `409`.

## 6. Phase E — Rejection, request_changes, and terminal states

- [ ] **TP-E1 (request_changes).** From `approve`, ada sends `{action:
      "request_changes"}`. Confirm the instance returns to `review` (the *previous*
      stage per the transition table) and a fresh task is created there — for the whole
      role pool again, not just whoever last held it.
- [ ] **TP-E2 (reject terminates).** From either stage, reject. Confirm `status: closed`
      immediately — reject does **not** go back a stage, it ends the workflow (don't
      confuse with `request_changes`).
- [ ] **TP-E3 (admin direct close, mid-flight).** As adaeze (client_admin), `POST
      /workflow-instances/{id}/close` on an instance that's only completed its first
      stage. Confirm it closes without requiring the remaining stage's action, and that
      this is **rejected with 403 if attempted by ada** (supervisor can hold/resume but
      not direct-close — re-read the spec: only supervisor/client_admin/schulltech_admin
      are listed for close, so if your test shows ada succeeding, that's a finding, not a
      pass).

## 7. Phase F — SLA / overdue (needs real wall-clock time)

- [ ] **TP-F1.** Start the Legal instance (`sla_hours: 1`). Immediately check
      `GET /workflow-instances/bottlenecks-ageing` — SLA status should read `not_started`
      or `healthy`, not `due_soon`.
- [ ] **TP-F2.** Wait until just before the 1-hour mark, re-check — expect `due_soon`
      (confirms a warning tier exists before outright breach; the exact percentage isn't
      documented, so this step is what discovers it empirically).
- [ ] **TP-F3.** Wait past the 1-hour mark **plus one SLA-worker cycle** (5 minutes, per
      the architecture doc). `GET /sla/breaches?status=open` should now list this task
      with `breachType: warning` (and, if you wait for a second cycle without action,
      eventually `escalation`). Cross-check the task's own `status` — expect it to have
      flipped to `escalated`.
- [ ] **TP-F4 (the known gap).** Confirm — and this is expected, not a bug you need to
      report twice — that **nobody was actually notified**. `GET /notifications` for
      femi/bola should be empty even though the breach record exists. This is the
      documented `notifyUser`-never-called gap (DRIFT-10). The test's job here is to
      confirm the gap is exactly this and not worse (e.g., confirm the breach record
      itself is correct even though delivery isn't built).
- [ ] **TP-F5.** Confirm the breached task is **not** auto-reassigned or auto-escalated to
      a different assignee — it just sits there until a human (assignee, supervisor, or
      admin) reassigns, delegates, or actions it. Then resolve it and confirm
      `resolvedAt` gets set and it drops out of the default `status=open` filter.
- [ ] **TP-F6 (department scope on SLA reads).** As tunde.ops, `GET /sla/breaches
      ?scope=all` — expect `403` (only org-wide oversight roles get `all`; a supervisor's
      "all" is silently narrowed to their own department, not org-wide).

## 8. Phase G — Checkout / check-in (independent of workflow state)

- [ ] **TP-G1.** Check out a document as chinedu. Confirm `isCheckedOut: true` and a
      `CheckoutLock` naming chinedu.
- [ ] **TP-G2 (already locked, expect 409).** ngozi attempts to check out the same
      document. `409`.
- [ ] **TP-G3 (wrong owner, expect 403).** ngozi attempts to check it back in. `403`.
- [ ] **TP-G4 (the interesting one).** While still checked out by chinedu, have ada
      action the document's pending workflow task (approve/reject/etc.). **Does the
      workflow action succeed anyway?** The spec doesn't couple these two systems, so
      confirm empirically whether that's intended or worth flagging — a checked-out
      document silently sailing through an approval is exactly the kind of thing a real
      audit would care about.
- [ ] **TP-G5.** chinedu checks it back in. Confirm `isCheckedOut: false` and that a
      **second** checkout by someone else now succeeds.

## 9. Phase H — Cross-department authorization (the department-scoping contract)

Run each of these as tunde.ops (Operations supervisor) against Finance/Legal data:

- [ ] **TP-H1.** `GET /tasks?scope=all` — expect only Operations tasks, never Finance/Legal.
- [ ] **TP-H2.** `POST /tasks/{financeTaskId}/action` — `403`, even though tunde holds the
      `supervisor` role generally.
- [ ] **TP-H3.** `PATCH /tasks/{financeTaskId}/reassign` — `403`.
- [ ] **TP-H4.** `GET /workflow-instances/bottlenecks-ageing?departmentId=<Finance>` — `403`
      (a supervisor requesting another department explicitly, not just omitting the
      filter).
- [ ] **TP-H5.** `GET /tasks/workload?departmentId=<Finance>` — `403`, same reason.
- [ ] **TP-H6 (org-wide roles are exempt).** Repeat H4/H5 as david.mgmt or chika.audit —
      expect `200` with real cross-department data, confirming the restriction is
      supervisor-specific, not universal.

## 10. Phase I — State-conflict edge cases (quick, no waiting required)

- [ ] **TP-I1.** Create a second workflow instance for a document that already has an
      active one. `409`.
- [ ] **TP-I2.** Start an instance twice. Second call `409`.
- [ ] **TP-I3.** Create an instance against an **unpublished** (draft) workflow. `409`.
- [ ] **TP-I4.** Create an instance for an **archived** document. `409`.
- [ ] **TP-I5.** Approve without a `signature` object. `422`.
- [ ] **TP-I6.** Approve with `mimeType: image/png` but a `.jpg` `fileUrl`. `422`
      (extension/MIME mismatch).
- [ ] **TP-I7.** Approve with `mimeType: application/pdf`. `422` (disallowed type).
- [ ] **TP-I8.** Attempt any stage action that isn't in that stage's `actions[]` array
      (e.g. `approve` on a stage only configured for `review`). Expect a `409` or `403`
      — confirm which, since this is a "the workflow doesn't allow this here" case, not a
      permissions case.

---

## Accounts for sections 12+

Sections 0–10 build a fictional test tenant from scratch. Sections 12+ test features
integrated 2026-09-18 against the **existing** live tenant, using the accounts already
confirmed working this session — no setup needed, log in and go:

| Email | Password | Role |
|---|---|---|
| `tjoel+clientadmin@schulltech.com` | `Fixture123!` | `client_admin` |
| `tjoel+staff_finance@schulltech.com` | `Fixture123!` | `staff` (Finance) |
| `tjoel+supervisor_finance@schulltech.com` | `Fixture123!` | `supervisor` (Finance) |
| `tjoel+management_ops@schulltech.com` | `Fixture123!` | `management` |
| `tjoel+auditor@schulltech.com` | `Fixture123!` | `internal_auditor` |
| `tjoel+schulltechadmin@schulltech.com` | `Fixture123!` | `schulltech_admin` |

All are on the login page's autofill buttons. If you'd rather test against your own
simulated tenant from section 1, every step below still applies — just swap in your own
users' roles for the ones named.

---

## 12. Phase J — Audit module (`/admin/audit`, `/auditor/trail`)

- [ ] **TP-J1.** Log in as `client_admin`, open `/admin/audit`. Confirm the page loads
      real entries (not empty/placeholder) — you should see at least `user.login` rows
      from your own session's logins.
- [ ] **TP-J2.** Filter by action (type `user.login` in the action box). Confirm the list
      narrows and pagination total updates. Clear it.
- [ ] **TP-J3.** Filter by actor (pick yourself from the dropdown). Confirm only your own
      entries show.
- [ ] **TP-J4.** Click "Verify integrity". Expect a success toast reporting the entry
      count and confirming the chain is intact (`GET /audit/verify`).
- [ ] **TP-J5 (permission boundary).** Click "Export". `client_admin` does **not** hold
      `audit:export` — expect an **error toast**, not a silent failure or a download. This
      is a real, confirmed permission gap on this role, not a bug in the page.
- [ ] **TP-J6.** Log out, log in as `internal_auditor`, open `/auditor/trail`. Confirm it
      loads the same kind of real data as `/admin/audit` (same underlying `GET /audit`),
      with its own actor/action/date filters and a "Last 30/7/90 days" selector.
- [ ] **TP-J7.** On `/auditor/trail`, click "Export extract". Unlike `client_admin`,
      `internal_auditor` **does** hold `audit:export` — expect a real CSV download this
      time, confirming the permission difference is real, not a frontend inconsistency.
- [ ] **TP-J8 (unrelated feature, don't confuse it).** Click "Raise finding" on any row.
      Confirm the modal opens and submits — this writes to the separate, still-mock
      findings feature (`auditAction`), not the audit trail itself. It should still work
      exactly as before; it's not part of what changed.
- [ ] **TP-J9.** Log in as `management`, open `/management/compliance`. Confirm the
      "Sensitive activity" panel shows real entries filtered to access-control/role-change
      actions (`document.access_denied`, `role.permissions_updated`, etc.) — not the old
      `REDACT_RELEASE`/`SIGN` placeholder codes, and not empty unless there genuinely are
      none of those specific actions recently.
- [ ] **TP-J10 (the one that's still mock, on purpose).** Log in as `schulltech_admin`,
      open `/platform/audit`. Confirm it still shows fixture data — this is expected, not
      a regression. There's no cross-tenant audit endpoint to wire it to.

## 13. Phase K — Document access requests (`/doc/[id]`, `/admin/access-requests`)

- [ ] **TP-K1.** As `client_admin`, find a `restricted`- or `confidential`-tier document
      you're *not* individually cleared for as a lower role (or just use any document —
      `client_admin` bypasses all tiers, so to see the denial path you'll need a second
      account without that clearance, e.g. `staff_finance` against a `restricted` doc it
      can't view). Log in as that lower-clearance account and open the document directly
      by URL (`/doc/<id>`).
- [ ] **TP-K2.** Confirm you see **"You don't have clearance to view this document"** —
      not the generic "Document not found" state. This is the 403-vs-404 distinction built
      this session; getting the wrong one of these two states is a regression.
- [ ] **TP-K3.** Click "Request access". Fill in an optional reason, submit. Expect a
      success toast and no error.
- [ ] **TP-K4 (duplicate request, expect 409).** Immediately request access again on the
      same document. Expect this to fail (the backend rejects a second pending request on
      the same document) — confirm the failure surfaces as a toast, not a silent no-op.
- [ ] **TP-K5.** Log in as `client_admin`, open `/admin/access-requests`. Confirm your
      TP-K3 request appears under the default "Pending" filter, with the requester's name,
      email, reason, and a link to the document.
- [ ] **TP-K6.** Click "Grant". Confirm the confirmation dialog's copy accurately
      describes a **view-only** grant. Confirm it.
- [ ] **TP-K7.** Switch the status filter to "Approved". Confirm the request now appears
      there with a reviewer name and timestamp, and has dropped out of "Pending".
- [ ] **TP-K8.** Log back in as the requester. Open the same document. Confirm it now
      loads normally (the grant unlocked view).
- [ ] **TP-K9 (grant is view-only — the important check).** As the same now-granted user,
      attempt to edit the document's title, or check it out. Expect this to still **fail**
      — the grant explicitly does not extend to edit/delete/checkout. If this succeeds,
      that's a real finding, not a pass.
- [ ] **TP-K10 (deny path).** Repeat K1–K4 with a fresh document/user pair, but click
      "Deny" instead of "Grant" at the admin inbox. Confirm the requester's document
      access is still blocked afterward, and the request shows under "Denied".

## 14. Phase L — Workflow trail comments & signatures, review modal, version gating (`/doc/[id]`)

**Superseded 2026-09-18.** This phase used to test the dedicated `GET/POST
/documents/:id/comments`/`/signatures` panels. Those were wired, then deliberately
un-wired the same day — every comment and signature is workflow-trail-only now. See
`BACKEND_REQUESTS.md` BE-16/BE-17 and doc 01's DRIFT-08 note.

- [ ] **TP-L1 (mark reviewed, no signature).** As the assignee of a `review`-only stage,
      click "Mark reviewed". Confirm a modal opens with an optional comment field (not an
      immediate confirm) — leave the comment blank and submit. Confirm it succeeds and
      the stage advances; the trail entry shows no comment line.
- [ ] **TP-L2 (mark reviewed, with comment).** Repeat, this time typing a comment.
      Confirm the trail entry on `WorkflowActivityPanel` shows your comment text.
- [ ] **TP-L3 (review has no signature capture).** Confirm the "Mark reviewed" modal has
      no signature pad — only `approve` does. This is a known backend limitation
      (`review`'s action schema is `additionalProperties: false`, no `signature`
      property), not a frontend gap; BE-16 tracks closing it.
- [ ] **TP-L4 (approve signature shows on the trail).** Sign & approve a task (as before).
      Confirm the resulting trail entry on `WorkflowActivityPanel` now shows a small
      signature thumbnail next to the "Approved" entry (previously only the comment text
      rendered, from `r.note`; the trail now also reads `r.comment` and
      `r.task.signature`).
- [ ] **TP-L5 (version upload closed by default).** Open a document with a pending task
      that was **not** reached via "Request changes" (e.g. its first stage). Confirm the
      Versions panel shows no "New version" button, and instead a caption: "New version
      uploads open once the previous stage requests changes on this document."
- [ ] **TP-L6 (version upload opens after request_changes).** Request changes on a task
      (TP-E1), then as the assignee of the task it bounced back to, reopen the document.
      Confirm "New version" now appears on the Versions panel, upload a file, and confirm
      it succeeds and appears in the version list.
- [ ] **TP-L7 (version upload closes again after moving on).** From the state in TP-L6,
      mark the stage reviewed (or approve/reject it) so it advances past the bounced
      stage. Confirm "New version" disappears again — the gate is per-bounce, not
      permanent once unlocked.
- [ ] **TP-L8 (Restore unaffected).** Confirm "Restore" on an old version is still offered
      to anyone with `document:edit` regardless of the request-changes gate above — only
      "New version" is gated, not "Restore".

## 15. Phase M — User invitations & password flows (`/admin/users`, `/set-password`)

- [ ] **TP-M1.** As `client_admin`, create a new user (`/admin/users` → "Invite user").
      Fill name/email, submit. Confirm success — and confirm you were **not** asked to set
      a password anywhere in the form.
- [ ] **TP-M2.** Find that new user in the list. Confirm their status is `Active` but
      they have no `lastLoginAt` (never logged in) — the "Resend invite" button should be
      visible on their row under these conditions.
- [ ] **TP-M3.** Click "Resend invite". Expect a success toast naming the user's email.
- [ ] **TP-M4 (permission boundary).** Confirm "Resend invite" does **not** appear on a
      row for a user who has already logged in (has a `lastLoginAt`) or who is suspended —
      it should only offer to active, never-logged-in users.
- [ ] **TP-M5.** From the login page, click "Forgot password", request a reset for any
      known account's email. Expect a generic success message regardless of whether the
      email is registered (anti-enumeration — don't expect it to tell you either way).
- [ ] **TP-M6 (the bug that was fixed).** If you have access to a real reset/invite email
      or can obtain a token another way, open `/set-password?token=<token>`, enter a new
      password and confirm it matches, submit. Expect **success**, not a `422
      VALIDATION_ERROR` about a missing `password` field — that was the exact bug fixed
      this session (DRIFT-15). If you can't get a real token, at minimum confirm the page
      renders its "invalid reset link" state correctly for a missing/garbage token.

## 16. Phase N — Role permission scope (`/admin/roles`)

This is the most important new phase — it's testing a fix for a bug that was **silently
corrupting data on every save** before today.

- [ ] **TP-N1.** As `client_admin`, open `/admin/roles`. Select any built-in role (e.g.
      `staff`). Confirm each granted permission's checkbox, when checked, shows a small
      three-button scope picker (O/D/G) next to it, and that the active button reflects
      that permission's **real, pre-existing scope** — not all defaulted to "G". Cross-
      check a couple against what you'd expect (e.g. `staff`'s `document:create` should
      show "O" for own).
- [ ] **TP-N2.** Create a throwaway custom role (name it something obviously temporary).
      In the Documents module, grant `document:view` and set its scope to "D"
      (department) via the picker, and grant `document:edit` at "O" (own). Save that
      module.
- [ ] **TP-N3.** Reload the page (or reselect the role from the list). Confirm both
      permissions are still granted **with the scopes you set** — not reset to "G". This
      is the core regression check: before the fix, saving would have silently widened
      both to global scope on the next read.
- [ ] **TP-N4 (the isolation check).** With that same role, expand a *different* module
      (e.g. Filing) and grant one permission there, saving only that module. Go back to
      the Documents module and confirm TP-N2's scopes are **still exactly what you set** —
      unaffected by the unrelated module's save. This is what "each module section
      saves/discards independently" is supposed to guarantee.
- [ ] **TP-N5.** Toggle `document:view` off, then back on (without saving in between).
      Confirm it comes back with its **previous** scope ("D"), not reset to "G" — the
      re-check-restores-prior-scope behavior.
- [ ] **TP-N6.** Delete the throwaway role once done (its own "Delete" button — built-in
      roles can't be deleted, custom ones can).
- [ ] **TP-N7 (built-in roles stay editable).** Confirm you can still open and modify a
      built-in role's permissions (e.g. toggle something on `supervisor`, then discard it
      — use "Discard" rather than actually saving, to leave the seeded role untouched
      unless you mean to change it). Built-in roles' *name* is protected, not their
      permissions.

## 17. Phase O — Cabinet → Folder → Document browser (`/staff/cabinets`)

- [ ] **TP-O1.** As any role with document access, open `/staff/cabinets`. Confirm the
      main panel shows a **grid of cabinet cards** — not a document list. (This is the
      core behavior change: documents no longer load eagerly on page load.)
- [ ] **TP-O2.** Click a cabinet card. Confirm the main panel now shows **folder cards**
      for that cabinet (each with a document count), still no document list.
- [ ] **TP-O3 (unfiled bucket).** If the cabinet has any documents outside a folder,
      confirm an "Unfiled documents" card appears alongside the real folders, with its own
      count. If every document in the cabinet is filed, confirm this card is **absent**,
      not shown empty.
- [ ] **TP-O4.** Click a folder card. Confirm the document list (table or grid, per the
      List/Grid toggle) now renders, and that the List/Grid toggle and the urgency legend
      only appear at this step — not at the cabinet or folder-selection steps.
- [ ] **TP-O5 (urgency dots).** Find or upload a document with `urgency: high` and one
      with `urgency: critical`. Confirm both show a small colored dot next to the title —
      amber for high, red for critical — and that it's **flashing** (pulsing), not static.
      Confirm `low`/`normal` urgency documents show **no dot at all**.
- [ ] **TP-O6 (reduced motion).** If you can toggle "prefers reduced motion" in your OS/
      browser dev tools, confirm the dot stops flashing (becomes a static colored dot)
      rather than continuing to animate.
- [ ] **TP-O7.** Click the "Unfiled documents" card from TP-O3. Confirm it shows exactly
      the documents with no folder in that cabinet, and that the breadcrumb reads
      "… › Unfiled documents".
- [ ] **TP-O8 (breadcrumb navigation).** From inside a folder's document list, click the
      cabinet name in the breadcrumb. Confirm you land back on that cabinet's folder grid
      (not the top-level cabinet grid). Then click "Cabinets". Confirm you're back at the
      top-level cabinet grid.
- [ ] **TP-O9 (sidebar still works as a shortcut).** Use the sidebar tree to jump directly
      from "All cabinets" to a specific folder in one click (bypassing the main panel's
      step-by-step drill-down). Confirm the main panel correctly jumps straight to that
      folder's document list, in sync with the breadcrumb.
- [ ] **TP-O10 (confidentiality filtering, passive).** As a lower-clearance account (e.g.
      `staff_finance`), browse into a folder that a `client_admin`-only view confirms
      contains a `restricted`-tier document. Confirm that document **simply doesn't
      appear** in the list for the lower-clearance user — no error, no lock icon, it's
      just absent, matching how the backend actually filters (silently, not visibly-
      locked). This is intentional per this session's design discussion, not a bug.

---

## 18. Phase P — Permission-aware navigation & action gating (`routes.config.ts`,
`useNavigation.ts`, per-page action guards)

**Context.** The sidebar and route guard used to be role-hardcoded (and briefly, after
DRIFT-16, gated on permission keys no real role could hold — see doc 01). Both are now
driven by the same `resource:action` permission vocabulary as the backend: a nav item and
its route rule are meant to require the same key, so a link is never shown that the route
would then reject. Separately, and on a different timeline, individual **write actions**
inside pages (buttons, not links) are being gated one page at a time — some are done, some
are deliberately not yet. This phase tests both layers and tells you which failures are
real findings vs. already-known, still-open work.

### P1 — Sidebar composition per role

- [ ] **TP-P1.** Log in as each fixture account in turn (`client_admin`, `staff_finance`,
      `supervisor_finance`, `management_ops`, `internal_auditor`, `schulltech_admin`).
      Confirm the sidebar shows **only** the sections/items that role's permissions cover —
      compare against the nav table below. In particular:
      - `staff` should **not** see Admin, Supervisor, Management, Auditor, or Platform
        sections at all — just Dashboard, My Tasks, Notifications, Delegations, Cabinets,
        Upload & Capture, Search, Circulars, My Performance.
      - `supervisor` additionally sees Approvals Queue, Workflow Monitor, Bottlenecks &
        Ageing, Workload & Reassign, Team Performance, Exceptions.
      - `client_admin` sees the full Administration/Configuration/Communication/Governance
        set, **including Branding** (role-gated on `client_admin` specifically, not a
        permission — a custom role, even an all-powerful one, would not see it).
      - `internal_auditor` sees Audit Dashboard, Audit Trail, Document Sampling (which is
        actually `/staff/cabinets` under a different label), Findings Tracker, Compliance
        Posture — and nothing from Admin/Supervisor/Management.
      - `schulltech_admin` sees only the Platform portal (Tenant Directory, Platform
        Health, Plans & Entitlements, Billing & Usage, Feature Flags, Platform Audit) —
        this portal is role-gated, not permission-gated, by design (no `platform` resource
        exists in the vocabulary).
      - Every role sees "Product Guide" at the bottom (`/user-stories`) — it's ungated on
        purpose.

### P2 — Route guard on direct URL access

- [ ] **TP-P2.** While logged in as `staff_finance`, type an admin URL directly into the
      address bar (e.g. `/admin/users`, `/admin/roles`, `/admin/branding`). Confirm you land
      on **"Access Denied"** (`/unauthorized` — red icon, "You do not have the required
      roles or permissions to view this page", with "Go Back" and "Return to Dashboard"
      buttons) rather than the page itself, a blank screen, or a crash.
- [ ] **TP-P3.** Repeat TP-P2 as `supervisor_finance` against `/admin/*` and `/platform/*`,
      and as `management_ops` against `/admin/*`, `/supervisor/*`, and `/platform/*`.
      Same expected result each time.
- [ ] **TP-P4 (management is a whitelist, not a prefix).** As `management_ops`, confirm
      `/management/reports`, `/management/compliance`, `/management/departments`,
      `/management/trends`, `/management/performance`, and `/management/findings` all load
      normally, but a made-up path like `/management/anything-else` still denies access —
      this section only opens the specific sub-pages it lists, not everything under
      `/management`.
- [ ] **TP-P5 ("Return to Dashboard" is role-correct).** From an Access Denied page hit
      under any role, click "Return to Dashboard". Confirm it returns you to **that role's
      own home** (`/staff`, `/supervisor`, `/management`, `/admin`, `/auditor`, or
      `/platform`), not a hardcoded page.

### P3 — Action-level gating that's already fixed (spot-check, expect success)

These pages had their write buttons wired to real `can()` checks in the last two sessions.
Confirm the buttons **work normally** for the role that holds the permission — this phase
is about catching a regression, not finding something new:

- [ ] **TP-P6.** `client_admin` on `/admin/access-requests`, `/admin/cabinets`,
      `/admin/departments`, `/admin/roles`, `/admin/users`, `/admin/workflows`: create/
      edit/delete affordances are present and functional.
- [ ] **TP-P7.** `supervisor_finance` on `/supervisor/approvals` and `/supervisor/workload`:
      Approve/Reject and Reassign are present and functional.
- [ ] **TP-P8.** `internal_auditor` on `/auditor/trail`: Export extract works (this role
      holds `audit:export`); confirm `client_admin` on `/admin/audit` instead gets an error
      toast on Export (it does **not** hold `audit:export` — see TP-J5, still correct
      behavior, not a bug).
- [ ] **TP-P9.** Any role, on `/doc/[id]`: Delegate/Reassign-style workflow actions
      (Mark reviewed, Approve/Reject, delegate) respect the signed-in user's actual task
      assignment and permissions.

### P4 — Known open gaps (do not file a duplicate finding for these)

The following write actions have **no permission check at all yet** — any signed-in user
who can reach the page can click them regardless of role. This is tracked, already
prioritized work, not something this test pass needs to (re)discover. If you hit one,
confirm the *action itself* still behaves correctly (no crash, real data written) — that's
still worth knowing — but don't file "missing permission gate" as a new bug for these:

| Page | Ungated action(s) |
|---|---|
| `/admin/audit` | Verify integrity, Export |
| `/admin/branding` | Publish branding |
| `/admin/circulars` | Compose / Publish / Save |
| `/admin/policies` | Confidentiality / urgency / control toggles |
| `/supervisor/exceptions` | Acknowledge (writes a real audit log entry; the exception row list itself is still mock data) |
| `/staff/cabinets` | Move / Route bulk actions |

- [ ] **TP-P10 (the one genuine bug in this group — do report it, it's logic-wrong not
      just unfinished).** On `/auditor/findings` (also reachable at
      `/management/findings` — it's the same component) as any role: "Raise finding" is
      gated on `audit:view`, but **"Add response" and "Close finding" have zero guard at
      all**, not even the same (wrong) `audit:view` check the create action uses. Confirm
      this is still the case. It's a real inconsistency worth fixing, but low urgency —
      `Finding` has no real backend model yet, so there's no live data exposure behind it.

---

## 19. Phase Q — Conditional workflow routing (`/admin/workflows`)

**Context.** The backend has supported conditional/prioritized transitions for a while
(`WORKFLOW_CONDITION_FIELDS`/`_OPERATORS`/`_MODES` in `edms-backend`'s workflow constants) but
the frontend Workflow Designer never exposed it — it only ever built a straight `stage 1 → stage
2 → … ` chain. This phase covers the new authoring UI: a stage can now route conditionally on
the document's urgency, confidentiality, or a metadata field, with a required fallback for
anything that doesn't match. **True parallel routing (more than one *unconditional* branch from
a stage) is still not supported, on either side of the stack — don't go looking for it.**

Log in as `client_admin` (`workflow:edit` is required to reach this page at all). Open
`/admin/workflows` and select or create a workflow with **at least 3 stages** — a couple of these
steps need a stage to have more than one other stage available to route to.

- [x] **TP-Q1 (the tabs, and that switching them is non-destructive).** Select any non-terminal
      stage. Confirm the right-hand panel is a single card titled with the stage's name, with
      **Properties** and **Transitions** tabs. On Properties, change the stage name (don't save),
      switch to Transitions, then switch back to Properties. Confirm your unsaved name edit is
      still sitting there — tab-switching must not silently discard it.
- [ ] **TP-Q2 (the default shape).** On the Transitions tab of a stage with no authored branches,
      confirm you see exactly one card, badge **"Fallback"**, pointing at the next stage in
      sequence, plus a **"+ Add conditional branch"** button. This is the same default chain the
      designer has always built, just now visible/editable as a real transition instead of an
      implicit assumption.
- [ ] **TP-Q3 (adding a branch).** Click **"+ Add conditional branch"**. Confirm a new card
      appears above the fallback: badges **"Priority 1"** and **"Conditional"**, a target-stage
      dropdown, and a rule row defaulting to **Urgency → equals → Critical**.
- [ ] **TP-Q4 (metadata fields are tenant-wide).** On that rule, change the field dropdown to
      **"Metadata field"**. Confirm the fixed value dropdown is replaced by a metadata-field
      dropdown **plus** a free-text value box. The field dropdown should list metadata fields
      from cabinets across the whole tenant, not just one cabinet — this workflow definition
      isn't tied to a specific cabinet, so that's intentional, not a bug.
- [ ] **TP-Q5 (multiple rules, match mode).** Click **"+ Add rule"** on the same branch. Confirm
      a second rule row appears, and a **"Match: All rules / Any rule"** toggle appears alongside
      it — this toggle should be entirely absent when a branch only has one rule.
- [ ] **TP-Q6 (client-side validation — duplicate target, expect a blocked save, not a 422).**
      Change the new branch's target-stage dropdown to the **same** stage the fallback card
      already points to. Confirm a warning banner appears ("Two branches from this stage point to
      the same next stage…") and **"Save transitions" becomes disabled**. This mirrors a real
      backend rule (`Duplicate transition 'from->to'`) enforced client-side so you never actually
      round-trip into that 422.
- [ ] **TP-Q7 (client-side validation — priorities).** Pick a different, unused target stage for
      the branch from TP-Q6 so the duplicate-target warning clears. Add a **second** conditional
      branch (a distinct target is required — see TP-Q9 below if none is available). Set both
      branches' priority fields to the same number. Confirm "Conditional branches need unique
      priorities" appears and Save stays disabled; give them different priorities and confirm the
      warning clears.
- [ ] **TP-Q8 (removing a branch).** Click the **✕** on a conditional branch card. Confirm it's
      removed from the list and, once you're back down to zero conditional branches, the one
      remaining fallback card is the only thing shown (matching TP-Q2's default state).
- [ ] **TP-Q9 (the 2-target edge case — the real bug this shipped with, now fixed).** Find or
      make a stage where every *other* stage is already used as a transition target (the simplest
      way: a workflow with exactly 2 stages — the first stage's only fallback already points at
      the only other stage there is). Confirm **"+ Add conditional branch" is disabled**, with a
      tooltip/help line explaining there's no distinct stage left to route to. If this button is
      ever clickable in this state, that's a regression — it used to silently create a branch that
      failed to save with "Validation failed" (a real duplicate-transition 422) instead of
      preventing the impossible action up front.
- [ ] **TP-Q10 (save succeeds).** On the 3+-stage workflow from TP-Q3–Q7, once the warnings are
      clear (distinct targets, unique priorities, exactly one fallback), click **"Save
      transitions"**. Confirm a success toast and no validation error.
- [ ] **TP-Q11 (the canvas reflects the save — real lines, not just badges).** After TP-Q10,
      look at the canvas on the left. Confirm it now draws a **curved amber line** from the stage
      to its conditional branch's target, labeled with a short summary of the rule (e.g. "urgency
      = critical"), and a **curved green line** to the fallback labeled "else". Pick a different,
      untouched stage that still has only its original single transition — confirm it still shows
      a **plain gray line with no label**, unchanged from before this feature existed.
- [ ] **TP-Q12 (clicking a routing line jumps straight to it).** With a different stage selected
      (Properties tab showing), click the amber or green label on another stage's branch line.
      Confirm it both selects that stage **and** switches the panel straight to its Transitions
      tab — you shouldn't have to click the tab yourself after clicking a line on the canvas.
- [ ] **TP-Q13 (persistence).** Reload the page (or switch to a different workflow and back).
      Confirm the branch, its rule, its priority, and the canvas lines are all still exactly as
      you saved them.
- [ ] **TP-Q14 (the guide).** Click the **"How routing works"** button above the canvas. Confirm
      a modal opens explaining the feature (fallback requirement, priority ordering, match mode,
      what each line color means), and that Escape, clicking the backdrop, and the **×** all
      close it — same behavior as every other modal in the app, since this one reuses the shared
      modal system rather than a one-off implementation.

---

## 20. Wrap-up

- [ ] Re-run **TP-A1–A7** once more at the very end using kemi.reviewer (the custom-role
      user) instead of a system-role user, to prove the custom role built in step TP-0
      actually carries real capability, not just a row in the database.
- [ ] File one finding per failed checkbox, tagged with its `TP-xx` id, plus enough
      request/response detail to reproduce — screenshots or raw JSON, not paraphrases.
- [ ] **TP-N is the highest-priority phase to actually run**, not skip — it's the only one
      testing a fix for a bug that was silently corrupting saved data before today. A
      failure there means the scope bug isn't actually fixed, not just a UI nicety missing.
- [ ] **TP-P4's table is a living list, not a permanent one** — as each Tier 2 page gets
      its actions gated, move its row out of the "known open gaps" table and add fresh
      TP-P steps confirming the new guard actually blocks a role that lacks the permission
      (mirroring TP-P6–P9), not just that it shows for a role that has it.
- [ ] Anything that contradicts this plan should update `docs/BACKEND_REQUESTS.md` or
      `docs/01-architecture-and-drift.md` (new `DRIFT-nn` if it's a genuine bug) rather
      than just living in a test report — per this repo's convention, the docs are the
      persistent record.


## - Things to check
- [x] Prevent admin from creating a sub department within a sub-department
  - Frontend done: "Add sub-department" is disabled on sub-department rows; the parent picker
    only offers top-level departments; a department with sub-departments must stay top level.
  - ⚠️ Backend does **not** enforce depth — `POST/PATCH /departments` accepts any `parentId`.
    Ask backend to reject a parent that itself has a parent.
- [x] Allow admin to delete a department with no users (check current backend code)
  - Already works: `DELETE /departments/:id` (`department:delete`) is live on `dev` and wired
    to the row menu's Delete. Backend returns 409 if the department has **any** users (all
    statuses, despite the "active users" message) or cabinets. The frontend also blocks it
    while the department has sub-departments (the backend would otherwise orphan them to
    top level — the self-relation has no `onDelete` rule).
- [x] In the reassign, user shouldn't be able to reassign outside their department. So filter by current user's department id.
  - Frontend done: all four reassign dialogs (Team Overview, Approvals, Workload,
    Bottlenecks) list only active users in the reassigner's department
    (`useDepartmentColleagues`). No department → empty list.
  - Backend already enforces this for department-scoped reassigners
    (`TASK_REASSIGN_DEPARTMENT_FORBIDDEN`); global-scoped reassigners are not restricted.
  - `/auth/me` doesn't return `departmentId`, so the page fetches `GET /users/:id` for it —
    ask backend to add `departmentId` to `/auth/me` and login.
- [x] use react-day-picker or similar library for date-time pickers
  - Done: `react-day-picker@9` + `src/components/ui/DatePicker.tsx` (`DateField`,
    `DateTimeField`). Replaced all six native inputs: Tenant Audit from/to, Findings due
    date, Delegation starts/ends, Checkout expected return.
- [ ] the current document structure doesn't show who checked out a document. Check current backend code for the response of the api route for /document/:id
  - Confirmed on `dev`: `GET /documents/:id` returns only `isCheckedOut`, never the lock.
    **This is a bug, not just missing info:** the doc page compares
    `checkoutLock.lockedBy` to the current user, so with no lock in the response even the
    person who checked it out is treated as "someone else" and can't check it back in.
  - Backend fix (one line) in `documents.repository.ts` `findById` include:
    `checkoutLock: { include: { locker: { select: { id: true, name: true, email: true } } } }`
  - Frontend is ready for it (`CheckoutLock.locker`; the banner shows the holder's name).
