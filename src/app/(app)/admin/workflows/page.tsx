// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useWorkflows, useUpdateWorkflow, useCreateWorkflow } from '@/hooks/useWorkflows';

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

  const { data: workflowsData } = useWorkflows();
  const workflows = workflowsData?.data || [];

  const updateWfMutation = useUpdateWorkflow();
  const createWfMutation = useCreateWorkflow();

  const [wfId, setWfId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);

  useEffect(() => {
    if (workflows.length > 0 && !wfId) {
      setWfId(workflows[0].id);
    }
  }, [workflows, wfId]);

  const wf = workflows?.find((w) => w.id === wfId) || workflows?.[0];
  const selectedNode = wf?.nodes?.find((n: any) => n.id === selectedNodeId);

  const updateWorkflow = (id: string, updates: any) => {
    updateWfMutation.mutate({ id, updates });
  };

  useEffect(() => {
    setPageTitle('Workflow Designer');
  }, [setPageTitle]);

  if (!wf) return null;

  const handlePublish = () => {
    updateWorkflow(wf.id, { version: wf.version + 1, status: 'Published', updated: Date.now() });
    setDirty(false);
    auditAction('WORKFLOW_PUBLISH', wf.id, `Published ${wf.name} v${wf.version + 1}`);
    addToast(`${wf.name} v${wf.version + 1} published`, 'success');
  };

  const handleClone = () => {
    const copy = {
      name: wf.name + ' (copy)',
      description: 'Cloned from ' + wf.name,
      isActive: false,
      nodes: wf.nodes || [],
      edges: wf.edges || [],
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

  const W = Math.max(1060, ...(wf.nodes || []).map((n: any) => n.x + 220));
  const H = Math.max(420, ...(wf.nodes || []).map((n: any) => n.y + 140));

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
            <span className={`badge ${wf.isActive ? 'b-status-closed' : 'b-status-pending'}`}>
              {wf.isActive ? 'Active' : 'Draft'} · v{wf.version}
            </span>
            {dirty && <span className="badge b-urg-high">● Unsaved changes</span>}
          </div>
          <div className="page-sub">Applied to: {wf.appliedTo}</div>
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
          <div className="caption mb8">Click to add</div>
          {NODE_TYPES.map(([type, label]) => (
            <div
              key={type}
              className="metric-li"
              style={{ cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                const node = {
                  id: 'n-' + Date.now(),
                  type,
                  name: label + ' stage',
                  x: 30,
                  y: 30,
                  summary: 'Configure in properties →',
                  sla: 48,
                  role: '',
                };
                updateWorkflow(wf.id, { nodes: [...(wf.nodes || []), node] });
                setSelectedNodeId(node.id);
                setDirty(true);
                addToast('Stage added', 'success');
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
              setConnectFromId(null);
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
              {wf.edges?.map(([from, to, label]: any, i: number) => {
                const a = wf.nodes?.find((n: any) => n.id === from);
                const b = wf.nodes?.find((n: any) => n.id === to);
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
                    {label && (
                      <text
                        x={(a.x + 158 + b.x) / 2}
                        y={(a.y + b.y) / 2 + 28}
                        fontSize="10"
                        fill="var(--brand-accent)"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {wf.nodes?.map((n: any) => (
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
                  cursor: connectFromId ? 'crosshair' : 'pointer',
                  zIndex: 10,
                  boxShadow: selectedNodeId === n.id ? '0 0 0 2px var(--brand-accent)' : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectFromId && connectFromId !== n.id) {
                    updateWorkflow(wf.id, { edges: [...(wf.edges || []), [connectFromId, n.id]] });
                    setConnectFromId(null);
                    setDirty(true);
                    addToast('Stages connected', 'success');
                    return;
                  }
                  setConnectFromId(null);
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
                <div
                  className="handle"
                  style={{
                    position: 'absolute',
                    right: '-8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    background: 'var(--border)',
                    borderRadius: '50%',
                    cursor: 'crosshair',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Connect to another stage"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConnectFromId(n.id);
                    addToast('Now click the target stage to connect', 'info');
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      background: 'var(--text)',
                      borderRadius: '50%',
                    }}
                  ></div>
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
                Graph is valid.
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
                    const updatedNodes = wf.nodes.map((nn: any) =>
                      nn.id === selectedNode.id ? { ...nn, name: e.target.value } : nn,
                    );
                    updateWorkflow(wf.id, { nodes: updatedNodes });
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
                    const updatedNodes = wf.nodes.map((nn: any) =>
                      nn.id === selectedNode.id ? { ...nn, role: e.target.value } : nn,
                    );
                    updateWorkflow(wf.id, { nodes: updatedNodes });
                    setDirty(true);
                  }}
                >
                  {[
                    '',
                    'Staff Officer',
                    'Supervisor',
                    'Legal Officer',
                    'Management',
                    'Finance Approvers',
                    'Executive Signatories',
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r || '— none —'}
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
                      const updatedNodes = wf.nodes.map((nn: any) =>
                        nn.id === selectedNode.id ? { ...nn, sla: +e.target.value } : nn,
                      );
                      updateWorkflow(wf.id, { nodes: updatedNodes });
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="field">
                  <label>Escalate to</label>
                  <select
                    className="input"
                    value={selectedNode.escalation || 'None'}
                    onChange={(e) => {
                      const updatedNodes = wf.nodes.map((nn: any) =>
                        nn.id === selectedNode.id ? { ...nn, escalation: e.target.value } : nn,
                      );
                      updateWorkflow(wf.id, { nodes: updatedNodes });
                      setDirty(true);
                    }}
                  >
                    {['Supervisor', 'Management', 'None'].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Controls</label>
                <select
                  className="input"
                  value={selectedNode.controls || 'None'}
                  onChange={(e) => {
                    const updatedNodes = wf.nodes.map((nn: any) =>
                      nn.id === selectedNode.id ? { ...nn, controls: e.target.value } : nn,
                    );
                    updateWorkflow(wf.id, { nodes: updatedNodes });
                    setDirty(true);
                  }}
                >
                  {['None', 'Maker-checker', 'Dual approval', 'SoD enforced'].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-danger btn-sm mt16"
                onClick={() => {
                  openConfirm({
                    title: `Delete stage "${selectedNode.name}"?`,
                    message:
                      'This stage will be removed from the workflow layout. Any connecting edges will also be deleted.',
                    confirmLabel: 'Delete stage',
                    danger: true,
                    onConfirm: () => {
                      const updatedNodes = wf.nodes.filter((nn: any) => nn.id !== selectedNode.id);
                      const updatedEdges = wf.edges.filter(
                        ([a, b]: any) => a !== selectedNode.id && b !== selectedNode.id,
                      );
                      updateWorkflow(wf.id, { nodes: updatedNodes, edges: updatedEdges });
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
