import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { encryptData, decryptData, generateRecoveryPhrase, deriveKeyFromPhrase, wrapDataKey, generateSalt, bufferToBase64 } from '../lib/crypto';
import { saveEncryptedVaultCache, loadEncryptedVaultCache } from '../lib/cache';
import { LogOut, Lock, Folder, Key, Plus, FileText, Download, ChevronRight, FolderPlus, Edit2, Trash2, Upload, Menu, X, Eye, EyeOff, Copy, Check, ShieldAlert, AlertTriangle, Search, ArrowLeft, Fingerprint, Settings as SettingsIcon, Bell, FolderInput, CheckSquare, Square, MoreVertical, Star } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';
import MoveCopyModal from '../components/MoveCopyModal';
import { isBiometricsAvailable, getBiometricConfig, registerBiometrics, disableBiometrics } from '../lib/biometrics';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { getNotificationHistory, markAllNotificationsAsRead, clearNotificationHistory, type AppNotification } from '../lib/notifications';


interface CredentialData {
  title: string; // Required
  email?: string;
  username?: string;
  accountId?: string;
  phone?: string;
  password?: string;
  recoveryContact?: string;
  token?: string;
  apiKey?: string;
  secretKey?: string;
  website?: string;
  notes?: string;
  starred?: boolean;
}

interface DecryptedCredential {
  id: string;
  folder_id: string | null;
  data: CredentialData;
}

interface FolderData {
  id: string;
  parent_id: string | null;
  name: string;
}

