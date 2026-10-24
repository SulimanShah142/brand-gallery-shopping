import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates'; // Required to restart app on flip
import { LANGUAGES, Locale, isRTL, translate } from '@/lib/i18n';
import { API_URL } from '@/lib/config';

const STORAGE_KEY = 'user-interface-language';

export async function syncLanguagePreference(locale?: Locale) {
  try {
    const [token, storedLocale] = await Promise.all([
      SecureStore.getItemAsync('custom_user_session_token'),
      locale ? Promise.resolve(locale) : SecureStore.getItemAsync(STORAGE_KEY),
    ]);
    const selectedLocale = locale || storedLocale;
    if (!token || !['en', 'fa', 'ps'].includes(String(selectedLocale))) return;

    const response = await fetch(`${API_URL}/api/user/update-profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({ preferredLanguage: selectedLocale }),
    });

    if (!response.ok) {
      console.warn('Unable to sync selected language to account:', response.status);
    }
  } catch (error) {
    console.warn('Unable to sync selected language to account:', error);
  }
}

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
  const [languageReady, setLanguageReady] = useState(false);

  // Load language on boot
  useEffect(() => {
    let mounted = true;

    async function loadLanguage() {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored && (stored === 'fa' || stored === 'ps' || stored === 'en')) {
          if (mounted) {
            setLocaleState(stored as Locale);
          }
          void syncLanguagePreference(stored as Locale);
        }
      } catch (error) {
        console.warn('Unable to load language', error);
      } finally {
        if (mounted) {
          setLanguageReady(true);
        }
      }
    }

    void loadLanguage();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (nextLocale: Locale) => {
    try {
      // 1. Save to storage
      await SecureStore.setItemAsync(STORAGE_KEY, nextLocale);
      void syncLanguagePreference(nextLocale);
      
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

  if (!languageReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#111111" />
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    );
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
});
