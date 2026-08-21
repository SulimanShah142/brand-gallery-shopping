import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function SkeletonGrid({ columns = 2, count = 6 }: { columns?: number; count?: number }) {
  const items = Array(count).fill(0);
  return (
    <View style={styles.container}>
      {items.map((_, i) => (
        <View key={`skele-${i}`} style={styles.card}>
          <View style={styles.image} />
          <View style={styles.info}>
            <View style={[styles.line, { width: '75%' }]} />
            <View style={[styles.line, { width: '45%' }]} />
            <View style={[styles.line, { width: '60%', marginTop: 6 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F2F2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  image: {
    height: 140,
    backgroundColor: '#F4F4F8',
  },
  info: {
    padding: 14,
  },
  line: {
    height: 10,
    backgroundColor: '#E9E9F0',
    marginBottom: 10,
    borderRadius: 5,
  },
});
