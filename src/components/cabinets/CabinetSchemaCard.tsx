'use client';

import React from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Table, Column } from '@/components/ui/Table';
import { SkeletonTable } from '@/components/common/Skeleton';
import {
  useCabinet,
  useAddMetadataField,
  useUpdateMetadataField,
  useDeleteMetadataField,
} from '@/apis/hooks/useCabinets';
import type { Cabinet } from '@/types/models';
import { cabinetAllows, useMyCabinetAccess } from './cabinetAccess';

const FIELD_TYPES: { value: 'text' | 'number' | 'date' | 'select' | 'boolean'; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Boolean' },
];

const fieldTypeLabel = (t: string) => FIELD_TYPES.find((f) => f.value === t)?.label || t;

/** Whether the caller may change `cabinet`'s schema at all — callers use this to
 *  decide whether to render the card. Every schema route needs `edit` on the cabinet. */
export function useCanManageSchema(cabinet: Cabinet | null | undefined) {
  const { can } = usePermissions();
  const level = useMyCabinetAccess(cabinet?.id);
  return (
    cabinetAllows(level, 'edit') &&
    (can('cabinet_metadata_field', 'create') ||
      can('cabinet_metadata_field', 'edit') ||
      can('cabinet_metadata_field', 'delete'))
  );
}

/**
 * Metadata schema editor for one cabinet, shared by Cabinet Designer and the
 * Cabinets page. Each action shows only when the caller has both the role
 * permission and `edit` on this cabinet — the two checks the API makes.
 */
export function CabinetSchemaCard({ cabinet }: { cabinet: Cabinet }) {
  const { auditAction } = useStore();
  const { can } = usePermissions();
  const { openModal } = useUIStore();

  const hasEdit = cabinetAllows(useMyCabinetAccess(cabinet.id), 'edit');
  const canCreateField = hasEdit && can('cabinet_metadata_field', 'create');
  const canEditField = hasEdit && can('cabinet_metadata_field', 'edit');
  const canDeleteField = hasEdit && can('cabinet_metadata_field', 'delete');

  // `metadataFields` only comes back on the single-cabinet GET, not the list.
  const { data: detail, isLoading } = useCabinet(cabinet.id);
  const schema = detail?.metadataFields || [];
  const addMetadataField = useAddMetadataField();
  const updateMetadataField = useUpdateMetadataField();
  const deleteMetadataField = useDeleteMetadataField();

  const handleEditField = (r: any) => {
    let fn = r.name;
    let rq = !!r.isRequired;
    openModal({
      title: `Edit field "${r.name}"`,
      body: (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>Field name</label>
            <input
              className="input"
              defaultValue={r.name}
              onChange={(e) => (fn = e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked={rq} onChange={(e) => (rq = e.target.checked)} />
            Required
          </label>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          kind: 'btn-primary',
          onClick: () => {
            if (!fn.trim()) return false;
            return updateMetadataField
              .mutateAsync({
                cabinetId: cabinet.id,
                fieldId: r.id,
                updates: { name: fn.trim(), isRequired: rq },
              })
              .then(() => {
                auditAction('SCHEMA_EDIT', cabinet.id, `Edited field ${fn}`);
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleNewField = () => {
    let fn = '';
    let ft: 'text' | 'number' | 'date' | 'select' | 'boolean' = 'text';
    let rq = false;
    openModal({
      title: 'Add metadata field',
      body: (
        <div>
          <div className="field">
            <label>Field name</label>
            <input
              className="input"
              placeholder="Field name"
              onChange={(e) => (fn = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select
              className="input"
              defaultValue={ft}
              onChange={(e) => (ft = e.target.value as typeof ft)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <label className="check">
            <input type="checkbox" defaultChecked={rq} onChange={(e) => (rq = e.target.checked)} />{' '}
            Required at filing
          </label>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Add field',
          kind: 'btn-primary',
          onClick: () => {
            if (!fn.trim()) return false;
            return addMetadataField
              .mutateAsync({
                cabinetId: cabinet.id,
                data: {
                  name: fn.trim(),
                  fieldType: ft,
                  isRequired: rq,
                  displayOrder: schema.length,
                },
              })
              .then(() => {
                auditAction('SCHEMA_EDIT', cabinet.id, 'Added field ' + fn);
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const cols: Column<any>[] = [
    { key: 'name', label: 'Field', render: (r) => <b>{r.name}</b> },
    { key: 'fieldType', label: 'Type', render: (r) => fieldTypeLabel(r.fieldType) },
    {
      key: 'isRequired',
      label: 'Required',
      render: (r) =>
        r.isRequired ? (
          <span className="badge b-status-overdue">Required</span>
        ) : (
          <span className="badge b-urg-low">Optional</span>
        ),
    },
  ];
  if (canEditField || canDeleteField) {
    cols.push({
      key: 'act',
      label: '',
      render: (r) => (
        <span className="flex gap-2">
          {canEditField && (
            <button className="btn btn-ghost btn-sm" onClick={() => handleEditField(r)}>
              Edit
            </button>
          )}
          {canDeleteField && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                deleteMetadataField.mutate(
                  { cabinetId: cabinet.id, fieldId: r.id },
                  {
                    onSuccess: () => {
                      auditAction('SCHEMA_EDIT', cabinet.id, 'Removed field ' + r.name);
                    },
                  },
                );
              }}
            >
              Remove
            </button>
          )}
        </span>
      ),
    });
  }

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">Metadata schema</span>
        {canCreateField && (
          <button className="btn btn-secondary btn-sm" onClick={handleNewField}>
            + Field
          </button>
        )}
      </div>
      {isLoading ? (
        <SkeletonTable columns={['Field', 'Type', 'Required', '']} rows={3} />
      ) : (
        <Table
          cols={cols}
          rows={schema}
          emptyMsg={
            canCreateField ? 'No custom fields yet — add the first one.' : 'No custom fields yet.'
          }
        />
      )}
    </div>
  );
}
