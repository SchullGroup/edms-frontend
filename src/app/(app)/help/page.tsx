'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import type { PortalKey } from '@/lib/permissions';
import type { HelpTopicId } from '@/constants/helpTopics';

interface Topic {
  id: HelpTopicId;
  title: string;
  /** Extra words people might search for. */
  keywords: string;
  /** Shown only to these portals; everyone else sees it under "More topics". */
  for?: PortalKey[];
  body: React.ReactNode;
}

const ADMIN_PORTALS: PortalKey[] = ['admin'];

/** What each portal is for, shown first on the page. */
const GETTING_STARTED: Record<PortalKey, React.ReactNode> = {
  staff: (
    <>
      <p>
        Your dashboard shows the workflow tasks waiting for you and the documents you’re working on.
        Click a task to open its workflow page, where you read the documents and act on them. Use{' '}
        <b>Upload document</b> to file new documents, and <b>Search</b> or <b>Cabinets</b> to find
        existing ones.
      </p>
    </>
  ),
  supervisor: (
    <>
      <p>
        The Supervisor Console shows your team’s open work: who holds what, what’s overdue, and
        where documents are piling up. Click a team member to see their queue, and reassign a task
        when someone is away or overloaded. Your own tasks work the same way as for staff.
      </p>
    </>
  ),
  management: (
    <>
      <p>
        The Management Portal shows the organisation at a glance: documents coming in and closing,
        SLA compliance and open work by department. Click a department’s bar to focus the dashboard
        on it. <b>Reports & Export</b> builds status, ageing, SLA and workload reports you can
        download as CSV.
      </p>
    </>
  ),
  auditor: (
    <>
      <p>
        The audit trail records every action in the system: who did what, to which record, and when.
        Filter it by record type, action and person, check that the trail hasn’t been tampered with,
        and export it as CSV if your role allows.
      </p>
    </>
  ),
  admin: (
    <>
      <p>
        Client Administration is where your organisation’s EDMS is set up. The setup checklist on
        your home page lists what’s left, in order. See{' '}
        <a href="#admin-setup">Setting up your organisation</a> below.
      </p>
    </>
  ),
  platform: (
    <>
      <p>
        The platform console is for SchullTech staff. It can’t open your customers’ documents by
        design.
      </p>
    </>
  ),
};

