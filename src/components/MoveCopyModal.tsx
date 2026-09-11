import React, { useState } from 'react';
import { Folder, ChevronRight, X, FolderInput, Copy, Check } from 'lucide-react';

export interface FolderNode {
  id: string;
  parent_id: string | null;
  name: string;
}

interface MoveCopyModalProps {
  isOpen: boolean;
  mode: 'move' | 'copy';
  folders: FolderNode[];
  selectedFolderIds: string[];
  selectedCredIds: string[];
  currentFolderId: string | null;
  onClose: () => void;
  onConfirm: (targetFolderId: string | null) => Promise<void>;
}

export default function MoveCopyModal({
  isOpen,
  mode,
  folders,
  selectedFolderIds,
  selectedCredIds,
  currentFolderId,
  onClose,
  onConfirm,
}: MoveCopyModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    currentFolderId !== null ? null : (folders[0]?.id ?? null)
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Calculate descendant IDs for any selected folder to prevent circular moving/copying
  const getDescendantFolderIds = (folderId: string): Set<string> => {
    const descendants = new Set<string>();
    const stack = [folderId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = folders.filter(f => f.parent_id === current);
      for (const child of children) {
        descendants.add(child.id);
        stack.push(child.id);
      }
    }
    return descendants;
  };

  const disallowedFolderIds = new Set<string>();
  for (const id of selectedFolderIds) {
    disallowedFolderIds.add(id);
    const descendants = getDescendantFolderIds(id);
    descendants.forEach(d => disallowedFolderIds.add(d));
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(selectedTargetId);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderFolderOptions = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = folders.filter(f => f.parent_id === parentId);
    if (children.length === 0) return null;

    return children.map(folder => {
      const isDisallowed = disallowedFolderIds.has(folder.id);
      const isSelected = selectedTargetId === folder.id;

      return (
        <div key={folder.id} style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
          <div
            onClick={() => {
              if (!isDisallowed) {
                setSelectedTargetId(folder.id);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.25rem',
              cursor: isDisallowed ? 'not-allowed' : 'pointer',
              backgroundColor: isSelected
                ? 'rgba(13, 148, 136, 0.15)'
                : 'transparent',
              border: `1px solid ${isSelected ? 'var(--accent-teal)' : 'transparent'}`,
              opacity: isDisallowed ? 0.35 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <Folder size={16} color={isDisallowed ? 'var(--text-muted)' : 'var(--accent-teal)'} style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: '0.86rem',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {folder.name}
              </span>
            </div>

            {isSelected && <Check size={16} color="var(--accent-teal)" style={{ flexShrink: 0 }} />}
          </div>

          {renderFolderOptions(folder.id, depth + 1)}
        </div>
      );
    });
  };

  const folderCount = selectedFolderIds.length;
  const credCount = selectedCredIds.length;
  const summaryParts = [];
  if (folderCount > 0) summaryParts.push(`${folderCount} folder${folderCount > 1 ? 's' : ''}`);
  if (credCount > 0) summaryParts.push(`${credCount} credential${credCount > 1 ? 's' : ''}`);
  const itemsSummary = summaryParts.join(' and ');

  const targetName = selectedTargetId === null
    ? 'Home (Root)'
    : folders.find(f => f.id === selectedTargetId)?.name || 'Selected Folder';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        width: '100%',
        maxWidth: '440px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        animation: 'slideUpFade 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'move' ? (
              <FolderInput size={18} color="var(--accent-teal)" />
            ) : (
              <Copy size={18} color="var(--accent-teal)" />
            )}
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {mode === 'move' ? 'Move Items' : 'Copy Items'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Info */}
        <div style={{ padding: '0.85rem 1.25rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Choose a destination folder for <strong style={{ color: 'var(--text-primary)' }}>{itemsSummary || 'item'}</strong>:
          </p>
        </div>

        {/* Folder Hierarchy Tree */}
        <div style={{
          padding: '0.75rem 1.25rem',
          overflowY: 'auto',
          flex: 1,
          maxHeight: '340px'
        }}>
          {/* Home / Root Destination */}
          <div
            onClick={() => setSelectedTargetId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.35rem',
              cursor: 'pointer',
              backgroundColor: selectedTargetId === null
                ? 'rgba(13, 148, 136, 0.15)'
                : 'transparent',
              border: `1px solid ${selectedTargetId === null ? 'var(--accent-teal)' : 'transparent'}`,
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Folder size={16} color="var(--accent-teal)" />
              <span style={{
                fontSize: '0.86rem',
                color: selectedTargetId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: selectedTargetId === null ? 600 : 'normal'
              }}>
                Home (Vault Root)
              </span>
            </div>
            {selectedTargetId === null && <Check size={16} color="var(--accent-teal)" />}
          </div>

          {/* Subfolders */}
          {renderFolderOptions(null, 0)}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            To: <span style={{ color: 'var(--accent-teal)', fontWeight: 500 }}>{targetName}</span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: '0.4rem 0.95rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {mode === 'move' ? <FolderInput size={15} /> : <Copy size={15} />}
              <span>{submitting ? 'Processing...' : (mode === 'move' ? 'Move Here' : 'Copy Here')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
