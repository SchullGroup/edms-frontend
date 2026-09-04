/**
 * Content for the public Product Guide at /user-stories.
 *
 * ⚠️ THIS PAGE IS SERVED UNAUTHENTICATED. Anyone with the URL can read it.
 *
 * Keep it at product level: what EDMS does, who uses it, how a document moves,
 * and roughly what is shipped versus planned. Do NOT add internal engineering
 * detail here — unguarded endpoints, missing checks, auth weaknesses, file
 * paths, commit hashes, route counts or third-party infrastructure. That
 * material belongs in `docs/`, which ships with the repo and not with the app.
 *
 * The candid internal version of this same content lives in
 * `docs/02-user-stories.md`, `docs/03-onboarding-flow-end-to-end.md` and
 * `docs/04-role-onboarding-and-connections.md`. When a capability's real status
 * changes, update both.
 */

export type Status = 'available' | 'progress' | 'preview' | 'planned';

export const STATUS_LABEL: Record<Status, string> = {
  available: 'Available',
  progress: 'In progress',
  preview: 'Preview',
  planned: 'Planned',
};

/** Maps to the badge classes in globals.css so this page inherits the design system. */
export const STATUS_CLASS: Record<Status, string> = {
  available: 'b-status-closed',
  progress: 'b-status-pending',
  preview: 'b-status-on-hold',
  planned: 'b-status-in-progress',
};

export const STATUS_HELP: Record<Status, string> = {
  available: 'Working today, against live data.',
  progress: 'Partly built. Not yet complete end to end.',
  preview: 'The interface exists; it is not yet connected to live data.',
  planned: 'On the roadmap, not yet started.',
};

/* ------------------------------------------------------------------ */
/* Personas                                                            */
/* ------------------------------------------------------------------ */

export interface Persona {
  name: string;
  role: string;
  title: string;
  day: string;
  success: string;
  scope: string;
  portal: string;
}

export const PERSONAS: Persona[] = [
  {
    name: 'Chika',
    role: 'Staff Officer',
    title: '15–40 documents a day',
    day: 'Receives paperwork from a shared scanner, from email and on paper, and gets each item into the right cabinet with the right labels, moving toward whoever must act on it.',
    success: 'Filing takes under a minute, and she can answer “where is that invoice?” without leaving her desk.',
    scope: 'Own and department documents',
    portal: 'Staff Workspace',
  },
  {
    name: 'David',
    role: 'Supervisor',
    title: '6–12 direct reports',
    day: 'Most documents pass an approval stage assigned to him. He also owns his team’s throughput — if three invoices have been sitting for a week, that is his problem first.',
    success: 'He clears his queue by lunchtime and can move work off an overloaded desk in two clicks.',
    scope: 'Department',
    portal: 'Supervisor Console',
  },
  {
    name: 'Eniola',
    role: 'Management',
    title: 'Divisional or C-suite',
    day: 'Never files a document. Opens the system to answer “is Finance slower than HR this quarter, and by how much?” — then to export that into a board pack.',
    success: 'A defensible number in under a minute, exported without asking anyone.',
    scope: 'Organisation-wide, read only',
    portal: 'Management Portal',
  },
  {
    name: 'Femi',
    role: 'Internal Auditor',
    title: 'Independent of operations',
    day: 'Samples documents, verifies that stated controls were actually applied, and raises findings when they weren’t. Cannot change anything, by design — that independence is the point of the role.',
    success: 'A complete history for any document, and findings tracked to closure with named owners.',
    scope: 'Organisation-wide, read only',
    portal: 'Audit & Compliance',
  },
  {
    name: 'Bola',
    role: 'Client Administrator',
    title: 'The organisation’s system owner',
    day: 'Configures EDMS for the organisation: the department tree, the cabinets and their folders, who holds which role, the approval workflows, retention policy and branding.',
    success: 'Onboards a new team member in five minutes and changes an approval chain without a support ticket.',
    scope: 'Full control of their organisation',
    portal: 'Client Administration',
  },
  {
    name: 'Adaeze',
    role: 'Platform Administrator',
    title: 'SchullTech operations',
    day: 'Provisions customer organisations, manages commercial plans and watches platform health. Deliberately holds no document permissions at all.',
    success: 'A new organisation is live in minutes, and no vendor staff can read a customer’s documents.',
    scope: 'Platform operations only',
    portal: 'Platform Admin',
  },
];

