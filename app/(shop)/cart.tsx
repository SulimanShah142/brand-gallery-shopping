import React, { useMemo, useCallback , useState, useEffect} from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/Contexts/LanguageContext';
import { useCart } from '@/Contexts/CartContext';
import { useBadges } from '@/Contexts/BadgeContext';
import { API_URL } from '@/lib/config';
import { authClient } from '@/lib/auth-client';

export default function CartScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  const { state: cartState, removeFromCart, addToCart } = useCart();

  // 🎯 REAL-TIME LIVE DATA HYDRATION LAYER CELLS:
  // Holds full live, multi-lingual translations fetched directly from your Cloud Worker!
  const [hydratedProductsMap, setHydratedProductsMap] = useState<Record<string, any>>({});
  const [fetchingTranslations, setFetchingTranslations] = useState(false);
const [settings, setSettings] = useState<any>(null);
const [loadingSettings, setLoadingSettings] = useState(false);
const {
  data: session,
  cachedUser,
} = authClient.useSession();

const authenticated = Boolean(session?.session?.token);
  // =========================================================================
  // 🎯 THE LIVE RE-FETCH CURE:
  // Whenever the Cart screen displays or your user switches local system locales,
  // we dispatch an asynchronous batch fetch to fetch fresh translation nodes!
  // =========================================================================
  useEffect(() => {
    if (!cartState.items || cartState.items.length === 0) return;

    let mounted = true;
    async function hydrateCartCatalogTranslations() {
      try {
        setFetchingTranslations(true);
        const uniqueProductIdsList = Array.from(new Set(cartState.items.map((item: any) => item.id)));
        const freshLookupsRecord: Record<string, any> = {};

        // Execute parallel network queries directly from your cloud worker catalog indices
        await Promise.all(
          uniqueProductIdsList.map(async (productId) => {
            try {
              const res = await fetch(`${API_URL}/api/products/${productId}`);
              if (res.ok) {
                const productData = await res.json();
                freshLookupsRecord[productId] = productData;
              }
            } catch (err) {
              console.warn(`⚠️ Translation fetch deferred for Item #${productId}:`, err);
            }
          })
        );

        if (mounted) {
          setHydratedProductsMap(freshLookupsRecord);
        }
      } catch (globalErr) {
        console.error("❌ Cart translation hydration error:", globalErr);
      } finally {
        if (mounted) setFetchingTranslations(false);
      }
    }

    hydrateCartCatalogTranslations();
    return () => { mounted = false; };
  }, [cartState.items, locale]); // 🎯 Re-fires automatically the millisecond language drops/changes!


useEffect(() => {
  let mounted = true;

  const loadCartSettings = async () => {
    try {
      setLoadingSettings(true);

      const res = await fetch(
        `${API_URL}/api/admin/settings`
      );

      if (!res.ok) {
        throw new Error(
          `Settings request failed: ${res.status}`
        );
      }

      const data = await res.json();

      if (mounted) {
        setSettings(data);
      }

    } catch (error) {
      console.error(
        '❌ Cart settings fetch failed:',
        error
      );
    } finally {
      if (mounted) {
        setLoadingSettings(false);
      }
    }
  };

  loadCartSettings();

  return () => {
    mounted = false;
  };
}, []);


  const incrementQuantity = useCallback((item: any) => {
    addToCart(item, 1, item.selectedSize, item.selectedColor);
  }, [addToCart]);

  const decrementQuantity = useCallback((item: any) => {
    if (item.quantity > 1) {
      addToCart(item, -1, item.selectedSize, item.selectedColor);
    } else {
      removeFromCart(item.id, item.selectedSize, item.selectedColor);
    }
  }, [addToCart, removeFromCart]);


  const toLocalNumbersInline = useCallback(
  (num: string | number) => {
    const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');

    if (locale === 'en' || !locale) {
      return str;
    }

    const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    return str.replace(
      /[0-9]/g,
      (digit) => easternDigits[parseInt(digit, 10)]
    );
  },
  [locale]
);

// ============================================================
// CART SUBTOTAL — SAME BASIS AS CHECKOUT
// ============================================================

const calculateTotal = useMemo(() => {
  if (!cartState.items || cartState.items.length === 0) {
    return 0;
  }

  return cartState.items.reduce((sum, item) => {
    const price = Math.max(
      0,
      Number(item?.price ?? 0)
    );

    const quantity = Math.max(
      1,
      Number(item?.quantity ?? 1)
    );

    return sum + (price * quantity);
  }, 0);
}, [cartState.items]);

// ============================================================
// CART DISCOUNT PRICING
// SAME NEW-USER LOGIC AS CHECKOUT
// ============================================================



// ============================================================
// FREE DELIVERY — SAME SETTINGS AS CHECKOUT
// ============================================================

