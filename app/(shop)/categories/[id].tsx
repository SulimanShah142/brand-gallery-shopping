import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, Image, Dimensions, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/Contexts/LanguageContext';
import CachedImage from '@/components/CachedImage';
import { execSql, initOfflineDb, isOnline, loadCategoryLocal, loadProductsByCategoryLocal, loadProductsLocal, loadSubcategoriesLocal, syncRemoteCatalog, fetchAndSyncProducts, shuffleArray } from '@/lib/offline';
import SkeletonGrid from '@/components/SkeletonGrid';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;

// Mock external offline functions hooks declarations

export default function CategoryPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t, isRTL, locale } = useLanguage(); 
  const insets = useSafeAreaInsets();
    const [subSearchQuery, setSubSearchQuery] = useState('');

  // 🎯 CORE STATUS CONFIGURATIONS - REPLICATED FROM WORKING CATEGORIES DESIGN
  // 🎯 CORE STATUS CONFIGURATIONS - REPLICATED FROM WORKING CATEGORIES DESIGN
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [category, setCategory] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  // 🎯 HIGH-PRECISION RE-ENGINEERED MASTER CATEGORY CEILING ENGINE (ZERO-NaN)
  const calculateAfnPriceNum = useCallback((usdPrice: string | number | null | undefined, productProfitPercentage?: string | number | null) => {
    // 1. Sanitize incoming exchange rate constants securely out of the flat settings state
    const rate = parseFloat(String(settings?.usdToAfnRate || '65').replace(/[^0-9.]/g, '')) || 65;
    const profit = parseFloat(String(productProfitPercentage ?? '20').replace(/[^0-9.]/g, '')) || 20;
    
    // 2. Safeguard the raw database numerical parameters string
    const cleanUsdString = String(usdPrice || '0').replace(/[^0-9.]/g, '').trim();
    const parsedUsdPrice = parseFloat(cleanUsdString || '0');

    // 3. Fallback recovery protection matrix to prevent NaN cascade crashes
    if (isNaN(parsedUsdPrice) || isNaN(rate) || isNaN(profit)) {
      return 0;
    }
    
    // Base markup calculation conversion formula
    const baseRawAfn = parsedUsdPrice * rate * (1 + profit / 100);
    
    // 🎯 Forces ending number to always be a clean zero via 10-base ceilings
    return Math.ceil(baseRawAfn / 10) * 10;
  }, [settings]);

  // 🎯 HIGH-PRECISION HOME CATALOG CEILING MARKUP MATRIX
  const getDisplayPrice = useCallback((usdPrice: string, productProfitPercentage?: string | number | null) => {
    const rate = parseFloat(settings?.usdToAfnRate || '65');
    const profit = parseFloat(String(productProfitPercentage ?? '20').replace(/[^0-9.]/g, '')) || 20;
    
    // Calculate raw basic converted exchange balances
    const baseCurrent = parseFloat(usdPrice || '0') * rate * (1 + profit / 100);
    const baseOld = parseFloat(usdPrice || '0') * rate * (1 + (profit + 15) / 100);
    
    // 🎯 THE UNIVERSAL CEILING FIX: Forces endings to always be zero
    const currentPriceCalculated = Math.ceil(baseCurrent / 10) * 10;
    const oldPriceCalculated = Math.ceil(baseOld / 10) * 10;
    
    return {
      current: currentPriceCalculated,
      old: oldPriceCalculated
    };
  }, [settings]);

  // 🎯 UNIVERSAL NUMBERS TRANSLATOR METHOD 
  const toLocalNumbers = useCallback((num: string | number) => {
    const stringValue = String(num || '0');
    if (locale === 'en' || !locale) return Number(stringValue).toLocaleString('en-US');
    
    const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return stringValue.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  }, [locale]);

  // 🎯 IN-MEMORY INTEGRATED FILTER ENGINE BLOCK
  const displayedCategoryProducts = useMemo(() => {
    let result = [...products];

    if (id) {
      result = result.filter((p: any) => String(p.categoryId || p.category_id) === String(id));
    }

    const cleanSubQuery = subSearchQuery.toLowerCase().trim();
    if (cleanSubQuery) {
      result = result.filter((p: any) => 
        (p.name || '').toLowerCase().includes(cleanSubQuery) ||
        (p.namePs || p.name_ps || '').toLowerCase().includes(cleanSubQuery) ||
        (p.nameFa || p.name_fa || '').toLowerCase().includes(cleanSubQuery)
      );
    }

    return result;
  }, [products, id, subSearchQuery]);

  // 🎯 HARDENED SEQUENTIAL LINEAR LOGIC SEEDING PIPELINE
  const loadData = useCallback(async (catId: string) => {
    if (!catId) return;
    
    try {
      setLoading(true);
      // Enforce local database table layout initialization gates first
      await initOfflineDb(); 
      console.log(`📂 [IN-MEMORY REPLICATION SYSTEM] Syncing target context category node: ${catId}`);

      // 🎯 THE SEQUENTIAL RE-ORDER FIX: 
      // Load local disk records sequentially instead of parallel Promise.all 
      // to completely stop 'no transaction active' database read collisions!
      const localCat = await loadCategoryLocal(catId).catch(() => null);
      const localSubs = await loadSubcategoriesLocal(catId).catch(() => []);
      const localProds = await loadProductsLocal().catch(() => []);
      
      let settingsResult = null;
      try {
        let settingsQuery = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => null);
        if (!settingsQuery || settingsQuery.length === 0) {
          settingsQuery = await execSql('SELECT * FROM local_settings LIMIT 1;').catch(() => null);
        }
        if (settingsQuery && settingsQuery.length > 0) {
          // 🎯 THE EXTRACTION CURE: Pick the first index element data row precisely to feed variables!
          settingsResult = settingsQuery[0];
        }
      } catch {}

      if (localCat) setCategory(localCat);
      setSubcategories(localSubs || []);
      setProducts(shuffleArray(localProds || []));
      if (settingsResult) setSettings(settingsResult);

      setLoading(false);

      // 🎯 BACKWARD DELAY MATRIX GATES:
      // Offloads background cloud queries cleanly outside your primary component frame paint time.
      const online = await isOnline().catch(() => false);
      if (online) {
        setTimeout(async () => {
          console.log("🛰️ [BACKGROUND SYNC] Refreshing context-locked category catalog vectors from cloud...");
          const syncSuccess = await syncRemoteCatalog().catch(() => {
            execSql('ROLLBACK;').catch(() => {});
            return false;
          });
          
          if (syncSuccess) {
            const freshCatNode = await loadCategoryLocal(catId).catch(() => null);
            const freshSubNodes = await loadSubcategoriesLocal(catId).catch(() => []);
            const freshProds = await loadProductsLocal().catch(() => []);
            
            let freshSettingsQuery = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => null);
            if (!freshSettingsQuery || freshSettingsQuery.length === 0) {
              freshSettingsQuery = await execSql('SELECT * FROM local_settings LIMIT 1;').catch(() => null);
            }

            if (freshCatNode) setCategory(freshCatNode);
            setSubcategories(freshSubNodes || []);
            setProducts(shuffleArray(freshProds || []));
            
            if (freshSettingsQuery && freshSettingsQuery.length > 0) {
              setSettings(freshSettingsQuery[0]);
              console.log("✨ [LIVE MARKUP SYNC] Category screen markup values updated atomically.");
            }
          }
        }, 1000); // 1-second delay ensures the database engine is free to commit background writes safely
      }
    } catch (err: any) {
      console.error('❌ Context-locked category sheet retrieval exception:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      console.log(`📂 [ROUTING ENTRY] Re-seeding details screen scope array blocks for category: ${id}`);
      loadData(id as string);
      // background sync for this category
      let mounted = true;
      (async () => {
        try {
          setRemoteSyncing(true);
          const synced = await fetchAndSyncProducts(50, 1, id as string).catch(() => []);
          if (synced && synced.length > 0 && mounted) {
            const fresh = await loadProductsLocal().catch(() => []);
            if (mounted) setProducts(shuffleArray(fresh || []));
          }
        } catch (e) {
          console.warn('Category background sync failed', e);
        } finally {
          if (mounted) setRemoteSyncing(false);
        }
      })();
      return () => { mounted = false; };
    }
  }, [id, loadData]);

  // 🎯 MULTILINGUAL CATEGORIES DETAILS GRID CARD ITEM RENDERER
  const renderProduct = ({ item }: { item: any }) => {
    // DYNAMIC TEXT PROXIES SELECTOR: Safely extracts correct language keys
    const productTitle = 
      locale === 'ps' ? (item.namePs || item.name) : 
      locale === 'fa' ? (item.nameFa || item.name) : 
      item.name;

    // 🎯 THE COMPILER FIX: Call the numeric calculator function directly!
    const calculatedNumericPrice = calculateAfnPriceNum(item.usdPrice, item.profitPercentage);

    return (
      <TouchableOpacity 
        key={`category-prod-card-${item.id}`}
        style={styles.productCard} 
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <CachedImage 
            remoteUrl={item.imageUrl} 
            style={styles.productImage} 
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => setFavorites(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
            style={[styles.wishlistBtn, isRTL ? { left: 10, right: undefined } : { right: 10, left: undefined }]}
          >
            <Ionicons
              name={favorites[item.id] ? "heart" : "heart-outline"}
              size={22}
              color={favorites[item.id] ? "#FF3B30" : "#111111"}
            />
          </TouchableOpacity>
        </View>
        
        {/* RTL Text Horizontal Grid Direction Checks */}
        <View style={[styles.productInfo, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          <Text style={[styles.productName, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
            {productTitle ? productTitle.toUpperCase() : "UNNAMED PIECE"}
          </Text>
          
          {/* THE FORMATTING ALIGNMENT MATCH: Renders rounded prices flawlessly with correct Arabic digits! */}
          <Text style={[styles.productPrice, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
            {isRTL ? `${toLocalNumbers(calculatedNumericPrice)} افغانۍ` : `AFN ${toLocalNumbers(calculatedNumericPrice)}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }; // 🎯 FIXED: Re-sealed outer renderProduct arrow function block boundary

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const categoryHeaderLabel = category
    ? (locale === 'ps' ? (category.namePs || category.name) :
       locale === 'fa' ? (category.nameFa || category.name) :
       category.name)
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* NATIVE HEADER ROW SPACING */}
      <View style={[styles.navigationTopBarRow, { paddingTop: insets.top + 10 }, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonCell}>
          <Ionicons name={isRTL ? "chevron-back" : "chevron-back"} size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.screenMainHeaderTitleText}>
          {categoryHeaderLabel?.toUpperCase()}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* 🎯 THE COMPONENT TREE CORRECTION: 
          Re-sealed the properties array list inside a single unified FlatList tree! */}
      <FlatList
        data={displayedCategoryProducts}
        keyExtractor={(item : any) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={[styles.gridRow, isRTL && { flexDirection: 'row-reverse' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {subcategories.length > 0 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.subCatScroll}
                contentContainerStyle={{ paddingHorizontal: 15 }}
                // 🎯 THE FIX: Removed the non-existent 'inverted' attribute entirely.
                // To support natural right-to-left layout streams natively for RTL contexts, 
                // React Native relies automatically on the parent container flex styling rules instead!
              >
                {subcategories.map((sub) => {
                  const subCategoryLabel = 
                    locale === 'ps' ? (sub.namePs || sub.name) : 
                    locale === 'fa' ? (sub.nameFa || sub.name) : 
                    sub.name;

                  return (
                    <TouchableOpacity 
                      key={`sub-cat-${sub.id}`} 
                      style={styles.subCatCapsule} 
                      onPress={() => router.push(`/categories/${sub.id}`)}
                    >
                      <Text style={styles.subCatText}>{subCategoryLabel.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            
            {/* SEARCH CONTROLS CONTROL PANEL */}
            <View style={[styles.subCategorySearchControlsRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.subSearchBarFrame, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="search-outline" size={15} color="#666666" style={{ marginHorizontal: 8 }} />
                <TextInput
                  style={[styles.subSearchTextInput, isRTL && { textAlign: 'right' }]}
                  placeholder={locale === 'ps' ? 'په دې کټګورۍ کې لټون...' : locale === 'fa' ? 'جستجو در این دسته بندی...' : 'SEARCH WITHIN CATEGORY...'}
                  placeholderTextColor="#999999"
                  value={subSearchQuery}
                  onChangeText={setSubSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>

              <View style={styles.resultsBadgeFrame}>
                <Text style={styles.resultsCount}>
                  {toLocalNumbers(displayedCategoryProducts.length)} {locale === 'ps' ? 'قلم پيدا شو' : locale === 'fa' ? 'مورد یافت شد' : 'ITEMS'}
                </Text>
              </View>
            </View>
          </View>
        }

        renderItem={renderProduct}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={44} color="#CCCCCC" />
            <Text style={styles.emptyText}>{t('noProducts') || 'No products found matching category.'}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      /> {/* 🎯 CLEAN TERMINATING CLOSURE TAG RE-ANCHORED FLUSH TO BOTTOM BOUNDS */}
    </View>
  );
}


const styles = StyleSheet.create({

  // =========================
  // HEADER (REFINED PREMIUM BAR)
  // =========================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 14, // Generates clean uniform gutters between vertical grid row sets
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },

  title: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#0A0A0A',
  },

  subtitle: {
    fontSize: 10,
    color: '#8A8A8A',
    marginTop: 3,
    letterSpacing: 0.3,
  },

  headerContent: {
    backgroundColor: '#FFFFFF',
  },

  navigationTopBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },

  backButtonCell: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
  },

  screenMainHeaderTitleText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#000000',
    textTransform: 'uppercase',
  },

  // =========================
  // SEARCH + FILTER BAR (MODERN FLOAT FEEL)
  // =========================
  subCategorySearchControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
    gap: 10,
  },

  subSearchBarFrame: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 10,
  },

  subSearchTextInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#111111',
    letterSpacing: 0.3,
  },

  resultsBadgeFrame: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  resultsCount: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1,
  },

  // =========================
  // SUB CATEGORY CHIPS (MORE PREMIUM)
  // =========================
  subCatScroll: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingLeft: 14,
  },

  subCatCapsule: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    marginRight: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDEDED',
  },

  subCatText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.6,
  },

  // =========================
  // FILTER BAR (CLEAN TOOL STRIP)
  // =========================
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  filterBtnText: {
    fontSize: 10,
    fontWeight: '800',
    marginRight: 4,
    color: '#111111',
  },

  // =========================
  // GRID SYSTEM (MORE AIR + BALANCE)
  // =========================
  list: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 100,
  },

  columnWrapper: {
    justifyContent: 'space-between',
  },

  row: {
    justifyContent: 'space-between',
  },

  productCard: {
    width: COLUMN_WIDTH,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // =========================
  // IMAGE (MORE LUXE FEEL)
  // =========================
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#F7F7F7',
    overflow: 'hidden',
    borderRadius: 12,
  },

  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // =========================
  // PRODUCT INFO (IMPROVED TYPOGRAPHY STACK)
  // =========================
  productInfo: {
    paddingTop: 10,
    paddingHorizontal: 6,
  },

  productName: {
    fontSize: 11,
    color: '#222222',
    fontWeight: '600',
    lineHeight: 15,
    letterSpacing: 0.2,
  },

  productPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    marginTop: 4,
  },

  wasPrice: {
    fontSize: 9,
    color: '#B5B5B5',
    textDecorationLine: 'line-through',
  },

  // =========================
  // BADGES (MODERN MINIMAL STYLE)
  // =========================
  saleBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },

  saleText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  tagBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#111',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },

  tagText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  wishlistBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },

  // =========================
  // EMPTY STATE (MORE MODERN)
  // =========================
  emptyContainer: {
    alignItems: 'center',
    marginTop: 120,
  },

  emptyText: {
    fontSize: 11,
    color: '#999999',
    marginTop: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // =========================
  // BASE STATES
  // =========================
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#666',
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  rtlContainer: {
    flexDirection: 'row-reverse',
  },

  rtlText: {
    textAlign: 'right',
  },
});