import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet,Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Alert, Platform, Modal } from 'react-native';
import { useRouter } from "expo-router";
import { useLanguage } from "@/Contexts/LanguageContext";
import { authClient } from "@/lib/auth-client";
import { useCart } from '../../Contexts/CartContext';
import UnifiedMap from '@/components/UnifiedMap';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import LocationPermissionModal from '@/components/LoxationPermissionModal';
import * as SecureStore from "expo-secure-store"


import { API_URL } from '@/lib/config';
import ProductImageViewer from '@/components/ProductImageViewer';

export default function CheckoutScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  const { clearCart, state } = useCart();

  const cartItems = state?.items || [];

  const {
    data: session,
    cachedUser,
    isPending: authPending,
  } = authClient.useSession();

  const authenticated = Boolean(session?.session?.token);

  // ============================================================
  // CORE STATE
  // ============================================================

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

const [form, setForm] = useState({
  name: '',
  phone: '',
  whatsapp: '',
  address: '',
});
  const [countryCode, setCountryCode] = useState('+93');
  const [countryPickerTarget, setCountryPickerTarget] = useState<'phone' | 'whatsapp' | null>(null);
  const countryCodes = [
    { code: '+93', label: 'Afghanistan' },
    { code: '+92', label: 'Pakistan' },
    { code: '+98', label: 'Iran' },
    { code: '+91', label: 'India' },
    { code: '+971', label: 'United Arab Emirates' },
    { code: '+966', label: 'Saudi Arabia' },
    { code: '+90', label: 'Turkey' },
    { code: '+1', label: 'United States / Canada' },
    { code: '+44', label: 'United Kingdom' },
  ];

  const getLocalNumber = (value: string) => {
    if (!value.startsWith('+')) return value;

    const matchingCountry = [...countryCodes]
      .sort((left, right) => right.code.length - left.code.length)
      .find((country) => value.startsWith(country.code));

    return matchingCountry
      ? value.slice(matchingCountry.code.length)
      : value;
  };

  const updateContactNumber = (field: 'phone' | 'whatsapp', value: string) => {
    const digits = value.replace(/\D/g, '');
    setForm((current) => ({ ...current, [field]: digits ? `${countryCode}${digits}` : '' }));
  };

  const selectCountryCode = (code: string) => {
    setCountryCode(code);
    if (countryPickerTarget) {
      setForm((current) => {
        const local = getLocalNumber(current[countryPickerTarget]);
        return { ...current, [countryPickerTarget]: local ? `${code}${local}` : '' };
      });
    }
    setCountryPickerTarget(null);
  };

  const [coords, setCoords] = useState<[number, number] | null>(null);

  // ============================================================
  // PROMO
  // ============================================================

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // ============================================================
  // LOCATION
  // ============================================================

  const [showCustomPermissionModal, setShowCustomPermissionModal] =
    useState(false);

  const [locationLoading, setLocationLoading] = useState(false);

  const [gpsServicesDisabled, setGpsServicesDisabled] = useState(false);

  const [skipGpsPromptThisSession, setSkipGpsPromptThisSession] =
    useState(false);

  const permissionFlowStarted = useRef(false);

  // ============================================================
  // LIVE PRODUCT CATALOG
  // ============================================================

  const [hydratedProductsMap, setHydratedProductsMap] =
    useState<Record<string, any>>({});

  const [catalogLoading, setCatalogLoading] = useState(true);

  // ============================================================
  // LOCALIZED NUMBER FORMATTER
  // ============================================================

  const toLocalNumbers = useCallback(
    (num: string | number) => {
      const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');

      if (locale === 'en' || !locale) {
        return str;
      }

      const easternDigits = [
        '۰',
        '۱',
        '۲',
        '۳',
        '۴',
        '۵',
        '۶',
        '۷',
        '۸',
        '۹',
      ];

      return str.replace(/[0-9]/g, (digit) => {
        return easternDigits[parseInt(digit, 10)];
      });
    },
    [locale]
  );

  // ============================================================
  // LIVE PRODUCT HYDRATION
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const fetchLiveProducts = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/products?limit=100`
        );

        if (!response.ok) {
          throw new Error(
            `Product catalog request failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (!mounted || !Array.isArray(data)) {
          return;
        }

        const mapping: Record<string, any> = {};

        for (const product of data) {
          if (product?.id) {
            mapping[String(product.id).trim()] = product;
          }
        }

        setHydratedProductsMap(mapping);
      } catch (error) {
        console.warn(
          '⚠️ Live checkout product hydration failed:',
          error
        );
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    fetchLiveProducts();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // CHECKOUT SETTINGS
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const fetchCheckoutSettings = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/admin/settings`
        );

        if (!response.ok) {
          throw new Error(
            `Settings request failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (mounted) {
          setSettings(data);
        }
      } catch (error) {
        console.error(
          '❌ Checkout settings fetch failed:',
          error
        );
      }
    };

    fetchCheckoutSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // GPS BOOTSTRAP
  // ============================================================

  // ============================================================
  // CHECKOUT TOTALS
  // ============================================================