const freeDeliveryThreshold = useMemo(() => {
  const value = Number(
    settings?.freeDeliveryThreshold ??
    settings?.free_delivery_threshold ??
    2000
  );

  return Number.isFinite(value) ? value : 2000;
}, [settings]);


// ============================================================
// FREE DELIVERY PROGRESS
// ============================================================

const freeDeliveryProgress = useMemo(() => {
  if (
    !freeDeliveryThreshold ||
    freeDeliveryThreshold <= 0
  ) {
    return 100;
  }

  return Math.min(
    100,
    Math.round(
      (calculateTotal / freeDeliveryThreshold) * 100
    )
  );
}, [
  calculateTotal,
  freeDeliveryThreshold,
]);


// ============================================================
// FREE DELIVERY STATE
// ============================================================

const isFreeDelivery =
  freeDeliveryThreshold > 0 &&
  calculateTotal >= freeDeliveryThreshold;



  // ============================================================
// CART PRODUCT PRICING
// SAME NEW-USER DISCOUNT LOGIC AS CHECKOUT
// PLUS EXISTING PER-PRODUCT/CATALOG DISCOUNTS
// ============================================================
// ============================================================
// CART PRODUCT PRICING
// SAME NEW-USER DISCOUNT LOGIC AS CHECKOUT
// PLUS EXISTING PER-PRODUCT/CATALOG DISCOUNTS
// ============================================================

