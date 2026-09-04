/**
 * Content for the Product Guide page (/user-stories).
 *
 * Every status here is the *verified build status* of the code behind the story,
 * re-checked on 2026-09-04 against `edms-backend` @ dev (b72e0bf) and this repo @ dev.
 * It is the same source of truth as `docs/02-user-stories.md` — when you change one,
 * change the other. `AGENTS.md` records that rule.
 */

export type Status = 'done' | 'partial' | 'mock' | 'broken' | 'none';

export const STATUS_LABEL: Record<Status, string> = {
  done: 'Done',
  partial: 'Partial',
  mock: 'Mock',
  broken: 'Broken',
  none: 'Not built',
};

/** Maps to the existing badge classes in globals.css so this page inherits the design system. */
export const STATUS_CLASS: Record<Status, string> = {
  done: 'b-status-closed',
  partial: 'b-status-pending',
  mock: 'b-status-on-hold',
  broken: 'b-status-overdue',
  none: 'b-status-in-progress',
};

export const STATUS_HELP: Record<Status, string> = {
  done: 'Works end to end against the real API.',
  partial: 'Built, but not reachable from the UI or not complete.',
  mock: 'Real interface over fixture data. Nothing persists.',
  broken: 'Wired to something that fails.',
  none: 'No code on either side yet.',
};

/* ------------------------------------------------------------------ */
/* Personas                                                            */
/* ------------------------------------------------------------------ */

export interface Persona {
  name: string;
  role: string;
  title: string;
  day: string;
  fear: string;
  grants: string;
  scope: string;
  portal: string;
}

export const PERSONAS: Persona[] = [
  {
    name: 'Chika',
    role: 'staff',
    title: 'Staff Officer · 15–40 documents a day',
    day: 'Receives paperwork from a shared scanner, email and physical trays, and gets each item into the right cabinet with the right labels, moving toward whoever must act on it.',
    fear: 'Losing a document, or being blamed for a delay that was actually sitting in a supervisor’s queue.',
    grants: '14',
    scope: 'own / department',
    portal: '/staff',
  },
  {
    name: 'David',
    role: 'supervisor',
    title: 'Operations Lead · 6–12 direct reports',
    day: 'The bottleneck by design — most documents pass an approval stage assigned to him. He also owns his team’s throughput and can move work off an overloaded desk.',
    fear: 'A breached SLA he never saw coming.',
    grants: '18',
    scope: 'department',
    portal: '/supervisor',
  },
  {
    name: 'Eniola',
    role: 'management',
    title: 'Executive · divisional or C-suite',
    day: 'Never files a document. Opens the system to answer “is Finance slower than HR this quarter, and by how much?” — then to export that into a board pack.',
    fear: 'Being surprised in a board meeting by numbers that don’t reconcile.',
    grants: '10, read-only',
    scope: 'global',
    portal: '/management',
  },
  {
    name: 'Femi',
    role: 'internal_auditor',
    title: 'Assurance · independent of operations',
    day: 'Samples documents, verifies that stated controls were actually applied, and raises findings when they weren’t. Cannot mutate anything, by design — that independence is the point.',
    fear: 'An audit trail with gaps he cannot prove are the only gaps.',
    grants: '10, read-only',
    scope: 'global',
    portal: '/auditor',
  },
  {
    name: 'Bola',
    role: 'client_admin',
    title: 'Tenant system owner · IT or Operations',
    day: 'Configures everything: the department tree, cabinets and folders, who holds which role, the approval workflows, retention policy and branding.',
    fear: 'A misconfigured workflow silently stalling every document in a cabinet.',
    grants: '45, all global',
    scope: 'global',
    portal: '/admin',
  },
  {
    name: 'Adaeze',
    role: 'schulltech_admin',
    title: 'Vendor operations · not a customer employee',
    day: 'Provisions tenant organisations, manages commercial plans and watches platform health. Holds three grants only and is excluded from every confidentiality tier — the vendor cannot read customer documents.',
    fear: 'Being able to read a customer’s files — that is a liability, not a capability.',
    grants: '3',
    scope: 'global, workflow + audit only',
    portal: '/platform',
  },
];

/* ------------------------------------------------------------------ */
/* Setup flow — phases 0 to 7                                          */
/* ------------------------------------------------------------------ */

export interface Step {
  lane: number;
  row: number;
  tag: string;
  title: string;
  detail: string;
  status: Status;
  statusLabel?: string;
  note?: string;
}

