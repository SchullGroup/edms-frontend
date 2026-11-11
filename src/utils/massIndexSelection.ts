/** A document picked on Search for mass indexing. */
export interface MassIndexItem {
  id: string;
  title: string;
  referenceNumber?: string | null;
  cabinetId: string;
}

const KEY = 'edms.massIndexSelection';

/** Most documents one indexing screen takes: each row loads its metadata separately. */
export const MASS_INDEX_MAX = 100;

/** Hands the selection to `/search/mass-index`. Session storage keeps it across a reload. */
export function saveMassIndexSelection(items: MassIndexItem[]): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function loadMassIndexSelection(): MassIndexItem[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((d) => d?.id && d?.cabinetId) : [];
  } catch {
    return [];
  }
}
