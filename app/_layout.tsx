// app/_layout.tsx

import { Stack, useRouter } from 'expo-router';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { CartProvider } from '@/Contexts/CartContext';
import { BadgeProvider } from '@/Contexts/BadgeContext';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const parseAndNavigate = (rawUrl?: string | null) => {
      try {
        if (!rawUrl) return;

        // Handle Android intent://... URIs
        if (rawUrl.startsWith('intent://')) {
          const m = rawUrl.match(/intent:\/\/product\/([^#?;]+)/i);
          if (m && m[1]) {
            const id = decodeURIComponent(m[1]);
            router.replace(`/product/${id}`);
            return;
          }
        }

        // Ensure we can parse other schemes
        // Normalize to a URL we can inspect
        let normalized = rawUrl;

        // Some platforms pass the full intent fragment after a '#'
        const hashIndex = rawUrl.indexOf('#');
        if (hashIndex > -1 && !rawUrl.startsWith('http')) {
          normalized = rawUrl.slice(0, hashIndex);
        }

        try {
          const u = new URL(normalized);

          const path = (u.pathname || '').replace(/^\//, '');
          const parts = path.split('/').filter(Boolean);

          const productIndex = parts.findIndex((p) => p.toLowerCase() === 'product');
          const productId = productIndex !== -1 ? parts[productIndex + 1] : null;

          if (productId) {
            const cleanId = decodeURIComponent(productId);
            if (!cleanId || cleanId === 'undefined' || cleanId === 'null' || cleanId === '[object Object]') return;

            // Delay navigation slightly to ensure the router and providers are ready.
            setTimeout(() => {
              try {
                console.log('DeepLinkHandler navigating to', cleanId);
                router.replace(`/product/${cleanId}`);
              } catch (err) {
                console.warn('DeepLinkHandler navigation error', err);
              }
            }, 450);
          }
        } catch (e) {
          // Fallback parsing: try to find '/product/{id}' in the raw string
          const m2 = rawUrl.match(/product\/([^\/?#\s]+)/i);
          if (m2 && m2[1]) {
            router.replace(`/product/${decodeURIComponent(m2[1])}`);
          }
        }
      } catch (err) {
        console.warn('DeepLinkHandler parse error', err);
      }
    };

    // Check initial URL on cold start
    Linking.getInitialURL().then((url) => parseAndNavigate(url)).catch(() => {});

    // Subscribe to url events while the app is running
    const sub = Linking.addEventListener('url', (ev) => {
      parseAndNavigate(ev.url);
    });

    return () => {
      try {
        // removeEventListener is deprecated in newer RN; calling remove on subscription
        // @ts-ignore
        if (sub && typeof sub.remove === 'function') sub.remove();
      } catch {}
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <CartProvider>
        <BadgeProvider>
          <DeepLinkHandler />
          <Stack screenOptions={{ headerShown: false }} />
        </BadgeProvider>
      </CartProvider>
    </LanguageProvider>
  );
}