export const SETUP_LANES = [
  { name: 'Adaeze', sub: 'schulltech_admin' },
  { name: 'Engineering', sub: 'CLI, not a portal' },
  { name: 'Bola', sub: 'client_admin' },
  { name: 'Everyone', sub: 'all six roles' },
];

export const SETUP_STEPS: Step[] = [
  {
    lane: 1,
    row: 2,
    tag: 'Phase 0',
    title: 'Provision the tenant',
    detail: 'Isolated database, commercial plan, first admin account.',
    status: 'mock',
    note: 'No control plane exists. Today this is a manual engineering task.',
  },
  {
    lane: 2,
    row: 3,
    tag: 'Phase 1',
    title: 'Bootstrap roles & permissions',
    detail: 'Migrate, then seed 6 roles, 45 permissions, 100 grants.',
    status: 'done',
    note: 'Real, but CLI-only. `prisma generate` must run or every scope narrows.',
  },
  {
    lane: 3,
    row: 4,
    tag: 'Phase 2',
    title: 'Department tree',
    detail: 'Defines document scoping and every report’s grouping.',
    status: 'done',
  },
  {
    lane: 3,
    row: 5,
    tag: 'Phase 3',
    title: 'Cabinets & folders',
    detail: 'The filing structure staff will navigate.',
    status: 'partial',
    note: 'No metadata designer, so no cabinet ever gets custom fields.',
  },
  {
    lane: 3,
    row: 6,
    tag: 'Phase 4',
    title: 'Cabinet access grants',
    detail: 'Who may view, upload or manage each cabinet.',
    status: 'broken',
    statusLabel: 'No UI',
    note: 'The API exists; nothing calls it, so no tenant has any grants.',
  },
  {
    lane: 3,
    row: 7,
    tag: 'Phase 5',
    title: 'Create users',
    detail: 'Account, department, one or more roles.',
    status: 'partial',
    note: 'No invite, no reset, no rate limit — the admin sets and keeps the password.',
  },
  {
    lane: 3,
    row: 8,
    tag: 'Phase 6',
    title: 'Design & publish workflows',
    detail: 'Stages, assignees, SLA hours per stage.',
    status: 'broken',
    statusLabel: 'Unauthorized',
    note: 'Works, but 25 workflow routes carry no permission check at all.',
  },
  {
    lane: 4,
    row: 9,
    tag: 'Phase 7',
    title: 'First login',
    detail: 'JWT issued, refresh token in an HttpOnly cookie, role-based landing page.',
    status: 'done',
    note: 'The route guard is client-side only; the backend is the real gate.',
  },
];

/* ------------------------------------------------------------------ */
/* Document journey — phase 8                                          */
/* ------------------------------------------------------------------ */

export const JOURNEY_LANES = [
  { name: 'Chika', sub: 'staff' },
  { name: 'System', sub: 'workers & queues' },
  { name: 'David', sub: 'supervisor' },
  { name: 'Eniola', sub: 'management' },
  { name: 'Femi', sub: 'internal_auditor' },
];

