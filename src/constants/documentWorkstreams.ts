import type { DocumentWorkstream } from '@/types/models';

/** Every workstream a document can be filed under, in the backend's order. */
export const WORKSTREAMS: { label: string; value: DocumentWorkstream }[] = [
  { label: 'Financial', value: 'financial' },
  { label: 'Legal', value: 'legal' },
  { label: 'ESG', value: 'esg' },
  { label: 'Operational', value: 'operational' },
  { label: 'Technical', value: 'technical' },
  { label: 'Tax', value: 'tax' },
];

/** Display label for a stored workstream; unknown values show as stored. */
export function workstreamLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return WORKSTREAMS.find((w) => w.value === value)?.label ?? value;
}
