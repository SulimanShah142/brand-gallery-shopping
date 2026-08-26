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
import ImageViewer from "react-native-image-zoom-viewer";
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
const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  // 🎯 CORE HOOK CONTEXT BINDINGS
  const { addToCart: dispatchAddToCart } = useCart();
  const { t, isRTL, locale } = useLanguage();
  const [ShowReviewForm, setShowReviewForm] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // Core Functional States
  const [product, setProduct] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [descModalVisible, setDescModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  // Interaction States
  const [activeTab, setActiveTab] = useState<"DETAILS" | "REVIEWS">("DETAILS");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("Standard");
  const [userRating, setUserRating] = useState<number>(5);
const [activeImageIndex, setActiveImageIndex] = useState(0);
const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
const [imageViewerVisible, setImageViewerVisible] = useState(false);


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
  const [sizeGuideVisible, setSizeGuideVisible] = useState(false);
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
// ============================================================
// COMPLETE PRODUCT DETAILS LOADER
// ============================================================

useEffect(() => {
  if (!id) return;

  let cancelled = false;

  const loadProductData = async () => {
    try {
      setLoading(true);

      // ========================================================
      // HELPER: NORMALIZE STRING ARRAYS
      // ========================================================

      const normalizeStringArray = (
        value: any
      ): string[] => {
        if (!value) return [];

        // Already an array
        if (Array.isArray(value)) {
          return Array.from(
            new Set(
              value
                .map((item: any) =>
                  String(item).trim()
                )
                .filter(Boolean)
            )
          );
        }

        // JSON string or comma-separated string
        if (typeof value === "string") {
          const raw = value.trim();

          if (!raw) return [];

          // Try JSON first
          try {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
              return Array.from(
                new Set(
                  parsed
                    .map((item: any) =>
                      String(item).trim()
                    )
                    .filter(Boolean)
                )
              );
            }
          } catch {
            // Not JSON — continue as CSV.
          }

          return Array.from(
            new Set(
              raw
                .split(",")
                .map((item: string) =>
                  item.trim()
                )
                .filter(Boolean)
            )
          );
        }

        return [];
      };


      // ========================================================
      // HELPER: NORMALIZE IMAGE ARRAYS
      // ========================================================

      const normalizeImageArray = (
        value: any
      ): string[] => {
        if (!value) return [];

        // Array of URLs / image objects
        if (Array.isArray(value)) {
          return Array.from(
            new Set(
              value
                .map((image: any) => {
                  if (
                    typeof image === "string"
                  ) {
                    return image.trim();
                  }

                  if (image?.url) {
                    return String(
                      image.url
                    ).trim();
                  }

                  if (image?.imageUrl) {
                    return String(
                      image.imageUrl
                    ).trim();
                  }

                  if (image?.src) {
                    return String(
                      image.src
                    ).trim();
                  }

                  return "";
                })
                .filter(Boolean)
            )
          );
        }

        // String containing JSON or a direct URL
        if (typeof value === "string") {
          const raw = value.trim();

          if (!raw) return [];

          try {
            const parsed =
              JSON.parse(raw);

            if (Array.isArray(parsed)) {
              return normalizeImageArray(
                parsed
              );
            }

            if (
              typeof parsed === "string" &&
              parsed.trim()
            ) {
              return [parsed.trim()];
            }
          } catch {
            // Plain URL.
          }

          return [raw];
        }

        return [];
      };


      // ========================================================
      // 1. FETCH PRODUCT
      // ========================================================

      const prodRes = await fetch(
        `${API_URL}/api/products/${id}`
      );

      if (!prodRes.ok) {
        throw new Error(
          `Product request failed: ${prodRes.status}`
        );
      }

      const prodData =
        await prodRes.json();

      if (cancelled) return;


      // ========================================================
      // DEBUG — RAW PRODUCT RESPONSE
      // ========================================================

      console.log(
        "========================================"
      );

      console.log(
        "🛍️ COMPLETE PRODUCT DATA"
      );

      console.log(
        JSON.stringify(
          prodData,
          null,
          2
        )
      );

      console.log(
        "imageUrl =",
        prodData?.imageUrl
      );

      console.log(
        "images =",
        prodData?.images
      );

      console.log(
        "availableColors =",
        prodData?.availableColors
      );

      console.log(
        "colorImages =",
        prodData?.colorImages
      );

      console.log(
        "colorImageUrls =",
        prodData?.colorImageUrls
      );

      console.log(
        "========================================"
      );


      // ========================================================
      // 2. FETCH REMAINING CONTEXT
      // ========================================================
      //
      // The new product endpoint may already contain these.
      // We only request them separately when necessary.
      // ========================================================

      const needsSettings =
        !prodData?.settings;

      const needsReviews =
        !Array.isArray(
          prodData?.reviews
        );

      const needsSimilar =
        !Array.isArray(
          prodData?.similarProducts
        );

      const [
        settingsResult,
        reviewsResult,
        similarResult,
      ] = await Promise.all([
        needsSettings
          ? fetch(
              `${API_URL}/api/admin/settings`
            )
          : Promise.resolve(null),

        needsReviews
          ? fetch(
              `${API_URL}/api/products/${id}/reviews`
            )
          : Promise.resolve(null),

        needsSimilar
          ? fetch(
              `${API_URL}/api/products?limit=12`
            )
          : Promise.resolve(null),
      ]);


      // ========================================================
      // 3. SETTINGS
      // ========================================================

      let settingsData =
        prodData?.settings || null;

      if (
        !settingsData &&
        settingsResult
      ) {
        try {
          if (
            settingsResult.ok
          ) {
            settingsData =
              await settingsResult.json();
          }
        } catch (error) {
          console.warn(
            "⚠️ Failed to parse settings:",
            error
          );
        }
      }


      // ========================================================
      // 4. REVIEWS
      // ========================================================

      let reviewsData: any[] =
        Array.isArray(
          prodData?.reviews
        )
          ? prodData.reviews
          : [];

      if (
        reviewsData.length === 0 &&
        reviewsResult
      ) {
        try {
          if (
            reviewsResult.ok
          ) {
            const parsedReviews =
              await reviewsResult.json();

            if (
              Array.isArray(
                parsedReviews
              )
            ) {
              reviewsData =
                parsedReviews;
            }
          }
        } catch (error) {
          console.warn(
            "⚠️ Failed to parse reviews:",
            error
          );
        }
      }


      // ========================================================
      // 5. SIMILAR PRODUCTS
      // ========================================================

      let similarData: any[] =
        Array.isArray(
          prodData?.similarProducts
        )
          ? prodData.similarProducts
          : [];

      if (
        similarData.length === 0 &&
        similarResult
      ) {
        try {
          if (
            similarResult.ok
          ) {
            const parsedSimilar =
              await similarResult.json();

            if (
              Array.isArray(
                parsedSimilar
              )
            ) {
              similarData =
                parsedSimilar;
            }
          }
        } catch (error) {
          console.warn(
            "⚠️ Failed to parse similar products:",
            error
          );
        }
      }


      // ========================================================
      // 6. NORMALIZE AVAILABLE SIZES
      // ========================================================

      const normalizedSizes =
        normalizeStringArray(
          prodData?.availableSizes
        );


      // ========================================================
      // 7. NORMALIZE AVAILABLE COLORS
      // ========================================================

      const normalizedColors =
        normalizeStringArray(
          prodData?.availableColors
        );


      // ========================================================
      // 8. NORMALIZE COLOR → IMAGES
      // ========================================================
      //
      // Preferred backend structure:
      //
      // colorImages: {
      //   Black: [
      //     "black-front.jpg",
      //     "black-back.jpg"
      //   ],
      //
      //   White: [
      //     "white-front.jpg",
      //     "white-back.jpg"
      //   ]
      // }
      //
      // This is what allows:
      //
      // User taps BLACK
      //       ↓
      // Black images become active
      //
      // User taps WHITE
      //       ↓
      // White images become active
      // ========================================================

      const normalizedColorImages: Record<
        string,
        string[]
      > = {};

      // --------------------------------------------------------
      // Preferred: colorImages
      // --------------------------------------------------------

      if (
        prodData?.colorImages &&
        typeof prodData.colorImages ===
          "object" &&
        !Array.isArray(
          prodData.colorImages
        )
      ) {
        Object.entries(
          prodData.colorImages
        ).forEach(
          ([color, images]) => {
            const normalized =
              normalizeImageArray(
                images
              );

            if (
              normalized.length > 0
            ) {
              normalizedColorImages[
                color
              ] = normalized;
            }
          }
        );
      }


      // --------------------------------------------------------
      // Compatibility: colorImageUrls
      // --------------------------------------------------------

      if (
        prodData?.colorImageUrls &&
        typeof prodData.colorImageUrls ===
          "object" &&
        !Array.isArray(
          prodData.colorImageUrls
        )
      ) {
        Object.entries(
          prodData.colorImageUrls
        ).forEach(
          ([color, images]) => {
            const normalized =
              normalizeImageArray(
                images
              );

            if (
              normalized.length > 0 &&
              !normalizedColorImages[
                color
              ]
            ) {
              normalizedColorImages[
                color
              ] = normalized;
            }
          }
        );
      }


      // ========================================================
      // 9. NORMALIZE GENERAL PRODUCT IMAGES
      // ========================================================

      const primaryImage =
        typeof prodData?.imageUrl ===
        "string"
          ? prodData.imageUrl.trim()
          : "";

      const directImages =
        normalizeImageArray(
          prodData?.images
        );

      const imageUrls =
        normalizeImageArray(
          prodData?.imageUrls
        );

      const normalizedProductImages =
        Array.from(
          new Set(
            [
              primaryImage,
              ...directImages,
              ...imageUrls,
            ].filter(Boolean)
          )
        );


      // ========================================================
      // 10. BUILD COMPLETE PRODUCT OBJECT
      // ========================================================

      const completeProduct = {
        ...prodData,

        // Normalized selections
        availableSizes:
          normalizedSizes,

        availableColors:
          normalizedColors,

        // General gallery
        images:
          normalizedProductImages,

        // IMPORTANT:
        // Color-specific galleries
        colorImages:
          normalizedColorImages,

        // Related data
        reviews:
          reviewsData,

        similarProducts:
          similarData
            .filter(
              (p: any) =>
                String(p?.id) !==
                String(id)
            )
            .slice(0, 10),

        // Settings
        settings:
          settingsData,
      };


      // ========================================================
      // 11. SAVE PRODUCT
      // ========================================================

      if (!cancelled) {
        setProduct(
          completeProduct
        );

        setSettings(
          settingsData
        );

        setReviews(
          reviewsData
        );

        setSimilarProducts(
          completeProduct.similarProducts
        );
      }


      // ========================================================
      // 12. INITIAL COLOR
      // ========================================================

     setSelectedColor("Standard");


      // ========================================================
      // 13. INITIAL SIZE
      // ========================================================

      if (
        normalizedSizes.length > 0
      ) {
        setSelectedSize(
          normalizedSizes[0]
        );
      } else {
        setSelectedSize("");
      }


      // ========================================================
      // 14. RESET GALLERY INDEX
      // ========================================================

      setActiveImageIndex(0);


      // ========================================================
      // 15. DEBUG FINAL NORMALIZED DATA
      // ========================================================

      console.log(
        "========================================"
      );

      console.log(
        "🎨 NORMALIZED COLORS"
      );

      console.log(
        normalizedColors
      );

      console.log(
        "📏 NORMALIZED SIZES"
      );

      console.log(
        normalizedSizes
      );

      console.log(
        "🖼️ NORMALIZED GENERAL IMAGES"
      );

      console.log(
        normalizedProductImages
      );

      console.log(
        "🎨🖼️ COLOR → IMAGE MAP"
      );

      console.log(
        JSON.stringify(
          normalizedColorImages,
          null,
          2
        )
      );

      console.log(
        "⭐ REVIEWS:",
        reviewsData.length
      );

      console.log(
        "🔗 SIMILAR PRODUCTS:",
        completeProduct.similarProducts.length
      );

      console.log(
        "========================================"
      );


    } catch (err) {
      // ========================================================
      // ERROR HANDLING
      // ========================================================

      console.error(
        "❌ Failed to load complete product details:",
        err
      );

      if (!cancelled) {
        setProduct(null);
        setReviews([]);
        setSimilarProducts([]);
        setSettings(null);
        setSelectedSize("");
        setSelectedColor("Standard");
        setActiveImageIndex(0);
      }

    } finally {
      // ========================================================
      // LOADING COMPLETE
      // ========================================================

      if (!cancelled) {
        setLoading(false);
      }
    }
  };


  // ==========================================================
  // EXECUTE
  // ==========================================================

  loadProductData();


  // ==========================================================
  // CLEANUP
  // ==========================================================

  return () => {
    cancelled = true;
  };

}, [id]);

