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
      top of it. *(Passed 2026-10-16: `GET /workflows` returned 200 for `staff_finance`,
      `supervisor_finance`, `management_ops` and `auditor`. A freshly seeded database would
      fail this check — the seed lacks the grant; see DRIFT-14.)*
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
`BACKEND_REQUESTS.md` BE-16 and doc 01's DRIFT-08 note.

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
| ~~`/admin/audit`~~ | ~~Verify integrity, Export~~ — **gated (2026-10-08):** Export on `audit:export`, Verify on `audit:view`, matching the backend routes |
| `/admin/branding` | Publish branding — page is client_admin-only; no branding backend or permission exists to gate the action on |
| `/admin/policies` | Confidentiality / urgency / control toggles — page gate only; no policy backend or permission exists |
| `/supervisor/exceptions` | Acknowledge — page gate (`workflow:edit`) only; the row list is still mock data |
| ~~`/staff/cabinets`~~ | ~~Move / Route bulk actions~~ — **gated** (checked 2026-10-08): Move needs `document:edit` + Edit on the cabinet; Route needs `workflow_instance:create` + `:route` |

*(2026-10-08: the three remaining rows are mock pages. Their action gates wait for the
backends, and the permission keys, they'd be checked against — inventing keys now would
just have to be undone.)*

- [x] **Fixed 2026-10-08:** "Add response" and "Close finding" now have the same
      `audit:view` gate as "Raise finding". *Original note:* **TP-P10 (the one genuine bug in
      this group — do report it, it's logic-wrong not just unfinished).** On `/auditor/findings` (also reachable at
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
anything that doesn't match. **Parallel routing** (two or more *unconditional* branches from a
stage, all running at once) arrived with edms-backend PR #54 and is covered by TP-Q15–TP-Q27.

Log in as `client_admin` (`workflow:edit` is required to reach this page at all). Open
`/admin/workflows` and select or create a workflow with **at least 3 stages** — a couple of these
steps need a stage to have more than one other stage available to route to.