const totals = useMemo(() => {
  // ============================================================
  // SETTINGS
  // ============================================================

  const readNumberSetting = (
    value: unknown,
    fallback: number
  ) => {
    const parsed = Number(value ?? fallback);
    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  };

  const baseDeliveryFee = readNumberSetting(
    settings?.deliveryFee ??
      settings?.delivery_fee,
    150
  );

  const freeDeliveryLimit = readNumberSetting(
    settings?.freeDeliveryThreshold ??
      settings?.free_delivery_threshold,
    2000
  );

  const prepayLimit = Number(
    settings?.prepaymentThreshold ?? 2500
  );

  const prepayPercentage = Number(
    settings?.prepaymentPercentage ?? 30
  );

  const rewardLimit = Number(
    settings?.rewardThreshold ?? 5000
  );

  const rewardValue = Number(
    settings?.rewardValue ?? 500
  );

  const rewardType =
    settings?.rewardType ?? 'discount';


  // ============================================================
  // RAW ITEM PRICES
  // ============================================================

  const itemPricingBase = cartItems.map(
    (item: any, index: number) => {
      const price = Math.max(
        0,
        Number(item?.price ?? 0)
      );

      const quantity = Math.max(
        1,
        Number(item?.quantity ?? 1)
      );

      const lineSubtotal =
        price * quantity;

      return {
        index,
        item,
        price,
        quantity,
        lineSubtotal,
      };
    }
  );


  // ============================================================
  // SUBTOTAL
  // ============================================================

  const subtotal = itemPricingBase.reduce(
    (sum, item) =>
      sum + item.lineSubtotal,
    0
  );


  // ============================================================
  // FIRST SHOP / NEW USER
  // ============================================================

  const newUserDiscountActive =
    settings?.newUserDiscountActive === true ||
    String(
      settings?.newUserDiscountActive
    ).toLowerCase() === 'true' ||
    Number(
      settings?.newUserDiscountActive
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

  let campaignDateValid = true;

  if (settings?.newUserDiscountExpiresAt) {
    campaignDateValid =
      new Date() <
      new Date(
        settings.newUserDiscountExpiresAt
      );
  }

  const isFirstShop =
    pastOrderCount <
    maxAllowedPurchases;

  let newUserDiscount = 0;

  const newUserDiscountType =
    settings?.newUserDiscountType ??
    'fixed';

  const newUserDiscountValue =
    Number(
      settings?.newUserDiscountValue ?? 0
    );

  if (
    newUserDiscountActive &&
    isFirstShop &&
    campaignDateValid
  ) {
    if (
      newUserDiscountType ===
      'percentage'
    ) {
      newUserDiscount =
        subtotal *
        (newUserDiscountValue / 100);
    } else {
      newUserDiscount =
        Math.min(
          newUserDiscountValue,
          subtotal
        );
    }
  }


  // ============================================================
  // PROMO
  // ============================================================

  let promoDiscount = 0;

  const promoIsPercentage =
    appliedPromo?.type === 'percentage';

  if (appliedPromo) {
    const promoValue =
      Number(
        appliedPromo?.value ?? 0
      );

    if (promoIsPercentage) {
      promoDiscount =
        subtotal *
        (promoValue / 100);
    } else {
      promoDiscount =
        Math.min(
          promoValue,
          subtotal
        );
    }
  }


  // ============================================================
  // MILESTONE
  // ============================================================

  let rewardDiscount = 0;
  let earnedGift: string | null = null;

  const hasClaimedReward =
    cachedUser?.hasClaimedMilestoneReward === true ||
    String(
      cachedUser?.hasClaimedMilestoneReward
    ).toLowerCase() === 'true' ||
    Number(
      cachedUser?.hasClaimedMilestoneReward
    ) === 1;

  const lifetimeSpend = Number(
    cachedUser?.totalLifetimeSpend ??
    cachedUser?.total_lifetime_spend ??
    0
  );

  const qualifiesByBasket =
    subtotal >= rewardLimit;

  const qualifiesByHistory =
    lifetimeSpend >= rewardLimit;

  const qualifiesForReward =
    (qualifiesByBasket ||
      qualifiesByHistory) &&
    !hasClaimedReward;

  if (qualifiesForReward) {
    if (
      rewardType === 'discount'
    ) {
      rewardDiscount =
        Math.min(
          rewardValue,
          subtotal
        );
    } else {
      earnedGift =
        String(
          settings?.rewardValue ??
          'FREE GIFT'
        );
    }
  }


  // ============================================================
  // PER-ITEM PERCENTAGE DISCOUNTS
  //
  // IMPORTANT:
  // Fixed discounts stay out of this calculation.
  // ============================================================

  const itemPricing = itemPricingBase.map(
    (entry) => {
      let percentageDiscount = 0;

      // --------------------------------------------------------
      // FIRST SHOP PERCENTAGE
      // --------------------------------------------------------

      if (
        newUserDiscount > 0 &&
        newUserDiscountType ===
          'percentage'
      ) {
        percentageDiscount +=
          entry.lineSubtotal *
          (newUserDiscountValue / 100);
      }

      // --------------------------------------------------------
      // PROMO PERCENTAGE
      // --------------------------------------------------------

      if (
        appliedPromo &&
        promoIsPercentage
      ) {
        const promoValue =
          Number(
            appliedPromo?.value ?? 0
          );

        percentageDiscount +=
          entry.lineSubtotal *
          (promoValue / 100);
      }

      // Never discount more than the line itself.
      percentageDiscount =
        Math.min(
          percentageDiscount,
          entry.lineSubtotal
        );

      const discountedLineTotal =
        Math.max(
          0,
          entry.lineSubtotal -
            percentageDiscount
        );

      const discountedUnitPrice =
        entry.quantity > 0
          ? discountedLineTotal /
            entry.quantity
          : discountedLineTotal;

      return {
        ...entry,

        percentageDiscount,

        discountedLineTotal,

        discountedUnitPrice,

        hasDiscount:
          percentageDiscount > 0,

        originalLineTotal:
          entry.lineSubtotal,
      };
    }
  );


  // ============================================================
  // TOTAL PERCENTAGE DISCOUNTS
  // ============================================================

  const itemPercentageDiscount =
    itemPricing.reduce(
      (sum, item) =>
        sum + item.percentageDiscount,
      0
    );


  // ============================================================
  // FIXED DISCOUNTS
  //
  // These remain order-level.
  // ============================================================

  const fixedNewUserDiscount =
    newUserDiscountType ===
    'fixed'
      ? newUserDiscount
      : 0;

  const fixedPromoDiscount =
    appliedPromo &&
    !promoIsPercentage
      ? promoDiscount
      : 0;

  const fixedRewardDiscount =
    rewardDiscount;


  // ============================================================
  // TOTAL DISCOUNTS
  // ============================================================

  const totalDiscount =
    itemPercentageDiscount +
    fixedNewUserDiscount +
    fixedPromoDiscount +
    fixedRewardDiscount;


  // ============================================================
  // MERCHANDISE AFTER DISCOUNTS
  // ============================================================

  const merchandiseAfterDiscounts =
    Math.max(
      0,
      subtotal - totalDiscount
    );


  // ============================================================
  // DELIVERY
  // ============================================================

  const isFreeShipping =
    subtotal >= freeDeliveryLimit;

  const shipping =
    isFreeShipping
      ? 0
      : baseDeliveryFee;


  // ============================================================
  // FINAL (keep the same AFN rounding on both client and server)
  // ============================================================

  const finalRaw = Math.max(
    0,
    merchandiseAfterDiscounts +
      shipping
  );

  const roundAfnTotal = (value: number) =>
    Math.round(
      Math.max(0, Number(value || 0)) /
        10
    ) * 10;

  const final = roundAfnTotal(finalRaw);


  // ============================================================
  // PREPAYMENT
  // ============================================================

  const requiresPrepayment =
    final >= prepayLimit;

  const prepayAmount =
    requiresPrepayment
      ? Math.ceil(
          final *
            (prepayPercentage / 100)
        )
      : 0;


  // ============================================================
  // RETURN
  // ============================================================

  return {
    subtotal,

    newUserDiscount,

    discount: promoDiscount,

    rewardDiscount,

    gift: earnedGift,

    shipping,

    isFree: isFreeShipping,

    final,

    requiresPrepayment,

    prepayPercent:
      prepayPercentage,

    prepayAmount,

    triggerMilestoneClaimFlag:
      qualifiesForReward,

    isFirstShop,

    qualifiesForReward,

    itemPricing,

    itemPercentageDiscount,

    fixedNewUserDiscount,

    fixedPromoDiscount,

    fixedRewardDiscount,

    totalDiscount,
  };
}, [
  cartItems,
  settings,
  appliedPromo,
  cachedUser,
]);
  // ============================================================
  // PROMO VALIDATION
  // ============================================================

  const handleValidatePromo = async () => {
    const code = promoInput.trim().toUpperCase();

    if (!code) {
      Alert.alert(
        t('error') || 'Error',
        'Please enter a valid discount code.'
      );
      return;
    }

    setPromoLoading(true);

    try {
      console.log(
        `📡 Validating promo code: ${code}`
      );

      const response = await fetch(
        `${API_URL}/api/discounts/validate?code=${encodeURIComponent(
          code
        )}&amount=${encodeURIComponent(
          totals.subtotal
        )}`
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setAppliedPromo(null);

        Alert.alert(
          t('error') || 'Error',
          data?.error ||
            'Invalid promo code or minimum spend requirement not met.'
        );

        return;
      }

      setAppliedPromo(data);

      Alert.alert(
        t('success') || 'Success',
        'Promo code applied successfully.'
      );
    } catch (error: any) {
      console.error(
        '❌ Promo validation failed:',
        error
      );

      Alert.alert(
        t('error') || 'Error',
        'Unable to validate the promo code. Please check your connection.'
      );
    } finally {
      setPromoLoading(false);
    }
  };

  // ============================================================
  // PLACE ORDER
  // ============================================================

  const handlePlaceOrder = async () => {
    // ----------------------------------------------------------
    // AUTH
    // ----------------------------------------------------------

    if (!authenticated) {
      Alert.alert(
        t('signInRequiredTitle') ||
          'Sign In Required',
        t('signInRequiredBody') ||
          'Please sign in or create an account before placing an order.',
        [
          {
            text: t('cancel') || 'Cancel',
            style: 'cancel',
          },
          {
            text: t('signIn') || 'Sign In',
            onPress: () =>
              router.push('/sign-in'),
          },
        ]
      );

      return;
    }

    // ----------------------------------------------------------
    // FORM VALIDATION
    // ----------------------------------------------------------

  if (
  !form.name.trim() ||
  !form.phone.trim() ||
  !form.address.trim()
) {
  Alert.alert(
    t('requiredFields') ||
      'Required Fields',
    t('fillAllDetails') ||
      'Please fill in all required information.'
  );

  return;
}

    const phoneDigits = form.phone.replace(/\D/g, '');
    const whatsappDigits = form.whatsapp.replace(/\D/g, '');
    const isValidInternationalNumber = (value: string) =>
      /^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ''));

    if (!isValidInternationalNumber(form.phone) || phoneDigits.length < 8 || phoneDigits.length > 15) {
      Alert.alert(t('invalidPhone') || 'Invalid phone number', 'Enter a valid international phone number with country code.');
      return;
    }

    if (form.whatsapp.trim() && (!isValidInternationalNumber(form.whatsapp) || whatsappDigits.length < 8 || whatsappDigits.length > 15)) {
      Alert.alert(t('invalidWhatsapp') || 'Invalid WhatsApp number', 'Enter a valid international WhatsApp number with country code.');
      return;
    }

    // ----------------------------------------------------------
    // CART VALIDATION
    // ----------------------------------------------------------

    if (!cartItems.length) {
      Alert.alert(
        t('error') || 'Error',
        'Your cart is empty.'
      );

      return;
    }

    // ----------------------------------------------------------
    // TOKEN
    // ----------------------------------------------------------

    const token =
      session?.session?.token;

    if (!token) {
      Alert.alert(
        t('error') || 'Error',
        'Your session has expired. Please sign in again.'
      );

      return;
    }

    setLoading(true);

    try {
      // --------------------------------------------------------
      // BUILD EXACT DATABASE ORDER ITEM PAYLOAD
      // --------------------------------------------------------

      const items = cartItems.map(
        (item: any) => ({
          productId: item.id,
          quantity: Math.max(
            1,
            Number(item.quantity ?? 1)
          ),
          price: Number(
            item.price ?? 0
          ),
          selectedSize:
            item.selectedSize || null,
          selectedColor:
            item.selectedColor || null,
        })
      );

      // --------------------------------------------------------
      // BUILD EXACT BACKEND ORDER PAYLOAD
      // --------------------------------------------------------

const payload = {
  customerName: form.name.trim(),

  phoneNumber: form.phone.trim(),

  whatsappNumber: form.whatsapp.trim(),

  address: form.address.trim(),

  latitude: coords
    ? String(coords[0])
    : null,

  longitude: coords
    ? String(coords[1])
    : null,

  // =========================================================
  // ORDER PRICING
  // =========================================================

  subtotal: Number(
    totals.subtotal
  ),

  shippingFee: Number(
    totals.shipping
  ),

  promoDiscount: Number(
    totals.discount ?? 0
  ),

  newUserDiscount: Number(
    totals.fixedNewUserDiscount ?? 0
  ),

  milestoneDiscount: Number(
    totals.fixedRewardDiscount ?? 0
  ),

  promoCode: appliedPromo
    ? String(
        promoInput ||
        appliedPromo.code ||
        ''
      )
        .trim()
        .toUpperCase()
    : null,

  totalAmount: Number(
    totals.final
  ),

  // =========================================================
  // ORDER ITEMS
  // =========================================================

items: totals.itemPricing.map(
  (entry: any) => ({
    ...entry.item,

    quantity: entry.quantity,

    price: Number(
      entry.discountedUnitPrice
    ),

    originalPrice: Number(
      entry.price
    ),

    discountAmount: Number(
      entry.percentageDiscount
    ),

    discountPercentage:
      entry.price > 0
        ? Number(
            (
              (
                entry.percentageDiscount /
                entry.lineSubtotal
              ) * 100
            ).toFixed(2)
          )
        : 0,

    selectedSize:
      entry.item.selectedSize,

    selectedColor:
      entry.item.selectedColor,
  })
),
};

      console.log(
        '🚀 Creating order:',
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      // --------------------------------------------------------
      // CREATE ORDER
      // --------------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      if (response.ok) {
        console.log(
          '✅ Order created successfully:',
          data?.order?.id
        );

        clearCart();

        Alert.alert(
          t('success') || 'Success',
          t('orderPlacedSuccess') ||
            'Your order has been placed successfully.'
        );

        router.replace('/orders');

        return;
      }

      // --------------------------------------------------------
      // BACKEND ERROR
      // --------------------------------------------------------

      console.error(
        '❌ Order creation failed:',
        data
      );

      Alert.alert(
        t('error') || 'Error',
        data?.error ||
          data?.details ||
          'Order placement failed.'
      );
    } catch (error) {
      console.error(
        '🔥 Order submission network error:',
        error
      );

      Alert.alert(
        t('error') || 'Error',
        'Network connection failed. Please check your internet connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  const freeDeliveryThreshold = Number(
    settings?.freeDeliveryThreshold ??
      settings?.free_delivery_threshold ??
      2000
  );

  const freeShippingProgress = Math.min(
    100,
    Math.round(
      (Number(totals.subtotal || 0) /
        Math.max(1, freeDeliveryThreshold)) *
        100
    )
  );

  const isFreeDelivery =
    Number(totals.subtotal || 0) >=
    freeDeliveryThreshold;
  // ============================================================
  // CHECKOUT MAP
  // ============================================================

  const MemoizedMap = useMemo(() => {
    if (!settings) {
      return (
        <View
          style={
            styles.mapLoaderContainer
          }
        >
          <ActivityIndicator
            size="small"
            color="#000"
          />
        </View>
      );
    }

    const warehouse: [
      number,
      number
    ] = [
      Number(
        settings?.warehouseLat ??
          settings?.warehouse_lat ??
          34.5330
      ),

      Number(
        settings?.warehouseLng ??
          settings?.warehouse_lng ??
          69.1660
      ),
    ];

    return (
      <UnifiedMap
        role="USER"
        destinationCoords={coords || [34.5553, 69.2075]}
        warehouseCoords={warehouse}
        driverCoords={null}
        showMarkers={Boolean(coords)}
        orderStatus="confirmed"
        orderId="checkout-preview"
      />
    );
  }, [coords, settings]);

  // ============================================================
  // LOCATION PERMISSION HANDLER
  // ============================================================

  const handleAllowLocation = async () => {
    try {
      setLocationLoading(true);

      console.log(
        '📍 Starting checkout GPS permission flow...'
      );

      let permission =
        await Location.getForegroundPermissionsAsync();

      if (!permission.granted) {
        permission =
          await Location.requestForegroundPermissionsAsync();

        console.log(
          '📍 Permission result:',
          permission
        );

        if (!permission.granted) {
          setShowCustomPermissionModal(
            false
          );
          return;
        }
      }

      // Small warm-up delay for cold GPS initialization.
      await new Promise((resolve) =>
        setTimeout(resolve, 600)
      );

      let position = null;

      try {
        position =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.Balanced,
            }
          );
      } catch {
        console.log(
          '📍 First GPS attempt failed, retrying...'
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 800)
        );

        position =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.High,
            }
          );
      }

      if (!position?.coords) {
        throw new Error(
          'GPS coordinates unavailable'
        );
      }

      const liveCoords: [
        number,
        number
      ] = [
        position.coords.latitude,
        position.coords.longitude,
      ];

      setCoords(liveCoords);
      setGpsServicesDisabled(false);
      setShowCustomPermissionModal(
        false
      );

      console.log(
        '✅ Checkout coordinates updated:',
        liveCoords
      );
    } catch (error) {
      console.error(
        '❌ Checkout GPS flow failed:',
        error
      );

      Alert.alert(
        t('error') || 'Error',
        'Unable to retrieve your location. Please make sure location services are enabled.'
      );
    } finally {
      setLocationLoading(false);
    }
  };



