import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '@/Contexts/LanguageContext';
import { useCart } from '@/Contexts/CartContext';
import { useBadges } from '@/Contexts/BadgeContext';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { HomeTabProvider, useHomeTab } from '@/Contexts/HomeTabContext';


export default function ShopLayout() {
  return (
    <HomeTabProvider>
      <ShopLayoutContent />
    </HomeTabProvider>
  );
}

function ShopLayoutContent() {
  const { t, isRTL, locale } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state: cartState } = useCart();
  const { userChatBadge } = useBadges();

  const { handleHomeTabPress } = useHomeTab();

  const cartCount = useMemo(() => {
    const items = cartState?.items || [];

    return items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }, [cartState?.items]);

  const tabBarStyleWithInsets = useMemo(() => {
    const baseHeight = 56;
    const bottomPadding =
      insets.bottom > 0 ? insets.bottom : 12;

    return {
      ...styles.tabBar,
      height: baseHeight + bottomPadding,
      paddingBottom: bottomPadding,
    };
  }, [insets.bottom]);

  const renderHeader = () => {
    return (
      <View
        style={[
          styles.globalHeader,
          {
            paddingTop: insets.top + 10,
            paddingBottom: 14,
          },
          isRTL && {
            flexDirection: 'row-reverse',
          },
        ]}
      >
        <View
          style={[
            styles.brandCluster,
            isRTL && {
              flexDirection: 'row-reverse',
            },
          ]}
        >
          <Image
            source={require('@/assets/images/app-icon.jpeg')}
            style={styles.headerLogoImage}
            resizeMode="contain"
          />

          <Text style={styles.brandTitleText}>
            {t('brandGallery') || 'Brand Gallery'}
          </Text>
        </View>

        <View
          style={[
            styles.actionCluster,
            isRTL && {
              flexDirection: 'row-reverse',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() =>
              router.push('/(shop)/profile')
            }
            style={styles.headerIconButton}
          >
            <Ionicons
              name="person-outline"
              size={22}
              color="#000000"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/cart')}
            style={styles.headerIconButton}
          >
            <Ionicons
              name="bag-outline"
              size={22}
              color="#000000"
            />

            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: tabBarStyleWithInsets,
          tabBarActiveTintColor: '#000000',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarHideOnKeyboard:
            Platform.OS === 'android',
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={{
            tabPress: () => {
              void handleHomeTabPress();
            },
          }}
          options={{
            title: t('tabHome') || 'HOME',

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'home'
                    : 'home-outline'
                }
                size={20}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="categories"
          options={{
            title:
              t('tabCategories') ||
              'CATEGORIES',

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'grid'
                    : 'grid-outline'
                }
                size={20}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="products"
          options={{
            title:
              t('tabProducts') ||
              'PRODUCTS',

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'pricetags'
                    : 'pricetags-outline'
                }
                size={20}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title:
              t('tabOrders') ||
              'ORDERS',

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'cube'
                    : 'cube-outline'
                }
                size={20}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            title:
              t('tabChat') ||
              'SUPPORT',

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <View
                style={{
                  position: 'relative',
                }}
              >
                <Ionicons
                  name={
                    focused
                      ? 'chatbubble-ellipses'
                      : 'chatbubble-ellipses-outline'
                  }
                  size={20}
                  color={color}
                />

                {Number(userChatBadge || 0) > 0 && (
                  <View
                    style={
                      styles.tabIconBadgeAlertMarker
                    }
                  >
                    <Text
                      style={
                        styles.tabIconBadgeAlertText
                      }
                    >
                      {userChatBadge}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />

        {/* Hidden routes */}

        <Tabs.Screen
          name="categories/[id]"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="product/[id]"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="orders/[id]"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="cart"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="checkout"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="product/[id]/reviews"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="profile"
          options={{ href: null }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  splashContainer: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  splashImage: { width: '70%', height: '35%' },
  splashSubtitle: { fontSize: 10, fontWeight: '800', color: '#666666', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 14 },
  globalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  brandCluster: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogoImage: { width: 26, height: 26, borderRadius: 6 },
  brandTitleText: { fontSize: 15, fontWeight: '900', color: '#000000', letterSpacing: 0.5, textTransform: 'uppercase' },
  actionCluster: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconButton: { padding: 2, position: 'relative' },
  badge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#000000', minWidth: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  badgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  tabBar: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEEEEE', elevation: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.04, shadowRadius: 6 },
  tabBarLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: -2, textTransform: 'uppercase' },
  tabIconBadgeAlertMarker: { position: 'absolute', top: -4, right: -8, backgroundColor: '#FF3B30', minWidth: 12, height: 12, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  tabIconBadgeAlertText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', textAlign: 'center' }
});
