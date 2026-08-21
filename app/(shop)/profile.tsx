import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  AppState,
  Image
  , KeyboardAvoidingView
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/Contexts/LanguageContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/lib/config';
import { authClient } from '@/lib/auth-client';
import { useOrders } from '@/hooks/useOrders';
import { loadProductLocal } from '@/lib/offline';
import { useReviews } from '@/hooks/useReviews';
import { normalizeStatus } from './orders';
import { useProfileState } from '@/hooks/useProfileState';
import { Avatar } from '@/components/Avatar';
import { Input } from '@/components/Input';
import * as ImagePicker from "expo-image-picker"; // 🎯 NEEDED FOR GALLERY HARDWARE ENTRY
import { uploadImage } from "@/lib/uploadthing"; // 🎯 POINTS DIRECTLY TO YOUR REAL UPLOADTHING HELPERS UTILITY FILE
import * as ImageManipulator from "expo-image-manipulator";

function Header({
  loading,
  onSave,
}: {
  loading: boolean;
  onSave: () => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="close" size={22} color="#111" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>
        {(t('settings') || 'SETTINGS').toUpperCase()}
      </Text>

      <TouchableOpacity
        disabled={loading}
        onPress={onSave}
      >
        {loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={styles.saveBtn}>
            {(t('save') || 'SAVE').toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}



function TabBar({
  tab,
  setTab,
}: {
  tab: string;
  setTab: (value: any) => void;
}) {
 const { t, isRTL } = useLanguage();

  const tabs = [
    { key: 'profile', label: t('profile') || 'Profile' },
    { key: 'orders', label: t('orders') || 'Orders' },
    { key: 'reviews', label: t('reviews') || 'Reviews' },
  ];

  return (
   <View
  style={[
    styles.tabBar,
    {
      flexDirection: isRTL ? 'row-reverse' : 'row',
    },
  ]}
>
      {tabs.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={() => setTab(item.key)}
          style={[
            styles.tab,
            tab === item.key && styles.tabActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              tab === item.key &&
                styles.tabTextActive,
            ]}
          >
            {item.label.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}


function ProfileTab({
  name,
  setName,
  phone,
  setPhone,
  displayEmail,
  locale,
  languages,
  setSelectedLocale,
}: any) {
 const {
    t,
    isRTL
  } = useLanguage();
const router = useRouter();
  const { data: sessionData, isPending: fetching } = authClient.useSession();


console.log(languages);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const handleDeleteAccountRequest = () => {
    Alert.alert(
      isRTL ? "حذف دائمی حساب" : "Delete Account Permanently",
      isRTL ? "آیا مطمئن هستید؟ این عمل قابل بازگشت نیست." : "Are you absolutely sure? This action is irreversible.",
      [
        { text: isRTL ? "انصراف" : "CANCEL", style: "cancel" },
        { text: isRTL ? "حذف شود" : "DELETE ACCOUNT", style: "destructive", onPress: executeCloudAccountPurge }
      ]
    );
  };

  // ✅ CONTEXT-ALIGNED ACCOUNT DELETION
  const executeCloudAccountPurge = async () => {
    const activeSessionToken = sessionData?.session?.token;
    if (!activeSessionToken) return router.replace('/(auth)/sign-in');

    setPurging(true);
    try {
      const res = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSessionToken.trim()}`
        }
      });

      let data: any = null;
      try { data = await res.json(); } catch { throw new Error("Invalid server response"); }

      if (!res.ok) throw new Error(data?.error || 'Deletion failed');

      // Force broadcast account eviction cleanly through central state mutator hooks
      await authClient.signOut().catch(() => {});

      Alert.alert(
        isRTL ? "موفقیت" : "Success",
        isRTL ? "حساب شما حذف شد." : "Your account has been deleted."
      );
    } catch (e: any) {
      Alert.alert(isRTL ? "خطا" : "Error", e?.message || 'Failed to delete account.');
    } finally {
      setPurging(false);
    }
  };

  // ✅ PROFILE MANUAL SIGNOUT TRANSITION (HIGH-UTILITY OPTIMIZATION)
 const handleManualSignOut = async () => {
  try {
    setLoading(true);

    await authClient.signOut().catch(() => {});

    await SecureStore.deleteItemAsync('custom_user_session_token').catch(() => {});
    await SecureStore.deleteItemAsync('cached_user_profile').catch(() => {});

    // 🔥 HARD RESET NAVIGATION STATE (CRITICAL)
    router.dismissAll();

    // small delay ensures stack reset completes
    setTimeout(() => {
      router.replace('/(auth)/sign-in');
    }, 50);

  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.section}>
      <View style={styles.avatarWrapper}>
        <Avatar name={name} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          {t('fullName') || 'FULL NAME'}
        </Text>

       <TextInput
  value={name}
  onChangeText={setName}
  style={[
    styles.input,
    {
      textAlign: isRTL ? 'right' : 'left',
    },
  ]}
          placeholder={t('fullName')}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          {t('email') || 'EMAIL'}
        </Text>

        <TextInput
          value={displayEmail}
          editable={false}
          style={[
            styles.input,
            styles.disabledInput,
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          {t('phoneNumber') || 'PHONE'}
        </Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          placeholder={t('phoneNumber')}
        />
      </View>

      <View style={styles.languageSection}>
       <Text
  style={[
    styles.sectionLabel,

  ]}
>
          {(t('language') || 'LANGUAGE').toUpperCase()}
        </Text>

      <View
  style={[
    styles.langGrid,
   
  ]}
>
          {languages.map((lang: any) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langTab,
                locale === lang.code &&
                  styles.langTabActive,
              ]}
              onPress={() =>
                setSelectedLocale(lang.code)
              }
            >
            <Text
  style={[
    styles.langTabText,
    locale === lang.code &&
      styles.langTabTextActive,
  ]}
>
  {lang.code === 'en'
    ? t('language_english')
    : lang.code === 'fa'
    ? t('language_dari')
    : lang.code === 'ps'
    ? t('language_pashto')
    : lang.nativeName}
</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actionBlockWrapper}>

  <TouchableOpacity
    style={styles.logoutBtn}
    onPress={handleManualSignOut}
  >
   <Text style={styles.logoutText}>
  {(t('signOutAccount') || 'SIGN OUT OF ACCOUNT').toUpperCase()}
</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.deleteAccountBtn}
    onPress={handleDeleteAccountRequest}
  >
   <Text style={styles.deleteAccountBtnText}>
  {isRTL ? "حذف حساب" : (t('deleteAccount') || 'DELETE ACCOUNT')}
</Text>
  </TouchableOpacity>

</View>
      </View>
    </View>
  );
}

function OrdersTab({
  orders,

  setActiveReviewOrderId,
  setActiveReviewItem,
  activeReviewOrderId,
}: any) {

  const { data: sessionData, isPending: fetching } = authClient.useSession();
const [reviews, setReviews] = useState<any[]>([]);
const [reviewsMap, setReviewsMap] = useState<Record<string, any>>({});
  const [productImages, setProductImages] = useState<Record<string, string>>({});
 const {
    t,
    isRTL
  } = useLanguage();

const refetchReviews = async () => {
  const userId = sessionData?.user?.id;
  if (!userId) return;

  const res = await fetch(`${API_URL}/api/reviews/my-reviews?userId=${userId}`);
  const reviewList = await res.json();

  const map: Record<string, any> = {};
  reviewList.forEach((r: any) => {
    const key = `${r.orderId}:${r.productId}`;
    map[key] = r;
  });

  setReviews(reviewList);
  setReviewsMap(map);
};

  // Populate product images for orders when missing
  useEffect(() => {
    let alive = true;

    (async () => {
      const map: Record<string, string> = { ...productImages };

      for (const order of orders) {
        const item = order?.items?.[0];
        if (!item) continue;

        const key = item.productId || item.id || '';
        if (!key) continue;

        if (item.productImage || item.imageUrl) {
          map[key] = item.productImage || item.imageUrl;
          continue;
        }

        if (!map[key]) {
          try {
            const prod = await loadProductLocal(String(item.productId || item.productId));
            if (alive && prod?.imageUrl) {
              map[key] = prod.imageUrl;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (alive) setProductImages(map);
    })();

    return () => { alive = false; };
  }, [orders]);


if (!orders.length) {
  return (
    <View style={styles.section}>
      <View style={styles.emptyState}>
        <Ionicons
          name="receipt-outline"
          size={48}
          color="#BBB"
        />

        <Text style={styles.emptyText}>
          {t('noOrdersYet')}
        </Text>

        <Text style={styles.emptySubText}>
          {t('noOrdersYetDescription')}
        </Text>
      </View>
    </View>
  );
}

return (
  <View style={styles.section}>
    <Text
      style={[
        styles.sectionTitle,
        {
          textAlign: isRTL ? 'right' : 'left',
        },
      ]}
    >
      {t('yourOrders')}
    </Text>

    {orders.map((order: any) => {
      const item = order?.items?.[0];

      const isDelivered =
        normalizeStatus(order.status) === 'delivered';

      const reviewKey = `${order.id}:${item?.productId}`;

      const alreadyReviewed =
        !!reviewsMap?.[reviewKey];

      const isOpen =
        activeReviewOrderId === order.id;

      return (
        <View
          key={order.id}
          style={styles.orderCard}
        >
          {/* HEADER */}
          <View
            style={[
              styles.orderRow,
              {
                flexDirection: isRTL
                  ? 'row-reverse'
                  : 'row',
                alignItems: 'center',
              },
            ]}
          >
            {(
              item?.productImage || item?.imageUrl || productImages[item?.productId || item?.id]
            ) ? (
              <Image
                source={{ uri: item.productImage || item.imageUrl || productImages[item?.productId || item?.id] }}
                style={{ width: 40, height: 40, borderRadius: 10, marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0 }}
              />
            ) : (
              <Text style={styles.orderIdText}>
                #{order.id.slice(0, 8)}
              </Text>
            )}

            <Text style={styles.statusBadge}>
              {t(order.status) || order.status}
            </Text>
          </View>

          {/* DATE */}
          <Text
            style={[
              styles.orderMeta,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            {new Date(order.createdAt).toLocaleDateString()}
          </Text>

          {/* TOTAL */}
          <Text
            style={[
              styles.orderMeta,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
                fontWeight: '700',
              },
            ]}
          >
            {t('total')}:
            {' '}
            AFN {Number(order.totalAmount || 0).toLocaleString()}
          </Text>

          {/* REVIEW STATUS */}
          {!isDelivered && (
            <Text
              style={[
                styles.pendingText,
                {
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                },
              ]}
            >
              {t('reviewAvailableAfterDelivery')}
            </Text>
          )}

          {isDelivered && alreadyReviewed && (
            <Text
              style={[
                styles.pendingText,
                {
                  color: '#16A34A',
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                },
              ]}
            >
              {t('alreadyReviewed')}
            </Text>
          )}

          {isDelivered && !alreadyReviewed && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => {
                setActiveReviewOrderId(order.id);
                setActiveReviewItem(item);
              }}
            >
              <Text style={styles.reviewBtnText}>
                {t('writeReview')}
              </Text>
            </TouchableOpacity>
          )}

          {/* INLINE REVIEW */}
          {isOpen && (
            <View style={styles.inlineReviewWrap}>
              <ReviewInlineForm
                target={{
                  orderId: order.id,
                  orderItemId: item?.id,
                }}
                onClose={() => {
                  setActiveReviewOrderId(null);
                  setActiveReviewItem(null);
                }}
                onSubmitted={() => {
                  setActiveReviewOrderId(null);
                  setActiveReviewItem(null);
                  refetchReviews();
                }}
              />
            </View>
          )}
        </View>
      );
    })}
  </View>
);
}

function ReviewsTab({ reviews }: { reviews: any[] }) {
  const {
    t,
    isRTL
  } = useLanguage();

 return (
  <View style={styles.section}>
    <Text
      style={[
        styles.sectionTitle,
       
      ]}
    >
      {t('yourReviews')}
    </Text>

    {!reviews.length ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="chatbubble-outline"
          size={48}
          color="#BBB"
        />

        <Text style={styles.emptyText}>
          {t('noReviewsYet')}
        </Text>

        <Text style={styles.emptySubText}>
          {t('noReviewsYetDescription')}
        </Text>
      </View>
    ) : (
      reviews.map((review) => (
        <View
          key={review.id}
          style={styles.reviewCard}
        >
          {/* PRODUCT HEADER */}
          <View
            style={{
              flexDirection: isRTL
                ? 'row-reverse'
                : 'row',
              marginBottom: 10,
              alignItems: 'center',
            }}
          >
            {review.productImage && (
              <Image
                source={{
                  uri: review.productImage,
                }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 10,
                  marginRight: isRTL ? 0 : 10,
                  marginLeft: isRTL ? 10 : 0,
                }}
              />
            )}

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontWeight: '700',
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                }}
              >
                {review.productName ||
                  t('unknownProduct')}
              </Text>

              <Text
                style={{
                  fontSize: 12,
                  opacity: 0.6,
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                }}
              >
                {new Date(
                  review.createdAt
                ).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* RATING */}
          <Text
            style={[
              styles.reviewRating,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            ⭐ {review.rating}/5
          </Text>

          {/* COMMENT */}
          <Text
            style={[
              styles.reviewComment,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            {review.comment}
          </Text>

          {/* PHOTOS */}
          {review.images?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: isRTL
                  ? 'row-reverse'
                  : 'row',
              }}
            >
              {review.images.map(
                (img: string, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: img }}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 10,
                      marginTop: 10,
                      marginRight: isRTL
                        ? 0
                        : 8,
                      marginLeft: isRTL
                        ? 8
                        : 0,
                    }}
                  />
                )
              )}
            </ScrollView>
          )}
        </View>
      ))
    )}
  </View>
);
}

function ReviewInlineForm({
  target,
  onClose,
  onSubmitted,
}: any) {
  const { t, isRTL } = useLanguage();
  const { data: session } = authClient.useSession();

  const [userRating, setUserRating] = useState(5);
  const [comment, setComment] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const orderId = target?.orderId;
  const orderItemId = target?.orderItemId;

  // 🚨 HARD STOP (DO NOT RENDER FORM WITHOUT CONTEXT)
  if (!orderId || !orderItemId) {
    console.log("❌ Missing order context:", target);
    return null;
  }

  const submitReview = async () => {
    if (!comment.trim()) {
      return Alert.alert("Error", "Write a review first");
    }

    try {
      const res = await fetch(
        `${API_URL}/api/reviews/from-order-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            orderItemId,
            rating: userRating,
            comment: comment.trim(),
            userId: session?.user?.id ?? "guest-user",
            images: uploadedPhotos,
          }),
        }
      );



      if (res.ok) {
        Alert.alert("Success", "Review posted");

        setComment("");
        setUploadedPhotos([]);

        onSubmitted?.();
        onClose?.();
      } else {
        const err = await res.json().catch(() => ({}));
        console.log("❌ Server error:", err);
        Alert.alert("Error", "Failed to submit review");
      }
    } catch (e) {
      console.log("❌ Network error:", e);
      Alert.alert("Error", "Server error");
    }
  };

    const handlePickAndUploadImage = async () => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          // 🎯 THE ALERT FIX: Localized Permission Rejections Text Banners
          Alert.alert(
            t("permissionBlocked") || "Permission Blocked",
            t("galleryRequired") || "Gallery access is required.",
          );
          return;
        }
  
        const pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.5,
        });
  
        if (pickerResult.canceled || !pickerResult.assets?.[0]) return;
  
        setUploading(true);
  
        const optimizedImage = await ImageManipulator.manipulateAsync(
          pickerResult.assets[0].uri,
          [{ resize: { width: 600 } }],
          { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG },
        );
  
        const remoteCdnUrl = await uploadImage(optimizedImage.uri);
  
        if (remoteCdnUrl) {
          console.log("🚀 Secure CDN Link saved to local cache rows:", remoteCdnUrl);
  
          setUploadedPhotos((prevArray) => {
            const updated = [...prevArray, remoteCdnUrl];
            console.log("📸 Current local file collection stack count:", updated.length);
            return updated;
          });
  
          // 🎯 THE ALERT FIX: Localized Image Attachment Success
          Alert.alert(
            t("photoAttached") || "Success", 
            t("photoAttachedBody") || "Photo attached successfully!"
          );
        } else {
          throw new Error("Empty URL returned from gateway route.");
        }
      } catch (e: any) {
        console.error("❌ Media upload thread broken:", e.message);
        // 🎯 THE ALERT FIX: Localized Upload Errors
        Alert.alert(
          t("uploadStalled") || "Upload Stalled",
          t("uploadStalledBody") || "Could not complete image stream operations.",
        );
      } finally {
        setUploading(false);
      }
    };


 const renderStars = (rating: number, interactive = false) => {
    return Array.from({ length: 5 }, (_, i) => (
      <TouchableOpacity
        key={i}
        disabled={!interactive}
        onPress={() => interactive && setUserRating(i + 1)}
      >
        <Ionicons
          name={i < rating ? "star" : "star-outline"}
          size={interactive ? 24 : 10}
          color="#000000"
          style={{ marginRight: 2 }}
        />
      </TouchableOpacity>
    ));
  }


  return (
      <View style={styles.reviewFormLuxuryCard}>
        <Text style={styles.reviewFormTitle}>
          {(t("shareExperience") || "SHARE YOUR EXPERIENCE").toUpperCase()}
        </Text>
  
        {/* STARS */}
        <View style={styles.starsFormRow}>
          {renderStars(userRating, true)}
        </View>
  
        {/* COMMENT */}
        <TextInput
          placeholder={
            t("writeOpinionPlaceholder") ||
            "How was the quality, fit and material?"
          }
          placeholderTextColor="#999"
          value={comment}
          onChangeText={setComment}
          multiline
          style={[
            styles.reviewLuxuryInput,
            isRTL ? { textAlign: "right" } : { textAlign: "left" },
          ]}
        />
  
        {/* PHOTO UPLOAD */}
        <TouchableOpacity
          style={[
            styles.photoLuxuryBtn,
            isRTL && { flexDirection: "row-reverse" },
          ]}
          onPress={handlePickAndUploadImage}
        >
          <Ionicons
            name="camera-outline"
            size={18}
            color="#111"
            style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
          />
  
          <Text style={styles.photoLuxuryBtnText}>
            {(t("addPhotos") || "ADD PHOTOS").toUpperCase()}
          </Text>
        </TouchableOpacity>
  
        {/* PREVIEW */}
        {uploadedPhotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {uploadedPhotos.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.uploadPreviewLuxury}
              />
            ))}
          </ScrollView>
        )}
  
        {/* SUBMIT */}
        <TouchableOpacity
          style={styles.submitLuxuryReviewBtn}
          onPress={submitReview}
        >
          <Text style={styles.submitLuxuryReviewText}>
            {(t("postReview") || "POST REVIEW").toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    );
  
}