return (
  <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
     <KeyboardAvoidingView
       style={{ flex: 1 }}
       behavior={Platform.OS === "ios" ? "padding" : "height"}
       keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
     >
      <View style={styles.container}>
        
        {/* 1. MAP BOX AT ABSOLUTE TOP */}
        <View style={styles.mapContainer}>
          {MemoizedMap}
         
        </View>

        {/* 2. ISOLATED SCROLLING FORM ENTRIES */}
        <ScrollView 
          style={styles.scrollForm} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent} 
        >
          <View style={styles.section}>
            {/* 🎯 CLEAN DESIGN UPDATE: Removed the redundant live GPS trigger button tray entirely */}
        <View style={styles.sectionHeader}>
  <Text style={styles.sectionLabel}>
    {(
      t('shippingAddress') ||
      t('deliveryAddress') ||
      'SHIPPING ADDRESS'
    ).toUpperCase()}
  </Text>

  <TouchableOpacity
    style={styles.gpsBtn}
    onPress={handleAllowLocation}
    disabled={locationLoading}
    activeOpacity={0.75}
  >
    {locationLoading ? (
      <ActivityIndicator
        size="small"
        color="#000000"
      />
    ) : (
      <Ionicons
        name="locate-outline"
        size={17}
        color="#000000"
      />
    )}

    <Text style={styles.gpsBtnText}>
      {locationLoading
        ? (t('locating') || 'LOCATING...')
        : coords
          ? (t('locationSelected') || 'LOCATION SELECTED')
          : (t('useMyLocation') || 'USE MY LOCATION')}
    </Text>
  </TouchableOpacity>
