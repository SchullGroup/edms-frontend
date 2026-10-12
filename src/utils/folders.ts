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
