import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImageViewer from 'react-native-image-zoom-viewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ProductImageViewerProps = {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
};

export default function ProductImageViewer({
  visible,
  imageUri,
  onClose,
}: ProductImageViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible && Boolean(imageUri)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {imageUri && (
          <ImageViewer
            imageUrls={[{ url: imageUri }]}
            enableImageZoom
            enableSwipeDown
            onSwipeDown={onClose}
            onCancel={onClose}
            saveToLocalByLongPress={false}
            backgroundColor="#080808"
            renderIndicator={() => <View />}
          />
        )}

        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Close product image"
          style={[styles.closeButton, { top: insets.top + 14 }]}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
});