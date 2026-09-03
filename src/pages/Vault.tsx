import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { encryptData, decryptData, generateRecoveryPhrase, deriveKeyFromPassword, wrapDataKey, generateSalt, bufferToBase64 } from '../lib/crypto';
import { saveEncryptedVaultCache, loadEncryptedVaultCache } from '../lib/cache';
import { LogOut, Lock, Folder, Key, Plus, FileText, Download, ChevronRight, FolderPlus, Edit2, Trash2, Upload, Menu, X, Eye, EyeOff, Copy, Check, ShieldAlert, AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';

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
  const { user, signOut } = useAuth();
  const { dataKey, lockVault } = useVault();
  
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
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      alert('Failed to copy!');
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

    try {
      const { cipherTextBase64, ivBase64 } = await encryptData(payload, dataKey);
      
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
    } catch (err) {
      console.error(err);
      alert("Failed to save credential.");
    }
  };

  const handleDeleteCredential = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this credential?")) return;
    try {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete credential.");
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

      setShowFolderForm(false);
      setEditingFolderId(null);
      resetForms();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save folder.");
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const hasChildFolders = folders.some(f => f.parent_id === id);
    const hasChildCreds = credentials.some(c => c.folder_id === id);

    if (hasChildFolders || hasChildCreds) {
      alert("Cannot delete this folder because it is not empty. Please delete or move all items inside it first.");
      return;
    }

    if (!confirm("Are you sure you want to delete this folder?")) return;
    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
      if (currentFolderId === id) setCurrentFolderId(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete folder.");
    }
  };

  const startEditFolder = (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormFolderName(folder.name);
    setEditingFolderId(folder.id);
    setShowFolderForm(true);
    setShowAddForm(false);
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
    } catch (err) {
      console.error("Backup failed", err);
      alert("Failed to generate backup.");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!confirm("Warning: Importing a backup will overwrite existing matching credentials and add new ones. Do you want to proceed?")) {
      if (e.target) e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      const { restoreBackup } = await import('../lib/backup');
      await restoreBackup(backupData, user.id);
      
      alert('Backup items restored successfully!');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to restore backup.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRegeneratePhrase = async () => {
    if (!user || !dataKey) return;
    
    if (!window.confirm("Generating a new phrase will instantly invalidate your old one. Are you sure you want to continue?")) {
      return;
    }

    setIsRegenerating(true);
    try {
      const phrase = generateRecoveryPhrase();
      const salt = generateSalt();
      const recoveryKek = await deriveKeyFromPassword(phrase, salt);
      const wrappedDataKey = await wrapDataKey(dataKey, recoveryKek);
      
      const { error } = await supabase
        .from('wrapped_keys')
        .update({
          recovery_phrase_salt: bufferToBase64(salt),
          wrapped_data_key_recovery: wrappedDataKey.wrappedKeyBase64
        })
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      setNewRecoveryPhrase(phrase);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to regenerate recovery phrase.");
      setIsRegenerating(false);
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const displayedCredentials = credentials.filter(c => {
    if (searchQuery.trim() !== '') {
      // Flatten view for search
      const q = searchQuery.toLowerCase();
      const title = (c.data.title || '').toLowerCase();
      const username = (c.data.username || '').toLowerCase();
      return title.includes(q) || username.includes(q);
    }
    return c.folder_id === currentFolderId;
  });
  const displayedFolders = searchQuery.trim() !== '' ? [] : folders.filter(f => f.parent_id === currentFolderId);

  const handleFolderChange = (id: string | null) => {
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
              backgroundColor: currentFolderId === null ? 'var(--bg-tertiary)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.5rem'
            }}
          >
            <Folder size={18} /> Home
          </div>
          {renderTree(null)}
        </div>

        <div>
          <button onClick={exportBackup} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export Backup
          </button>
          
          <label className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Upload size={16} /> Import Backup
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>
          <button onClick={handleRegeneratePhrase} disabled={isRegenerating} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-purple)' }}>
            <ShieldAlert size={16} /> {isRegenerating ? 'Regenerating...' : 'Regenerate Phrase'}
          </button>
          <button onClick={() => { if(window.confirm("Are you sure you want to lock the vault?")) lockVault(); }} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={16} /> Lock Vault
          </button>
          <button onClick={() => { if(window.confirm("Are you sure you want to sign out?")) signOut(); }} style={{ width: '100%', padding: '0.5rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="vault-main">
        
        {/* Breadcrumb / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-primary)' }}>
            <Menu size={24} />
          </button>
          
          {currentFolderId && (
            <button onClick={handleNavigateBack} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', paddingRight: '0.5rem', borderRight: '1px solid var(--border-color)', marginRight: '0.5rem' }}>
              <ArrowLeft size={18} />
            </button>
          )}

          <span onClick={() => handleFolderChange(null)} style={{ cursor: 'pointer', color: currentFolderId === null ? 'var(--text-primary)' : 'inherit', fontWeight: currentFolderId === null ? 'bold' : 'normal' }}>Home</span>
          
          {getBreadcrumbTrail(currentFolderId).map((f, index, arr) => (
            <React.Fragment key={f.id}>
              <ChevronRight size={16} />
              <span 
                onClick={() => handleFolderChange(f.id)} 
                style={{ 
                  cursor: 'pointer', 
                  color: index === arr.length - 1 ? 'var(--text-primary)' : 'inherit', 
                  fontWeight: index === arr.length - 1 ? 'bold' : 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '120px'
                }}
              >
                {f.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search credentials by title or username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '3rem', backgroundColor: 'var(--bg-tertiary)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button onClick={() => { resetForms(); setShowAddForm(true); setShowFolderForm(false); }} className="btn-primary" style={{ flex: '1 1 auto' }}>
            <Plus size={18} /> Add Credential
          </button>
          <button onClick={() => { resetForms(); setShowFolderForm(true); setShowAddForm(false); }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto' }}>
            <FolderPlus size={18} /> New Folder
          </button>
        </div>

        {/* Forms */}
        {showFolderForm && (
          <form onSubmit={handleSaveFolder} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
            <h3>{editingFolderId ? 'Rename Folder' : 'New Folder'}</h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Folder Name" required value={formFolderName} onChange={e => setFormFolderName(e.target.value)} style={{ flex: '1 1 200px' }} />
              <button type="submit" className="btn-primary" style={{ flex: '1 1 auto' }}>{editingFolderId ? 'Save Changes' : 'Create'}</button>
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
            <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem', margin: '0 auto' }} />
            <p>This folder is empty.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {/* Render subfolders */}
            {displayedFolders.map(folder => (
              <div 
                key={folder.id} 
                onClick={() => handleFolderChange(folder.id)}
                style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', maxWidth: '70%' }}>
                  <Folder size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={(e) => startEditFolder(folder, e)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }} title="Rename"><Edit2 size={16} /></button>
                  <button onClick={(e) => handleDeleteFolder(folder.id, e)} style={{ color: 'var(--error-color)', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            
            {/* Render credentials */}
            {displayedCredentials.map(cred => (
              <div key={cred.id} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', maxWidth: '70%' }}>
                    <Key size={18} color="var(--accent-teal)" style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word' }}>{cred.data.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={(e) => startEditCredential(cred, e)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }} title="Edit"><Edit2 size={16} /></button>
                    <button onClick={(e) => handleDeleteCredential(cred.id, e)} style={{ color: 'var(--error-color)', padding: '0.25rem' }} title="Delete"><Trash2 size={16} /></button>
                  </div>
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
            ))}
          </div>
        )}
      </div>
      
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