const TOPICS: Topic[] = [
  {
    id: 'find',
    title: 'Find a document',
    keywords: 'search filter saved cabinet folder browse',
    body: (
      <>
        <p>
          <b>Search</b> looks through document titles, their metadata and the text inside them,
          including text read from scanned pages. A newly uploaded document can take a few minutes
          before its text is searchable. Press <span className="kbd">/</span> anywhere to jump to
          the search box.
        </p>
        <p>
          Without search words, you can filter by cabinet, type, status, confidentiality and
          urgency. With search words, only the cabinet filter applies. <b>Save</b> a search to rerun
          it later from your dashboard’s Quick access.
        </p>
        <p>
          To browse instead, open <b>Cabinets</b>: pick a cabinet, then a folder (folders can hold
          sub-folders) to list its documents.
        </p>
      </>
    ),
  },
  {
    id: 'upload',
    title: 'Upload and file documents',
    keywords: 'add new file batch pdf word excel size type metadata',
    body: (
      <>
        <p>
          Choose <b>Upload document</b>, then the cabinet and folder to file into (both are
          required), the document type, its confidentiality and urgency, and any fields the cabinet
          asks for. You can add several files at once and file them all together.
        </p>
        <p>
          Accepted files: PDF, Word (.docx), Excel (.xlsx), TIFF, JPG and PNG, up to 100 MB each.
          PDFs and JPG/PNG images open in the viewer; other types can be downloaded.
        </p>
      </>
    ),
  },
  {
    id: 'read',
    title: 'Read a document',
    keywords: 'viewer find search inside print download export pin zoom page scanned ocr versions',
    body: (
      <>
        <ul>
          <li>
            <b>Find in document</b>: type in the box above the pages. Matches are highlighted; press
            Enter for the next and Shift+Enter for the previous. Ctrl+F inside the viewer jumps to
            the box.
          </li>
          <li>
            <b>Scanned documents</b> are pictures of pages, so find searches the text read from them
            instead, and shows it under <b>Scanned text</b> with the matches highlighted. Use{' '}
            <b>Show pages</b> to go back to the page images.
          </li>
          <li>
            <b>Page box and zoom</b>: type a page number to jump to it; use − and + to zoom.
          </li>
          <li>
            <b>Print, Download and Export</b> appear only if your role allows them for this
            document. Each is recorded in the audit trail.
          </li>
          <li>
            <b>Versions</b> lists earlier versions of the file. Opening one counts as a download, so
            it needs download permission.
          </li>
          <li>
            <b>Pin</b> keeps the document in your dashboard’s Quick access.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality, watermarks and access',
    keywords: 'confidential restricted top secret classification watermark request access denied',
    body: (
      <>
        <p>
          Every document has a confidentiality level: Public, Internal, Confidential, Restricted or
          Top Secret. Whether you can open the higher levels depends on your role, and may be
          limited to your own department’s documents. Your administrator sets this in Roles &
          permissions.
        </p>
        <p>
          Confidential and higher documents carry a watermark with the level and your name, on
          screen and on anything you print. Downloaded copies are the original file.
        </p>
        <p>
          If you can’t open a document, choose <b>Request access</b>. Your request goes for
          approval, and you’re notified when it’s granted or declined.
        </p>
        <p>
          To change a document’s level or urgency, open its Details and choose <b>Change</b> next to
          Classification. Levels you couldn’t open the document at are greyed out, so you can’t lock
          yourself out.
        </p>
      </>
    ),
  },
  {
    id: 'workflows',
    title: 'Workflows: route, act and track',
    keywords:
      'route approve review reject request changes delegate close signature trail deadline sla task',
    body: (
      <>
        <p>
          <b>Route to workflow</b> sends documents through an approval process. Start it from a
          document’s page, or select several documents in Search or Cabinets to send them through
          one workflow together.
        </p>
        <p>
          The <b>workflow page</b> shows the documents (one tab each), where each stage stands and
          the activity trail. When a task is yours, act on it there:
        </p>
        <ul>
          <li>
            <b>Approve</b>: sign (draw, type your name or upload an image) and add an optional
            comment. Moves the documents to the next stage.
          </li>
          <li>
            <b>Review</b>: attach at least one document, then mark it reviewed.
          </li>
          <li>
            <b>Request changes</b>: send chosen documents back to the previous stage with a reason.
            The previous stage then uploads a new version on the workflow page.
          </li>
          <li>
            <b>Reject</b> or <b>Close</b> ends the workflow; <b>Delegate</b> hands the stage to
            someone else without moving it on.
          </li>
        </ul>
        <p>
          Each stage has a deadline set by the stage and the document’s urgency. Warnings and missed
          deadlines appear in the activity trail.
        </p>
      </>
    ),
  },
  {
    id: 'checkout',
    title: 'Check out and check in',
    keywords: 'lock edit checkout checkin read-only overdue',
    body: (
      <p>
        <b>Check out</b> a document before editing it: everyone else gets read-only access until you{' '}
        <b>Check in</b>. You can say when you expect to return it. If a checkout is overdue, an
        administrator with the right permission can release it.
      </p>
    ),
  },
  {
    id: 'delegations',
    title: 'Delegate while you’re away',
    keywords: 'out of office leave holiday delegation cover',
    body: (
      <p>
        In <b>Delegations</b>, choose a colleague and the dates you’re away. Workflow tasks that
        would come to you in that period go to them instead, for all your work or only certain
        cabinets or workflows. You can end a delegation early.
      </p>
    ),
  },
  {
    id: 'circulars',
    title: 'Circulars',
    keywords: 'announcement notice memo acknowledge publish',
    body: (
      <p>
        Circulars are announcements to staff. Open <b>Circulars</b> to read yours and acknowledge
        them. If your role allows, <b>Manage circulars</b> lets you write one, choose who receives
        it, publish it now or schedule it, and see who has acknowledged it.
      </p>
    ),
  },
  {
    id: 'quick-access',
    title: 'Quick access on your dashboard',
    keywords: 'pin pinned recent saved searches shortcuts favourites',
    body: (
      <p>
        Quick access lists the documents you’ve pinned, the ones you opened recently and your saved
        searches. These are kept in this browser, so they don’t follow you to another computer.
      </p>
    ),
  },
  {
    id: 'admin-setup',
    title: 'Setting up your organisation',
    keywords: 'setup checklist departments cabinets folders users invite onboarding',
    for: ADMIN_PORTALS,
    body: (
      <>
        <p>Work through it in this order; the setup checklist on your home page tracks it.</p>
        <ol>
          <li>
            <b>Departments</b>, the structure everything else hangs off.
          </li>
          <li>
            <b>Cabinets</b>, usually one per department, each with its folders and the metadata
            fields its documents need.
          </li>
          <li>
            <b>Users</b>: invite people, put them in a department and give them roles.
          </li>
          <li>
            <b>Roles & permissions</b>, if the built-in roles don’t fit.
          </li>
          <li>
            <b>Cabinet access</b>, to give roles or people a level on each cabinet.
          </li>
          <li>
            <b>Workflows</b>: design and publish the approval processes.
          </li>
          <li>
            <b>Urgency & SLA</b> under Policies: working hours, holidays and deadlines.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'Roles and permissions',
    keywords: 'role permission scope own department global custom clearance portal',
    for: ADMIN_PORTALS,
    body: (
      <>
        <p>
          Each permission has a scope: <b>Own</b> (only things the person created),{' '}
          <b>Department</b> (their department’s) or <b>Global</b> (everything). Changes reach people
          the next time they sign in or their session refreshes.
        </p>
        <p>
          <b>View confidential / restricted / top secret</b> decide who can open documents at those
          levels. <b>Download</b>, <b>Export</b> and <b>Print</b> are separate permissions.
        </p>
        <p>
          Someone with only custom roles lands on the home page that fits what they can do: changing
          setup → Client Administration; reassigning tasks → Supervisor Console; acting on tasks or
          filing → Staff Workspace; reading the audit trail → Audit; department oversight →
          Management.
        </p>
      </>
    ),
  },
  {
    id: 'cabinet-access',
    title: 'Cabinet access levels',
    keywords: 'cabinet access grant level view upload edit route export delete',
    for: ADMIN_PORTALS,
    body: (
      <p>
        Give a role or a person a level on a cabinet. Levels build on each other, from lowest to
        highest: <b>View</b>, <b>Upload</b>, <b>Edit</b>, <b>Route</b>, <b>Export</b>, <b>Delete</b>
        ; each includes the ones before it. You can’t give a level higher than your own. Client
        administrators can see every cabinet.
      </p>
    ),
  },
  {
    id: 'workflow-designer',
    title: 'Designing workflows',
    keywords: 'workflow designer stage assignee action condition publish draft',
    for: ADMIN_PORTALS,
    body: (
      <>
        <p>
          A workflow is a series of stages. For each stage choose who acts (a person or a role),
          which actions they can take, and how long they have. Conditions can send a document down
          different paths by its urgency, confidentiality or a metadata field.
        </p>
        <p>
          Request changes isn’t available on the first stage, since there’s nothing to send it back
          to. A workflow can be used once it’s <b>published</b>.
        </p>
      </>
    ),
  },
  {
    id: 'sla',
    title: 'Urgency and SLA settings',
    keywords: 'sla deadline working hours business days holiday urgency multiplier warning breach',
    for: ADMIN_PORTALS,
    body: (
      <p>
        Under <b>Policies → Urgency & SLA</b>, set working hours and days, holidays, how early to
        warn before a deadline, and what happens when one is missed. Urgency multipliers shorten or
        lengthen each stage’s time: 0.5 for Critical halves it. Changes apply to stages that start
        afterwards, not to deadlines already set.
      </p>
    ),
  },
  {
    id: 'audit',
    title: 'The audit trail',
    keywords: 'audit log history configuration verify integrity export csv',
    for: ['admin', 'auditor'],
    body: (
      <p>
        Every action is recorded. Filter by record type (pick a configuration type, such as roles or
        workflow designs, to see the history of your setup), action and person; the admin audit log
        also filters by date. <b>Verify</b> checks the trail hasn’t been altered. <b>Export</b>{' '}
        downloads what you’ve filtered as CSV.
      </p>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    keywords: 'keyboard shortcut keys',
    body: (
      <ul>
        <li>
          <span className="kbd">/</span> jump to search
        </li>
        <li>
          <span className="kbd">Ctrl</span> + <span className="kbd">F</span> inside the document
          viewer: find in the document
        </li>
        <li>
          <span className="kbd">Enter</span> / <span className="kbd">Shift</span> +{' '}
          <span className="kbd">Enter</span>: next / previous match
        </li>
        <li>
          <span className="kbd">Ctrl</span> + <span className="kbd">P</span> inside the document
          viewer: print it, if you’re allowed
        </li>
      </ul>
    ),
  },
];

export default function HelpPage() {
  const { setPageTitle } = useUIStore();
  const { portal } = usePermissions();
  const [query, setQuery] = useState('');

  useEffect(() => {
    setPageTitle('Help');
  }, [setPageTitle]);

  // Opened at a topic (`/help#sla`): scroll to it once the page has rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => TOPICS.filter((t) => !q || t.title.toLowerCase().includes(q) || t.keywords.includes(q)),
    [q],
  );
  // The reader's topics. Topics for other roles (setup, audit) show only when
  // searched for, under their own heading.
  const mine = visible.filter((t) => !t.for || t.for.includes(portal));
  const others = q ? visible.filter((t) => t.for && !t.for.includes(portal)) : [];

  const card = (t: Topic) => (
    <section key={t.id} id={t.id} className="card help-topic" aria-labelledby={`${t.id}-h`}>
      <div className="card-head">
        <h2 id={`${t.id}-h`} className="h3">
          {t.title}
        </h2>
      </div>
      <div className="card-body help-body">{t.body}</div>
    </section>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Help</h1>
          <div className="page-sub">How to get things done in SchullTech EDMS.</div>
        </div>
        <input
          type="search"
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Search help"
          aria-label="Search help"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!q && (
        <section id="getting-started" className="card help-topic mb-4" aria-labelledby="gs-h">
          <div className="card-head">
            <h2 id="gs-h" className="h3">
              Getting started
            </h2>
          </div>
          <div className="card-body help-body">{GETTING_STARTED[portal]}</div>
        </section>
      )}

      {!q && (
        <nav className="help-toc mb-4" aria-label="Help topics">
          {mine.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="chip">
              {t.title}
            </a>
          ))}
        </nav>
      )}

      <div className="grid gap-4">
        {mine.map(card)}
        {others.length > 0 && (
          <>
            <div className="caption" style={{ fontWeight: 700, marginTop: 8 }}>
              For other roles
            </div>
            {others.map(card)}
          </>
        )}
        {visible.length === 0 && <div className="caption">No help topics match “{query}”.</div>}
      </div>

      <div className="caption mt-4">
        Still stuck? Ask your organisation’s EDMS administrator, who manages accounts and access.
        The <Link href="/user-stories">Product Guide</Link> describes what the system does for each
        role.
      </div>
    </div>
  );
}
