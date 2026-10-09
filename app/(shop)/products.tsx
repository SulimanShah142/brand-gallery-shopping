import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Image, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useCart } from '@/Contexts/CartContext';
import CachedImage from '@/components/CachedImage';
import { execSql, loadProductsLocal, initOfflineDb , isOnline, syncRemoteCatalog, fetchAndSyncProducts, shuffleArray } from '@/lib/offline';
import SkeletonGrid from '@/components/SkeletonGrid';

import { API_URL } from '@/lib/config';
import { authClient } from '@/lib/auth-client';


const SearchInput = React.memo(({ value, onChangeText, isRTL, t }: any) => {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={t('searchPlaceholder') || 'SEARCH PRODUCTS...'}
      placeholderTextColor="#999999"
      style={[
        styles.searchInput,
        isRTL
          ? { textAlign: 'right', marginRight: 10 }
          : { textAlign: 'left', marginLeft: 10 },
      ]}
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      returnKeyType="search"
      blurOnSubmit={false}
    />
  );
});
const ProductsHeader = React.memo(
  ({
    searchQuery,
    setSearchQuery,
    filteredCount,
    isRTL,
    t,
    toLocalNumbers,
  }: any) => {
    return (
      <View style={styles.mainHeader}>
        <Text style={[styles.mainTitle]}>
          {(t('allProducts') || 'ALL PRODUCTS COLLECTION').toUpperCase()}
        </Text>

        <Text style={[styles.productCount]}>
          {toLocalNumbers(filteredCount)}{' '}{t('itemsFound') || 'ITEMS FOUND'}
        </Text>

        <View style={[styles.headerDivider]} />

        {/* ULTRA-RESPONSIVE INTERACTIVE SEARCH CONTAINER BAR */}
        <View style={[styles.searchContainer, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={16} color="#000000" style={{ opacity: 0.6 }} />

          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            isRTL={isRTL}
            t={t}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSearchQuery('')}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

// ==========================================
// PRIMARY EXPORTED USER STORE CATALOG MAIN ENGINE
export default function ProductsScreen() {
  const router = useRouter();
   
  const { t, isRTL, locale } = useLanguage(); 
  const { addToCart: contextAddToCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  // ==========================================
  // 🎯 SECURED COMPLIANT SEQUENTIAL RE-FETCH INITIALIZER
  // ==========================================
  const loadProducts = async (isInitial = false) => {
    try {
      console.log("⚙️ [PRODUCTS] Fetching storage records sequentially to prevent SQLite transaction locks...");

      // 🎯 THE PARALLEL TRANSACTION FIX:
      // Completely replaced Promise.all() with direct serialized linear lookups!
      // This allows the SQLite engine to clear transaction blocks in single file order.
      const localProds = await loadProductsLocal().catch(() => []);
      const settingsResult = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => []);
      
      setProducts(shuffleArray(localProds || []));
      if (catalogCount === null) setCatalogCount(localProds?.length || 0);
      
      if (settingsResult && settingsResult.length > 0) {
        setSettings(settingsResult[0]); 
      }

      const online = await isOnline().catch(() => false);
      if (!isInitial && online) {
        const sRes = await fetch(`${API_URL}/api/admin/settings`).catch(() => null);
        if (sRes && sRes.ok) {
          const freshSettings = await sRes.json().catch(() => null);
          if (freshSettings) setSettings(freshSettings);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load products/settings inside loop:', err);
    }
  };

  // 🎯 UNIFIED LOW-LATENCY INITIAL BOOTSTRAP ENGINE
  const setupAndLoad = async () => {
    try {
      await initOfflineDb();
      
      // Execute local data retrieval step first
      await loadProducts(true); 
      setLoading(false);

      const online = await isOnline().catch(() => false);
      if (online) {
        console.log("🛰️ [PRODUCTS CLOUD] Initiating remote synchronization tunnel safely...");
        // Wait for cloud ingestion pipelines to fully commit written buffers to disk
        await syncRemoteCatalog().catch(() => {});
        
        // Re-hydrate local values sequentially from storage
        await loadProducts(false);
      }
    } catch (e) {
      console.error("❌ Setup execution failed:", e);
      setLoading(false);
    }
  };
  
  // Kick off background product sync to fetch more items lazily
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setRemoteSyncing(true);
        const synced = await fetchAndSyncProducts(50, 1);
        if (synced && synced.length > 0 && mounted) {
          const fresh = await loadProductsLocal().catch(() => []);
          if (mounted) setProducts(shuffleArray(fresh || []));
        }
      } catch (e) {
        console.warn('Products background sync failed', e);
      } finally {
        if (mounted) setRemoteSyncing(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setupAndLoad();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/products?limit=1`)
      .then((response) => {
        const total = Number(response.headers.get('x-total-count'));
        if (Number.isFinite(total) && total >= 0) setCatalogCount(total);
      })
      .catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAndSyncProducts(50, 1);
      await loadProducts(false);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setProducts((currentProducts) => shuffleArray(currentProducts));
    }, [])
  );


  const getDisplayPrice = (usdPrice: string, productProfitPercentage?: string | number | null) => {
  const rate = parseFloat(settings?.usdToAfnRate || '65');
  const profit = parseFloat(String(productProfitPercentage ?? '20').replace(/[^0-9.]/g, '')) || 20;

  const baseCurrent =
    parseFloat(usdPrice || '0') *
    rate *
    (1 + profit / 100);

  const baseOld =
    parseFloat(usdPrice || '0') *
    rate *
    (1 + (profit + 15) / 100);

  const currentPriceCalculated =
    Math.ceil(baseCurrent / 10) * 10;

  const oldPriceCalculated =
    Math.ceil(baseOld / 10) * 10;

  return {
    current: currentPriceCalculated,
    old: oldPriceCalculated,
  };
};

const filteredProducts = useMemo(() => {
  if (!searchQuery.trim()) return products;

  const query = searchQuery.toLowerCase().trim();

  return products.filter((item) => {
    const localizedName =
      locale === 'ps'
        ? item.namePs || item.name
        : locale === 'fa'
        ? item.nameFa || item.name
        : item.name;

    return String(localizedName || '')
      .toLowerCase()
      .includes(query);
  });
}, [products, searchQuery, locale]);

 const toLocalNumbers = useCallback((num: string | number) => {
    const stringValue = String(num || '0');
    if (locale === 'en' || !locale) return stringValue;
    
    const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return stringValue.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  }, [locale]);


const addToCart = (product: any) => {
  // Use CartContext's addToCart to ensure reducer handles items correctly
  contextAddToCart(product, 1, product.selectedSize || 'M', product.selectedColor || 'Standard');

  Alert.alert(
    t('addedToCart') || 'Added to Bag',
    `${product.name} ${t('productAdded') || 'added successfully.'}`
  );
};
  
  // ... [Retain your existing internal state hooks variables declarations for t, isRTL, locale, 
  // filteredProducts, searchQuery, setSearchQuery, loading, settings, getDisplayPrice, toLocalNumbers here] ...

  // 🎯 THE PERFECT COMPONENT INLINE RENDERING PROPS:
  // Declaring the JSX components inline directly inside the Prop or useMemo hook block prevents 
  // React from unmounting the field layout, locking input text focuses flawlessly!
  const headerComponent = useMemo(() => {
    return (
      <ProductsHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredCount={catalogCount ?? filteredProducts.length}
        isRTL={isRTL}
        t={t}
        toLocalNumbers={toLocalNumbers}
      />
    );
  }, [searchQuery, filteredProducts.length, catalogCount, isRTL, t, toLocalNumbers]);

  const renderProduct = useCallback(({ item }: { item: any }) => {
    const productTitle =
      locale === 'ps' ? (item.namePs || item.name_ps || item.name) : 
      locale === 'fa' ? (item.nameFa || item.name_fa || item.name) : 
      item.name;

    const isSaleActive = settings?.newUserDiscountActive === true || String(settings?.newUserDiscountActive).toLowerCase() === 'true';
    const priceInfo = getDisplayPrice(item.usdPrice, item.profitPercentage);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={styles.imageContainer}>
          <CachedImage remoteUrl={item.imageUrl} style={styles.image} />

          {isSaleActive && (
            <View style={[styles.saleBadge, isRTL ? { right: 0 } : { left: 0 }]}>
              <Text style={styles.saleText}>SALE</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setFavorites(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
            style={[styles.favBtn, isRTL ? { left: 8 } : { right: 8 }]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={favorites[item.id] ? "heart" : "heart-outline"}
              size={22}
              color={favorites[item.id] ? "#FF3B30" : "#111111"}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.cardBody, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          <Text style={[styles.name, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
            {productTitle?.toUpperCase()}
          </Text>

          <View style={[styles.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={styles.price}>
              {isRTL ? `${toLocalNumbers(priceInfo.current)} افغانۍ` : `AFN ${toLocalNumbers(priceInfo.current)}`}
            </Text>
            {isSaleActive && (
              <Text style={styles.wasPrice}>
                {toLocalNumbers(priceInfo.old)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [locale, isRTL, settings, toLocalNumbers, getDisplayPrice, favorites]);

  if (loading && !remoteSyncing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        columnWrapperStyle={[styles.gridRow, isRTL && { flexDirection: 'row-reverse' }]}
        ListHeaderComponent={headerComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          remoteSyncing ? (
            <View style={styles.loadingContainer}>
              <SkeletonGrid count={8} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={44} color="#CCCCCC" />
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? t('noProductsMatch') || 'No matching products found'
                  : t('noProducts') || 'No products found'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ==========================================
// 🎨 HARDENED PREMIUM MONOCHROME STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF' 
  },
  mainHeader: { 
    paddingHorizontal: 16, 
    paddingTop: 20, 
    paddingBottom: 4 
  },
  mainTitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#000000', 
    letterSpacing: 1.5 
  },
  productCount: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerDivider: { 
    height: 2, 
    backgroundColor: '#000000', 
    width: 32, 
    marginTop: 8,
    marginBottom: 4
  },
  searchContainer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderWidth: 0.5,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    height: '100%'
  },
  gridRow: { 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    marginTop: 12 
  },
  card: { 
    width: '47%', 
    marginBottom: 20, 
    backgroundColor: '#FFFFFF' 
  },
  imageContainer: { 
    width: '100%', 
    aspectRatio: 3 / 4, 
    backgroundColor: '#F9F9FB', 
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#EFEFEF'
  },
  image: { 
    width: '100%', 
    height: '100%' 
  },
  saleBadge: { 
    position: 'absolute', 
    top: 0, 
    backgroundColor: '#FF3B30', 
    paddingHorizontal: 8, 
    paddingVertical: 4,
    borderBottomRightRadius: 8
  },
  saleText: { 
    color: '#FFFFFF', 
    fontSize: 8, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  favBtn: { 
    position: 'absolute', 
    top: 8, 
    width: 28, 
    height: 28, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    borderRadius: 14,
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  cardBody: { 
    paddingTop: 8,
    paddingHorizontal: 2
  },
  loadingContainer: {
    paddingTop: 24,
    paddingBottom: 24,
  },
  name: { 
    fontSize: 11, 
    color: '#111111', 
    fontWeight: '700', 
    lineHeight: 14, 
    marginBottom: 4,
    letterSpacing: 0.2
  },
  priceRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  price: { 
    fontSize: 12, 
    fontWeight: '900', 
    color: '#000000' 
  },
  wasPrice: { 
    fontSize: 10, 
    color: '#A0A0A0', 
    textDecorationLine: 'line-through', 
    fontWeight: '400' 
  },
  emptyContainer: { 
    paddingVertical: 100, 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8
  },
  emptyText: { 
    fontSize: 11, 
    color: '#888888', 
    fontWeight: '600', 
    textAlign: 'center',
    paddingHorizontal: 40
  }
});