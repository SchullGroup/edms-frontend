// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkflows, useUpdateWorkflow, useCreateWorkflow, usePublishWorkflow } from '@/apis/hooks/useWorkflows';

const NODE_TYPES = [
  ['start', 'Start'],
  ['review', 'Review'],
  ['approval', 'Approval'],
  ['sign', 'Sign'],
  ['condition', 'Condition'],
  ['parallel', 'Parallel'],
  ['notify', 'Notify'],
  ['close', 'Close'],
];

export default function WorkflowDesignerPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openConfirm, addToast } = useUIStore();

  const { data: workflowsData, isLoading, error } = useWorkflows();
  const workflows = workflowsData?.data || [];

  const updateWfMutation = useUpdateWorkflow();
  const createWfMutation = useCreateWorkflow();
  const publishWfMutation = usePublishWorkflow();

  const [wfId, setWfId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (workflows.length > 0 && !wfId) {
      setWfId(workflows[0].id);
    }
  }, [workflows, wfId]);

  const wf = workflows?.find((w: any) => w.id === wfId) || workflows?.[0];

  const stages = wf?.definition?.stages || [];
  const transitions = wf?.definition?.transitions || [];

  const nodes = stages.map((s: any, i: number) => ({
    id: s.id,
    type: s.actions?.[0] || 'review',
    name: s.name || s.id,
    x: 40 + i * 200,
    y: 80,
    summary: `Role: ${s.role || 'Unassigned'}`,
    sla: s.sla_hours || 48,
    role: s.role || '',
  }));
  const edges = transitions.map((t: any) => [t.from, t.to]);

  const selectedNode = nodes.find((n: any) => n.id === selectedNodeId);

  const updateWorkflow = (id: string, updates: any) => {
    updateWfMutation.mutate({ id, updates });
  };

  useEffect(() => {
    setPageTitle('Workflow Designer');
  }, [setPageTitle]);

  if (isLoading) {
    return <div className="p-8 text-center muted">Loading workflow designer...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--status-overdue)' }}>
        Failed to load workflows. Please try again.
      </div>
    );
  }

  if (!wf && workflows.length === 0) {
    return (
      <div className="p-8">
        <div className="card card-pad text-center">
          <div className="h3 mb8">No Workflows Found</div>
          <div className="caption mb16">Create your first workflow to get started.</div>
          <button
            className="btn btn-primary"
            onClick={() => {
              createWfMutation.mutate(
                {
                  name: 'New Workflow',
                  description: 'A new sequential workflow',
                  definition: {
                    stages: [
                      {
                        id: 'start',
                        name: 'Start Stage',
                        role: 'staff',
                        sla_hours: 24,
                        actions: ['review'],
                      },
                    ],
                    transitions: [],
                  },
                },
                {
                  onSuccess: (data: any) => {
                    setWfId(data.id);
                    addToast('Workflow created', 'success');
                  },
                },
              );
            }}
          >
            Create Workflow
          </button>
        </div>
      </div>
    );
  }

  if (!wf) return null;

  const handlePublish = () => {
    publishWfMutation.mutate(wf.id, {
      onSuccess: () => {
        setDirty(false);
        auditAction('WORKFLOW_PUBLISH', wf.id, `Published ${wf.name}`);
      }
    });
  };

  const handleClone = () => {
    const copy = {
      name: wf.name + ' (copy)',
      description: 'Cloned from ' + wf.name,
      definition: wf.definition,
    };
    createWfMutation.mutate(copy, {
      onSuccess: (data: any) => {
        setWfId(data.id);
        setDirty(false);
        auditAction('WORKFLOW_CLONE', data.id, 'Cloned from ' + wf.name);
      },
    });
  };

  const edgePath = (a: any, b: any) => {
    const x1 = a.x + 158,
      y1 = a.y + 34,
      x2 = b.x,
      y2 = b.y + 34;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  const W = Math.max(1060, ...nodes.map((n: any) => n.x + 220));
  const H = Math.max(420, ...nodes.map((n: any) => n.y + 140));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="flex aic g8 wrap">
            <input
              className="input"
              value={wf.name}
              style={{ width: '240px', fontWeight: 700 }}
              onChange={(e) => {
                updateWorkflow(wf.id, { name: e.target.value });
                setDirty(true);
              }}
            />
            <span
              className={`badge ${wf.status === 'published' ? 'b-status-closed' : 'b-status-pending'}`}
            >
              {wf.status === 'published' ? 'Active' : 'Draft'} · v{wf.version}
            </span>
            {dirty && <span className="badge b-urg-high">● Unsaved changes</span>}
          </div>

          <div className="page-sub">Sequential Pipeline Designer</div>
        </div>

        <div className="actions">
          <select
            className="input"
            style={{ width: 'auto', height: '34px' }}
            value={wf.id}
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm('You have unsaved layout changes. Switch workflow anyway?')
              )
                return;
              setWfId(e.target.value);
              setSelectedNodeId(null);
              setDirty(false);
            }}
          >
            {workflows?.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name} (v{w.version})
              </option>
            ))}
          </select>

          <button className="btn btn-secondary" onClick={handleClone}>
            Clone
          </button>
          <button className="btn btn-primary" onClick={handlePublish}>
            Publish
          </button>
        </div>
      </div>

      <div
        className="wfd-layout"
        style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 180px)' }}
      >
        {/* Palette */}
        <div className="card card-pad wfd-palette" style={{ width: '160px', flexShrink: 0 }}>
          <div className="h3 mb8">Stage palette</div>
          <div className="caption mb8">Click to append</div>
          {NODE_TYPES.map(([type, label]) => (
            <div
              key={type}
              className="metric-li"
              style={{ cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                const newStage = {
                  id: `stage_${Date.now()}`,
                  name: label + ' stage',
                  role: 'staff',
                  sla_hours: 48,
                  actions: [
                    type === 'sign' || type === 'review' || type === 'approve' ? type : 'review',
                  ],
                };
                const updatedStages = [...stages, newStage];
                const updatedTransitions = [];
                for (let i = 0; i < updatedStages.length - 1; i++) {
                  updatedTransitions.push({
                    from: updatedStages[i].id,
                    to: updatedStages[i + 1].id,
                  });
                }
                updateWorkflow(wf.id, {
                  definition: { stages: updatedStages, transitions: updatedTransitions },
                });
                setSelectedNodeId(newStage.id);
                setDirty(true);
                addToast('Stage appended', 'success');
              }}
            >
              <span
                className={`sw node-sw-${type}`}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  display: 'inline-block',
                  marginRight: '8px',
                }}
              ></span>
              {label}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div
          className="wfd-canvas card"
          style={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}
        >
          <div
            style={{ position: 'relative', width: W + 'px', height: H + 'px' }}
            onClick={() => {
              setSelectedNodeId(null);
            }}
          >
            <svg
              width={W}
              height={H}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <defs>
                <marker
                  id="arr"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
                </marker>
              </defs>
              {edges.map(([from, to, label]: any, i: number) => {
                const a = nodes.find((n: any) => n.id === from);
                const b = nodes.find((n: any) => n.id === to);
                if (!a || !b) return null;
                return (
                  <g key={i}>
                    <path
                      d={edgePath(a, b)}
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="1.8"
                      markerEnd="url(#arr)"
                    />
                  </g>
                );
              })}
            </svg>

            {nodes.map((n: any) => (
              <div
                key={n.id}
                className={`wf-node ${selectedNodeId === n.id ? 'selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: '150px',
                  padding: '8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: selectedNodeId === n.id ? '0 0 0 2px var(--brand-accent)' : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(n.id);
                }}
              >
                <div
                  className="nt"
                  style={{
                    fontSize: '10px',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    className={`sw node-sw-${n.type}`}
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '3px',
                      display: 'inline-block',
                      marginRight: '4px',
                    }}
                  ></span>
                  {n.type}
                </div>
                <div
                  className="nn"
                  style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}
                >
                  {n.name}
                </div>
                <div className="ns" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {n.summary}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="card wfd-props" style={{ width: '280px', flexShrink: 0, overflow: 'auto' }}>
          <div className="card-head">
            <span className="h3">Stage properties</span>
          </div>
          {!selectedNode ? (
            <div className="card-body">
              <p className="muted" style={{ lineHeight: 1.6, fontSize: '12.5px' }}>
                Select a stage on the canvas to configure it, or add a stage type from the palette.
              </p>
              <div className="divider"></div>
              <div className="banner success" style={{ marginBottom: 0 }}>
                Graph is strictly sequential.
              </div>
            </div>
          ) : (
            <div className="card-body">
              <div className="field">
                <label>Stage name</label>
                <input
                  className="input"
                  value={selectedNode.name || ''}
                  onChange={(e) => {
                    const updatedStages = stages.map((s: any) =>
                      s.id === selectedNode.id ? { ...s, name: e.target.value } : s,
                    );
                    updateWorkflow(wf.id, {
                      definition: { ...wf.definition, stages: updatedStages },
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="field">
                <label>Assignee role</label>
                <select
                  className="input"
                  value={selectedNode.role || ''}
                  onChange={(e) => {
                    const updatedStages = stages.map((s: any) =>
                      s.id === selectedNode.id ? { ...s, role: e.target.value } : s,
                    );
                    updateWorkflow(wf.id, {
                      definition: { ...wf.definition, stages: updatedStages },
                    });
                    setDirty(true);
                  }}
                >
                  {[
                    'staff',
                    'supervisor',
                    'management',
                    'client_admin',
                    'schulltech_admin',
                    'internal_auditor',
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid cols-2" style={{ gap: '10px' }}>
                <div className="field">
                  <label>SLA (hours)</label>
                  <input
                    className="input"
                    type="number"
                    value={selectedNode.sla || 48}
                    onChange={(e) => {
                      const updatedStages = stages.map((s: any) =>
                        s.id === selectedNode.id ? { ...s, sla_hours: +e.target.value } : s,
                      );
                      updateWorkflow(wf.id, {
                        definition: { ...wf.definition, stages: updatedStages },
                      });
                      setDirty(true);
                    }}
                  />
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm mt16"
                onClick={() => {
                  openConfirm({
                    title: `Delete stage "${selectedNode.name}"?`,
                    message:
                      'This stage will be removed from the workflow layout. The remaining sequence will be reconnected.',
                    confirmLabel: 'Delete stage',
                    danger: true,
                    onConfirm: () => {
                      const updatedStages = stages.filter((s: any) => s.id !== selectedNode.id);
                      const updatedTransitions = [];
                      for (let i = 0; i < updatedStages.length - 1; i++) {
                        updatedTransitions.push({
                          from: updatedStages[i].id,
                          to: updatedStages[i + 1].id,
                        });
                      }
                      updateWorkflow(wf.id, {
                        definition: { stages: updatedStages, transitions: updatedTransitions },
                      });
                      setSelectedNodeId(null);
                      setDirty(true);
                      addToast('Stage deleted', 'info');
                    },
                  });
                }}
              >
                Delete stage
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
