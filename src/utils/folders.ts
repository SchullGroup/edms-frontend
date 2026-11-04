/*
 * Folder tree helpers. `GET /cabinets/:id/folders` returns a cabinet's folders
 * as one flat list; nesting is each folder's `parentId` (null at the top).
 */

interface FolderLike {
  id: string;
  name: string;
  parentId?: string | null;
}

/** A folder's direct sub-folders (top-level ones when `parentId` is null), by name. */
export function childFolders<T extends FolderLike>(folders: T[], parentId: string | null): T[] {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The folder and its ancestors, outermost first. Stops on a missing parent or a cycle. */
export function folderAncestry<T extends FolderLike>(folders: T[], id: string): T[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: T[] = [];
  let current = byId.get(id);
  while (current && !chain.includes(current)) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** "Finance / Invoices / 2026" — what to call a folder in a flat picker. */
export function folderPathLabel(folders: FolderLike[], id: string): string {
  return folderAncestry(folders, id)
    .map((f) => f.name)
    .join(' / ');
}

/** Every folder in tree order (each parent followed by its sub-folders), with
 *  its path label — for a `<select>` that has to show nesting. */
export function foldersAsPaths<T extends FolderLike>(folders: T[]): (T & { path: string })[] {
  const out: (T & { path: string })[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null) => {
    for (const f of childFolders(folders, parentId)) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ ...f, path: folderPathLabel(folders, f.id) });
      walk(f.id);
    }
  };
  walk(null);
  // Anything whose parent isn't in the list still gets listed.
  for (const f of folders) {
    if (!seen.has(f.id)) out.push({ ...f, path: folderPathLabel(folders, f.id) });
  }
  return out;
}

// --- Folder security (backend `resolveVisibleFolderIds`) ---

const TIER_ORDER = ['public', 'internal', 'confidential', 'restricted', 'top_secret'];

interface SecuredFolderLike extends FolderLike {
  confidentiality?: string | null;
  inheritsPermissions?: boolean;
}

/** The strictest tier on the folder's path, and the folder that sets it. */
export function effectiveFolderTier<T extends SecuredFolderLike>(
  folders: T[],
  id: string,
): { tier: string; from: T } | null {
  let best: { tier: string; from: T } | null = null;
  for (const f of folderAncestry(folders, id)) {
    if (!f.confidentiality) continue;
    if (!best || TIER_ORDER.indexOf(f.confidentiality) > TIER_ORDER.indexOf(best.tier)) {
      best = { tier: f.confidentiality, from: f };
    }
  }
  return best;
}

/** The nearest folder on the path (itself included) that stops inheriting access. */
export function restrictingFolder<T extends SecuredFolderLike>(folders: T[], id: string): T | null {
  const chain = folderAncestry(folders, id);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].inheritsPermissions === false) return chain[i];
  }
  return null;
}

const TIER_LABEL: Record<string, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
  top_secret: 'Top Secret',
};

/** A `<select>` option can't hold a badge, so the tier and custom access go in its text. */
export function folderOptionLabel<T extends SecuredFolderLike>(
  folders: T[],
  f: T & { path: string },
) {
  const tier = effectiveFolderTier(folders, f.id);
  const parts = [f.path];
  if (tier) parts.push(TIER_LABEL[tier.tier] ?? tier.tier);
  if (restrictingFolder(folders, f.id)) parts.push('custom access');
  return parts.join(' · ');
}

/** Turns the API's folder 403s into what the person can do about them. */
export function explainFolderError(message: string): string {
  // POST /documents (requireUploadFolderAccess): no Upload level there, or no clearance for its tier.
  if (/insufficient upload permissions .*folder|insufficient folder permissions/i.test(message)) {
    return "You can't file into this folder: it needs Upload access there and clearance for its confidentiality tier. Choose another folder or ask whoever manages it.";
  }
  return message;
}