export const JOURNEY_STEPS: Step[] = [
  {
    lane: 1,
    row: 2,
    tag: 'Step 1',
    title: 'Upload and file',
    detail:
      'SHA-256 computed in the browser, cabinet access checked, reference issued as DOC-20260829-142317, document and version 1 written in one transaction.',
    status: 'done',
    note: 'The “IDU” confidence badge on the upload card is fixed sample data, not a model.',
  },
  {
    lane: 2,
    row: 3,
    tag: 'Step 2',
    title: 'OCR and search index',
    detail:
      'Textract is pointed at the S3 bucket — but the file was uploaded elsewhere, so the read always fails.',
    status: 'broken',
    note: 'Indexing sits on the OCR success path, so the document stays invisible to search forever.',
  },
  {
    lane: 1,
    row: 4,
    tag: 'Step 3',
    title: 'Route for approval',
    detail: 'Creates the workflow instance, then starts it — two calls, in order.',
    status: 'done',
    statusLabel: 'Fixed',
    note: 'Was a 404 against a route that never existed. Now correct and wired into the UI.',
  },
  {
    lane: 2,
    row: 5,
    tag: 'Step 4',
    title: 'Instance starts',
    detail:
      'First stage computed, stage deadline set from the SLA, task created for a named assignee or a role pool, history row written.',
    status: 'broken',
    statusLabel: 'Unauthorized',
    note: 'Correct behaviour, but no permission check guards the endpoint.',
  },
  {
    lane: 3,
    row: 6,
    tag: 'Step 5',
    title: 'Task reaches the queue',
    detail:
      'Resolves direct assignment, role-pool membership and active delegations; prioritised by urgency, then due date.',
    status: 'partial',
    note: 'David is never told. He sees it only if he happens to open the page.',
  },
  {
    lane: 3,
    row: 7,
    tag: 'Step 6',
    title: 'Approve, reject or request changes',
    detail:
      'Decision and note recorded against the document, instance advances, the next stage’s SLA clock starts, the final stage closes the document.',
    status: 'done',
  },
  {
    lane: 2,
    row: 8,
    tag: 'Step 7',
    title: 'SLA watch, in parallel',
    detail:
      'Every 5 minutes: warns within 4 hours of the deadline, escalates past it, de-duplicates per task, resolves on completion.',
    status: 'partial',
    note: 'The engine is real and correct. It runs into a void — nobody is ever told.',
  },
  {
    lane: 4,
    row: 9,
    tag: 'Step 8',
    title: 'Aggregates update',
    detail:
      'Throughput, backlog and SLA compliance by department, attributed through the cabinet→department hop.',
    status: 'partial',
    note: 'Numbers are real but computed in the browser — up to 150 sequential requests per dashboard.',
  },
  {
    lane: 5,
    row: 10,
    tag: 'Step 9',
    title: 'Audit trail',
    detail: 'Every step above should have written an append-only, hash-chained entry.',
    status: 'broken',
    statusLabel: 'Nothing recorded',
    note: 'Not one event, ever — upload, view, approve, permission change, login or download.',
  },
];

/* ------------------------------------------------------------------ */
/* Handoffs                                                            */
/* ------------------------------------------------------------------ */

export interface Handoff {
  id: string;
  from: string;
  to: string;
  title: string;
  status: Status;
  statusLabel?: string;
  body: string;
  fix?: string;
}

export const HANDOFFS: Handoff[] = [
  {
    id: 'H1',
    from: 'Adaeze',
    to: 'Bola',
    title: 'Provisioning a tenant',
    status: 'mock',
    body: 'Should pass a provisioned tenant, an isolated database, a plan and the first admin account with credentials. None of it exists — no control-plane database, no provisioning, no plan model, no mail transport.',
    fix: 'Phase-2 multi-tenancy: control-plane database, tenant resolution middleware, per-request database injection.',
  },
  {
    id: 'H2',
    from: 'Bola',
    to: 'every role',
    title: 'Provisioning people',
    status: 'partial',
    body: 'Account creation, password hashing, department and role validation and deactivation are all real. What is missing is everything around it: no invite flow, no forced password change, no reset, no rate limit on login. In practice the administrator chooses each person’s password, communicates it personally, and permanently knows it.',
    fix: 'An invite endpoint with a signed expiring token, a mail transport, an accept-invite page, and rate limiting on login.',
  },
  {
    id: 'H3',
    from: 'Bola',
    to: 'Chika & David',
    title: 'Structure and process',
    status: 'partial',
    body: 'Cabinets, folders and workflow definitions pass correctly. Three things do not: metadata fields have no designer, so no cabinet ever has any and metadata search has nothing to search; cabinet access grants have no UI, so need-to-know is never established; and workflow definitions have no authorization.',
    fix: 'Also unvalidated: a folder is never checked against its cabinet, so the folder tree can cross cabinets.',
  },
  {
    id: 'H4',
    from: 'Chika',
    to: 'David',
    title: 'Routing for approval',
    status: 'done',
    statusLabel: 'Now fixed',
    body: 'This is the most important handoff in the product. Until recently the UI called a single endpoint that matched no backend route, so the entire approval half of the product was complete and unreachable because of one wrong URL. The two-call sequence is now correct and wired in.',
    fix: 'Still compounding it: the supervisor is not notified, and the endpoint checks no permissions.',
  },
  {
    id: 'H5',
    from: 'David',
    to: 'Chika',
    title: 'Reassignment and rejection',
    status: 'partial',
    body: 'Work returns downward correctly — reassignment is gated by role, and rejection and request-changes both write history. But the person receiving work back is never notified; they discover it by chance.',
    fix: 'Delegation exists in the backend with no UI, so a supervisor going on leave cannot hand over at all.',
  },
  {
    id: 'H6',
    from: 'Chika + David',
    to: 'Eniola',
    title: 'Aggregate reporting',
    status: 'partial',
    body: 'The numbers are genuinely real and correctly attributed. The problem is where they are computed: entirely in the browser, by fetching every page of several collections — up to 150 sequential requests to render one dashboard.',
    fix: 'Aggregation endpoints on the backend. SLA compliance is recomputed client-side even though the breach table already holds the answer.',
  },
  {
    id: 'H7',
    from: 'everyone',
    to: 'Femi',
    title: 'The audit trail',
    status: 'broken',
    statusLabel: 'Completely broken',
    body: 'Should carry every create, update, delete, view, download, approval and permission change as an immutable hash-chained entry. What actually passes is nothing — not one event, ever. The table exists with its hash chain, its indexes and its 25 documented action types; the middleware that would write to it is an empty file.',
    fix: 'This is the handoff that decides whether the product can be sold as a compliance system. It is a mock on both sides of the seam.',
  },
];

