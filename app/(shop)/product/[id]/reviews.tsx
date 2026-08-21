import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/Contexts/LanguageContext';

const { width } = Dimensions.get('window');
import { API_URL } from '@/lib/config';

export default function SpecializedProductReviewsPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL, locale } = useLanguage(); 

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/products/${id}/reviews`)
      .then(res => res.json())
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const aggregateScoreMetrics = useMemo(() => {
    if (reviews.length === 0) return { avg: "5.0", label: t('reviewsPreview') || "Excellent Feedback" };
    const sum = reviews.reduce((acc, item) => acc + (item.rating || 5), 0);
    const average = (sum / reviews.length).toFixed(1);
    
    return {
      avg: average,
      label: parseFloat(average) >= 4.2 
        ? (locale === 'en' ? "HIGH RATED PIECE" : (locale === 'fa' ? "محصول با امتیاز بالا" : "لوړ رتبه شوی محصول")) 
        : (locale === 'en' ? "STANDARD GALLERY GOODS" : (locale === 'fa' ? "جنس استاندارد گالری" : "معیاري برانډ شوي توکي"))
    };
  }, [reviews, locale, t]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons key={i} name={i < rating ? "star" : "star-outline"} size={10} color="#000000" style={{ marginRight: 1 }} />
    ));
  };

  const getLocalizedDateStr = (dateInput: any) => {
    if (!dateInput) return '';
    const dateObj = new Date(dateInput);
    const defaultLocaleTag = locale === 'fa' ? 'fa-AF' : (locale === 'ps' ? 'ps-AF' : 'en-US');
    return dateObj.toLocaleDateString(defaultLocaleTag, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#000000" />
        <Text style={styles.loadingText}>
          {(t('loadingReviews') || 'LOADING AUTHENTIC REVIEWS...').toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* MONOCHROME MINIMALIST HEADER ROW */}
      <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name={isRTL ? "arrow-back" : "arrow-back"} size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>
          {(t('reviews') || 'CUSTOMER REVIEWS').toUpperCase()}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* OVERALL STORE RATING MATRICES HIGHLIGHT BOX */}
      <View style={[styles.scoreOverviewCard, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.scoreCluster, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={styles.bigScoreText}>{aggregateScoreMetrics.avg}</Text>
          <Text style={styles.outOfText}>/5</Text>
        </View>
        <View style={[styles.metaScoreTextWrapper, { gap: 4 }, isRTL ? { alignItems: 'flex-end', paddingRight: 16 } : { alignItems: 'flex-start', paddingLeft: 16 }]}>
          <Text style={styles.scoreLabelText}>{aggregateScoreMetrics.label}</Text>
          <Text style={styles.totalReviewsCount}>
            {locale === 'en' && `Based on ${reviews.length} authentic e-commerce logs`}
            {locale === 'fa' && `بر اساس ${reviews.length} نظر واقعی ثبت شده خریداران`}
            {locale === 'ps' && `د پیرودونکو د ${reviews.length} تایید شوي نظرونو پر بنسټ`}
          </Text>
        </View>
      </View>

      {/* DEEP DETAILED REVIEWS STREAM TIMELINE */}
      <FlatList
        data={reviews}
        keyExtractor={(item, index) => `all-review-${item.id || index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        renderItem={({ item }) => {
          // Robust string-to-array safe conversion layer
          let attachments: string[] = [];
          try {
            if (Array.isArray(item.images)) {
              attachments = item.images;
            } else if (typeof item.images === 'string' && item.images.trim().length > 0) {
              if (item.images.startsWith('[') || item.images.startsWith('{')) {
                attachments = JSON.parse(item.images);
              } else {
                attachments = item.images.split(',').map((s: string) => s.trim());
              }
            }
          } catch (e) {
            console.warn("⚠️ Image array layout parsing deferred:", e);
          }

          // Safe lookup parsing handles customer name rendering boundaries gracefully
          const rawCustomerProfileName = item.userName || item.user_name || item.user?.name || '';
          const cleanBuyerName = rawCustomerProfileName.trim().length > 0 ? rawCustomerProfileName : null;
          const initialsCharacterPlaceholder = cleanBuyerName ? cleanBuyerName[0].toUpperCase() : 'B';

          return (
            <View style={styles.fullReviewRowCard}>
              <View style={[styles.cardTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.buyerMetaBox, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={styles.initialsCircle}>
                    <Text style={styles.initialsText}>{initialsCharacterPlaceholder}</Text>
                  </View>
                  <Text style={styles.buyerRosterName}>
                    {cleanBuyerName || t('buyerVerified') || 'Verified Buyer'}
                  </Text>
                </View>
                <View style={[styles.starsClusterRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  {renderStars(item.rating || 5)}
                </View>
              </View>

              <Text style={[styles.commentBodyText, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
                {item.comment}
              </Text>
              
              {/* 🎯 UPGRADED HIGH-DENSITY EDITORIAL SHEIN IMAGE CAROUSEL */}
              {attachments.length > 0 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.mediaCarouselRow} 
                  contentContainerStyle={styles.mediaCarouselContainer}
                >
                  {attachments.map((imgUrl, fileIdx) => {
                    if (!imgUrl || !imgUrl.trim()) return null;
                    return (
                      <View key={`attachment-frame-${fileIdx}`} style={styles.imageFrameThumbnail}>
                        <Image 
                          source={{ uri: imgUrl.trim() }} 
                          style={styles.expandedReviewMediaAsset} 
                          resizeMode="cover"
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              
              <Text style={[styles.timestampLabel, isRTL ? { textAlign: 'left' } : { textAlign: 'right' }]}>
                {getLocalizedDateStr(item.createdAt)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.blankBox}>
            <Ionicons name="chatbox-ellipses-outline" size={44} color="#CCCCCC" />
            <Text style={styles.blankText}>
              {t('noReviewsYet') || 'No entries stored inside review buckets.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

// =========================================================================
// 🎨 UPGRADED STYLESHEET MATRIX FOR PREMIUM REVIEW DESIGN 
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  loadingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backBtn: {
    padding: 2,
  },
  headerTitleText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  scoreOverviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  scoreCluster: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bigScoreText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#000000',
  },
  outOfText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    marginLeft: 2,
  },
  metaScoreTextWrapper: {
    flex: 1,
  },
  scoreLabelText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  totalReviewsCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  listContainer: {
    paddingVertical: 10,
  },
  fullReviewRowCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  buyerMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  initialsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  buyerRosterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  starsClusterRow: {
    flexDirection: 'row',
  },
  commentBodyText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333333',
    lineHeight: 19,
    marginBottom: 12,
  },
  
  // 🎯 MAXIMIZED MEDIA GALLERY CAROUSEL SPECIFICATIONS
  mediaCarouselRow: {
    marginVertical: 4,
    marginBottom: 12,
  },
  mediaCarouselContainer: {
    gap: 10,
  },
  imageFrameThumbnail: {
    width: 110,  // Upgraded from small thumb dimensions to look clear and upscale
    height: 110, // Perfectly square ratio metrics
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  expandedReviewMediaAsset: {
    width: '100%',
    height: '100%',
  },
  timestampLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.3,
  },
  blankBox: {
    padding: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  blankText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
});
