import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { effStatus, dueLabel, currentStage } from '@/utils/helpers';
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
  const { users } = useStore();
  const isTask = !!item.workflowInstance;
  const doc = isTask ? item.workflowInstance.document : item;
  
  const eff = isTask 
    ? (item.status === 'completed' ? 'Closed' : 'Pending')
    : (doc.status === 'closed' ? 'Closed' : doc.status === 'in_progress' ? 'In Progress' : 'Pending');
    
  const due = { text: isTask && item.dueAt ? new Date(item.dueAt).toLocaleDateString('en-GB') : 'N/A', late: isTask && item.dueAt && new Date(item.dueAt) < new Date() };
  const owner = doc?.createdBy;
  const stage = isTask ? item.stage : null;
  const docId = doc?.id || item.documentId;

  const agePct = 30; // Placeholder

  return (
    <div
      className={`task-row ${doc?.urgency === 'critical' ? 'overdue' : ''}`}
      tabIndex={0}
      role="button"
      onClick={() => router.push(`/doc/${docId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/doc/${docId}`);
      }}
    >
      <div className="task-main">
        <div className="task-title">{doc?.title || 'Unknown Document'}</div>
        <div className="task-meta">
          <StatusBadge status={eff} />
          {doc?.urgency && <UrgBadge level={doc.urgency.charAt(0).toUpperCase() + doc.urgency.slice(1)} />}
          {doc?.confidentiality && (
            <ConfBadge
              level={doc.confidentiality.charAt(0).toUpperCase() + doc.confidentiality.slice(1)}
            />
          )}
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
            router.push(`/doc/${docId}`);
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
};
