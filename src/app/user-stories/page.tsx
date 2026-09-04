'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import s from './userStories.module.css';
import {
  ALL_STORIES,
  EPICS,
  HANDOFFS,
  JOURNEY_LANES,
  JOURNEY_STEPS,
  PERSONAS,
  SETUP_LANES,
  SETUP_STEPS,
  STATUS_CLASS,
  STATUS_COUNTS,
  STATUS_HELP,
  STATUS_LABEL,
  type Status,
  type Step,
} from './data';

type View = 'flow' | 'diagram' | 'stories';

const VIEWS: { key: View; label: string }[] = [
  { key: 'flow', label: 'User flow' },
  { key: 'diagram', label: 'Flow diagram' },
  { key: 'stories', label: 'User stories' },
];

const STATUS_ORDER: Status[] = ['available', 'progress', 'preview', 'planned'];

/** Design-system status colours, so a swimlane accent matches its badge. */
const STEP_COLOR: Record<Status, string> = {
  available: 'var(--status-closed)',
  progress: 'var(--status-pending)',
  preview: 'var(--status-onhold)',
  planned: 'var(--status-progress)',
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge ${STATUS_CLASS[status]}`} title={STATUS_HELP[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Swimlane({
  lanes,
  steps,
  minWidth,
}: {
  lanes: { name: string; sub: string }[];
  steps: Step[];
  minWidth: number;
}) {
  const rowCount = steps.reduce((max, st) => Math.max(max, st.row), 1);

  return (
    <div className={s.swimWrap}>
      <div
        className={s.swim}
        style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(${minWidth}px, 1fr))` }}
      >
        {lanes.map((lane, i) => (
          <div key={lane.name} className={s.laneHead} style={{ gridColumn: i + 1, gridRow: 1 }}>
            <span className={s.laneName}>{lane.name}</span>
            <span className={s.laneSub}>{lane.sub}</span>
          </div>
        ))}

        {/* Lane backgrounds span every content row so the columns read as lanes. */}
        {lanes.map((lane, i) => (
          <div
            key={`bg-${lane.name}`}
            className={`${s.laneBg} ${i % 2 === 1 ? s.laneBgAlt : ''}`}
            style={{ gridColumn: i + 1, gridRow: `2 / ${rowCount + 1}` }}
            aria-hidden="true"
          />
        ))}

        {steps.map((step) => (
          <div
            key={`${step.tag}-${step.title}`}
            className={s.step}
            style={
              {
                gridColumn: step.lane,
                gridRow: step.row,
                '--stepColor': STEP_COLOR[step.status],
              } as React.CSSProperties
            }
          >
            <span className={s.stepTag}>{step.tag}</span>
            <span className={s.stepTitle}>{step.title}</span>
            <p className={s.stepDetail}>{step.detail}</p>
            <span className={s.stepBadge}>
              <StatusBadge status={step.status} />
            </span>
            {step.note && <p className={s.stepNote}>{step.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductGuidePage() {
  const [view, setView] = useState<View>('flow');
  const [filter, setFilter] = useState<Status | 'all'>('all');

  const visibleEpics = useMemo(
    () =>
      EPICS.map((epic) => ({
        ...epic,
        stories: filter === 'all' ? epic.stories : epic.stories.filter((st) => st.status === filter),
      })).filter((epic) => epic.stories.length > 0),
    [filter],
  );

  return (
    <div className={s.publicShell}>
      {/* This page is served without a sign-in, so it carries its own chrome
          rather than the application shell. */}
      <header className={s.masthead}>
        <div className={s.mastheadInner}>
          <span className={s.brand}>
            SchullTech <strong>EDMS</strong>
          </span>
          <Link href="/" className={`btn btn-sm btn-secondary ${s.signIn}`}>
            Sign in
          </Link>
        </div>
      </header>

      <main className={s.publicMain}>
        <div className="page-head">
          <div>
            <div className="page-title">Product Guide</div>
            <div className="page-sub">
              How a document moves through EDMS, who touches it at each step, and what is available
              today.
            </div>
          </div>
          <div className="actions">
            <div className="seg">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  className={view === v.key ? 'active' : ''}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- summary ---------------- */}
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
        >
          <div className="card kpi">
            <div className="kl">Roles</div>
            <div className="kv tnum">{PERSONAS.length}</div>
          </div>
          <div className="card kpi">
            <div className="kl">Setup steps</div>
            <div className="kv tnum">{SETUP_STEPS.length}</div>
          </div>
          <div className="card kpi">
            <div className="kl">Handoffs</div>
            <div className="kv tnum">{HANDOFFS.length}</div>
          </div>
          <div className="card kpi">
            <div className="kl">Epics</div>
            <div className="kv tnum">{EPICS.length}</div>
          </div>
          <div className="card kpi">
            <div className="kl">Stories</div>
            <div className="kv tnum">{ALL_STORIES.length}</div>
          </div>
          <div className="card kpi">
            <div className="kl">Available now</div>
            <div className="kv tnum">{STATUS_COUNTS.available}</div>
          </div>
        </div>

        <div className={s.legend} style={{ marginTop: 18 }}>
          {STATUS_ORDER.map((st) => (
            <span key={st} className={s.legendItem}>
              <StatusBadge status={st} />
              {STATUS_HELP[st]}
            </span>
          ))}
        </div>

        {/* ---------------- FLOW ---------------- */}
        {view === 'flow' && (
          <div>
            <p className={s.sectionLede}>
              EDMS replaces a filing regime where documents live in shared drives and email threads,
              where “who approved this, and when?” is answered by searching someone’s inbox, and
              where a file sitting on a desk for three weeks is invisible until a customer
              complains. Setup runs in order — each step produces what the next one needs.
            </p>

            <div className={s.blockTitle}>The six people</div>
            <div className={s.personaGrid}>
              {PERSONAS.map((p) => (
                <article key={p.role} className={`card ${s.persona}`}>
                  <div className={s.personaTop}>
                    <span className={s.personaName}>{p.name}</span>
                    <span className="tag">{p.role}</span>
                  </div>
                  <span className={s.personaTitle}>{p.title}</span>
                  <p className={s.personaDay}>{p.day}</p>
                  <p className={s.personaFear}>Success looks like: {p.success}</p>
                  <dl className={s.personaMeta}>
                    <dt>Sees</dt>
                    <dd>{p.scope}</dd>
                    <dt>Portal</dt>
                    <dd>{p.portal}</dd>
                  </dl>
                </article>
              ))}
            </div>

            <div className={s.blockTitle}>Setting up, step by step</div>
            <div className="card card-pad">
              <div className={s.ladder}>
                {SETUP_STEPS.map((step) => (
                  <div key={step.tag} className={s.rung}>
                    <span className={s.rungPhase}>{step.tag}</span>
                    <span className={s.rungTitle}>{step.title}</span>
                    <StatusBadge status={step.status} />
                    <p className={s.rungDetail}>{step.detail}</p>
                    {step.note && <p className={s.rungNote}>{step.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className={s.blockTitle}>How the roles connect</div>
            <p className={s.sectionLede}>
              Each of these is a point where work crosses from one person to another. They are the
              seams that decide whether a document management system is a filing cabinet or a
              process.
            </p>
            <div className="card card-pad">
              {HANDOFFS.map((h) => (
                <div key={h.id} className={s.handoff}>
                  <span className={s.handoffId}>{h.id}</span>
                  <div>
                    <div className={s.handoffArc}>
                      {h.from} → {h.to}
                    </div>
                    <div className={s.handoffHead}>
                      <span className={s.handoffTitle}>{h.title}</span>
                      <StatusBadge status={h.status} />
                    </div>
                    <p className={s.handoffBody}>{h.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- DIAGRAM ---------------- */}
        {view === 'diagram' && (
          <div>
            <div className={s.blockTitle}>Setting up an organisation</div>
            <p className={s.sectionLede}>
              Who does what, in order, before a Staff Officer can file their first document. Scroll
              sideways to see every lane.
            </p>
            <Swimlane lanes={SETUP_LANES} steps={SETUP_STEPS} minWidth={230} />
            <p className={s.swimCaption}>
              The order matters. Departments decide who sees what, so they come before cabinets;
              cabinets are where documents live, so they come before people can file anything.
            </p>

            <div className={s.blockTitle}>The life of one document</div>
            <p className={s.sectionLede}>
              A single invoice, from Chika’s desk to a closed record — and everyone it passes on the
              way.
            </p>
            <Swimlane lanes={JOURNEY_LANES} steps={JOURNEY_STEPS} minWidth={178} />
            <p className={s.swimCaption}>
              Read the lanes rather than the steps. Most of a document’s journey is automatic: the
              only two people who touch this invoice are the officer who files it and the supervisor
              who approves it. Everything else — deadlines, escalation, reporting, the activity
              record — happens without anyone being asked.
            </p>
          </div>
        )}

        {/* ---------------- STORIES ---------------- */}
        {view === 'stories' && (
          <div>
            <p className={s.sectionLede}>
              Every story is written from the person’s side of the screen, and carries where it
              stands today. Filter by status to see one layer of the product at a time.
            </p>

            <div className={s.filters}>
              <span className={s.filterLabel}>Filter</span>
              <button
                className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('all')}
              >
                All <span className="tnum">&nbsp;{ALL_STORIES.length}</span>
              </button>
              {STATUS_ORDER.filter((st) => STATUS_COUNTS[st] > 0).map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${filter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(st)}
                >
                  {STATUS_LABEL[st]} <span className="tnum">&nbsp;{STATUS_COUNTS[st]}</span>
                </button>
              ))}
            </div>

            <div className="card card-pad">
              {visibleEpics.map((epic) => (
                <div key={epic.letter}>
                  <div className={s.epicHead}>
                    <span className={s.epicLetter}>Epic {epic.letter}</span>
                    <span className={s.epicName}>{epic.name}</span>
                    <span className={s.epicVerdict}>{epic.verdict}</span>
                  </div>
                  {epic.stories.map((story) => (
                    <div key={story.id} className={s.story}>
                      <span className={s.storyId}>{story.id}</span>
                      <div>
                        <div className={s.storyTitle}>{story.title}</div>
                        <p className={s.storyStatement}>{story.statement}</p>
                        {story.note && <p className={s.storyNote}>{story.note}</p>}
                      </div>
                      <span className={s.storyStatus}>
                        <StatusBadge status={story.status} />
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className={s.publicFoot}>
          <span>SchullTech EDMS — Product Guide</span>
          <span>
            Status reflects the product as built. Have a question?{' '}
            <Link href="/">Sign in</Link>.
          </span>
        </footer>
      </main>
    </div>
  );
}