const handleColorChange = (
  color: string
) => {
  const cleanColor = String(color).trim();

  if (!cleanColor) return;

  setSelectedColor(cleanColor);

  // Start the new color gallery from the beginning.
  setActiveImageIndex(0);

  // Close fullscreen viewer if currently open.
  setImageViewerVisible(false);

  setSelectedImageUri(null);
};

const colorOptions = useMemo(() => {
  if (!product) return [];

  const rawColors = product.availableColors;

  if (!Array.isArray(rawColors)) {
    return [];
  }

  return rawColors
    .flatMap((item: any) =>
      typeof item === "string"
        ? item
            .split(",")
            .map((value: string) => value.trim())
            .filter(Boolean)
        : []
    )
    .filter(
      (color: string, index: number, array: string[]) =>
        array.findIndex(
          (item) =>
            item.toLowerCase() === color.toLowerCase()
        ) === index
    );
}, [product]);

const colorSelectorOptions = useMemo(() => {
  return [
    "Standard",
    ...colorOptions,
  ];
}, [colorOptions]);

const getLocalizedColorName = (
  color: string,
  index: number
) => {
  if (
    color.toLowerCase() === "standard"
  ) {
    return t("standardColor") || "STANDARD";
  }

  if (locale === "ps") {
    return (
      product?.availableColorsPs?.[index] ||
      color
    );
  }

  if (locale === "fa") {
    return (
      product?.availableColorsFa?.[index] ||
      color
    );
  }

  return color;
};

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