</View>


<TextInput 
  placeholder={t('fullName') || "FULL NAME"} 
  placeholderTextColor="#BBBBBB" 
  style={[
    styles.input,
    isRTL && { textAlign: 'right' }
  ]} 
  value={form.name} 
  onChangeText={(v) =>
    setForm({
      ...form,
      name: v,
    })
  } 
  autoCapitalize="words"
/>

{/* PHONE */}
<View style={[styles.phoneField, isRTL && { flexDirection: 'row-reverse' }]}>
  <TouchableOpacity
    style={styles.countryCodeButton}
    onPress={() => setCountryPickerTarget('phone')}
    activeOpacity={0.8}
  >
    <Text style={styles.countryCodeText}>{countryCode}</Text>
    <Ionicons name="chevron-down" size={14} color="#555555" />
  </TouchableOpacity>
  <TextInput
    placeholder={t('phoneNumber') || 'PHONE NUMBER'}
    placeholderTextColor="#BBBBBB"
    style={[styles.phoneInput, isRTL && { textAlign: 'right' }]}
    keyboardType="phone-pad"
    value={getLocalNumber(form.phone)}
    onChangeText={(v) => updateContactNumber('phone', v)}
  />
</View>

{/* WHATSAPP */}
<View style={[styles.phoneField, isRTL && { flexDirection: 'row-reverse' }]}>
  <TouchableOpacity
    style={styles.countryCodeButton}
    onPress={() => setCountryPickerTarget('whatsapp')}
    activeOpacity={0.8}
  >
    <Text style={styles.countryCodeText}>{countryCode}</Text>
    <Ionicons name="chevron-down" size={14} color="#555555" />
  </TouchableOpacity>
  <TextInput
    placeholder={t('whatsappNumber') || 'WHATSAPP NUMBER (OPTIONAL)'}
    placeholderTextColor="#BBBBBB"
    style={[styles.phoneInput, isRTL && { textAlign: 'right' }]}
    keyboardType="phone-pad"
    value={getLocalNumber(form.whatsapp)}
    onChangeText={(v) => updateContactNumber('whatsapp', v)}
  />
</View>

{/* ADDRESS */}
<TextInput 
  placeholder={
    t('address') ||
    "SHIPPING ADDRESS"
  } 
  placeholderTextColor="#BBBBBB" 
  style={[
    styles.input,
    isRTL && { textAlign: 'right' }
  ]} 
  value={form.address} 
  onChangeText={(v) =>
    setForm({
      ...form,
      address: v,
    })
  } 
