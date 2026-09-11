import { supabase } from './supabase';

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  os_name: string;
  browser_name: string;
  last_active: string;
  created_at: string;
}

const DEVICE_ID_KEY = 'vaultix_device_id';

/**
 * Gets or creates a persistent unique ID for this device/browser instance.
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Parses userAgent to return clean, human-readable device and browser information.
 */
export function detectDeviceInfo(): {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  osName: string;
  browserName: string;
} {
  const ua = navigator.userAgent;

  // Detect Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|android.*mobile|blackberry|phone/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect OS
  let osName = 'Unknown OS';
  if (/windows nt 10/i.test(ua)) osName = 'Windows 10/11';
  else if (/windows/i.test(ua)) osName = 'Windows';
  else if (/android/i.test(ua)) osName = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) osName = 'macOS';
  else if (/linux/i.test(ua)) osName = 'Linux';
  else if (/cros/i.test(ua)) osName = 'ChromeOS';

  // Detect Browser
  let browserName = 'Browser';
  if (/edg/i.test(ua)) browserName = 'Edge';
  else if (/opr|opera/i.test(ua)) browserName = 'Opera';
  else if (/chrome|crios/i.test(ua)) browserName = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browserName = 'Safari';
  else if (/samsungbrowser/i.test(ua)) browserName = 'Samsung Internet';

  return { deviceType, osName, browserName };
}

/**
 * Registers or updates the current device in Supabase.
 */
export async function registerCurrentDevice(userId: string): Promise<void> {
  try {
    const deviceId = getOrCreateDeviceId();
    const { deviceType, osName, browserName } = detectDeviceInfo();

    await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        last_active: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_id'
      });
  } catch (err) {
    // Fail silently if table is not yet created in Supabase
    console.warn('Could not register device session:', err);
  }
}

/**
 * Fetches all registered devices for the current user.
 */
export async function fetchUserDevices(userId: string): Promise<UserDevice[]> {
  try {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Failed to fetch devices:', err);
    return [];
  }
}

/**
 * Revokes / deletes a device session by record ID.
 */
export async function revokeDevice(deviceRecordId: string): Promise<void> {
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('id', deviceRecordId);

  if (error) throw error;
}

/**
 * Checks if this current device is already known and registered for this user in Supabase.
 */
export async function isDeviceRegistered(userId: string): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const { data, error } = await supabase
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.warn('Could not verify registered device status:', error);
      return false;
    }
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Checks if this current device is still authorized (not revoked).
 */
export async function isCurrentDeviceValid(userId: string): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const { data, error } = await supabase
      .from('user_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) return true; // Fail open if offline/table not ready
    return !!data;
  } catch {
    return true;
  }
}