// ============================================================
// COLOR-AWARE PRODUCT GALLERY
// ============================================================

const productImages = useMemo(() => {
  if (!product) return [];

  const mainImage =
    typeof product.imageUrl === "string"
      ? product.imageUrl.trim()
      : "";

  // ------------------------------------------------------------
  // STANDARD = ORIGINAL PRODUCT
  // ------------------------------------------------------------

  if (
    !selectedColor ||
    selectedColor.toLowerCase() === "standard"
  ) {
    return mainImage ? [mainImage] : [];
  }

  // ------------------------------------------------------------
  // SELECTED COLOR IMAGES
  // ------------------------------------------------------------

  const colorImages =
    product.colorImages &&
    typeof product.colorImages === "object"
      ? product.colorImages
      : {};

  const selectedKey = Object.keys(colorImages).find(
    (key) =>
      String(key).trim().toLowerCase() ===
      String(selectedColor).trim().toLowerCase()
  );

  if (!selectedKey) {
    return mainImage ? [mainImage] : [];
  }

  const images = Array.isArray(colorImages[selectedKey])
    ? colorImages[selectedKey]
        .map((image: any) => String(image).trim())
        .filter(Boolean)
    : [];

  // ------------------------------------------------------------
  // NEVER RETURN EMPTY GALLERY
  // ------------------------------------------------------------

  return images.length > 0
    ? [...new Set(images)]
    : mainImage
      ? [mainImage]
      : [];
}, [product, selectedColor]);


  const openImageViewer = useCallback((uri?: string | null) => {
    if (!uri) return;
    setSelectedImageUri(uri);
    setImageViewerVisible(true);
  }, []);

const getColorThumbnail = useCallback(
  (color: string): string | null => {
    if (!product || !color) return null;

    const colorImages =
      product?.colorImages &&
      typeof product.colorImages === "object" &&
      !Array.isArray(product.colorImages)
        ? product.colorImages
        : {};

    const images = colorImages?.[color];

    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];

      if (typeof first === "string") {
        return first;
      }

      if (first?.url) {
        return String(first.url);
      }

      if (first?.imageUrl) {
        return String(first.imageUrl);
      }
    }

    return null;
  },
  [product]
);


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
        {/* ============================================================
    PRODUCT IMAGE GALLERY
============================================================ */}
<View
  style={[
    styles.heroContainer,
    {
      direction: "ltr",
    },
  ]}
