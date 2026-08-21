// app/_layout.tsx

import { Stack } from 'expo-router';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { CartProvider } from '@/Contexts/CartContext';
import { BadgeProvider } from '@/Contexts/BadgeContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <CartProvider>
        <BadgeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </BadgeProvider>
      </CartProvider>
    </LanguageProvider>
  );
}