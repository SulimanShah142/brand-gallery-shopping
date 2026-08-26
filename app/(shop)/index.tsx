import React, { useState, useEffect, useCallback, useMemo, useRef,   createContext,

  useContext,
   } from 'react';
import {
  ScrollView, TouchableOpacity, Text, StyleSheet, View, 
  Dimensions, RefreshControl, TextInput, ActivityIndicator,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  initOfflineDb, loadCategoriesLocal, loadProductsLocal, 
  syncRemoteCatalog, isOnline, execSql, fetchAndSyncProducts, shuffleArray 
} from '@/lib/offline';
import { useLanguage } from '@/Contexts/LanguageContext';
import CachedImage from '@/components/CachedImage';
import SkeletonGrid from '@/components/SkeletonGrid';
import { API_URL } from "@/lib/config";
import { useHomeTab } from '@/Contexts/HomeTabContext';

const { width } = Dimensions.get('window');
// Premium 2-column calculation spacing accounts for side edge insets
const PRODUCT_CARD_WIDTH = (width - 42) / 2; 
const { width: SCREEN_WIDTH } = Dimensions.get('window');



export default function HomePage() {
  const router = useRouter();
  const { t, isRTL, locale} = useLanguage();
  const isMounted = useRef(true);
  const searchInputRefValue = useRef('');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [advertisements, setAdvertisements] = useState<any[]>([]);
const homeListRef = useRef<FlatList>(null);
const adsListRef = useRef<FlatList>(null);
const [activeAdIndex, setActiveAdIndex] = useState(0);
const {
  registerHomeActions,
} = useHomeTab();
const catalogSyncInProgressRef = useRef(false);


  const getLocalizedCategoryLabel = (cat: any) =>
    locale === 'ps' ? (cat.namePs || cat.name) :
    locale === 'fa' ? (cat.nameFa || cat.name) :
    cat.name;
const homeSearchInputRef = useRef<TextInput>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState(12); 
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


const safeFetchAndSyncProducts = useCallback(
  async (limit = 50, page = 1) => {
    if (catalogSyncInProgressRef.current) {
      console.log(
        '⏳ Catalog sync already running, skipping product sync.'
      );
      return [];
    }

    catalogSyncInProgressRef.current = true;

    try {
      return await fetchAndSyncProducts(limit, page);
    } catch (error) {
      console.warn(
        '⚠️ Product synchronization failed:',
        error
      );

      return [];
    } finally {
      catalogSyncInProgressRef.current = false;
    }
  },
  []
);


  // 🎯 THE STABLE SECURED ATOMIC SYSTEM LOADER (HOME VIEW)
  const handleLoadData = useCallback(async (isInitialLoad = false) => {
    let online = false;
    let hasLocalData = false;
    let remoteSyncAttempted = false;

    try {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }

      await initOfflineDb();

      const localCats = await loadCategoriesLocal().catch(() => []);
      const localProds = await loadProductsLocal().catch(() => []);

      let settingsResult = null;
      try {
        let settingsQuery = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => null);
        if (!settingsQuery || settingsQuery.length === 0) {
          settingsQuery = await execSql('SELECT * FROM local_settings LIMIT 1;').catch(() => null);
        }
        if (settingsQuery && settingsQuery.length > 0) {
          settingsResult = settingsQuery[0];
        }
      } catch (e) {
        console.warn("⚠️ Settings query dropped layout read pass:", e);
      }

      hasLocalData = Boolean((localCats?.length || 0) > 0 || (localProds?.length || 0) > 0);

      if (isMounted.current) {
        if (settingsResult) setSettings(settingsResult);
        setCategories(localCats || []);
        setProducts(shuffleArray(localProds || []));
        if (hasLocalData) {
          setIsLoading(false);
        }
      }

      online = await isOnline().catch(() => false);

   if (!hasLocalData && online) {
  remoteSyncAttempted = true;

  const syncSuccess = await safeSyncRemoteCatalog();

  if (syncSuccess && isMounted.current) {
    const freshCats = await loadCategoriesLocal().catch(() => []);
    const freshProds = await loadProductsLocal().catch(() => []);

    let freshSettingsQuery =
      await execSql(
        'SELECT * FROM app_settings LIMIT 1;'
      ).catch(() => null);

    if (
      !freshSettingsQuery ||
      freshSettingsQuery.length === 0
    ) {
      freshSettingsQuery =
        await execSql(
          'SELECT * FROM local_settings LIMIT 1;'
        ).catch(() => null);
    }

    if (isMounted.current) {
      if (
        freshSettingsQuery &&
        freshSettingsQuery.length > 0
      ) {
        setSettings(freshSettingsQuery[0]);
      }

      setCategories(freshCats || []);
      setProducts(
        shuffleArray(freshProds || [])
      );

      setIsLoading(false);
    }
  }
}

      if (online && hasLocalData) {
        setTimeout(async () => {
          if (!isMounted.current) return;
          console.log("🛰️ [BACKGROUND TASK] Starting catalog cloud synchronization pass safely...");

          const syncSuccess = await safeSyncRemoteCatalog().catch((e) => {
            console.warn("⚠️ Background cache sync transaction rejected, releasing locks:", e.message || e);
            execSql('ROLLBACK;').catch(() => {});
            return false;
          });

          if (syncSuccess && isMounted.current) {
            const freshCats = await loadCategoriesLocal().catch(() => []);
            const freshProds = await loadProductsLocal().catch(() => []);
            let freshSettingsQuery = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => null);
            if (!freshSettingsQuery || freshSettingsQuery.length === 0) {
              freshSettingsQuery = await execSql('SELECT * FROM local_settings LIMIT 1;').catch(() => null);
            }

            if (isMounted.current) {
              if (freshSettingsQuery && freshSettingsQuery.length > 0) {
                setSettings(freshSettingsQuery[0]);
                console.log("✨ [LIVE MARKUP SYNC] Fresh exchange rates written atomically into home memory.");
              }
              setCategories(freshCats || []);
              setProducts(shuffleArray(freshProds || []));
            }
          }
        }, 800);
      }

      // Kick off an explicit product sync to fetch more items lazily
    try {
  if (online) {
    setRemoteSyncing(true);

    const synced =
      await safeFetchAndSyncProducts(50, 1);

    if (
      synced &&
      synced.length > 0 &&
      isMounted.current
    ) {
      const freshProds =
        await loadProductsLocal().catch(() => []);

      if (isMounted.current) {
        setProducts(
          shuffleArray(freshProds || [])
        );
      }
    }
  }
} catch (e) {
  console.warn(
    'Background product sync error',
    e
  );
} finally {
  if (isMounted.current) {
    setRemoteSyncing(false);
  }
}

      try {
        const adsRes = await fetch(`${API_URL}/advertisements`);
        const adsData = await adsRes.json();
        if (isMounted.current) {
          setAdvertisements(adsData || []);
        }
      } catch (adsError) {
        console.warn("⚠️ Ad fetch failed:", adsError);
      }
    } catch (err) {
      console.error('❌ Home Page operational collection thread failed:', err);
    } finally {
      if (isMounted.current) {
        if (!online || hasLocalData || remoteSyncAttempted) {
          setIsLoading(false);
        }
        setRefreshing(false);
      }
    }
  }, [])

  
  // EXACTLY ONE mount listener is preserved, eliminating concurrent thread resource competition!