>
  {/* FULLSCREEN BUTTON */}

  {productImages.length > 0 && (
    <TouchableOpacity
      style={styles.imageViewerButton}
      activeOpacity={0.85}
      onPress={() => {
        const currentImage =
          productImages[activeImageIndex] ||
          productImages[0];

        if (!currentImage) return;

        setSelectedImageUri(currentImage);
        setImageViewerVisible(true);
      }}
    >
      <Ionicons
        name="expand-outline"
        size={18}
        color="#111111"
      />
    </TouchableOpacity>
  )}

  {/* PRODUCT IMAGE GALLERY */}

  {productImages.length > 0 ? (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={{
        width,
      }}
      contentContainerStyle={{
        flexDirection: "row",
        alignItems: "stretch",
      }}
      scrollEventThrottle={16}
      onScroll={(event) => {
        const index = Math.round(
          event.nativeEvent.contentOffset.x /
            width
        );

        if (
          index >= 0 &&
          index < productImages.length
        ) {
          setActiveImageIndex(index);
        }
      }}
    >
      {productImages.map(
        (image: string, index: number) => (
          <TouchableOpacity
            key={`${selectedColor}-${index}-${image}`}
            activeOpacity={0.98}
            onPress={() => {
              setSelectedImageUri(image);
              setImageViewerVisible(true);
            }}
            style={{
              width,
              height: 420,
            }}
          >
            <Image
              source={{
                uri: image,
              }}
              style={{
                width: "100%",
                height: "100%",
              }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )
      )}
    </ScrollView>
  ) : (
    <View
      style={{
        width,
        height: 420,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name="image-outline"
        size={42}
        color="#999999"
      />
    </View>
  )}


  {/* ==========================================================
      IMAGE DOT INDICATOR
  ========================================================== */}

  {productImages.length > 1 && (
    <View
      style={{
        position: "absolute",
        bottom: 14,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
      }}
    >
      {productImages.map(
        (_: string, index: number) => (
          <View
            key={`indicator-${index}`}
            style={{
              width:
                index === activeImageIndex
                  ? 18
                  : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                index === activeImageIndex
                  ? "#111111"
                  : "rgba(0,0,0,0.25)",
            }}
          />
        )
      )}
    </View>
  )}
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

           <TouchableOpacity
  activeOpacity={0.8}
  onPress={() => setSizeGuideVisible(true)}
>
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
         {/* ============================================================
    COLOR SELECTOR
============================================================ */}
{/* ============================================================
    COLOR SELECTOR
============================================================ */}

<View
  style={[
    styles.sizeMatrixHeader,
    {
      marginTop: 18,
    },
    isRTL && {
      flexDirection: "row-reverse",
    },
  ]}
>
  <Text
    style={[
      styles.sizeSectionTitle,
      isRTL && {
        textAlign: "right",
      },
    ]}
  >
    {(t("selectColor") || "SELECT COLOR").toUpperCase()}
  </Text>

  {selectedColor ? (
    <Text
      style={[
        styles.selectedColorLabel,
        isRTL && {
          textAlign: "left",
        },
      ]}
    >
      {selectedColor.toUpperCase()}
    </Text>
  ) : null}
</View>

{/* ============================================================
    SHEIN-STYLE HORIZONTAL COLOR SELECTOR
    TEXT ONLY — NO COLOR IMAGES
============================================================ */}

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    paddingRight: 18,
    gap: 8,
  }}
  style={{
    marginTop: 2,
  }}
>
  {colorSelectorOptions.map(
    (color: string, index: number) => {
      const isStandard =
        color.toLowerCase() === "standard";

      const isSelected =
        selectedColor.toLowerCase() ===
        color.toLowerCase();

      const localizedLabel =
        getLocalizedColorName(
          color,
          index - 1
        );

      return (
        <TouchableOpacity
          key={`color-option-${color}-${index}`}
          activeOpacity={0.85}
          onPress={() =>
            handleColorChange(color)
          }
          style={[
            styles.sizeItemBox,
            {
              flex: 0,
              minWidth: 82,
              paddingHorizontal: 16,
              marginRight: 0,
            },
            isSelected &&
              styles.sizeItemBoxActive,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.sizeText,
              isSelected &&
                styles.sizeTextActive,
            ]}
          >
            {String(
              localizedLabel
            ).toUpperCase()}
          </Text>
        </TouchableOpacity>
      );
    }
  )}
</ScrollView>

{/* ============================================================
    HORIZONTAL COLOR NAME SELECTOR
============================================================ */}

{/* HORIZONTAL COLOR GALLERY */}

{Array.isArray(product?.availableColors) &&
product.availableColors.length > 0 ? (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{
      paddingVertical: 8,
      paddingRight: 16,
      paddingLeft: 2,
    }}
    style={{
      marginTop: 2,
    }}
  >
    {product.availableColors
      .flatMap((item: any) =>
        typeof item === "string"
          ? item
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [item]
      )
      .map(
        (
          rawColor: string,
          index: number
        ) => {
          const colorInEnglish =
            String(rawColor).trim();

          if (!colorInEnglish) {
            return null;
          }

          const isSelected =
            selectedColor === colorInEnglish;

          const thumbnail =
            getColorThumbnail(
              colorInEnglish
            );

          const localizedColorLabel =
            locale === "ps"
              ? product.availableColorsPs?.[
                  index
                ] ||
                colorInEnglish
              : locale === "fa"
                ? product.availableColorsFa?.[
                    index
                  ] ||
                  colorInEnglish
                : colorInEnglish;

          return (
            <TouchableOpacity
              key={`color-${colorInEnglish}-${index}`}
              activeOpacity={0.85}
              onPress={() =>
                handleColorChange(
                  colorInEnglish
                )
              }
              style={[
                styles.colorOption,
                isSelected &&
                  styles.colorOptionActive,
              ]}
            >
              {/* COLOR IMAGE */}

        

              {/* COLOR NAME */}

            </TouchableOpacity>
          );
        }
      )}
  </ScrollView>
) : (
  <View
    style={[
      styles.standardColorFallback,
      isRTL && {
        alignSelf: "flex-end",
      },
    ]}
  >
    <Text style={styles.standardColorFallbackText}>
      {(t("standardColor") || "STANDARD").toUpperCase()}
    </Text>
  </View>
)}
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
      {/* ============================================================
    SIZE GUIDE / PRODUCT DETAILS BOTTOM SHEET
============================================================ */}

<Modal
  visible={sizeGuideVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setSizeGuideVisible(false)}
