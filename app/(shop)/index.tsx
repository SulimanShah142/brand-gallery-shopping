import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView, TouchableOpacity, Text, StyleSheet, View,
  Dimensions, RefreshControl, TextInput, ActivityIndicator,
  FlatList, Modal, Animated, Easing, InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  initOfflineDb, loadCategoriesLocal, loadProductsLocal,
  fetchRemoteCategories, isOnline, execSql, fetchAndSyncProducts, shuffleArray,
} from '@/lib/offline';
import { useLanguage } from '@/Contexts/LanguageContext';
import CachedImage from '@/components/CachedImage';
import SkeletonGrid from '@/components/SkeletonGrid';
import VisualSearchLoadingOverlay from '@/components/VisualSearchLoadingOverlay';
import { useHomeTab } from '@/Contexts/HomeTabContext';
import { API_URL } from '@/lib/config';
import * as ImagePicker from 'expo-image-picker';
import { useVisualSearch } from '@/Contexts/VisualSearchContext';
import { searchHomeProductsByEmbedding } from '@/lib/visualSearch';
import { generateVisualEmbedding, preloadVisualEmbeddingModel } from '@/lib/visualEmbedding';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (width - 42) / 2;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomePage() {
  const router = useRouter();
  const { setResults: setVisualSearchResults } = useVisualSearch();
  const [visualSearchImage, setVisualSearchImage] = useState<string | null>(null);
  const [visualSearchProgress, setVisualSearchProgress] = useState(0);
  const [visualSearchStage, setVisualSearchStage] = useState<'preparing' | 'analyzing' | 'searching' | 'finishing'>('preparing');
  const visualScanAnim = useRef(new Animated.Value(0)).current;
  const { t, isRTL, locale } = useLanguage();
  const isMounted = useRef(true);
  const searchInputRefValue = useRef('');
  const [visualSearching, setVisualSearching] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [advertisements, setAdvertisements] = useState<any[]>([]);
  const homeListRef = useRef<FlatList>(null);
  const adsListRef = useRef<FlatList>(null);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const { registerHomeActions } = useHomeTab();
  const catalogSyncInProgressRef = useRef(false);
  const [visualSearchModalVisible, setVisualSearchModalVisible] = useState(false);
  const [visualSearchCategoryModalVisible, setVisualSearchCategoryModalVisible] = useState(false);
  const handleSelectVisualSearchCategory = useCallback((_categoryId: string) => {
    setVisualSearchCategoryModalVisible(false);
    setVisualSearchModalVisible(true);
  }, []);
  const homeSearchInputRef = useRef<TextInput>(null);
  const getLocalizedCategoryLabel = (cat: any) => locale === 'ps' ? (cat.namePs || cat.name) : locale === 'fa' ? (cat.nameFa || cat.name) : cat.name;
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [productPage, setProductPage] = useState(1);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialCatalogLoadComplete, setInitialCatalogLoadComplete] = useState(false);
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const startVisualScanner = useCallback(() => {
    visualScanAnim.setValue(0);
    Animated.loop(Animated.sequence([
      Animated.timing(visualScanAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(visualScanAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, [visualScanAnim]);

  const performVisualSearch = useCallback(async (imageUri: string) => {
    if (!imageUri) return;
    try {
      setVisualSearching(true);
      setVisualSearchImage(imageUri);
      setVisualSearchResults([]);
      setVisualSearchStage('analyzing');
      setVisualSearchProgress(35);
      const embedding = await generateVisualEmbedding(imageUri);
      setVisualSearchStage('searching');
      setVisualSearchProgress(70);

      const response =
        await searchHomeProductsByEmbedding(embedding);

      console.log(
        '🔎 Visual search completed:',
        {
          count:
            response.results.length,
          requestId:
            response.requestId,
          model:
            response.query.model,
          version:
            response.query.version,
        }
      );

      // ======================================================
      // STEP 3 — SAVE RESULTS
      // ======================================================

      setVisualSearchStage('finishing');
      setVisualSearchProgress(100);

      setVisualSearchResults(
        response.results
      );

      router.push(
        '/visual-search-results'
      );

    } catch (error) {
      console.error(
        '❌ Visual search failed:',
        error
      );

    } finally {
      if (isMounted.current) {
        setVisualSearching(false);
      }
    }
  },
  [
    router,
    setVisualSearchResults,
  ]
);


const handleOpenVisualSearch = useCallback(() => {
  setVisualSearchModalVisible(true);
}, []);

const handleRunVisualParityTest = useCallback(async () => {
  setVisualSearchModalVisible(false);

  try {
    return;
  } catch (error) {
    console.error(
      '❌ Visual parity test failed:',
      error
    );
  }
}, []);

const handleTakePhoto = useCallback(
  async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        console.warn('📷 Camera permission denied');
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const imageUri = result.assets[0]?.uri;

      if (!imageUri) {
        return;
      }

      setVisualSearchModalVisible(false);

      await performVisualSearch(imageUri);

    } catch (error) {
      console.error(
        '❌ Camera visual search failed:',
        error
      );

      setVisualSearching(false);
    }
  },
  [performVisualSearch]
);


const handlePickImage = useCallback(
  async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        console.warn('🖼️ Gallery permission denied');
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const imageUri = result.assets[0]?.uri;

      if (!imageUri) {
        return;
      }

      setVisualSearchModalVisible(false);

      console.log(
        '🖼️ Visual search image selected:',
        imageUri
      );

      await performVisualSearch(imageUri);

    } catch (error) {
      console.error(
        '❌ Gallery visual search failed:',
        error
      );

      setVisualSearching(false);
    }
  },
  [performVisualSearch]
);

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

const loadMoreProducts = useCallback(async () => {
  if (loadingMoreProducts || !hasMoreProducts) return;

  setLoadingMoreProducts(true);
  const nextPage = productPage + 1;

  try {
    const nextProducts = await safeFetchAndSyncProducts(20, nextPage);

    if (!isMounted.current) return;

    setHasMoreProducts(nextProducts.length === 20);
    setProductPage(nextPage);

    if (nextProducts.length > 0) {
      setProducts((currentProducts) => {
        const existingIds = new Set(currentProducts.map((product) => String(product.id)));
        return [
          ...currentProducts,
          ...nextProducts.filter((product: any) => !existingIds.has(String(product.id))),
        ];
      });
      setDisplayLimit((currentLimit) => Math.max(currentLimit, nextPage * 20));
    }
  } finally {
    if (isMounted.current) setLoadingMoreProducts(false);
  }
}, [hasMoreProducts, loadingMoreProducts, productPage, safeFetchAndSyncProducts]);


  // 🎯 THE STABLE SECURED ATOMIC SYSTEM LOADER (HOME VIEW)
  const handleLoadData = useCallback(async (isInitialLoad = false) => {
    let online = false;

    try {
      if (isInitialLoad) {
        setIsLoading(true);
        setInitialCatalogLoadComplete(false);
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

      if (isMounted.current) {
        if (settingsResult) setSettings(settingsResult);
        setCategories(localCats || []);
        setProducts(shuffleArray(localProds || []));
        if (localProds.length > 0) {
          setIsLoading(false);
        }
      }

      if (isMounted.current) {
        setRemoteSyncing(true);
      }

      online = await isOnline().catch(() => false);

      if (online) {
        const categoriesRequest = fetchRemoteCategories()
          .then((remoteCategories) => {
            if (isMounted.current && remoteCategories.length > 0) {
              setCategories(remoteCategories);
            }
          })
          .catch((error) => {
            console.warn('⚠️ Category refresh failed:', error);
          });

        const firstProducts = await safeFetchAndSyncProducts(20, 1);

        if (isMounted.current) {
          if (firstProducts.length > 0) {
            setProducts(firstProducts);
            setProductPage(1);
            setDisplayLimit(20);
            setHasMoreProducts(firstProducts.length === 20);
            setIsLoading(false);
          }
        }

        await categoriesRequest;
      }

      if (isMounted.current) {
        setRemoteSyncing(false);
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
        setIsLoading(false);
        setRefreshing(false);
        if (isInitialLoad) setInitialCatalogLoadComplete(true);
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
  const preloadTask = InteractionManager.runAfterInteractions(() => {
    preloadVisualEmbeddingModel().catch((error) => {
      console.warn('Visual search model preload failed:', error);
    });
  });

  return () => preloadTask.cancel();
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
  <View
  style={[
    styles.searchContainer,
    isRTL && { flexDirection: 'row-reverse' },
  ]}
>
  {/* SEARCH ICON */}
  <Ionicons
    name="search-outline"
    size={18}
    color="#666"
    style={{ opacity: 0.7 }}
  />

  {/* TEXT SEARCH */}
  <TextInput
    ref={homeSearchInputRef}
    placeholder={t('searchProduct') || 'SEARCH...'}
    placeholderTextColor="#999"

    value={searchInputRefValue.current}

    onChangeText={(text) => {
      searchInputRefValue.current = text;
      setSearchQuery(text);
    }}

    autoCorrect={false}
    autoCapitalize="none"
    spellCheck={false}
    returnKeyType="search"
    blurOnSubmit={false}

    style={[
      styles.searchInput,
      {
        flex: 1,
        minWidth: 0,
      },
      isRTL
        ? {
            textAlign: 'right',
            marginRight: 10,
          }
        : {
            textAlign: 'left',
            marginLeft: 10,
          },
    ]}
  />

   {/* CLEAR TEXT */}
  {searchQuery.length > 0 && (
    <TouchableOpacity
      onPress={() => {
        searchInputRefValue.current = '';
        setSearchQuery('');
      }}
      hitSlop={{
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      }}
      style={styles.searchActionButton}
    >
      <Ionicons
        name="close-circle"
        size={17}
        color="#888"
      />
    </TouchableOpacity>
  )}

  <TouchableOpacity
    onPress={handleOpenVisualSearch}
    activeOpacity={0.7}
    style={styles.visualSearchButton}
    hitSlop={{
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    }}
  >
    <Ionicons
      name="camera-outline"
      size={22}
      color="#111"
    />
  </TouchableOpacity> 
</View>
{renderAdvertisements()}
      {/* CATEGORIES (UNCHANGED STABLE BLOCK) */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          {Array.from({ length: Math.ceil(categories.length / 3) }, (_, columnIndex) => {
            const column = categories.slice(columnIndex * 3, columnIndex * 3 + 3);

            return (
              <View key={`category-column-${columnIndex}`} style={styles.categoryColumn}>
                {column.map((cat: any) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.catCircleItem}
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
            );
          })}
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
      onEndReached={loadMoreProducts}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loadingMoreProducts ? (
          <View style={styles.productLoadingFooter}>
            <SkeletonGrid count={4} />
            <ActivityIndicator style={styles.productLoadingSpinner} color="#111111" />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => handleLoadData(false)}
          tintColor="#000000"
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          {isLoading || !initialCatalogLoadComplete ? (
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

  <VisualSearchLoadingOverlay
    visible={visualSearching}
    imageUri={visualSearchImage}
    progress={visualSearchProgress}
    stage={visualSearchStage}
    locale={locale}
  />

  
  {/* Category selection is intentionally disabled for unrestricted visual search. */}
  {false && <Modal
    visible={visualSearchCategoryModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setVisualSearchCategoryModalVisible(false)
  }
>
  <View style={styles.visualCategoryOverlay}>
    <TouchableOpacity
      style={styles.visualCategoryBackdrop}
      activeOpacity={1}
      onPress={() =>
        setVisualSearchCategoryModalVisible(false)
      }
    />

    <View
      style={[
        styles.visualCategorySheet,
        isRTL && {
          direction: 'rtl',
        },
      ]}
    >
      {/* HEADER */}
      <View style={styles.visualCategoryHeader}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.visualCategoryTitle,
              isRTL && { textAlign: 'right' },
            ]}
          >
            {locale === 'ps'
              ? 'کټګوري وټاکئ'
              : locale === 'fa'
              ? 'دسته‌بندی را انتخاب کنید'
              : 'SELECT SEARCH CATEGORY'}
          </Text>

          <Text
            style={[
              styles.visualCategorySubtitle,
              isRTL && { textAlign: 'right' },
            ]}
          >
            {locale === 'ps'
              ? 'لومړی کټګوري وټاکئ، بیا د محصول عکس واخلئ یا له ګالري څخه یې انتخاب کړئ.'
              : locale === 'fa'
              ? 'ابتدا یک دسته‌بندی انتخاب کنید، سپس از محصول عکس بگیرید یا آن را از گالری انتخاب کنید.'
              : 'Choose a category first, then take a photo or choose one from your gallery.'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            setVisualSearchCategoryModalVisible(false)
          }
          style={styles.modalCloseButton}
        >
          <Ionicons
            name="close"
            size={22}
            color="#111"
          />
        </TouchableOpacity>
      </View>

      {/* CATEGORY LIST */}
      <FlatList
        data={categories.filter(
          (category) => !category.parentId
        )}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 8,
        }}
        renderItem={({ item: category }) => (
          <TouchableOpacity
            style={[
              styles.visualCategoryOption,
              isRTL && {
                flexDirection: 'row-reverse',
              },
            ]}
            activeOpacity={0.8}
            onPress={() =>
              handleSelectVisualSearchCategory(
                String(category.id)
              )
            }
          >
            <View style={styles.visualCategoryImageCircle}>
              <CachedImage
                remoteUrl={category.imageUrl}
                style={styles.visualCategoryImage}
              />
            </View>

            <View
              style={[
                styles.visualCategoryOptionTextLegacy,
                isRTL && {
                  alignItems: 'flex-end',
                },
              ]}
            >
              <Text
                style={[
                  styles.visualCategoryOptionTitle,
                  isRTL && {
                    textAlign: 'right',
                  },
                ]}
                numberOfLines={1}
              >
                {getLocalizedCategoryLabel(
                  category
                )}
              </Text>
            </View>


          </TouchableOpacity>
        )}
      />

      {/* CANCEL */}
      <TouchableOpacity
        style={styles.visualCategoryCancel}
        activeOpacity={0.8}
        onPress={() =>
          setVisualSearchCategoryModalVisible(false)
        }
      >
        <Text style={styles.visualCategoryCancelText}>
          {locale === 'ps'
            ? 'لغوه'
            : locale === 'fa'
            ? 'لغو'
            : 'CANCEL'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>}

<Modal
  visible={visualSearchModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setVisualSearchModalVisible(false)
  }
>
  <View style={styles.visualSearchOverlay}>
    <TouchableOpacity
      style={styles.visualSearchBackdrop}
      activeOpacity={1}
      onPress={() =>
        setVisualSearchModalVisible(false)
      }
    />

    <View
      style={[
        styles.visualSearchSheet,
        isRTL && {
          direction: 'rtl',
        },
      ]}
    >
      {/* HEADER */}
      <View style={styles.visualSearchHeader}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.visualSearchTitle,
              isRTL && { textAlign: 'right' },
            ]}
          >
            {locale === 'ps'
              ? 'د عکس له لارې لټون'
              : locale === 'fa'
              ? 'جستجو با تصویر'
              : 'SEARCH BY IMAGE'}
          </Text>

          <Text
            style={[
              styles.visualSearchSubtitle,
              isRTL && { textAlign: 'right' },
            ]}
          >
            {locale === 'ps'
              ? 'عکس واخلئ یا له ګالري څخه انتخاب کړئ'
              : locale === 'fa'
              ? 'عکس بگیرید یا از گالری انتخاب کنید'
              : 'Find similar products using a photo'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            setVisualSearchModalVisible(false)
          }
          style={styles.modalCloseButton}
        >
          <Ionicons
            name="close"
            size={22}
            color="#111"
          />
        </TouchableOpacity>
      </View>

      {/* CAMERA */}
      <TouchableOpacity
        style={styles.visualSearchOption}
        activeOpacity={0.8}
        onPress={handleTakePhoto}
      >
        <View style={styles.visualSearchIconCircle}>
          <Ionicons
            name="camera"
            size={25}
            color="#111"
          />
        </View>

        <View style={styles.visualSearchOptionText}>
          <Text style={styles.visualSearchOptionTitle}>
            {locale === 'ps'
              ? 'عکس واخلئ'
              : locale === 'fa'
              ? 'عکس بگیرید'
              : 'TAKE A PHOTO'}
          </Text>

          <Text style={styles.visualSearchOptionSubtitle}>
            {locale === 'ps'
              ? 'د کامرې په وسیله ورته محصولات ومومئ'
              : locale === 'fa'
              ? 'محصولات مشابه را با دوربین پیدا کنید'
              : 'Find similar products with your camera'}
          </Text>
        </View>

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color="#999"
        />
      </TouchableOpacity>

      {/* GALLERY */}
      <TouchableOpacity
        style={styles.visualSearchOption}
        activeOpacity={0.8}
        onPress={handlePickImage}
      >
        <View style={styles.visualSearchIconCircle}>
          <Ionicons
            name="images-outline"
            size={25}
            color="#111"
          />
        </View>

        <View style={styles.visualSearchOptionText}>
          <Text style={styles.visualSearchOptionTitle}>
            {locale === 'ps'
              ? 'له ګالري څخه انتخاب کړئ'
              : locale === 'fa'
              ? 'از گالری انتخاب کنید'
              : 'CHOOSE FROM GALLERY'}
          </Text>

          <Text style={styles.visualSearchOptionSubtitle}>
            {locale === 'ps'
              ? 'له موجود عکس څخه ورته محصولات ومومئ'
              : locale === 'fa'
              ? 'محصولات مشابه را از یک عکس موجود پیدا کنید'
              : 'Find similar products from an existing photo'}
          </Text>
        </View>

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={20}
          color="#999"
        />
      </TouchableOpacity>

    </View>
  </View>
</Modal>


  </View>
);
}

const styles = StyleSheet.create({
  productLoadingFooter: {
    minHeight: 260,
  },
  productLoadingSpinner: {
    marginBottom: 18,
  },
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

searchActionButton: {
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 8,
},

visualSearchButton: {
  width: 38,
  height: 38,
  borderRadius: 19,

  justifyContent: 'center',
  alignItems: 'center',

  backgroundColor: '#F5F5F5',
},

visualCategoryOverlay: {
  flex: 1,
  justifyContent: 'center',
  padding: 20,
  backgroundColor: 'rgba(0,0,0,0.45)',
},


visualCategoryBackdrop: {
  ...StyleSheet.absoluteFillObject,
},

visualCategorySheet: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 18,
  paddingTop: 20,
  paddingBottom: 24,
  maxHeight: '82%',
},

visualCategoryHeader: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 16,
},

visualCategoryTitle: {
  fontSize: 18,
  fontWeight: '800',
  color: '#111',
  marginBottom: 6,
},

visualCategorySubtitle: {
  fontSize: 13,
  lineHeight: 19,
  color: '#777',
  paddingRight: 8,
},

visualCategoryOptionLegacy: {
  minHeight: 68,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 9,
  marginBottom: 8,
  borderRadius: 14,
  backgroundColor: '#F7F7F7',
},

visualCategoryImageCircle: {
  width: 48,
  height: 48,
  borderRadius: 24,
  overflow: 'hidden',
  backgroundColor: '#EDEDED',
},

visualCategoryImage: {
  width: '100%',
  height: '100%',
},

visualCategoryOptionTextLegacy: {
  flex: 1,
  marginHorizontal: 12,
},

visualCategoryOptionTitle: {
  fontSize: 15,
  fontWeight: '700',
  color: '#111',
},

visualCategoryCancelLegacy: {
  marginTop: 8,
  height: 48,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F1F1F1',
},

visualCategoryCancelTextLegacy: {
  fontSize: 14,
  fontWeight: '700',
  color: '#555',
},


visualCategoryList: {
  paddingTop: 14,
  paddingBottom: 4,
},

visualCategoryRow: {
  gap: 8,
},

visualCategoryOption: {
  flex: 1,
  minHeight: 46,
  marginBottom: 8,
  paddingHorizontal: 10,
  borderRadius: 11,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F5F5F5',
},

visualCategoryOptionText: {
  fontSize: 11,
  fontWeight: '800',
  color: '#111111',
},

visualCategoryCancel: {
  minHeight: 38,
  alignItems: 'center',
  justifyContent: 'center',
},

visualCategoryCancelText: {
  fontSize: 12,
  fontWeight: '800',
  color: '#777777',
},

visualSearchOverlay: {
  flex: 1,
  justifyContent: 'flex-end',
},

visualSearchBackdrop: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.45)',
},

visualSearchSheet: {
  backgroundColor: '#FFFFFF',

  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,

  paddingHorizontal: 20,
  paddingTop: 22,
  paddingBottom: 35,
},

visualSearchHeader: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',

  marginBottom: 20,
},

visualSearchTitle: {
  fontSize: 20,
  fontWeight: '800',
  color: '#111',
},

visualSearchSubtitle: {
  marginTop: 5,

  fontSize: 12,
  color: '#777',

  maxWidth: 280,
},

modalCloseButton: {
  width: 36,
  height: 36,

  borderRadius: 18,

  backgroundColor: '#F4F4F4',

  justifyContent: 'center',
  alignItems: 'center',
},

visualSearchOption: {
  minHeight: 78,

  flexDirection: 'row',
  alignItems: 'center',

  paddingHorizontal: 14,
  paddingVertical: 12,

  marginBottom: 10,

  borderRadius: 18,

  backgroundColor: '#F8F8F8',
},

visualSearchIconCircle: {
  width: 50,
  height: 50,

  borderRadius: 25,

  backgroundColor: '#FFFFFF',

  justifyContent: 'center',
  alignItems: 'center',

  marginRight: 14,
},



/* =========================
   IMAGE SCANNER
========================= */

visualScannerFrame: {
  width: '100%',
  height: 240,
  borderRadius: 18,
  overflow: 'hidden',
  backgroundColor: '#F4F4F4',
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
},

visualScannerImage: {
  width: '100%',
  height: '100%',
},

visualScannerLine: {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: '#111111',
  opacity: 0.9,

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 0,
  },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 4,
},