/* ------------------------------------------------------------------ */
/* Setup flow                                                          */
/* ------------------------------------------------------------------ */

export interface Step {
  lane: number;
  row: number;
  tag: string;
  title: string;
  detail: string;
  status: Status;
  note?: string;
}

export const SETUP_LANES = [
  { name: 'SchullTech', sub: 'platform team' },
  { name: 'Bola', sub: 'client administrator' },
  { name: 'Everyone', sub: 'all six roles' },
];

export const SETUP_STEPS: Step[] = [
  {
    lane: 1,
    row: 2,
    tag: 'Step 1',
    title: 'Provision the organisation',
    detail: 'An isolated database, a commercial plan, and the first administrator account.',
    status: 'planned',
    note: 'Handled by the SchullTech team directly while self-service provisioning is built.',
  },
  {
    lane: 2,
    row: 3,
    tag: 'Step 2',
    title: 'Build the department tree',
    detail:
      'Departments determine who sees which documents and how every report is grouped, so this comes first.',
    status: 'available',
  },
  {
    lane: 2,
    row: 4,
    tag: 'Step 3',
    title: 'Create cabinets and folders',
    detail: 'The filing structure staff navigate, mirroring how the organisation thinks about its records.',
    status: 'available',
  },
  {
    lane: 2,
    row: 5,
    tag: 'Step 4',
    title: 'Define the capture fields',
    detail:
      'Per-cabinet fields — vendor name, invoice number, contract value — so every document is captured consistently and those fields become searchable.',
    status: 'progress',
    note: 'Fields can now be added and removed in the Cabinet Designer. Capturing the values at upload is still in progress.',
  },
  {
    lane: 2,
    row: 6,
    tag: 'Step 5',
    title: 'Set cabinet access',
    detail: 'Which teams may view, upload to, or manage each cabinet.',
    status: 'progress',
    note: 'Grants can now be set in the Cabinet Designer. Enforcing them on every read is still in progress.',
  },
  {
    lane: 2,
    row: 7,
    tag: 'Step 6',
    title: 'Add people',
    detail: 'Each person gets an account, a department and one or more roles.',
    status: 'progress',
    note: 'Email invitations, so a new joiner sets their own password, are in progress.',
  },
  {
    lane: 2,
    row: 8,
    tag: 'Step 7',
    title: 'Design the approval workflows',
    detail:
      'The stages a document passes through, who acts at each one, and how long they have before it escalates.',
    status: 'available',
  },
  {
    lane: 3,
    row: 9,
    tag: 'Step 8',
    title: 'First sign-in',
    detail: 'Each person lands in the portal for their role, with the navigation their job requires.',
    status: 'available',
  },
];

/* ------------------------------------------------------------------ */
/* Document journey                                                    */
/* ------------------------------------------------------------------ */

export const JOURNEY_LANES = [
  { name: 'Chika', sub: 'staff officer' },
  { name: 'EDMS', sub: 'automatic' },
  { name: 'David', sub: 'supervisor' },
  { name: 'Eniola', sub: 'management' },
  { name: 'Femi', sub: 'internal auditor' },
];

