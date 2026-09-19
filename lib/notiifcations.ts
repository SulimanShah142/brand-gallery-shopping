import { OneSignal } from 'react-native-onesignal';
import { Platform } from 'react-native';

const ONESIGNAL_APP_ID = "1e89f5fe-bc90-4462-b4ab-f03a3e561c8d";
let oneSignalInitialized = false;
let foregroundListenerAttached = false;

const waitForSubscriptionId = async (attempts = 10): Promise<string | null> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const id = await OneSignal.User.pushSubscription.getIdAsync().catch(() => null);
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
};

// 🎯 THE BALANCING PROXIES FIX: Added an optional custom user ID parameter slot!
export const initOneSignal = async (authenticatedUserId?: string | null) => {
  try {
    // 1. Initialize with your specific App ID
    if (!oneSignalInitialized) {
      OneSignal.initialize(ONESIGNAL_APP_ID);
      oneSignalInitialized = true;
    }

    // 🎯 THE FOREGROUND NOTIFICATION VIEW BANNER ENABLER:
    // Forces drop-down system alerts to slide down into view even if the user has the app open!
      // Inside lib/notifications.ts -> Locate your foreground listener block:
    
    // 🎯 THE CORRECT V5 FOREGROUND DISPLAY FIX:
    // Uses the exact properties and functions specified by OneSignal v5 SDK.
    // This stops the TypeError crash instantly and drops the banner onto the display!
    if (!foregroundListenerAttached) {
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log("📩 [V5 SDK] Intercepted foreground alert event banner:", event.notification.title);
        event.notification.display();
      });
      foregroundListenerAttached = true;
    }


    // 2. CRITICAL FIX FOR ANDROID 13+: Explicitly force OneSignal to handle the permission prompt
    if (Platform.OS === 'android') {
      console.log("🛰️ Triggering Native OneSignal Android Permission Prompt...");
      const accepted = await OneSignal.Notifications.requestPermission(true);
      console.log("🔔 OneSignal Permission State Checked:", accepted);
    } else {
      OneSignal.Notifications.requestPermission(true);
    }

    // 3. Capture and log the structural Subscription ID
    const subId = authenticatedUserId
      ? await waitForSubscriptionId()
      : null;
    console.log("🔑 Active Linked Hardware ID:", subId);

    // 🎯 THE CRITICAL SYNCHRONIZATION ALIGNMENT GATE:
    // If a user is active, log them into OneSignal via External ID right now to unfreeze channels!
    if (authenticatedUserId) {
      let finalOneSignalAliasKey = authenticatedUserId.trim();
      
      // Symmetrically map raw phone string indices matching your backend routing logic footprints
      if (!finalOneSignalAliasKey.includes('@') && /^\d+$/.test(finalOneSignalAliasKey)) {
        finalOneSignalAliasKey = `${finalOneSignalAliasKey}@phone.local`;
      }

      console.log(`✅ [ONESIGNAL] Mapping user alias signature: ${finalOneSignalAliasKey}`);
      await Promise.resolve(OneSignal.login(finalOneSignalAliasKey));
      await Promise.resolve(OneSignal.User.addAlias('phone', finalOneSignalAliasKey));
    }

  } catch (error) {
    console.error("❌ OneSignal Native Boot Failure:", error);
  }
};
