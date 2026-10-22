import { OneSignal } from 'react-native-onesignal';
import { Platform } from 'react-native';
import type { NotificationWillDisplayEvent } from 'react-native-onesignal';

const ONESIGNAL_APP_ID = "1e89f5fe-bc90-4462-b4ab-f03a3e561c8d";
let oneSignalInitialized = false;
let foregroundListenerAttached = false;
let oneSignalInitPromise: Promise<void> | null = null;
let permissionRequested = false;
const foregroundNotificationListeners = new Set<
  (event: NotificationWillDisplayEvent) => void
>();

const waitForSubscriptionId = async (attempts = 10): Promise<string | null> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const id = await OneSignal.User.pushSubscription.getIdAsync().catch(() => null);
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
};

// 🎯 THE BALANCING PROXIES FIX: Added an optional custom user ID parameter slot!
export const addForegroundNotificationListener = (
  listener: (event: NotificationWillDisplayEvent) => void
) => {
  foregroundNotificationListeners.add(listener);
  return () => {
    foregroundNotificationListeners.delete(listener);
  };
};

export const initOneSignal = async (
  authenticatedUserId?: string | null,
  requestPermission = false
) => {
  if (!oneSignalInitPromise) {
    oneSignalInitPromise = initializeOneSignal().catch((error) => {
      oneSignalInitPromise = null;
      throw error;
    });
  }
  await oneSignalInitPromise;

  if (requestPermission && !permissionRequested) {
    permissionRequested = true;
    try {
      if (Platform.OS === 'android') {
        console.log("🛰️ Triggering Native OneSignal Android Permission Prompt...");
      }
      const accepted = await OneSignal.Notifications.requestPermission(true);
      console.log("🔔 OneSignal Permission State Checked:", accepted);
    } catch (error) {
      permissionRequested = false;
      console.warn('OneSignal permission request failed:', error);
    }
  }

  if (authenticatedUserId) {
    await linkOneSignalUser(authenticatedUserId);
  }
}

async function initializeOneSignal() {
  if (!oneSignalInitialized) {
    OneSignal.initialize(ONESIGNAL_APP_ID);
    oneSignalInitialized = true;
  }

  if (!foregroundListenerAttached) {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      console.log("📩 [V5 SDK] Intercepted foreground alert event banner:", event.notification.title);
      foregroundNotificationListeners.forEach((listener) => listener(event));
      event.notification.display();
    });
    foregroundListenerAttached = true;
  }

  const subId = await waitForSubscriptionId();
  console.log("🔑 Active Linked Hardware ID:", subId);
}

async function linkOneSignalUser(authenticatedUserId: string) {
  try {
    let finalOneSignalAliasKey = authenticatedUserId.trim();
      
      // Symmetrically map raw phone string indices matching your backend routing logic footprints
      if (!finalOneSignalAliasKey.includes('@') && /^\d+$/.test(finalOneSignalAliasKey)) {
        finalOneSignalAliasKey = `${finalOneSignalAliasKey}@phone.local`;
      }

    console.log(`✅ [ONESIGNAL] Mapping user alias signature: ${finalOneSignalAliasKey}`);
    await Promise.resolve(OneSignal.login(finalOneSignalAliasKey));
    await Promise.resolve(OneSignal.User.addAlias('phone', finalOneSignalAliasKey));
  } catch (error) {
    console.error("❌ OneSignal user link failure:", error);
  }
}
