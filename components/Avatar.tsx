import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function Avatar({ name = '' }: { name?: string }) {
  const initials =
    name?.trim()?.length > 0
      ? name.trim().slice(0, 2).toUpperCase()
      : '🥷';

  return (
    <View style={styles.avatar}>
      <Text style={styles.text}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,

    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },

  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
});