import { supabase } from './supabase';

export interface BackupData {
  version: string;
  export_date: string;
  user_id: string;
  wrapped_keys: any;
  folders: any[];
  credentials: any[];
}

export const restoreBackup = async (backup: BackupData, currentUserId: string) => {
  // Ensure they aren't importing someone else's backup which might mess up RLS
  if (backup.user_id !== currentUserId) {
    throw new Error("This backup belongs to a different user account.");
  }

  // 1. Restore Wrapped Keys
  if (backup.wrapped_keys) {
    const { error: keysError } = await supabase
      .from('wrapped_keys')
      .upsert(backup.wrapped_keys);
    if (keysError) throw keysError;
  }

  // 2. Restore Folders
  if (backup.folders && backup.folders.length > 0) {
    const { error: foldersError } = await supabase
      .from('folders')
      .upsert(backup.folders);
    if (foldersError) throw foldersError;
  }

  // 3. Restore Credentials
  if (backup.credentials && backup.credentials.length > 0) {
    const { error: credsError } = await supabase
      .from('credentials')
      .upsert(backup.credentials);
    if (credsError) throw credsError;
  }
};