/* =========================
   SCANNER CORNERS
========================= */

scannerCorner: {
  position: 'absolute',
  width: 28,
  height: 28,
  borderColor: '#111111',
},

cornerTopLeft: {
  top: 12,
  left: 12,
  borderTopWidth: 3,
  borderLeftWidth: 3,
  borderTopLeftRadius: 5,
},

cornerTopRight: {
  top: 12,
  right: 12,
  borderTopWidth: 3,
  borderRightWidth: 3,
  borderTopRightRadius: 5,
},

cornerBottomLeft: {
  bottom: 12,
  left: 12,
  borderBottomWidth: 3,
  borderLeftWidth: 3,
  borderBottomLeftRadius: 5,
},

cornerBottomRight: {
  bottom: 12,
  right: 12,
  borderBottomWidth: 3,
  borderRightWidth: 3,
  borderBottomRightRadius: 5,
},

/* =========================
   PROGRESS
========================= */

visualProgressContainer: {
  width: '100%',
  height: 6,
  backgroundColor: '#E8E8E8',
  borderRadius: 999,
  overflow: 'hidden',
  marginTop: 22,
},

visualProgressBar: {
  height: '100%',
  backgroundColor: '#111111',
  borderRadius: 999,
},

visualSearchProgress: {
  marginTop: 10,
  fontSize: 18,
  fontWeight: '700',
  color: '#111111',
  letterSpacing: 0.3,
},



