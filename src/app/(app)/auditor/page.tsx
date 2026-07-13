'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useStore, userById } from '@/store/useStore';
import { Icon } from '@/components/ui/Icons';
import { HBarChart } from '@/components/ui/Charts';
import { timeAgo, fmtDate } from '@/utils/helpers';

export default function AuditorDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { findings, audit, users } = useStore();

  useEffect(() => {
    setPageTitle('Audit Dashboard');
  }, [setPageTitle]);

  const openFindings = findings.filter(f => f.status !== 'Closed');
  const dueSoon = openFindings.filter(f => f.due - Date.now() < 3 * 86400000);
  const sensitiveActions = ['REDACT_RELEASE', 'REDACT_MARK', 'SIGN', 'ACCESS_REQUEST', 'PRINT', 'DOWNLOAD', 'USER_SUSPEND', 'SLA_ESCALATION', 'AUDIT_EXPORT', 'WORKFLOW_PUBLISH', 'TENANT_CONFIG'];
  const sensitive = audit.filter(a => sensitiveActions.includes(a.action));

  const controlCoverage = [
    { label: 'Segregation of duties', value: 92, color: 'var(--status-closed)' },
    { label: 'Access management', value: 78, color: 'var(--status-pending)' },
    { label: 'Confidentiality controls', value: 85, color: 'var(--status-closed)' },
    { label: 'Records retention', value: 64, color: 'var(--status-overdue)' }
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit Dashboard</div>
          <div className="page-sub">Review trails, test controls, track findings to closure.</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => router.push('/auditor/audittrail')}>Open audit trail</button>
          <button className="btn btn-primary" onClick={() => router.push('/auditor/findings')}>Findings tracker</button>
        </div>
      </div>

      {dueSoon.length > 0 && (
        <div className="banner warning">
          <span><Icon name="alert" size={15} /></span>
          {dueSoon.length} finding(s) due for remediation within 3 days.
        </div>
      )}

      <div className="grid cols-4 mb16">
        <div className="tile t-overdue" role="button" tabIndex={0} onClick={() => router.push('/auditor/findings')}>
          <div className="cnt">{findings.filter(f => f.status === 'Open').length}</div>
          <div className="lbl"><Icon name="finding" size={13} /> Open findings</div>
        </div>
        <div className="tile t-pending" role="button" tabIndex={0} onClick={() => router.push('/auditor/findings')}>
          <div className="cnt">{findings.filter(f => f.status === 'In Remediation').length}</div>
          <div className="lbl"><Icon name="clock" size={13} /> In remediation</div>
        </div>
        <div className="tile t-progress" role="button" tabIndex={0} onClick={() => router.push('/auditor/audittrail')}>
          <div className="cnt">{sensitive.length}</div>
          <div className="lbl"><Icon name="eye" size={13} /> Sensitive events</div>
        </div>
        <div className="tile t-closed" role="button" tabIndex={0} onClick={() => router.push('/auditor/findings')}>
          <div className="cnt">{findings.filter(f => f.status === 'Closed').length}</div>
          <div className="lbl"><Icon name="check" size={13} /> Closed (period)</div>
        </div>
      </div>

      <div className="dash-body">
        <div className="card">
          <div className="card-head">
            <span className="h3">Sensitive activity — latest</span>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/auditor/audittrail')}>Full trail</button>
          </div>
          <div className="card-body" style={{ paddingTop: '4px' }}>
            {sensitive.slice(0, 9).map((a, i) => (
              <div key={i} className="meta-row">
                <span className="k" style={{ minWidth: '120px' }}>
                  {new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
                  <span className="kbd" style={{ marginRight: '7px' }}>{a.action}</span> 
                  {userById(users, a.user)?.name || a.user} — {a.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gap: '16px' }}>
          <div className="card">
            <div className="card-head">
              <span className="h3">Control test coverage</span>
            </div>
            <div className="card-body">
              <HBarChart items={controlCoverage} />
            </div>
          </div>
          
          <div className="card">
            <div className="card-head">
              <span className="h3">Sampling shortcuts</span>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              <div className="metric-li" style={{ cursor: 'pointer' }} onClick={() => router.push('/search?conf=Restricted')}>
                <span>Restricted+ documents</span>
                <span className="caption">Sample →</span>
              </div>
              <div className="metric-li" style={{ cursor: 'pointer' }} onClick={() => router.push('/search?status=Overdue')}>
                <span>Overdue items</span>
                <span className="caption">Sample →</span>
              </div>
              <div className="metric-li" style={{ cursor: 'pointer' }} onClick={() => router.push('/search?status=Closed')}>
                <span>Closed in period</span>
                <span className="caption">Sample →</span>
              </div>
              <div className="caption mt8">
                Auditor access is read-only; every view of a Restricted document is itself logged.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