const cartPricing = useMemo(() => {
  const items = cartState.items || [];

  // ----------------------------------------------------------
  // NEW USER DISCOUNT SETTINGS
  // ----------------------------------------------------------

  const newUserDiscountActive =
    settings?.newUserDiscountActive === true ||
    String(
      settings?.newUserDiscountActive ?? ''
    ).toLowerCase() === 'true' ||
    Number(
      settings?.newUserDiscountActive ?? 0
    ) === 1;

  const pastOrderCount = Number(
    cachedUser?.orderCount ??
    cachedUser?.ordersCount ??
    cachedUser?.order_count ??
    cachedUser?.orders_count ??
    cachedUser?._count?.orders ??
    cachedUser?._count?.order ??
    0
  );

  const maxAllowedPurchases = Number(
    settings?.newUserMaxPurchaseCount ?? 1
  );

  const newUserDiscountType =
    settings?.newUserDiscountType ?? 'fixed';

  const newUserDiscountValue = Number(
    settings?.newUserDiscountValue ?? 0
  );

  let campaignDateValid = true;

  if (settings?.newUserDiscountExpiresAt) {
    campaignDateValid =
      new Date() <
      new Date(
        settings.newUserDiscountExpiresAt
      );
  }

  const isFirstShop =
    pastOrderCount < maxAllowedPurchases;

  const newUserDiscountEligible =
    newUserDiscountActive &&
    isFirstShop &&
    campaignDateValid;

  // ----------------------------------------------------------
  // ITEM PRICING
  // ----------------------------------------------------------

  const pricedItems = items.map((item: any) => {
    const product =
      hydratedProductsMap[
        String(item?.id ?? '').trim()
      ] ||
      item?.product ||
      item;

    // --------------------------------------------------------
    // CURRENT SELLING PRICE
    // --------------------------------------------------------

    const currentUnitPrice = Math.max(
      0,
      Number(
        item?.price ??
        product?.price ??
        0
      )
    );

    // --------------------------------------------------------
    // ORIGINAL PRODUCT PRICE
    //
    // This supports the different field names your catalog
    // may currently use.
    // --------------------------------------------------------

    const explicitOriginalPrice = Number(
      product?.originalPrice ??
      product?.original_price ??
      item?.originalPrice ??
      item?.original_price ??
      0
    );

    // --------------------------------------------------------
    // PRODUCT DISCOUNT PERCENTAGE
    // --------------------------------------------------------

    const rawCatalogDiscountPercentage = Number(
      product?.discountPercentage ??
      product?.discount_percentage ??
      item?.discountPercentage ??
      item?.discount_percentage ??
      0
    );

    let catalogDiscountPercentage =
      Math.min(
        100,
        Math.max(
          0,
          rawCatalogDiscountPercentage
        )
      );

    // --------------------------------------------------------
    // DETERMINE ORIGINAL PRICE
    //
    // If the catalog gives us an original price, use it.
    //
    // Otherwise, if it gives us a percentage discount,
    // reconstruct the original price.
    // --------------------------------------------------------

    let originalUnitPrice =
      explicitOriginalPrice > 0
        ? explicitOriginalPrice
        : currentUnitPrice;

    if (
      originalUnitPrice <= currentUnitPrice &&
      catalogDiscountPercentage > 0 &&
      catalogDiscountPercentage < 100
    ) {
      originalUnitPrice =
        currentUnitPrice /
        (1 - catalogDiscountPercentage / 100);
    }

    // --------------------------------------------------------
    // FALLBACK:
    // If original price is higher than current price,
    // calculate the percentage from the actual prices.
    // --------------------------------------------------------

    if (
      catalogDiscountPercentage <= 0 &&
      originalUnitPrice > currentUnitPrice &&
      originalUnitPrice > 0
    ) {
      catalogDiscountPercentage =
        (
          (
            originalUnitPrice -
            currentUnitPrice
          ) /
          originalUnitPrice
        ) *
        100;
    }

    catalogDiscountPercentage =
      Math.min(
        100,
        Math.max(
          0,
          catalogDiscountPercentage
        )
      );

    const hasCatalogDiscount =
      originalUnitPrice >
        currentUnitPrice &&
      catalogDiscountPercentage > 0;

    // --------------------------------------------------------
    // NEW USER PERCENTAGE DISCOUNT
    //
    // IMPORTANT:
    // This is applied ON TOP OF the product's current price,
    // exactly like Checkout's percentage discount engine.
    // --------------------------------------------------------

    const hasNewUserPercentageDiscount =
      newUserDiscountEligible &&
      newUserDiscountType ===
        'percentage' &&
      newUserDiscountValue > 0;

    const newUserDiscountPercentage =
      hasNewUserPercentageDiscount
        ? Math.min(
            100,
            Math.max(
              0,
              newUserDiscountValue
            )
          )
        : 0;

    // --------------------------------------------------------
    // FINAL UNIT PRICE
    // --------------------------------------------------------

    const discountedUnitPrice =
      hasNewUserPercentageDiscount
        ? Math.max(
            0,
            currentUnitPrice *
              (
                1 -
                newUserDiscountPercentage /
                  100
              )
          )
        : currentUnitPrice;

    // --------------------------------------------------------
    // QUANTITY
    // --------------------------------------------------------

    const quantity = Math.max(
      1,
      Number(item?.quantity ?? 1)
    );

    // --------------------------------------------------------
    // TOTALS
    // --------------------------------------------------------

    const totalItemOriginalPrice =
      Math.ceil(
        originalUnitPrice *
          quantity
      );

    const totalItemCurrentPrice =
      Math.ceil(
        currentUnitPrice *
          quantity
      );

    const totalItemFinalPrice =
      Math.ceil(
        discountedUnitPrice *
          quantity
      );

    // --------------------------------------------------------
    // NEW USER DISCOUNT AMOUNT
    // --------------------------------------------------------

    const newUserDiscountAmount =
      Math.max(
        0,
        totalItemCurrentPrice -
          totalItemFinalPrice
      );

    // --------------------------------------------------------
    // CATALOG DISCOUNT AMOUNT
    // --------------------------------------------------------

    const catalogDiscountAmount =
      hasCatalogDiscount
        ? Math.max(
            0,
            totalItemOriginalPrice -
              totalItemCurrentPrice
          )
        : 0;

    // --------------------------------------------------------
    // DISPLAY DISCOUNT
    //
    // This represents the product/catalog discount.
    // New-user discount is displayed separately when active.
    // --------------------------------------------------------

    const hasAnyDiscount =
      hasCatalogDiscount ||
      hasNewUserPercentageDiscount;

    return {
      item,

      product,

      quantity,

      currentUnitPrice,

      originalUnitPrice,

      discountedUnitPrice,

      totalItemOriginalPrice,

      totalItemCurrentPrice,

      totalItemFinalPrice,

      catalogDiscountPercentage,

      catalogDiscountAmount,

      hasCatalogDiscount,

      hasNewUserPercentageDiscount,

      newUserDiscountPercentage,

      newUserDiscountAmount,

      hasAnyDiscount,
    };
  });

  // ----------------------------------------------------------
  // TOTAL NEW USER DISCOUNT
  // ----------------------------------------------------------

  const newUserDiscount =
    pricedItems.reduce(
      (
        sum: number,
        pricing: any
      ) =>
        sum +
        pricing.newUserDiscountAmount,
      0
    );

  return {
    items: pricedItems,

    newUserDiscount,

    newUserDiscountActive,

    newUserDiscountEligible,

    newUserDiscountType,

    newUserDiscountValue,

    isFirstShop,
  };
}, [
  cartState.items,
  settings,
  cachedUser,
  hydratedProductsMap,
]);

  const goToCheckout = async () => {
    if (cartState.items.length === 0) {
      Alert.alert(t('emptyCart') || 'Your bag is empty.');
      return;
    }
    router.replace('/checkout');
  };

