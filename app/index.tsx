import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Image,
  Text,
  StyleSheet,
  Linking,
} from "react-native";
import { useRootNavigationState, useRouter, useSegments, type Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";
import { authClient } from "@/lib/auth-client";

export default function Boot() {
  const router = useRouter();
  const segments = useSegments();
  const initialRouteSegment = segments[0];
  const navigationState = useRootNavigationState();

  const [booting, setBooting] = useState(true);
  const [hasProductDeepLink, setHasProductDeepLink] = useState(false);

  const mountedRef = useRef(true);
  const routingRef = useRef(false);
  const bootstrapRunRef = useRef(0);

  // =====================================================
  // ROUTING HELPER
  // =====================================================

  const safeReplace = useCallback((route: Href, runId?: number) => {
    if (
      !mountedRef.current ||
      (runId !== undefined && bootstrapRunRef.current !== runId) ||
      routingRef.current
    ) return;
    routingRef.current = true;
    try {
      router.replace(route);
    } catch (error) {
      routingRef.current = false;
      console.warn("Boot navigation failed:", error);
    }
  }, [router]);

  // =====================================================
  // SESSION RESTORE
  // =====================================================

  useEffect(() => {
    if (!navigationState?.key) return;

    const runId = ++bootstrapRunRef.current;
    let active = true;
    const isCurrentRun = () =>
      active && mountedRef.current && bootstrapRunRef.current === runId;

    mountedRef.current = true;

    const bootstrap = async () => {
      let hasProductDeepLink = false;

      try {
        const initialUrl = await Linking.getInitialURL().catch(() => null);
        if (!isCurrentRun()) return;

        hasProductDeepLink = Boolean(
          initialUrl && /\/products?\/[^/?#\s]+/i.test(initialUrl)
        );
        if (mountedRef.current) {
          setHasProductDeepLink(hasProductDeepLink);
        }

        console.log(
          "Boot initial URL:",
          initialUrl,
          "hasProductDeepLink:",
          hasProductDeepLink
        );

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
        if (!isCurrentRun()) return;

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

          if (initialRouteSegment == null && !hasProductDeepLink) {
            safeReplace("/(shop)", runId);
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

          safeReplace("/(auth)/sign-in", runId);
          return;
        }

        // User is authenticated, remove guest flag

        await SecureStore.deleteItemAsync(
          "guest_mode"
        ).catch(() => {});
        if (!isCurrentRun()) return;

        // ================================================
        // ENTER APP IMMEDIATELY
        // Only navigate to the shop when there is no pre-existing
        // route (for example an incoming deep link). This prevents
        // overriding the initial deep link handling.
        // ================================================

        if (initialRouteSegment == null && !hasProductDeepLink) {
          safeReplace("/(shop)", runId);
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
        if (!isCurrentRun()) return;

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
          if (!isCurrentRun()) return;

            if (token && cachedUser) {
            authClient.setSessionData({
              token,
              user: JSON.parse(cachedUser),
            });

              if (initialRouteSegment == null && !hasProductDeepLink) {
                safeReplace("/(shop)", runId);
              }
            return;
          }

          if (guestMode === "true") {
            safeReplace("/(shop)", runId);
            return;
          }

          safeReplace("/(auth)/sign-in", runId);
        } catch {
          safeReplace("/(auth)/sign-in", runId);
        }
      } finally {
        if (isCurrentRun()) {
          setBooting(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [initialRouteSegment, navigationState?.key, safeReplace]);

  // ====================================================
  // SESSION / GUEST WATCHER
  // ====================================================
  useEffect(() => {
    if (booting) return;

    let active = true;

    const validateCurrentSession = async () => {
      try {
        const token = await SecureStore.getItemAsync(
          'custom_user_session_token'
        );

        const guestMode = await SecureStore.getItemAsync(
          'guest_mode'
        );

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
        if (token && inAuth && active && mountedRef.current) {
          safeReplace('/(shop)');
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
  }, [booting, safeReplace, segments]);

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

  return (
    <View style={styles.splashContainer}>
      <ActivityIndicator size="small" color="#000" />
      <Text style={styles.splashText}>
        {hasProductDeepLink ? "OPENING PRODUCT..." : "OPENING SHOP..."}
      </Text>
    </View>
  );
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