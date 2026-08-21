import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates'; // Required to restart app on flip
import { LANGUAGES, Locale, isRTL, translate } from '@/lib/i18n';

const STORAGE_KEY = 'user-interface-language';

type LanguageContextValue = {
  locale: Locale;
  setLanguage: (locale: Locale) => Promise<void>; // Renamed for clarity
  t: (key: string) => string;
  isRTL: boolean;
  languages: typeof LANGUAGES;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Load language on boot
  useEffect(() => {
    async function loadLanguage() {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored && (stored === 'fa' || stored === 'ps' || stored === 'en')) {
          setLocaleState(stored as Locale);
        }
      } catch (error) {
        console.warn('Unable to load language', error);
      }
    }
    loadLanguage();
  }, []);

  const setLanguage = async (nextLocale: Locale) => {
    try {
      // 1. Save to storage
      await SecureStore.setItemAsync(STORAGE_KEY, nextLocale);
      
      // 2. Check if the direction (RTL/LTR) actually needs to change
      const currentRTL = I18nManager.isRTL;
      const targetRTL = isRTL(nextLocale);

      if (currentRTL !== targetRTL) {
        // Force the layout direction at the native level
        I18nManager.allowRTL(targetRTL);
        I18nManager.forceRTL(targetRTL);

        // 3. Restart the app to apply the native layout flip
        // This is necessary in React Native for RTL/LTR transitions
        await Updates.reloadAsync();
      } else {
        // Just update state if we stay in same direction (e.g., Dari to Pashto)
        setLocaleState(nextLocale);
      }
    } catch (error) {
      console.warn('Unable to update language', error);
    }
  };

  const value = useMemo(
    () => ({
      locale,
      setLanguage, // Matches the naming in your EditProfile page
      t: (key: string) => translate(locale, key),
      isRTL: isRTL(locale),
      languages: LANGUAGES,
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
