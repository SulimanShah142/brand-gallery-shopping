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

export default function CheckoutScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  const { clearCart, state } = useCart(); 
// Inside your Checkout component function header:

// 🎯 ADD THIS COMPLIANT LIFE-CYCLE ANCHOR:
const [skipGpsPromptThisSession, setSkipGpsPromptThisSession] = useState(false);

  const cartItems = state?.items || []; 
const {
  data: session,
  cachedUser,
  isPending: authPending
} = authClient.useSession();
  const authenticated = Boolean(session?.session?.token);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [coords, setCoords] = useState<[number, number]>([34.5553, 69.2075]);
  
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
const [showLocationPermissionModal, setShowLocationPermissionModal] =
  useState(false);

const [locationBootLoading, setLocationBootLoading] =
  useState(false);

  // 🎯 GOOGLE PLAY / APPLE APP STORE COMPLIANCE STATES
const [showCustomPermissionModal, setShowCustomPermissionModal] =
  useState(false);
const [skipGpsPrompt, setSkipGpsPrompt] = useState(false);
const [locationLoading, setLocationLoading] =
  useState(false);

const [gpsServicesDisabled, setGpsServicesDisabled] =
  useState(false);

const [hydratedProductsMap, setHydratedProductsMap] = useState<Record<string, any>>({});
const [catalogLoading, setCatalogLoading] = useState(true);

// 🎯 THE REAL-TIME BACKEND FETCH REALIGNMENT CURE:
// Fetches the live database records on mount to guarantee that newly updated 
// Pashto and Dari fields render on the screen instantly, avoiding stale states!

useEffect(() => {
  let mounted = true;
  async function fetchLiveProductTranslations() {
    try {
      const res = await fetch(`${API_URL}/api/products?limit=100`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && mounted) {
          const mappingDictionary: Record<string, any> = {};
          data.forEach((p: any) => {
            mappingDictionary[String(p.id).trim()] = p;
          });
          setHydratedProductsMap(mappingDictionary);
        }
      }
    } catch (err) {
      console.warn("⚠️ Live checkout catalog translation fetch skipped:", err);
    } finally {
      if (mounted) setCatalogLoading(false);
    }
  }
  fetchLiveProductTranslations();
  return () => { mounted = false; };
}, []);
  
const permissionFlowStarted =
  useRef(false);
  // 1. Initial configurations loading pool
  useEffect(() => {

    let active = true;
    fetch(`${API_URL}/api/admin/settings`)
      .then(res => res.json())
      .then(data => { if (active) setSettings(data); })
      .catch(err => console.error("❌ Settings fetch failure:", err));
    return () => { active = false; };
  }, []);

  // 🎯 2. AUTOMATED SEEDING GPS PERMISSION LOGIC (NO MANUAL BUTTONS)
 // 🎯 PRODUCTION GPS INITIALIZATION ENGINE
useEffect(() => {
if (skipGpsPromptThisSession) return;
  const initializeCheckoutGpsFlow = async () => {

    try {

      console.log(
        "🛰️ Checkout GPS bootstrap initialized"
      );

      if (permissionFlowStarted.current) {
        return;
      }

      permissionFlowStarted.current = true;

      // 🎯 STEP 1: CHECK EXISTING PERMISSION
      const existingPermission =
        await Location.getForegroundPermissionsAsync();

      console.log(
        "📍 Existing Checkout Permission:",
        existingPermission
      );

      // 🎯 STEP 2: SHOW BRANDED MODAL IF NOT GRANTED
      if (!existingPermission.granted) {

        setShowCustomPermissionModal(true);

        return;
      }

      // 🎯 STEP 3: CHECK GPS HARDWARE
      const providerStatus =
        await Location.getProviderStatusAsync();

      console.log(
        "🛰️ Checkout Provider Status:",
        providerStatus
      );

      // 🎯 STEP 4: IF GPS OFF -> SHOW MODAL
      if (!providerStatus.locationServicesEnabled) {

        setGpsServicesDisabled(true);

        setShowCustomPermissionModal(true);

        return;
      }

      // 🎯 STEP 5: FETCH LIVE LOCATION
      const currentPosition =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      if (currentPosition?.coords) {

        const liveCoords: [number, number] = [
          currentPosition.coords.latitude,
          currentPosition.coords.longitude,
        ];

        setCoords(liveCoords);

        console.log(
          "✅ Checkout GPS Coordinates:",
          liveCoords
        );
      }

    } catch (gpsErr) {

      console.log(
        "❌ Checkout GPS bootstrap failed",
        gpsErr
      );
    }
  };

  initializeCheckoutGpsFlow();

}, []);


