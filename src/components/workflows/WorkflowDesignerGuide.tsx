'use client';

import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';

const GUIDE_BODY = (
  <ul className="wfd-guide-list">
    <li>
      Click a stage to configure it in the panel on the right — its <b>Properties</b> tab covers
      who's assigned and its SLA; its <b>Transitions</b> tab covers where a document goes next.
      Clicking an existing branch line on the canvas jumps straight to that tab.
    </li>
    <li>
      By default a stage has one plain line to the next stage — nothing to configure. Add a{' '}
      <b>conditional branch</b> when different documents should go different places, e.g. route to
      a fast-track approval only when urgency is Critical.
    </li>
    <li>
      A condition checks the document's <b>urgency</b>, <b>confidentiality</b>, or a{' '}
      <b>metadata field</b> against a value — "Match: All" requires every rule to hold, "Any"
      requires just one.
    </li>
    <li>
      Every stage with a conditional branch needs exactly one <b>fallback</b> (the plain line, no
      condition) for documents that don't match anything — the backend enforces this, so the
      editor won't let you save without one.
    </li>
    <li>
      With more than one conditional branch from the same stage, each needs its own{' '}
      <b>priority</b> — they're checked in that order, first match wins.
    </li>
    <li>
      An amber line is a conditional branch, a green line is a required fallback, and a plain gray
      line means this stage doesn't branch at all. Stages are positioned by where they sit in the
      routing, not by the order you created them, so a branch and its fallback never draw a line
      through an unrelated stage.
    </li>
  </ul>
);

/**
 * A short, on-demand explanation of how routing works on this page — added
 * because conditional branching (priority, fallback, match mode) isn't
 * self-explanatory the first time someone opens this designer, and there's
 * nowhere else in the product that documents it. Uses the app's existing
 * generic modal (`useUIStore`'s `openModal`/`UIProviders`) rather than a new
 * dialog implementation, so Escape, backdrop-click, and focus styling match
 * every other modal in the product for free.
 */
export function WorkflowDesignerGuide() {
  const openModal = useUIStore((s) => s.openModal);

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm wfd-guide-trigger"
      onClick={() => openModal({ title: 'How routing works on this page', body: GUIDE_BODY })}
    >
      <Icon name="info" size={14} />
      How routing works
    </button>
  );
}