>
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    }}
  >
    {/* BACKDROP */}

    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setSizeGuideVisible(false)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />

    {/* ========================================================
        BOTTOM SHEET
    ======================================================== */}

    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: "88%",
        paddingTop: 12,
        paddingBottom: insets.bottom + 18,
      }}
    >
      {/* HANDLE */}

      <View
        style={{
          width: 42,
          height: 4,
          borderRadius: 4,
          backgroundColor: "#D0D0D0",
          alignSelf: "center",
          marginBottom: 18,
        }}
      />

      {/* HEADER */}

      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: isRTL
            ? "row-reverse"
            : "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: "#111111",
              textAlign: isRTL
                ? "right"
                : "left",
            }}
          >
            {(
              t("sizeGuide") ||
              "SIZE GUIDE"
            ).toUpperCase()}
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#777777",
              textAlign: isRTL
                ? "right"
                : "left",
            }}
          >
            {(
              t("productDetails") ||
              "PRODUCT DETAILS"
            ).toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setSizeGuideVisible(false)
          }
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#F3F3F3",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="close"
            size={21}
            color="#111111"
          />
        </TouchableOpacity>
      </View>

      {/* ========================================================
          TABLE CONTENT
      ======================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        {Array.isArray(
          product?.specificationTables
        ) &&
        product.specificationTables.length > 0 ? (
          product.specificationTables.map(
            (table: any, tableIndex: number) => {
              const rows = Array.isArray(
                table?.rows
              )
                ? table.rows
                : [];

              if (rows.length === 0) {
                return null;
              }

              /*
               * Collect all measurement column names
               * from the rows.
               */

              const measurementKeys =
                Array.from(
                  new Set(
                    rows.flatMap(
                      (row: any) =>
                        row?.measurements &&
                        typeof row.measurements ===
                          "object"
                          ? Object.keys(
                              row.measurements
                            )
                          : []
                    )
                  )
                );

              /*
               * Localized table title
               */

              const localizedTitle =
                locale === "ps"
                  ? table.titlePs ||
                    table.title ||
                    ""
                  : locale === "fa"
                    ? table.titleFa ||
                      table.title ||
                      ""
                    : table.title || "";

              return (
                <View
                  key={`spec-table-${table.id || tableIndex}`}
                  style={{
                    marginBottom: 28,
                  }}
                >
                  {/* TABLE TITLE */}

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: "#111111",
                      marginBottom: 12,
                      textAlign: isRTL
                        ? "right"
                        : "left",
                    }}
                  >
                    {String(
                      localizedTitle
                    ).toUpperCase()}
                  </Text>

                  {/* ==================================================
                      HORIZONTAL TABLE
                  ================================================== */}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: "#E5E5E5",
                        borderRadius: 12,
                        overflow: "hidden",
                        minWidth:
                          Math.max(
                            320,
                            110 +
                              measurementKeys.length *
                                120
                          ),
                      }}
                    >
                      {/* HEADER ROW */}

                      <View
                        style={{
                          flexDirection: "row",
                          backgroundColor:
                            "#F5F5F5",
                          borderBottomWidth: 1,
                          borderBottomColor:
                            "#E5E5E5",
                        }}
                      >
                        {/* SIZE HEADER */}

                        <View
                          style={{
                            width: 90,
                            paddingVertical: 13,
                            paddingHorizontal: 10,
                            justifyContent:
                              "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "800",
                              color: "#111111",
                              textAlign:
                                "center",
                            }}
                          >
                            {(
                              t("size") ||
                              "SIZE"
                            ).toUpperCase()}
                          </Text>
                        </View>

                        {/* MEASUREMENT HEADERS */}

                        {measurementKeys.map((key: string) => (
                          <View
                            key={`header-${key}`}
                            style={{
                              width: 120,
                              paddingVertical: 13,
                              paddingHorizontal: 8,
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "800",
                                color: "#111111",
                                textAlign: "center",
                              }}
                            >
                              {String(key).toUpperCase()}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* DATA ROWS */}

                      {rows.map(
                        (
                          row: any,
                          rowIndex: number
                        ) => (
                          <View
                            key={`spec-row-${rowIndex}`}
                            style={{
                              flexDirection:
                                "row",
                              minHeight: 50,
                              backgroundColor:
                                rowIndex %
                                  2 ===
                                0
                                  ? "#FFFFFF"
                                  : "#FAFAFA",
                              borderBottomWidth:
                                rowIndex ===
                                rows.length -
                                  1
                                  ? 0
                                  : 1,
                              borderBottomColor:
                                "#EEEEEE",
                            }}
                          >
                            {/* SIZE */}

                            <View
                              style={{
                                width: 90,
                                paddingVertical: 13,
                                paddingHorizontal: 10,
                                justifyContent:
                                  "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "700",
                                  color:
                                    "#111111",
                                  textAlign:
                                    "center",
                                }}
                              >
                                {String(
                                  row?.size ||
                                    "-"
                                ).toUpperCase()}
                              </Text>
                            </View>

                            {/* MEASUREMENTS */}

                            {measurementKeys.map(
                              (
                                key: string
                              ) => {
                                const value =
                                  row
                                    ?.measurements?.[
                                    key
                                  ];

                                return (
                                  <View
                                    key={`cell-${rowIndex}-${key}`}
                                    style={{
                                      width: 120,
                                      paddingVertical: 13,
                                      paddingHorizontal: 8,
                                      justifyContent:
                                        "center",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        color:
                                          "#444444",
                                        textAlign:
                                          "center",
                                      }}
                                    >
                                      {value !==
                                        undefined &&
                                      value !==
                                        null &&
                                      String(
                                        value
                                      ).trim()
                                        ? String(
                                            value
                                          )
                                        : "-"}
                                    </Text>
                                  </View>
                                );
                              }
                            )}
                          </View>
                        )
                      )}
                    </View>
                  </ScrollView>
                </View>
              );
            }
          )
        ) : (
          /* ======================================================
             NO SIZE GUIDE
          ====================================================== */

          <View
            style={{
              paddingVertical: 45,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={42}
              color="#999999"
            />

            <Text
              style={{
                marginTop: 12,
                fontSize: 14,
                fontWeight: "600",
                color: "#777777",
                textAlign: "center",
              }}
            >
              {t("noSizeGuide") ||
                "No size guide available for this product."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  </View>
</Modal>
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
  <View style={styles.productDetailsOverlay}>

    <View style={styles.productDetailsSheet}>

      {/* =========================================================
          HEADER
      ========================================================= */}

      <View style={styles.productDetailsHeader}>

        <Text
          style={[
            styles.productDetailsTitle,
            isRTL && { textAlign: "right" },
          ]}
        >
          {(
            t("productDetails") ||
            "PRODUCT DETAILS"
          ).toUpperCase()}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setDescModalVisible(false)
          }
          style={styles.productDetailsClose}
        >
          <Ionicons
            name="close"
            size={22}
            color="#111111"
          />
        </TouchableOpacity>

      </View>


      {/* =========================================================
          SMALL SHEET HANDLE
      ========================================================= */}

      <View
        style={
          styles.productDetailsHandle
        }
      />


      {/* =========================================================
          EVERYTHING
      ========================================================= */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.productDetailsContent
        }
      >

        {/* =======================================================
            DESCRIPTION
        ======================================================= */}

        <View
          style={styles.detailsSection}
        >

          <Text
            style={[
              styles.detailsSectionTitle,
              isRTL && {
                textAlign: "right",
              },
            ]}
          >
            {(
              t("description") ||
              "DESCRIPTION"
            ).toUpperCase()}
          </Text>

          <Text
            style={[
              styles.detailsDescription,
              isRTL && {
                textAlign: "right",
              },
            ]}
          >
            {(
              locale === "ps"
                ? product.descriptionPs ||
                  product.description
                : locale === "fa"
                  ? product.descriptionFa ||
                    product.description
                  : product.description
            ) ||
              t("noDescription") ||
              "No description provided."}
          </Text>

        </View>


        {/* =======================================================
            COLORS
        ======================================================= */}

        {Array.isArray(
          product?.colorVariants
        ) &&
        product.colorVariants.length > 0 && (
          <View
            style={styles.detailsSection}
          >

            <Text
              style={[
                styles.detailsSectionTitle,
                isRTL && {
                  textAlign: "right",
                },
              ]}
            >
              {(
                t("availableColors") ||
                "AVAILABLE COLORS"
              ).toUpperCase()}
            </Text>


            <View
              style={[
                styles.detailsColorGrid,
                isRTL && {
                  flexDirection:
                    "row-reverse",
                },
              ]}
            >

              {product.colorVariants.map(
                (
                  colorVariant: any,
                  index: number
                ) => {

                  const colorName =
                    locale === "ps"
                      ? colorVariant.namePs ||
                        colorVariant.name
                      : locale === "fa"
                        ? colorVariant.nameFa ||
                          colorVariant.name
                        : colorVariant.name;

                  const images =
                    Array.isArray(
                      colorVariant.images
                    )
                      ? colorVariant.images
                      : colorVariant.imageUrl
                        ? [
                            colorVariant.imageUrl,
                          ]
                        : [];

                  const previewImage =
                    images[0] || null;


                  return (
                    <View
                      key={
                        colorVariant.id ||
                        `detail-color-${index}`
                      }
                      style={
                        styles.detailsColorItem
                      }
                    >

                      {/* COLOR IMAGE */}

                      {previewImage ? (
                        <Image
                          source={{
                            uri: previewImage,
                          }}
                          style={
                            styles.detailsColorImage
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={
                            styles.detailsColorImageFallback
                          }
                        >
                          <Ionicons
                            name="color-palette-outline"
                            size={24}
                            color="#999999"
                          />
                        </View>
                      )}


                      {/* COLOR NAME */}

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.detailsColorName,
                          isRTL && {
                            textAlign:
                              "center",
                          },
                        ]}
                      >
                        {String(
                          colorName || ""
                        ).toUpperCase()}
                      </Text>

                    </View>
                  );
                }
              )}

            </View>

          </View>
        )}


        {/* =======================================================
            AVAILABLE SIZES
        ======================================================= */}

        {Array.isArray(
          product?.availableSizes
        ) &&
        product.availableSizes.length > 0 && (
          <View
            style={styles.detailsSection}
          >

            <Text
              style={[
                styles.detailsSectionTitle,
                isRTL && {
                  textAlign: "right",
                },
              ]}
            >
              {(
                t("availableSizes") ||
                "AVAILABLE SIZES"
              ).toUpperCase()}
            </Text>


            <View
              style={[
                styles.detailsSizeRow,
                isRTL && {
                  flexDirection:
                    "row-reverse",
                },
              ]}
            >

              {product.availableSizes.map(
                (
                  size: string,
                  index: number
                ) => (
                  <View
                    key={`detail-size-${size}-${index}`}
                    style={
                      styles.detailsSizeBox
                    }
                  >
                    <Text
                      style={
                        styles.detailsSizeText
                      }
                    >
                      {String(
                        size
                      ).toUpperCase()}
                    </Text>
                  </View>
                )
              )}

            </View>

          </View>
        )}


        {/* =======================================================
            SPECIFICATION / SIZE GUIDE TABLES
        ======================================================= */}

        {Array.isArray(
          product?.specificationTables
        ) &&
        product.specificationTables.length > 0 && (

          <View
            style={styles.detailsSection}
          >

            {product.specificationTables.map(
              (
                table: any,
                tableIndex: number
              ) => {

                if (
                  table?.isActive === false
                ) {
                  return null;
                }


                const localizedTitle =
                  locale === "ps"
                    ? table.titlePs ||
                      table.title
                    : locale === "fa"
                      ? table.titleFa ||
                        table.title
                      : table.title;


                const rows =
                  Array.isArray(
                    table.rows
                  )
                    ? table.rows
                    : [];


                /*
                 * Dynamically discover every
                 * measurement column.
                 *
                 * Nothing is hard-coded here.
                 */

                const measurementKeys =
                  Array.from(
                    new Set(
                      rows.flatMap(
                        (row: any) =>
                          row?.measurements &&
                          typeof row.measurements ===
                            "object"
                            ? Object.keys(
                                row.measurements
                              )
                            : []
                      )
                    )
                  );


                return (
                  <View
                    key={
                      table.id ||
                      `spec-table-${tableIndex}`
                    }
                    style={
                      styles.detailsTableBlock
                    }
                  >

                    {/* TABLE TITLE */}

                    <Text
                      style={[
                        styles.detailsTableTitle,
                        isRTL && {
                          textAlign:
                            "right",
                        },
                      ]}
                    >
                      {String(
                        localizedTitle ||
                          "PRODUCT DETAILS"
                      ).toUpperCase()}
                    </Text>


                    {/* TABLE */}

                    {rows.length > 0 ? (

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={
                          false
                        }
                        style={{
                          width: "100%",
                        }}
                      >

                        <View
                          style={
                            styles.detailsTable
                          }
                        >

                          {/* HEADER */}

                          <View
                            style={[
                              styles.detailsTableRow,
                              styles.detailsTableHeaderRow,
                            ]}
                          >

                            <View
                              style={[
                                styles.detailsTableCell,
                                styles.detailsTableSizeCell,
                              ]}
                            >
                              <Text
                                style={
                                  styles.detailsTableHeaderText
                                }
                              >
                                {(
                                  t("size") ||
                                  "SIZE"
                                ).toUpperCase()}
                              </Text>
                            </View>


                            {measurementKeys.map(
                              (
                                key: string
                              ) => (
                                <View
                                  key={`header-${key}`}
                                  style={
                                    styles.detailsTableCell
                                  }
                                >
                                  <Text
                                    style={
                                      styles.detailsTableHeaderText
                                    }
                                  >
                                    {String(
                                      key
                                    ).toUpperCase()}
                                  </Text>
                                </View>
                              )
                            )}

                          </View>


                          {/* ROWS */}

                          {rows.map(
                            (
                              row: any,
                              rowIndex: number
                            ) => (

                              <View
                                key={
                                  row.id ||
                                  `table-row-${rowIndex}`
                                }
                                style={
                                  styles.detailsTableRow
                                }
                              >

                                {/* SIZE */}

                                <View
                                  style={[
                                    styles.detailsTableCell,
                                    styles.detailsTableSizeCell,
                                  ]}
                                >
                                  <Text
                                    style={
                                      styles.detailsTableCellText
                                    }
                                  >
                                    {String(
                                      row.size ||
                                        "-"
                                    ).toUpperCase()}
                                  </Text>
                                </View>


                                {/* MEASUREMENTS */}

                                {measurementKeys.map(
                                  (
                                    key: string
                                  ) => {

                                    const value =
                                      row?.measurements?.[
                                        key
                                      ];

                                    return (
                                      <View
                                        key={`${rowIndex}-${key}`}
                                        style={
                                          styles.detailsTableCell
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.detailsTableCellText
                                          }
                                        >
                                          {value !==
                                          undefined &&
                                          value !==
                                          null
                                            ? String(
                                                value
                                              )
                                            : "-"}
                                        </Text>
                                      </View>
                                    );
                                  }
                                )}

                              </View>
                            )
                          )}

                        </View>

                      </ScrollView>

                    ) : (

                      <Text
                        style={
                          styles.detailsEmptyText
                        }
                      >
                        {(
                          t("noInformation") ||
                          "No information available."
                        )}
                      </Text>

                    )}

                  </View>
                );
              }
            )}

          </View>
        )}


        {/* =======================================================
            PRODUCT AVAILABILITY
        ======================================================= */}

        <View
          style={styles.detailsSection}
        >

          <Text
            style={[
              styles.detailsSectionTitle,
              isRTL && {
                textAlign: "right",
              },
            ]}
          >
            {(
              t("productInformation") ||
              "PRODUCT INFORMATION"
            ).toUpperCase()}
          </Text>


          <View
            style={
              styles.detailsInfoList
            }
          >

            <View
              style={
                styles.detailsInfoRow
              }
            >
              <Text
                style={
                  styles.detailsInfoLabel
                }
              >
                {(
                  t("availability") ||
                  "AVAILABILITY"
                ).toUpperCase()}
              </Text>

              <Text
                style={
                  styles.detailsInfoValue
                }
              >
                {product?.isAvailable
                  ? (
                      t("available") ||
                      "AVAILABLE"
                    ).toUpperCase()
                  : (
                      t("unavailable") ||
                      "UNAVAILABLE"
                    ).toUpperCase()}
              </Text>
            </View>


          </View>

        </View>


        {/* =======================================================
            PRODUCT DESCRIPTION FALLBACK
        ======================================================= */}

        {(!product?.description &&
          !product?.descriptionPs &&
          !product?.descriptionFa) && (

          <View
            style={
              styles.detailsEmptyDescription
            }
          >

            <Text
              style={
                styles.detailsEmptyText
              }
            >
              {(
                t("noDescription") ||
                "No description provided."
              )}
            </Text>

          </View>

        )}

      </ScrollView>


      {/* =========================================================
          CLOSE BUTTON
      ========================================================= */}

      <View
        style={
          styles.productDetailsBottom
        }
      >

        <TouchableOpacity
          activeOpacity={0.85}
          style={
            styles.modalCloseBtn
          }
          onPress={() =>
            setDescModalVisible(false)
          }
        >

          <Text
            style={
              styles.modalCloseText
            }
          >
            {(
              t("close") ||
              "CLOSE"
            ).toUpperCase()}
          </Text>

        </TouchableOpacity>

      </View>

    </View>

  </View>
</Modal>

{imageViewerVisible && (
  <Modal
    visible={imageViewerVisible}
    transparent
    animationType="fade"
    onRequestClose={() => {
      setImageViewerVisible(false);
      setSelectedImageUri(null);
    }}
  >
    <View
      style={{
        flex: 1,
        backgroundColor: "#000000",
      }}
    >
      {/* CLOSE BUTTON */}

      <TouchableOpacity
        onPress={() => {
          setImageViewerVisible(false);
          setSelectedImageUri(null);
        }}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 18,
          zIndex: 100,
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "rgba(255,255,255,0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name="close"
          size={26}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* ========================================================
          ZOOM + SWIPE GALLERY
      ======================================================== */}

      <ImageViewer
        imageUrls={productImages.map((image: string) => ({
          url: image,
        }))}
        index={Math.max(
          0,
          productImages.findIndex(
            (image: string) => image === selectedImageUri
          )
        )}
        enableSwipeDown
        onSwipeDown={() => {
          setImageViewerVisible(false);
          setSelectedImageUri(null);
        }}
        onCancel={() => {
          setImageViewerVisible(false);
          setSelectedImageUri(null);
        }}
        enablePreload
        saveToLocalByLongPress={false}
        backgroundColor="#000000"
        renderIndicator={(currentIndex, allSize) => (
          <View
            style={{
              position: "absolute",
              top: insets.top + 20,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {currentIndex} / {allSize}
            </Text>
          </View>
        )}
      />
    </View>
  </Modal>
)}
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

  // ============================================================
// PRODUCT IMAGE GALLERY
// ============================================================
productDetailsOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "flex-end",
},

productDetailsSheet: {
  width: "100%",
  maxHeight: "92%",
  backgroundColor: "#FFFFFF",
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  overflow: "hidden",
},

productDetailsHandle: {
  alignSelf: "center",
  width: 42,
  height: 4,
  borderRadius: 2,
  backgroundColor: "#D5D5D5",
  marginTop: 8,
  marginBottom: 4,
},

productDetailsHeader: {
  minHeight: 58,
  paddingHorizontal: 18,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 1,
  borderBottomColor: "#EEEEEE",
},

productDetailsTitle: {
  fontSize: 15,
  fontWeight: "800",
  letterSpacing: 0.6,
  color: "#111111",
},

productDetailsClose: {
  width: 38,
  height: 38,
  borderRadius: 19,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#F5F5F5",
},

productDetailsContent: {
  paddingHorizontal: 18,
  paddingTop: 8,
  paddingBottom: 24,
},

detailsSection: {
  paddingVertical: 18,
  borderBottomWidth: 1,
  borderBottomColor: "#EEEEEE",
},

detailsSectionTitle: {
  fontSize: 13,
  fontWeight: "800",
  letterSpacing: 0.5,
  color: "#111111",
  marginBottom: 12,
},

detailsDescription: {
  fontSize: 14,
  lineHeight: 22,
  color: "#555555",
},

/* ============================================================
   COLORS
============================================================ */

detailsColorGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,
},

detailsColorItem: {
  width: 92,
  alignItems: "center",
},

detailsColorImage: {
  width: 82,
  height: 96,
  borderRadius: 6,
  backgroundColor: "#F5F5F5",
},

detailsColorImageFallback: {
  width: 82,
  height: 96,
  borderRadius: 6,
  backgroundColor: "#F5F5F5",
  alignItems: "center",
  justifyContent: "center",
},

detailsColorName: {
  marginTop: 7,
  fontSize: 11,
  fontWeight: "700",
  color: "#222222",
},

/* ============================================================
   SIZES
============================================================ */

detailsSizeRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
},