const toLocalNumbers = (num: string | number) => {
        const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
        if (locale === 'en' || !locale) return str;
        const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
      };

   // 🎯 3. ENHANCED SYSTEM-WIDE MULTI-TIER BILLING MATRICES ENGINE (RECONCILED CARRIER LIMITS)
  const totals = useMemo(() => {
    const baseDeliveryFee = parseFloat(settings?.deliveryFee || '150');
    const freeDeliveryLimit = parseFloat(settings?.freeDeliveryThreshold || '2000');
    
    const prepayLimit = parseFloat(settings?.prepaymentThreshold || '2500');
    const prepayPercentage = parseFloat(settings?.prepaymentPercentage || '30');
    
    const rewardLimit = parseFloat(settings?.rewardThreshold || '5000');
    const rewardValueAmount = parseFloat(settings?.rewardValue || '500');
    const rewardType = settings?.rewardType || 'discount';

    // Calculate baseline contents amount values
    const calculatedSubtotalAfn = cartItems.reduce((sum: number, item: any) => {
      const unitPrice = parseFloat(item.price || '0');
      const itemQuantity = Number(item.quantity) || 1;
      return sum + (unitPrice * itemQuantity);
    }, 0);

    // 🎯 1. HARDENED NEW USER DISCOUNT TIMELINE & PURCHASE CAP LATCH (RECONCILED KEYS)
    let newUserCampaignMarkdownAfn = 0;
    
    const isNewUserPromoActive = settings?.newUserDiscountActive !== undefined && 
      (settings.newUserDiscountActive === true || 
       String(settings.newUserDiscountActive).toLowerCase() === 'true' || 
       Number(settings.newUserDiscountActive) === 1);

    // 🎯 THE MULTI-KEY ORDER COUNT EXTRACTION FIX:
    // Cascades safely through all backend tracking fields (camelCase, snake_case, and sub-object counts).
    // This blocks undefined evaluation drops, guaranteeing historical orders resolve accurately!
    const pastOrderCount = cachedUser ? Number(
      cachedUser.orderCount ?? 
      cachedUser.ordersCount ?? 
      cachedUser.order_count ??
      cachedUser.orders_count ??
      cachedUser._count?.orders ?? 
      cachedUser._count?.order ?? 0
    ) : 0;

    const maxAllowedPurchases = Number(settings?.newUserMaxPurchaseCount || 1);
    
    let isCampaignDateValid = true;
    if (settings?.newUserDiscountExpiresAt) {
      isCampaignDateValid = new Date() < new Date(settings.newUserDiscountExpiresAt);
    }

    // 🎯 THE SECURED TRANSIT GATES:
    // If pastOrderCount evaluates greater than or equal to maxAllowedPurchases (e.g., 1 >= 1),
    // this execution line jumps cleanly to the fallback block, completely removing the discount!
    if (isNewUserPromoActive && pastOrderCount < maxAllowedPurchases && isCampaignDateValid) {
      const discountType = settings?.newUserDiscountType || 'fixed';
      const rawDiscountValue = parseFloat(settings?.newUserDiscountValue || '0');

      if (discountType === 'percentage') {
        newUserCampaignMarkdownAfn = calculatedSubtotalAfn * (rawDiscountValue / 100);
      } else {
        newUserCampaignMarkdownAfn = rawDiscountValue;
      }
      console.log(`✨ [CHECKOUT BONUS] New User Promo active and verified: - AFN ${newUserCampaignMarkdownAfn} (Orders: ${pastOrderCount}/${maxAllowedPurchases})`);
    } else {
      console.log(`🔒 [DISCOUNT SECURED] New User campaign dismissed. Purchases count reached: ${pastOrderCount}/${maxAllowedPurchases}`);
    }

    // 🎯 2. SMARTER MILESTONE REWARD LATCH
    let rewardDiscountAfn = 0;
    let earnedGiftText = null;

    const hasAlreadyClaimedMilestoneReward = cachedUser?.hasClaimedMilestoneReward !== undefined &&
      (cachedUser.hasClaimedMilestoneReward === true || 
       String(cachedUser.hasClaimedMilestoneReward).toLowerCase() === 'true' ||
       Number(cachedUser.hasClaimedMilestoneReward) === 1);
    
    const pastLifetimeSpendAfn = parseFloat(cachedUser?.totalLifetimeSpend || cachedUser?.total_lifetime_spend || '0');

    const qualifiesByCurrentBasket = calculatedSubtotalAfn >= rewardLimit;
    const qualifiesByHistoricSpend = pastLifetimeSpendAfn >= rewardLimit;

    if ((qualifiesByCurrentBasket || qualifiesByHistoricSpend) && !hasAlreadyClaimedMilestoneReward) {
      if (rewardType === 'discount') {
        rewardDiscountAfn = rewardValueAmount;
        console.log(`🎉 [MILESTONE LATCH] Applied One-Time AFN ${rewardValueAmount} Spend Discount!`);
      } else if (rewardType === 'gift') {
        earnedGiftText = settings?.rewardValue || "FREE GIFT";
        console.log(`🎁 [MILESTONE LATCH] Free Gift Unlocked: ${earnedGiftText}`);
      }
    }

    // 3. STANDARD PROMO CODES VOUCHER HANDLING MATRIX
    let voucherMarkdownAfn = 0;
    if (appliedPromo) {
      voucherMarkdownAfn = appliedPromo.type === 'percentage' 
        ? calculatedSubtotalAfn * (parseFloat(appliedPromo.value) / 100)
        : parseFloat(appliedPromo.value);
    }

    // 4. LOGISTICS SHIPPING FREIGHT CALCULATION
    const isDeliveryFree = calculatedSubtotalAfn >= freeDeliveryLimit;
    const shippingCostAfn = isDeliveryFree ? 0 : baseDeliveryFee;

    // Deduct promotions and compile totals invoice balance metrics safely
    const finalAmountAfn = Math.max(0, 
      calculatedSubtotalAfn - newUserCampaignMarkdownAfn - voucherMarkdownAfn - rewardDiscountAfn + shippingCostAfn
    );
    
    const requiresPrepayment = finalAmountAfn > prepayLimit;
    const upfrontPaymentAfn = requiresPrepayment ? Math.ceil(finalAmountAfn * (prepayPercentage / 100)) : 0;

    return {
      subtotal: calculatedSubtotalAfn,
      newUserDiscount: newUserCampaignMarkdownAfn,
      discount: voucherMarkdownAfn,
      rewardDiscount: rewardDiscountAfn,
      gift: earnedGiftText,
      shipping: shippingCostAfn,
      isFree: isDeliveryFree,
      final: finalAmountAfn,
      requiresPrepayment,
      prepayPercent: prepayPercentage,
      prepayAmount: upfrontPaymentAfn,
      triggerMilestoneClaimFlag: (qualifiesByCurrentBasket || qualifiesByHistoricSpend) && !hasAlreadyClaimedMilestoneReward
    };
  }, [cartItems, settings, appliedPromo, cachedUser]); // Synchronized securely across profile transitions


    // 🎯 PROMO CODE LEDGER MATRIX VERIFICATION GATES RESTORED
  const handleValidatePromo = async () => {
    if (!promoInput.trim()) {
      return Alert.alert(t('error') || "Error", "Please enter a valid discount code string.");
    }
    
    setPromoLoading(true);
    try {
      console.log(`📡 [PROMO VERIFICATION] Querying database ledger for voucher code: ${promoInput.toUpperCase().trim()}`);
      
      const res = await fetch(
        `${API_URL}/api/discounts/validate?code=${promoInput.toUpperCase().trim()}&amount=${totals.subtotal}`
      );
      const data = await res.json();
      
      if (res.ok) {
        setAppliedPromo(data);
        Alert.alert(t('success') || "Success", `Promo Code Applied Successfully!`);
      } else {
        Alert.alert(t('error') || "Error", data.error || "Invalid promo code or below minimum spend requirement.");
        setAppliedPromo(null);
      }
    } catch (e: any) {
      console.error("❌ Promo validation network drop exception:", e.message);
      Alert.alert(t('error') || "Error", "Failed to validate promo code. Check your network link indicators.");
    } finally {
      setPromoLoading(false);
    }
  };


  // 🎯 CORE TRANSACTIONAL ORDER PLACEMENT ACTION HANDLER
  const handlePlaceOrder = async () => {
    if (!form.name || !form.phone || !form.address) {
      return Alert.alert(
        t('requiredFields') || "Required Fields", 
        t('fillAllDetails') || "Please fill in all information details before submitting."
      );
    }

    console.log("🚀 Dispatched custom order transactional request payload to server...");
    setLoading(true);

  if (!authenticated) {
  Alert.alert(
    t("signInRequiredTitle") || "Sign In Required",
    t("signInRequiredBody") ||
      "Please sign in or create an account before placing an order.",
    [
      {
        text: t("cancel") || "Cancel",
        style: "cancel",
      },
      {
        text: t("signIn") || "Sign In",
        onPress: () => router.push("/sign-in"),
      },
    ]
  );

  return;
}
    try {
     const token = session?.session?.token;

const response = await fetch(`${API_URL}/api/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify({
    customerName: form.name,
    phoneNumber: form.phone,
    address: form.address,
    latitude: coords[0].toString(),
    longitude: coords[1].toString(),
    totalAmount: totals.final.toString(),
    shippingFee: totals.shipping.toString(),

    newUserDiscountApplied: totals.newUserDiscount.toString(),
    consumesMilestoneRewardFlag: totals.triggerMilestoneClaimFlag,
    milestoneRewardMarkdownApplied: totals.rewardDiscount.toString(),

    promoCode: appliedPromo
      ? promoInput.toUpperCase().trim()
      : null,

    items: cartItems.map(item => ({
      productId: item.id,
      quantity: item.quantity,
      price: item.price.toString(),
      selectedSize: item.selectedSize || 'M',
      selectedColor: item.selectedColor || 'Standard'
    }))
  })
});

      if (response.ok) {
        clearCart(); 
        Alert.alert(
          t('success') || "Success", 
          t('orderPlacedSuccess') || "Your order has been recorded successfully!"
        );
        router.replace('/orders');
      } else {
        const errPayload = await response.json().catch(() => ({}));
        Alert.alert(t('error') || "Error", errPayload?.error || "Order placement failed.");
      }
    } catch (e) {
      console.error("❌ Checkout submit execution network drop out:", e);
      Alert.alert(t('error') || "Error", "Network connection failed. Check your Wi-Fi.");
    } finally {
      setLoading(false);
    }
  };



  const MemoizedMap = useMemo(() => {
    if (!settings) {
      return (
        <View style={styles.mapLoaderContainer}>
          <ActivityIndicator size="small" color="#000" />
        </View>
      );
    }

    const warehouse: [number, number] = [
      parseFloat(settings?.warehouseLat || settings?.warehouse_lat) || 34.5330,
      parseFloat(settings?.warehouseLng || settings?.warehouse_lng) || 69.1660
    ];

    return (
      <UnifiedMap 
        role="USER" 
        destinationCoords={coords} 
        warehouseCoords={warehouse} 
        orderStatus="confirmed" 
        orderId="checkout-preview"
      />
    );
  }, [coords, settings]);


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
            <View style={[styles.sectionHeader]}>
              <Text style={styles.sectionLabel}>
                {(t('shippingAddress') || t('deliveryAddress') || 'SHIPPING ADDRESS').toUpperCase()}
              </Text>
            </View>

            {/* INPUT FORM FIELDS */}
                       <TextInput 
              placeholder={t('fullName') || "FULL NAME"} 
              placeholderTextColor="#BBBBBB" 
              style={[styles.input, isRTL && { textAlign: 'right' }]} 
              value={form.name} 
              onChangeText={(v) => setForm({...form, name: v})} 
              autoCapitalize="words"
            />
            <TextInput 
              placeholder={t('phoneNumber') || "PHONE NUMBER"} 
              placeholderTextColor="#BBBBBB" 
              style={[styles.input, isRTL && { textAlign: 'right' }]} 
              keyboardType="phone-pad"
              value={form.phone} 
              onChangeText={(v) => setForm({...form, phone: v})} 
            />
            <TextInput 
              placeholder={t('address') || "SHIPPING ADDRESS"} 
              placeholderTextColor="#BBBBBB" 
              style={[styles.input, isRTL && { textAlign: 'right' }]} 
              value={form.address} 
              onChangeText={(v) => setForm({...form, address: v})} 
            />
  
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

  return (
    <View key={`checkout-slat-${item.id}-${idx}`} style={[styles.manifestItemRowLine, isRTL && { flexDirection: 'row-reverse' }]}>
      <Image source={{ uri: item.imageUrl || productRef.imageUrl }} style={styles.manifestItemImageThumb} resizeMode="cover" />
      
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
       {/* ========================================================================= */}
    {/* 🎯 THE NUMERAL TRANSLATOR CONFACTOR ENGINE & BILLING LEDGER */}
    {/* ========================================================================= */}
    {(() => {
      // COMPONENT-LEVEL STABLE NUMERAL ENGINE:
      // Converts price digits into localized Eastern Arabic numbers (۰-۹) dynamically
      // based on the consumer's active layout choice (Pashto, Dari, or English).
      const toLocalNumbers = (num: string | number) => {
        const str = Math.ceil(Number(num || 0)).toLocaleString('en-US');
        if (locale === 'en' || !locale) return str;
        const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return str.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
      };

      return (
        <View style={{ width: '100%', marginTop: 20 }}>
          
          {/* PROMO VOUCHERS INPUT STRIP */}
          <Text style={[styles.subSectionLabel, isRTL && { textAlign: 'right' }]}>
            {(t('discountPromoCode') || 'DISCOUNT PROMO CODE').toUpperCase()}
          </Text>
          
          <View style={[styles.promoRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TextInput 
              placeholder={t('enterCode') || "ENTER CODE"} 
              placeholderTextColor="#BBBBBB" 
              autoCapitalize="characters" 
              style={[styles.promoInput, isRTL && { textAlign: 'right' }]} 
              value={promoInput} 
              onChangeText={setPromoInput} 
              editable={!appliedPromo} 
            />
            <TouchableOpacity 
              style={[styles.promoApplyBtn, appliedPromo && { backgroundColor: '#22C55E' }]} 
              onPress={handleValidatePromo} 
              disabled={promoLoading || !!appliedPromo}
              activeOpacity={0.8}
            >
              {promoLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.promoApplyText}>
                  {appliedPromo ? (t('applied') || "APPLIED") : (t('apply') || "APPLY")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 🎯 THE DISCOUNTS BADGE CARD WITH MATCHING CLOSING VIEWS */}
          {totals.newUserDiscount > 0 && (
            <View style={styles.newUserIncentiveBadgeCard}>
              <View style={[styles.alertHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="sparkles-sharp" size={16} color="#000000" style={isRTL ? { marginLeft: 6 } : { marginRight: 6 }} />
                <Text style={[styles.newUserIncentiveTitleText, isRTL && { textAlign: 'right' }]}>
                  {(t('welcomeBonusUnlocked') || 'WELCOME BONUS INSTANTLY UNLOCKED').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.newUserIncentiveBodyText, isRTL && { textAlign: 'right' }]}>
                {(t('welcomeBonusDesc') || 'As a verified new member, an automatic markdown of AFN {{amount}} has been successfully subtracted from your final collect statement balance!').replace('{{amount}}', toLocalNumbers(totals.newUserDiscount))}
              </Text>
            </View>
          )}

          {/* BILLING LEDGER BOX PANEL AREA */}
          <View style={{ marginTop: 16 }}>
            {totals.discount > 0 && (
              <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={[styles.billLabel, { color: '#FF3B30', fontWeight: '700' }]}>
                  {t('promoMarkdown') || 'Promo Code Markdown'}
                </Text>
                <Text style={[styles.billValue, { color: '#FF3B30', fontWeight: '700' }]}>
                  - {isRTL ? `${toLocalNumbers(totals.discount)} افغانۍ` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(totals.discount)}`}
                </Text>
              </View>
            )}

            {totals.rewardDiscount > 0 && (
              <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={[styles.billLabel, { color: '#22C55E', fontWeight: '700' }]}>
                  {t('milestoneReward') || 'Milestone Spend Reward'}
                </Text>
                <Text style={[styles.billValue, { color: '#22C55E', fontWeight: '700' }]}>
                  - {isRTL ? `${toLocalNumbers(totals.rewardDiscount)} افغانۍ` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(totals.rewardDiscount)}`}
                </Text>
              </View>
            )}

            {totals.newUserDiscount > 0 && (
              <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={[styles.billLabel, { color: '#000000', fontWeight: '700' }]}>
                  {t('welcomeBonusLabel') || 'Welcome Incentive Credit'}
                </Text>
                <Text style={[styles.billValue, { color: '#000000', fontWeight: '700' }]}>
                  - {isRTL ? `${toLocalNumbers(totals.newUserDiscount)} افغانۍ` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(totals.newUserDiscount)}`}
                </Text>
              </View>
            )}

            <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={styles.billLabel}>{t('shippingFreight') || 'Logistics Shipping Freight'}</Text>
              <Text style={[styles.billValue, totals.shipping === 0 && { color: '#22C55E', fontWeight: '900' }]}>
                {totals.shipping === 0 ? (t('freeShipping') || "FREE SHIPPING").toUpperCase() : (isRTL ? `${toLocalNumbers(totals.shipping)} افغانۍ` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(totals.shipping)}`)}
              </Text>
            </View>

            <View style={styles.dividerLine} />

            <View style={[styles.totalRowSplit, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={styles.grandTotalLabel}>{(t('totalPayable') || 'TOTAL PAYABLE').toUpperCase()}</Text>
              <Text style={styles.grandTotalValue}>
                {isRTL ? `${toLocalNumbers(totals.final)} افغانۍ` : `${t('afnCurrency') || 'AFN'} ${toLocalNumbers(totals.final)}`}
              </Text>
            </View>
          </View>

          {/* Content spacer block to prevent sticky footer overflows */}
          <View style={{ height: 110 }} />
       
        </View>
      );
    })()}
    </View>

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

    {/* 🎯 APPMARKET COMPLIANT TRANSPARENT SYSTEM RATIONALE OVERLAY MODAL */}

    </View>
  );
}


const styles = StyleSheet.create({
 container: {
  flex: 1,
  backgroundColor: '#FFFFFF'
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

  // RETAIN GLOBAL CARD WRAPPER CELL ALIGNMENTS
  subSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#777777',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
 promoRow: {
  flexDirection: 'row',
  alignItems: 'center',

  width: '100%',
  height: 44,

  marginBottom: 14,
  gap: 8
},
 promoInput: {
  flex: 2,
  height: '100%',

  borderWidth: 1,
  borderColor: '#EDEDED',

  backgroundColor: '#FAFAFA',

  paddingHorizontal: 12,

  fontSize: 13,
  color: '#111',

  borderRadius: 10
},
    // 🎯 MINIMALIST CHECKOUT CARGO MANIFEST LIST SLATS
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
  

  promoApplyBtn: {
    flex: 1,
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0, // Sharp square SHEIN aesthetic boundaries
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
  billingRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',

  marginBottom: 8
},
 billLabel: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500'
},
 billValue: {
  fontSize: 13,
  color: '#111',
  fontWeight: '700'
},
 dividerLine: {
  height: 1,
  backgroundColor: '#F2F2F2',
  marginVertical: 12
},
  totalRowSplit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
 grandTotalLabel: {
  fontSize: 11,
  fontWeight: '900',
  color: '#111',
  letterSpacing: 0.6
},
 grandTotalValue: {
  fontSize: 18,
  fontWeight: '900',
  color: '#111',
  letterSpacing: -0.3
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