/* ------------------------------------------------------------------ */
/* Stories                                                             */
/* ------------------------------------------------------------------ */

export interface Story {
  id: string;
  title: string;
  statement: string;
  status: Status;
  statusLabel?: string;
  note?: string;
}

export interface Epic {
  letter: string;
  name: string;
  verdict: string;
  stories: Story[];
}

export const EPICS: Epic[] = [
  {
    letter: 'A',
    name: 'Capture & filing',
    verdict: 'Core works; enrichment missing',
    stories: [
      {
        id: 'A1',
        title: 'Upload a document into a cabinet',
        statement:
          'As Chika, I want to drag a scanned document onto the upload screen, confirm where it belongs and how sensitive it is, and file it, so that it stops being a loose file on my desktop and becomes a tracked record with an official reference number.',
        status: 'done',
        note: 'The due date is collected and discarded — there is no due-date field on the document. Custom metadata is never asked for, so a cabinet with required fields is filed incomplete every time. 2 MB ceiling.',
      },
      {
        id: 'A2',
        title: 'Have the system read the document for me',
        statement:
          'As Chika, I want the system to extract the vendor name, invoice number and amount from a scanned invoice and pre-fill the metadata, so that I am confirming a machine’s reading rather than typing from a page.',
        status: 'none',
        note: 'The confidence percentages on the upload screen are sample data — a fixed set of four predictions cycled per file.',
      },
      {
        id: 'A3',
        title: 'Organise cabinets into folders',
        statement:
          'As Bola, I want to create a folder hierarchy inside each cabinet, so that the filing structure mirrors how my organisation actually thinks about its records, and staff don’t have to guess.',
        status: 'done',
      },
      {
        id: 'A4',
        title: 'Define custom metadata per cabinet',
        statement:
          'As Bola, I want to define that the Invoices cabinet requires “Vendor Name”, “Invoice Number” and “Contract Value”, so that every invoice is captured consistently and those fields become searchable.',
        status: 'partial',
        note: 'Backend only. The API accepts field definitions; no screen creates them, so no cabinet has any.',
      },
    ],
  },
  {
    letter: 'B',
    name: 'Retrieval & search',
    verdict: 'Search built, returns nothing',
    stories: [
      {
        id: 'B1',
        title: 'Find a document by its content',
        statement:
          'As Chika, I want to type “Meridian Interiors” and find the invoice even though that phrase is only inside the scanned page, so that I can answer a customer’s question while they are still on the phone.',
        status: 'partial',
        note: 'Full-text search is built end to end and permanently returns nothing, because indexing runs only on the OCR success path and OCR always fails.',
      },
      {
        id: 'B2',
        title: 'Browse the filing structure',
        statement:
          'As Chika, I want to navigate cabinets and folders the way I would walk to a filing cabinet, so that I can find things by structure when I can’t remember the words.',
        status: 'done',
      },
      {
        id: 'B3',
        title: 'Open a document and see everything about it',
        statement:
          'As any authenticated user, I want one screen showing the document, its metadata, its version history, its workflow position and its activity, so that I don’t have to assemble the picture from four places.',
        status: 'partial',
        note: 'Recently fixed: the confidentiality policy lookup read a shape the API never returns, so every check fell through to permissive defaults. Download and print now genuinely respect the tier.',
      },
      {
        id: 'B4',
        title: 'Download, print or export a document',
        statement:
          'As David, I want to download a contract to read offline, subject to my clearance, so that I can review it on a flight — and so the system records that I took a copy.',
        status: 'none',
        note: 'No download endpoint exists. This is where confidentiality controls earn their keep, and the one action nobody can audit because it never reaches the server.',
      },
    ],
  },
  {
    letter: 'C',
    name: 'Routing, review & approval',
    verdict: 'Execution solid; endpoints unauthorized',
    stories: [
      {
        id: 'C1',
        title: 'Route a document into an approval workflow',
        statement:
          'As Chika, I want to send a filed invoice into the “Standard Invoice Approval” workflow, so that it reaches my supervisor with a deadline attached instead of an email that might be missed.',
        status: 'done',
        statusLabel: 'Fixed',
        note: 'Was the single highest impact-to-effort defect in either codebase. Now correct: create the instance, then start it.',
      },
      {
        id: 'C2',
        title: 'Work my task queue',
        statement:
          'As David, I want a single prioritised list of everything waiting on me, with the most urgent and most overdue at the top, so that I work the right thing first instead of whatever is most recent.',
        status: 'done',
      },
      {
        id: 'C3',
        title: 'Approve, reject or request changes',
        statement:
          'As David, I want to approve a document with a note, or send it back with a reason, so that the decision and its justification live with the document permanently.',
        status: 'done',
      },
      {
        id: 'C4',
        title: 'Delegate my work while I’m away',
        statement:
          'As David, I want to hand my approvals to a colleague for the two weeks I’m on leave, so that nothing stalls behind an empty desk.',
        status: 'partial',
        note: 'Backend only. Task resolution already honours active delegations — there is simply no screen to create one.',
      },
      {
        id: 'C5',
        title: 'Design an approval workflow',
        statement:
          'As Bola, I want to define the stages an invoice passes through, who acts at each stage and how long they have, so that the process is enforced by the system rather than remembered by people.',
        status: 'partial',
        note: 'Works, and is unprotected: all 25 workflow routes carry zero permission checks, so any signed-in account can rewrite, publish or archive the process.',
      },
    ],
  },
  {
    letter: 'D',
    name: 'Version control & custody',
    verdict: 'The strongest area of the product',
    stories: [
      {
        id: 'D1',
        title: 'Check out a document before editing',
        statement:
          'As Chika, I want to lock a document while I revise it, so that a colleague doesn’t overwrite my work with a parallel edit.',
        status: 'done',
      },
      {
        id: 'D2',
        title: 'Keep every version',
        statement:
          'As Femi, I want every revision retained with its uploader, timestamp and checksum, so that I can prove what a document said on a given date.',
        status: 'done',
      },
      {
        id: 'D3',
        title: 'Roll back to a previous version',
        statement:
          'As David, I want to restore the version from before a bad edit, so that a mistake is a two-click recovery rather than a re-scan.',
        status: 'partial',
        note: 'Backend only. The restore endpoint exists; no screen calls it.',
      },
    ],
  },
  {
    letter: 'E',
    name: 'Access control & confidentiality',
    verdict: 'Well designed; under-enforced on reads',
    stories: [
      {
        id: 'E1',
        title: 'Classify a document by sensitivity',
        statement:
          'As Chika, I want to mark a document Confidential when it contains customer financial data, so that it is invisible to people who have no business reading it.',
        status: 'partial',
        note: 'Enforced on view only. Download, print and export do not check the tier — largely because those endpoints do not exist yet.',
      },
      {
        id: 'E2',
        title: 'Grant cabinet-level access',
        statement:
          'As Bola, I want to give the Legal team view access to the Contracts cabinet and upload access to nobody else, so that need-to-know is enforced by structure, not by trust.',
        status: 'partial',
        note: 'Backend only, and only on write. Upload checks cabinet access; listing and reading documents do not.',
      },
      {
        id: 'E3',
        title: 'Assign users to roles',
        statement:
          'As Bola, I want to give a new joiner the Staff role and place them in Operations, so that they get exactly the access their job requires on day one.',
        status: 'done',
      },
      {
        id: 'E4',
        title: 'Edit the role permission matrix',
        statement:
          'As Bola, I want to adjust exactly what each role can do, so that the system matches my organisation’s separation-of-duties policy rather than a vendor’s assumptions.',
        status: 'partial',
        note: 'The six roles are seeded as system roles and are not tenant-editable, so the matrix is read-only in practice.',
      },
    ],
  },
  {
    letter: 'F',
    name: 'Oversight, SLA & workload',
    verdict: 'Engine real; nobody is notified',
    stories: [
      {
        id: 'F1',
        title: 'See my team’s workload',
        statement:
          'As David, I want to see how many open items each team member is carrying, so that I can rebalance before someone drowns.',
        status: 'partial',
        note: 'There is no backend concept of a reporting line, so “my team” is currently the first users the API returns.',
      },
      {
        id: 'F2',
        title: 'Catch ageing work before it breaches',
        statement:
          'As David, I want to see what is approaching its deadline, so that I intervene while it still matters.',
        status: 'partial',
        note: 'Two problems. The SLA worker detects breaches correctly and tells nobody. Separately, two different overdue calculations exist in the frontend, both comparing against a field the document does not have — so every overdue badge reads zero.',
      },
      {
        id: 'F3',
        title: 'Reassign work',
        statement:
          'As David, I want to move a task from one person to another with a reason, so that absence or overload doesn’t stall a document.',
        status: 'done',
      },
    ],
  },
  {
    letter: 'G',
    name: 'Executive reporting',
    verdict: 'Works today; will not scale',
    stories: [
      {
        id: 'G1',
        title: 'Compare departments',
        statement:
          'As Eniola, I want to see throughput, backlog and SLA compliance side by side across departments, so that I can direct attention where it is needed.',
        status: 'partial',
        note: 'Real numbers, wrong place — computed in the browser from full collection scans.',
      },
      {
        id: 'G2',
        title: 'See trends over time',
        statement:
          'As Eniola, I want to see whether turnaround is improving quarter on quarter, so that I can tell whether a process change worked.',
        status: 'partial',
      },
      {
        id: 'G3',
        title: 'Export a board pack',
        statement:
          'As Eniola, I want to export what I’m looking at as CSV, so that I can drop it into a board deck without asking anyone.',
        status: 'partial',
      },
    ],
  },
  {
    letter: 'H',
    name: 'Audit & compliance',
    verdict: 'Entirely mock — the biggest gap',
    stories: [
      {
        id: 'H1',
        title: 'See a complete, tamper-evident activity trail',
        statement:
          'As Femi, I want an append-only record of every view, edit, approval, download and permission change, so that I can reconstruct what happened and prove the record wasn’t altered.',
        status: 'mock',
        note: 'The screen is convincing and the data is fixtures. The table and hash chain exist in the schema; nothing has ever written to them.',
      },
      {
        id: 'H2',
        title: 'Track findings to closure',
        statement:
          'As Femi, I want to raise a finding against a document or process, assign an owner and a due date, and track it, so that issues are resolved rather than noted.',
        status: 'mock',
        note: 'Management’s findings page re-exports the auditor’s screen, so both roles read the same fixtures.',
      },
      {
        id: 'H3',
        title: 'Verify separation of duties',
        statement:
          'As Femi, I want the system to prevent one person both approving and auditing the same document, so that the control is structural rather than a policy people remember.',
        status: 'none',
      },
    ],
  },
  {
    letter: 'I',
    name: 'Tenant administration',
    verdict: 'Structure real; policy and branding mock',
    stories: [
      {
        id: 'I1',
        title: 'Set up the organisation structure',
        statement:
          'As Bola, I want to define our department hierarchy, so that document scoping and reporting reflect how we’re actually organised.',
        status: 'done',
      },
      {
        id: 'I2',
        title: 'Onboard a new employee',
        statement:
          'As Bola, I want to invite a new joiner by email and have them set their own password, so that I never handle their credentials.',
        status: 'partial',
        note: 'Creation works; the invite does not exist. The admin chooses the password, communicates it personally, and permanently knows it.',
      },
      {
        id: 'I3',
        title: 'Configure retention and confidentiality policy',
        statement:
          'As Bola, I want to set how long each cabinet’s documents are kept and what happens at expiry, so that we comply with our regulator’s retention schedule automatically.',
        status: 'mock',
        note: 'Nothing ever expires. The policy screen edits fixture data that no worker reads.',
      },
      {
        id: 'I4',
        title: 'Brand the system',
        statement:
          'As Bola, I want the portal to carry our logo and colours, so that staff experience it as our system, not a vendor’s.',
        status: 'mock',
      },
    ],
  },
  {
    letter: 'J',
    name: 'Communication & circulars',
    verdict: 'Circulars mock; notifications plumbed but silent',
    stories: [
      {
        id: 'J1',
        title: 'Broadcast a circular',
        statement:
          'As Bola, I want to send a policy update to all staff and require acknowledgement, so that I have proof everyone was told.',
        status: 'mock',
      },
      {
        id: 'J2',
        title: 'Acknowledge a circular',
        statement:
          'As Chika, I want to mark a circular as read, so that my compliance obligation is discharged and recorded.',
        status: 'mock',
      },
      {
        id: 'J3',
        title: 'Be notified when something needs me',
        statement:
          'As any user, I want an in-app notification when a task is assigned to me, an SLA is about to breach, or a circular needs acknowledging, so that I don’t have to poll the system to find out I’m blocking someone.',
        status: 'partial',
        note: 'Upgraded from broken to partial. The backend module, its six endpoints and the whole frontend surface now exist and work — but no event anywhere creates a notification, so the list is correctly, permanently empty.',
      },
    ],
  },
  {
    letter: 'K',
    name: 'Platform operations',
    verdict: 'Entirely mock, by design — Phase 2 work',
    stories: [
      {
        id: 'K1',
        title: 'Provision a tenant',
        statement:
          'As Adaeze, I want to create a new customer organisation with its own isolated database, so that onboarding is minutes rather than a manual database task.',
        status: 'mock',
      },
      {
        id: 'K2',
        title: 'Manage plans and entitlements',
        statement:
          'As Adaeze, I want to define commercial plans with feature and usage limits, so that entitlements are enforced by the system.',
        status: 'mock',
      },
      {
        id: 'K3',
        title: 'Meter usage and bill',
        statement:
          'As Adaeze, I want accurate storage and seat metering per tenant, so that invoices are defensible.',
        status: 'mock',
      },
      {
        id: 'K4',
        title: 'Feature flags',
        statement:
          'As Adaeze, I want to enable a feature for one tenant before all, so that a bad release is a toggle, not a rollback.',
        status: 'mock',
        note: 'The flags page re-exports the system-configuration screen — it shows the wrong page entirely.',
      },
      {
        id: 'K5',
        title: 'Platform health',
        statement:
          'As Adaeze, I want queue depth, worker status and error rates, so that I know a problem before a customer reports it.',
        status: 'mock',
      },
    ],
  },
  {
    letter: 'N',
    name: 'Cross-cutting, non-functional',
    verdict: 'Nobody’s feature, everybody’s problem',
    stories: [
      {
        id: 'N1',
        title: 'The system tells me why something failed',
        statement:
          'As any user, I want an error that explains what went wrong and what to do next, so that a failure is recoverable rather than mysterious.',
        status: 'partial',
        note: 'Unmatched API routes fall through to an HTML response, so a mistyped path surfaces as a parse error rather than a clean 404.',
      },
      {
        id: 'N2',
        title: 'The system is observable',
        statement:
          'As an operator, I want structured logs, metrics and traces, so that I can diagnose a production problem without reproducing it locally.',
        status: 'none',
      },
      {
        id: 'N3',
        title: 'Changes are safe to ship',
        statement:
          'As a developer, I want tests and a pipeline that catch a regression before a customer does, so that shipping is routine rather than risky.',
        status: 'partial',
      },
      {
        id: 'N4',
        title: 'The system stays fast as data grows',
        statement:
          'As any user, I want screens that load in the same time next year as today, so that success doesn’t make the product unusable.',
        status: 'partial',
        note: 'The known cliff: browser-side aggregation across whole collections in the management and auditor dashboards.',
      },
      {
        id: 'N5',
        title: 'Secrets and sessions are handled properly',
        statement:
          'As a security reviewer, I want sessions that can be ended and credentials that are never guessable at scale, so that a leaked password is a contained incident.',
        status: 'partial',
        note: 'No logout endpoint and no token revocation, so a refresh token stays valid for its full lifetime after sign-out. Login has no rate limit.',
      },
    ],
  },
];

export const ALL_STORIES: Story[] = EPICS.flatMap((e) => e.stories);

export const STATUS_COUNTS = (['done', 'partial', 'mock', 'broken', 'none'] as Status[]).reduce(
  (acc, s) => {
    acc[s] = ALL_STORIES.filter((st) => st.status === s).length;
    return acc;
  },
  {} as Record<Status, number>,
);
