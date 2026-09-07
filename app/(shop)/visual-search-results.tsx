import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import CachedImage from '@/components/CachedImage';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useVisualSearch, VisualSearchResult } from '@/Contexts/VisualSearchContext';
import { loadProductsLocal } from '@/lib/offline';
import { API_URL } from '@/lib/config';

const { width } = Dimensions.get('window');
const PRODUCT_CARD_WIDTH = (width - 42) / 2;

type ResolvedProduct = VisualSearchResult & {
  id: string;
  name?: string;
  namePs?: string;
  nameFa?: string;
  name_ps?: string;
  name_fa?: string;
  imageUrl?: string;
  usdPrice?: string | number;
  profitPercentage?: string | number | null;
};

function productIdOf(product: any) {
  return String(product?.id ?? product?.productId ?? '');
}

export default function VisualSearchResults() {
  const router = useRouter();
  const { isRTL, locale } = useLanguage();
  const { results, clearResults } = useVisualSearch();
  const [products, setProducts] = useState<ResolvedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingPulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!loading) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(loadingPulse, {
          toValue: 0.55,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [loading, loadingPulse]);

  useEffect(() => {
    let mounted = true;

    const resolveProducts = async () => {
      setLoading(true);

      try {
        const localProducts = await loadProductsLocal();
        const localById = new Map(
          localProducts.map((product: any) => [productIdOf(product), product])
        );

        const missingIds = results
          .map((result) => result.productId)
          .filter((id) => !localById.has(String(id)));

        const remoteProducts = await Promise.all(
          missingIds.map(async (productId) => {
            try {
              const response = await fetch(`${API_URL}/api/products/${productId}`);
              if (!response.ok) return null;
              const payload = await response.json();
              return payload?.product ?? payload?.data ?? payload;
            } catch {
              return null;
            }
          })
        );

        remoteProducts.forEach((product) => {
          if (product) localById.set(productIdOf(product), product);
        });

        const resolved = results.flatMap((result, index) => {
          const product = localById.get(String(result.productId));
          if (!product) return [];

          return [{
            ...product,
            id: productIdOf(product),
            productId: result.productId,
            score: Number(result.score),
            matchedImageId: result.matchedImageId,
            rank: result.rank ?? index + 1,
          }];
        });

        if (mounted) setProducts(resolved);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    resolveProducts();
    return () => {
      mounted = false;
    };
  }, [results]);

  const getProductName = useCallback((product: ResolvedProduct) => {
    if (locale === 'ps') return product.namePs || product.name_ps || product.name || 'PRODUCT';
    if (locale === 'fa') return product.nameFa || product.name_fa || product.name || 'PRODUCT';
    return product.name || 'PRODUCT';
  }, [locale]);

  const toLocalNumbers = useCallback((value: string | number) => {
    const text = String(value ?? '0');
    if (!isRTL) return text;
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return text.replace(/[0-9]/g, (digit) => digits[Number(digit)]);
  }, [isRTL]);

  const getPrices = useCallback((product: ResolvedProduct) => {
    const price = Number(product.usdPrice ?? 0);
    const profit = Number(product.profitPercentage ?? 20) || 20;
    const current = Math.ceil((price * 65 * (1 + profit / 100)) / 10) * 10;
    const old = Math.ceil((price * 65 * (1 + (profit + 15) / 100)) / 10) * 10;
    return { current, old };
  }, []);

  const handleBack = useCallback(() => {
    clearResults();
    router.back();
  }, [clearResults, router]);

  const renderProduct = useCallback(({ item }: { item: ResolvedProduct }) => {
    const { current, old } = getPrices(item);
    const matchPercent = Math.max(0, Math.min(100, Math.round(Number(item.score) * 100)));

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
      >
        <View style={styles.imageContainer}>
          <CachedImage remoteUrl={item.imageUrl} style={styles.productImage} />
          <View style={styles.matchBadge}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.matchText}>{`${matchPercent}%`}</Text>
            <Text style={styles.matchLabel}>AI MATCH</Text>
          </View>
        </View>

        <View style={[styles.productInfo, isRTL ? styles.infoRight : styles.infoLeft]}>
          <Text style={[styles.productName, isRTL && styles.textRight]} numberOfLines={2}>
            {getProductName(item).toUpperCase()}
          </Text>
          <View style={[styles.priceRow, isRTL && styles.rowReverse]}>
            <Text style={styles.productPrice}>
              {isRTL ? `${toLocalNumbers(current)} افغانۍ` : `AFN ${current.toLocaleString('en-US')}`}
            </Text>
            <Text style={styles.oldPrice}>
              {isRTL ? `${toLocalNumbers(old)} افغانۍ` : `AFN ${old.toLocaleString('en-US')}`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [getPrices, getProductName, isRTL, router]);

  const renderLoading = () => (
    <View style={styles.loadingState}>
      <View style={styles.analysisHeader}>
        <Animated.View style={[styles.analysisIcon, { opacity: loadingPulse }]}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </Animated.View>
        <View style={styles.analysisCopy}>
          <Text style={styles.analysisTitle}>
            {locale === 'ps' ? 'ستاسو عکس تحلیل کوو' : locale === 'fa' ? 'در حال تحلیل تصویر شما' : 'ANALYZING YOUR IMAGE'}
          </Text>
          <Text style={styles.analysisSubtitle}>
            {locale === 'ps' ? 'د لید له مخې ورته محصولات پیدا کوو' : locale === 'fa' ? 'محصولات مشابه را بر اساس ظاهر پیدا می‌کنیم' : 'Finding products with a similar visual signature'}
          </Text>
        </View>
      </View>
      <View style={styles.loadingGrid}>
        {[0, 1, 2, 3].map((item) => (
          <Animated.View key={item} style={[styles.skeletonCard, { opacity: loadingPulse }]}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
          </Animated.View>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {loading ? (
        renderLoading()
      ) : (
        <>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="scan-outline" size={34} color="#111111" />
          </View>
          <Text style={styles.emptyTitle}>
            {locale === 'ps' ? 'ورته محصولات ونه موندل شول' : locale === 'fa' ? 'محصول مشابهی پیدا نشد' : 'NO SIMILAR PRODUCTS FOUND'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {locale === 'ps' ? 'بله یو بل عکس وازمویئ' : locale === 'fa' ? 'با یک تصویر دیگر دوباره امتحان کنید' : 'Try searching with another image.'}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#111111" />
        </TouchableOpacity>
        <View style={[styles.headerText, isRTL && styles.infoRight]}>
          <Text style={[styles.title, isRTL && styles.textRight]}>
            {locale === 'ps' ? 'ورته محصولات' : locale === 'fa' ? 'محصولات مشابه' : 'SIMILAR PRODUCTS'}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.textRight]}>
            {loading ? 'AI ANALYSIS' : `${products.length} ${locale === 'ps' ? 'پایلې' : locale === 'fa' ? 'نتیجه' : 'RESULTS'}`}
          </Text>
        </View>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item, index) => `visual-search-${item.id}-${item.rank}-${index}`}
        numColumns={2}
        columnWrapperStyle={[styles.gridRow, isRTL && styles.rowReverse]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={products.length ? styles.resultsContent : styles.emptyContent}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { minHeight: 82, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  headerText: { marginLeft: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#111111' },
  subtitle: { marginTop: 3, fontSize: 11, fontWeight: '600', color: '#888888' },
  resultsContent: { paddingTop: 8, paddingBottom: 40 },
  emptyContent: { flexGrow: 1 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 16 },
  productCard: { width: PRODUCT_CARD_WIDTH, marginBottom: 22, backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden', elevation: 4 },
  imageContainer: { width: '100%', aspectRatio: 0.78, backgroundColor: '#F4F4F4', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  matchBadge: { position: 'absolute', left: 10, right: 10, bottom: 10, minHeight: 34, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(17,17,17,0.86)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  matchLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  productInfo: { padding: 14 },
  infoLeft: { alignItems: 'flex-start' },
  infoRight: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },
  productName: { fontSize: 13, fontWeight: '600', color: '#111111', minHeight: 38, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#111111' },
  oldPrice: { marginLeft: 8, fontSize: 12, color: '#999999', textDecorationLine: 'line-through' },
  emptyContainer: { flex: 1, paddingBottom: 80 },
  loadingState: { paddingHorizontal: 16, paddingTop: 20 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: '#111111', marginBottom: 18 },
  analysisIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#3D3D3D', alignItems: 'center', justifyContent: 'center' },
  analysisCopy: { flex: 1, marginLeft: 12 },
  analysisTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  analysisSubtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 4 },
  loadingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  skeletonCard: { width: PRODUCT_CARD_WIDTH, marginBottom: 18, paddingBottom: 12, borderRadius: 18, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  skeletonImage: { width: '100%', aspectRatio: 0.78, backgroundColor: '#E8E8E8' },
  skeletonLine: { height: 10, width: '72%', borderRadius: 5, backgroundColor: '#E2E2E2', marginTop: 12, marginHorizontal: 12 },
  skeletonShort: { width: '42%', marginTop: 8 },
  emptyIconContainer: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  emptyTitle: { marginTop: 18, fontSize: 15, fontWeight: '800', color: '#222222', textAlign: 'center' },
  emptySubtitle: { marginTop: 7, fontSize: 12, color: '#888888', textAlign: 'center' },
});
