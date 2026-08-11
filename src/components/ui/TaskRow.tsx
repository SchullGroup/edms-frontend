import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { effStatus, dueLabel, currentStage } from '@/utils/helpers';
import { StatusBadge, UrgBadge, ConfBadge } from './Badges';

export const TaskRow = ({
  doc,
  showAssignee = false,
  extraActions,
}: {
  doc: any;
  showAssignee?: boolean;
  extraActions?: React.ReactNode;
}) => {
  const router = useRouter();
  const { users } = useStore();
  const eff =
    doc.status === 'closed' ? 'Closed' : doc.status === 'in_progress' ? 'In Progress' : 'Pending';
  const due = { text: 'N/A', late: false }; // Placeholder until Tasks are implemented
  const owner = doc.createdBy;
  const stage = null; // Placeholder until WorkflowInstance is loaded

  const agePct = 30; // Placeholder

  return (
    <div
      className={`task-row ${doc.urgency === 'critical' ? 'overdue' : ''}`}
      tabIndex={0}
      role="button"
      onClick={() => router.push(`/doc/${doc.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/doc/${doc.id}`);
      }}
    >
      <div className="task-main">
        <div className="task-title">{doc.title}</div>
        <div className="task-meta">
          <StatusBadge status={eff} />
          <UrgBadge level={doc.urgency?.charAt(0).toUpperCase() + doc.urgency?.slice(1)} />
          <ConfBadge
            level={doc.confidentiality?.charAt(0).toUpperCase() + doc.confidentiality?.slice(1)}
          />
          {stage && <span>{stage}</span>}
          {showAssignee ? (
            <span>· Assignee</span>
          ) : (
            <span>· Owner ID: {owner?.substring(0, 8)}</span>
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
            router.push(`/doc/${doc.id}`);
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
};
