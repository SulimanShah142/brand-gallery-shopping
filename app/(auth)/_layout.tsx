import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { useLanguage } from '@/Contexts/LanguageContext';
import { useAuthGuard } from '@/lib/useAuthGuard';

export default function AuthLayout() {
 
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="otp-login" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  splashImage: { 
    width: '70%', 
    height: '35%' 
  },
  splashSubtitle: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#666666', 
    letterSpacing: 1.5, 
    textTransform: 'uppercase', 
    marginTop: 14 
  }
});
