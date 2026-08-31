import type {
  WorkflowStage,
  WorkflowStageAction,
  WorkflowStageType,
  WorkflowTransition,
} from '@/types/models';

/**
 * Pure helpers for the admin Workflow Designer.
 *
 * Everything here is side-effect free and unaware of React / react-query — the
 * designer graph is a strictly sequential pipeline, so the shape of the data
 * and the canvas geometry can be derived without any component state. The
 * orchestration (drafts, debounced saves, selection) lives in
 * `useWorkflowDesigner`; the rendering lives in `components/workflows/*`.
 */

// --- Stage type catalogue -------------------------------------------------

interface StageTypeSpec {
  type: WorkflowStageType;
  label: string;
  /** Action seeded into a freshly appended stage of this type. */
  defaultAction: WorkflowStageAction;
}

/**
 * The palette. Replaces the old `NODE_TYPES` tuple list plus the inline
 * `type === 'sign' || type === 'approval' ? 'approve' : …` ladder that decided
 * a new stage's starting action.
 */
export const STAGE_TYPES: StageTypeSpec[] = [
  { type: 'start', label: 'Start', defaultAction: 'review' },
  { type: 'review', label: 'Review', defaultAction: 'review' },
  { type: 'approval', label: 'Approval', defaultAction: 'approve' },
  { type: 'sign', label: 'Sign', defaultAction: 'approve' },
  { type: 'condition', label: 'Condition', defaultAction: 'review' },
  { type: 'parallel', label: 'Parallel', defaultAction: 'review' },
  { type: 'notify', label: 'Notify', defaultAction: 'review' },
  { type: 'close', label: 'Close', defaultAction: 'close' },
];

const STAGE_TYPE_BY_KEY = new Map(STAGE_TYPES.map((s) => [s.type, s]));

export function stageTypeLabel(type: string | undefined): string {
  return (type && STAGE_TYPE_BY_KEY.get(type as WorkflowStageType)?.label) || 'Review';
}

// --- Stage / definition factories ---------------------------------------

export const STAGE_ROLES = [
  'staff',
  'supervisor',
  'management',
  'client_admin',
  'schulltech_admin',
  'internal_auditor',
] as const;

const DEFAULT_SLA_HOURS = 48;

/** A new stage for the palette, with a stable-enough id and a sensible action. */
export function makeStage(type: WorkflowStageType): WorkflowStage {
  const spec = STAGE_TYPE_BY_KEY.get(type);
  return {
    id: `stage_${Date.now()}`,
    name: `${spec?.label ?? 'New'} stage`,
    role: 'staff',
    sla_hours: DEFAULT_SLA_HOURS,
    type,
    actions: [spec?.defaultAction ?? 'review'],
  };
}

/** Payload for the "create your first workflow" button on the empty state. */
export function newWorkflowInput() {
  return {
    name: 'New Workflow',
    description: 'A new sequential workflow',
    definition: {
      stages: [
        {
          id: 'start',
          name: 'Start Stage',
          role: 'staff',
          sla_hours: 24,
          type: 'start' as WorkflowStageType,
          actions: ['review' as WorkflowStageAction],
        },
      ],
      transitions: [],
    },
  };
}

// --- Sequential graph --------------------------------------------------

/**
 * Rebuild the transition list so it chains the stages front-to-back with no
 * gaps. Any structural edit (append, delete, reorder) funnels through here —
 * previously this `for` loop was copy-pasted at each call site.
 */
export function rebuildSequentialTransitions(stages: WorkflowStage[]): WorkflowTransition[] {
  const transitions: WorkflowTransition[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    transitions.push({ from: stages[i].id, to: stages[i + 1].id });
  }
  return transitions;
}

// --- Canvas geometry -------------------------------------------------

export const CANVAS = {
  originX: 40,
  originY: 80,
  stageGap: 200,
  nodeWidth: 150,
  /** Horizontal offset from a node's left edge to its outgoing edge anchor. */
  edgeOutDx: 158,
  /** Vertical offset to the edge anchor (roughly the node's mid-height). */
  edgeDy: 34,
  minWidth: 1060,
  minHeight: 420,
  widthPad: 220,
  heightPad: 140,
} as const;

export interface DesignerNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  summary: string;
  sla: number;
  role: string;
}

export function stagesToNodes(stages: WorkflowStage[]): DesignerNode[] {
  return stages.map((s, i) => ({
    id: s.id,
    type: s.type || s.actions?.[0] || 'review',
    name: s.name || s.id,
    x: CANVAS.originX + i * CANVAS.stageGap,
    y: CANVAS.originY,
    summary: `Role: ${s.role || 'Unassigned'}`,
    sla: s.sla_hours || DEFAULT_SLA_HOURS,
    role: s.role || '',
  }));
}

export function transitionsToEdges(transitions: WorkflowTransition[]): [string, string][] {
  return transitions.map((t) => [t.from, t.to]);
}

/** Cubic bezier path between two nodes for the connector <path d=…>. */
export function edgePath(a: DesignerNode, b: DesignerNode): string {
  const x1 = a.x + CANVAS.edgeOutDx;
  const y1 = a.y + CANVAS.edgeDy;
  const x2 = b.x;
  const y2 = b.y + CANVAS.edgeDy;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function canvasBounds(nodes: DesignerNode[]): { width: number; height: number } {
  return {
    width: Math.max(CANVAS.minWidth, ...nodes.map((n) => n.x + CANVAS.widthPad)),
    height: Math.max(CANVAS.minHeight, ...nodes.map((n) => n.y + CANVAS.heightPad)),
  };
}