detailsSizeBox: {
  minWidth: 52,
  height: 38,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: "#DDDDDD",
  alignItems: "center",
  justifyContent: "center",
},

detailsSizeText: {
  fontSize: 12,
  fontWeight: "700",
  color: "#222222",
},

/* ============================================================
   TABLES
============================================================ */

detailsTableBlock: {
  marginTop: 4,
  marginBottom: 20,
},

detailsTableTitle: {
  fontSize: 13,
  fontWeight: "800",
  color: "#111111",
  marginBottom: 10,
},

detailsTable: {
  borderWidth: 1,
  borderColor: "#E1E1E1",
  minWidth: "100%",
},

detailsTableRow: {
  flexDirection: "row",
  minHeight: 42,
},

detailsTableHeaderRow: {
  backgroundColor: "#F6F6F6",
},

detailsTableCell: {
  minWidth: 100,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRightWidth: 1,
  borderBottomWidth: 1,
  borderColor: "#E1E1E1",
  justifyContent: "center",
},

detailsTableSizeCell: {
  minWidth: 64,
},

detailsTableHeaderText: {
  fontSize: 10,
  fontWeight: "800",
  color: "#222222",
},

detailsTableCellText: {
  fontSize: 12,
  fontWeight: "500",
  color: "#444444",
},

