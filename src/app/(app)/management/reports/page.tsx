'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

const DEPTS = ['Operations', 'Finance', 'Legal', 'Procurement', 'Audit & Compliance'];

export default function ReportsExportPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const [type, setType] = useState('Throughput summary');
  const [dept, setDept] = useState('All departments');
  const [range, setRange] = useState('Last 30 days');
  const [fmt, setFmt] = useState('CSV');

  useEffect(() => {
    setPageTitle('Reports & Export');
  }, [setPageTitle]);

  const saved = [
    { name: 'Monthly throughput by department', schedule: 'Monthly · 1st, 08:00', fmt: 'XLSX', last: 'Jul 01, 2026' },
    { name: 'SLA breach register', schedule: 'Weekly · Mon, 07:30', fmt: 'CSV', last: 'Jul 06, 2026' },
    { name: 'Sensitive activity report', schedule: 'Weekly · Fri, 17:00', fmt: 'PDF', last: 'Jul 03, 2026' },
  ];

  const handleRunReport = () => {
    addToast('Export simulated', 'success');
    auditAction('REPORT_EXPORT', 'Reports', `Ran “${type}” (${dept}, ${range})`);
  };

  const handleScheduleReport = () => {
    let freq = 'Daily';
    let recips = 'management@firstatlantic.com';
    openModal({
      title: 'Schedule report',
      body: (
        <div>
          <div className="field">
            <label>Frequency</label>
            <select className="input" defaultValue={freq} onChange={e => freq = e.target.value}>
              <option>Daily</option>
              <option>Weekly (Monday)</option>
              <option>Monthly (1st)</option>
            </select>
          </div>
          <div className="field">
            <label>Recipients</label>
            <input className="input" defaultValue={recips} onChange={e => recips = e.target.value} />
          </div>
          <div className="caption">Scheduled reports are generated server-side and delivered by email with a permission-checked link.</div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Schedule',
          kind: 'btn-primary',
          onClick: () => {
            auditAction('REPORT_SCHEDULE', 'Reports', 'Scheduled ' + type);
            addToast('Report scheduled', 'success');
            closeModal();
          }
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'name', label: 'Report', render: r => <b>{r.name}</b> },
    { key: 'schedule', label: 'Schedule' },
    { key: 'fmt', label: 'Format' },
    { key: 'last', label: 'Last run' },
    { key: 'act', label: '', render: r => (
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={(e) => { 
            e.stopPropagation(); 
            addToast(`“${r.name}” queued — you’ll be emailed the export`, 'success'); 
            auditAction('REPORT_RUN', 'Reports', 'Ran ' + r.name); 
          }}
        >
          Run now
        </button>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Reports & Export</div>
          <div className="page-sub">Build, run, schedule and export reports.</div>
        </div>
      </div>

      <div className="grid cols-2 mb16" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h3">Report builder</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label>Report type</label>
              <select className="input" value={type} onChange={e => setType(e.target.value)}>
                <option>Throughput summary</option>
                <option>SLA compliance</option>
                <option>Findings & exceptions</option>
                <option>Audit activity extract</option>
                <option>Storage & usage</option>
              </select>
            </div>
            <div className="grid cols-2" style={{ gap: '12px' }}>
              <div className="field">
                <label>Department</label>
                <select className="input" value={dept} onChange={e => setDept(e.target.value)}>
                  <option>All departments</option>
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Time range</label>
                <select className="input" value={range} onChange={e => setRange(e.target.value)}>
                  <option>Last 30 days</option>
                  <option>Last quarter</option>
                  <option>Year to date</option>
                  <option>Custom…</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Format</label>
              <select className="input" value={fmt} onChange={e => setFmt(e.target.value)}>
                <option>CSV</option>
                <option>XLSX</option>
                <option>PDF</option>
              </select>
            </div>
            <div className="flex g8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleScheduleReport}>Schedule…</button>
              <button className="btn btn-primary flex aic" onClick={handleRunReport}>
                <span style={{ marginRight: '8px' }}><Icon name="download" size={15} /></span> Run & export
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Scheduled reports</span>
          </div>
          <Table cols={cols} rows={saved} />
        </div>
      </div>
    </div>
  );
}