const renderCartItem = ({
  item,
}: {
  item: any;
}) => {
  // ==========================================================
  // LIVE PRODUCT / TRANSLATION RECOVERY
  // ==========================================================

  const liveProductMatch =
    hydratedProductsMap[
      String(item?.id ?? '').trim()
    ] ||
    item?.product ||
    item;

  // ==========================================================
  // LOCALIZED PRODUCT NAME
  // ==========================================================

  const cartProductDisplayTitle =
    locale === 'ps'
      ? (
          liveProductMatch?.namePs ||
          liveProductMatch?.name_ps ||
          liveProductMatch?.name ||
          ''
        )
      : locale === 'fa'
        ? (
            liveProductMatch?.nameFa ||
            liveProductMatch?.name_fa ||
            liveProductMatch?.name ||
            ''
          )
        : (
            liveProductMatch?.name ||
            ''
          );

  // ==========================================================
  // LOCALIZED COLOR
  // ==========================================================

  let localizedColorLabelText =
    item?.selectedColor ||
    'STANDARD';

  const baseColorsRaw =
    liveProductMatch?.availableColors;

  const baseColorsPs =
    liveProductMatch?.availableColorsPs;

  const baseColorsFa =
    liveProductMatch?.availableColorsFa;

  let availableColorsArray: string[] = [];
  let availableColorsPsArray: string[] = [];
  let availableColorsFaArray: string[] = [];

  if (baseColorsRaw) {
    availableColorsArray =
      Array.isArray(baseColorsRaw)
        ? baseColorsRaw.flatMap(
            (c: any) =>
              typeof c === 'string'
                ? c.split(',')
                : [c]
          )
        : typeof baseColorsRaw === 'string'
          ? baseColorsRaw.split(',')
          : [];
  }

  if (baseColorsPs) {
    availableColorsPsArray =
      Array.isArray(baseColorsPs)
        ? baseColorsPs.flatMap(
            (c: any) =>
              typeof c === 'string'
                ? c.split(',')
                : [c]
          )
        : typeof baseColorsPs === 'string'
          ? baseColorsPs.split(',')
          : [];
  }

  if (baseColorsFa) {
    availableColorsFaArray =
      Array.isArray(baseColorsFa)
        ? baseColorsFa.flatMap(
            (c: any) =>
              typeof c === 'string'
                ? c.split(',')
                : [c]
          )
        : typeof baseColorsFa === 'string'
          ? baseColorsFa.split(',')
          : [];
  }

  if (
    availableColorsArray.length > 0 &&
    item?.selectedColor
  ) {
    const colorMatchIdx =
      availableColorsArray.findIndex(
        (c: string) =>
          c?.trim().toLowerCase() ===
          String(
            item.selectedColor
          )
            .trim()
            .toLowerCase()
      );

    if (colorMatchIdx !== -1) {
      localizedColorLabelText =
        locale === 'ps'
          ? (
              availableColorsPsArray[
                colorMatchIdx
              ] ||
              item.selectedColor
            )
          : locale === 'fa'
            ? (
                availableColorsFaArray[
                  colorMatchIdx
                ] ||
                item.selectedColor
              )
            : item.selectedColor;
    }
  }

  // ==========================================================
  // PRICING
  // SAME ENGINE DEFINED ABOVE
  // ==========================================================

  const pricing = cartPricing.items.find(
    (entry: any) =>
      String(entry?.item?.id) ===
      String(item?.id)
  );

  // Safe fallback in case pricing isn't available yet.
  const quantity = Math.max(
    1,
    Number(
      pricing?.quantity ??
      item?.quantity ??
      1
    )
  );

  const currentUnitPrice = Math.max(
    0,
    Number(
      pricing?.currentUnitPrice ??
      item?.price ??
      liveProductMatch?.price ??
      0
    )
  );

  const originalUnitPrice = Math.max(
    currentUnitPrice,
    Number(
      pricing?.originalUnitPrice ??
      item?.originalPrice ??
      liveProductMatch?.originalPrice ??
      liveProductMatch?.original_price ??
      currentUnitPrice
    )
  );

  const discountedUnitPrice = Math.max(
    0,
    Number(
      pricing?.discountedUnitPrice ??
      currentUnitPrice
    )
  );

  // ==========================================================
  // LINE TOTALS
  // ==========================================================

  const totalItemOriginalPrice =
    Math.ceil(
      originalUnitPrice *
        quantity
    );

  const totalItemCurrentPrice =
    Math.ceil(
      currentUnitPrice *
        quantity
    );

  const totalItemFinalPrice =
    Math.ceil(
      discountedUnitPrice *
        quantity
    );

  // ==========================================================
  // CATALOG / PRODUCT DISCOUNT
  // ==========================================================

  const hasCatalogDiscount =
    Boolean(
      pricing?.hasCatalogDiscount
    );

  const catalogDiscountPercentage =
    Number(
      pricing?.catalogDiscountPercentage ??
      0
    );

  // ==========================================================
  // NEW USER DISCOUNT
  // ==========================================================

  const hasNewUserDiscount =
    Boolean(
      pricing?.hasNewUserPercentageDiscount
    );

  const newUserDiscountPercentage =
    hasNewUserDiscount
      ? Number(
          pricing?.newUserDiscountPercentage ??
          0
        )
      : 0;

  // ==========================================================
  // DISCOUNT AMOUNTS
  // ==========================================================

  const catalogDiscountAmount =
    Number(
      pricing?.catalogDiscountAmount ??
      Math.max(
        0,
        totalItemOriginalPrice -
          totalItemCurrentPrice
      )
    );

  const newUserDiscountAmount =
    Number(
      pricing?.newUserDiscountAmount ??
      Math.max(
        0,
        totalItemCurrentPrice -
          totalItemFinalPrice
      )
    );

  // ==========================================================
  // DISPLAY STATE
  // ==========================================================

  const hasAnyDiscount =
    hasCatalogDiscount ||
    hasNewUserDiscount;

  // ==========================================================
  // TOTAL DISPLAY DISCOUNT
  //
  // We calculate the actual percentage from the original
  // product price to the final price. This prevents the badge
  // from lying when a product discount and new-user discount
  // are both active.
  // ==========================================================

  const totalDisplayDiscountPercentage =
    totalItemOriginalPrice > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              (
                totalItemOriginalPrice -
                totalItemFinalPrice
              ) /
              totalItemOriginalPrice
            ) *
              100
          )
        )
      : 0;

  // ==========================================================
  // IMAGE
  // ==========================================================

  const imageUri =
    item?.imageUrl ||
    liveProductMatch?.imageUrl ||
    liveProductMatch?.image_url;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <View
      style={[
        styles.cartItem,
        isRTL && {
          flexDirection:
            'row-reverse',
        },
      ]}
    >

      {/* ==================================================== */}
      {/* CHECK ICON                                            */}
      {/* ==================================================== */}

      <View style={styles.checkCircle}>
        <Ionicons
          name="checkmark-circle"
          size={20}
          color="#000000"
        />
      </View>

      {/* ==================================================== */}
      {/* PRODUCT IMAGE                                         */}
      {/* ==================================================== */}

      <Image
        source={{
          uri: imageUri,
        }}
        style={
          styles.cartItemImage
        }
        resizeMode="cover"
      />

      {/* ==================================================== */}
      {/* PRODUCT INFORMATION                                   */}
      {/* ==================================================== */}

      <View
        style={styles.cartItemInfo}
      >

        {/* ================================================== */}
        {/* HEADER                                             */}
        {/* ================================================== */}

        <View
          style={[
            styles.itemHeader,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >

          <Text
            style={[
              styles.cartItemName,
              isRTL
                ? {
                    textAlign:
                      'right',
                  }
                : {
                    textAlign:
                      'left',
                  },
            ]}
            numberOfLines={1}
          >
            {(
              cartProductDisplayTitle ||
              ''
            ).toUpperCase()}
          </Text>

          <TouchableOpacity
            onPress={() =>
              removeFromCart(
                item.id,
                item.selectedSize,
                item.selectedColor
              )
            }
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color="#999999"
            />
          </TouchableOpacity>

        </View>

        {/* ================================================== */}
        {/* SIZE / COLOR                                       */}
        {/* ================================================== */}

        <Text
          style={[
            styles.itemVariant,
            isRTL
              ? {
                  textAlign:
                    'right',
                }
              : {
                  textAlign:
                    'left',
                },
          ]}
        >
          {t('size') || 'SIZE'}:{' '}
          {String(
            item?.selectedSize ||
              'M'
          ).toUpperCase()}

          {'   |   '}

          {t('color') || 'COLOR'}:{' '}
          {String(
            localizedColorLabelText ||
              'STANDARD'
          ).toUpperCase()}
        </Text>

        {/* ================================================== */}
        {/* PRICE + QUANTITY                                   */}
        {/* ================================================== */}

        <View
          style={[
            styles.priceQuantityRow,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >

          {/* ============================================== */}
          {/* PRICE BLOCK                                    */}
          {/* ============================================== */}

          <View
            style={
              styles.priceBlock
            }
          >

            {/* ========================================== */}
            {/* FINAL PRICE                                */}
            {/* ========================================== */}

            <Text
              style={
                styles.cartItemPrice
              }
            >
              {isRTL
                ? `${toLocalNumbersInline(
                    totalItemFinalPrice
                  )} ${
                    t(
                      'afnCurrency'
                    ) ||
                    'افغانۍ'
                  }`
                : `${
                    t(
                      'afnCurrency'
                    ) || 'AFN'
                  } ${toLocalNumbersInline(
                    totalItemFinalPrice
                  )}`}
            </Text>

            {/* ========================================== */}
            {/* ORIGINAL PRICE + DISCOUNT                  */}
            {/* ========================================== */}

            {hasAnyDiscount && (
              <View
                style={[
                  styles.discountRow,
                  isRTL && {
                    flexDirection:
                      'row-reverse',
                  },
                ]}
              >

                <Text
                  style={
                    styles.originalPrice
                  }
                >
                  {isRTL
                    ? `${toLocalNumbersInline(
                        totalItemOriginalPrice
                      )} ${
                        t(
                          'afnCurrency'
                        ) ||
                        'افغانۍ'
                      }`
                    : `${
                        t(
                          'afnCurrency'
                        ) ||
                        'AFN'
                      } ${toLocalNumbersInline(
                        totalItemOriginalPrice
                      )}`}
                </Text>

                {/* ==================================== */}
                {/* DISCOUNT BADGE                       */}
                {/* ==================================== */}

                {totalDisplayDiscountPercentage >
                  0 && (
                  <View
                    style={
                      styles.discountBadge
                    }
                  >
                    <Text
                      style={
                        styles.discountBadgeText
                      }
                    >
                      -
                      {toLocalNumbersInline(
                        Math.round(
                          totalDisplayDiscountPercentage
                        )
                      )}
                      %
                    </Text>
                  </View>
                )}

              </View>
            )}

            {/* ========================================== */}
            {/* NEW USER DISCOUNT LABEL                    */}
            {/* ========================================== */}

            {hasNewUserDiscount && (
              <View
                style={[
                  styles.discountRow,
                  isRTL && {
                    flexDirection:
                      'row-reverse',
                  },
                ]}
              >
                <Ionicons
                  name="sparkles"
                  size={12}
                  color="#16A34A"
                />

                <Text
                  style={
                    styles.discountBadgeText
                  }
                >
                  {t(
                    'newUserDiscount'
                  ) ||
                    'NEW USER DISCOUNT'}{' '}
                  -
                  {toLocalNumbersInline(
                    Math.round(
                      newUserDiscountPercentage
                    )
                  )}
                  %
                </Text>
              </View>
            )}

            {/* ========================================== */}
            {/* PRODUCT DISCOUNT LABEL                     */}
            {/* ========================================== */}

            {hasCatalogDiscount && (
              <View
                style={[
                  styles.discountRow,
                  isRTL && {
                    flexDirection:
                      'row-reverse',
                  },
                ]}
              >
                <Ionicons
                  name="pricetag"
                  size={12}
                  color="#16A34A"
                />

                <Text
                  style={
                    styles.discountBadgeText
                  }
                >
                  {t(
                    'productDiscount'
                  ) ||
                    'PRODUCT DISCOUNT'}{' '}
                  -
                  {toLocalNumbersInline(
                    Math.round(
                      catalogDiscountPercentage
                    )
                  )}
                  %
                </Text>
              </View>
            )}

          </View>

          {/* ============================================== */}
          {/* QUANTITY CONTROLS                             */}
          {/* ============================================== */}

          <View
            style={[
              styles.quantityContainer,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >

            <TouchableOpacity
              style={
                styles.qBtn
              }
              onPress={() =>
                decrementQuantity(
                  item
                )
              }
            >
              <Ionicons
                name="remove"
                size={14}
                color="#000000"
              />
            </TouchableOpacity>

            <Text
              style={
                styles.qText
              }
            >
              {toLocalNumbersInline(
                quantity
              )}
            </Text>

            <TouchableOpacity
              style={
                styles.qBtn
              }
              onPress={() =>
                incrementQuantity(
                  item
                )
              }
            >
              <Ionicons
                name="add"
                size={14}
                color="#000000"
              />
            </TouchableOpacity>

          </View>

        </View>

      </View>
    </View>
  );
};


  const toLocalNumbersFooter = (num: string | number) => {
    const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
    if (locale === 'en' || !locale) return str;
    const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={[styles.container, isRTL && { direction: 'rtl' }]}>
        
        {/* HEADER AREA */}
        <View style={[styles.header]}>
          <Text style={[styles.title]}>
            {(t('yourCart') || 'SHOPPING BAG').toUpperCase()}
          </Text>
        </View>

        {(!cartState.items || cartState.items.length === 0) ? (
          <View style={styles.emptyCart}>
            <Ionicons name="bag-handle-outline" size={44} color="#CCCCCC" />
            <Text style={styles.emptyCartText}>
              {t('emptyCart') || 'YOUR BAG IS CURRENTLY EMPTY.'}
            </Text>
            
            <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/')}>
              <Text style={styles.browseButtonText}>
                {(t('continueShopping') || 'CONTINUE SHOPPING').toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.mainCartBody}>

  {/* ========================================================== */}
  {/* FREE DELIVERY BANNER                                      */}
  {/* ========================================================== */}

{/* ========================================================== */}
{/* FREE DELIVERY STATUS                                      */}
{/* ========================================================== */}

{isFreeDelivery ? (

  // =========================================================
  // FREE DELIVERY UNLOCKED
  // =========================================================

  <View
    style={[
      styles.cartFreeDeliveryBanner,
      isRTL && {
        flexDirection: 'row-reverse',
      },
    ]}
  >
    <View style={styles.cartFreeDeliveryIcon}>
      <Ionicons
        name="checkmark"
        size={17}
        color="#FFFFFF"
      />
    </View>

    <View
      style={[
        styles.cartFreeDeliveryContent,
        isRTL && {
          alignItems: 'flex-end',
        },
      ]}
    >
      <Text
        style={[
          styles.cartFreeDeliveryTitle,
          isRTL && {
            textAlign: 'right',
          },
        ]}
      >
        {(
          t('freeShippingUnlocked') ||
          'FREE DELIVERY UNLOCKED'
        ).toUpperCase()}
      </Text>

      <Text
        style={[
          styles.cartFreeDeliverySubtitle,
          isRTL && {
            textAlign: 'right',
          },
        ]}
      >
        {t('freeDeliveryMessage') ||
          'Your order qualifies for free delivery.'}
      </Text>
    </View>
  </View>

) : (

  // =========================================================
  // FREE DELIVERY PROGRESS
  // =========================================================

  <View
    style={[
      styles.cartShippingProgressCard,
      isRTL && {
        alignItems: 'flex-end',
      },
    ]}
  >

    <View
      style={[
        styles.cartShippingProgressHeader,
        isRTL && {
          flexDirection: 'row-reverse',
        },
      ]}
    >

      <View
        style={[
          styles.cartShippingIcon,
          isRTL && {
            marginLeft: 8,
            marginRight: 0,
          },
        ]}
      >
        <Ionicons
          name="bicycle"
          size={16}
          color="#111111"
        />
      </View>

      <Text
        style={[
          styles.cartShippingProgressTitle,
          isRTL && {
            textAlign: 'right',
          },
        ]}
      >
        {(
          t('freeShippingProgress') ||
          'FREE DELIVERY PROGRESS'
        ).toUpperCase()}
      </Text>

    </View>

    {/* ===================================================== */}
    {/* PROGRESS BAR                                          */}
    {/* ===================================================== */}

    <View style={styles.cartProgressTrack}>
      <View
        style={[
          styles.cartProgressFill,
          {
            width: `${freeDeliveryProgress}%`,
          },
        ]}
      />
    </View>

    {/* ===================================================== */}
    {/* PERCENTAGE ONLY                                       */}
    {/* ===================================================== */}

    <View
      style={[
        styles.cartProgressBottomRow,
        isRTL && {
          flexDirection: 'row-reverse',
        },
      ]}
    >

      <Text
        style={[
          styles.cartProgressPercentage,
          isRTL && {
            textAlign: 'right',
          },
        ]}
      >
        {toLocalNumbersInline(freeDeliveryProgress)}%
      </Text>

      <Text
        style={[
          styles.cartProgressHint,
          isRTL && {
            textAlign: 'left',
          },
        ]}
      >
        {t('freeDeliveryProgressHint') ||
          'TO FREE DELIVERY'}
      </Text>

    </View>

  </View>
)}

<FlatList
  data={cartState.items}
  keyExtractor={(item, idx) =>
    `bag-item-${item.id}-${item.selectedSize}-${idx}`
  }
  renderItem={renderCartItem}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={styles.flatListContent}
/>


            {/* STICKY ACCENT FOOTER INTROSPECTION GROUP */}
            <View style={styles.stickyFooterWrapper}>
              <View style={[styles.totalContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.totalLabel}>
                  {(t('orderTotalSub') || 'ORDER TOTAL SUB').toUpperCase()}
                </Text>
                <Text style={styles.totalPrice}>
                  {isRTL ? `${toLocalNumbersFooter(calculateTotal)} ${t('afnCurrency') || 'افغانۍ'}` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbersFooter(calculateTotal)}`}
                </Text>
              </View>

              <TouchableOpacity style={styles.checkoutButton} onPress={goToCheckout}>
                <Text style={styles.checkoutButtonText}>
                  {(t('proceedSecureCheckout') || 'PROCEED TO SECURE CHECKOUT').toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F3F3',
  },

  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#000'
  },

  mainCartBody: {
    flex: 1
  },

  flatListContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120
  },

  // =========================================================
// CART FREE DELIVERY
// =========================================================

cartFreeDeliveryBanner: {
  marginHorizontal: 20,
  marginTop: 12,
  marginBottom: 4,

  paddingVertical: 12,
  paddingHorizontal: 14,

  borderRadius: 8,

  backgroundColor: '#F4F4F4',

  flexDirection: 'row',
  alignItems: 'center',
},

cartFreeDeliveryIcon: {
  width: 30,
  height: 30,

  borderRadius: 15,

  backgroundColor: '#111111',

  justifyContent: 'center',
  alignItems: 'center',

  marginRight: 10,
},

cartFreeDeliveryContent: {
  flex: 1,
},

cartFreeDeliveryTitle: {
  fontSize: 10,
  fontWeight: '900',
  color: '#111111',
  letterSpacing: 0.8,
},

cartFreeDeliverySubtitle: {
  marginTop: 3,

  fontSize: 9,
  fontWeight: '600',

  color: '#777777',
  letterSpacing: 0.2,
},

// =========================================================
// CART SHIPPING PROGRESS
// =========================================================

cartShippingProgressCard: {
  marginHorizontal: 20,
  marginTop: 12,
  marginBottom: 4,

  paddingVertical: 13,
  paddingHorizontal: 14,

  borderRadius: 8,

  backgroundColor: '#FAFAFA',

  borderWidth: 1,
  borderColor: '#EEEEEE',
},

cartShippingProgressHeader: {
  flexDirection: 'row',
  alignItems: 'center',
},

cartShippingIcon: {
  width: 28,
  height: 28,

  borderRadius: 14,

  backgroundColor: '#FFFFFF',

  borderWidth: 1,
  borderColor: '#E5E5E5',

  justifyContent: 'center',
  alignItems: 'center',

  marginRight: 8,
},

cartShippingProgressTitle: {
  fontSize: 9,
  fontWeight: '900',

  color: '#222222',

  letterSpacing: 0.7,
},

cartProgressTrack: {
  height: 6,

  width: '100%',

  backgroundColor: '#E9E9E9',

  borderRadius: 10,

  overflow: 'hidden',

  marginTop: 11,
},

cartProgressFill: {
  height: '100%',

  backgroundColor: '#111111',

  borderRadius: 10,
},

cartProgressBottomRow: {
  marginTop: 7,

  flexDirection: 'row',

  justifyContent: 'space-between',

  alignItems: 'center',
},

cartProgressPercentage: {
  fontSize: 10,

  fontWeight: '900',

  color: '#111111',
},

cartProgressHint: {
  fontSize: 8,

  fontWeight: '700',

  color: '#999999',

  letterSpacing: 0.4,
},
  // 🎯 CART ITEM (refined spacing system)
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 14,
    marginBottom: 14,

    borderBottomWidth: 1,
    borderBottomColor: '#F6F6F6',
  },

  checkCircle: {
    marginRight: 10,
    opacity: 0.9
  },

  cartItemImage: {
    width: 62,
    height: 82,
    backgroundColor: '#F5F5F5',
    borderRadius: 2
  },

  cartItemInfo: {
    flex: 1,
    marginLeft: 12
  },

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  cartItemName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    flex: 1,
    marginRight: 8,
    letterSpacing: 0.2
  },

  itemVariant: {
    fontSize: 9,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
    letterSpacing: 0.2
  },

  // 🎯 PRICE ROW (more breathing room)
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginTop: 10
  },

  cartItemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000'
  },

  // 🎯 QUANTITY CONTROL (now a “pill system”)
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 20,

    overflow: 'hidden',
    backgroundColor: '#FAFAFA'
  },


  qBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qText: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    color: '#000'
  },

  // 🎯 FOOTER (merged visual system)
  stickyFooterWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,

    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',

    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },

  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginHorizontal: 20,
    padding: 14,

    backgroundColor: '#FAFAFA',
    borderRadius: 6
  },

  totalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1
  },

  totalPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000'
  },

  priceBlock: {
  justifyContent: 'center',
},

discountRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 3,
  gap: 7,
},

originalPrice: {
  fontSize: 10,
  fontWeight: '600',
  color: '#999999',
  textDecorationLine: 'line-through',
},

discountBadge: {
  backgroundColor: '#F1F1F1',
  borderRadius: 4,
  paddingHorizontal: 5,
  paddingVertical: 2,
},

discountBadgeText: {
  fontSize: 8,
  fontWeight: '900',
  color: '#000000',
},

savedText: {
  marginTop: 3,
  fontSize: 8,
  fontWeight: '700',
  color: '#777777',
},

  checkoutButton: {
    backgroundColor: '#000',
    marginHorizontal: 20,
    marginTop: 10,

    paddingVertical: 16,
    alignItems: 'center',

    borderRadius: 6
  },

  checkoutButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3
  },

  // 🎯 EMPTY STATE (slightly more premium)
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },

  emptyCartText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.4
  },

  browseButton: {
    backgroundColor: '#000',
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 18,
    borderRadius: 6
  },

  browseButtonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  }
});