/* ============================================================
   PRODUCT INFORMATION
============================================================ */

detailsInfoList: {
  gap: 0,
},

detailsInfoRow: {
  minHeight: 42,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 1,
  borderBottomColor: "#F0F0F0",
},

detailsInfoLabel: {
  fontSize: 11,
  fontWeight: "700",
  color: "#777777",
},

detailsInfoValue: {
  fontSize: 12,
  fontWeight: "700",
  color: "#222222",
},

detailsEmptyDescription: {
  paddingVertical: 20,
},

detailsEmptyText: {
  fontSize: 13,
  color: "#888888",
  textAlign: "center",
},

/* ============================================================
   BOTTOM
============================================================ */

productDetailsBottom: {
  paddingHorizontal: 18,
  paddingTop: 10,
  paddingBottom: 16,
  borderTopWidth: 1,
  borderTopColor: "#EEEEEE",
  backgroundColor: "#FFFFFF",
},
imagePagination: {
  position: "absolute",
  bottom: 14,
  left: 0,
  right: 0,
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 5,
},

imagePaginationDot: {
  width: 5,
  height: 5,
  borderRadius: 3,
  backgroundColor: "rgba(255,255,255,0.55)",
},

imagePaginationDotActive: {
  width: 16,
  backgroundColor: "#FFFFFF",
},

