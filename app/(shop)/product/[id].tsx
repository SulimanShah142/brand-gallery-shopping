import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/Contexts/CartContext";
import { useLanguage } from "@/Contexts/LanguageContext";
import * as ImagePicker from "expo-image-picker"; // 🎯 NEEDED FOR GALLERY HARDWARE ENTRY
import { uploadImage } from "@/lib/uploadthing"; // 🎯 POINTS DIRECTLY TO YOUR REAL UPLOADTHING HELPERS UTILITY FILE
import * as ImageManipulator from "expo-image-manipulator"; // 🎯 ENSURE THIS IS IMPORTED
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth-client";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { API_URL } from "@/lib/config";

const { width } = Dimensions.get("window");
export default function UserProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  // 🎯 CORE HOOK CONTEXT BINDINGS
  const { addToCart: dispatchAddToCart } = useCart();
  const { t, isRTL, locale } = useLanguage();
  const [ShowReviewForm, setShowReviewForm] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Core Functional States
  const [product, setProduct] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [descModalVisible, setDescModalVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Interaction States
  const [activeTab, setActiveTab] = useState<"DETAILS" | "REVIEWS">("DETAILS");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("Standard");
  const [userRating, setUserRating] = useState<number>(5);

  const availableSizes = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.availableSizes)) return product.availableSizes;
    if (typeof product.availableSizes === 'string') {
      try {
        const parsed = JSON.parse(product.availableSizes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return product.availableSizes.length > 0 ? product.availableSizes.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
    }
    return [];
  }, [product]);
  const [comment, setComment] = useState<string>("");
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [descTooLong, setDescTooLong] = useState(false);
  const { cachedUser, isPending: authPending } = authClient.useSession();
  // =========================
  // REVIEWS LOGIC LAYER
  // =========================

  // AVERAGE RATING (memoized)
  const averageRating = useMemo(() => {
    if (!reviews?.length) return 0;
    return (
      reviews.reduce((a, b) => a + Number(b.rating || 0), 0) / reviews.length
    );
  }, [reviews]);

  // STAR FLOOR VALUE
  const roundedRating = useMemo(() => {
    return Math.round(averageRating);
  }, [averageRating]);

  // FORM RESET
  const resetReviewForm = () => {
    setComment("");
    setUploadedPhotos([]);
    setUserRating(5);
  };

  // NORMALIZE IMAGES SAFELY
  const parseReviewImages = (images: any): string[] => {
    try {
      if (!images) return [];
      if (Array.isArray(images)) return images;
      return JSON.parse(images);
    } catch {
      return [];
    }
  };

  // 1. Fetch Complete Product Context data from Cloud Worker
  useEffect(() => {
    if (!id) return;
    let userCanReview = false;

    const loadProductData = async () => {
      try {
        setLoading(true);
        const [prodRes, settingsRes, reviewsRes, similarRes] =
          await Promise.all([
            fetch(`${API_URL}/api/products/${id}`),
            fetch(`${API_URL}/api/admin/settings`),
            fetch(`${API_URL}/api/products/${id}/reviews`),
            fetch(`${API_URL}/api/products?limit=12`),
          ]);
        // Inside your loadProductData() async routine inside the useEffect hook
        const prodData = await prodRes.json();
        const settingsData = await settingsRes.json();
        const reviewsData = await reviewsRes.json();
        const similarData = await similarRes.json();
console.log("PRODUCT DATA");
console.log(JSON.stringify(prodData, null, 2));
console.log("imageUrl =", prodData.imageUrl);
console.log("colorImageUrls =", prodData.colorImageUrls);
        setProduct(prodData);
        setSettings(settingsData);
        setReviews(Array.isArray(reviewsData) ? reviewsData : []);

        // Determine if current user has a delivered order for this product
        try {
          const uid = session?.user?.id;
          if (uid) {
            const eligibilityRes = await fetch(`${API_URL}/api/orders/has-delivered?userId=${uid}&productId=${id}`);
            const eligibility = await eligibilityRes.json();
            userCanReview = !!eligibility?.delivered;
          }
        } catch (e) {
          console.warn('Failed to check review eligibility', e);
        }

        // 🎯 THE CRITICAL CONFIGURATION FIX: Auto-select the first actual color returned from your Neon database!
        if (prodData?.availableColors && prodData.availableColors.length > 0) {
          setSelectedColor(prodData.availableColors[0]);
        } else {
          setSelectedColor("Standard"); // Reliable backup if the item lacks explicit color properties
        }

        const normalizedSizes = Array.isArray(prodData?.availableSizes)
          ? prodData.availableSizes
          : typeof prodData?.availableSizes === 'string'
            ? (() => {
                try {
                  const parsed = JSON.parse(prodData.availableSizes);
                  return Array.isArray(parsed) ? parsed : prodData.availableSizes.split(',').map((p: string) => p.trim()).filter(Boolean);
                } catch {
                  return prodData.availableSizes.split(',').map((p: string) => p.trim()).filter(Boolean);
                }
              })()
            : [];

        if (normalizedSizes.length > 0) {
          setSelectedSize(normalizedSizes[0]);
        } else {
          setSelectedSize("");
        }

        if (Array.isArray(similarData)) {
          setSimilarProducts(
            similarData.filter((p: any) => p.id !== id).slice(0, 10),
          );
        }

        // already set above: product, settings, reviews, similarProducts handled
      } catch (err) {
        console.error("❌ Failed to parse item metrics topology:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProductData();
  }, [id]);

  // Only show the review form if user has delivered this product
  const canOpenReviewForm = () => {
    const uid = session?.user?.id;
    if (!uid) return false;
    // Fallback: if server didn't return eligibility, default to false
    // We optimistically rely on server-side check during submission as well
    return true;
  };

  const toLocalNumbers = useCallback(
    (num: string | number) => {
      // Accept both raw numbers and already-formatted strings (e.g. '2,980')
      const stringValue = String(num || "0");
      if (locale === "en" || !locale) return stringValue;

      const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
      return stringValue.replace(
        /[0-9]/g,
        (w) => easternDigits[parseInt(w, 10)],
      );
    },
    [locale],
  );

  // 🎯 HIGH-PRECISION PRODUCT SPECIFIC MULTILINGUAL CEILING PRICE MATRIX
  // Align logic with Home `getPrices` to ensure identical results
  const finalDisplayPrice = useMemo(() => {
    if (!product) return 0;

    const rate = parseFloat(settings?.usdToAfnRate || "65");
    const profit = parseFloat(String(product?.profitPercentage ?? "20").replace(/[^0-9.]/g, "")) || 20;

    const baseCurrent =
      parseFloat(product.usdPrice || "0") * rate * (1 + profit / 100);
    const finalRoundedUpCeilingPrice = Math.ceil(baseCurrent / 10) * 10;

    return Math.max(0, finalRoundedUpCeilingPrice);
  }, [product, settings]); // match Home dependencies (no per-user promo applied here)

  // 3. Media Upload & Review Handlers
  const handlePickAndUploadImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        console.log(
          "🚀 Secure CDN Link saved to local cache rows:",
          remoteCdnUrl,
        );

        setUploadedPhotos((prevArray) => {
          const updated = [...prevArray, remoteCdnUrl];
          console.log(
            "📸 Current local file collection stack count:",
            updated.length,
          );
          return updated;
        });

        // 🎯 THE ALERT FIX: Localized Image Attachment Success
        Alert.alert(
          t("photoAttached") || "Success",
          t("photoAttachedBody") || "Photo attached successfully!",
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

  const submitReview = async () => {
    if (!comment.trim())
      return Alert.alert(
        t("error") || "Error",
        t("fillAllDetails") || "Please fill details.",
      );
    try {
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          rating: userRating,
          comment: comment.trim(),
          userId: session?.user?.id,
          images: uploadedPhotos,
        }),
      });

      if (res.ok) {
        // 🎯 THE ALERT FIX: Localized Review Creation Confirmed
        Alert.alert(
          t("reviewPosted") || "Success",
          t("reviewPostedBody") || "Review Posted!",
        );
        setComment("");
        setUploadedPhotos([]);
        const freshReviews = await fetch(
          `${API_URL}/api/products/${id}/reviews`,
        ).then((r) => r.json());
        setReviews(freshReviews);
      }
    } catch (e) {
      // 🎯 THE ALERT FIX: Localized Review Fallback Failure
      Alert.alert(
        t("error") || "Error",
        t("reviewFailedBody") || "Failed to publish review.",
      );
    }
  };

  const addToCart = () => {
    if (!product) return;
    if (Array.isArray(product?.availableSizes) && product.availableSizes.length > 0 && !selectedSize) {
      // 🎯 THE ALERT FIX: Localized Selection Validation Guard
      return Alert.alert(
        t("error") || "Error",
        t("sizeRequired") || "Please select a product size before continuing.",
      );
    }
    if (!selectedColor) {
      // 🎯 THE ALERT FIX: Localized Selection Validation Guard
      return Alert.alert(
        t("error") || "Error",
        t("colorRequired") ||
          "Please select a product color before continuing.",
      );
    }

    const optimizedProductPayload = {
      ...product,
      price: finalDisplayPrice,
    };

    dispatchAddToCart(optimizedProductPayload, 1, selectedSize, selectedColor);

    // 🎯 THE ALERT FIX: Dynamic Macro Text Interpolation for Shopping Bag Feedback
    const successTemplate =
      t("addedToBagBody") ||
      "{name} ({size} / {color}) has been added to your shopping bag.";
    const formattedAlertMessage = successTemplate
      .replace("{name}", product.name?.toUpperCase() || "")
      .replace("{size}", selectedSize)
      .replace("{color}", selectedColor.toUpperCase());

    Alert.alert(t("addedToBag") || "Added to Bag", formattedAlertMessage);
  };

  const productImages = useMemo(() => {
    if (!product) return [];

    return [product.imageUrl, ...(product.colorImageUrls || [])].filter(
      Boolean,
    );
  }, [product]);

  const openImageViewer = useCallback((uri?: string | null) => {
    if (!uri) return;
    setSelectedImageUri(uri);
    setImageViewerVisible(true);
  }, []);

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
  };

  const ReviewHeader = () => (
    <View style={styles.reviewSectionContainer}>
      <View
        style={[
          styles.reviewHeroRow,
          isRTL && { flexDirection: "row-reverse" },
        ]}
      >
        <View
          style={
            isRTL ? { alignItems: "flex-end" } : { alignItems: "flex-start" }
          }
        >
          <Text style={styles.reviewAverageScore}>
            {reviews.length
              ? toLocalNumbers(averageRating.toFixed(1))
              : toLocalNumbers("0.0")}
          </Text>

          <View
            style={[
              styles.starRatingContainerRow,
              isRTL && { flexDirection: "row-reverse" },
            ]}
          >
            {renderStars(reviews.length ? roundedRating : 0)}
          </View>

          <Text style={styles.reviewCountText}>
            {toLocalNumbers(reviews.length)} {t("reviewsTab") || "Reviews"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.writeReviewBtn}
          onPress={() => {
            if (!session?.user?.id) return router.push('/(auth)/sign-in');
            // fetch server-side eligibility before opening
            fetch(`${API_URL}/api/orders/has-delivered?userId=${session.user.id}&productId=${id}`)
              .then((r) => r.json())
              .then((res) => {
                if (res?.delivered) setShowReviewForm(true);
                else Alert.alert(t('error') || 'Error', t('mustHaveDelivered') || 'You must have received this product to leave a review.');
              })
              .catch(() => Alert.alert(t('error') || 'Error', t('couldNotVerify') || 'Could not verify purchase.'));
          }}
        >
          <Text style={styles.writeReviewBtnText}>
            {(t("writeReview") || "WRITE REVIEW").toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ReviewForm = () =>
    ShowReviewForm && (
      <View style={styles.reviewFormLuxuryCard}>
        <Text style={styles.reviewFormTitle}>
          {(t("shareExperience") || "SHARE YOUR EXPERIENCE").toUpperCase()}
        </Text>

        {/* STARS */}
        <View style={styles.starsFormRow}>{renderStars(userRating, true)}</View>

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

  const ReviewList = () =>
    reviews.length > 0 && (
      <View style={styles.reviewListSection}>
        <View
          style={[
            styles.reviewListHeader,
            isRTL && { flexDirection: "row-reverse" },
          ]}
        >
          <Text style={styles.reviewListTitle}>
            {(t("customerReviews") || "CUSTOMER REVIEWS").toUpperCase()}
          </Text>

          <TouchableOpacity
            onPress={() => router.push(`/product/${id}/reviews`)}
          >
            <Text style={styles.reviewViewAll}>
              {(t("viewAll") || "VIEW ALL").toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {reviews.slice(0, 2).map((item, idx) => {
          const images = parseReviewImages(item.images);

          return (
            <View key={item.id || idx} style={styles.modernReviewCard}>
              {/* HEADER */}
              <View
                style={[
                  styles.modernReviewHeader,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Text style={styles.modernReviewName}>
                  {item.userName || "Verified Buyer"}
                </Text>

                <View style={styles.starsRowWrap}>
                  {renderStars(item.rating)}
                </View>
              </View>

              {/* COMMENT */}
              <Text
                style={[
                  styles.modernReviewComment,
                  isRTL ? { textAlign: "right" } : { textAlign: "left" },
                ]}
              >
                {item.comment}
              </Text>

              {/* IMAGES */}
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((img, i) => (
                    <Image
                      key={i}
                      source={{ uri: img }}
                      style={styles.modernReviewImage}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </View>
    );

  // 🎯 FIXED CONTAINER RETENTION: Guard statement runs perfectly inside the functional scope boundaries!
  if (loading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* IMAGE HERO SECTION */}
          <View
            style={[
              styles.heroContainer,
              {
                direction: "ltr",
              },
            ]}
          >
            {productImages.length > 0 && (
              <TouchableOpacity
                style={styles.imageViewerButton}
                activeOpacity={0.85}
                onPress={() => openImageViewer(productImages[activeImageIndex])}
              >
                <Ionicons name="expand-outline" size={18} color="#111111" />
              </TouchableOpacity>
            )}

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                alignItems: "stretch",
                paddingHorizontal: 0,
              }}
              style={{
                width: width,
                marginHorizontal: 0,
              }}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {productImages.map((img, index) => (
                <View
                  key={index}
                  style={{
                    width: width,
                    height: 420,
                    marginRight: 0,
                    marginLeft: 0,
                    padding: 0,
                  }}
                >
                  <Image
                    source={{ uri: img }}
                    style={{
                      width: width,
                      height: 420,
                      margin: 0,
                    }}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* HIGH-END MINIMAL INFO SHEET CARD */}
          <View style={styles.productCard}>
            <View style={[styles.ratingRow]}>
              {renderStars(product.averageRating)}
              <Text style={styles.reviewCount}>
                ({toLocalNumbers(reviews.length)} {t("reviewsTab") || "REVIEWS"}
                )
              </Text>
            </View>

            {/* 🎯 MULTILINGUAL TITLE PROXIES SYNCHRONIZED */}
            <Text style={[styles.productTitle]}>
              {(locale === "ps"
                ? product.namePs || product.name
                : locale === "fa"
                  ? product.nameFa || product.name
                  : product.name
              )?.toUpperCase()}
            </Text>

            {/* 🎯 UNIVERSAL ARABIC NUMERALS CURRENCY FORMATTING */}
            <Text style={[styles.productPrice]}>
              {isRTL
                ? `${toLocalNumbers(finalDisplayPrice.toLocaleString("en-US"))} افغانۍ`
                : `AFN ${toLocalNumbers(finalDisplayPrice.toLocaleString("en-US"))}`}
            </Text>

            <View style={[styles.benefitsRow]}>
              <View
                style={[
                  styles.benefitPill,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Ionicons name="car-outline" size={14} color="#000000" />
                <Text style={styles.benefitText}>
                  {t("freeDelivery") || "Free Delivery"}
                </Text>
              </View>

              <View
                style={[
                  styles.benefitPill,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Ionicons name="refresh-outline" size={14} color="#000000" />
                <Text style={styles.benefitText}>
                  {t("easyReturns") || "Easy Returns"}
                </Text>
              </View>
            </View>

            {(Array.isArray(product?.availableSizes) && product.availableSizes.length > 0) ? (
              <>
                <View style={[styles.sizeMatrixHeader]}>
                  <Text style={styles.sizeSectionTitle}>
                    {(t("selectSize") || "SELECT SIZE").toUpperCase()}
                  </Text>

                  <TouchableOpacity activeOpacity={0.8}>
                    <Text style={styles.sizeGuideLabelText}>
                      {(t("sizeGuide") || "SIZE GUIDE").toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.sizeGridWrapper]}>
                  {availableSizes.map((size: string) => {
                    const isSelected = selectedSize === size;

                    return (
                      <TouchableOpacity
                        key={`size-${size}`}
                        activeOpacity={0.85}
                        onPress={() => setSelectedSize(size)}
                        style={[
                          styles.sizeItemBox,
                          isSelected && styles.sizeItemBoxActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sizeText,
                            isSelected && styles.sizeTextActive,
                          ]}
                        >
                          {String(size).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* =========================
                  COLOR SELECTOR WITH EXTRACTED ARRAYS LOOKUPS
            ========================= */}
            <View style={[styles.sizeMatrixHeader, { marginTop: 10 }]}>
              <Text style={styles.sizeSectionTitle}>
                {(t("selectColor") || "SELECT COLOR").toUpperCase()}
              </Text>

              {selectedColor ? (
                <Text style={styles.selectedColorLabel}>
                  {selectedColor.toUpperCase()}
                </Text>
              ) : null}
            </View>

            <View style={[styles.sizeGridWrapper, { flexWrap: "wrap" }]}>
              {Array.isArray(product?.availableColors) &&
              product.availableColors.length > 0 ? (
                product.availableColors
                  .flatMap((item: string) =>
                    typeof item === "string" ? item.split(",") : [item],
                  )
                  .map((rawColor: string, index: number) => {
                    const colorInEnglish = rawColor.trim();
                    if (!colorInEnglish) return null;

                    // 🎯 INDEX-MATCHED LOCALIZED LABELS RESTORED NATIVELY
                    const localizedColorLabel =
                      locale === "ps"
                        ? product.availableColorsPs?.[index] || colorInEnglish
                        : locale === "fa"
                          ? product.availableColorsFa?.[index] || colorInEnglish
                          : colorInEnglish;

                    return (
                      <TouchableOpacity
                        key={`color-pill-separated-${colorInEnglish}`}
                        style={[
                          styles.sizeItemBox,
                          { flex: 0, minWidth: 74, paddingHorizontal: 14 },
                          selectedColor === colorInEnglish &&
                            styles.sizeItemBoxActive,
                        ]}
                        onPress={() => setSelectedColor(colorInEnglish)}
                      >
                        <Text
                          style={[
                            styles.sizeText,
                            selectedColor === colorInEnglish &&
                              styles.sizeTextActive,
                          ]}
                        >
                          {localizedColorLabel.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
              ) : (
                <View
                  style={[
                    styles.sizeItemBox,
                    styles.sizeItemBoxActive,
                    { flex: 0, paddingHorizontal: 20 },
                  ]}
                >
                  <Text style={styles.sizeTextActive}>
                    {(t("standardColor") || "STANDARD").toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* =========================
    PRODUCT DETAILS LUXURY CARD
========================= */}
          <View style={styles.luxuryCard}>
            {/* HEADER ONLY */}
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionHeaderTitle,
                  isRTL && { textAlign: "right" },
                ]}
              >
                {(t("productDetails") || "PRODUCT DETAILS").toUpperCase()}
              </Text>
            </View>

            {/* DESCRIPTION */}
            <Text
              numberOfLines={2}
              onTextLayout={(e) => {
                // If more than 4 lines → show button
                setDescTooLong(e.nativeEvent.lines.length > 4);
              }}
              style={[
                styles.productDescriptionLuxury,
                isRTL && { textAlign: "right" },
              ]}
            >
              {(locale === "ps"
                ? product.descriptionPs || product.description
                : locale === "fa"
                  ? product.descriptionFa || product.description
                  : product.description) ||
                t("noDescription") ||
                "No description provided."}
            </Text>

            {/* SHOW MORE */}
            {(product?.description ||
              product?.descriptionPs ||
              product?.descriptionFa) && (
              <TouchableOpacity
                onPress={() => setDescModalVisible(true)}
                style={{ marginTop: 10 }}
              >
                <Text style={styles.showMoreText}>
                  {t("showMore") || "Show more"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* =========================
    SHIPPING INFRASTRUCTURE CARD
========================= */}
          <View style={styles.luxuryCard}>
            <View style={styles.shippingList}>
              <View
                style={[
                  styles.shippingRow,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color="#111111"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.shippingTitle,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {(t("easyReturnsTitle") || "EASY RETURNS").toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.shippingSubtitle,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {/* 🎯 UNIVERSAL NUMERAL TRANSLATION INJECTED */}
                    {locale === "en"
                      ? "Return eligible products within 7 days"
                      : `محصولات واجد شرایط را ظرف ${toLocalNumbers(7)} روز برگردانید`}
                  </Text>
                </View>
              </View>

              {/* DELIVERY ESTIMATE ROW */}
              <View
                style={[
                  styles.shippingRow,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color="#111111"
                  style={isRTL ? { marginLeft: 12 } : { marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.shippingTitle,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {(t("deliveryEstimate") || "DELIVERY: 3-5 WEEKS").toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.shippingSubtitle,
                      isRTL && { textAlign: "right" },
                    ]}
                  >
                    {t("deliveryEstimate")}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* =========================
    CUSTOMER AUDIT REVIEWS SEGMENT
========================= */}
          <>
            <ReviewHeader />
            <ReviewForm />
            <ReviewList />
          </>

          {/* =========================
    YOU MAY ALSO LIKE
========================= */}
          {/* ======================================================
    🎯 RE-ENGINEERED MULTILINGUAL DISCOVERY RECOMMENDED GRID
    ====================================================== */}
          <View style={styles.recommendationSection}>
            <View style={[styles.recommendationHeader]}>
              <View style={{ alignItems: "flex-start" }}>
                <Text style={styles.recommendationEyebrow}>
                  {(t("moreToExplore") || "MORE TO EXPLORE").toUpperCase()}
                </Text>

                <Text style={styles.recommendationTitle}>
                  {locale === "ps"
                    ? "ستاسو لپاره غوره شوي"
                    : locale === "fa"
                      ? "انتخاب شده برای شما"
                      : "YOU MAY ALSO LIKE"}
                </Text>
              </View>
            </View>

            <View style={[styles.recommendationGrid]}>
              {similarProducts.slice(0, 10).map((item: any) => {
                const itemUsd = parseFloat(item.usdPrice || "0");
                const appRate = parseFloat(settings?.usdToAfnRate || "65");
                const appMargin = parseFloat(
                  String(item?.profitPercentage ?? "20").replace(/[^0-9.]/g, ""),
                ) || 20;

                const baseCalculatedAfn =
                  itemUsd * appRate * (1 + appMargin / 100);

                // 🎯 THE UNIVERSAL CEILING RETAIL PRICE FORMULA: Forces endings to always be zero
                const itemFinalPrice = Math.ceil(baseCalculatedAfn / 10) * 10;

                // Dual-casing lookups protect text alignments purely on the front-end layer
                const displayName =
                  locale === "ps"
                    ? item.namePs || item.name_ps || item.name
                    : locale === "fa"
                      ? item.nameFa || item.name_fa || item.name
                      : item.name;

                return (
                  <TouchableOpacity
                    key={`recommended-${item.id}`}
                    style={styles.recommendationCard}
                    onPress={() => router.replace(`/product/${item.id}`)}
                    activeOpacity={0.92}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.recommendationImage}
                      resizeMode="cover"
                    />

                    <View
                      style={[
                        styles.recommendationInfo,
                        isRTL
                          ? { alignItems: "flex-end" }
                          : { alignItems: "flex-start" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.recommendationName,
                          isRTL
                            ? { textAlign: "right" }
                            : { textAlign: "left" },
                        ]}
                        numberOfLines={2}
                      >
                        {displayName?.toUpperCase()}
                      </Text>

                      <Text
                        style={[
                          styles.recommendationPrice,
                          isRTL
                            ? { textAlign: "right" }
                            : { textAlign: "left" },
                        ]}
                      >
                        {isRTL
                          ? `${toLocalNumbers(itemFinalPrice)} افغانۍ`
                          : `AFN ${toLocalNumbers(itemFinalPrice)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* ======================================================
    🎯 LUXURY BRAND MONOCHROME STICKY FOOTER ACTION TRAY
    ====================================================== */}
        <View style={[styles.stickyFooterBar]}>
          <View style={[styles.footerPriceSection]}>
            <Text style={styles.footerPriceLabel}>
              {(t("totalLabel") || "TOTAL").toUpperCase()}
            </Text>

            <Text style={styles.footerPriceValue}>
              {isRTL
                ? `${toLocalNumbers(finalDisplayPrice.toLocaleString("en-US"))} افغانۍ`
                : `AFN ${toLocalNumbers(finalDisplayPrice.toLocaleString("en-US"))}`}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.callToBagBtn]}
            onPress={() => addToCart()}
            activeOpacity={0.9}
          >
            <Ionicons
              name="bag-handle"
              size={18}
              color="#FFFFFF"
              style={isRTL ? { marginRight: 8 } : { marginRight: 8 }}
            />

            <Text style={styles.callToBagBtnText}>
              {(t("addToBag") || "Add to Bag").toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={imageViewerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>
              {(t("productDetails") || "PRODUCT IMAGE").toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => setImageViewerVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {selectedImageUri ? (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={descModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDescModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* HEADER */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {(t("productDetails") || "PRODUCT DETAILS").toUpperCase()}
              </Text>

              <TouchableOpacity onPress={() => setDescModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* CONTENT */}
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={[
                  styles.modalDescription,
                  isRTL && { textAlign: "right" },
                ]}
              >
                {(locale === "ps"
                  ? product.descriptionPs || product.description
                  : locale === "fa"
                    ? product.descriptionFa || product.description
                    : product.description) ||
                  t("noDescription") ||
                  "No description provided."}
              </Text>
            </ScrollView>

            {/* BOTTOM ACTION */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setDescModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>{t("close") || "Close"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    width: "100%",
    height: 420,
    backgroundColor: "#F8F8F8",
    position: "relative",
    overflow: "hidden",
    direction: "ltr",
    borderRadius: 0,
  },

 
  floatingBackBtn: {
    position: "absolute",
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  imageViewerButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
  },
  imageViewerHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  imageViewerTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  imageViewerImage: {
    width: "100%",
    height: "100%",
  },
  showMoreText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    height: "85%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#111",
  },

  modalDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: "#444",
    paddingBottom: 40,
  },

  modalCloseBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },

  modalCloseText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  callToBagBtn: {
    flex: 1.2,
    height: 48,
    backgroundColor: "#111",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  sizeMatrixHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    bottom: 6,
  },

  sizeSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  sizeGuideLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#777777",
    letterSpacing: 0.8,
  },

  selectedColorLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#777777",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  sizeGridWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  sizeItemBox: {
    minWidth: 70,
    height: 42,

    paddingHorizontal: 16,

    justifyContent: "center",
    alignItems: "center",

    borderRadius: 14,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E8E8E8",
  },

  sizeItemBoxActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },

  sizeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333333",
    letterSpacing: 0.4,
  },

  sizeTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  callToBagBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  floatingHeartBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  reviewCount: {
    marginLeft: 8,
    fontSize: 13,
    color: "#888",
  },
  starRatingContainerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  scroll: {
    flex: 1,
  },

  scrollContentContainer: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  starsFormRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingVertical: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  productTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111",
    lineHeight: 26,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    marginBottom: 10,
  },
  benefitsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  benefitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12, // was 14
    paddingVertical: 8, // was 10
    borderRadius: 24, // slightly tighter
  },
  benefitText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    color: "#111",
  },
  luxuryCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F3F3",
  },

  shippingList: {
    gap: 8,
  },

  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },

  productDescriptionLuxury: {
    fontSize: 15,
    lineHeight: 24,
    color: "#555",
  },
  shippingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
  },

  shippingDivider: {
    height: 1,
    backgroundColor: "#F2F2F2",
    marginVertical: 18,
  },

  shippingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    marginBottom: 2,
    marginLeft: 0,
  },

  shippingSubtitle: {
    fontSize: 13,
    color: "#777",
    marginLeft: 0,
    lineHeight: 20,
  },
  reviewSectionContainer: {
    marginTop: 10,
    marginBottom: 18,
  },

  reviewHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reviewAverageScore: {
    fontSize: 42,
    fontWeight: "800",
    color: "#111",
  },

  reviewCountText: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },

  writeReviewBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
  },

  writeReviewBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  reviewFormLuxuryCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F2F2F2",
  },

  reviewFormTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 14,
  },

  reviewLuxuryInput: {
    minHeight: 120,
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 16,
    marginVertical: 14,
    textAlignVertical: "top",
  },
  modernReviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12, // was 14
    padding: 12, // was 14
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F2F2F2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },

  modernReviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  modernReviewName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: 0.3,
  },

  modernReviewComment: {
    fontSize: 12,
    color: "#444444",
    lineHeight: 18,
    marginTop: 6,
  },

  starsRowWrap: {
    flexDirection: "row",
    gap: 2,
  },

  modernReviewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 8,
    marginTop: 10,
    backgroundColor: "#F5F5F5",
  },

  reviewListSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },

  reviewListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  reviewListTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: 1.2,
  },

  reviewViewAll: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000000",
  },
  recommendationHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#111",
  },
  photoLuxuryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },

  photoLuxuryBtnText: {
    marginLeft: 8,
    fontWeight: "600",
  },

  uploadPreviewLuxury: {
    width: 80,
    height: 100,
    borderRadius: 14,
    marginRight: 10,
  },

  submitLuxuryReviewBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },

  submitLuxuryReviewText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  recommendationSection: {
    marginTop: 18,
    paddingBottom: 20,
  },
  recommendationEyebrow: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },

  recommendationTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
  },

  recommendationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 18,
  },

  recommendationCard: {
    width: "48%",
    marginBottom: 20,
  },

  recommendationImage: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
  },

  recommendationInfo: {
    paddingTop: 10,
  },

  recommendationName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },
  recommendationPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  stickyFooterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: "#FFFFFF",

    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",

    paddingHorizontal: 14,
    paddingVertical: 8,

    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,

    elevation: 8,
  },
  footerPriceSection: {
    flex: 1,
  },

  footerPriceLabel: {
    fontSize: 11,
    color: "#888",
  },

  footerPriceValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
  },
});
