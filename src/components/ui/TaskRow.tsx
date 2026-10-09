import React from 'react';
import { useRouter } from 'next/navigation';
import { dueLabel, documentStatusLabel } from '@/utils/helpers';
import { stageLabel, taskStatusLabel } from '@/utils/supervisor';
import {
  overdueDocumentCount,
  taskDueAt,
  taskPrimaryDocument,
  taskTitle,
  taskUrgency,
} from '@/utils/workflowDocuments';
import { StatusBadge, UrgBadge, ConfBadge } from './Badges';

export const TaskRow = ({
  item,
  showAssignee = false,
  extraActions,
}: {
  item: any; // Can be Task or Document
  showAssignee?: boolean;
  extraActions?: React.ReactNode;
}) => {
  const router = useRouter();
  const isTask = !!item.workflowInstance;
  // A task can cover several documents (edms-backend `919d0ef`): its title and
  // urgency come from all of them, its badges from the first.
  const doc = isTask ? taskPrimaryDocument(item) : item;
  const title = isTask ? taskTitle(item) : doc?.title || 'Unknown Document';
  const urgency = isTask ? taskUrgency(item) : doc?.urgency;

  const eff = isTask ? taskStatusLabel(item) : documentStatusLabel(doc);

  // A task's deadline is the earliest of its documents'. `GET /tasks` doesn't
  // return deadlines yet, so a list row usually shows "—" — not "No due date",
  // which would be wrong. A bare document has no deadline anywhere.
  const dueAt = isTask ? taskDueAt(item) : null;
  const lateDocs = isTask ? overdueDocumentCount(item) : 0;
  const docCount = isTask ? (item.documents?.length ?? 0) : 0;
  const due = !isTask
    ? { text: 'N/A', late: false }
    : dueAt
      ? lateDocs > 0 && docCount > 1
        ? { text: `${lateDocs} of ${docCount} overdue`, late: true }
        : dueLabel(dueAt)
      : { text: '—', late: false };
  // `GET /tasks` sends no document owner, so a task row names its workflow instead.
  const workflowName = isTask ? item.workflowInstance?.workflowDefinition?.name : null;
  const stage = isTask ? stageLabel(item.stage) : null;
  const docId = doc?.id || item.documentId;
  // A task is worked on its workflow page; a bare document opens its own page.
  const href = isTask
    ? `/workflow-instances/${item.workflowInstanceId}?task=${item.id}`
    : `/doc/${docId}`;

  const agePct = 30; // Placeholder

  return (
    <div
      className={`task-row ${urgency === 'critical' ? 'overdue' : ''}`}
      tabIndex={0}
      role="button"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(href);
      }}
    >
      <div className="task-main">
        <div className="task-title">{title}</div>
        <div className="task-meta">
          <StatusBadge status={eff} />
          {urgency && <UrgBadge level={urgency} />}
          {doc?.confidentiality && <ConfBadge level={doc.confidentiality} />}
          {stage && <span>{stage}</span>}
          {showAssignee && item.assignee?.name ? (
            <span>· {item.assignee.name}</span>
          ) : (
            workflowName && <span>· {workflowName}</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className={`due-chip ${due.late ? 'late' : ''}`}>{due.text}</div>
        <div
          className={`agebar ${due.late ? 'late' : ''}`}
          style={{ marginTop: '5px', marginLeft: 'auto' }}
        >
          <i style={{ width: `${agePct}%` }}></i>
        </div>
      </div>
      <div className="task-actions">
        {extraActions}
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(href);
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
};
