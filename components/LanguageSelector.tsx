import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function LanguageSelector() {
  const { locale, setLocale, t, languages, isRTL } = useLanguage();

  return (
    <View style={[styles.container, isRTL && styles.rtlRow]}>
      <Text style={[styles.label, isRTL && styles.rtlText]}>{t('language')}:</Text>
      <View style={[styles.options, isRTL && styles.rtlRow]}>
        {languages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.option,
              locale === language.code && styles.activeOption,
            ]}
            onPress={() => setLocale(language.code)}
          >
            <Text
              style={[
                styles.optionText,
                locale === language.code && styles.activeOptionText,
              ]}
            >
              {t(language.code === 'en' ? 'english' : language.code === 'fa' ? 'dari' : 'pashto')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  options: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  activeOption: {
    borderColor: '#000',
    backgroundColor: '#000',
  },
  optionText: {
    fontSize: 12,
    color: '#333',
  },
  activeOptionText: {
    color: '#fff',
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
});
