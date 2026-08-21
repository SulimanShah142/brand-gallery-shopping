import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export function Input({
  label,
  ...props
}: {
  label?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.group}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TextInput
        placeholderTextColor="#999"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },

  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    backgroundColor: '#FAFAFA',
    color: '#111',
    fontWeight: '500',
  },
});