import { describe, it, expect } from 'vitest';

interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
}

// Circular move detector identical to Vaultix logic
function isCircularMove(
  targetFolderId: string | null,
  sourceFolderIds: string[],
  allFolders: FolderItem[]
): boolean {
  if (!targetFolderId) return false; // Root is always safe

  // If moving into oneself
  if (sourceFolderIds.includes(targetFolderId)) return true;

  // Build lookup
  const folderMap = new Map<string, FolderItem>();
  allFolders.forEach(f => folderMap.set(f.id, f));

  // Trace ancestors of target folder
  let current: string | null = targetFolderId;
  while (current) {
    if (sourceFolderIds.includes(current)) {
      return true; // Target is a child/descendant of the source folder
    }
    const parent = folderMap.get(current);
    current = parent?.parent_id || null;
  }

  return false;
}

describe('Vaultix Folder Hierarchy & Move Logic', () => {
  const mockFolders: FolderItem[] = [
    { id: 'f-work', name: 'Work', parent_id: null },
    { id: 'f-projects', name: 'Projects', parent_id: 'f-work' },
    { id: 'f-vaultix', name: 'Vaultix Repo', parent_id: 'f-projects' },
    { id: 'f-personal', name: 'Personal', parent_id: null },
  ];

  it('allows moving folder to Root (parent_id = null)', () => {
    expect(isCircularMove(null, ['f-vaultix'], mockFolders)).toBe(false);
  });

  it('allows moving folder to another non-nested folder', () => {
    expect(isCircularMove('f-personal', ['f-vaultix'], mockFolders)).toBe(false);
  });

  it('blocks moving a folder into itself', () => {
    expect(isCircularMove('f-work', ['f-work'], mockFolders)).toBe(true);
  });

  it('blocks moving a parent folder into any of its own descendants', () => {
    // Cannot move 'Work' into 'Vaultix Repo' (nested descendant)
    expect(isCircularMove('f-vaultix', ['f-work'], mockFolders)).toBe(true);
    // Cannot move 'Work' into 'Projects' (immediate child)
    expect(isCircularMove('f-projects', ['f-work'], mockFolders)).toBe(true);
  });
});
