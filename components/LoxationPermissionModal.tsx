import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LocationPermissionModalProps {
  visible: boolean;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  onAllow: () => void | Promise<void>;
  onCancel?: () => void;
}

export default function LocationPermissionModal({
  visible,
  loading = false,
  title = 'ENABLE LIVE LOCATION',
  subtitle = 'We use your live location to power real-time tracking.',
  confirmText = 'ALLOW LOCATION',
  cancelText = 'NOT NOW',
  onAllow,
  onCancel,
}: LocationPermissionModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel?.();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* ICON */}
          <View style={styles.iconWrap}>
            <Ionicons name="location-sharp" size={30} color="#fff" />
          </View>

          {/* TITLE */}
          <Text style={styles.title}>{title}</Text>

          {/* SUBTITLE */}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* FEATURES */}
          <View style={styles.featuresWrap}>
            <View style={styles.featureRow}>
              <Ionicons name="navigate-circle-outline" size={18} color="#000" />
              <Text style={styles.featureText}>Real-time tracking</Text>
            </View>

            <View style={styles.featureRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#000" />
              <Text style={styles.featureText}>Secure delivery verification</Text>
            </View>

            <View style={styles.featureRow}>
              <Ionicons name="flash-outline" size={18} color="#000" />
              <Text style={styles.featureText}>Fast dispatch routing</Text>
            </View>
          </View>

          {/* CONFIRM */}
          <TouchableOpacity
            style={styles.allowBtn}
            activeOpacity={0.85}
            disabled={loading}
            onPress={() => {
              if (!loading) onAllow?.();
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.allowBtnText}>{confirmText}</Text>
            )}
          </TouchableOpacity>

          {/* CANCEL (FIXED) */}
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.7}
            disabled={loading}
            onPress={() => {
              if (loading) return;
              onCancel?.();   // ✅ THIS is the fix
            }}
          >
            <Text style={styles.cancelBtnText}>{cancelText}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },

  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
  },

  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },

  featuresWrap: {
    width: '100%',
    gap: 10,
    marginBottom: 22,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 14,
    gap: 10,
  },

  featureText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    flex: 1,
  },

  allowBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 10,
  },

  allowBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  cancelBtn: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#777',
  },
});