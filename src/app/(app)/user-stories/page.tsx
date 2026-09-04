'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
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

const STATUS_ORDER: Status[] = ['done', 'partial', 'mock', 'broken', 'none'];

/** Design-system status colours, so the swimlane accent matches the badge. */
const STEP_COLOR: Record<Status, string> = {
  done: 'var(--status-closed)',
  partial: 'var(--status-pending)',
  mock: 'var(--status-onhold)',
  broken: 'var(--status-overdue)',
  none: 'var(--status-progress)',
};

function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`badge ${STATUS_CLASS[status]}`} title={STATUS_HELP[status]}>
      {label || STATUS_LABEL[status]}
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
        style={{
          gridTemplateColumns: `repeat(${lanes.length}, minmax(${minWidth}px, 1fr))`,
        }}
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
              <StatusBadge status={step.status} label={step.statusLabel} />
            </span>
            {step.note && <p className={s.stepNote}>{step.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserStoriesPage() {
  const { setPageTitle } = useUIStore();
  const [view, setView] = useState<View>('flow');
  const [filter, setFilter] = useState<Status | 'all'>('all');

  useEffect(() => {
    setPageTitle('Product Guide');
  }, [setPageTitle]);

  const visibleEpics = useMemo(
    () =>
      EPICS.map((epic) => ({
        ...epic,
        stories: filter === 'all' ? epic.stories : epic.stories.filter((st) => st.status === filter),
      })).filter((epic) => epic.stories.length > 0),
    [filter],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Product Guide</div>
          <div className="page-sub">
            How a document moves through EDMS, who touches it at each step, and which of those steps
            are built. Statuses are read from the code, not from a plan.
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

      {/* ---------------- summary tiles ---------------- */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="card kpi">
          <div className="kl">Roles</div>
          <div className="kv tnum">6</div>
        </div>
        <div className="card kpi">
          <div className="kl">Phases</div>
          <div className="kv tnum">11</div>
        </div>
        <div className="card kpi">
          <div className="kl">Handoffs</div>
          <div className="kv tnum">7</div>
        </div>
        <div className="card kpi">
          <div className="kl">Stories</div>
          <div className="kv tnum">{ALL_STORIES.length}</div>
        </div>
        <div className="card kpi">
          <div className="kl">Done</div>
          <div className="kv tnum">{STATUS_COUNTS.done}</div>
        </div>
        <div className="card kpi">
          <div className="kl">API routes</div>
          <div className="kv tnum">83</div>
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
            Nothing in this chain can be reordered — each phase produces the input the next one
            needs. A tenant that skips a phase does not fail loudly; it fails quietly, later, in
            someone else’s screen.
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
                <p className={s.personaFear}>Fears: {p.fear}</p>
                <dl className={s.personaMeta}>
                  <dt>Grants</dt>
                  <dd>{p.grants}</dd>
                  <dt>Scope</dt>
                  <dd>{p.scope}</dd>
                  <dt>Portal</dt>
                  <dd>{p.portal}</dd>
                </dl>
              </article>
            ))}
          </div>

          <div className={s.blockTitle}>Setup, phase by phase</div>
          <div className="card card-pad">
            <div className={s.ladder}>
              {SETUP_STEPS.map((step) => (
                <div key={step.tag} className={s.rung}>
                  <span className={s.rungPhase}>{step.tag}</span>
                  <span className={s.rungTitle}>{step.title}</span>
                  <StatusBadge status={step.status} label={step.statusLabel} />
                  <p className={s.rungDetail}>{step.detail}</p>
                  {step.note && <p className={s.rungNote}>{step.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className={s.blockTitle}>The seven handoffs</div>
          <p className={s.sectionLede}>
            A handoff is a seam where work crosses a role boundary. Each is a seam rather than a
            screen, which is why role-by-role testing misses them. Four of the seven are still
            broken or partial.
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
                    <StatusBadge status={h.status} label={h.statusLabel} />
                  </div>
                  <p className={s.handoffBody}>{h.body}</p>
                  {h.fix && <p className={s.handoffFix}>{h.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- DIAGRAM ---------------- */}
      {view === 'diagram' && (
        <div>
          <div className={s.blockTitle}>Setup flow — phases 0 to 7</div>
          <p className={s.sectionLede}>
            Who does what, in order, before a Staff Officer can file their first document. Scroll
            sideways to see every lane.
          </p>
          <Swimlane lanes={SETUP_LANES} steps={SETUP_STEPS} minWidth={200} />
          <p className={s.swimCaption}>
            <strong>The quiet failure to watch for.</strong> A staff user created without a
            department silently collapses from department scope to their own documents only. No
            error is raised, and nobody is told why they can suddenly see less.
          </p>

          <div className={s.blockTitle}>The document journey — phase 8</div>
          <p className={s.sectionLede}>
            One invoice, from Chika’s desk to a closed record. This is the chain that proves the
            system works — and the two places it still stops.
          </p>
          <Swimlane lanes={JOURNEY_LANES} steps={JOURNEY_STEPS} minWidth={178} />
          <p className={s.swimCaption}>
            <strong>Read the lanes, not the steps.</strong> The staff and supervisor lanes are
            solid. The system lane fails at OCR and tells nobody about SLA breaches. The auditor
            lane has never received a single row. That shape — operations wired, governance not —
            is the whole product in one picture.
          </p>
        </div>
      )}

      {/* ---------------- STORIES ---------------- */}
      {view === 'stories' && (
        <div>
          <p className={s.sectionLede}>
            Every story is written from the person’s side of the screen and carries the status of
            the code behind it. Filter by status to see one layer of the product at a time.
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
                      <StatusBadge status={story.status} label={story.statusLabel} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
