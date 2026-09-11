export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'security';
  timestamp: string;
  read: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'vaultix_notifications_enabled';
const NOTIFICATIONS_LIST_KEY = 'vaultix_notifications_history';

/**
 * Checks if the browser supports the Notifications API.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Checks if notifications are currently enabled in the user's settings.
 */
export function isNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  return stored === 'true' && Notification.permission === 'granted';
}

/**
 * Requests browser permission and enables notifications.
 */
export async function enableNotifications(): Promise<boolean> {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported by this browser.');
  }

  let permission = Notification.permission;

  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'granted') {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, 'true');
    sendNotification('Vaultix Notifications Active', 'Security alerts are now active for your vault.');
    return true;
  } else {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, 'false');
    if (permission === 'denied') {
      throw new Error('Notification permission was blocked in browser settings. Please enable notifications in your browser address bar.');
    }
    return false;
  }
}

/**
 * Disables notifications in local settings.
 */
export function disableNotifications(): void {
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, 'false');
}

/**
 * Gets the stored in-app notification history.
 */
export function getNotificationHistory(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Marks all notifications as read.
 */
export function markAllNotificationsAsRead(): void {
  const list = getNotificationHistory();
  const updated = list.map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('vaultix-notifications-updated'));
}

/**
 * Deletes a single notification by ID.
 */
export function deleteNotification(id: string): void {
  const list = getNotificationHistory();
  const updated = list.filter(n => n.id !== id);
  localStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('vaultix-notifications-updated'));
}

/**
 * Deletes multiple selected notifications by IDs.
 */
export function deleteNotifications(ids: string[]): void {
  const set = new Set(ids);
  const list = getNotificationHistory();
  const updated = list.filter(n => !set.has(n.id));
  localStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('vaultix-notifications-updated'));
}

/**
 * Clears all notification history.
 */
export function clearNotificationHistory(): void {
  localStorage.removeItem(NOTIFICATIONS_LIST_KEY);
  window.dispatchEvent(new Event('vaultix-notifications-updated'));
}

/**
 * Stores an in-app notification and optionally triggers OS banner.
 */
export function sendNotification(
  title: string, 
  body: string, 
  type: 'info' | 'success' | 'warning' | 'security' = 'info'
): void {
  try {
    // 1. Store in-app notification
    const newNotif: AppNotification = {
      id: crypto.randomUUID(),
      title,
      body,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };

    const currentList = getNotificationHistory();
    // Keep last 30 notifications
    const updatedList = [newNotif, ...currentList].slice(0, 30);
    localStorage.setItem(NOTIFICATIONS_LIST_KEY, JSON.stringify(updatedList));
    window.dispatchEvent(new Event('vaultix-notifications-updated'));

    // 2. Trigger native OS banner if enabled
    if (isNotificationSupported() && Notification.permission === 'granted' && localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) === 'true') {
      new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'vaultix-security-alert'
      });
    }
  } catch (err) {
    console.warn('Failed to send notification:', err);
  }
}