// HOME TAB ACTIONS
useEffect(() => {
  registerHomeActions({
    scrollToTop: () => {
      homeListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    },

    refresh: async () => {
      homeListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });

      await handleLoadData(false);
    },
  });

  return () => {
    registerHomeActions(null);
  };
}, [registerHomeActions, handleLoadData]);


// INITIAL HOME LOAD — RUN ONCE
useEffect(() => {
  handleLoadData(true);
}, []);


  useEffect(() => {
  if (!advertisements.length) return;

  const interval = setInterval(() => {
    setActiveAdIndex((prev) => {
      const nextIndex =
        prev === advertisements.length - 1 ? 0 : prev + 1;

      adsListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });

      return nextIndex;
    });
  }, 5000); // ⏱ 5 seconds

  return () => clearInterval(interval);
}, [advertisements]);


  // 🎯 UNIVERSAL NUMBERS TRANSLATOR METHOD
  const toLocalNumbers = useCallback((num: string | number) => {
    const stringValue = String(num || '0');
    if (locale === 'en' || !locale) return stringValue;
    
    const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return stringValue.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  }, [locale]);

  // 🎯 HIGH-PRECISION HOME PRICE CEILING Markups ENGINE
  const getPrices = (usdPrice: string, productProfitPercentage?: string | number | null) => {
    const rate = parseFloat(settings?.usdToAfnRate || '65');
    const profit = parseFloat(String(productProfitPercentage ?? '20').replace(/[^0-9.]/g, '')) || 20;
    
    const baseCurrent = parseFloat(usdPrice || '0') * rate * (1 + profit / 100);
    const baseOld = parseFloat(usdPrice || '0') * rate * (1 + (profit + 15) / 100);
    
    // Forces endings to always be zero via 10-base ceiling arithmetic
    const currentPriceCalculated = Math.ceil(baseCurrent / 10) * 10;
    const oldPriceCalculated = Math.ceil(baseOld / 10) * 10;
    
    return {
      current: currentPriceCalculated,
      old: oldPriceCalculated
    };
  };