export const JOURNEY_STEPS: Step[] = [
  {
    lane: 1,
    row: 2,
    tag: 'Step 1',
    title: 'Upload and file',
    detail:
      'Drag the scan in, confirm where it belongs and how sensitive it is. EDMS fingerprints the file, checks the cabinet permits it, and issues an official reference such as DOC-20260829-142317.',
    status: 'available',
  },
  {
    lane: 2,
    row: 3,
    tag: 'Step 2',
    title: 'Read and index the document',
    detail:
      'Text is extracted from the scan so the document can be found later by any phrase inside it, not only by its title.',
    status: 'progress',
  },
  {
    lane: 1,
    row: 4,
    tag: 'Step 3',
    title: 'Send for approval',
    detail:
      'The document enters the workflow the administrator designed, with a deadline attached, instead of an email that might be missed.',
    status: 'available',
  },
  {
    lane: 2,
    row: 5,
    tag: 'Step 4',
    title: 'Assign the first task',
    detail:
      'EDMS works out the first stage, sets its deadline from the stage’s service level, and assigns the task to a named person or to any member of a role.',
    status: 'available',
  },
  {
    lane: 3,
    row: 6,
    tag: 'Step 5',
    title: 'The task reaches the queue',
    detail:
      'David sees it in a single prioritised list — most urgent and most overdue first — including work assigned to his role rather than to him personally, and anything delegated to him.',
    status: 'available',
  },
  {
    lane: 3,
    row: 7,
    tag: 'Step 6',
    title: 'Approve, reject or request changes',
    detail:
      'The decision and its reason stay with the document permanently. The next stage’s clock starts; the final stage closes the document.',
    status: 'available',
  },
  {
    lane: 2,
    row: 8,
    tag: 'Step 7',
    title: 'Watch the clock',
    detail:
      'EDMS checks every few minutes for work approaching its deadline, warns before it breaches, and escalates once it does.',
    status: 'progress',
    note: 'Detection works today. Alerting the right person is in progress.',
  },
  {
    lane: 4,
    row: 9,
    tag: 'Step 8',
    title: 'Reporting updates',
    detail:
      'Throughput, backlog and service-level compliance by department, so delay is visible before it becomes a complaint.',
    status: 'progress',
  },
  {
    lane: 5,
    row: 10,
    tag: 'Step 9',
    title: 'The activity trail',
    detail:
      'An append-only record of every action taken on the document, so an auditor can reconstruct what happened and prove the record was not altered.',
    status: 'planned',
  },
];

/* ------------------------------------------------------------------ */
/* How the roles connect                                               */
/* ------------------------------------------------------------------ */

export interface Handoff {
  id: string;
  from: string;
  to: string;
  title: string;
  status: Status;
  body: string;
}