/>
</View>
                   {/* 🎯 MULTILINGUAL CHECKOUT CARGO MANIFEST RENDERING (EXACT MATCH ADJUSTMENT) */}
            <View style={styles.checkoutItemsManifestWrapper}>
              <Text style={[styles.manifestSectionHeading, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
                {(t('bagSummary') || 'REVIEW YOUR BAG ITEMS').toUpperCase()} ({cartItems.length})
              </Text>
   {/* 🎯 THE COMPLIANT FINITE LOCALIZED CHECKOUT LIST (LIVE DATABASE HYDRATED) */}
{cartItems.map((item: any, idx: number) => {
  // 🎯 LINK DIRECTLY INTO LIVE FETCHED BACKEND TRANSLATIONS MAP:
  const liveDbProductCard = hydratedProductsMap[String(item.id).trim()];
  const productRef = liveDbProductCard || item.product || item;
  
  const checkoutDisplayTitle = 
    locale === 'ps' ? (productRef.namePs || productRef.name_ps || productRef.name) : 
    locale === 'fa' ? (productRef.nameFa || productRef.name_fa || productRef.name) : 
    productRef.name;

  let localizedCheckoutColorLabel = item.selectedColor || 'STANDARD';
  
  // Resolve colors list array formatting exactly like your details page flatMap split routine does
  const baseColorsRaw = productRef.availableColors;
  const baseColorsPs = productRef.availableColorsPs;
  const baseColorsFa = productRef.availableColorsFa;

  let availableColorsArray: string[] = [];
  let availableColorsPsArray: string[] = [];
  let availableColorsFaArray: string[] = [];

  if (baseColorsRaw) {
    availableColorsArray = Array.isArray(baseColorsRaw) 
      ? baseColorsRaw.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
      : typeof baseColorsRaw === 'string' ? baseColorsRaw.split(',') : [];
  }

  if (baseColorsPs) {
    availableColorsPsArray = Array.isArray(baseColorsPs)
      ? baseColorsPs.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
      : typeof baseColorsPs === 'string' ? baseColorsPs.split(',') : [];
  }

  if (baseColorsFa) {
    availableColorsFaArray = Array.isArray(baseColorsFa)
      ? baseColorsFa.flatMap((c: string) => typeof c === 'string' ? c.split(',') : [c])
      : typeof baseColorsFa === 'string' ? baseColorsFa.split(',') : [];
  }

  // INDEX-MATCHED LOCALIZED VARIANT LABELS LOOKUP:
  if (availableColorsArray.length > 0) {
    const colorMatchIdx = availableColorsArray.findIndex(
      (c: string) => c?.trim().toLowerCase() === item.selectedColor?.trim().toLowerCase()
    );

    if (colorMatchIdx !== -1) {
      localizedCheckoutColorLabel = 
        locale === 'ps' ? (availableColorsPsArray[colorMatchIdx] || item.selectedColor) : 
        locale === 'fa' ? (availableColorsFaArray[colorMatchIdx] || item.selectedColor) : 
        item.selectedColor;
    }
  }

  const toLocalNumbersInline = (num: string | number) => {
    const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
    if (locale === 'en' || !locale) return str;
    const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  };

  const itemTotalCalculatedPrice = Math.ceil(parseFloat(item.price || '0') * (item.quantity || 1));
  const colorImages = productRef?.colorImageUrls?.[item.selectedColor] || productRef?.colorImages?.[item.selectedColor];
  const checkoutImageUri = (Array.isArray(colorImages) ? colorImages[0] : colorImages) || item.imageUrl || productRef.imageUrl;

  return (
    <View key={`checkout-slat-${item.id}-${idx}`} style={[styles.manifestItemRowLine, isRTL && { flexDirection: 'row-reverse' }]}>
      <TouchableOpacity
        onPress={() => checkoutImageUri && setSelectedImageUri(checkoutImageUri)}
        disabled={!checkoutImageUri}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`View ${checkoutDisplayTitle || 'product'} image`}
      >
        <Image
          source={{ uri: checkoutImageUri }}
          style={styles.manifestItemImageThumb}
          resizeMode="contain"
        />
      </TouchableOpacity>
      
      <View style={[styles.manifestItemDetailsCell, isRTL ? { alignItems: 'flex-end', paddingRight: 12 } : { alignItems: 'flex-start', paddingLeft: 12 }]}>
        <Text style={[styles.manifestItemNameText, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]} numberOfLines={1}>
          {(checkoutDisplayTitle || '')?.toUpperCase()}
        </Text>
        <Text style={[styles.manifestItemAttributesMetaText, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}>
          {t('qty') || 'QTY'}: {toLocalNumbersInline(item.quantity)}   |   {t('size') || 'SIZE'}: {String(item.selectedSize || 'M').toUpperCase()}   |   {t('color') || 'COLOR'}: {String(localizedCheckoutColorLabel || 'STANDARD').toUpperCase()}
        </Text>
      </View>

      <Text style={[styles.manifestItemPriceText, isRTL ? { textAlign: 'left' } : { textAlign: 'right' }]}>
        {isRTL ? `${toLocalNumbersInline(itemTotalCalculatedPrice)} ${t('afnCurrency') || 'افغانۍ'}` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbersInline(itemTotalCalculatedPrice)}`}
      </Text>
    </View>
  );
})}


   {/* ================================================================ */}
{/* CHECKOUT PRICING / SHEIN-STYLE PRODUCT PRICING                   */}
{/* ================================================================ */}

{(() => {
  const toLocalNumbers = (
    num: string | number
  ) => {
    const str = Math.ceil(
      Number(num || 0)
    ).toLocaleString('en-US');

    if (locale === 'en' || !locale) {
      return str;
    }

    const easternDigits = [
      '۰',
      '۱',
      '۲',
      '۳',
      '۴',
      '۵',
      '۶',
      '۷',
      '۸',
      '۹',
    ];

    return str.replace(
      /[0-9]/g,
      (w) =>
        easternDigits[
          parseInt(w, 10)
        ]
    );
  };

  const money = (
    amount: number
  ) =>
    isRTL
      ? `${toLocalNumbers(amount)} ${
          t('afnCurrency') ||
          'افغانۍ'
        }`
      : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(amount)}`;

  return (
    <View
      style={[
        styles.checkoutPricingContainer,
        isRTL && {
          alignItems: 'stretch',
        },
      ]}
    >

      {/* ========================================================== */}
      {/* PROMO CODE                                                  */}
      {/* ========================================================== */}

      <View style={styles.promoSection}>
        <Text
          style={[
            styles.subSectionLabel,
            isRTL && {
              textAlign: 'right',
            },
          ]}
        >
          {(
            t('discountPromoCode') ||
            'DISCOUNT PROMO CODE'
          ).toUpperCase()}
        </Text>

        <View
          style={[
            styles.promoRow,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <TextInput
            placeholder={
              t('enterCode') ||
              'ENTER CODE'
            }
            placeholderTextColor="#AAAAAA"
            autoCapitalize="characters"
            value={promoInput}
            onChangeText={(value) => {
              setPromoInput(
                value.toUpperCase()
              );

              if (appliedPromo) {
                setAppliedPromo(null);
              }
            }}
            editable={!promoLoading}
            style={[
              styles.promoInput,
              isRTL && {
                textAlign: 'right',
              },
            ]}
          />

          <TouchableOpacity
            style={[
              styles.promoApplyBtn,
              appliedPromo &&
                styles.promoAppliedBtn,
            ]}
            onPress={
              handleValidatePromo
            }
            disabled={
              promoLoading ||
              !!appliedPromo
            }
            activeOpacity={0.85}
          >
            {promoLoading ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.promoApplyText
                }
              >
                {appliedPromo
                  ? t('applied') ||
                    'APPLIED'
                  : t('apply') ||
                    'APPLY'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {appliedPromo && (
          <View
            style={[
              styles.appliedPromoCard,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Ionicons
              name="pricetag"
              size={16}
              color="#16A34A"
            />

            <View
              style={[
                styles.appliedPromoContent,
                isRTL && {
                  alignItems:
                    'flex-end',
                },
              ]}
            >
              <Text
                style={[
                  styles.appliedPromoCode,
                  isRTL && {
                    textAlign: 'right',
                  },
                ]}
              >
                {promoInput.toUpperCase()}
              </Text>

              <Text
                style={[
                  styles.appliedPromoDescription,
                  isRTL && {
                    textAlign: 'right',
                  },
                ]}
              >
                {appliedPromo.type ===
                'percentage'
                  ? `${appliedPromo.value}% ${
                      t('discount') ||
                      'discount'
                    }`
                  : `${money(
                      Number(
                        appliedPromo.value
                      )
                    )} ${
                      t('discount') ||
                      'discount'
                    }`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setAppliedPromo(
                  null
                );
                setPromoInput('');
              }}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color="#999999"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>


      {/* ========================================================== */}
      {/* PRODUCT PRICING                                            */}
      {/* ========================================================== */}

      <View style={styles.productDiscountSection}>

        <View
          style={[
            styles.productDiscountHeader,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <Text
            style={[
              styles.productDiscountTitle,
              isRTL && {
                textAlign: 'right',
              },
            ]}
          >
            {(
              t('items') ||
              'ITEMS'
            ).toUpperCase()}
          </Text>

          <Text
            style={[
              styles.productDiscountCount,
              isRTL && {
                textAlign: 'right',
              },
            ]}
          >
            {toLocalNumbers(
              cartItems.length
            )}
          </Text>
        </View>


        {totals.itemPricing.map(
          (pricing: any, index: number) => {

            const item =
              pricing.item;

            const product =
              hydratedProductsMap[
                String(
                  item.id
                ).trim()
              ] ||
              item.product ||
              item;

            const displayName =
              locale === 'ps'
                ? (
                    product.namePs ||
                    product.name_ps ||
                    product.name
                  )
                : locale === 'fa'
                  ? (
                      product.nameFa ||
                      product.name_fa ||
                      product.name
                    )
                  : product.name;

            const hasPercentageDiscount =
              pricing.percentageDiscount >
              0;

            const originalPrice =
              pricing.originalLineTotal;

            const discountedPrice =
              pricing.discountedLineTotal;

            const localizedDiscount =
              hasPercentageDiscount
                ? (
                    (
                      pricing.percentageDiscount /
                      Math.max(
                        1,
                        originalPrice
                      )
                    ) * 100
                  )
                : 0;

            return (
              <View
                key={`pricing-${item.id}-${index}`}
                style={[
                  styles.discountProductCard,
                  isRTL && {
                    flexDirection:
                      'row-reverse',
                  },
                ]}
              >

                {/* IMAGE */}

                <Image
                  source={{
                    uri:
                      item.imageUrl ||
                      product.imageUrl,
                  }}
                  style={
                    styles.discountProductImage
                  }
                  resizeMode="cover"
                />


                {/* DETAILS */}

                <View
                  style={[
                    styles.discountProductInfo,
                    isRTL && {
                      alignItems:
                        'flex-end',
                    },
                  ]}
                >

                  <Text
                    style={[
                      styles.discountProductName,
                      isRTL && {
                        textAlign:
                          'right',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {(
                      displayName ||
                      ''
                    ).toUpperCase()}
                  </Text>


                  <Text
                    style={[
                      styles.discountProductMeta,
                      isRTL && {
                        textAlign:
                          'right',
                      },
                    ]}
                  >
                    {t('qty') ||
                      'QTY'}:{' '}
                    {toLocalNumbers(
                      pricing.quantity
                    )}
                  </Text>


                  {/* PRICE */}

                  <View
                    style={[
                      styles.discountProductPriceRow,
                      isRTL && {
                        flexDirection:
                          'row-reverse',
                      },
                    ]}
                  >

                    {hasPercentageDiscount && (
                      <Text
                        style={
                          styles.discountOriginalPrice
                        }
                      >
                        {money(
                          originalPrice
                        )}
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.discountFinalPrice,
                        isRTL && {
                          textAlign:
                            'right',
                        },
                      ]}
                    >
                      {money(
                        discountedPrice
                      )}
                    </Text>

                  </View>


                  {/* DISCOUNT BADGE */}

                  {hasPercentageDiscount && (
                    <View
                      style={[
                        styles.productDiscountBadge,
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
                          styles.productDiscountBadgeText
                        }
                      >
                        {`-${toLocalNumbers(
                          Math.round(
                            localizedDiscount
                          )
                        )}% `}
                        {t(
                          'discount'
                        ) ||
                          'OFF'}
                      </Text>
                    </View>
                  )}

                </View>
              </View>
            );
          }
        )}
      </View>


      {/* ========================================================== */}
      {/* ORDER SUMMARY                                               */}
      {/* ========================================================== */}

      <View
        style={styles.billingCard}
      >

        <Text
          style={[
            styles.billingCardTitle,
            isRTL && {
              textAlign:
                'right',
            },
          ]}
        >
          {(
            t('orderSummary') ||
            'ORDER SUMMARY'
          ).toUpperCase()}
        </Text>


        {/* SUBTOTAL */}

        <View
          style={[
            styles.billingRow,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <Text
            style={styles.billLabel}
          >
            {t('subtotal') ||
              'Subtotal'}
          </Text>

          <Text
            style={styles.billValue}
          >
            {money(
              totals.subtotal
            )}
          </Text>
        </View>


        {/* PRODUCT PERCENTAGE SAVINGS */}

        {totals.itemPercentageDiscount >
          0 && (
          <View
            style={[
              styles.billingRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.discountBillLabel
              }
            >
              {t(
                'productDiscount'
              ) ||
                'Product Discounts'}
            </Text>

            <Text
              style={
                styles.discountBillValue
              }
            >
              -{money(
                totals.itemPercentageDiscount
              )}
            </Text>
          </View>
        )}


        {/* FIXED FIRST-SHOP DISCOUNT */}

        {totals.fixedNewUserDiscount >
          0 && (
          <View
            style={[
              styles.billingRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.discountBillLabel
              }
            >
              {t(
                'welcomeBonusLabel'
              ) ||
                'Welcome Bonus'}
            </Text>

            <Text
              style={
                styles.discountBillValue
              }
            >
              -{money(
                totals.fixedNewUserDiscount
              )}
            </Text>
          </View>
        )}


        {/* FIXED PROMO */}

        {totals.fixedPromoDiscount >
          0 && (
          <View
            style={[
              styles.billingRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.discountBillLabel
              }
            >
              {t(
                'promoMarkdown'
              ) ||
                'Promo Discount'}
            </Text>

            <Text
              style={
                styles.discountBillValue
              }
            >
              -{money(
                totals.fixedPromoDiscount
              )}
            </Text>
          </View>
        )}


        {/* MILESTONE */}

        {totals.fixedRewardDiscount >
          0 && (
          <View
            style={[
              styles.billingRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.discountBillLabel
              }
            >
              {t(
                'milestoneReward'
              ) ||
                'Milestone Reward'}
            </Text>

            <Text
              style={
                styles.discountBillValue
              }
            >
              -{money(
                totals.fixedRewardDiscount
              )}
            </Text>
          </View>
        )}


        {/* DELIVERY */}

        <View
          style={[
            styles.billingRow,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <Text
            style={styles.billLabel}
          >
            {t(
              'shippingFreight'
            ) || 'Delivery'}
          </Text>

          <Text
            style={[
              styles.billValue,
              totals.shipping ===
                0 &&
                styles.freeShippingValue,
            ]}
          >
            {totals.shipping ===
            0
              ? (
                  t(
                    'freeShipping'
                  ) ||
                  'FREE'
                )
              : money(
                  totals.shipping
                )}
          </Text>
        </View>


        <View
          style={styles.dividerLine}
        />


        {/* TOTAL SAVINGS */}

        {totals.totalDiscount >
          0 && (
          <View
            style={[
              styles.totalSavingsRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.totalSavingsLabel
              }
            >
              {t('youSave') ||
                'YOU SAVE'}
            </Text>

            <Text
              style={
                styles.totalSavingsValue
              }
            >
              -{money(
                totals.totalDiscount
              )}
            </Text>
          </View>
        )}


        {/* FINAL */}

        <View
          style={[
            styles.totalRowSplit,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <View
            style={[
              styles.totalLabelContainer,
              isRTL && {
                alignItems:
                  'flex-end',
              },
            ]}
          >
            <Text
              style={
                styles.grandTotalLabel
              }
            >
              {(
                t(
                  'totalPayable'
                ) ||
                'TOTAL PAYABLE'
              ).toUpperCase()}
            </Text>
          </View>

          <Text
            style={
              styles.grandTotalValue
            }
          >
            {money(
              totals.final
            )}
          </Text>
        </View>

      </View>


      {/* ========================================================== */}
      {/* PREPAYMENT                                                  */}
      {/* ========================================================== */}

      {false && totals.requiresPrepayment && (
        <View
          style={
            styles.prepaymentCard
          }
        >
          <View
            style={[
              styles.prepaymentHeader,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Ionicons
              name="card-outline"
              size={19}
              color="#111111"
            />

            <Text
              style={[
                styles.prepaymentTitle,
                isRTL && {
                  textAlign:
                    'right',
                },
              ]}
            >
              {(
                t(
                  'prepaymentRequired'
                ) ||
                'PREPAYMENT REQUIRED'
              ).toUpperCase()}
            </Text>
          </View>

          <Text
            style={[
              styles.prepaymentDescription,
              isRTL && {
                textAlign:
                  'right',
              },
            ]}
          >
            {(
              t(
                'prepaymentDescription'
              ) ||
              'This order requires a {{percentage}}% prepayment.'
            ).replace(
              '{{percentage}}',
              String(
                totals.prepayPercent
              )
            )}
          </Text>

          <View
            style={[
              styles.prepaymentAmountRow,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Text
              style={
                styles.prepaymentAmountLabel
              }
            >
              {t(
                'prepaymentAmount'
              ) ||
                'PREPAYMENT'}
            </Text>

            <Text
              style={
                styles.prepaymentAmount
              }
            >
              {money(
                totals.prepayAmount
              )}
            </Text>
          </View>
        </View>
      )}


      {/* ========================================================== */}
      {/* FREE SHIPPING                                               */}
      {/* ========================================================== */}

      {!totals.isFree && (
        <View
          style={[
            styles.shippingProgressCard,
            isRTL && {
              alignItems:
                'flex-end',
            },
          ]}
        >
          <View
            style={[
              styles.shippingProgressHeader,
              isRTL && {
                flexDirection:
                  'row-reverse',
              },
            ]}
          >
            <Ionicons
              name="bicycle"
              size={18}
              color="#111111"
            />

            <Text
              style={[
                styles.shippingProgressTitle,
                isRTL && {
                  textAlign:
                    'right',
                },
              ]}
            >
              {(
                t(
                  'freeShippingProgress'
                ) ||
                'FREE SHIPPING PROGRESS'
              ).toUpperCase()}
            </Text>
          </View>

          <View
            style={styles.progressTrack}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    (
                      totals.subtotal /
                      Math.max(
                        1,
                        Number(
                          settings?.freeDeliveryThreshold ??
                            2000
                        )
                      )
                    ) *
                      100
                  )}%`,
                },
              ]}
            />
          </View>

        <Text
  style={[
    styles.progressRemaining,
    isRTL && {
      textAlign: 'right',
    },
  ]}
>
  {freeShippingProgress}%{' '}
  {t('freeShippingProgressComplete') ||
    'to free delivery'}
</Text>
        </View>
      )}


      {totals.isFree && (
        <View
          style={[
            styles.freeShippingCard,
            isRTL && {
              flexDirection:
                'row-reverse',
            },
          ]}
        >
          <View
            style={
              styles.freeShippingIcon
            }
          >
            <Ionicons
              name="checkmark"
              size={17}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={[
              styles.freeShippingText,
              isRTL && {
                textAlign:
                  'right',
              },
            ]}
          >
            {t(
              'freeShippingUnlocked'
            ) ||
              'FREE DELIVERY UNLOCKED'}
          </Text>
        </View>
      )}


      <View
        style={{ height: 125 }}
      />

    </View>
  );
})()}

    {/* ========================================================================= */}
    {/* 📍 ZERO-JANK LOCATION PERMISSION MODAL */}
    {/* ========================================================================= */}
    <LocationPermissionModal
      visible={showCustomPermissionModal}
      loading={locationLoading}
      title="Enable Precise Location"
      description="Brand Gallery uses your live location to improve delivery accuracy, estimate arrival times, and automatically position your delivery pin."
      onCancel={() => {
    setShowCustomPermissionModal(false);
    setSkipGpsPrompt(true); // 🔥 CRITICAL FIX
  }}
  onAllow={async () => {
  try {
    setLocationLoading(true);
    console.log("📍 Starting checkout GPS permission flow...");

    // 1. Ensure permission
    let permission = await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      permission = await Location.requestForegroundPermissionsAsync();
      console.log("📍 Permission result:", permission);

      if (!permission.granted) {
        setShowCustomPermissionModal(false);
        return;
      }
    }

    // 2. IMPORTANT: small warm-up delay (fixes first-call GPS bug)
    await new Promise(res => setTimeout(res, 600));

    // 3. FIRST attempt (often cold fails on Android)
    let position = null;

    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (e) {
      console.log("📍 First GPS attempt failed, retrying...");

      // 4. SECOND attempt (this is what fixes your issue)
      await new Promise(res => setTimeout(res, 800));

      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    }

    if (!position?.coords) {
      throw new Error("GPS unavailable");
    }

    const liveCoords: [number, number] = [
      position.coords.latitude,
      position.coords.longitude,
    ];

    setCoords(liveCoords);

    console.log("✅ Checkout Coordinates Updated:", liveCoords);

    setGpsServicesDisabled(false);
    setShowCustomPermissionModal(false);

  } catch (err) {
    console.log("❌ GPS flow failed", err);
  } finally {
    setLocationLoading(false);
  }
}}
    />


          </View>
        </ScrollView>

        <Modal
          visible={countryPickerTarget !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setCountryPickerTarget(null)}
        >
          <View style={styles.countryModalOverlay}>
            <TouchableOpacity
              style={styles.countryModalBackdrop}
              activeOpacity={1}
              onPress={() => setCountryPickerTarget(null)}
            />
            <View style={styles.countryModalCard}>
              <Text style={[styles.countryModalTitle, isRTL && { textAlign: 'right' }]}>
                {(t('selectCountryCode') || 'SELECT COUNTRY CODE').toUpperCase()}
              </Text>
              <ScrollView
                style={styles.countryOptionsScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {countryCodes.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    style={[styles.countryOption, isRTL && { flexDirection: 'row-reverse' }]}
                    onPress={() => selectCountryCode(country.code)}
                  >
                    <Text style={styles.countryOptionCode}>{country.code}</Text>
                    <Text style={[styles.countryOptionLabel, isRTL && { textAlign: 'right' }]}>{country.label}</Text>
                    {country.code === countryCode && <Ionicons name="checkmark" size={18} color="#111111" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        
           <View style={styles.stickyFooter}>
            <TouchableOpacity 
              style={[styles.orderBtn, loading && { opacity: 0.7 }]} 
              onPress={handlePlaceOrder} 
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.orderBtnText}>
                  {((t('placeOrder') || 'CONFIRM ORDER').toUpperCase())} (AFN {toLocalNumbers(totals.final)})
                </Text>
              )}
            </TouchableOpacity>
          </View>

      </View>


    </KeyboardAvoidingView>

    <ProductImageViewer
      visible={Boolean(selectedImageUri)}
      imageUri={selectedImageUri}
      onClose={() => setSelectedImageUri(null)}
    />

    {/* 🎯 APPMARKET COMPLIANT TRANSPARENT SYSTEM RATIONALE OVERLAY MODAL */}
</View>
   
    
  );
}


const styles = StyleSheet.create({
 container: {
  flex: 1,
  backgroundColor: '#FFFFFF'
},

  // ================================================================
  // CHECKOUT PRICING & DISCOUNT SYSTEM
  // ================================================================

  pricingSection: {
    width: '100%',
    marginTop: 20,
  },

  promoSection: {
    width: '100%',
    marginBottom: 4,
  },

  promoAppliedBtn: {
    backgroundColor: '#16A34A',
  },

  appliedPromoCard: {
    width: '100%',
    minHeight: 58,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 14,
    gap: 10,
  },

  appliedPromoContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  appliedPromoCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 1,
  },

  appliedPromoDescription: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '500',
    marginTop: 3,
  },

  // ================================================================
  // WELCOME BONUS
  // ================================================================

  discountHighlightCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
  },

  discountHighlightHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  discountIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },

  discountHighlightTitle: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 1,
  },

  checkoutPricingContainer: {
  width: '100%',
  marginTop: 20,
},

/* ============================================================= */
/* PRODUCT DISCOUNT SECTION                                      */
/* ============================================================= */

productDiscountSection: {
  width: '100%',
  marginTop: 8,
  marginBottom: 18,
},

productDiscountHeader: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
  paddingHorizontal: 2,
},

productDiscountTitle: {
  fontSize: 13,
  fontWeight: '800',
  letterSpacing: 0.7,
  color: '#111111',
},

productDiscountCount: {
  fontSize: 12,
  fontWeight: '600',
  color: '#888888',
},

/* ============================================================= */
/* INDIVIDUAL PRODUCT                                            */
/* ============================================================= */

discountProductCard: {
  width: '100%',
  minHeight: 94,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#EEEEEE',
  borderRadius: 14,
  padding: 10,
  marginBottom: 9,
},

discountProductImage: {
  width: 72,
  height: 84,
  borderRadius: 10,
  backgroundColor: '#F4F4F4',
},

discountProductInfo: {
  flex: 1,
  minWidth: 0,
  marginLeft: 12,
  justifyContent: 'center',
},

discountProductName: {
  width: '100%',
  fontSize: 13,
  fontWeight: '700',
  color: '#171717',
  marginBottom: 5,
},

discountProductMeta: {
  fontSize: 11,
  fontWeight: '500',
  color: '#8A8A8A',
  marginBottom: 7,
},

discountProductPriceRow: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 7,
},

discountOriginalPrice: {
  fontSize: 11,
  fontWeight: '500',
  color: '#999999',
  textDecorationLine: 'line-through',
},

discountFinalPrice: {
  fontSize: 15,
  fontWeight: '800',
  color: '#111111',
},

productDiscountBadge: {
  alignSelf: 'flex-start',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  marginTop: 5,
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: 5,
  backgroundColor: '#ECFDF3',
},

productDiscountBadgeText: {
  fontSize: 10,
  fontWeight: '800',
  color: '#16A34A',
},

/* ============================================================= */
/* BILLING                                                        */
/* ============================================================= */

billingCard: {
  width: '100%',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#EAEAEA',
  padding: 16,
  marginTop: 6,
},

billingCardTitle: {
  fontSize: 14,
  fontWeight: '800',
  letterSpacing: 0.5,
  color: '#111111',
  marginBottom: 15,
},

billingRow: {
  width: '100%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: 32,
},

billLabel: {
  fontSize: 13,
  fontWeight: '500',
  color: '#666666',
},

billValue: {
  fontSize: 13,
  fontWeight: '700',
  color: '#222222',
},

discountBillLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#16A34A',
},

discountBillValue: {
  fontSize: 13,
  fontWeight: '700',
  color: '#16A34A',
},

freeShippingValue: {
  color: '#16A34A',
  fontWeight: '800',
},

dividerLine: {
  width: '100%',
  height: 1,
  backgroundColor: '#EEEEEE',
  marginVertical: 12,
},

/* ============================================================= */
/* TOTAL SAVINGS                                                  */
/* ============================================================= */

totalSavingsRow: {
  width: '100%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},

totalSavingsLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#16A34A',
},

totalSavingsValue: {
  fontSize: 12,
  fontWeight: '800',
  color: '#16A34A',
},

totalRowSplit: {
  width: '100%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 4,
},

totalLabelContainer: {
  flex: 1,
},

grandTotalLabel: {
  fontSize: 14,
  fontWeight: '900',
  letterSpacing: 0.4,
  color: '#111111',
},

grandTotalValue: {
  fontSize: 21,
  fontWeight: '900',
  color: '#111111',
},

/* ============================================================= */
/* PREPAYMENT                                                     */
/* ============================================================= */

prepaymentCard: {
  width: '100%',
  marginTop: 12,
  padding: 16,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: '#E5E5E5',
  backgroundColor: '#FAFAFA',
},

prepaymentHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
},

prepaymentTitle: {
  flex: 1,
  fontSize: 13,
  fontWeight: '800',
  color: '#111111',
  letterSpacing: 0.4,
},

prepaymentDescription: {
  fontSize: 12,
  lineHeight: 18,
  color: '#777777',
  marginBottom: 13,
},

prepaymentAmountRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 11,
  borderTopWidth: 1,
  borderTopColor: '#E8E8E8',
},

prepaymentAmountLabel: {
  fontSize: 12,
  fontWeight: '700',
  color: '#666666',
},

prepaymentAmount: {
  fontSize: 17,
  fontWeight: '900',
  color: '#111111',
},

/* ============================================================= */
/* PROMO                                                          */
/* ============================================================= */



subSectionLabel: {
  fontSize: 12,
  fontWeight: '800',
  letterSpacing: 0.5,
  color: '#333333',
  marginBottom: 9,
},

promoRow: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

promoInput: {
  flex: 1,
  height: 46,
  borderWidth: 1,
  borderColor: '#DDDDDD',
  borderRadius: 10,
  paddingHorizontal: 13,
  fontSize: 13,
  color: '#111111',
  backgroundColor: '#FFFFFF',
},

promoApplyBtn: {
  height: 46,
  minWidth: 82,
  paddingHorizontal: 15,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#111111',
},

/* ============================================================= */
/* SHIPPING                                                       */
/* ============================================================= */

shippingProgressCard: {
  width: '100%',
  marginTop: 12,
  padding: 15,
  borderRadius: 14,
  backgroundColor: '#F8F8F8',
},

shippingProgressHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
},

shippingProgressTitle: {
  flex: 1,
  fontSize: 12,
  fontWeight: '800',
  color: '#222222',
},

progressTrack: {
  width: '100%',
  height: 6,
  borderRadius: 999,
  overflow: 'hidden',
  backgroundColor: '#E3E3E3',
},

progressFill: {
  height: '100%',
  borderRadius: 999,
  backgroundColor: '#111111',
},

progressRemaining: {
  marginTop: 8,
  fontSize: 11,
  color: '#777777',
},

freeShippingCard: {
  width: '100%',
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  backgroundColor: '#F0FDF4',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 9,
},

freeShippingIcon: {
  width: 25,
  height: 25,
  borderRadius: 13,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#16A34A',
},

freeShippingText: {
  flex: 1,
  fontSize: 12,
  fontWeight: '800',
  color: '#166534',
},

  discountHighlightDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#4B5563',
    fontWeight: '500',
    marginTop: 10,
  },

  discountSavedRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  discountSavedLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 1,
  },

  discountSavedAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#16A34A',
  },

  // ================================================================
  // MILESTONE REWARD
  // ================================================================

  rewardCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  rewardHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  rewardTitle: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 1,
  },

  rewardDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#166534',
    fontWeight: '500',
    marginTop: 9,
  },

  rewardAmountRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },

  rewardAmountLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 1,
  },

  rewardAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#16A34A',
  },


  totalSavingsText: {
    fontSize: 9,
    color: '#16A34A',
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // ================================================================
  // FREE SHIPPING PROGRESS
  // ================================================================

  shippingProgressText: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 8,
  },


    // 🎯 HIGH-END MONOCHROME RETENTION DESIGN SPECIFICATIONS ADDITIONS
  mapLoaderContainer: {
    height: 280, // Matches your standalone fixed map height boundaries perfectly
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
    // 🎯 MINIMALIST CHECKOUT ITEMS REVIEW TRACK CONTAINER
checkoutItemsManifestWrapper: {
  width: '100%',
  backgroundColor: '#FFFFFF',

  borderWidth: 1,
  borderColor: '#F2F2F2',

  padding: 14,
  marginTop: 12,
  marginBottom: 6,

  borderRadius: 10
},
  manifestSectionHeading: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },


 manifestItemRowLine: {
  flexDirection: 'row',
  alignItems: 'center',

  backgroundColor: '#FFFFFF',

  borderBottomWidth: 0.5,
  borderBottomColor: '#F3F3F3',

  paddingVertical: 12
},
  manifestItemImageThumb: {
    width: 44,
    height: 58,
    backgroundColor: '#FAFAFA',
    borderWidth: 0.5,
    borderColor: '#EAEAEA',
    borderRadius: 0, // Sharp square edges layout match
  },
  manifestItemDetailsCell: {
    flex: 1,
    justifyContent: 'center',
  },
 manifestItemNameText: {
  fontSize: 11,
  fontWeight: '800',
  color: '#111111',
  letterSpacing: 0.2,
  lineHeight: 15
},
manifestItemAttributesMetaText: {
  fontSize: 9,
  fontWeight: '600',
  color: '#777777',
  marginTop: 3,
  letterSpacing: 0.2
},
  manifestItemPriceText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'right',
    minWidth: 70,
  },
  

  
  promoApplyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

billingSummarySheet: {
  backgroundColor: '#FFFFFF',

  padding: 18,

  borderWidth: 1,
  borderColor: '#F3F3F3',

  marginVertical: 14,

  borderRadius: 12
},
 
  // Prepayment Required Alerts Card layout
 prepayAlertCard: {
  backgroundColor: '#FFF8E6',

  borderWidth: 1,
  borderColor: '#F3E1A6',

  padding: 14,

  borderRadius: 12,

  marginVertical: 10
},
  alertHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prepayAlertTitle: { fontSize: 10, fontWeight: '900', color: '#D97706', letterSpacing: 1 },
  prepayAlertBody: { fontSize: 12, color: '#B45309', lineHeight: 18, fontWeight: '500' },
  // 🎯 HIGH-END BRAND MONOCHROME CAMPAIGN BADGE SPECIFICATIONS
  newUserIncentiveBadgeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000', // Signature hard monochrome boundary line
    borderRadius: 0,        // Sharp geometric corners
    padding: 14,
    marginTop: 14,
    marginBottom: 4,
  },
  newUserIncentiveTitleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
    marginLeft: 6,
  },
  newUserIncentiveBodyText: {
    fontSize: 11,
    color: '#333333',
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 6,
    letterSpacing: 0.1,
  },

  // Gift validation badges configurations
  giftCelebrationBadge: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  giftCelebrationText: { fontSize: 11, color: '#15803D', fontWeight: '700', flex: 1, letterSpacing: 0.2 },
mapContainer: {
  height: 220,
  width: '100%',
  backgroundColor: '#FAFAFA',
  borderBottomWidth: 1,
  borderBottomColor: '#EEEEEE',
},
 backFloatBtn: {
  position: 'absolute',
  top: Platform.OS === 'ios' ? 56 : 24,
  left: 16,

  backgroundColor: '#FFFFFF',

  width: 40,
  height: 40,
  borderRadius: 20,

  justifyContent: 'center',
  alignItems: 'center',

  zIndex: 999,

  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5
},
scrollForm: {
  flex: 1,
  backgroundColor: '#FFFFFF'
},
 scrollContent: {
  paddingBottom: Platform.OS === 'ios' ? 120 : 100
},
section: {
  paddingHorizontal: 16,
  paddingTop: 20,
  marginBottom: 10
},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
sectionLabel: {
  fontSize: 10,
  fontWeight: '900',
  color: '#111111',
  letterSpacing: 2.2,
  textTransform: 'uppercase',

  marginBottom: 14
},
 gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gpsBtnText: { fontSize: 9, fontWeight: '700', color: '#000000', letterSpacing: 1 },
  input: { height: 44, borderBottomWidth: 1, borderBottomColor: '#EAEAEA', paddingVertical: 10, marginBottom: 16, fontSize: 13, color: '#000000', letterSpacing: 0.4 },
  phoneField: { height: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EAEAEA', marginBottom: 16 },
  countryCodeButton: { minWidth: 76, height: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRightWidth: 1, borderRightColor: '#E5E5E5' },
  countryCodeText: { fontSize: 13, fontWeight: '800', color: '#111111' },
  phoneInput: { flex: 1, height: 48, paddingHorizontal: 12, fontSize: 13, color: '#000000' },
  countryModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  countryModalBackdrop: { ...StyleSheet.absoluteFillObject },
  countryModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28 },
  countryModalTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#111111', marginBottom: 12 },
  countryOptionsScroll: { maxHeight: 420 },
  countryOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F1F1', gap: 12 },
  countryOptionCode: { width: 52, fontSize: 14, fontWeight: '800', color: '#111111' },
  countryOptionLabel: { flex: 1, fontSize: 13, color: '#555555' },
  billVal: { fontSize: 12, color: '#000000', fontWeight: '600', letterSpacing: 0.3 },
  
  // 🎯 THE PERFECTED STICKY FOOTER: Sits perfectly flush against the hardware safe space
// Add or overwrite these specific style properties inside your checkout stylesheet:
stickyFooter: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 20,
  paddingTop: 12,
  paddingBottom: 20,
  borderTopWidth: 1,
  borderColor: '#EEEEEE',
},

  orderBtn: { backgroundColor: '#000000', height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 2 },
  orderBtnText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 2, fontSize: 12 }
});