// ============================================================
// COLOR VISUAL SELECTOR
// ============================================================

colorOption: {
  width: 78,
  marginRight: 10,
  alignItems: "center",
},

colorOptionActive: {
  transform: [
    {
      scale: 1.02,
    },
  ],
},

colorThumbnailWrapper: {
  width: 68,
  height: 78,
  borderRadius: 8,
  backgroundColor: "#F5F5F5",
  borderWidth: 1,
  borderColor: "#E8E8E8",
  overflow: "hidden",
  position: "relative",
},

colorThumbnailWrapperActive: {
  borderWidth: 2,
  borderColor: "#111111",
},

colorThumbnail: {
  width: "100%",
  height: "100%",
},

colorThumbnailFallback: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#F4F4F4",
},

colorSelectedCheck: {
  position: "absolute",
  right: 4,
  top: 4,
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: "#111111",
  justifyContent: "center",
  alignItems: "center",
},

colorOptionLabel: {
  marginTop: 7,
  width: 74,
  textAlign: "center",
  fontSize: 9,
  fontWeight: "700",
  color: "#777777",
  letterSpacing: 0.3,
},

colorOptionLabelActive: {
  color: "#111111",
  fontWeight: "900",
},

standardColorFallback: {
  alignSelf: "flex-start",
  paddingHorizontal: 16,
  paddingVertical: 11,
  borderRadius: 8,
  backgroundColor: "#111111",
},

standardColorFallbackText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "800",
  letterSpacing: 0.5,
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
