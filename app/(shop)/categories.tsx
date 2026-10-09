import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  initOfflineDb, 
  loadCategoriesLocal, 
  loadProductsByCategoryLocal, 
  isOnline, 
  syncRemoteCatalog,
  execSql, 
  loadProductsLocal,
  fetchAndSyncProducts,
  shuffleArray
} from '../../lib/offline'; 
import SkeletonGrid from '@/components/SkeletonGrid';
import { useLanguage } from '../../Contexts/LanguageContext';
import CachedImage from '../../components/CachedImage';

const SIDEBAR_WIDTH = 90;
const { width } = Dimensions.get('window');

export default function CategoriesPage() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const [settings, setSettings] = useState<any>(null);

   // 🔍 NEW STATE HOOKS FOR SEARCH & FILTER
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'NONE' | 'PRICE_LOW' | 'PRICE_HIGH'>('NONE');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  // 1. Sidebar logic (Top-level categories only)
  



  // Sidebar Filter Matrix: Extracts top-level categories purely in memory
  const parentCategories = useMemo(() => categories.filter(cat => !cat.parentId), [categories]);

    // 🎯 HIGH-PRECISION RE-ENGINEERED MASTER CATEGORY CEILING ENGINE (ZERO-NaN)
  const calculateAfnPriceNum = (usdPrice: string | number | null | undefined, productProfitPercentage?: string | number | null) => {
    // 1. Sanitize incoming exchange rate constants securely
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
  };

  // 🎯 UNIVERSAL NUMBERS TRANSLATOR METHOD 
  const toLocalNumbers = useCallback((num: string | number) => {
    const stringValue = String(num || '0');
    if (locale === 'en' || !locale) return Number(stringValue).toLocaleString('en-US');
    
    const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return stringValue.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  }, [locale]);

  // MULTILINGUAL DISPLAY FORMATTER PROXIES SYNC
 
  
    // 🎯 HIGH-PRECISION HOME CATALOG CEILING MARKUP MATRIX
    const getDisplayPrice = (usdPrice: string, productProfitPercentage?: string | number | null) => {
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
    };

  // 🎯 MULTILINGUAL PRICE STRING FORMATTER
  
  // 4. Product Fetcher (Triggered when sidebar changes)
  const loadProducts = async (catId: string) => {
    setProductsLoading(true);
    const localProds = await loadProductsByCategoryLocal(catId);
    setProducts(shuffleArray(localProds || []));
    setProductsLoading(false);
  };

  // 🎯 CLEAN COMBINED FRONTEND SEARCH & CATEGORY RADIAL FILTER
  // Replicates the Home Page in-memory selector pattern perfectly!
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. FILTER BY SELECTOR: Restricts grid items to the active sidebar category tab selection
    if (selectedParentId) {
      result = result.filter(p => p.categoryId === selectedParentId);
    }

    // 2. FILTER BY MULTILINGUAL TEXT MATCH: Checks all three target string columns concurrently
    const query = searchQuery.toLowerCase().trim();
    if (query.length > 0) {
      result = result.filter(p => 
        (p.name || '').toLowerCase().includes(query) ||
        (p.namePs || '').toLowerCase().includes(query) ||
        (p.nameFa || '').toLowerCase().includes(query)
      );
    }

    // 3. SORT MATRICES
    if (sortBy === 'PRICE_LOW') {
      result.sort((a, b) => calculateAfnPriceNum(a.usdPrice, a.profitPercentage) - calculateAfnPriceNum(b.usdPrice, b.profitPercentage));
    } else if (sortBy === 'PRICE_HIGH') {
      result.sort((a, b) => calculateAfnPriceNum(b.usdPrice, b.profitPercentage) - calculateAfnPriceNum(a.usdPrice, a.profitPercentage));
    }

    return result;
  }, [products, selectedParentId, searchQuery, sortBy, settings]);

  // 🎯 HIGH-PERFORMANCE SEQUENTIAL INFRASTRUCTURE LOADER ENGINE (RECONCILED LOCKS)
  const handleLoadData = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      
      // 1. Enforce local device database table boundaries initialization check gates first
      await initOfflineDb();
      
      console.log("⚙️ [CATEGORIES] Fetching local records sequentially to prevent SQLite connection thread locks...");

      // 🎯 THE SEQUENTIAL CURE (PART 1): 
      // We completely replace 'Promise.all' read tasks with direct sequential await assignments.
      // This forces the SQLite thread to open, execute, and fully close each query transaction 
      // block in a perfect queue line, completely eliminating collision locks!
      const localCats = await loadCategoriesLocal().catch(() => []);
      const localProds = await loadProductsLocal().catch(() => []);
      const localSettings = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => []);

      setCategories(localCats || []);
      setProducts(shuffleArray(localProds || []));
      
      if (localSettings && localSettings.length > 0) {
        setSettings(localSettings[0]);
      }
      
      // Auto-assign first tab on initial boot pass seamlessly
      if (localCats && localCats.length > 0 && !selectedParentId) {
        const firstParent = localCats.find((c: any) => !c.parentId || c.parentId === null);
        if (firstParent) {
          setSelectedParentId(firstParent.id);
        }
      }
      
      // Release visual loading spinners if historical local records are available on screen
      if (localProds && localProds.length > 0) {
        setLoading(false);
      }

      // 2. Linear Background Catalog Cloud Sync Ingestion Task Handles
      const online = await isOnline().catch(() => false);
      if (online) {
        console.log("🛰️ [CATEGORIES BACKGROUND] Syncing remote schema lines safely...");
        const syncSuccess = await syncRemoteCatalog().catch(() => false);
        
        if (syncSuccess) {
          // 🎯 THE SEQUENTIAL CURE (PART 2):
          // Re-hydrate the fresh background records in a clean sequential line as well!
          const freshCats = await loadCategoriesLocal().catch(() => []);
          const freshProds = await loadProductsLocal().catch(() => []);
          const freshSettings = await execSql('SELECT * FROM app_settings LIMIT 1;').catch(() => []);
          
          setCategories(freshCats || []);
          setProducts(shuffleArray(freshProds || []));
          if (freshSettings && freshSettings.length > 0) {
            setSettings(freshSettings[0]);
          }
        }
      }
    } catch (err) {
      console.error('❌ Categories backend network pipeline failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedParentId]); // Recalibrates safely on selection state changes

  useFocusEffect(
    useCallback(() => {
      setProducts((currentProducts) => shuffleArray(currentProducts));
    }, [])
  );

  // 🎯 ONE-TIME BOOT SEEDING GUARD: 
  // Stripping loose dependency parameters completely stops background query loops 
  // from crashing your active frontend state arrays memory stacks!
  useEffect(() => {
    console.log("🛠️ [LIFECYCLE UNLOCKED] Categories listing page initial mount pass secured.");
    handleLoadData(true);
    // background product sync
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
        console.warn('Categories background sync failed', e);
      } finally {
        if (mounted) setRemoteSyncing(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // 🎯 STSTRICT EMPTY ARRAY GUARDS FORCE ONE-TIME RUN ONLY!

  // Only alter product grids when a user explicitly taps a separate category tab cell
  useEffect(() => {
    if (selectedParentId) {
      console.log(`🛵 [SIDEBAR HOOK] Operator switched active viewing tab to node: ${selectedParentId}`);
      // Safely let your filteredProducts useMemo block handle item isolation locally in memory
    }
  }, [selectedParentId]);


  // 🎯 LOCALIZED PRODUCT ITEM CARD RENDERER
   // 🎯 MULTILINGUAL CATEGORIES GRID CARD ITEM RENDERER
  const renderProductItem = ({ item }: { item: any }) => {
    const productTitle = 
      locale === 'ps' ? (item.namePs || item.name) : 
      locale === 'fa' ? (item.nameFa || item.name) : 
      item.name;

    // Invoke clean numeric translation directly
    const calculatedPriceNum = calculateAfnPriceNum(item.usdPrice, item.profitPercentage);

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.imageWrapper}>
          <CachedImage remoteUrl={item.imageUrl} style={styles.productImage} />
        </View>
        
        {/* RTL Dynamic Text Alignment Shifts */}
        <View style={[styles.productInfo, isRTL ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          <Text style={[styles.productName, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
            {productTitle ? productTitle.toUpperCase() : "UNNAMED ITEM"}
          </Text>
          
          {/* 🎯 THE FORMATTING ALIGNMENT MATCH: Renders prices flawlessly with correct Arabic digits! */}
          <Text style={[styles.productPrice, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
            {isRTL ? `${toLocalNumbers(calculatedPriceNum)} افغانۍ` : `AFN ${toLocalNumbers(calculatedPriceNum)}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };


  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#000000" /></View>;
  // Find currently selected category item to render its active dynamic translation title
  // 🎯 ACTIVE SIDEBAR HEADER SELECTION LOOKUP WITH DUAL-CASING FORMATS
   // 🎯 UPPER VIEW HEADER SELECTION MATRIX RECURSIONS LOOKUP
  const currentActiveCategoryNode = parentCategories.find(p => p.id === selectedParentId);
  
  const currentCategoryTitle = currentActiveCategoryNode
    ? (locale === 'ps' ? (currentActiveCategoryNode.namePs || currentActiveCategoryNode.name_ps || currentActiveCategoryNode.nameps || currentActiveCategoryNode.name) :
       locale === 'fa' ? (currentActiveCategoryNode.nameFa || currentActiveCategoryNode.name_fa || currentActiveCategoryNode.namefa || currentActiveCategoryNode.name) :
       currentActiveCategoryNode.name)
    : '';


  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      
      {/* 🔍 TOP INTERACTIVE CONTROLS BAR */}
      <View style={[styles.filterSearchBarRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.searchBoxFrame, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={16} color="#888888" style={{ marginHorizontal: 6 }} />
          <TextInput
            style={[styles.searchTextInput, isRTL && { textAlign: 'right' }]}
            placeholder={t('searchProduct') || "Search item..."}
            placeholderTextColor="#AAAAAA"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* PRICE FILTER TOGGLE CONTROLLERS */}
        <TouchableOpacity 
          style={[styles.filterActionChip, sortBy !== 'NONE' && styles.filterActionChipActive]}
          onPress={() => {
            if (sortBy === 'NONE') setSortBy('PRICE_LOW');
            else if (sortBy === 'PRICE_LOW') setSortBy('PRICE_HIGH');
            else setSortBy('NONE');
          }}
        >
          <Ionicons 
            name={sortBy === 'PRICE_HIGH' ? "arrow-down-outline" : "arrow-up-outline"} 
            size={14} 
            color={sortBy !== 'NONE' ? '#FFFFFF' : '#000000'} 
          />
          <Text style={[styles.filterChipText, sortBy !== 'NONE' && { color: '#FFFFFF' }]}>
            {sortBy === 'NONE' ? (t('price') || 'PRICE') : sortBy === 'PRICE_LOW' ? 'LOW-HIGH' : 'HIGH-LOW'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🎯 SIDEBAR NAV & PRODUCTS INFINITE GRID CONTAINER AREA */}
      <View style={[styles.container, isRTL && { flexDirection: 'row-reverse' }]}>
        {/* LEFT / RIGHT SIDEBAR CATEGORIES TRACK */}
               {/* LEFT / RIGHT SIDEBAR TRACK */}
               {/* LEFT / RIGHT SIDEBAR CATEGORIES TRACK */}
        <View style={styles.sidebar}>
          <FlatList
            data={parentCategories}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isActive = selectedParentId === item.id;
              
              // 🎯 FOUR-TIER SIDEBAR LABEL PROXY CURE
              const sidebarLabel = 
                locale === 'ps' ? (item.namePs || item.name_ps || item.nameps || item.name) : 
                locale === 'fa' ? (item.nameFa || item.name_fa || item.namefa || item.name) : 
                item.name;

              return (
                <TouchableOpacity
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                  onPress={() => {
                    setSelectedParentId(item.id);
                    setSearchQuery(''); 
                  }}
                >
                  <Text style={[styles.sidebarText, isActive && styles.sidebarTextActive, isRTL && { textAlign: 'right' }]}>
                    {sidebarLabel.toUpperCase()}
                  </Text>
                  {isActive && <View style={[styles.activeLine, isRTL ? { left: 0 } : { right: 0 }]} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>



        {/* RIGHT CONTENT GRID SYSTEM CARDS LIST */}
        <View style={styles.mainContent}>
          {productsLoading || remoteSyncing ? (
            <SkeletonGrid count={8} />
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => (
                <View style={styles.mainHeader}>
                  <Text style={[styles.mainTitle, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
                    {currentCategoryTitle?.toUpperCase()}
                  </Text>
                  <View style={styles.headerDivider} />
                </View>
              )}
              renderItem={renderProductItem}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="basket-outline" size={40} color="#CCCCCC" />
                  <Text style={styles.emptyText}>{t('noProducts') || 'No products found'}</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
  },

  // =========================
  // TOP FILTER BAR (REFINED GLASS-LIKE UI)
  // =========================
  filterSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,
    paddingVertical: 10,

    backgroundColor: '#FFFFFF',

    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,

    gap: 8,
  },

  searchBoxFrame: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: '#F3F4F6',

    borderRadius: 10,

    height: 38,

    paddingHorizontal: 10,

    borderWidth: 1,
    borderColor: '#ECECEC',
  },

  searchTextInput: {
    flex: 1,
    fontSize: 12,
    color: '#111111',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  filterActionChip: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: '#F3F4F6',

    paddingHorizontal: 12,
    height: 38,

    borderRadius: 10,

    gap: 6,

    borderWidth: 1,
    borderColor: '#ECECEC',
  },

  filterActionChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  filterChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: 0.5,
  },

  // =========================
  // SIDEBAR (MODERN STORE NAV)
  // =========================
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#FFFFFF',

    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',

    paddingTop: 6,
  },

  sidebarItem: {
    paddingVertical: 16,
    paddingHorizontal: 8,

    alignItems: 'center',
    position: 'relative',

    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },

  sidebarItemActive: {
    backgroundColor: '#F8F8F8',
  },

  sidebarText: {
    fontSize: 10,
    color: '#999999',

    textAlign: 'center',
    fontWeight: '600',

    letterSpacing: 0.6,
  },

  sidebarTextActive: {
    color: '#111111',
    fontWeight: '900',
  },

  activeLine: {
    position: 'absolute',
    top: '25%',
    bottom: '25%',
    width: 3,
    backgroundColor: '#111111',
    borderRadius: 2,
  },

  // =========================
  // MAIN AREA
  // =========================
  mainContent: {
    flex: 1,
    paddingHorizontal: 10,
  },

  mainHeader: {
    paddingTop: 14,
    paddingBottom: 10,
  },

  mainTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111111',

    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  headerDivider: {
    height: 1,
    backgroundColor: '#EDEDED',
    marginTop: 8,
  },

  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // =========================
  // PRODUCT CARD (THIS IS THE BIG UPGRADE)
  // =========================
  productCard: {
    width: (width - SIDEBAR_WIDTH - 34) / 2,

    backgroundColor: '#FFFFFF',

    borderRadius: 12,

    overflow: 'hidden',

    borderWidth: 1,
    borderColor: '#F0F0F0',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  imageWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,

    backgroundColor: '#F4F4F4',

    overflow: 'hidden',

    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },

  productImage: {
    width: '100%',
    height: '100%',
  },

  productInfo: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },

  productName: {
    fontSize: 11,
    color: '#111111',
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  productPrice: {
    fontSize: 12,
    color: '#111111',
    fontWeight: '900',
    marginTop: 4,
  },

  // =========================
  // EMPTY STATE (MORE PREMIUM)
  // =========================
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 80,

    paddingHorizontal: 20,
  },

  emptyText: {
    fontSize: 12,
    color: '#9A9A9A',

    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});