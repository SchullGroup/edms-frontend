'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icons';
import { actionLabel } from './constants';

function SortableStageNode({ stage, index, selected, onSelect, assigneeSummary }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`wf-node ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(stage.id)}
    >
      <div className="wf-node-order">Stage {index + 1}</div>
      <div className="wf-node-name">{stage.name || stage.id}</div>
      <div className="wf-node-meta">
        {assigneeSummary(stage)} · {stage.sla_hours || 48}h
      </div>
      <div className="wf-node-tags">
        {(stage.actions || []).map((a: string) => (
          <span key={a} className="wf-node-tag">
            {actionLabel(a)}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface WorkflowCanvasProps {
  stages: any[];
  selectedStageId: string | null;
  onSelect: (id: string) => void;
  onReorder: (stages: any[]) => void;
  assigneeSummary: (stage: any) => string;
  disabled?: boolean;
}

/** Stages laid out as connected, draggable cards — real drag-and-drop via
 *  dnd-kit, not the previous absolute-positioned canvas that looked
 *  interactive but never actually moved. Still strictly a single left-to-
 *  right chain: dragging reorders the sequence, it can't create a branch,
 *  because the backend has nowhere to persist one. */
export function WorkflowCanvas({ stages, selectedStageId, onSelect, onReorder, assigneeSummary, disabled }: WorkflowCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(stages, oldIndex, newIndex));
  };

  if (stages.length === 0) {
    return (
      <div className="caption" style={{ padding: '20px' }}>
        No stages yet — add the first one.
      </div>
    );
  }

  return (
    <div className="wfd-canvas">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="wf-node-row">
            {stages.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && (
                  <div className="wf-connector">
                    <Icon name="chevR" size={16} />
                  </div>
                )}
                <SortableStageNode
                  stage={s}
                  index={i}
                  selected={selectedStageId === s.id}
                  onSelect={onSelect}
                  assigneeSummary={assigneeSummary}
                />
              </React.Fragment>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="caption" style={{ marginTop: '12px' }}>
        Drag a stage to reorder it — the sequence always runs left to right.
      </div>
    </div>
  );
}
