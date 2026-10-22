import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from "react";
import { InteractionManager, Linking } from 'react-native';
import { Settings, AppLink } from 'react-native-fbsdk-next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider, syncLanguagePreference } from '@/Contexts/LanguageContext';
import { CartProvider } from '@/Contexts/CartContext';
import { BadgeProvider } from '@/Contexts/BadgeContext';
import { initOneSignal } from '@/lib/notiifcations';
import { authClient } from '@/lib/auth-client';
import { AppUpdateBanner } from '@/components/AppUpdateBanner';

function OneSignalBootstrap() {
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;

    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void initOneSignal()
          .then(() => {
            if (!mounted) return;

            unsubscribe = authClient.subscribe((session) => {
              const userId = session?.user?.id;
              if (userId) {
                void syncLanguagePreference().catch((error) => {
                  console.warn('User language preference sync failed:', error);
                });
                void initOneSignal(String(userId)).catch((error) => {
                  console.warn('OneSignal user linking failed:', error);
                });
              }
            });
          })
          .catch((error) => {
            console.warn('OneSignal deferred initialization failed:', error);
          });
      }, 1200);
    });

    return () => {
      mounted = false;
      interactionTask.cancel();
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [navigationState?.key]);

  return null;
}

function DeepLinkHandler() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!navigationState?.key) return;

    let nativeSdkTimer: ReturnType<typeof setTimeout> | undefined;
    let deferredAppLinkTimer: ReturnType<typeof setTimeout> | undefined;

    const nativeSdkTask = InteractionManager.runAfterInteractions(() => {
      nativeSdkTimer = setTimeout(() => {
        try {
          Settings.initializeSDK();
        } catch (error) {
          console.warn('Meta SDK initialization error:', error);
        }
      }, 1200);
    });

    // ---------------------------------------------------------
    // 2. Navigate to a product safely
    // ---------------------------------------------------------
    const executeNavigation = (productId: string) => {
      try {
        const cleanId = decodeURIComponent(productId).trim();

        if (
          !cleanId ||
          cleanId === 'undefined' ||
          cleanId === 'null' ||
          cleanId === '[object Object]'
        ) {
          console.warn('Invalid product ID:', cleanId);
          return;
        }

        console.log(
          'DeepLinkHandler navigating to product:',
          cleanId
        );

        navigationTimerRef.current = setTimeout(() => {
          try {
            router.replace({
              pathname: '/product/[id]',
              params: { id: cleanId },
            });
          } catch (error) {
            console.warn(
              'DeepLinkHandler navigation error:',
              error
            );
          }
        }, 0);
      } catch (error) {
        console.warn(
          'DeepLinkHandler product ID error:',
          error
        );
      }
    };

    // ---------------------------------------------------------
    // 3. Parse any incoming URL
    // ---------------------------------------------------------
    const parseAndNavigate = (rawUrl?: string | null) => {
      if (!rawUrl) {
        return;
      }

      console.log('DeepLinkHandler received URL:', rawUrl);

      try {
        // -----------------------------------------------------
        // A. Standard URL parsing
        //
        // Examples:
        // https://brand-gallery-deep-linking.vercel.app/product/123
        // userapp://product/123
        // -----------------------------------------------------
        let url: URL;

        try {
          url = new URL(rawUrl);
        } catch {
          // ---------------------------------------------------
          // B. Fallback for payloads such as intent://...
          // ---------------------------------------------------
          const fallbackMatch = rawUrl.match(
            /\/product\/([^/?#\s;]+)/i
          );

          if (fallbackMatch?.[1]) {
            executeNavigation(fallbackMatch[1]);
          } else {
            console.log(
              'DeepLinkHandler: no product ID found in URL'
            );
          }

          return;
        }

        const pathname = url.pathname || '';

        // -----------------------------------------------------
        // Match:
        // /product/123
        // /products/123
        // -----------------------------------------------------
        const parts = pathname
          .split('/')
          .map((part) => part.trim())
          .filter(Boolean);

        const productIndex = parts.findIndex(
          (part) =>
            part.toLowerCase() === 'product' ||
            part.toLowerCase() === 'products'
        );

        if (productIndex !== -1) {
          const productId = parts[productIndex + 1];

          if (productId) {
            executeNavigation(productId);
            return;
          }
        }

        // -----------------------------------------------------
        // Some Meta/deferred payloads may contain the product
        // URL inside a larger string.
        // -----------------------------------------------------
        const fallbackMatch = rawUrl.match(
          /\/product(?:s)?\/([^/?#\s;]+)/i
        );

        if (fallbackMatch?.[1]) {
          executeNavigation(fallbackMatch[1]);
          return;
        }

        console.log(
          'DeepLinkHandler: URL received but no product route found:',
          rawUrl
        );
      } catch (error) {
        console.warn(
          'DeepLinkHandler URL parsing error:',
          error
        );
      }
    };

    // ---------------------------------------------------------
    // 4. Cold-start deep link
    //
    // App was completely closed and opened through a URL.
    // ---------------------------------------------------------
    const initialUrlTimer = setTimeout(() => {
      Linking.getInitialURL()
        .then((url) => {
          if (url) {
            console.log('DeepLinkHandler initial URL:', url);
            parseAndNavigate(url);
          }
        })
        .catch((error) => {
          console.warn('DeepLinkHandler getInitialURL error:', error);
        });
    }, 1500);

    // ---------------------------------------------------------
    // 5. Meta deferred deep link
    //
    // User clicked Meta ad -> installed app -> first launch.
    // ---------------------------------------------------------
    const deferredAppLinkTask = InteractionManager.runAfterInteractions(() => {
      deferredAppLinkTimer = setTimeout(() => {
        AppLink.fetchDeferredAppLink()
          .then((url) => {
            if (url) parseAndNavigate(url);
          })
          .catch((error) => {
            console.warn('DeepLinkHandler Meta deferred app link error:', error);
          });
      }, 1800);
    });

    // ---------------------------------------------------------
    // 6. Runtime deep links
    //
    // App is already running/backgrounded and receives a URL.
    // ---------------------------------------------------------
    const subscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        console.log(
          'DeepLinkHandler runtime URL:',
          url
        );

        parseAndNavigate(url);
      }
    );

    // ---------------------------------------------------------
    // 7. Cleanup
    // ---------------------------------------------------------
    return () => {
      subscription.remove();
      nativeSdkTask.cancel();
      deferredAppLinkTask.cancel();
      if (nativeSdkTimer) clearTimeout(nativeSdkTimer);
      if (deferredAppLinkTimer) clearTimeout(deferredAppLinkTimer);
      clearTimeout(initialUrlTimer);

      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, [router, navigationState?.key]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <CartProvider>
          <BadgeProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />

            <DeepLinkHandler />
            <OneSignalBootstrap />

            <AppUpdateBanner />
          </BadgeProvider>
        </CartProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}