export default function ProfileScreen() {
  const router = useRouter();

  const {
    t,
    isRTL,
    locale,
    setLanguage: setSelectedLocale,
    languages
  } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [displayEmail, setDisplayEmail] = useState('');
const [reviews, setReviews] = useState<any[]>([]);
const [reviewsMap, setReviewsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
const [tab, setTab] = useState<'profile' | 'orders' | 'reviews'>('profile');
const [loadingOrders, setLoadingOrders] = useState(false);
const [ordersExpanded, setOrdersExpanded] = useState(false);
const [reviewsExpanded, setReviewsExpanded] = useState(false);
const [activeReviewOrderId, setActiveReviewOrderId] = useState<string | null>(null);
const [activeReviewItem, setActiveReviewItem] = useState<any>(null);
  // 🎯 THE REACTIVE CONVERGENCE FIX:
  // Bind your loading spinner state directly to authClient's native pending hooks!
  const { data: sessionData, isPending: fetching } = authClient.useSession();

  // 🎯 REAL-TIME DATA PROPAGATION LIFECYCLE LAYER
  useEffect(() => {
    // Read the user object directly from your central reactive state hooks parameters!
    const userRecordNode = sessionData?.user;

    if (userRecordNode) {
      const resolvedProfileName = userRecordNode?.name || userRecordNode?.customerName || '';
      const resolvedProfileEmail = userRecordNode?.email || '';
      
      let resolvedProfilePhone =
        userRecordNode?.phoneNumber ||
        userRecordNode?.phone_number ||
        userRecordNode?.phone ||
        '';

      // Fallback: If phone field is blank on disk, parse it straight out of their @phone.local email string
      if ((!resolvedProfilePhone || resolvedProfilePhone.trim().length === 0) && resolvedProfileEmail.includes('@phone.local')) {
        const structuralEmailPartsList = resolvedProfileEmail.split('@');
        if (structuralEmailPartsList && structuralEmailPartsList[0]) {
          resolvedProfilePhone = structuralEmailPartsList[0].trim();
        }
      }

      setName(String(resolvedProfileName).trim());
      setPhone(String(resolvedProfilePhone).replace(/\s/g, '').trim());
      setDisplayEmail(String(resolvedProfileEmail).toLowerCase().trim());
    }
  }, [sessionData]);

  useEffect(() => {
  const load = async () => {
    try {
      setLoadingOrders(true);

      const userId = sessionData?.user?.id;
      if (!userId) return;

      const [ordersRes, reviewsRes] = await Promise.all([
        fetch(`${API_URL}/api/orders/my-orders?userId=${userId}`),
        fetch(`${API_URL}/api/reviews/my-reviews?userId=${userId}`),
      ]);

      const ordersData = await ordersRes.json();
      const reviewsData = await reviewsRes.json();

      const list = Array.isArray(ordersData)
        ? ordersData
        : ordersData?.data || [];

      const reviewList = Array.isArray(reviewsData)
        ? reviewsData
        : reviewsData?.data || [];

      // map reviews by productId OR orderId
      const map: Record<string, any> = {};
reviewList.forEach((r: any) => {
  const key = `${r.orderId}:${r.productId}`;
  map[key] = r;
});
setReviewsMap(map);

      setReviewsMap(map);
      setOrders(list);
setReviews(reviewList);
    } finally {
      setLoadingOrders(false);
    }
  };

  load();
}, [sessionData?.user?.id]);

const visibleOrders = ordersExpanded
  ? orders
  : orders.slice(0, 4);

const visibleReviews = reviewsExpanded
  ? reviews
  : reviews.slice(0, 4);



  // 🎯 PASSIVE APP STATE SWEEP: Re-verifies state continuity when the app regains system focus
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && sessionData?.session?.token) {
        console.log("📡 [PROFILE RE-VERIFY] Checking token continuity via authClient...");
        await authClient.refreshSession().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sessionData]);

  // ✅ PROFILE PATCH RE-CONFIGURED (100% UNIFIED)
  const handleUpdate = async () => {
    if (!name.trim()) {
      return Alert.alert(
        t('error') || 'Error',
        t('nameRequired') || 'Name is required'
      );
    }

    // 🎯 SECURED TOKEN GATES ENFORCEMENT:
    // Pull the active access token directly from your centralized reactive state context object!
    const activeSessionToken = sessionData?.session?.token;

    if (!activeSessionToken) {
      Alert.alert("Session Expired", "Your active secure profile session has timed out. Please sign in again.");
      return router.replace('/(auth)/sign-in');
    }

    setLoading(true);
    try {
      console.log(`📡 [PROFILE PATCH] Submitting profile revisions via central token mapping corridor...`);
      
      const res = await fetch(`${API_URL}/api/user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSessionToken.trim()}` // Standard Better-Auth bearer injection token
        },
        body: JSON.stringify({
          name: name.trim().slice(0, 80),
          phone: phone.replace(/[^\d+]/g, '').slice(0, 20)
        })
      });

      let data: any = null;
      try { data = await res.json(); } catch { throw new Error("Invalid server response blueprint map."); }

      if (res.ok && data.success) {
        // 🎯 THE LIVE INSTANT STATE BROADCAST REFRESH:
        // Signal the central state manager to refresh its local data caches immediately!
        // This causes the newly updated name string to paint across all application headers instantly!
        await authClient.refreshSession().catch(() => {});

        Alert.alert(
          t('success') || 'Success',
          t('profileUpdated') || 'Profile updated successfully.'
        );
      } else {
        Alert.alert(t('error') || 'Error', data?.error || 'Could not update profile details.');
      }
    } catch (e: any) {
      Alert.alert(t('error') || 'Error', e?.message || 'Could not save profile updates.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ DELETE ACCOUNT CONFIRMATION
  const handleDeleteAccountRequest = () => {
    Alert.alert(
      isRTL ? "حذف دائمی حساب" : "Delete Account Permanently",
      isRTL ? "آیا مطمئن هستید؟ این عمل قابل بازگشت نیست." : "Are you absolutely sure? This action is irreversible.",
      [
        { text: isRTL ? "انصراف" : "CANCEL", style: "cancel" },
        { text: isRTL ? "حذف شود" : "DELETE ACCOUNT", style: "destructive", onPress: executeCloudAccountPurge }
      ]
    );
  };

  // ✅ CONTEXT-ALIGNED ACCOUNT DELETION
  const executeCloudAccountPurge = async () => {
    const activeSessionToken = sessionData?.session?.token;
    if (!activeSessionToken) return router.replace('/(auth)/sign-in');

    setPurging(true);
    try {
      const res = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSessionToken.trim()}`
        }
      });

      let data: any = null;
      try { data = await res.json(); } catch { throw new Error("Invalid server response"); }

      if (!res.ok) throw new Error(data?.error || 'Deletion failed');

      // Force broadcast account eviction cleanly through central state mutator hooks
      await authClient.signOut().catch(() => {});

      Alert.alert(
        isRTL ? "موفقیت" : "Success",
        isRTL ? "حساب شما حذف شد." : "Your account has been deleted."
      );
    } catch (e: any) {
      Alert.alert(isRTL ? "خطا" : "Error", e?.message || 'Failed to delete account.');
    } finally {
      setPurging(false);
    }
  };

  // ✅ PROFILE MANUAL SIGNOUT TRANSITION (HIGH-UTILITY OPTIMIZATION)
 const handleManualSignOut = async () => {
  try {
    setLoading(true);

    await authClient.signOut().catch(() => {});

    await SecureStore.deleteItemAsync('custom_user_session_token').catch(() => {});
    await SecureStore.deleteItemAsync('cached_user_profile').catch(() => {});

    // 🔥 HARD RESET NAVIGATION STATE (CRITICAL)
    router.dismissAll();

    // small delay ensures stack reset completes
    setTimeout(() => {
      router.replace('/(auth)/sign-in');
    }, 50);

  } finally {
    setLoading(false);
  }
};


 

const safeReviews = Array.isArray(reviews) ? reviews : [];


  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }


return (
  <View style={styles.container}>

    <Header loading={loading} onSave={handleUpdate} />
    <TabBar tab={tab} setTab={setTab} />

    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 200 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ================= PROFILE ================= */}
      {tab === 'profile' && (
        <ProfileTab
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          displayEmail={displayEmail}
          locale={locale}
          languages={languages}
          setSelectedLocale={setSelectedLocale}
        />
      )}

      {/* ================= ORDERS ================= */}
      {tab === 'orders' && (
        <>
          {loadingOrders ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <>
              <OrdersTab
                orders={visibleOrders}
                reviewsMap={reviewsMap}
                onReview={() => {}}
                activeReviewOrderId={activeReviewOrderId}
                setActiveReviewOrderId={setActiveReviewOrderId}
                setActiveReviewItem={setActiveReviewItem}
              />

              {orders.length > 4 && (
                <TouchableOpacity
                  onPress={() => setOrdersExpanded(!ordersExpanded)}
                  style={styles.showMoreBtn}
                >
                  <Text style={styles.showMoreText}>
  {ordersExpanded ? t('showLess') : t('showMore')}
</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

      {/* ================= REVIEWS ================= */}
      {tab === 'reviews' && (
        <>
          {loadingOrders ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <>
              <ReviewsTab reviews={visibleReviews} />

              {reviews.length > 4 && (
                <TouchableOpacity
                  onPress={() => setReviewsExpanded(!reviewsExpanded)}
                  style={styles.showMoreBtn}
                >
                <Text style={styles.showMoreText}>
  {reviewsExpanded ? t('showLess') : t('showMore')}
</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

    </ScrollView>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },

  content: {
    paddingBottom: 40
  },
reviewFormLuxuryCard: {
  backgroundColor: '#fff',
  padding: 16,
  marginTop: 12,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#eee',
},

reviewFormTitle: {
  fontSize: 14,
  fontWeight: '700',
  marginBottom: 12,
},

starsFormRow: {
  flexDirection: 'row',
  marginBottom: 10,
},
showMoreBtn: {
  marginTop: 12,
  alignSelf: 'center',
  paddingVertical: 10,
  paddingHorizontal: 18,
  borderRadius: 20,
  backgroundColor: '#F3F4F6',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},

showMoreText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#6B7280',
  letterSpacing: 0.5,
},

reviewLuxuryInput: {
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  padding: 12,
  minHeight: 80,
  marginBottom: 12,
},

photoLuxuryBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 10,
  borderRadius: 10,
  backgroundColor: '#f5f5f5',
  marginBottom: 10,
},

photoLuxuryBtnText: {
  fontWeight: '600',
},
field: {
  marginBottom: 18,
},
submitLuxuryReviewBtn: {
  backgroundColor: '#000',
  padding: 12,
  borderRadius: 12,
  alignItems: 'center',
},

submitLuxuryReviewText: {
  color: '#fff',
  fontWeight: '700',
},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },


orderRow: {
  flexDirection: "row",
  justifyContent: "space-between",
},

orderIdText: {
  fontSize: 12,
  fontWeight: "800",
},

statusBadge: {
  fontSize: 10,
  fontWeight: "900",
  color: "#999",
},
tabBar: {
  flexDirection: 'row',
  marginHorizontal: 16,
  marginTop: 10,
  backgroundColor: '#F5F5F5',
  borderRadius: 14,
  padding: 4,
},

tab: {
  flex: 1,
  paddingVertical: 10,
  alignItems: 'center',
  borderRadius: 12,
},

tabActive: {
  backgroundColor: '#111',
},
 keyboardContainer: {
    flex: 1
  },
tabText: {
  fontSize: 10,
  fontWeight: '800',
  color: '#666',
  letterSpacing: 1,
},

tabTextActive: {
  color: '#FFF',
},

orderMeta: {
  fontSize: 10,
  color: "#888",
  marginTop: 4,
},

pendingText: {
  marginTop: 8,
  fontSize: 10,
  color: "#999",
},


sectionTitle: {
  fontSize: 12,
  fontWeight: '900',
  letterSpacing: 1.2,
  marginBottom: 14,
  marginTop: 10,
  color: '#111',
},

orderCard: {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
},

reviewBtn: {
  marginTop: 12,
  backgroundColor: '#111',
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: 'center',
},

reviewBtnText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '900',
  letterSpacing: 1,
},


reviewPreview: {
  marginTop: 10,
  backgroundColor: "#fafafa",
  padding: 10,
  borderRadius: 10,
},
modalOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
reviewCard: {
  backgroundColor: '#FFFFFF',
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: '#F1F1F1',
},

reviewRating: {
  fontSize: 14,
  fontWeight: '600',
  color: '#111',
  marginBottom: 4,
},

reviewComment: {
  fontSize: 13,
  color: '#555',
  lineHeight: 18,
},

emptyText: {
  fontSize: 13,
  color: '#999',
  textAlign: 'center',
  marginTop: 10,
},

languageSection: {
  marginTop: 20,
  paddingTop: 10,
},

sectionLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#666',
  marginBottom: 10,
  letterSpacing: 0.5,
},
inlineReviewWrap: {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  backgroundColor: '#FAFAFA',
  borderWidth: 1,
  borderColor: '#EEE',
},

langGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  paddingBottom: 10
},

langTab: {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: '#E5E5E5',
  backgroundColor: '#FAFAFA',
},

langTabActive: {
  backgroundColor: '#111',
  borderColor: '#111',
},
langTabText: {
  fontSize: 13,
  color: '#111',
  fontWeight: '600',
  textAlign: 'center',
},
langTabTextActive: {
  color: '#FFF',
  fontWeight: '700',
},

modalCard: {
  width: '90%',
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 18,
},

modalTitle: {
  fontSize: 12,
  fontWeight: '900',
  marginBottom: 14,
  letterSpacing: 1,
},

  // =========================
  // HEADER (MODERN CLEAN BAR)
  // =========================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 60 : 22,
    paddingBottom: 14,

    backgroundColor: '#FFFFFF',

    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',

    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2
  },
section: {
  paddingHorizontal: 20,
  paddingTop: 10,
},

avatarWrapper: {
  alignItems: 'center',
  marginBottom: 20,
},
  headerIconTouch: {
    padding: 6,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },

  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 2
  },

  saveBtn: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111',
    letterSpacing: 1
  },

  // =========================
  // AVATAR (PREMIUM CENTER PIECE)
  // =========================
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 26
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,

    backgroundColor: '#111',

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 10,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 5
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1
  },

  changePhoto: {
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 1.4
  },

  // =========================
  // FORM (CLEAN SPACING SYSTEM)
  // =========================
  form: {
    paddingHorizontal: 20,
    marginBottom: 24
  },

  inputGroup: {
    marginBottom: 18
  },
label: {
  fontSize: 10,
  fontWeight: '900',
  color: '#111',
  letterSpacing: 1.3,
  marginBottom: 8,
  textAlign: 'left',
},

  input: {
    height: 46,

    borderWidth: 1,
    borderColor: '#EDEDED',

    borderRadius: 12,

    paddingHorizontal: 14,

    fontSize: 13,
    color: '#111',

    backgroundColor: '#FAFAFA',

    fontWeight: '500'
  },

  disabledInput: {
    color: '#888',
    backgroundColor: '#F3F3F3',
    borderColor: '#E8E8E8'
  },

  lockedHelperText: {
    fontSize: 9,
    color: '#999',
    marginTop: 5,
    letterSpacing: 0.4
  },

  
uploadPreviewLuxury: {
  width: 80,
  height: 100,
  borderRadius: 14,
  marginRight: 10,
},
  // =========================
  // LANGUAGE SWITCH (TOGGLE STYLE)
  // =========================
 

  // =========================
  // ACTION AREA (CARD STYLE BUTTONS)
  // =========================
  actionBlockWrapper: {
    paddingHorizontal: 20,
    gap: 12
  },

  logoutBtn: {
    height: 46,

    borderWidth: 1,
    borderColor: '#111',

    justifyContent: 'center',
    alignItems: 'center',

    borderRadius: 14,

    backgroundColor: '#FFF'
  },
  emptyState: {
  alignItems: 'center',
  paddingVertical: 40,
},

  logoutText: {
    color: '#111',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4
  },

  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: 12,
    marginTop: 6
  },

  deleteAccountBtnText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  }
});