- [x] **TP-Q1 (the tabs, and that switching them is non-destructive).** Select any non-terminal
      stage. Confirm the right-hand panel is a single card titled with the stage's name, with
      **Properties** and **Transitions** tabs. On Properties, change the stage name (don't save),
      switch to Transitions, then switch back to Properties. Confirm your unsaved name edit is
      still sitting there — tab-switching must not silently discard it.
- [x] **TP-Q2 (the default shape).** *(2026-10-18, browser.)* On the Transitions tab of a stage with no authored branches,
      confirm you see exactly one card, badge **"Next"** (it becomes **"Fallback"** once the stage
      has a conditional branch), pointing at the next stage in sequence, plus **"+ Add
      conditional branch"** and **"+ Add parallel branch"** buttons. This is the same default chain the
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

**Parallel routing (edms-backend PR #54, frontend 2026-10-17).** Two or more plain (no
condition) branches from one stage run at the same time, each with its own task and SLA. If the
branches meet again, the stage where they meet waits until every branch has arrived, then opens
one task. **Status 2026-10-19:** the designer works (TP-Q15–Q18, Q21–Q23 and Q25 passed in a
browser); **running a parallel workflow fails on the live backend** at the first fork (TP-Q19),
so the runtime steps say what *should* happen and what you will see today.

**Setup.** As `client_admin`, open `/admin/workflows` → **New workflow**. Add stages until there
are four, named and assigned like this (Properties tab, then **Save changes** on each):

| Stage | Assign to (Role) | Allowed actions |
|---|---|---|
| Intake | staff | Review, Reject |
| Finance review | supervisor | Review, Reject, Request changes |
| Legal review | staff | Review, Reject, Request changes |
| Final approval | management | Review, Reject, Request changes |

They start as a straight chain: Intake → Finance review → Legal review → Final approval.

*Building it — the normal way*

- [x] **TP-Q15 (making a fork).** *(2026-10-18, browser: PATCH 200.)* On Intake's Transitions
      tab click **"+ Add parallel branch"** and point the new card at Legal review. Confirm both
      cards read **"Parallel"** with a ✕, **"+ Add conditional branch"** is greyed out, and
      **Branches meet at** shows **Final approval**. The note under it lists what else the save
      changes: *Finance review goes on to Final approval*, *Finance review no longer goes to Legal
      review*, *Final approval waits for every branch*. **Save transitions** — it succeeds, and
      afterwards the tab shows no **Discard** (nothing left unsaved).
- [x] **TP-Q16 (the canvas).** *(2026-10-18, browser.)* Intake's two lines are blue and labelled
      **"Parallel"**, Finance and Legal sit side by side, and Final approval's card reads
      **"· waits for all"**. Select Final approval: its Properties tab says parallel branches meet
      there. **"How routing works"** explains parallel branches and the blue line.

*Building it — errors you should hit.* Each is caught before anything is saved: a warning
appears under the branches and **Save transitions** is disabled. **Discard** after each.

- [x] **TP-Q17 (branches meet but nothing waits).** *(2026-10-18.)* On Intake, set **Branches
      meet at** to **"Nowhere"**. Warning: *"The parallel branches from Intake meet again at Final
      approval, which has to wait for all of them — choose it under "Branches meet at"."*
- [x] **TP-Q18 (removing a branch strands a stage).** *(2026-10-18.)* Remove the Legal branch
      (✕). Warning: *"Nothing routes to Legal review any more — no document could reach it."*
- [x] **TP-Q21 (two branches to the same stage).** *(2026-10-19.)* Point the Legal card at
      Finance review. Warning: *"Two branches from this stage point to the same next stage — pick
      a different target for one of them."*
- [x] **TP-Q22 (a branch that can finish early).** *(2026-10-19.)* **Add stage**. It goes after
      Final approval, which now leads to it, with no warning, and you can click another stage
      straight away without a "Discard unsaved changes?" prompt. On Legal review's Transitions,
      **"+ Add conditional branch"** pointing at the new stage. Warning: *"A branch from Intake
      can end at New stage without reaching Final approval."*
- [x] **TP-Q23 (a branch splitting again).** *(2026-10-19.)* On Finance review,
      **"+ Add parallel branch"** pointing at the new stage. The warning includes *"Finance
      review splits into parallel branches again before Final approval — a branch can't split
      further."*
- [ ] **TP-Q24 (conditions and parallel don't mix).** *(2026-10-18: the first half seen in a browser; the second not yet clicked.)* On Intake (a fork),
      **"+ Add conditional branch"** is disabled, and hovering says why. On a stage with a
      conditional branch, **"+ Add parallel branch"** is disabled.
- [x] **TP-Q25 (deleting stages).** *(2026-10-19.)* Delete **Final approval**: no confirm opens,
      and a red toast reads *"Can't delete "Final approval": …"* with the reason. Delete **Legal
      review** instead: confirm, it is removed, and Final approval no longer reads "waits for
      all" (Intake has one branch left, so it isn't a fork any more).

If a save ever does reach the backend and fail, the red toast shows the backend's reason (for
example *"Parallel stage 'intake' has converging branches but no join: 'all' stage"*), not just
"Validation failed".

*Reordering stages*

- [x] **TP-Q28 (Move earlier / Move later).** *(2026-10-19, browser.)* On a draft chain Alpha →
      Bravo → Charlie → Delta, select Charlie → Properties → **Position**. **↑ Move earlier**: it
      saves at once and the canvas reads Alpha → Charlie → Bravo → Delta. Again: Charlie is now
      the first stage (where documents start), and a toast says "Request changes" was removed
      from it. On the first stage **Move earlier** is disabled ("This is already the first
      stage."); on the last, **Move later** ("This is the last stage — nothing comes after it.").
      On a stage that branches, or one where routes meet, the buttons are disabled and hovering
      says why. Moving the stage where parallel branches meet later makes its new predecessor
      the one that "waits for all".

*Running it.* Rebuild the TP-Q15 workflow (or undo TP-Q22–Q25), then **Publish**. Route a
document **you own**: as `staff_finance`, upload a new document and use **Route to workflow** on
it. Routing someone else's document fails with *"You do not have permission to create a
workflow instance for this document"*.

- [ ] **TP-Q19 (the normal run).** ⛔ *Blocked by the backend (2026-10-18, re-checked
      2026-10-19, and over the API 2026-10-20: BE-19 in BACKEND_REQUESTS).* As `staff_finance`, open the task and **Mark reviewed** at Intake. **Today
      you get a red toast, "An unexpected error occurred" (HTTP 500), and the task stays at
      Intake** — on every fork, even the simplest. Once the backend is fixed: the stage rail
      shows Finance review *and* Legal review as current, each with its own holder and deadline,
      and `supervisor_finance` and `staff_finance` each have a task. Mark Finance reviewed as
      `supervisor_finance`: Finance reads done, Final approval reads **"waiting for the other
      branches"** with no deadline, and management has no task yet. Mark Legal reviewed: Final
      approval becomes current, with a task for `management_ops`. Review it there and the
      workflow closes.
- [ ] **TP-Q20 (request changes inside a branch — suspected backend gap).** ⛔ *Blocked by
      TP-Q19.* On a fresh run, after the fork, **Request changes** on Finance review. The
      document goes back to Intake for that branch only; Legal's task is untouched. Upload a new
      version at Intake (you must own the document — see TP-Q27) and mark it reviewed. **Reading
      the backend code, Intake forks that branch again** into new Finance *and* Legal branches,
      while the original Legal branch waits at Final approval for a sibling that went back. It
      would wait forever, and the workflow would never close. If that's what you see, raise it
      with the backend team: re-reviewing at a fork stage should resume the one branch.
- [ ] **TP-Q26 (reject inside a branch).** ⛔ *Blocked by TP-Q19.* After the fork, **Reject** on
      Legal review. The backend's own description says rejecting a document cancels its other
      live branches, so Finance's task should disappear and the workflow close.
- [ ] **TP-Q27 (revision upload by someone who doesn't own the document — known gap).** *(Found
      2026-10-18 on a sequential workflow.)* When a stage holder who isn't the document's owner
      is asked for changes, the workflow page offers **New version**, but the upload fails (403):
      staff can only add versions to their own documents. They then can't move the stage on:
      **Mark reviewed** says *"Document "…" requires a new version after Request Changes before
      it can proceed."* Avoid it by routing documents owned by whoever holds the first stage.

| You see | Meaning | What to do |
|---|---|---|
| Red toast **"An unexpected error occurred"** when acting at a fork stage | Backend 500 on every parallel fork (TP-Q19) | Nothing to fix on the frontend — report it to the backend team |
| *"The parallel branches from X meet again at Y…"* | Branches converge and nothing waits for them | Pick Y under **Branches meet at** |
| *"Nothing routes to X any more…"* | A stage became unreachable | Route something to X, or delete X |
| *"Two branches from this stage point to the same next stage…"* | Duplicate target | Point one branch elsewhere |
| *"A branch from X can end at Y without reaching Z."* | A branch can finish before the meeting stage | Route Y on to Z, or remove that branch |
| *"X splits into parallel branches again before Z…"* | A fork inside a branch (not supported) | Keep one route out of X |
| *"Can't delete "X": …"* | Deleting X would break the routing | Fix the routing first |
| *"You do not have permission to create a workflow instance for this document"* | Routing a document you don't own | Route your own document |
| *"Document "…" requires a new version after Request Changes…"* | Changes were requested and no new version exists yet | Upload one (owner only — TP-Q27) |

---

## 19a. Phase R — Access requests and restricted documents (`/doc/[id]`, the workflow page, `/admin/access-requests`)

Since edms-backend `3014b89` an access request is for **View access** ("Open the document",
`view`) or **Action access** ("Act on this document", `route`: act on it in a workflow
without opening it), and a task lists documents the viewer can't open as **Restricted
documents**. Run 2026-10-12 against the live API, all passing.

**Test data** (live tenant, created as `client_admin`, safe to archive): documents "TEST –
restricted access (Confidential)" `78881ccb-02c7-43ad-baab-99de42e0decc` and "TEST –
restricted access (Internal)" `7aa7d964-efed-4942-bc4b-5ec995965d45` in Finance Vendor
Invoices; workflow "TEST – restricted access" `646d15bb-b337-42db-9f33-8a807357b711`
(stage 1 assigned to `tjoel+staff_finance`, stage 2 role supervisor); instance
`b09c3620-8573-4db4-9243-ce116920f3e2`. Staff hold no `view_confidential`, so the
Confidential one is restricted for them. To re-run, create a fresh pair the same way.

- [x] **TP-R1.** As `staff_finance`, open the workflow. Two tabs; the restricted one shows a
      lock and opens straight to the request card; the browser makes no
      `GET /documents/:id` for it; the title leaves it out; no error.
- [x] **TP-R2.** Request access from that card: both "Open the document" and "Act on this
      document" are ticked (staff hold the task). Send: one request per kind, one toast
      each.
- [x] **TP-R3.** Send again: one "Already pending: …" toast per kind (409s).
- [x] **TP-R4.** Open the restricted document's `/doc/[id]` and request access: no tick
      boxes, the dialog says "Your request will be reviewed and you will be notified of the
      decision", one `view` request.
- [x] **TP-R5.** As `client_admin`, `/admin/access-requests` shows both requests with Access
      "Open" and "Act"; each Grant confirmation describes that kind. Grant only "Act".
- [x] **TP-R6.** Before the grant, as staff: Delegate and Close are disabled with the
      reason; Approve offers only the viewable document and notes the one held back.
      Approving it returns 200; the restricted document stays at the stage in a new task
      for staff, whose page then disables every action ("You need Action access…").
- [x] **TP-R7.** After the Action access grant, as staff: the document still can't be
      opened (`GET /documents/:id` 403), but Approve works (200) and it moves on.
- [x] **TP-R8.** As `client_admin` (cleared for everything), the workflow page looks as
      before: real titles, no lock, no note, no hidden-comments line.
- [x] **TP-R9.** As staff, the activity trail says "Comments and signatures are hidden
      because this workflow includes documents you can't open"; client admin doesn't see
      it.
- [x] **TP-R10.** With nothing actionable (a one-document task on a Restricted document),
      the caption's "Request access" opens the dialog with both kinds ticked; unticking
      both and pressing Send keeps the dialog open with "Tick at least one" and sends
      nothing (2026-10-12, instance `bc01e5d3-5426-42db-a7e8-490bb096c09d`).
- [ ] **TP-R11.** Not run: someone following the workflow without holding its task gets
      only "Open the document" pre-ticked. No fixture account fits: `staff` see only their
      own workflows, and every oversight role can open Confidential documents. Needs a
      custom role with workflow oversight but no `view_confidential`.

---

## 19b. Phase S — Searching for people (`GET /users?search=`)

Backend PR #48 added `search` to `GET /users`: a case-insensitive match on name or email,
still limited to the caller's `user:view` scope.

- [x] **TP-S1.** As `client_admin`, `/admin/users`: type "supervisor" in the search box.
      The count drops from every user to the supervisors only, and the table goes back to
      page 1. A term matching nobody shows "No records match the current filters."
      *(Verified 2026-10-13: 12 → 3.)*
- [x] **TP-S2.** `/admin/audit` → the "All actors" search box: type "tj". It says "Type at
      least 3 characters to search." and sends nothing. Type "o": `GET /users?search=tjo`
      goes out and matching people are listed (max 300px tall, over the table). Pick one with
      the mouse or ↓ + Enter: the box shows their name and the trail filters by `actorId`.
      ✕ or emptying the box goes back to all actors. *(Verified 2026-10-16; the 2026-10-13
      version was a dropdown.)*
- [x] **TP-S3.** As `supervisor_finance`, `/delegations` → New delegation → "Delegate to":
      only active colleagues in your scope are offered, never yourself. Typing narrows the
      list. *(Verified 2026-10-13: Finance Staff User offered and picked.)*
- [ ] **TP-S4.** As `internal_auditor`, `/auditor/trail` → actor filter. Expected today:
      "Couldn't load people." (auditor has no `user:view`; seed gap in the handoff). Re-test
      once the backend grants it.
- [x] **TP-S5.** Open the bell. While the list loads it shows grey placeholder rows, one per
      unread notification (up to 7), then the notifications. *(Verified 2026-10-13 with the
      request slowed: 4 unread → 4 placeholder rows.)*

## 19c. Phase T — Pending users and AI summaries (backend PR #49)

PR #49: an invited user is `pending` until they set a password; suspended users are told so
at login; `schulltech_admin` is hidden from the roles API; documents get an AI summary.

- [x] **TP-T1.** As `client_admin`, `/admin/users`: an invited user who hasn't set a
      password shows **Pending** with "Invited <date>", **Edit** and **Resend invite**, and no
      Activate. The status filter has Pending. *(Verified 2026-10-13 on Seye Onigbinde.
      Resend invite not clicked: it emails a real person.)*
- [ ] **TP-T2.** Invite a test address. The toast reads "Invitation sent to …" and the row
      is Pending. Open the emailed link, set a password: the row turns Active and the person
      can sign in.
- [x] **TP-T3.** Sign in as a suspended user (`muyanna+supervisor-ops`, any password). The
      error reads "Account has been suspended". *(Verified 2026-10-13.)*
- [x] **TP-T4.** Open a document whose summary is complete (`7aa7d964…`). The **AI summary**
      card shows an opening sentence, bullets, and "Written by AI from version N on …".
      *(Verified 2026-10-13.)*
- [x] **TP-T5.** Open a document never summarized before (an older upload). The card says
      "Writing the summary…", then shows it without a reload (checks every 10 s for up to a
      minute; "Check again" after that). *(Verified 2026-10-13 on `e70fc2a3…`: one check.)*
- [ ] **TP-T6.** A file with no readable text (e.g. a blank scan) says "No summary: no
      readable text was found in this file." Not run: no such file in the test tenant.
- [ ] **TP-T7.** `/admin/roles` and the invite modal's role list don't offer
      `schulltech_admin`. *(The API was checked 2026-10-13; the screens weren't.)*

## 19d. Phase U — Deadlines in lists and on-time results (backend PR #50)

- [x] **TP-U1.** As `staff_finance`, My Tasks: an open task past its deadline shows "Overdue"
      and "Nd overdue"; an open task within it shows "Due in Nd"; a closed task shows "—".
      *(Verified 2026-10-13.)*
- [x] **TP-U2.** Same user: a task holding a document you can't open lists it as "Restricted
      document" and the page doesn't break. *(Verified 2026-10-13.)*
- [x] **TP-U3.** Same user: the dashboard's "SLA compliance (30d)" and My Performance show the
      on-time share of your stage results over the last 30 days, with On time and Breached
      counts. *(Verified 2026-10-13: 88%, 7 on time, 1 breached.)*
- [x] **TP-U4.** As `client_admin`, Workflow Monitor → In progress lists every in-progress
      workflow (not only ones you hold a task in), with Current stage and Next due filled in.
      *(Verified 2026-10-13: 4 rows, 2 past the stage SLA. It was empty before.)*
- [x] **TP-U5.** As `supervisor_finance`, Approvals Queue → Reassign lists your department's
      colleagues; no `GET /users/<your id>` is made (the department comes from `/auth/me`).
      *(Verified 2026-10-13.)*
- [ ] **TP-U6.** As `client_admin`, open a document that's in a workflow you hold no task in.
      The Workflows card lists it and the page offers "Open workflow", not "Route to workflow".
      *(Seen on `78881ccb…` 2026-10-13; repeat on a fresh document.)*

## 19e. Phase V — Oversight fixes and Team Performance (2026-10-13)

- [x] **TP-V1.** As `staff_finance`, open any page: no `GET /tasks/approvals` request (it used
      to 403 on every page). As `supervisor_finance` the Approvals Queue badge still counts.
      *(Verified 2026-10-13.)*
- [x] **TP-V2.** As `management_ops`, Compliance Posture: no `GET /audit`; the sensitive-activity
      panel says the role can't read the audit trail. *(Verified 2026-10-13.)*
- [x] **TP-V3.** As `supervisor_finance`, Team Performance shows real figures: team SLA %,
      closed and turnaround for 30 days with the change from the 30 days before, weekly
      closures vs new work, and one row per team member. Export CSV downloads the table.
      *(Verified 2026-10-13: 79%, 20 closed, 2.4 d; CSV not re-checked.)*
- [x] **TP-V4.** As `staff_finance`, open a document in a running workflow you hold no task
      in. The Workflows card says it's marked as in a running workflow you can't open, and
      "Route to workflow" isn't offered. *(Verified 2026-10-13 on `487006a2…`, whose status is
      stale — see backend spec N4.)*
- [x] **TP-V5.** As `staff_finance`, open a document in a workflow you do hold a task in
      (`acf67419…`): the card lists it and the page offers "Open workflow". *(Verified.)*
- [ ] **TP-V6.** On Search or in a cabinet, select a document that's in a running workflow plus
      one that isn't, and Route to workflow: the dialog says one is left out and routes only
      the other.
- [x] **TP-V7.** As `client_admin`, `/admin/audit` names actors beyond the first 20 users (all
      users are loaded, not one page). *(The tenant has 12 users, so verified only that one
      `GET /users?limit=100` request replaces the 20-row one.)*
- [x] **TP-V8.** As `staff_finance`, type `/supervisor/approvals`, `/supervisor/instances` and
      `/supervisor/performance` into the address bar: all go to `/unauthorized`. As
      `supervisor_finance` and `client_admin` they open. *(Verified 2026-10-13.)*

## 19f. Phase W — Department-only stages (2026-10-13)

- [x] **TP-W1.** As `client_admin`, Workflow Designer → a draft workflow → a stage → Assign to →
      **Department** → "Operations › Finance" → Save changes. The canvas node reads "Finance ·
      24h" and the stored stage has `department_id` and no `role`. *(Verified on "TEST –
      department stage", `6aaf3f94…`.)*
- [x] **TP-W2.** Publish it and route a document. As `staff_finance` and `supervisor_finance`
      (both in Finance) the workflow page offers Approve/Reject; as `client_admin` (Administrative)
      they're disabled, titled "Assigned to Finance"; `staff_hr` can't open the workflow.
      *(Verified on instance `bdda387f…` with "New-Memo"; rejected as `staff_finance` through
      the API to confirm the backend accepts it.)*
- [ ] **TP-W3.** Assign a stage to "Operations" (Finance's parent) and route: Finance users
      should **not** get it. Matching stays exact (product decision 2026-10-16), so this is
      the intended result, not a gap.
- [x] **TP-W4.** Designer → a stage → Assign to → Department: pick Operations. A second
      dropdown offers "No sub-department: Operations itself" and Finance. Pick Finance and
      save: the stored stage has `department_id` = Operations and `sub_department_id` =
      Finance, and the canvas reads "Operations › Finance · 24h". *(Verified 2026-10-16 on
      "TEST — sub-department picker (draft)".)*
- [x] **TP-W5.** Same stage → Role: the department dropdowns stay, with "Any department"
      first. Saving with Operations › Finance stores `role` + both ids ("staff · Operations ›
      Finance"); saving with Any department stores the role alone. *(Verified 2026-10-16.)*
- [x] **TP-W6.** Open "TEST – department stage" (saved before PR #52 with Finance in
      `department_id` alone): it shows Operations, then Finance, and isn't marked unsaved.
      *(Verified 2026-10-16.)*
- [ ] **TP-W7.** Route a document through a sub-department stage: only people in that
      sub-department get the task; people directly in the parent don't.
- [ ] **TP-W8.** On a task with two documents you can act on, act on one only (review,
      approve or reject it). The page stays on the same task: that document's tab reads
      "· Done", the other is selected and actionable, and there's no "needs Action access"
      note. *(Checked 2026-10-16 with an edited `GET /tasks/:id`. A real partial action was
      made on 2026-10-20 for TP-W9 and the task stayed open, but the page wasn't looked at
      before the send-back, so the "· Done" tab is still unverified with live data.)*
- [x] **TP-W9.** Backend ask T3: on a task at stage A with two documents, review one only; at
      stage B, Request changes on it. Expect 200, the same task at A holding both documents,
      the returned one actionable with its changes-requested marker. *(Verified 2026-10-20 on
      "ZZ test — T3 send-back recheck": instance `724841a3…`, task `a5108094…`; closed and
      archived afterwards, both documents back to `closed`.)*

## 19g. Phase X — Frontend spec items (backend PR #51, live 2026-10-14)

Backend half: `edms-backend` `9998e05` (D3 re-index, D4 item 7 source-cabinet edit, D5
`departmentId` filters, D6 search filters, O1 login `departmentId`, O2 one-level departments).
Run against the live backend (`edms-backend-zmfm.onrender.com`) as `client_admin` and
`supervisor_finance` on 2026-10-14.

- [x] **TP-X1.** `/search` with text in the box: the Status / Type / Confidentiality / Urgency
      facets stay enabled (they used to grey out) and all of them reach the search endpoint
      together. *(Verified 2026-10-14: `q=invoice` → 11 results; `+ status=closed` → 6;
      `+ documentType=Invoice` → 5. Requests captured:
      `/documents/search?q=invoice&status=closed&documentType=Invoice&…`.)*
- [x] **TP-X2.** A **Department** facet is listed (all 6, sub-departments labelled with their
      path, e.g. "Operations › Finance") and narrows both browse and text search. *(Verified
      2026-10-14: `+ departmentId=<Finance>` sent; `departmentId=<Human Resources>` → "0 results
      for “invoice”" with the no-match empty state.)*
- [x] **TP-X3.** `/management`'s department table has a **Records** column; View opens
      `/search?dept=<id>` with the Department facet already checked. *(Verified 2026-10-14 on
      Finance: `Finance | 5 | 5 | 9 | 86% | View` → `/search?dept=b133c724…` → facet checked →
      18 results.)* *The **View** button was renamed **Documents** later that day, when a
      **Workflows** button joined it — see TP-Z4.*
- [x] **TP-X4.** `/management/departments`: no button with "All departments"; with one selected,
      **View records** opens the same URL. *(Verified 2026-10-14.)*
- [x] **TP-X5.** A saved search keeps its department and survives a reload. *(Verified
      2026-10-14: saved "TP-X5 finance invoices" → reloaded → applied → all three facets back
      (Department/Type/Status) and the request carried all four params.)* **Stale-department
      guard verified later on 2026-10-14** as `client_admin`: created a throwaway department,
      opened `/search?dept=<it>` (`GET /documents?departmentId=<it>` → 200), saved the search,
      deleted the department (204), reloaded and applied it → toast "The department in this
      saved search is no longer available", the department gone from the facet list, and no
      request carried the deleted id (the remaining unfiltered list came from cache). Saved
      search removed afterwards.
- [x] **TP-X6.** As `supervisor_finance`: `GET /workflow-instances?scope=all&departmentId=<own>`
      → 200 (11); `departmentId=<Human Resources>` → **403 `WORKFLOW_DEPARTMENT_SCOPE_FORBIDDEN`**.
      *(Verified 2026-10-14, directly against the API.)*
- [ ] **TP-X7.** DOCX indexed by title at create / metadata value re-indexed on edit. **Not run**
      — needs a fresh upload; the upload path went to the external gateway. The re-index code is
      in `origin/dev`, not verified from here.
- [x] **TP-X8.** Departments are one level deep. *(Verified 2026-10-14: the UI's parent picker
      offers only the 6 top-level departments, no "Finance"; `POST /departments` with a
      sub-department as parent → 422 `DEPARTMENT_DEPTH` "Departments can only be nested one level
      deep"; re-parenting a department that has children → 422 `DEPARTMENT_DEPTH` "A department
      with sub-departments cannot be moved under another department" — tested on throwaway
      rows, which were then deleted and the tree re-checked at 6 top-level / 7 total.)*
- [ ] **TP-X9.** Cross-cabinet move needs edit on the source cabinet. **Not run** — needs two
      cabinets with different edit grants; API-only, no UI sends `cabinetId`.

## 19h. Phase Y — Session lifecycle (2026-10-14, DRIFT-23 and DRIFT-24)

Reproduced and fixed against the live dev server (headless Chromium) on 2026-10-14. The
repro is: a live session → kill it in place (`POST /api/auth/logout` revokes the refresh
token, then the `accessToken` cookie is replaced with garbage, exactly as an expired JWT
looks) → wait for the bell's 60 s poll.

- [x] **TP-Y1 (the reported bug).** The poll 401s, exactly one `POST /api/auth/refresh` 401s,
      and the "Session ended" modal appears. *(Verified 2026-10-14 at 45 s / 60 s on two runs.
      Network: `401 /notifications/unread-count` → `401 /api/auth/refresh`, twice because the
      notification query retries once.)*
- [x] **TP-Y2 (the regression).** With the modal up, a **client-side** navigation (the proxy
      answers `307 /supervisor/approvals?_rsc=…` → `200 /`) lands on the login screen with the
      stores still alive, because the middleware's redirect is not a logout. Signing in again
      then used to re-surface the modal over the *new* session. *(Verified 2026-10-14 —
      including the counterfactual: with **both** clears disabled, `modalAfterLogin: 1` and the
      modal covered the app; with either clear enabled, `modalAfterLogin: 0`. That is the exact
      report, and the fix is what stops it.)*
- [ ] **TP-Y3.** The modal's own **Sign in again** path. **Not run** — that path already cleared
      the flag before this change (`performLogout`), so it wasn't the broken one.
- [ ] **TP-Y4.** A request that 401s while logged out leaves the next session alone. **Not run**
      directly; covered indirectly by TP-Y2 (the flag is now cleared at the start of a session).
- [x] **TP-Y5.** Normal sidebar sign-out and sign-in: no modal. *(Verified 2026-10-14 while checking the
      galaxybackbone brand: the sidebar's "Sign out / switch role" landed on `/` with the sign-in form and
      `[role=dialog][aria-label="Session ended"]` count 0.)*
- [x] **TP-Y6 (DRIFT-24, found while setting up the above).** A dead session must not leave the
      app unopenable. Before: with a persisted `currentUser` and dead cookies, the login page
      rendered **nothing at all** (`bodyTextLength: 0`) and survived a reload — the only escape
      was clearing site data. *(Verified 2026-10-14, before and after: pre-fix blank on reload,
      fixed by clearing localStorage; post-fix `/supervisor` → `307` + cookies deleted → login
      form renders, `accessToken`/`refreshToken` gone, stale `currentUser` cleared. Also
      verified the fix does not turn a reachable-but-dead-looking backend into a logout, since
      the proxy only deletes on a confirmed 401/403.)*


## 19i. Phase Z — Handoff "easy" items (2026-10-14)

From `HANDOFF-2026-10-14` "What's left". Run against the user's `next dev` on :3000 and the
live backend, headless Edge, signing in through the login form.

- [x] **TP-Z1.** As `supervisor_finance`, `/staff/tasks` → Status **Overdue**: the request is
      `GET /tasks?scope=mine&overdue=true` and every row is Overdue. *(Verified 2026-10-14:
      1 row, matching `overdue=true` total 1 from the API.)*
- [x] **TP-Z2.** Status **Pending**, **In Progress**, **On Hold**: each sends
      `status=pending&overdue=false` and the rows split by workflow state. Before, In Progress
      and On Hold sent `status=in_progress` / `on_hold` — not task statuses — and showed
      "Failed to load tasks" (400 `VALIDATION_ERROR`, reproduced with curl). *(Verified
      2026-10-14: Pending 0, In Progress 1, On Hold 0, no error; the one open task is
      In Progress.)*
- [x] **TP-Z3.** **Sort: Due date** sends `sort=dueAt` and keeps the server's order: earliest
      deadline first, tasks without one last. *(Verified 2026-10-14: Overdue, In Progress, then
      the 11 closed tasks.)*
- [x] **TP-Z4.** As `management_ops`, `/management`'s Records column has **Documents** and
      **Workflows**. Finance → **Workflows** opens `/supervisor/instances?dept=<Finance>` with
      the Department picker on "Operations › Finance" and `departmentId` on the request; picking
      "All departments" drops it. *(Verified 2026-10-14: 3 in-progress workflows for Finance,
      4 for all departments.)*
- [x] **TP-Z5.** `/management/departments`: no buttons with "All departments"; with Finance
      picked, **View records** and **View workflows**. *(Verified 2026-10-14.)*
- [x] **TP-Z6.** As `supervisor_finance` (department scope), open
      `/supervisor/instances?dept=<a department that isn't theirs>`: no Department picker, no
      `departmentId` on the request, no 403. *(Verified 2026-10-14: 3 rows, request
      `scope=all&page=1&limit=20&status=in_progress`.)*
- [x] **TP-Z7 (DRIFT-12).** The seven login autofill accounts exist. *(Verified 2026-10-14:
      `POST /auth/login` succeeds for all seven `tjoel+…` addresses with `Fixture123!`.)*

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
- [x] the current document structure doesn't show who checked out a document. Check current backend code for the response of the api route for /document/:id
  - **Fixed on backend `dev` (`b4a3f81`, 2026-09-29):** `findById` now includes
    `checkoutLock` with `locker {id,name,email}` — exactly the one-liner below. No frontend
    change was needed beyond refreshing a stale comment in `models.ts`. Re-test TP-G1…G4.
  - *Previously:* confirmed on `dev`: `GET /documents/:id` returned only `isCheckedOut`, never the lock.
    **This is a bug, not just missing info:** the doc page compares
    `checkoutLock.lockedBy` to the current user, so with no lock in the response even the
    person who checked it out is treated as "someone else" and can't check it back in.
  - Backend fix (one line) in `documents.repository.ts` `findById` include:
    `checkoutLock: { include: { locker: { select: { id: true, name: true, email: true } } } }`
  - Frontend is ready for it (`CheckoutLock.locker`; the banner shows the holder's name).

## - Frontend-only work queue

Items whose backend already exists (or needs none). Worked through one at a time.

- [x] Search: filters sent to `GET /documents` (one value each, paginated) instead of
      filtering one page client-side; types from the shared `constants/documentTypes.ts`;
      saved searches per user, without the two seeded fakes (15.3, 15.4). ~~While text is
      entered only the Cabinet filter applies~~ — **fixed 2026-10-14:** `GET /documents/search`
      takes the whole list filter set (edms-backend PR #51), so `/search` sends every facet
      alongside `q` and no longer greys them out. A **Department** facet was added at the same
      time (see Phase X, TP-X1/TP-X2).
- [x] Edit a document's confidentiality and urgency after upload — `PATCH /documents/:id`,
      gated on `document:edit` (13.1/13.2). **Built 2026-10-08:** `/doc/[id]` → Details →
      Classification → **Change**. Also needs Edit on the cabinet. Tiers above your clearance
      are disabled. To test: as a supervisor, raise a document to Confidential (works) and
      check Restricted is disabled; as staff, check Confidential and Restricted are both
      disabled. Then route the document and check the next stage's deadline follows the new
      urgency
- [x] SLA settings screen: business hours, working days, holidays, warning window, urgency
      multipliers, breach action — `GET/PATCH /sla/configuration`, `/sla/holidays` (6.7, 6.8,
      18.2, 18.5). **Built 2026-10-08** as `/admin/policies` → **Urgency & SLA** (replacing a
      mock table). Saving needs `workflow:edit`; without it the form is read-only. To test: as
      client_admin, turn on working hours (Mon–Fri 08:00–17:00), add a holiday, set Critical to
      0.5, save, reload — all kept. Then route a Critical document into a 24 h stage and check
      its deadline is 12 working hours away. Changes don't move deadlines already set
- [x] Sub-folders: create and browse nested folders — folder `parentId` (5.1). **Built
      2026-10-08** on `/staff/cabinets`. To test: open a folder → **+ New sub-folder**; it nests
      in the sidebar tree and shows as a chip above the documents; the breadcrumb is clickable;
      upload into it (the picker shows "Parent / Child"); Delete on the parent is refused while it
      has sub-folders. The API doesn't limit depth or stop moving a folder under its own child
- [x] Typed signature: render the typed name to an image for approve (9.1). **Built
      2026-10-08:** Sign & approve → Signature → **Type**; the preview is the exact PNG sent.
      Uses system script fonts (Segoe Script, Brush Script MT, Apple Chancery, else the
      browser's cursive), so the look varies by device. To test: approve with a typed name, then
      check the workflow trail shows that image
- [ ] ~~My Performance from `GET /tasks/stats?assigneeId=` (16.4)~~ — **not frontend-only**
      (checked 2026-10-08): `GET /tasks/stats` groups by department only, its query schema is
      `.strict()` (no `assigneeId`), and it returns 403 without oversight, so staff can't call
      it. Needs a backend change. Meanwhile the fake "Rework rate 4.2%" was replaced by a real
      "Changes requested" rate from the user's own tasks
- [x] Staff dashboard: status tiles click through (19.1). **Built 2026-10-08:** Pending / In
      Progress / Closed list your workflows in that state (In Progress includes on hold), each
      row opens the workflow page; Overdue still filters tasks. To test: click each tile and
      check the rows match the tile's count (up to 8 shown).
- [ ] Staff dashboard: SLA/ageing highlighting (19.4) — **needs backend:** `GET /tasks` has
      no deadlines since `919d0ef` (requested)
- [x] ~~My Tasks: keep the backend's urgency → due-date order instead of re-sorting (19.2)~~
      — **superseded:** since `919d0ef` `GET /tasks` carries no deadlines, so there is no
      server-side due-date order to keep
- [x] Quick-actions strip; recent and pinned documents/searches (19.3, 19.5). **Built
      2026-10-08:** a Quick access card on `/staff` (actions, Pinned documents, Recently
      opened, Saved searches) and a **Pin** button on `/doc/[id]`. Stored per user in the
      browser (no favourites API), so it doesn't follow you to another device. To test: open
      two documents, pin one, save a search — all three lists fill; a saved search reruns with
      its filters; sign in as someone else — their lists are empty
- [x] Admin home setup checklist (18.1). **Built 2026-10-08** from live data. To test: on a
      fresh tenant every step shows pending; create a department, a cabinet (it gets "General"),
      a second user and publish a workflow — each ticks off and the % reaches 100. Add a cabinet
      with no folders → "Folders in every cabinet (1 without one)" and a pending task appear
- [ ] Chart drill-downs to filtered record lists (21.6, 22.3). **Partly done 2026-10-08:** on
      `/management` and `/management/departments`, clicking a department's bar scopes the
      dashboard to that department (clicking it again on Departments widens back).
      **Backend + frontend built 2026-10-14, not yet verified:** `GET /documents` takes
      `departmentId` (edms-backend PR #51), `/search` has a Department facet fed by `?dept=`, and
      `/management`'s department table (**Records**) and `/management/departments`
      (**View records**) open `/search?dept=<id>`.
      To test: click a department bar on each page, then Records / View records — see Phase X
      (TP-X3, TP-X4)
- [x] Status/ageing/SLA reports with CSV/Excel export built in the browser (25.2, 25.6).
      **Built 2026-10-08** on `/management/reports`: open items by cabinet, ageing register, SLA
      compliance by department (date range), workload by member; department filter; preview
      table; CSV download that Excel opens. Not built: true .xlsx/PDF and scheduled reports
      (needs a backend job). To test: run each report for All and for one department and
      compare totals with `/management` and `/supervisor/bottlenecks`
- [x] Configuration history: audit log filtered to config actions (18.7). **Built 2026-10-08**
      on `/admin/audit` (and `/auditor/trail`): a record-type dropdown whose Configuration group
      is roles, departments, cabinets (incl. access and metadata fields), folders, workflow
      designs and users, and an action dropdown narrowed to that type. Only one type at a time,
      since `GET /audit` takes a single `objectType`. SLA settings aren't audited server-side.
      To test: rename a role, then pick Roles & permissions — the rename is listed; Export
      gives the same rows
- [ ] PDF/image preview and in-PDF search (4.3, 5.9 — partial; Office/email/OCR need backend).
      **Done 2026-10-08:** readable fallback for files that can't be previewed ("Word
      documents can't be previewed yet" + the audited Download, hidden without download
      permission). To test: open a DOCX on `/doc/[id]` and on its workflow page.
      **In-PDF search done 2026-10-08** with the pdf.js viewer (`PdfViewer`): find with
      highlights and match count, page box, zoom, Print (audited, watermark burned in) and
      Download in the viewer's toolbar, Export on `/doc/[id]`. Scanned PDFs: find searches the
      OCR text and shows it as a "Scanned text" view with highlights (2026-10-08) — test on
      "DN 2026 0921 delivery note scanned", search "Ridgeline". To test: open a PDF, type a
      word into "Find in document", press Enter to step through matches; Ctrl+F inside the
      viewer focuses the box; Print on a Confidential document — the printout carries the
      watermark. Left: Office/email previews (backend)
- [ ] Responsive, accessibility, i18n setup, help (28.1–28.4); frontend test setup (29.3).
      **Help done 2026-10-08:** `/help` (topics for your role, search, a topic per area), the
      Topbar's "?" opens the topic for the page you're on, the sidebar's Help & support goes
      there, and "/" now focuses search as its hint says. To test: press "?" on Upload, a
      workflow page and Policies — each opens its own topic. **Deferred by product decision
      (2026-10-08):** responsive layout, accessibility, i18n and frontend tests
- [x] Permission gates on the P4 actions — see the P4 table (2026-10-08)
- [x] Role switcher for multi-role users (doc 05 #29). **Built 2026-10-08.** To test: give a
      supervisor the `internal_auditor` role too, sign in — they land on `/auditor` and the
      Topbar label is a dropdown; pick Supervisor Console — sidebar and page switch; reload and
      sign out/in — the choice holds; sign in as someone else — they get their own default
- [x] Date picker is cutoff when user wants to schedule circular at a later date/time in the publish modal
      — **Fixed 2026-10-08** in the shared `DatePicker`: it assumed a 380 px popover (a six-week
      month plus the time row is taller) and, when neither side had that much room, always
      opened downward off the screen. It now measures itself, opens on whichever side fits, and
      otherwise stays inside the viewport and scrolls. Covers every date picker in a modal. To
      test: on a short window (or zoomed in), Publish… → Schedule for later → open the picker
