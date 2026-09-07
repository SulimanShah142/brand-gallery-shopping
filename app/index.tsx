import { useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Image,
  Text,
  StyleSheet,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";
import { OneSignal } from "react-native-onesignal";
import { authClient } from "@/lib/auth-client";

const SHOPPER_USER_APP_ID =
  "1e89f5fe-bc90-4462-b4ab-f03a3e561c8d";

let oneSignalInitialized = false;

export default function Boot() {
  const router = useRouter();
  const segments = useSegments();

  const [booting, setBooting] = useState(true);

  const mountedRef = useRef(true);
  const routingRef = useRef(false);

  // =====================================================
  // ROUTING HELPER
  // =====================================================

  const safeReplace = (route: string) => {
    if (!mountedRef.current || routingRef.current) return;

    routingRef.current = true;
    router.replace(route as any);
  };

  // =====================================================
  // SESSION RESTORE
  // =====================================================

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        // Wrap OneSignal init to catch any unexpected errors
        try {
          if (!oneSignalInitialized) {
            oneSignalInitialized = true;

            OneSignal.initialize(SHOPPER_USER_APP_ID);
            // Do not await permission request here to avoid blocking startup
            OneSignal.Notifications.requestPermission(true).catch((err) => {
              console.log('OneSignal permission request failed:', err);
            });
          }
        } catch (err) {
          console.log('OneSignal initialization safe-catch:', err);
        }

        // Initialize auth client safely
        try {
          await authClient.initClientAsync();
        } catch (err) {
          console.log('authClient.initClientAsync failed:', err);
        }

        // ================================================
        // LOAD LOCAL STORAGE
        // ================================================

        let token = null;
        let cachedUserString = null;
        let guestModeValue = null;

        try {
          [
            token,
            cachedUserString,
            guestModeValue,
          ] = await Promise.all([
            SecureStore.getItemAsync("custom_user_session_token").catch(() => null),
            SecureStore.getItemAsync("cached_user_profile").catch(() => null),
            SecureStore.getItemAsync("guest_mode").catch(() => null),
          ]);
        } catch (err) {
          console.log('SecureStore read failed:', err);
        }

        const isGuest =
          guestModeValue === "true";

        // ================================================
        // NO USER SESSION
        // ================================================

        if (!token || !cachedUserString) {
          authClient.setSessionData(null);

          if (!isGuest) {
            await SecureStore.setItemAsync("guest_mode", "true").catch(() => {});
            console.log("🔐 No session found, allowing guest browsing");
          } else {
            console.log("👤 Launching in Guest Mode");
          }

          if (segments[0] == null) {
            safeReplace("/(shop)");
          }
          return;
        }

        // ================================================
        // RESTORE LOCAL SESSION
        // ================================================

        try {
          const cachedUser = JSON.parse(
            cachedUserString
          );

          authClient.setSessionData({
            token,
            user: cachedUser,
          });
        } catch (err) {
          console.log(
            "Cached profile parse failed:",
            err
          );

          authClient.setSessionData(null);

          safeReplace("/(auth)/sign-in");
          return;
        }

        // User is authenticated, remove guest flag

        await SecureStore.deleteItemAsync(
          "guest_mode"
        ).catch(() => {});

        // ================================================
        // ENTER APP IMMEDIATELY
        // Only navigate to the shop when there is no pre-existing
        // route (for example an incoming deep link). This prevents
        // overriding the initial deep link handling.
        // ================================================

        if (segments[0] == null) {
          safeReplace("/(shop)");
        }

        // ================================================
        // BACKGROUND SESSION REFRESH
        // ================================================

        fetch(`${API_URL}/api/user/me`, {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
          },
        })
          .then(async (response) => {
            if (!response.ok) {
              console.log(
                `Background validation skipped (${response.status})`
              );
              return;
            }

            const payload =
              await response.json();

            if (!payload?.user) return;

            await SecureStore.setItemAsync(
              "cached_user_profile",
              JSON.stringify(payload.user)
            );

            authClient.setSessionData({
              token,
              user: payload.user,
            });

            console.log(
              "✅ Session refreshed"
            );
          })
          .catch((err) => {
            console.log(
              "Offline mode detected. Keeping cached session.",
              err
            );
          });
      } catch (error) {
        console.log(
          "Boot initialization failed:",
          error
        );

        // ================================================
        // LAST RESORT RECOVERY
        // ================================================

        try {
          const [
            token,
            cachedUser,
            guestMode,
          ] = await Promise.all([
            SecureStore.getItemAsync(
              "custom_user_session_token"
            ),

            SecureStore.getItemAsync(
              "cached_user_profile"
            ),

            SecureStore.getItemAsync(
              "guest_mode"
            ),
          ]);

            if (token && cachedUser) {
            authClient.setSessionData({
              token,
              user: JSON.parse(cachedUser),
            });

              if (segments[0] == null) {
                safeReplace("/(shop)");
              }
            return;
          }

          if (guestMode === "true") {
            safeReplace("/(shop)");
            return;
          }

          safeReplace("/(auth)/sign-in");
        } catch {
          safeReplace("/(auth)/sign-in");
        }
      } finally {
        if (mountedRef.current) {
          setBooting(false);
        }
      }
    };

    bootstrap();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ====================================================
  // SESSION / GUEST WATCHER
  // ====================================================
  useEffect(() => {
    let active = true;

    const validateCurrentSession = async () => {
      try {
        const token = await SecureStore.getItemAsync(
          'custom_user_session_token'
        );

        const guestMode = await SecureStore.getItemAsync(
          'guest_mode'
        );

        const inShop = segments[0] === '(shop)';
        const inAuth = segments[0] === '(auth)';

        // ------------------------------------------------
        // Guest browsing is always allowed
        // ------------------------------------------------
        if (guestMode === 'true') {
          return;
        }

        // ------------------------------------------------
        // Logged in but somehow inside auth pages
        // ------------------------------------------------
        if (token && inAuth && active) {
          router.replace('/(shop)');
        }
      } catch (error) {
        console.log(
          'Session validation failed:',
          error
        );
      }
    };

    validateCurrentSession();

    return () => {
      active = false;
    };
  }, [segments]);

  // ====================================================
  // SPLASH SCREEN
  // ====================================================
  if (booting) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('@/assets/images/splash-image.jpg')}
          style={styles.splashImage}
          resizeMode="contain"
        />

        <ActivityIndicator
          size="small"
          color="#000"
          style={{ marginTop: 20 }}
        />

        <Text style={styles.splashText}>
          INITIALIZING SYSTEM...
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  splashImage: {
    width: '80%',
    height: '40%',
  },

  splashText: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#666666',
  },
});