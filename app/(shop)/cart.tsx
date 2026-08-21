import React, { useMemo, useCallback , useState, useEffect} from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/Contexts/LanguageContext';
import { useCart } from '@/Contexts/CartContext';
import { useBadges } from '@/Contexts/BadgeContext';
import { API_URL } from '@/lib/config';
export default function CartScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  const { state: cartState, removeFromCart, addToCart } = useCart();

  // 🎯 REAL-TIME LIVE DATA HYDRATION LAYER CELLS:
  // Holds full live, multi-lingual translations fetched directly from your Cloud Worker!
  const [hydratedProductsMap, setHydratedProductsMap] = useState<Record<string, any>>({});
  const [fetchingTranslations, setFetchingTranslations] = useState(false);

  // =========================================================================
  // 🎯 THE LIVE RE-FETCH CURE:
  // Whenever the Cart screen displays or your user switches local system locales,
  // we dispatch an asynchronous batch fetch to fetch fresh translation nodes!
  // =========================================================================
  useEffect(() => {
    if (!cartState.items || cartState.items.length === 0) return;

    let mounted = true;
    async function hydrateCartCatalogTranslations() {
      try {
        setFetchingTranslations(true);
        const uniqueProductIdsList = Array.from(new Set(cartState.items.map((item: any) => item.id)));
        const freshLookupsRecord: Record<string, any> = {};

        // Execute parallel network queries directly from your cloud worker catalog indices
        await Promise.all(
          uniqueProductIdsList.map(async (productId) => {
            try {
              const res = await fetch(`${API_URL}/api/products/${productId}`);
              if (res.ok) {
                const productData = await res.json();
                freshLookupsRecord[productId] = productData;
              }
            } catch (err) {
              console.warn(`⚠️ Translation fetch deferred for Item #${productId}:`, err);
            }
          })
        );

        if (mounted) {
          setHydratedProductsMap(freshLookupsRecord);
        }
      } catch (globalErr) {
        console.error("❌ Cart translation hydration error:", globalErr);
      } finally {
        if (mounted) setFetchingTranslations(false);
      }
    }

    hydrateCartCatalogTranslations();
    return () => { mounted = false; };
  }, [cartState.items, locale]); // 🎯 Re-fires automatically the millisecond language drops/changes!

  const incrementQuantity = useCallback((item: any) => {
    addToCart(item, 1, item.selectedSize, item.selectedColor);
  }, [addToCart]);

  const decrementQuantity = useCallback((item: any) => {
    if (item.quantity > 1) {
      addToCart(item, -1, item.selectedSize, item.selectedColor);
    } else {
      removeFromCart(item.id, item.selectedSize, item.selectedColor);
    }
  }, [addToCart, removeFromCart]);

  const calculateTotal = useMemo(() => {
    if (!cartState.items || cartState.items.length === 0) return 0;
    return cartState.items.reduce((sum, item) => {
      const unitPrice = typeof item.price === 'string' ? parseFloat(item.price) : (Number(item.price) || 0);
      const quantity = Number(item.quantity) || 1;
      return sum + (unitPrice * quantity);
    }, 0);
  }, [cartState.items]);

  const goToCheckout = async () => {
    if (cartState.items.length === 0) {
      Alert.alert(t('emptyCart') || 'Your bag is empty.');
      return;
    }
    router.replace('/checkout');
  };

  const renderCartItem = ({ item }: { item: any }) => {
    // 🎯 LIVE TRANSLATION REFERENCE RECOVERY:
    // Recover the live, fully translated template row directly from our hydration state map!
    const liveProductMatch = hydratedProductsMap[item.id] || item.product || item;
    
    const cartProductDisplayTitle = 
      locale === 'ps' ? (liveProductMatch.namePs || liveProductMatch.name_ps || liveProductMatch.name) : 
      locale === 'fa' ? (liveProductMatch.nameFa || liveProductMatch.name_fa || liveProductMatch.name) : 
      liveProductMatch.name;

    let localizedColorLabelText = item.selectedColor || 'STANDARD';
    
    const baseColorsRaw = liveProductMatch.availableColors;
    const baseColorsPs = liveProductMatch.availableColorsPs;
    const baseColorsFa = liveProductMatch.availableColorsFa;

    let availableColorsArray: string[] = [];
    let availableColorsPsArray: string[] = [];
    let availableColorsFaArray: string[] = [];

    if (baseColorsRaw) {
      availableColorsArray = Array.isArray(baseColorsRaw) 
        ? baseColorsRaw.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
        : typeof baseColorsRaw === 'string' ? baseColorsRaw.split(',') : [];
    }

    if (baseColorsPs) {
      availableColorsPsArray = Array.isArray(baseColorsPs)
        ? baseColorsPs.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
        : typeof baseColorsPs === 'string' ? baseColorsPs.split(',') : [];
    }

    if (baseColorsFa) {
      availableColorsFaArray = Array.isArray(baseColorsFa)
        ? baseColorsFa.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
        : typeof baseColorsFa === 'string' ? baseColorsFa.split(',') : [];
    }

    if (availableColorsArray.length > 0) {
      const colorMatchIdx = availableColorsArray.findIndex(
        (c: string) => c?.trim().toLowerCase() === item.selectedColor?.trim().toLowerCase()
      );

      if (colorMatchIdx !== -1) {
        localizedColorLabelText = 
          locale === 'ps' ? (availableColorsPsArray[colorMatchIdx] || item.selectedColor) : 
          locale === 'fa' ? (availableColorsFaArray[colorMatchIdx] || item.selectedColor) : 
          item.selectedColor;
      }
    }

    const toLocalNumbersInline = (num: string | number) => {
      const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
      if (locale === 'en' || !locale) return str;
      const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
    };

    const totalItemCalculatedPrice = Math.ceil(Number(item.price || 0) * (item.quantity || 1));

    return (
      <View style={[styles.cartItem, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark-circle" size={20} color="#000000" />
        </View>

        <Image 
          source={{ uri: item.imageUrl || liveProductMatch.imageUrl }} 
          style={styles.cartItemImage} 
          resizeMode="cover" 
        />

        <View style={styles.cartItemInfo}>
          <View style={[styles.itemHeader, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.cartItemName, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
              {(cartProductDisplayTitle || '')?.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => removeFromCart(item.id, item.selectedSize, item.selectedColor)}>
              <Ionicons name="trash-outline" size={18} color="#999999" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.itemVariant, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
            {t('size') || 'SIZE'}: {String(item.selectedSize || 'M').toUpperCase()}   |   {t('color') || 'COLOR'}: {String(localizedColorLabelText || 'STANDARD').toUpperCase()}
          </Text>

          <View style={[styles.priceQuantityRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={styles.cartItemPrice}>
              {isRTL ? `${toLocalNumbersInline(totalItemCalculatedPrice)} ${t('afnCurrency') || 'افغانۍ'}` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbersInline(totalItemCalculatedPrice)}`}
            </Text>
            
            <View style={[styles.quantityContainer, isRTL && { flexDirection: 'row-reverse' }]}>
              <TouchableOpacity style={styles.qBtn} onPress={() => decrementQuantity(item)}>
                <Ionicons name="remove" size={14} color="#000000" />
              </TouchableOpacity>
              <Text style={styles.qText}>{toLocalNumbersInline(item.quantity)}</Text>
              <TouchableOpacity style={styles.qBtn} onPress={() => incrementQuantity(item)}>
                <Ionicons name="add" size={14} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };


  const toLocalNumbersFooter = (num: string | number) => {
    const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
    if (locale === 'en' || !locale) return str;
    const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={[styles.container, isRTL && { direction: 'rtl' }]}>
        
        {/* HEADER AREA */}
        <View style={[styles.header]}>
          <Text style={[styles.title]}>
            {(t('yourCart') || 'SHOPPING BAG').toUpperCase()}
          </Text>
        </View>

        {(!cartState.items || cartState.items.length === 0) ? (
          <View style={styles.emptyCart}>
            <Ionicons name="bag-handle-outline" size={44} color="#CCCCCC" />
            <Text style={styles.emptyCartText}>
              {t('emptyCart') || 'YOUR BAG IS CURRENTLY EMPTY.'}
            </Text>
            
            <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/')}>
              <Text style={styles.browseButtonText}>
                {(t('continueShopping') || 'CONTINUE SHOPPING').toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mainCartBody}>
            <FlatList
              data={cartState.items}
              keyExtractor={(item, idx) => `bag-item-${item.id}-${item.selectedSize}-${idx}`}
              renderItem={renderCartItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
            />

            {/* STICKY ACCENT FOOTER INTROSPECTION GROUP */}
            <View style={styles.stickyFooterWrapper}>
              <View style={[styles.totalContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.totalLabel}>
                  {(t('orderTotalSub') || 'ORDER TOTAL SUB').toUpperCase()}
                </Text>
                <Text style={styles.totalPrice}>
                  {isRTL ? `${toLocalNumbersFooter(calculateTotal)} ${t('afnCurrency') || 'افغانۍ'}` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbersFooter(calculateTotal)}`}
                </Text>
              </View>

              <TouchableOpacity style={styles.checkoutButton} onPress={goToCheckout}>
                <Text style={styles.checkoutButtonText}>
                  {(t('proceedSecureCheckout') || 'PROCEED TO SECURE CHECKOUT').toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },

  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#000'
  },

  mainCartBody: {
    flex: 1
  },

  flatListContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120
  },

  // 🎯 CART ITEM (refined spacing system)
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 14,
    marginBottom: 14,

    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },

  checkCircle: {
    marginRight: 10,
    opacity: 0.9
  },

  cartItemImage: {
    width: 62,
    height: 82,
    backgroundColor: '#F5F5F5',
    borderRadius: 2
  },

  cartItemInfo: {
    flex: 1,
    marginLeft: 12
  },

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  cartItemName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    flex: 1,
    marginRight: 8,
    letterSpacing: 0.2
  },

  itemVariant: {
    fontSize: 9,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
    letterSpacing: 0.2
  },

  // 🎯 PRICE ROW (more breathing room)
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginTop: 10
  },

  cartItemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000'
  },

  // 🎯 QUANTITY CONTROL (now a “pill system”)
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 20,

    overflow: 'hidden',
    backgroundColor: '#FAFAFA'
  },

  qBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qText: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    color: '#000'
  },

  // 🎯 FOOTER (merged visual system)
  stickyFooterWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,

    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',

    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginHorizontal: 20,
    padding: 14,

    backgroundColor: '#FAFAFA',
    borderRadius: 6
  },

  totalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1
  },

  totalPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000'
  },

  checkoutButton: {
    backgroundColor: '#000',
    marginHorizontal: 20,
    marginTop: 10,

    paddingVertical: 16,
    alignItems: 'center',

    borderRadius: 6
  },

  checkoutButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3
  },

  // 🎯 EMPTY STATE (slightly more premium)
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },

  emptyCartText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.4
  },

  browseButton: {
    backgroundColor: '#000',
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 18,
    borderRadius: 6
  },

  browseButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  }
});