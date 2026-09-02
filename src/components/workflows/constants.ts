// Every option here is a real, distinct value from WorkflowStageAction — no
// cosmetic "stage type" layer on top of it. A stage can allow more than one
// (e.g. a decision stage typically wants both approve and reject).
export const STAGE_ACTIONS = [
  { value: 'review', label: 'Review', hint: 'Marks it reviewed and advances to the next stage' },
  { value: 'approve', label: 'Approve', hint: 'Advances to the next stage' },
  { value: 'reject', label: 'Reject', hint: 'Ends the workflow' },
  { value: 'request_changes', label: 'Request changes', hint: 'Sends the file back to the previous stage' },
  { value: 'delegate', label: 'Delegate', hint: "Hands this stage off to someone else, without advancing it" },
  { value: 'close', label: 'Close', hint: 'Ends the workflow' },
];

export const actionLabel = (a: string) => STAGE_ACTIONS.find((x) => x.value === a)?.label || a;

export const DEFAULT_WORKFLOW_DEFINITION = {
  stages: [{ id: 'start', name: 'Start stage', role: 'staff', sla_hours: 24, actions: ['review'] }],
  transitions: [],
};

/** Rebuilds the transition chain from stage order — every workflow here is
 *  strictly sequential (confirmed against the live API: exactly n-1
 *  transitions for n stages, no branching field exists), so this always
 *  produces a single straight chain in array order. */
export function rebuildTransitions(stages: any[]) {
  const transitions = [];
  for (let i = 0; i < stages.length - 1; i++) {
    transitions.push({ from: stages[i].id, to: stages[i + 1].id });
  }
  return transitions;
}