export const HANDOFFS: Handoff[] = [
  {
    id: '1',
    from: 'SchullTech',
    to: 'Client Administrator',
    title: 'Setting up the organisation',
    status: 'planned',
    body: 'A new customer organisation is provisioned with its own isolated database and its first administrator account. The SchullTech team does this directly today; self-service provisioning is on the roadmap.',
  },
  {
    id: '2',
    from: 'Client Administrator',
    to: 'every role',
    title: 'Giving people access',
    status: 'progress',
    body: 'Each person receives an account, a department and one or more roles, which together decide exactly what they can see and do. Email invitations, so a new joiner sets their own password rather than receiving one, are in progress.',
  },
  {
    id: '3',
    from: 'Client Administrator',
    to: 'Staff & Supervisors',
    title: 'Structure and process',
    status: 'progress',
    body: 'Cabinets, folders and approval workflows are the frame everyone else works inside. Defining them is what turns EDMS from storage into a process. The capture-field and cabinet-access editors now live in the Cabinet Designer; capturing field values at upload, and enforcing access on every read, are the parts still being finished.',
  },
  {
    id: '4',
    from: 'Staff',
    to: 'Supervisor',
    title: 'Routing for approval',
    status: 'available',
    body: 'The most important handoff in the product: a filed document enters a workflow, and a task appears in a supervisor’s queue with a deadline attached. Stage rules, service levels and role-based assignment all apply automatically.',
  },
  {
    id: '5',
    from: 'Supervisor',
    to: 'Staff',
    title: 'Sending work back',
    status: 'progress',
    body: 'Work returns downward when a supervisor rejects it, requests changes, or reassigns it to someone else — each with a reason recorded against the document. Notifying the person receiving it, and handing over a queue during leave, are in progress.',
  },
  {
    id: '6',
    from: 'Staff & Supervisors',
    to: 'Management',
    title: 'Operations becomes reporting',
    status: 'progress',
    body: 'Everyday filing and approval activity becomes executive-level numbers: throughput, backlog and service-level compliance, compared across departments and over time.',
  },
  {
    id: '7',
    from: 'everyone',
    to: 'Internal Auditor',
    title: 'The activity trail',
    status: 'planned',
    body: 'Every action anyone takes should arrive in a tamper-evident record the auditor can sample, reconstruct and prove complete. This is the layer that lets EDMS serve as a system of record rather than a filing system, and it is the next major build.',
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
    verdict: 'Filing works today',
    stories: [
      {
        id: 'A1',
        title: 'Upload a document into a cabinet',
        statement:
          'As Chika, I want to drag a scanned document onto the upload screen, confirm where it belongs and how sensitive it is, and file it, so that it stops being a loose file on my desktop and becomes a tracked record with an official reference number.',
        status: 'available',
        note: 'Files up to 2 MB, in PDF and common image formats.',
      },
      {
        id: 'A2',
        title: 'Have the system read the document for me',
        statement:
          'As Chika, I want the system to extract the vendor name, invoice number and amount from a scanned invoice and pre-fill the fields, so that I am confirming a machine’s reading rather than typing from a page.',
        status: 'planned',
      },
      {
        id: 'A3',
        title: 'Organise cabinets into folders',
        statement:
          'As Bola, I want to create a folder hierarchy inside each cabinet, so that the filing structure mirrors how my organisation actually thinks about its records, and staff don’t have to guess.',
        status: 'available',
      },
      {
        id: 'A4',
        title: 'Define capture fields per cabinet',
        statement:
          'As Bola, I want to define that the Invoices cabinet requires “Vendor Name”, “Invoice Number” and “Contract Value”, so that every invoice is captured consistently and those fields become searchable.',
        status: 'progress',
        note: 'The Cabinet Designer can now add and remove a cabinet’s fields. Capturing the values on the upload screen is still in progress.',
      },
    ],
  },
  {
    letter: 'B',
    name: 'Retrieval & search',
    verdict: 'Browsing works; full-text search is landing',
    stories: [
      {
        id: 'B1',
        title: 'Find a document by its content',
        statement:
          'As Chika, I want to type “Meridian Interiors” and find the invoice even though that phrase is only inside the scanned page, so that I can answer a customer’s question while they are still on the phone.',
        status: 'progress',
        note: 'Depends on document text extraction, which is in progress.',
      },
      {
        id: 'B2',
        title: 'Browse the filing structure',
        statement:
          'As Chika, I want to navigate cabinets and folders the way I would walk to a filing cabinet, so that I can find things by structure when I can’t remember the words.',
        status: 'available',
      },
      {
        id: 'B3',
        title: 'Open a document and see everything about it',
        statement:
          'As any signed-in user, I want one screen showing the document, its details, its version history, its position in the workflow and its activity, so that I don’t have to assemble the picture from four places.',
        status: 'progress',
      },
      {
        id: 'B4',
        title: 'Download, print or export a document',
        statement:
          'As David, I want to download a contract to read offline, subject to my clearance, so that I can review it on a flight — and so the system records that I took a copy.',
        status: 'planned',
      },
    ],
  },
  {
    letter: 'C',
    name: 'Routing, review & approval',
    verdict: 'The core loop works end to end',
    stories: [
      {
        id: 'C1',
        title: 'Route a document into an approval workflow',
        statement:
          'As Chika, I want to send a filed invoice into the “Standard Invoice Approval” workflow, so that it reaches my supervisor with a deadline attached instead of an email that might be missed.',
        status: 'available',
      },
      {
        id: 'C2',
        title: 'Work my task queue',
        statement:
          'As David, I want a single prioritised list of everything waiting on me, with the most urgent and most overdue at the top, so that I work the right thing first instead of whatever is most recent.',
        status: 'available',
      },
      {
        id: 'C3',
        title: 'Approve, reject or request changes',
        statement:
          'As David, I want to approve a document with a note, or send it back with a reason, so that the decision and its justification live with the document permanently.',
        status: 'available',
      },
      {
        id: 'C4',
        title: 'Delegate my work while I’m away',
        statement:
          'As David, I want to hand my approvals to a colleague for the two weeks I’m on leave, so that nothing stalls behind an empty desk.',
        status: 'progress',
        note: 'Delegated tasks already route correctly; the screen to set one up is in progress.',
      },
      {
        id: 'C5',
        title: 'Design an approval workflow',
        statement:
          'As Bola, I want to define the stages an invoice passes through, who acts at each stage and how long they have, so that the process is enforced by the system rather than remembered by people.',
        status: 'available',
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
        status: 'available',
      },
      {
        id: 'D2',
        title: 'Keep every version',
        statement:
          'As Femi, I want every revision retained with its uploader, timestamp and fingerprint, so that I can prove what a document said on a given date.',
        status: 'available',
      },
      {
        id: 'D3',
        title: 'Roll back to a previous version',
        statement:
          'As David, I want to restore the version from before a bad edit, so that a mistake is a two-click recovery rather than a re-scan.',
        status: 'progress',
      },
    ],
  },
  {
    letter: 'E',
    name: 'Access control & confidentiality',
    verdict: 'Role and department access work today',
    stories: [
      {
        id: 'E1',
        title: 'Classify a document by sensitivity',
        statement:
          'As Chika, I want to mark a document Confidential when it contains customer financial data, so that it is invisible to people who have no business reading it.',
        status: 'progress',
        note: 'Applied when viewing today. Extending it to download and print follows those features.',
      },
      {
        id: 'E2',
        title: 'Grant cabinet-level access',
        statement:
          'As Bola, I want to give the Legal team view access to the Contracts cabinet and upload access to nobody else, so that need-to-know is enforced by structure, not by trust.',
        status: 'progress',
        note: 'Grants can now be viewed, added and revoked from the Cabinet Designer. Enforcing them on every read path is still in progress.',
      },
      {
        id: 'E3',
        title: 'Assign people to roles',
        statement:
          'As Bola, I want to give a new joiner the Staff role and place them in Operations, so that they get exactly the access their job requires on day one.',
        status: 'available',
      },
      {
        id: 'E4',
        title: 'Review what each role can do',
        statement:
          'As Bola, I want to see exactly what each role can do, so that I can check the system matches my organisation’s separation-of-duties policy.',
        status: 'progress',
        note: 'The six roles ship as standard and are consistent across every organisation.',
      },
    ],
  },
  {
    letter: 'F',
    name: 'Oversight & service levels',
    verdict: 'Workload, reassignment and the workflow monitor work; deadline alerting is in progress',
    stories: [
      {
        id: 'F1',
        title: 'See my team’s workload',
        statement:
          'As David, I want to see how many open items each team member is carrying, so that I can rebalance before someone drowns.',
        status: 'progress',
      },
      {
        id: 'F2',
        title: 'Catch ageing work before it breaches',
        statement:
          'As David, I want to see what is approaching its deadline, so that I intervene while it still matters.',
        status: 'progress',
        note: 'EDMS detects approaching and breached deadlines today. Notifying the right person is in progress.',
      },
      {
        id: 'F3',
        title: 'Reassign work',
        statement:
          'As David, I want to move a task from one person to another with a reason, so that absence or overload doesn’t stall a document.',
        status: 'available',
      },
      {
        id: 'F4',
        title: 'Monitor running workflows',
        statement:
          'As David or Bola, I want one screen listing every workflow that is running, with its current stage, and the ability to pause or close one, so that a stalled document is something I can see and act on rather than discover when someone chases it.',
        status: 'available',
      },
    ],
  },
  {
    letter: 'G',
    name: 'Executive reporting',
    verdict: 'Real numbers today',
    stories: [
      {
        id: 'G1',
        title: 'Compare departments',
        statement:
          'As Eniola, I want to see throughput, backlog and service-level compliance side by side across departments, so that I can direct attention where it is needed.',
        status: 'progress',
      },
      {
        id: 'G2',
        title: 'See trends over time',
        statement:
          'As Eniola, I want to see whether turnaround is improving quarter on quarter, so that I can tell whether a process change worked.',
        status: 'progress',
      },
      {
        id: 'G3',
        title: 'Export a board pack',
        statement:
          'As Eniola, I want to export what I’m looking at as a spreadsheet, so that I can drop it into a board deck without asking anyone.',
        status: 'progress',
      },
    ],
  },
  {
    letter: 'H',
    name: 'Audit & compliance',
    verdict: 'The next major build',
    stories: [
      {
        id: 'H1',
        title: 'See a complete, tamper-evident activity trail',
        statement:
          'As Femi, I want an append-only record of every view, edit, approval, download and permission change, so that I can reconstruct what happened and prove the record wasn’t altered.',
        status: 'preview',
      },
      {
        id: 'H2',
        title: 'Track findings to closure',
        statement:
          'As Femi, I want to raise a finding against a document or process, assign an owner and a due date, and track it, so that issues are resolved rather than noted.',
        status: 'preview',
      },
      {
        id: 'H3',
        title: 'Verify separation of duties',
        statement:
          'As Femi, I want the system to prevent one person both approving and auditing the same document, so that the control is structural rather than a policy people remember.',
        status: 'planned',
      },
    ],
  },
  {
    letter: 'I',
    name: 'Organisation administration',
    verdict: 'Structure works; policy tools are next',
    stories: [
      {
        id: 'I1',
        title: 'Set up the organisation structure',
        statement:
          'As Bola, I want to define our department hierarchy, so that document access and reporting reflect how we’re actually organised.',
        status: 'available',
      },
      {
        id: 'I2',
        title: 'Onboard a new employee',
        statement:
          'As Bola, I want to invite a new joiner by email and have them set their own password, so that I never handle their credentials.',
        status: 'progress',
        note: 'Creating the account works today; email invitations are in progress.',
      },
      {
        id: 'I3',
        title: 'Configure retention policy',
        statement:
          'As Bola, I want to set how long each cabinet’s documents are kept and what happens at expiry, so that we comply with our regulator’s retention schedule automatically.',
        status: 'preview',
      },
      {
        id: 'I4',
        title: 'Brand the system',
        statement:
          'As Bola, I want the portal to carry our logo and colours, so that staff experience it as our system, not a vendor’s.',
        status: 'preview',
      },
    ],
  },
  {
    letter: 'J',
    name: 'Communication',
    verdict: 'Delivery is wired; sending is next',
    stories: [
      {
        id: 'J1',
        title: 'Broadcast a circular',
        statement:
          'As Bola, I want to send a policy update to all staff and require acknowledgement, so that I have proof everyone was told.',
        status: 'preview',
      },
      {
        id: 'J2',
        title: 'Acknowledge a circular',
        statement:
          'As Chika, I want to mark a circular as read, so that my compliance obligation is discharged and recorded.',
        status: 'preview',
      },
      {
        id: 'J3',
        title: 'Be notified when something needs me',
        statement:
          'As any user, I want an in-app notification when a task is assigned to me, a deadline is approaching, or a circular needs acknowledging, so that I don’t have to keep checking whether I’m blocking someone.',
        status: 'progress',
        note: 'The notification centre and delivery preferences are live. Connecting them to each event is in progress.',
      },
    ],
  },
  {
    letter: 'K',
    name: 'Platform operations',
    verdict: 'Roadmap — SchullTech-facing only',
    stories: [
      {
        id: 'K1',
        title: 'Provision an organisation',
        statement:
          'As Adaeze, I want to create a new customer organisation with its own isolated database, so that onboarding takes minutes rather than a manual setup.',
        status: 'preview',
      },
      {
        id: 'K2',
        title: 'Manage plans and entitlements',
        statement:
          'As Adaeze, I want to define commercial plans with feature and usage limits, so that entitlements are enforced by the system.',
        status: 'preview',
      },
      {
        id: 'K3',
        title: 'Meter usage and bill',
        statement:
          'As Adaeze, I want accurate storage and seat metering per organisation, so that invoices are defensible.',
        status: 'preview',
      },
      {
        id: 'K4',
        title: 'Roll features out gradually',
        statement:
          'As Adaeze, I want to enable a feature for one organisation before all, so that a change can be switched off without a rollback.',
        status: 'preview',
      },
      {
        id: 'K5',
        title: 'Watch platform health',
        statement:
          'As Adaeze, I want processing queues, worker status and error rates, so that I know about a problem before a customer reports it.',
        status: 'preview',
      },
    ],
  },
];

export const ALL_STORIES: Story[] = EPICS.flatMap((e) => e.stories);

export const STATUS_COUNTS = (
  ['available', 'progress', 'preview', 'planned'] as Status[]
).reduce(
  (acc, s) => {
    acc[s] = ALL_STORIES.filter((st) => st.status === s).length;
    return acc;
  },
  {} as Record<Status, number>,
);
