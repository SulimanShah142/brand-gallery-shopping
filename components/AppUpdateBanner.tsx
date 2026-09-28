import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ANDROID_PACKAGE = 'com.slliman.userapp';
const IOS_BUNDLE_ID = 'com.slliman.userapp';
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const ANDROID_MARKET_URL = `market://details?id=${ANDROID_PACKAGE}`;
const IOS_STORE_URL = 'https://apps.apple.com/us/search?term=Brand%20Gallery%20Shopping';

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    if ((leftParts[index] ?? 0) !== (rightParts[index] ?? 0)) {
      return (leftParts[index] ?? 0) > (rightParts[index] ?? 0) ? 1 : -1;
    }
  }

  return 0;
}

async function getStoreVersion() {
  if (Platform.OS === 'ios') {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      results?: Array<{ version?: string }>;
    };
    return data.results?.[0]?.version ?? null;
  }

  const response = await fetch(
    `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=en_US`
  );
  if (!response.ok) return null;

  const html = await response.text();
  const versionMatch =
    html.match(/"141":\[\[\["([^"]+)"/) ??
    html.match(/itemprop="softwareVersion"[^>]+content="([^"]+)"/i);

  return versionMatch?.[1] ?? null;
}

function getStoreUrl() {
  return Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_MARKET_URL;
}

export function AppUpdateBanner() {
  const insets = useSafeAreaInsets();
  const [updateRequired, setUpdateRequired] = useState(false);
  const currentVersion =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0';

  useEffect(() => {
    let mounted = true;

    const checkForUpdate = async () => {
      try {
        const storeVersion = await getStoreVersion();

        if (!mounted) return;

        if (storeVersion && compareVersions(storeVersion, currentVersion) > 0) {
          setUpdateRequired(true);
        } else if (storeVersion) {
          setUpdateRequired(false);
        }
      } catch {
        // Update checks are optional and must never interrupt app startup.
      }
    };

    void checkForUpdate();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForUpdate();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [currentVersion]);

  if (!updateRequired) return null;

  const handleUpdatePress = async () => {
    try {
      await Linking.openURL(getStoreUrl());
    } catch {
      if (Platform.OS === 'android') {
        await Linking.openURL(ANDROID_STORE_URL);
      }
    }
  };

  return (
    <View style={[styles.container, { top: insets.top + 8 }]}>
      <View style={styles.content}>
        <View style={styles.copy}>
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.message}>
            Install the latest Brand Gallery version to continue.
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Update Brand Gallery"
          onPress={() => void handleUpdatePress()}
          style={styles.updateButton}
        >
          <Text style={styles.updateButtonText}>Open store</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    elevation: 8,
    flexDirection: 'row',
    minHeight: 68,
    paddingLeft: 16,
    paddingRight: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  copy: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    color: '#D7D7D7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  updateButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  updateButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});