visualSearchOptionText: {
  flex: 1,
},

visualSearchOptionTitle: {
  fontSize: 13,
  fontWeight: '800',
  color: '#111',
},

visualSearchOptionSubtitle: {
  marginTop: 4,

  fontSize: 11,
  color: '#888',

  lineHeight: 16,
},

visualSearchParityOption: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 12,
  paddingVertical: 12,
  borderTopWidth: 1,
  borderTopColor: '#E5E5E5',
},

visualSearchParityText: {
  fontSize: 11,
  fontWeight: '700',
  color: '#777',
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
  width: 88,
  marginBottom: 12,
},

categoryColumn: {
  width: 88,
  alignItems: 'center',
  marginRight: 10,
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

visualSearchLoadingOverlay: {
  ...StyleSheet.absoluteFillObject,

  backgroundColor: 'rgba(250,250,250,0.92)',

  justifyContent: 'center',
  alignItems: 'center',

  zIndex: 999,
},

visualSearchLoadingCard: {
  width: '78%',

  backgroundColor: '#FFF',

  borderRadius: 24,

  paddingVertical: 30,
  paddingHorizontal: 24,

  alignItems: 'center',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 8,
  },
  shadowOpacity: 0.1,
  shadowRadius: 20,

  elevation: 8,
},

visualSearchLoadingTitle: {
  marginTop: 18,

  fontSize: 15,
  fontWeight: '800',

  color: '#111',

  textAlign: 'center',
},

visualSearchLoadingSubtitle: {
  marginTop: 7,

  fontSize: 12,

  color: '#888',

  textAlign: 'center',
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