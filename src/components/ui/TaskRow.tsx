import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { effStatus, dueLabel, currentStage } from '@/utils/helpers';
import { StatusBadge, UrgBadge, ConfBadge } from './Badges';

export const TaskRow = ({ doc, showAssignee = false, extraActions }: { doc: any; showAssignee?: boolean; extraActions?: React.ReactNode }) => {
  const router = useRouter();
  const { users } = useStore();
  const eff = effStatus(doc);
  const due = dueLabel(doc.due);
  const owner = userById(users, doc.owner);
  const stage = currentStage(doc);

  const agePct = doc.due
    ? Math.min(
        100,
        Math.max(6, Math.round(((Date.now() - doc.created) / (doc.due - doc.created)) * 100)),
      )
    : 30;

  return (
    <div
      className={`task-row ${eff === 'Overdue' ? 'overdue' : ''}`}
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
          <UrgBadge level={doc.urgency} />
          <ConfBadge level={doc.confidentiality} />
          <span>{stage ? '· ' + stage.name : ''}</span>
          {showAssignee ? (
            <span>· {userById(users, doc.assignee)?.name}</span>
          ) : (
            <span>· from {owner?.name}</span>
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