const safeSyncRemoteCatalog = useCallback(async () => {
  if (catalogSyncInProgressRef.current) {
    console.log('⏳ Catalog sync already running, skipping duplicate sync.');
    return false;
  }

  catalogSyncInProgressRef.current = true;

  try {
    return await syncRemoteCatalog();
  } catch (error) {
    console.warn(
      '⚠️ Catalog synchronization failed:',
      error
    );

    return false;
  } finally {
    catalogSyncInProgressRef.current = false;
  }
}, []);


    // 🎯 MULTILINGUAL LOCALE SEARCH INTERCEPTOR
  // Upgraded to filter safely across both camelCase and snake_case data layers
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.namePs || '').toLowerCase().includes(query) ||
      (p.name_ps || '').toLowerCase().includes(query) ||
      (p.nameFa || '').toLowerCase().includes(query) ||
      (p.name_fa || '').toLowerCase().includes(query)
    ).slice(0, displayLimit);
  }, [products, searchQuery, displayLimit]);


  const onAdScroll = (event: any) => {
  const index = Math.round(
    event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32)
  );
  setActiveAdIndex(index);
};

const renderAdvertisements = useCallback(() => {
  if (!advertisements.length) return null;

  return (
    <View style={styles.adsWrapper}>
      <FlatList
         ref={adsListRef} 
        data={advertisements}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={onAdScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.adBanner}
            onPress={() =>
              router.push(`/product/${item.productId}`)
            }
          >
            <CachedImage
              remoteUrl={item.imageUrl}
              style={styles.adImage}
            />

            <View style={styles.adOverlay}>
              <Text style={styles.adTitle}>
                {locale === "ps"
                  ? item.titlePs || item.title
                  : locale === "fa"
                  ? item.titleFa || item.title
                  : item.title}
              </Text>

              <Text style={styles.adSubtitle}>
                {locale === "ps"
                  ? item.subtitlePs || item.subtitle
                  : locale === "fa"
                  ? item.subtitleFa || item.subtitle
                  : item.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* DOT INDICATORS */}
      <View style={styles.dotsContainer}>
        {advertisements.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              activeAdIndex === index && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}, [advertisements, activeAdIndex, locale]);

const renderHomeHeaderAndCategories = useCallback(() => {
  return (
    
    <View style={styles.headerStackArea}>
      
      {/* TOP BAR (STATIC WRAPPER) */}
      <View style={styles.topBar}>
        <View
          style={[
            styles.searchContainer,
            isRTL && { flexDirection: 'row-reverse' },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={16}
            color="#666"
            style={{ opacity: 0.7 }}
          />

          <TextInput
            ref={homeSearchInputRef}
            placeholder={t('searchProduct') || 'SEARCH...'}
            placeholderTextColor="#999"
            
           value={searchInputRefValue.current}
           onChangeText={(text) => {
  searchInputRefValue.current = text;
  setSearchQuery(text);
}}
            // 🔥 CRITICAL STABILITY FLAGS
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="search"
            blurOnSubmit={false}

            // 🔥 PREVENT LAYOUT JUMP
            style={[
              styles.searchInput,
              {
                flex: 1,
                minWidth: 0,   // IMPORTANT: prevents flex reflow jitter
              },
              isRTL
                ? { textAlign: 'right', marginRight: 10 }
                : { textAlign: 'left', marginLeft: 10 },
            ]}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>
{renderAdvertisements()}
      {/* CATEGORIES (UNCHANGED STABLE BLOCK) */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          {/* Render as columns of two items to create a 2-row horizontal scroll like Shein */}
          {(() => {
            const chunks: any[] = [];
            for (let i = 0; i < categories.length; i += 2) {
              chunks.push(categories.slice(i, i + 2));
            }

            return chunks.map((pair, idx) => (
              <View key={`col-${idx}`} style={{ width: 78, alignItems: 'center', marginRight: 14 }}>
                {pair.map((cat: any, i: number) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catCircleItem, { marginRight: 0, marginBottom: i === 0 ? 6 : 0 }]}
                    onPress={() => router.push(`/categories/${cat.id}`)}
                  >
                    <View style={styles.circle}>
                      <CachedImage remoteUrl={cat.imageUrl} style={styles.circleImg} />
                    </View>
                    <Text style={styles.catLabel} numberOfLines={1}>
                      {getLocalizedCategoryLabel(cat)?.toUpperCase() || 'GENERAL'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ));
          })()}
        </ScrollView>
      )}

      <Text style={styles.sectionTitle}>
        {t('justForYou')?.toUpperCase() || 'JUST FOR YOU'}
      </Text>

    </View>
  );
}, [categories, isRTL, t]);

  // 🎯 MULTILINGUAL GEOMETRIC PRODUCT CARD RENDERING CORE (OPTIMIZED)
  const renderProductItemCell = useCallback(({ item }: { item: any }) => {
    const { current, old } = getPrices(item.usdPrice, item.profitPercentage);
    
    const productDisplayTitle = 
      locale === 'ps' ? (item.namePs || item.name_ps || item.name) : 
      locale === 'fa' ? (item.nameFa || item.name_fa || item.name) : 
      item.name;
    
    return (
      <TouchableOpacity 
        style={styles.productCard} 
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <CachedImage remoteUrl={item.imageUrl} style={styles.productImage} />
          
         <View style={[styles.badge, isRTL ? { right: 8 } : { left: 8 }]}>
            <Text style={styles.badgeText}>{t('new') || 'NEW'}</Text>
          </View>
          
          <TouchableOpacity
            onPress={() => setFavorites(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
            style={[styles.wishlistBtn, isRTL ? { left: 8 } : { right: 8 }]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={favorites[item.id] ? "heart" : "heart-outline"}
              size={22}
              color={favorites[item.id] ? "#FF3B30" : "#111111"}
            />
          </TouchableOpacity>
        </View>
        
        <View style={[styles.productInfo, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          <Text style={[styles.productName, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
            {productDisplayTitle?.toUpperCase()}
          </Text>
          
          <View style={[styles.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={styles.productPrice}>
              {isRTL ? `${toLocalNumbers(current)} افغانۍ` : `AFN ${toLocalNumbers(current.toLocaleString('en-US'))}`}
            </Text>
            <Text style={styles.oldPrice}>
              {isRTL ? `${toLocalNumbers(old)} افغانۍ` : `AFN ${toLocalNumbers(old.toLocaleString('en-US'))}`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [locale, isRTL, settings, favorites]);

 return (
  <View style={styles.container}>
    <FlatList
       ref={homeListRef}
  data={filteredProducts}
      renderItem={renderProductItemCell}
      keyExtractor={(item) => `home-prod-${item.id}`}
      numColumns={2}
      columnWrapperStyle={[
        styles.gridRow,
        isRTL && { flexDirection: 'row-reverse' },
      ]}
      showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
  removeClippedSubviews={true}
  initialNumToRender={8}
  maxToRenderPerBatch={8}
  windowSize={5}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={renderHomeHeaderAndCategories}
      onEndReached={() => setDisplayLimit((p) => p + 12)}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => handleLoadData(false)}
          tintColor="#000000"
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          {isLoading || remoteSyncing ? (
            <SkeletonGrid count={8} />
          ) : (
            <Text style={styles.emptyText}>
              {t('noProducts') ||
                'NO PRODUCTS MATCHED YOUR SEARCH'}
            </Text>
          )}
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: '#FAFAFA',
},

topBar: {
  paddingTop: 10,
  paddingHorizontal: 20,
  paddingBottom: 18,
  backgroundColor: '#FAFAFA',
},

searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',

  height: 52,

  backgroundColor: '#FFFFFF',

  borderRadius: 18,

  paddingHorizontal: 16,

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.05,
  shadowRadius: 12,

  elevation: 3,
},

searchInput: {
  flex: 1,
  marginLeft: 12,

  fontSize: 14,
  color: '#111',

  fontWeight: '500',
},

catScroll: {
  marginTop: 6,
},

catScrollContent: {
  paddingHorizontal: 20,
  paddingBottom: 16,
},
  catGridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  catGridItem: {
    flexBasis: Math.floor(width / 5),
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  catGridCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  catGridImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  catGridLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
  },
headerStackArea: {
  width: '100%',
},

gridRow: {
  justifyContent: 'space-between',
  paddingHorizontal: 16,
},

gridSkeletonRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  width: '100%',
},

emptyContainer: {
  paddingVertical: 60,
  alignItems: 'center',
  justifyContent: 'center',
},

emptyText: {
  marginTop: 12,
  fontSize: 13,
  color: '#888888',
  fontWeight: '600',
},
catCircleItem: {
  alignItems: 'center',
  marginRight: 18,
  width: 78,
},

circle: {
  width: 72,
  height: 72,

  borderRadius: 36,

  overflow: 'hidden',

  backgroundColor: '#FFF',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.08,
  shadowRadius: 10,

  elevation: 4,
},
adsWrapper: {
  marginBottom: 20,
},

adBanner: {
  width: SCREEN_WIDTH - 32,
  height: 220,
  marginHorizontal: 16,

  borderRadius: 24,
  overflow: "hidden",
  backgroundColor: "#FFF",

  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 5,
},

adImage: {
  width: "100%",
  height: "100%",
},

adOverlay: {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,

  padding: 18,
  backgroundColor: "rgba(0,0,0,0.35)",
},

adTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "900",
},

adSubtitle: {
  color: "#fff",
  fontSize: 12,
  marginTop: 6,
  opacity: 0.95,
},

dotsContainer: {
  flexDirection: "row",
  justifyContent: "center",
  marginTop: 10,
},

dot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#ccc",
  marginHorizontal: 4,
},

dotActive: {
  width: 18,
  backgroundColor: "#111",
},

circleImg: {
  width: '100%',
  height: '100%',
  resizeMode: 'cover',
},

catLabel: {
  marginTop: 10,

  fontSize: 11,
  fontWeight: '600',

  color: '#222',

  textAlign: 'center',
  maxWidth: 78,
},


sectionTitle: {
  fontSize: 22,

  fontWeight: '800',

  color: '#111',

  paddingHorizontal: 20,

  marginBottom: 20,
  marginTop: 20,
},

productGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',

  justifyContent: 'space-between',

  paddingHorizontal: 16,
},

productCard: {
  width: PRODUCT_CARD_WIDTH,

  marginBottom: 22,

  backgroundColor: '#FFFFFF',

  borderRadius: 22,

  overflow: 'hidden',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 6,
  },
  shadowOpacity: 0.06,
  shadowRadius: 12,

  elevation: 4,
},

imageContainer: {
  width: '100%',

  aspectRatio: 0.78,

  overflow: 'hidden',

  backgroundColor: '#F4F4F4',
},

productImage: {
  width: '100%',
  height: '100%',
},

badge: {
  position: 'absolute',

  top: 12,
 

  backgroundColor: '#111',

  paddingHorizontal: 10,
  paddingVertical: 5,

  borderRadius: 20,
},

badgeText: {
  color: '#FFF',

  fontSize: 10,

  fontWeight: '700',
},

wishlistBtn: {
  position: 'absolute',

  top: 12,
  right: 12,

  width: 38,
  height: 38,

  borderRadius: 19,

  backgroundColor: 'rgba(255,255,255,0.95)',

  justifyContent: 'center',
  alignItems: 'center',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.08,
  shadowRadius: 8,

  elevation: 3,
},

productInfo: {
  padding: 14,
},

productName: {
  fontSize: 13,

  fontWeight: '600',

  color: '#111',

  minHeight: 38,

  lineHeight: 18,
},

priceRow: {
  flexDirection: 'row',

  alignItems: 'center',

  marginTop: 8,
},

productPrice: {
  fontSize: 16,

  fontWeight: '800',

  color: '#111',
},

oldPrice: {
  fontSize: 12,

  marginLeft: 8,

  color: '#999',

  textDecorationLine: 'line-through',
},

skeletonCard: {
  width: PRODUCT_CARD_WIDTH,
  marginBottom: 22,
},

skeletonImage: {
  width: '100%',
  aspectRatio: 0.78,

  borderRadius: 22,

  backgroundColor: '#EAEAEA',
},

skeletonText: {
  height: 12,

  borderRadius: 8,

  backgroundColor: '#EAEAEA',

  marginTop: 12,
},
});