export default function Vault() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { dataKey, lockVault } = useVault();
  const { showAlert, showConfirm } = useModal();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folder');

  const setCurrentFolderId = (id: string | null) => {
    if (id) {
      setSearchParams({ folder: id });
    } else {
      setSearchParams({});
    }
  };

  const [credentials, setCredentials] = useState<DecryptedCredential[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);

  // Mobile UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);

  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Biometrics State
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // Regeneration State
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Expanded Credential Fields
  const [formTitle, setFormTitle] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRecoveryContact, setFormRecoveryContact] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formSecretKey, setFormSecretKey] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const [formFolderName, setFormFolderName] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);

  // Active Dropdown Menu State (for three-dots menu)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Notification Center State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  const loadNotifications = useCallback(() => {
    setNotifications(getNotificationHistory());
  }, []);

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener('vaultix-notifications-updated', handleUpdate);
    return () => window.removeEventListener('vaultix-notifications-updated', handleUpdate);
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Multi-Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [selectedCredIds, setSelectedCredIds] = useState<Set<string>>(new Set());

  // Move / Copy Modal State
  const [moveCopyModalOpen, setMoveCopyModalOpen] = useState(false);
  const [moveCopyMode, setMoveCopyMode] = useState<'move' | 'copy'>('move');
  const [moveCopyTargetIds, setMoveCopyTargetIds] = useState<{ folderIds: string[]; credIds: string[] }>({ folderIds: [], credIds: [] });

  // Long press and scroll handling
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const isScrollingRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (type: 'folder' | 'cred', id: string, e: React.TouchEvent) => {
    cancelLongPress();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setSelectionMode(true);
      if (type === 'folder') {
        setSelectedFolderIds(prev => new Set(prev).add(id));
      } else {
        setSelectedCredIds(prev => new Set(prev).add(id));
      }
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Only consider as actual scroll/swipe if movement exceeds 15px
    if (dx > 15 || dy > 15) {
      isScrollingRef.current = true;
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    touchStartPosRef.current = null;
    // Reset scrolling flag shortly after so click can proceed if it was a quick tap
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  const handleMouseDown = (type: 'folder' | 'cred', id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    cancelLongPress();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setSelectionMode(true);
      if (type === 'folder') {
        setSelectedFolderIds(prev => new Set(prev).add(id));
      } else {
        setSelectedCredIds(prev => new Set(prev).add(id));
      }
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
    if (dx > 12 || dy > 12) {
      isScrollingRef.current = true;
      cancelLongPress();
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    touchStartPosRef.current = null;
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  const handleCardClick = (type: 'folder' | 'cred', id: string) => {
    // If user triggered long press, do not fire normal click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    // If user actually scrolled, do not select
    if (isScrollingRef.current) {
      return;
    }

    if (selectionMode) {
      toggleSelectItem(type, id);
    } else {
      if (type === 'folder') {
        handleFolderChange(id);
      }
    }
  };

  const toggleSelectItem = (type: 'folder' | 'cred', id: string) => {
    if (type === 'folder') {
      setSelectedFolderIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedCredIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
    setSelectedCredIds(new Set());
  };

  // Form Visibility States
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showFormToken, setShowFormToken] = useState(false);
  const [showFormApiKey, setShowFormApiKey] = useState(false);
  const [showFormSecretKey, setShowFormSecretKey] = useState(false);

  // View Visibility State: Key format `${credId}_${fieldName}`
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const toggleFieldVisibility = (id: string, field: string) => {
    const key = `${id}_${field}`;
    setVisibleFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopiedAtRef = useRef<number | null>(null);

  const wipeClipboard = useCallback(() => {
    if (!lastCopiedAtRef.current) return;
    navigator.clipboard.writeText('').then(() => {
      lastCopiedAtRef.current = null;
      showToast("Clipboard cleared for security", "info");
    }).catch(() => { });
  }, [showToast]);

  useEffect(() => {
    const checkAndWipeOnReturn = () => {
      if (document.visibilityState === 'visible' && lastCopiedAtRef.current) {
        const elapsed = Date.now() - lastCopiedAtRef.current;
        if (elapsed >= 60000) {
          wipeClipboard();
        }
      }
    };

    const checkRevocation = async () => {
      if (user && document.visibilityState === 'visible') {
        const { isCurrentDeviceValid } = await import('../lib/devices');
        const valid = await isCurrentDeviceValid(user.id);
        if (!valid) {
          navigator.clipboard.writeText('').catch(() => { });
          lockVault();
          signOut();
        }
      }
    };

    window.addEventListener('focus', checkAndWipeOnReturn);
    document.addEventListener('visibilitychange', checkAndWipeOnReturn);
    window.addEventListener('focus', checkRevocation);

    // Heartbeat check every 30 seconds
    const revokeInterval = setInterval(checkRevocation, 30000);

    return () => {
      window.removeEventListener('focus', checkAndWipeOnReturn);
      document.removeEventListener('visibilitychange', checkAndWipeOnReturn);
      window.removeEventListener('focus', checkRevocation);
      clearInterval(revokeInterval);
    };
  }, [wipeClipboard, user, lockVault, signOut]);

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
      showToast("Copied!");

      lastCopiedAtRef.current = Date.now();

      // Clear any previous pending clipboard wipe timer
      if (clipboardTimerRef.current) {
        clearTimeout(clipboardTimerRef.current);
      }

      // After 60 seconds, clear and show toast if still focused
      clipboardTimerRef.current = setTimeout(() => {
        wipeClipboard();
      }, 60000);
    } catch (err) {
      await showAlert({ title: "Clipboard", message: "Failed to copy text to clipboard.", type: "error" });
    }
  };

  const loadData = useCallback(async () => {
    if (!user || !dataKey) return;
    setLoading(true);
    try {
      let credData: any[] = [];
      let folderData: any[] = [];
      let keysData: any = null;

      try {
        const [{ data: cData, error: cErr }, { data: fData, error: fErr }, { data: kData, error: kErr }] = await Promise.all([
          supabase.from('credentials').select('*').eq('user_id', user.id),
          supabase.from('folders').select('*').eq('user_id', user.id),
          supabase.from('wrapped_keys').select('*').eq('user_id', user.id).single()
        ]);

        if (cErr) throw cErr;
        if (fErr) throw fErr;
        if (kErr) throw kErr;

        credData = cData;
        folderData = fData;
        keysData = kData;

        await saveEncryptedVaultCache(user.id, {
          wrapped_keys: keysData,
          folders: folderData,
          credentials: credData
        });
      } catch (fetchErr) {
        console.warn("Offline or Supabase error. Falling back to local cache.");
        const cache = await loadEncryptedVaultCache(user.id);
        if (cache) {
          credData = cache.credentials || [];
          folderData = cache.folders || [];
        } else {
          throw new Error("Offline and no local cache available.");
        }
      }

      const decryptedCreds: DecryptedCredential[] = [];
      for (const item of credData) {
        try {
          const decryptedPayload = await decryptData(item.data_encrypted, item.iv, dataKey);
          decryptedCreds.push({
            id: item.id,
            folder_id: item.folder_id,
            data: decryptedPayload as CredentialData
          });
        } catch (e) {
          console.error("Failed to decrypt cred", item.id);
        }
      }
      setCredentials(decryptedCreds);

      const decryptedFolders: FolderData[] = [];
      for (const f of folderData) {
        try {
          const decryptedPayload = await decryptData(f.name_encrypted, f.iv, dataKey);
          decryptedFolders.push({
            id: f.id,
            parent_id: f.parent_id,
            name: decryptedPayload.name
          });
        } catch (e) {
          console.error("Failed to decrypt folder", f.id);
        }
      }
      setFolders(decryptedFolders);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, dataKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    async function checkBio() {
      if (!user) return;
      const available = await isBiometricsAvailable();
      setBiometricsAvailable(available);
      const config = getBiometricConfig(user.id);
      setBiometricsEnabled(!!config?.enabled);
    }
    checkBio();
  }, [user]);

  const handleToggleBiometrics = async () => {
    if (!user) return;
    if (biometricsEnabled) {
      const confirmed = await showConfirm({
        title: "Disable Biometrics",
        message: "Are you sure you want to disable biometric verification on this device?",
        confirmText: "Disable",
        isDestructive: true
      });
      if (confirmed) {
        disableBiometrics(user.id);
        setBiometricsEnabled(false);
        showToast("Device biometrics disabled", "info");
      }
    } else {
      try {
        await registerBiometrics(user.id, user.email || "user@vaultix");
        setBiometricsEnabled(true);
        showToast("Device biometrics enabled", "success");
      } catch (err: any) {
        await showAlert({
          title: "Biometrics Failed",
          message: err.message || "Failed to enable biometrics.",
          type: "error"
        });
      }
    }
  };


  // --- CREDENTIAL CRUD ---

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dataKey || !formTitle) return;

    // Build payload, omit empty fields to save space
    const payload: CredentialData = { title: formTitle };
    if (formEmail) payload.email = formEmail;
    if (formUsername) payload.username = formUsername;
    if (formAccountId) payload.accountId = formAccountId;
    if (formPhone) payload.phone = formPhone;
    if (formPassword) payload.password = formPassword;
    if (formRecoveryContact) payload.recoveryContact = formRecoveryContact;
    if (formToken) payload.token = formToken;
    if (formApiKey) payload.apiKey = formApiKey;
    if (formSecretKey) payload.secretKey = formSecretKey;
    if (formWebsite) payload.website = formWebsite;
    if (formNotes) payload.notes = formNotes;

    // Preserve existing starred status if editing
    if (editingCredId) {
      const existing = credentials.find(c => c.id === editingCredId);
      if (existing?.data?.starred) {
        payload.starred = true;
      }
    }

    try {
      const { cipherTextBase64, ivBase64 } = await encryptData(payload, dataKey);

      const isUpdating = !!editingCredId;

      if (editingCredId) {
        const { error } = await supabase.from('credentials').update({
          data_encrypted: cipherTextBase64,
          iv: ivBase64,
        }).eq('id', editingCredId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('credentials').insert({
          user_id: user.id,
          data_encrypted: cipherTextBase64,
          iv: ivBase64,
          folder_id: currentFolderId
        });
        if (error) throw error;
      }

      setShowAddForm(false);
      setEditingCredId(null);
      resetForms();
      await loadData();
      showToast(isUpdating ? "Credential updated" : "Credential saved", "success");

      // Send native security notification
      const { sendNotification } = await import('../lib/notifications');
      sendNotification(
        isUpdating ? 'Vaultix: Credential Updated' : 'Vaultix: Credential Created',
        `"${payload.title}" was ${isUpdating ? 'updated' : 'saved'} in your vault.`
      );
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Save Failed", message: "Failed to save credential.", type: "error" });
    }
  };

  const handleToggleStar = async (cred: DecryptedCredential, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user || !dataKey) return;

    const newStarred = !cred.data.starred;
    const updatedData: CredentialData = {
      ...cred.data,
      starred: newStarred
    };

    try {
      const { cipherTextBase64, ivBase64 } = await encryptData(updatedData, dataKey);
      const { error } = await supabase.from('credentials').update({
        data_encrypted: cipherTextBase64,
        iv: ivBase64
      }).eq('id', cred.id);

      if (error) throw error;
      await loadData();
      showToast(newStarred ? "Added to Starred" : "Removed from Starred", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update starred status", "error");
    }
  };

  const handleDeleteCredential = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm({
      title: "Delete Credential",
      message: "Are you sure you want to delete this credential? This cannot be undone.",
      confirmText: "Delete",
      isDestructive: true
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) throw error;
      await loadData();
      showToast("Credential deleted", "info");

      // Send native security notification
      const { sendNotification } = await import('../lib/notifications');
      sendNotification('Vaultix: Credential Deleted', 'A credential was removed from your vault.');
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Delete Failed", message: "Failed to delete credential.", type: "error" });
    }
  };

  const startEditCredential = (cred: DecryptedCredential, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormTitle(cred.data.title || '');
    setFormEmail(cred.data.email || '');
    setFormUsername(cred.data.username || '');
    setFormAccountId(cred.data.accountId || '');
    setFormPhone(cred.data.phone || '');
    setFormPassword(cred.data.password || '');
    setFormRecoveryContact(cred.data.recoveryContact || '');
    setFormToken(cred.data.token || '');
    setFormApiKey(cred.data.apiKey || '');
    setFormSecretKey(cred.data.secretKey || '');
    setFormWebsite(cred.data.website || '');
    setFormNotes(cred.data.notes || '');

    setEditingCredId(cred.id);
    setShowAddForm(true);
    setShowFolderForm(false);
  };

  // --- FOLDER CRUD ---

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dataKey || !formFolderName) return;

    try {
      const { cipherTextBase64, ivBase64 } = await encryptData({ name: formFolderName }, dataKey);

      if (editingFolderId) {
        const { error } = await supabase.from('folders').update({
          name_encrypted: cipherTextBase64,
          iv: ivBase64,
        }).eq('id', editingFolderId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('folders').insert({
          user_id: user.id,
          name_encrypted: cipherTextBase64,
          iv: ivBase64,
          parent_id: currentFolderId
        });
        if (error) throw error;
      }

      const isRenaming = !!editingFolderId;

      setShowFolderForm(false);
      setEditingFolderId(null);
      resetForms();
      await loadData();
      showToast(isRenaming ? "Folder renamed" : "Folder created", "success");
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Save Failed", message: "Failed to save folder.", type: "error" });
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const hasChildFolders = folders.some(f => f.parent_id === id);
    const hasChildCreds = credentials.some(c => c.folder_id === id);

    if (hasChildFolders || hasChildCreds) {
      await showAlert({
        title: "Folder Not Empty",
        message: "Cannot delete this folder because it contains items or subfolders. Please delete or move all items first.",
        type: "warning"
      });
      return;
    }

    const confirmed = await showConfirm({
      title: "Delete Folder",
      message: "Are you sure you want to delete this folder?",
      confirmText: "Delete",
      isDestructive: true
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
      if (currentFolderId === id) setCurrentFolderId(null);
      await loadData();
      showToast("Folder deleted", "info");
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Delete Failed", message: "Failed to delete folder.", type: "error" });
    }
  };

  const startEditFolder = (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormFolderName(folder.name);
    setEditingFolderId(folder.id);
    setShowFolderForm(true);
    setShowAddForm(false);
  };

  // --- MOVE & COPY LOGIC ---

  const openMoveModalForItems = (folderIds: string[], credIds: string[]) => {
    setMoveCopyTargetIds({ folderIds, credIds });
    setMoveCopyMode('move');
    setMoveCopyModalOpen(true);
  };

  const openCopyModalForItems = (folderIds: string[], credIds: string[]) => {
    setMoveCopyTargetIds({ folderIds, credIds });
    setMoveCopyMode('copy');
    setMoveCopyModalOpen(true);
  };

  const handleExecuteMoveCopy = async (targetFolderId: string | null) => {
    if (!user || !dataKey) return;
    const { folderIds, credIds } = moveCopyTargetIds;

    if (moveCopyMode === 'move') {
      // 1. Move credentials
      if (credIds.length > 0) {
        const { error: credErr } = await supabase
          .from('credentials')
          .update({ folder_id: targetFolderId })
          .in('id', credIds);
        if (credErr) throw credErr;
      }

      // 2. Move folders
      if (folderIds.length > 0) {
        const { error: fErr } = await supabase
          .from('folders')
          .update({ parent_id: targetFolderId })
          .in('id', folderIds);
        if (fErr) throw fErr;
      }

      await loadData();
      exitSelectionMode();
      showToast("Items moved successfully", "success");

      const { sendNotification } = await import('../lib/notifications');
      sendNotification('Vaultix: Items Moved', `${credIds.length + folderIds.length} item(s) moved to new folder.`);
    } else {
      // COPY MODE
      // 1. Copy credentials
      for (const credId of credIds) {
        const original = credentials.find(c => c.id === credId);
        if (original) {
          const newPayload: CredentialData = {
            ...original.data,
            title: `${original.data.title} (Copy)`
          };
          const { cipherTextBase64, ivBase64 } = await encryptData(newPayload, dataKey);
          const { error } = await supabase.from('credentials').insert({
            user_id: user.id,
            folder_id: targetFolderId,
            data_encrypted: cipherTextBase64,
            iv: ivBase64
          });
          if (error) console.error("Failed copying cred", error);
        }
      }

      // 2. Recursive folder copy helper
      const copyFolderTree = async (srcFolderId: string, destParentId: string | null) => {
        const srcFolder = folders.find(f => f.id === srcFolderId);
        if (!srcFolder) return;

        const copyName = `${srcFolder.name} (Copy)`;
        const { cipherTextBase64, ivBase64 } = await encryptData({ name: copyName }, dataKey);

        const { data: newFolder, error: fErr } = await supabase
          .from('folders')
          .insert({
            user_id: user.id,
            parent_id: destParentId,
            name_encrypted: cipherTextBase64,
            iv: ivBase64
          })
          .select()
          .single();

        if (fErr || !newFolder) {
          console.error("Error copying folder", fErr);
          return;
        }

        // Copy credentials in this folder
        const childCreds = credentials.filter(c => c.folder_id === srcFolderId);
        for (const c of childCreds) {
          const { cipherTextBase64: cCipher, ivBase64: cIv } = await encryptData(c.data, dataKey);
          await supabase.from('credentials').insert({
            user_id: user.id,
            folder_id: newFolder.id,
            data_encrypted: cCipher,
            iv: cIv
          });
        }

        // Recursively copy child folders
        const childFolders = folders.filter(f => f.parent_id === srcFolderId);
        for (const child of childFolders) {
          await copyFolderTree(child.id, newFolder.id);
        }
      };

      for (const fId of folderIds) {
        await copyFolderTree(fId, targetFolderId);
      }

      await loadData();
      exitSelectionMode();
      showToast("Items copied successfully", "success");

      const { sendNotification } = await import('../lib/notifications');
      sendNotification('Vaultix: Items Copied', `${credIds.length + folderIds.length} item(s) copied.`);
    }
  };

  const handleBatchDelete = async () => {
    const totalCount = selectedFolderIds.size + selectedCredIds.size;
    if (totalCount === 0) return;

    // Check if any selected folder is not empty and its contents are NOT fully in the selection
    const allFolderIdsToDelete = new Set(selectedFolderIds);
    // Find all descendants of selected folders
    const stack = Array.from(selectedFolderIds);
    while (stack.length > 0) {
      const parent = stack.pop()!;
      const children = folders.filter(f => f.parent_id === parent);
      for (const child of children) {
        allFolderIdsToDelete.add(child.id);
        stack.push(child.id);
      }
    }

    const hasExternalCred = credentials.some(c => c.folder_id && allFolderIdsToDelete.has(c.folder_id) && !selectedCredIds.has(c.id));
    const hasExternalFolder = folders.some(f => f.parent_id && allFolderIdsToDelete.has(f.parent_id) && !selectedFolderIds.has(f.id));

    if (hasExternalCred || hasExternalFolder) {
      const confirmedWithContents = await showConfirm({
        title: `Delete ${totalCount} Item${totalCount > 1 ? 's' : ''}`,
        message: `Some selected folders contain credentials or subfolders. Deleting them will permanently remove all items inside them. Are you sure?`,
        confirmText: "Delete Everything",
        type: "warning",
        isDestructive: true
      });
      if (!confirmedWithContents) return;
    } else {
      const confirmed = await showConfirm({
        title: `Delete ${totalCount} Item${totalCount > 1 ? 's' : ''}`,
        message: `Are you sure you want to permanently delete ${totalCount} selected item${totalCount > 1 ? 's' : ''}?`,
        confirmText: "Delete",
        type: "warning",
        isDestructive: true
      });
      if (!confirmed) return;
    }

    try {
      if (selectedCredIds.size > 0) {
        await supabase.from('credentials').delete().in('id', Array.from(selectedCredIds));
      }
      if (allFolderIdsToDelete.size > 0) {
        // Delete credentials in descendant folders first
        await supabase.from('credentials').delete().in('folder_id', Array.from(allFolderIdsToDelete));
        await supabase.from('folders').delete().in('id', Array.from(allFolderIdsToDelete));
      }

      exitSelectionMode();
      await loadData();
      showToast(`${totalCount} item${totalCount > 1 ? 's' : ''} deleted`, "info");
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Delete Failed", message: "Failed to delete selected items.", type: "error" });
    }
  };

  const resetForms = () => {
    setFormTitle('');
    setFormEmail('');
    setFormUsername('');
    setFormAccountId('');
    setFormPhone('');
    setFormPassword('');
    setFormRecoveryContact('');
    setFormToken('');
    setFormApiKey('');
    setFormSecretKey('');
    setFormWebsite('');
    setFormNotes('');

    setFormFolderName('');

    setEditingCredId(null);
    setEditingFolderId(null);

    setShowFormPassword(false);
    setShowFormToken(false);
    setShowFormApiKey(false);
    setShowFormSecretKey(false);
  };

  const exportBackup = async () => {
    if (!user) return;
    try {
      await loadData();
      const cache = await loadEncryptedVaultCache(user.id);
      if (!cache) throw new Error("No local data found to backup");

      const backup = {
        version: "1.0",
        export_date: new Date().toISOString(),
        user_id: user.id,
        wrapped_keys: cache.wrapped_keys,
        folders: cache.folders,
        credentials: cache.credentials
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaultix-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup exported", "success");
    } catch (err) {
      console.error("Backup failed", err);
      await showAlert({ title: "Backup Failed", message: "Failed to generate encrypted backup file.", type: "error" });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const confirmed = await showConfirm({
      title: "Import Backup",
      message: "Importing a backup will merge matching credentials and restore your folders into Supabase. Do you want to proceed?",
      confirmText: "Import",
      type: "info"
    });

    if (!confirmed) {
      if (e.target) e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const { restoreBackup } = await import('../lib/backup');
      await restoreBackup(backupData, user.id);

      await loadData();
      showToast("Backup restored successfully", "success");
    } catch (err: any) {
      await showAlert({ title: "Restore Failed", message: err.message || 'Failed to restore backup.', type: "error" });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRegeneratePhrase = async () => {
    if (!user || !dataKey) return;

    const confirmed = await showConfirm({
      title: "Regenerate Recovery Phrase",
      message: "Generating a new phrase will instantly invalidate your old recovery phrase. Are you sure you want to continue?",
      confirmText: "Regenerate",
      type: "warning",
      isDestructive: true
    });

    if (!confirmed) return;

    setIsRegenerating(true);
    try {
      const phrase = generateRecoveryPhrase();
      const salt = generateSalt();
      const recoveryKek = await deriveKeyFromPhrase(phrase, salt);
      const wrappedDataKey = await wrapDataKey(dataKey, recoveryKek);

      const { error } = await supabase
        .from('wrapped_keys')
        .update({
          recovery_phrase_salt: bufferToBase64(salt),
          wrapped_data_key_rp: wrappedDataKey.wrappedKeyBase64
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setNewRecoveryPhrase(phrase);
      await loadData();
      showToast("Recovery phrase updated", "success");
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Regeneration Failed", message: "Failed to regenerate recovery phrase.", type: "error" });
      setIsRegenerating(false);
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const displayedCredentials = credentials.filter(c => {
    if (filterStarredOnly && !c.data.starred) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      // Flatten view for search
      const q = searchQuery.toLowerCase();
      const title = (c.data.title || '').toLowerCase();
      const username = (c.data.username || '').toLowerCase();
      return title.includes(q) || username.includes(q);
    }
    // When viewing starred only, show all starred items across vault
    if (filterStarredOnly) {
      return true;
    }
    return c.folder_id === currentFolderId;
  });
  const displayedFolders = (searchQuery.trim() !== '' || filterStarredOnly) ? [] : folders.filter(f => f.parent_id === currentFolderId);

  const handleFolderChange = (id: string | null) => {
    setFilterStarredOnly(false);
    setCurrentFolderId(id);
    setShowAddForm(false);
    setShowFolderForm(false);
    resetForms();
  };

  const getBreadcrumbTrail = (folderId: string | null) => {
    const trail = [];
    let current = folders.find(f => f.id === folderId);
    while (current) {
      trail.unshift(current);
      current = folders.find(f => f.id === current?.parent_id);
    }
    return trail;
  };

  const handleNavigateBack = () => {
    if (currentFolderId) {
      const current = folders.find(f => f.id === currentFolderId);
      if (current) {
        handleFolderChange(current.parent_id);
      }
    }
  };

  const renderTree = (parentId: string | null, depth = 0) => {
    const children = folders.filter(f => f.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <div style={{ marginLeft: depth > 0 ? '1rem' : '0' }}>
        {children.map(f => (
          <div key={f.id}>
            <div
              onClick={() => { handleFolderChange(f.id); setSidebarOpen(false); }}
              style={{
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: currentFolderId === f.id ? 'var(--bg-tertiary)' : 'transparent',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Folder size={16} color="var(--accent-teal)" /> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </div>
            {renderTree(f.id, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  const renderField = (id: string, label: string, value: string | undefined) => {
    if (!value) return null;
    const fieldId = `${id}_${label}`;
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', wordBreak: 'break-all' }}>
          <span style={{ paddingRight: '0.5rem' }}>{value}</span>
          <button onClick={() => copyToClipboard(value, fieldId)} style={{ color: copiedField === fieldId ? 'var(--success-color)' : 'var(--text-muted)', flexShrink: 0 }} title={`Copy ${label}`}>
            {copiedField === fieldId ? <Check size={14} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    );
  };

  // Helper to render sensitive fields with masking
  const renderSensitiveField = (id: string, fieldName: string, label: string, value: string | undefined) => {
    if (!value) return null;
    const fieldId = `${id}_${fieldName}`;
    const isVisible = visibleFields[fieldId];
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-all', paddingRight: '0.5rem' }}>
            <span>{isVisible ? value : '••••••••'}</span>
            <button onClick={() => toggleFieldVisibility(id, fieldName)} style={{ color: 'var(--text-muted)' }} title={isVisible ? "Hide" : "Show"}>
              {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={() => copyToClipboard(value, fieldId)} style={{ color: copiedField === fieldId ? 'var(--success-color)' : 'var(--text-muted)', flexShrink: 0 }} title={`Copy ${label}`}>
            {copiedField === fieldId ? <Check size={14} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="vault-layout">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div className={`vault-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', fontWeight: 'bold', fontSize: '1.25rem' }}>
            <ShieldIcon /> Vaultix
          </div>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          <div
            onClick={() => { handleFolderChange(null); setSidebarOpen(false); }}
            style={{
              padding: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: (currentFolderId === null && !filterStarredOnly) ? 'var(--bg-tertiary)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.5rem'
            }}
          >
            <Folder size={18} /> Home
          </div>

          {renderTree(null)}
        </div>

        <div>
          <button
            onClick={() => { setSidebarOpen(false); navigate('/settings'); }}
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <SettingsIcon size={16} /> Settings & Security
          </button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm({
                title: "Lock Vault",
                message: "Are you sure you want to lock your vault now?",
                confirmText: "Lock",
                cancelText: "Stay"
              });
              if (confirmed) {
                navigator.clipboard.writeText('').catch(() => { });
                lockVault();
              }
            }}
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Lock size={16} /> Lock Vault
          </button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm({
                title: "Sign out",
                message: "Are you sure you want to sign out of your account?",
                confirmText: "Sign out",
                cancelText: "Cancel"
              });
              if (confirmed) {
                navigator.clipboard.writeText('').catch(() => { });
                signOut();
              }
            }}
            style={{ width: '100%', padding: '0.5rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="vault-main">

        {/* Top Header Bar with Breadcrumb and Notification Bell */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          minHeight: '40px'
        }}>

          {/* Breadcrumb / Navigation - horizontally scrollable without overflowing */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-secondary)',
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
            fontSize: '0.88rem'
          }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-primary)', flexShrink: 0, marginRight: '0.2rem' }}>
              <Menu size={22} />
            </button>

            {currentFolderId && (
              <button
                onClick={handleNavigateBack}
                style={{
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingRight: '0.4rem',
                  borderRight: '1px solid var(--border-color)',
                  marginRight: '0.3rem',
                  flexShrink: 0,
                  background: 'none',
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeft: 'none',
                  cursor: 'pointer'
                }}
                title="Back to parent folder"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            <span
              onClick={() => handleFolderChange(null)}
              style={{
                cursor: 'pointer',
                color: currentFolderId === null ? 'var(--text-primary)' : 'inherit',
                fontWeight: currentFolderId === null ? 600 : 'normal',
                flexShrink: 0
              }}
            >
              Home
            </span>

            {getBreadcrumbTrail(currentFolderId).map((f, index, arr) => (
              <React.Fragment key={f.id}>
                <ChevronRight size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span
                  onClick={() => handleFolderChange(f.id)}
                  style={{
                    cursor: 'pointer',
                    color: index === arr.length - 1 ? 'var(--text-primary)' : 'inherit',
                    fontWeight: index === arr.length - 1 ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {f.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Top-Right Notification Bell: ONLY shown on Home page (currentFolderId === null) so subfolder breadcrumbs get full space */}
          {currentFolderId === null && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => navigate('/notifications')}
                title="Security Notifications"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: unreadCount > 0 ? 'var(--accent-teal)' : 'var(--text-secondary)',
                  position: 'relative',
                  backgroundColor: 'var(--bg-secondary)',
                  flexShrink: 0
                }}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 'bold',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--bg-primary)'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Search Bar & Filter Chips */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search credentials by title or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'var(--bg-tertiary)' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setFilterStarredOnly(false)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: !filterStarredOnly ? 600 : 400,
                border: '1px solid',
                borderColor: !filterStarredOnly ? 'var(--accent-teal)' : 'var(--border-color)',
                backgroundColor: !filterStarredOnly ? 'rgba(13, 148, 136, 0.15)' : 'transparent',
                color: !filterStarredOnly ? 'var(--accent-teal)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>All Items</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStarredOnly(!filterStarredOnly)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: filterStarredOnly ? 600 : 400,
                border: '1px solid',
                borderColor: filterStarredOnly ? '#f59e0b' : 'var(--border-color)',
                backgroundColor: filterStarredOnly ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: filterStarredOnly ? '#f59e0b' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Star size={13} fill={filterStarredOnly ? "#f59e0b" : "none"} color="#f59e0b" />
              <span>Starred</span>
              {credentials.filter(c => c.data.starred).length > 0 && (
                <span style={{
                  fontSize: '0.7rem',
                  backgroundColor: filterStarredOnly ? '#f59e0b' : 'rgba(245, 158, 11, 0.2)',
                  color: filterStarredOnly ? '#000' : '#f59e0b',
                  borderRadius: '10px',
                  padding: '0 5px',
                  fontWeight: 'bold'
                }}>
                  {credentials.filter(c => c.data.starred).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Selection Bar or Standard Action Buttons */}
        {selectionMode ? (
          <div style={{
            position: 'sticky',
            top: '0',
            zIndex: 35,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent-teal)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.45rem 0.65rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            {/* Left: Close + Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <button
                onClick={exitSelectionMode}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center' }}
                title="Cancel selection"
              >
                <X size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {selectedFolderIds.size + selectedCredIds.size} <span className="selection-label-text">selected</span>
              </span>
            </div>

            {/* Right Actions: All in a single non-wrapping row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              {/* Select All / Deselect All */}
              <button
                onClick={() => {
                  const allFolderIds = displayedFolders.map(f => f.id);
                  const allCredIds = displayedCredentials.map(c => c.id);
                  const isAllSelected = selectedFolderIds.size === allFolderIds.length && selectedCredIds.size === allCredIds.length;
                  if (isAllSelected) {
                    setSelectedFolderIds(new Set());
                    setSelectedCredIds(new Set());
                  } else {
                    setSelectedFolderIds(new Set(allFolderIds));
                    setSelectedCredIds(new Set(allCredIds));
                  }
                }}
                className="btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                title={(selectedFolderIds.size === displayedFolders.length && selectedCredIds.size === displayedCredentials.length) ? 'Deselect All' : 'Select All'}
              >
                <CheckSquare size={13} />
                <span className="selection-btn-text">
                  {(selectedFolderIds.size === displayedFolders.length && selectedCredIds.size === displayedCredentials.length)
                    ? 'Deselect'
                    : 'All'}
                </span>
              </button>

              {/* Move ({N}) */}
              <button
                onClick={() => openMoveModalForItems(Array.from(selectedFolderIds), Array.from(selectedCredIds))}
                disabled={selectedFolderIds.size + selectedCredIds.size === 0}
                className="btn-secondary"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.74rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: (selectedFolderIds.size + selectedCredIds.size > 0) ? 1 : 0.4
                }}
                title="Move selected"
              >
                <FolderInput size={13} color="var(--accent-teal)" />
                <span className="selection-btn-text">Move</span>
              </button>

              {/* Copy ({N}) */}
              <button
                onClick={() => openCopyModalForItems(Array.from(selectedFolderIds), Array.from(selectedCredIds))}
                disabled={selectedFolderIds.size + selectedCredIds.size === 0}
                className="btn-secondary"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.74rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: (selectedFolderIds.size + selectedCredIds.size > 0) ? 1 : 0.4
                }}
                title="Copy selected"
              >
                <Copy size={13} color="var(--accent-teal)" />
                <span className="selection-btn-text">Copy</span>
              </button>

              {/* Delete ({N}) */}
              <button
                onClick={handleBatchDelete}
                disabled={selectedFolderIds.size + selectedCredIds.size === 0}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.74rem',
                  cursor: (selectedFolderIds.size + selectedCredIds.size > 0) ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.1rem',
                  opacity: (selectedFolderIds.size + selectedCredIds.size > 0) ? 1 : 0.4
                }}
                title="Delete selected"
              >
                <Trash2 size={13} />
                <span className="selection-btn-text"></span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: (displayedFolders.length > 0 || displayedCredentials.length > 0) ? '1fr 1fr auto' : '1fr 1fr',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            alignItems: 'stretch'
          }}>
            <button
              onClick={() => { resetForms(); setShowAddForm(true); setShowFolderForm(false); }}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.65rem',
                fontSize: '0.82rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={15} />
              <span>Add Credential</span>
            </button>

            <button
              onClick={() => { resetForms(); setShowFolderForm(true); setShowAddForm(false); }}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem 0.65rem',
                fontSize: '0.82rem',
                whiteSpace: 'nowrap'
              }}
            >
              <FolderPlus size={15} />
              <span>New Folder</span>
            </button>

            {(displayedFolders.length > 0 || displayedCredentials.length > 0) && (
              <button
                onClick={() => setSelectionMode(true)}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap'
                }}
                title="Select multiple items"
              >
                <CheckSquare size={15} />
                <span>Select</span>
              </button>
            )}
          </div>
        )}

        {/* Forms */}
        {showFolderForm && (
          <form onSubmit={handleSaveFolder} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
            <h3>{editingFolderId ? 'Rename Folder' : 'New Folder'}</h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Folder Name" required value={formFolderName} onChange={e => setFormFolderName(e.target.value)} style={{ flex: '1 1 200px' }} />
              <button type="submit" className="btn-primary" style={{ flex: '1 1 auto' }}>{editingFolderId ? 'Rename' : 'Create'}</button>
              <button type="button" onClick={() => { setShowFolderForm(false); resetForms(); }} className="btn-secondary" style={{ flex: '1 1 auto' }}>Cancel</button>
            </div>
          </form>
        )}

        {showAddForm && (
          <form onSubmit={handleSaveCredential} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
            <h3>{editingCredId ? 'Edit Credential' : `New Credential ${currentFolder ? `in ${currentFolder.name}` : 'in Home'}`}</h3>

            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Title / Name *</label>
                <input type="text" placeholder="e.g. Gmail, AWS Console" required value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Username</label>
                <input type="text" placeholder="Username" value={formUsername} onChange={e => setFormUsername(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</label>
                <input type="email" placeholder="Email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showFormPassword ? "text" : "password"} placeholder="Password" value={formPassword} onChange={e => setFormPassword(e.target.value)} style={{ paddingRight: '2.5rem', width: '100%' }} />
                  <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    {showFormPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrength password={formPassword} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Website URL</label>
                <input type="url" placeholder="https://example.com" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Account ID / Customer ID</label>
                <input type="text" placeholder="Account ID" value={formAccountId} onChange={e => setFormAccountId(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone Number</label>
                <input type="tel" placeholder="Phone Number" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recovery Contact (Email/Phone)</label>
                <input type="text" placeholder="Recovery Info" value={formRecoveryContact} onChange={e => setFormRecoveryContact(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Token</label>
                <div style={{ position: 'relative' }}>
                  <input type={showFormToken ? "text" : "password"} placeholder="Token" value={formToken} onChange={e => setFormToken(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowFormToken(!showFormToken)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    {showFormToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>API Key</label>
                <div style={{ position: 'relative' }}>
                  <input type={showFormApiKey ? "text" : "password"} placeholder="API Key" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowFormApiKey(!showFormApiKey)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    {showFormApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Secret Key</label>
                <div style={{ position: 'relative' }}>
                  <input type={showFormSecretKey ? "text" : "password"} placeholder="Secret Key" value={formSecretKey} onChange={e => setFormSecretKey(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowFormSecretKey(!showFormSecretKey)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    {showFormSecretKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Notes</label>
                <textarea placeholder="Additional secure notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => { setShowAddForm(false); resetForms(); }} className="btn-secondary" style={{ flex: '1 1 auto' }}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ flex: '1 1 auto' }}>{editingCredId ? 'Save Changes' : 'Save Encrypted'}</button>
            </div>
          </form>
        )}

        {/* Content List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>Decrypting vault...</div>
        ) : (displayedCredentials.length === 0 && displayedFolders.length === 0) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem' }}>
            {filterStarredOnly ? (
              <>
                <Star size={48} color="#f59e0b" style={{ opacity: 0.35, marginBottom: '0.75rem', margin: '0 auto' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Starred Credentials</p>
                <p style={{ fontSize: '0.84rem' }}>Tap the star icon on any credential to add it to your favorites.</p>
              </>
            ) : (
              <>
                <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem', margin: '0 auto' }} />
                <p>This folder is empty.</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {/* Render subfolders */}
            {displayedFolders.map(folder => {
              const isSelected = selectedFolderIds.has(folder.id);

              return (
                <div
                  key={folder.id}
                  onTouchStart={(e) => handleTouchStart('folder', folder.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={cancelLongPress}
                  onMouseDown={(e) => handleMouseDown('folder', folder.id, e)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={cancelLongPress}
                  onClick={() => handleCardClick('folder', folder.id)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'var(--bg-secondary)',
                    padding: '1rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 'bold', maxWidth: '65%', minWidth: 0 }}>
                    {selectionMode && (
                      <div style={{ color: isSelected ? 'var(--accent-teal)' : 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                      </div>
                    )}
                    <Folder size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.92rem' }}>{folder.name}</span>
                  </div>

                  {!selectionMode && (
                    <div style={{ position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === `folder_${folder.id}` ? null : `folder_${folder.id}`);
                        }}
                        style={{
                          color: 'var(--text-muted)',
                          padding: '0.35rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 'var(--radius-sm)'
                        }}
                        title="Folder options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === `folder_${folder.id}` && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '0.25rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            zIndex: 40,
                            minWidth: '140px',
                            padding: '0.35rem',
                            animation: 'fadeIn 0.15s ease-out'
                          }}
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              openMoveModalForItems([folder.id], []);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'left'
                            }}
                            className="dropdown-item-hover"
                          >
                            <FolderInput size={14} color="var(--accent-teal)" />
                            <span>Move</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              openCopyModalForItems([folder.id], []);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'left'
                            }}
                            className="dropdown-item-hover"
                          >
                            <Copy size={14} color="var(--accent-teal)" />
                            <span>Copy</span>
                          </button>

                          <button
                            onClick={(e) => {
                              setActiveMenuId(null);
                              startEditFolder(folder, e);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'left'
                            }}
                            className="dropdown-item-hover"
                          >
                            <Edit2 size={14} />
                            <span>Rename</span>
                          </button>

                          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />

                          <button
                            onClick={(e) => {
                              setActiveMenuId(null);
                              handleDeleteFolder(folder.id, e);
                            }}
                            style={{
                              width: '100%',
                              padding: '0.45rem 0.65rem',
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'left'
                            }}
                            className="dropdown-item-hover"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render credentials */}
            {displayedCredentials.map(cred => {
              const isSelected = selectedCredIds.has(cred.id);

              return (
                <div
                  key={cred.id}
                  onTouchStart={(e) => handleTouchStart('cred', cred.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={cancelLongPress}
                  onMouseDown={(e) => handleMouseDown('cred', cred.id, e)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={cancelLongPress}
                  onClick={() => handleCardClick('cred', cred.id)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'var(--bg-secondary)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                    cursor: selectionMode ? 'pointer' : 'default',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 'bold', maxWidth: '70%' }}>
                      {selectionMode && (
                        <div style={{ color: isSelected ? 'var(--accent-teal)' : 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                        </div>
                      )}
                      <Key size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
                      <span style={{ wordBreak: 'break-word', fontSize: '0.94rem' }}>{cred.data.title}</span>
                    </div>

                    {!selectionMode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', position: 'relative', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {/* Quick Star Button */}
                        <button
                          onClick={(e) => handleToggleStar(cred, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            color: cred.data.starred ? '#f59e0b' : 'var(--text-muted)',
                            opacity: cred.data.starred ? 1 : 0.45
                          }}
                          title={cred.data.starred ? "Remove from Starred" : "Add to Starred"}
                        >
                          <Star size={16} fill={cred.data.starred ? '#f59e0b' : 'none'} />
                        </button>

                        {/* Three Dots Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === `cred_${cred.id}` ? null : `cred_${cred.id}`);
                          }}
                          style={{
                            color: 'var(--text-muted)',
                            padding: '0.35rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: 'var(--radius-sm)'
                          }}
                          title="Credential options"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === `cred_${cred.id}` && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '0.25rem',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                              zIndex: 40,
                              minWidth: '150px',
                              padding: '0.35rem',
                              animation: 'fadeIn 0.15s ease-out'
                            }}
                          >
                            <button
                              onClick={(e) => {
                                setActiveMenuId(null);
                                handleToggleStar(cred, e);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                background: 'none',
                                border: 'none',
                                color: cred.data.starred ? '#f59e0b' : 'var(--text-primary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'left'
                              }}
                              className="dropdown-item-hover"
                            >
                              <Star size={14} fill={cred.data.starred ? '#f59e0b' : 'none'} color="#f59e0b" />
                              <span>{cred.data.starred ? 'Unstar' : 'Add to Starred'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                openMoveModalForItems([], [cred.id]);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'left'
                              }}
                              className="dropdown-item-hover"
                            >
                              <FolderInput size={14} color="var(--accent-teal)" />
                              <span>Move</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                openCopyModalForItems([], [cred.id]);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'left'
                              }}
                              className="dropdown-item-hover"
                            >
                              <Copy size={14} color="var(--accent-teal)" />
                              <span>Copy</span>
                            </button>

                            <button
                              onClick={(e) => {
                                setActiveMenuId(null);
                                startEditCredential(cred, e);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'left'
                              }}
                              className="dropdown-item-hover"
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </button>

                            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />

                            <button
                              onClick={(e) => {
                                setActiveMenuId(null);
                                handleDeleteCredential(cred.id, e);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.65rem',
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'left'
                              }}
                              className="dropdown-item-hover"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {renderField(cred.id, "Username", cred.data.username)}
                  {renderField(cred.id, "Email", cred.data.email)}
                  {renderSensitiveField(cred.id, "password", "Password", cred.data.password)}

                  {cred.data.website && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Website</span>
                      <div style={{ fontSize: '0.9rem', color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', wordBreak: 'break-all' }}>
                        <a href={cred.data.website.startsWith('http') ? cred.data.website : `https://${cred.data.website}`} target="_blank" rel="noopener noreferrer" style={{ paddingRight: '0.5rem', color: 'inherit', textDecoration: 'underline' }}>
                          {cred.data.website}
                        </a>
                        <button onClick={() => copyToClipboard(cred.data.website || '', `${cred.id}_Website`)} style={{ color: copiedField === `${cred.id}_Website` ? 'var(--success-color)' : 'var(--text-muted)', flexShrink: 0 }} title="Copy Website">
                          {copiedField === `${cred.id}_Website` ? <Check size={14} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {renderField(cred.id, "Account ID", cred.data.accountId)}
                  {renderField(cred.id, "Phone", cred.data.phone)}
                  {renderField(cred.id, "Recovery Info", cred.data.recoveryContact)}

                  {renderSensitiveField(cred.id, "token", "Token", cred.data.token)}
                  {renderSensitiveField(cred.id, "apiKey", "API Key", cred.data.apiKey)}
                  {renderSensitiveField(cred.id, "secretKey", "Secret Key", cred.data.secretKey)}

                  {cred.data.notes && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Notes</span>
                        <button onClick={() => copyToClipboard(cred.data.notes || '', `${cred.id}_Notes`)} style={{ color: copiedField === `${cred.id}_Notes` ? 'var(--success-color)' : 'var(--text-muted)', flexShrink: 0 }} title="Copy Notes">
                          {copiedField === `${cred.id}_Notes` ? <Check size={14} /> : <Copy size={12} />}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {cred.data.notes}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Move / Copy Destination Modal */}
      <MoveCopyModal
        isOpen={moveCopyModalOpen}
        mode={moveCopyMode}
        folders={folders}
        selectedFolderIds={moveCopyTargetIds.folderIds}
        selectedCredIds={moveCopyTargetIds.credIds}
        currentFolderId={currentFolderId}
        onClose={() => setMoveCopyModalOpen(false)}
        onConfirm={handleExecuteMoveCopy}
      />

      {/* Recovery Phrase Modal */}
      {newRecoveryPhrase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-md)', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <AlertTriangle size={48} color="var(--accent-purple)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }}>New Recovery Phrase</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Your old recovery phrase is now completely invalid. Please write down these 12 words in exactly this order and store them somewhere safe. <strong>We cannot recover them for you.</strong>
            </p>

            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              letterSpacing: '1px',
              lineHeight: '1.5',
              wordSpacing: '0.5rem',
              marginBottom: '2rem'
            }}>
              {newRecoveryPhrase}
            </div>

            <button onClick={() => { setNewRecoveryPhrase(null); setIsRegenerating(false); }} className="btn-primary" style={{ width: '100%', backgroundColor: 'var(--accent-purple)' }}>
              I have saved these words safely
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShieldIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
}
