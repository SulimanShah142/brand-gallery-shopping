import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";

export function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();

  const hasRouted = useRef(false);

  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  /**
   * Continue browsing without authentication.
   * Used to satisfy App Store guest access requirements.
   */
  const continueAsGuest = useCallback(() => {
    setAuthenticated(false);
    setIsGuest(true);
    setBooting(false);
  }, []);

  /**
   * Clears guest mode.
   * Useful after the user signs in or logs out.
   */
  const logoutGuest = useCallback(() => {
    setIsGuest(false);
  }, []);

  /**
   * Checks whether a valid local session exists.
   * If one exists we trust it immediately, then verify it
   * quietly in the background without blocking the UI.
   */
  const checkAuth = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(
        "custom_user_session_token"
      );

      const cachedUser = await SecureStore.getItemAsync(
        "cached_user_profile"
      );

      // No local session
      if (!token || !cachedUser) {
        setAuthenticated(false);
        return;
      }

      // Valid cached session
      setAuthenticated(true);
      setIsGuest(false);

      // Background verification
      fetch(`${API_URL}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      })
        .then(async (res) => {
          if (!res.ok) return;

          const payload = await res.json();

          if (payload?.user) {
            await SecureStore.setItemAsync(
              "cached_user_profile",
              JSON.stringify(payload.user)
            );
          }
        })
        .catch(() => {
          // Ignore offline/network failures.
          // Local session remains trusted.
        });
    } catch (error) {
      console.log("Auth check failed:", error);

      setAuthenticated(false);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    router,
    segments,
    hasRouted,

    booting,
    authenticated,
    isGuest,

    continueAsGuest,
    logoutGuest,
    checkAuth,

    setAuthenticated,
    setIsGuest,
  };
}