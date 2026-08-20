// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, effStatus, canView, cabById, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDocuments, useDocumentSearch } from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { Icon } from '@/components/ui/Icons';
import { TaskRow } from '@/components/ui/TaskRow';
import { exportCsv } from '@/utils/exportCsv';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { docTypes, savedSearches } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const initialQ = searchParams?.get('q') || '';
  const [q, setQ] = useState(initialQ);

  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];

  const { data: searchData, isLoading: isSearchLoading } = useDocumentSearch(q);
  const { data: allData, isLoading: isAllLoading } = useDocuments();

  const baseDocuments = q ? (searchData?.data || []) : (allData?.data || []);
  const isLoading = q ? isSearchLoading : isAllLoading;
  const [facets, setFacets] = useState<Record<string, Set<string>>>({
    cabinet: new Set(),
    type: new Set(),
    status: new Set(),
    confidentiality: new Set(),
    urgency: new Set()
  });

  useEffect(() => {
    setPageTitle('Search');
    // Pre-fill facets from query params if present
    const newFacets = { ...facets };
    let changed = false;
    ['cabinet', 'type', 'status', 'confidentiality', 'urgency'].forEach(key => {
      const val = searchParams?.get(key);
      if (val) {
        newFacets[key].add(val);
        changed = true;
      }
    });
    if (changed) setFacets(newFacets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPageTitle]); // only run once and on title change

  const matches = (d: any) => {
    const status = d.status === 'closed' ? 'Closed' : (d.status === 'in_progress' ? 'In Progress' : 'Pending');
    const type = d.documentType;
    const urgency = d.urgency?.charAt(0).toUpperCase() + d.urgency?.slice(1);
    const confidentiality = d.confidentiality?.charAt(0).toUpperCase() + d.confidentiality?.slice(1);

    if (facets.cabinet.size && !facets.cabinet.has(d.cabinetId)) return false;
    if (facets.type.size && !facets.type.has(type)) return false;
    if (facets.status.size && !facets.status.has(status)) return false;
    if (facets.confidentiality.size && !facets.confidentiality.has(confidentiality)) return false;
    if (facets.urgency.size && !facets.urgency.has(urgency)) return false;
    return true;
  };

  const results = baseDocuments.filter(matches);

  const toggleFacet = (key: string, val: string) => {
    const newFacets = { ...facets };
    if (newFacets[key].has(val)) newFacets[key].delete(val);
    else newFacets[key].add(val);
    setFacets(newFacets);
  };

  const saveSearch = () => {
    let nameVal = '';
    openModal({
      title: 'Save this search',
      body: (
        <div className="field">
          <label>Name</label>
          <input className="input" placeholder="e.g. Overdue finance invoices" defaultValue={q ? `“${q}”` : 'My filter'} onChange={e => nameVal = e.target.value} />
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          kind: 'btn-primary',
          onClick: () => {
            const finalName = nameVal || (q ? `“${q}”` : 'My filter');
            const newSaved = {
              id: 'ss-' + Date.now(),
              name: finalName,
              q,
              facets: Object.fromEntries(Object.entries(facets).map(([k, v]) => [k, Array.from(v)])) as any
            } as any;
            useStore.setState({ savedSearches: [...savedSearches, newSaved] });
            addToast('Search saved', 'success');
          }
        }
      ]
    });
  };

  const applySaved = (ss: any) => {
    setQ(ss.q || '');
    const nf = {
      cabinet: new Set<string>((ss.facets && ss.facets.cabinet) || []),
      type: new Set<string>((ss.facets && ss.facets.type) || []),
      status: new Set<string>((ss.facets && ss.facets.status) || []),
      confidentiality: new Set<string>((ss.facets && ss.facets.confidentiality) || []),
      urgency: new Set<string>((ss.facets && ss.facets.urgency) || [])
    };
    setFacets(nf);
  };

  const group = (title: string, key: string, opts: [string, string][]) => {
    return (
      <div className="facet-group" key={key}>
        <div className="fg-title">{title}</div>
        {opts.map(([val, label]) => {
          const cnt = baseDocuments.filter(d => {
            const saved = new Set(facets[key]);
            facets[key] = new Set();
            
            const status = d.status === 'closed' ? 'Closed' : (d.status === 'in_progress' ? 'In Progress' : 'Pending');
            const type = d.documentType;
            const urgency = d.urgency?.charAt(0).toUpperCase() + d.urgency?.slice(1);
            const confidentiality = d.confidentiality?.charAt(0).toUpperCase() + d.confidentiality?.slice(1);

            let dVal = '';
            if (key === 'status') dVal = status;
            else if (key === 'type') dVal = type;
            else if (key === 'urgency') dVal = urgency;
            else if (key === 'confidentiality') dVal = confidentiality;
            else if (key === 'cabinet') dVal = d.cabinetId;

            const ok = matches(d) && dVal === val;
            facets[key] = saved;
            return ok;
          }).length;
          return (
            <label className="facet-opt" key={val}>
              <input type="checkbox" checked={facets[key].has(val)} onChange={() => toggleFacet(key, val)} />
              {label} <span className="cnt">{cnt}</span>
            </label>
          );
        })}
      </div>
    );
  };

  const CONF_LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted', 'Top Secret'];
  const URG_LEVELS = ['Critical', 'High', 'Normal', 'Low'];
  const STATUSES = ['Pending', 'In Progress', 'On Hold', 'Overdue', 'Closed'];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Search</div>
          <div className="page-sub">Global and semantic search with facets and saved searches.</div>
        </div>
      </div>

      <div className="mb16">
        <input 
          className="input" 
          type="search" 
          value={q} 
          placeholder="Search naturally — e.g. “overdue invoices from Meridian above 10 million”"
          style={{ height: '44px', fontSize: '14px' }}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="search-layout">
        {/* Facets */}
        <div className="card">
          <div className="facet-group">
            <div className="flex jcb aic">
              <span className="fg-title" style={{ marginBottom: 0 }}>Saved searches</span>
              <button className="btn btn-ghost btn-sm" title="Save current search" onClick={saveSearch}>+ Save</button>
            </div>
            {savedSearches.map(ss => (
              <div className="facet-opt" style={{ justifyContent: 'space-between' }} key={ss.id}>
                <a href="#" style={{ fontWeight: 600 }} onClick={(e) => { e.preventDefault(); applySaved(ss); }}>{ss.name}</a>
                <button className="tag" style={{ border: 0, cursor: 'pointer' }} aria-label="Delete saved search" onClick={() => {
                  useStore.setState({ savedSearches: savedSearches.filter(x => x.id !== ss.id) });
                  addToast('Saved search removed', 'info');
                }}>×</button>
              </div>
            ))}
          </div>
          {group('Cabinet', 'cabinet', cabinets.map((c: any) => [c.id, c.name]))}
          {group('Type', 'type', docTypes.map(t => [t, t]))}
          {group('Status', 'status', STATUSES.map(s => [s, s]))}
          {group('Confidentiality', 'confidentiality', CONF_LEVELS.map(l => [l, l]))}
          {group('Urgency', 'urgency', URG_LEVELS.map(l => [l, l]))}
        </div>

        {/* Results */}
        <div>
          <div className="flex jcb aic mb8">
            <span className="muted" style={{ fontSize: '12.5px' }}>
              {results.length} result{results.length === 1 ? '' : 's'}{q ? ` for “${q}”` : ''} · semantic + keyword search across OCR text
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCsv('Search_Results', results)}>Export results</button>
          </div>

          {!results.length ? (
            <div className="card">
              <div className="empty">
                <Icon name="search" size={32} />
                <div className="h3 mt16 mb8">{isLoading ? 'Loading...' : 'No results'}</div>
                <p className="caption mb16">{isLoading ? 'Fetching documents...' : (q ? `Nothing matched “${q}”. Try fewer words, or clear some facets.` : 'Type a query or pick facets on the left.')}</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="rowlist">
                {results.map((d: any) => {
                  const restricted = false; // Mock for now
                  const status = d.status === 'closed' ? 'Closed' : (d.status === 'in_progress' ? 'In Progress' : 'Pending');
                  const confidentiality = d.confidentiality?.charAt(0).toUpperCase() + d.confidentiality?.slice(1);
                  return (
                    <div className="task-row" key={d.id} onClick={() => router.push(`/doc/${d.id}`)} role="button" tabIndex={0}>
                      <div className="task-main">
                        <div className="task-title">
                          {restricted && <span style={{ marginRight: '6px' }}><Icon name="lock" size={12} /></span>}
                          {d.title}
                        </div>
                        <div className="caption" style={{ margin: '4px 0' }}>
                          …{d.documentType} filed in Cabinet · {Object.entries((d as any).metadata || {}).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}…
                        </div>
                        <div className="task-meta">
                          <StatusBadge status={status} />
                          <ConfBadge level={confidentiality} />
                          <span>· {new Date(d.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); router.push(`/doc/${d.id}`); }}>Open</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
