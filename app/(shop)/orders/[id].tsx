import React, { useState, useEffect, useMemo , useCallback, useRef} from 'react';
import { View, Text, ScrollView,TouchableWithoutFeedback, Platform,Keyboard,  KeyboardAvoidingView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/Contexts/LanguageContext';
import UnifiedMap from '@/components/UnifiedMap';
import { API_URL } from '@/lib/config';
import { authClient } from '@/lib/auth-client';
import * as SecureStore from 'expo-secure-store';


export const STATUS_CANONICAL_MAP: Record<string, string> = {
  pending: 'pending',

  accepted: 'confirmed',
  confirmed: 'confirmed',
  processing: 'confirmed',

 awaiting_packaging: 'awaiting_packaging',
packaging: 'packaging',
packaged: 'packaged',
assigned_to_deliverer: 'assigned_to_deliverer',

  shipped: 'picked_up',
  transit: 'picked_up',
  picked_up: 'picked_up',
  out_for_delivery: 'picked_up',

  delivered: 'delivered',
  completed: 'delivered',

  cancelled: 'cancelled',
  canceled: 'cancelled',
  rejected: 'cancelled',

  cancelled_by_user: 'cancelled',
  cancelled_by_packager: 'cancelled',
  cancelled_by_deliverer: 'cancelled',

  refund_requested: 'refund_requested',
  refund_rejected: 'refund_rejected',
  refund_approved: 'refund_approved',
  refunded: 'refunded',
};


export const normalizeStatus = (status?: string) => {
  if (!status) return 'pending';

  const normalized = String(status)
    .trim()
    .toLowerCase();

  return STATUS_CANONICAL_MAP[normalized] || normalized;
};


const getStatusStyle = (status?: string) => {
  switch (status) {
    case 'awaiting_packaging':
      return {
        bg: '#FFF7ED',
        color: '#EA580C',
        label: 'awaiting_packaging',
      };

    case 'packaging':
      return {
        bg: '#F3E8FF',
        color: '#9333EA',
        label: 'packaging',
      };

    case 'packaged':
      return {
        bg: '#EDE9FE',
        color: '#7C3AED',
        label: 'packaged',
      };

    case 'assigned_to_deliverer':
      return {
        bg: '#DBEAFE',
        color: '#2563EB',
        label: 'assigned_to_deliverer',
      };

    case 'picked_up':
      return {
        bg: '#E0F2FE',
        color: '#0284C7',
        label: 'picked_up',
      };

    case 'out_for_delivery':
      return {
        bg: '#EEF2FF',
        color: '#4F46E5',
        label: 'out_for_delivery',
      };

    case 'delivered':
      return {
        bg: '#DCFCE7',
        color: '#16A34A',
        label: 'delivered',
      };
case 'refund_requested':
  return {
    bg: '#FEF3C7',
    color: '#D97706',
    label: 'refund_requested',
  };

case 'refund_rejected':
  return {
    bg: '#FEE2E2',
    color: '#DC2626',
    label: 'refund_rejected',
  };

case 'refund_approved':
case 'refunded':
  return {
    bg: '#DCFCE7',
    color: '#16A34A',
    label: 'refunded',
  };
    case 'cancelled_by_user':
    case 'cancelled_by_packager':
    case 'cancelled_by_deliverer':
    case 'rejected':
      return {
        bg: '#FEF2F2',
        color: '#DC2626',
        label: 'cancelled',
      };

    default:
      return {
        bg: '#F3F4F6',
        color: '#6B7280',
        label: 'pending',
      };
  }
};

const ORDER_TIMELINE_STAGES = [
  {
    key: 'pending',
    label: 'pending',
    icon: 'time-outline',
  },
  {
    key: 'confirmed',
    label: 'confirmed',
    icon: 'checkmark-circle-outline',
  },
  {
    key: 'awaiting_packaging',
    label: 'awaiting_packaging',
    icon: 'cube-outline',
  },
  {
    key: 'packaging',
    label: 'packaging',
    icon: 'layers-outline',
  },
  {
    key: 'packaged',
    label: 'packaged',
    icon: 'cube',
  },
  {
    key: 'assigned_to_deliverer',
    label: 'assigned_to_deliverer',
    icon: 'person-outline',
  },
  {
    key: 'picked_up',
    label: 'picked_up',
    icon: 'bicycle-outline',
  },
  {
    key: 'delivered',
    label: 'delivered',
    icon: 'checkmark-done-outline',
  },
] as const;


export default function UserOrderDetails() {
  const { id } = useLocalSearchParams();
  const { t, isRTL, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

const [keyboardVisible, setKeyboardVisible] = useState(false);
const shift = useRef(new Animated.Value(0)).current;
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveDriverCoords, setLiveDriverCoords] = useState<[number, number] | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
const [refundOpen, setRefundOpen] = useState(false);
const [refundReason, setRefundReason] = useState('');
const [refundSubmitting, setRefundSubmitting] = useState(false);
const [cancelSubmitting, setCancelSubmitting] = useState(false);
const [saveSubmitting, setSaveSubmitting] = useState(false);
const [quantityEdits, setQuantityEdits] = useState<Record<string, number>>({});
const [Orders, setOrders] = useState(null);
const [storedToken, setStoredToken] = useState<string | null>(null);
const { data: session } = authClient.useSession();

const safeOrderId = Array.isArray(id) ? id[0] : String(id || '');

const getStoredToken = useCallback(async () => {
  if (session?.session?.token) {
    return String(session.session.token).trim();
  }

  const token = await SecureStore.getItemAsync('custom_user_session_token').catch(() => null);
  return token ? String(token).trim() : null;
}, [session?.session?.token]);

const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
  const token = await getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}, [getStoredToken]);

const getUserId = useCallback(async () => {
  if (session?.user?.id) return session.user.id;

  try {
    const cached = await SecureStore.getItemAsync('cached_user_profile');
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed?.id;
    }
  } catch {
    // ignore malformed cached profile
  }

  return null;
}, [session?.user?.id]);

const fetchOrders = useCallback(async () => {
  const userId = await getUserId();
  if (!userId) return;

  setLoading(true);

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(
        `${API_URL}/api/orders/my-orders?userId=${userId}`,
        { headers: authHeaders },
    );

    const payload = await res.json();

    const list = Array.isArray(payload)
      ? payload
      : payload?.data || [];

    setOrders(list);
  } catch (e) {
    console.log("fetchOrders error:", e);
  } finally {
    setLoading(false);
  }
}, [getUserId, getAuthHeaders]);
  // 1. LOCAL NUMERIC TRANSLATION METHOD (SAFE AND REMAPPED)
  const toLocalNumbers = useCallback((num: string | number) => {
    const stringValue = String(num || '0').replace(/,/g, '');
    if (isNaN(parseFloat(stringValue))) return '۰';
    if (locale === 'en' || !locale) return Number(stringValue).toLocaleString('en-US');
    
    const easternDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return stringValue.replace(/[0-9]/g, (w) => easternDigits[parseInt(w, 10)]);
  }, [locale]);

 const rawStatus = String(order?.status || '')
  .trim()
  .toLowerCase();

const canonicalStatus = normalizeStatus(rawStatus);

const statusConfig = getStatusStyle(canonicalStatus);

const isCancelled = canonicalStatus === 'cancelled';
const isDelivered = canonicalStatus === 'delivered';

const isRefundRequested =
  normalizeStatus(order?.status) === 'refund_requested';
const refreshOrder = async () => {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/orders/${order?.id}`, {
    headers: authHeaders,
  });
  const data = await res.json();
  setOrder(data);
};

useEffect(() => {
  if (!order?.items || !Array.isArray(order.items)) return;
  setQuantityEdits(
    order.items.reduce((acc: Record<string, number>, item: any) => {
      if (item?.id) {
        acc[item.id] = Number(item.quantity) || 1;
      }
      return acc;
    }, {}),
  );
}, [order]);

const getEditedQuantity = (item: any) => {
  if (!item?.id) return Number(item?.quantity) || 1;
  return quantityEdits[item.id] ?? (Number(item.quantity) || 1);
};

const authHeaders = useMemo<Record<string, string>>(() => {
  const token = session?.session?.token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token.trim()}`;
  return headers;
}, [session?.session?.token]);

const hasQuantityChanges = useMemo(() => {
  if (!order?.items || !Array.isArray(order.items)) return false;
  return order.items.some((item: any) => {
    if (!item?.id) return false;
    return Number(item.quantity) !== Number(quantityEdits[item.id]);
  });
}, [order?.items, quantityEdits]);

const handleQuantityChange = (itemId: string, delta: number) => {
  setQuantityEdits((prev) => {
    const current = Number(prev[itemId] ?? 1);
    const nextQty = Math.max(1, current + delta);
    return {
      ...prev,
      [itemId]: nextQty,
    };
  });
};

const saveQuantityChanges = async () => {
  if (!order?.id) return;
  if (!hasQuantityChanges) return;

  setSaveSubmitting(true);
  try {
    const changedItems = (order.items || []).filter((item: any) => {
      if (!item?.id) return false;
      return Number(item.quantity) !== Number(quantityEdits[item.id]);
    });

    const authHeaders = await getAuthHeaders();
    for (const item of changedItems) {
      const itemId = item.id;
      const newQty = Number(quantityEdits[itemId] || 1);
      const res = await fetch(
        `${API_URL}/api/orders/${order.id}/items/${itemId}/quantity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ quantity: newQty }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        Alert.alert('Error', data?.error || 'Failed to save quantity changes');
        return;
      }
    }

    await refreshOrder();
    await fetchOrders();
    Alert.alert('Success', 'Order quantities saved and admin notified');
  } catch (e) {
    Alert.alert('Error', 'Server error');
  } finally {
    setSaveSubmitting(false);
  }
};

useEffect(() => {
  const show = Keyboard.addListener("keyboardDidShow", (e) => {
    setKeyboardVisible(true);

    Animated.timing(shift, {
      toValue: -e.endCoordinates.height * 0.25,
      duration: 200,
      useNativeDriver: true,
    }).start();
  });

  const hide = Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardVisible(false);

    Animated.timing(shift, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  });

  return () => {
    show.remove();
    hide.remove();
  };
}, []);
  // 2. DATA INITIALIZATION RESOURCE FETCH ENGINE
  useEffect(() => {
    if (!id || !authHeaders.Authorization) return;

    const loadCoreData = async () => {
      try {
        setLoading(true);
        const authHeaders = await getAuthHeaders();
        const [orderRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/api/orders/${id}`, { headers: authHeaders }),
          fetch(`${API_URL}/api/admin/settings`)
        ]);

        if (!orderRes.ok || !settingsRes.ok) throw new Error("API connections dropped");

        const orderData = await orderRes.json();
        const settingsData = await settingsRes.json();

        // Unwrap object payloads cleanly if backend maps them inside nested data or array trees
        const cleanOrder = Array.isArray(orderData) ? orderData[0] : (orderData?.data || orderData);
        const cleanSettings = Array.isArray(settingsData) ? settingsData[0] : (settingsData?.data || settingsData);

        setOrder(cleanOrder);
        setSettings(cleanSettings);

        if (cleanOrder?.driverLat && cleanOrder?.driverLng) {
          const initLat = parseFloat(cleanOrder.driverLat);
          const initLng = parseFloat(cleanOrder.driverLng);
          if (!isNaN(initLat) && !isNaN(initLng)) {
            setLiveDriverCoords([initLat, initLng]);
          }
        }
      } catch (err) {
        console.error("❌ User App tracking data load failed:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCoreData();
  }, [id]);

  const canRequestRefund = useMemo(() => {
  const status = normalizeStatus(order?.status);
  return status === 'delivered';
}, [order?.status]);

  const canCancelOrder = useMemo(() => {
    const status = normalizeStatus(order?.status);
    return ![
      'delivered',
      'refunded',
      'cancelled',
      'cancelled_by_user',
      'cancelled_by_packager',
      'cancelled_by_deliverer',
      'refund_approved',
      'refund_pickup_in_progress',
    ].includes(status);
  }, [order?.status]);

  const submitCancelOrder = async (orderId: string) => {
    try {
      if (!orderId || typeof orderId !== 'string') return;
      setCancelSubmitting(true);

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reason: '' }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data?.error || 'Failed to cancel order');
        return;
      }

      Alert.alert('Success', 'Order cancelled');
      await refreshOrder();
      await fetchOrders();
    } catch (e) {
      Alert.alert('Error', 'Server error');
    } finally {
      setCancelSubmitting(false);
    }
  };

useEffect(() => {
  fetchOrders();
}, [fetchOrders]);

const orderId = useMemo(() => {
  if (!id) return null;
  return Array.isArray(id) ? id[0] : String(id);
}, [id]);

const submitRefundRequest = async (orderId: string) => {
 
  try {
      if (!orderId || typeof orderId !== 'string') {
      console.log('❌ invalid orderId passed:', orderId);
      return;
    }
    setRefundSubmitting(true);
    const authHeaders = await getAuthHeaders();

    const res = await fetch(
      `${API_URL}/api/orders/${orderId}/refund-request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
  refundReason: refundReason,
})
      }
    );

    const data = await res.json();

    if (!res.ok) {
      Alert.alert('Error', data?.error || 'Failed');
      return;
    }

    Alert.alert('Success', 'Refund request submitted');

    setRefundOpen(false);
    setRefundReason('');
await refreshOrder();
    // 🔥 IMPORTANT: refresh orders immediately
  
  } catch (e) {
    Alert.alert('Error', 'Server error');
  } finally {
    setRefundSubmitting(false);
  }
};

const [itemUpdating, setItemUpdating] = useState<Record<string, boolean>>({});

const adjustItemQuantity = async (itemId: string, newQty: number) => {
  try {
    if (!order?.id) return;
    setItemUpdating((s) => ({ ...s, [itemId]: true }));

    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/orders/${order.id}/items/${itemId}/quantity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ quantity: newQty }),
    });

    const data = await res.json();

    if (!res.ok) {
      Alert.alert('Error', data?.error || 'Failed to update quantity');
      return;
    }

    await refreshOrder();
    await fetchOrders();
  } catch (e) {
    Alert.alert('Error', 'Server error');
  } finally {
    setItemUpdating((s) => ({ ...s, [itemId]: false }));
  }
};



  // 3. AUTOMATED TELEMETRY HEARTBEAT POLLING LOOP
  useEffect(() => {
    let trackingIntervalId: ReturnType<typeof setInterval> | undefined;
const currentStatus =
  normalizeStatus(order?.status);


const isOrderActivelyInTransit =
  ![
    'delivered',
    'cancelled',
    'refunded'
  ].includes(currentStatus);
    const pullLiveOrderAndDriverTelemetry = async () => {
      try {
        console.log(`📡 [USER APP] Executing synchronized tracking telemetry pass for Order #${id}`);
        const authHeaders = await getAuthHeaders();
        const [orderRes, locationRes] = await Promise.all([
          fetch(`${API_URL}/api/orders/${id}`, { headers: authHeaders }).catch(() => null),
          fetch(`${API_URL}/api/orders/${id}/driver-location`, { headers: authHeaders }).catch(() => null)
        ]);

        if (orderRes && orderRes.ok) {
          const freshOrderPayload = await orderRes.json();
          const cleanFreshOrder = Array.isArray(freshOrderPayload) ? freshOrderPayload[0] : (freshOrderPayload?.data || freshOrderPayload);
          if (cleanFreshOrder) {
            setOrder(cleanFreshOrder);
          }
        }

        if (locationRes && locationRes.ok) {
          const driverGpsData = await locationRes.json();
          if (driverGpsData?.lat !== null && driverGpsData?.lng !== null) {
            const nextLat = parseFloat(driverGpsData.lat);
            const nextLng = parseFloat(driverGpsData.lng);
            if (!isNaN(nextLat) && !isNaN(nextLng)) {
              setLiveDriverCoords([nextLat, nextLng]);
            }
          }
        }
      } catch (e) {
        console.log("⚠️ Order tracking telemetry desync caught:", e);
      }
    };

    if (isOrderActivelyInTransit && id) {
      pullLiveOrderAndDriverTelemetry();
      trackingIntervalId = setInterval(pullLiveOrderAndDriverTelemetry, 8000); // Polls every 8 seconds live
    }

    return () => {
      if (trackingIntervalId) clearInterval(trackingIntervalId);
    };
  }, [order?.status, id]);

  // 4. COORDINATE MEMO CALCULATIONS FOR ROUTING MAPS
  const customerCoords = useMemo<[number, number]>(() => {
    const lat = parseFloat(String(order?.latitude || '').replace(/,/g, ''));
    const lng = parseFloat(String(order?.longitude || '').replace(/,/g, ''));
    return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : [34.5553, 69.2075]; 
  }, [order?.latitude, order?.longitude]);

  const warehouseCoords = useMemo<[number, number]>(() => {
    const lat = parseFloat(String(settings?.warehouseLat || settings?.warehouse_lat || '').replace(/,/g, ''));
    const lng = parseFloat(String(settings?.warehouseLng || settings?.warehouse_lng || '').replace(/,/g, ''));
    return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : [34.5330, 69.1660]; 
  }, [settings]);

  const hasCustomerLocation = Boolean(order?.latitude && order?.longitude);
  const estimatedArrival = useMemo(() => {
    const start = new Date(order?.createdAt || Date.now());
    const from = new Date(start);
    const to = new Date(start);
    from.setDate(from.getDate() + 14);
    to.setDate(to.getDate() + 21);
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }, [order?.createdAt]);

  const statusDates = useMemo(() => {
    const history = Array.isArray(order?.statusHistory)
      ? order.statusHistory
      : Array.isArray(order?.statusEvents) ? order.statusEvents : [];
    return new Map(history.map((event: any) => [
      normalizeStatus(event.status || event.toStatus),
      event.changedAt || event.createdAt || event.updatedAt,
    ]));
  }, [order?.statusHistory, order?.statusEvents]);

  // 5. MEMOIZED MAP RENDER SLOT
  const MemoizedMapComponent = useMemo(() => {
    return (
      <UnifiedMap
        role="USER"
        destinationCoords={customerCoords}
        warehouseCoords={warehouseCoords}
        driverCoords={liveDriverCoords}
        orderStatus={rawStatus}
        orderId={id as string}
        isFullscreen={mapFullscreen}
        setIsFullscreen={setMapFullscreen}
      />
    );
  }, [customerCoords, warehouseCoords, liveDriverCoords, order?.status, id, mapFullscreen]);

  // 6. FINANCIALLY RECONCILED ARITHMETIC BILLING LEDGER (0% NaN GUARANTEE)
  const totals = useMemo(() => {
    const safeItems = order && Array.isArray(order.items) ? order.items : [];
    
    const baseSubtotal = safeItems.reduce((sum: number, it: any) => {
      const price = parseFloat(String(it.price || it.unitPrice || '0').replace(/,/g, '')) || 0;
      const qty = Number(it.quantity) || 1;
      return sum + (price * qty);
    }, 0);

    const discountValue = parseFloat(String(order?.discount || order?.discountAmount || '0').replace(/,/g, '')) || 0;
    const shippingValue = parseFloat(String(order?.shippingFee || order?.shipping_fee || '0').replace(/,/g, '')) || 0;
    const totalValue = parseFloat(String(order?.totalAmount || order?.total_amount || '0').replace(/,/g, '')) || 0;

    // Symmetrical validation fallback computes the bill dynamically if server total is missing
    const calculatedGrandTotal = totalValue > 0 ? totalValue : Math.max(0, (baseSubtotal + shippingValue) - discountValue);

    return {
      subtotal: Math.round(baseSubtotal),
      discount: Math.round(discountValue),
      shipping: Math.round(shippingValue),
      grandTotal: Math.round(calculatedGrandTotal)
    };
  }, [order]);

  // 7. STEPPER VISUAL ATTRIBUTE SELECTORS
// 7. CANONICAL STATUS RESOLUTION LAYER

const currentStatusString = normalizeStatus(order?.status);

const safeTimelineIndex = useMemo(() => {
  const index = ORDER_TIMELINE_STAGES.findIndex(
    (stage) => stage.key === currentStatusString
  );

  return index >= 0 ? index : 0;
}, [currentStatusString]);

const refundReasonText =
  order?.refundReason || null;

const adminRefundDecision =
  order?.refundAdminNote || null;

const rejectionReasonText =
  order?.rejectionReason || null;

  const isRefundFlow =
  ['refund_requested', 'refund_rejected', 'refund_approved', 'refunded']
  .includes(order?.status);

const showReasonLog =
  Boolean(
    order?.refundReason ||
    order?.refundAdminNote ||
    order?.rejectionReason
  );

const isConfirmedActive = [
  'confirmed',
  'picked_up',
  'delivered'
].includes(currentStatusString);

const isPickedUpActive = [
  'picked_up',
  'delivered'
].includes(currentStatusString);

const isDeliveredActive =
  currentStatusString === 'delivered';


const visibleItems = itemsExpanded
  ? (order?.items || [])
  : (order?.items || []).slice(0, 3);


  // Early Loading Safe Guards (Placed strategically below hooks)
  if (loading && !order) {
    return <View style={styles.center}><ActivityIndicator size="small" color="#000000" /></View>;
  }
  if (!order) {
    return <View style={styles.center}><Text style={styles.emptyText}>{t('orderNotFound') || "ORDER NOT FOUND"}</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>

      {/* ================= FULLSCREEN MAP MODE (RTL AWARE) ================= */}
      {mapFullscreen ? (
        <View style={styles.fullscreenOverlay}>
          {MemoizedMapComponent}
        </View>
      ) : (
        /* ================= NORMAL ORDER DETAILS PAGE ================= */
        <View style={styles.container}>

          <View style={[styles.orderPageHeader, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.orderBackButton}
              accessibilityLabel={t('back') || 'Back'}
            >
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color="#111111" />
            </TouchableOpacity>
            <View style={[styles.orderHeaderCopy, isRTL && { alignItems: 'flex-end' }]}>
              <Text style={[styles.orderHeaderTitle, isRTL && { textAlign: 'right' }]}>
                {(t('orderDetails') || 'ORDER DETAILS').toUpperCase()}
              </Text>
              <Text style={[styles.orderHeaderMeta, isRTL && { textAlign: 'right' }]}>
                #{String(order.id || '').slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View style={styles.orderHeaderStatusDot} />
          </View>

          {/* MAP HEADER HOST AREA */}
          {hasCustomerLocation ? (
            <View style={styles.mapCollapsedHost}>{MemoizedMapComponent}</View>
          ) : null}

          <View style={styles.deliveryInfoCard}>
            <View style={[styles.deliveryInfoHeader, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="cube-outline" size={20} color="#111111" />
              <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>{(t('deliveryDetails') || 'DELIVERY DETAILS').toUpperCase()}</Text>
            </View>
            <View style={[styles.orderStatusPill, { backgroundColor: statusConfig.bg }, isRTL && { alignSelf: 'flex-end' }]}>
              <View style={[styles.orderStatusPillDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.orderStatusPillText, { color: statusConfig.color }]}>
                {(t(`status_${statusConfig.label}`) || t(statusConfig.label) || statusConfig.label.replace(/_/g, ' ')).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.deliveryInfoText}>{t('shipsFromWarehouse') || 'Ships from our warehouse'}</Text>
            <Text style={[styles.deliveryInfoText, isRTL && { textAlign: 'right' }]}>{t('deliveryAddress') || 'Delivery address'}: {order.address || '-'}</Text>
            <Text style={[styles.deliveryInfoText, isRTL && { textAlign: 'right' }]}>{t('estimatedArrival') || 'Estimated arrival'}: {estimatedArrival}</Text>
            <Text style={[styles.deliveryInfoText, isRTL && { textAlign: 'right' }]}>{t('deliveryWindow') || 'Delivery usually takes 14 to 21 days.'}</Text>
          </View>

          {/* DETAILS SHEET */}
          <ScrollView
            style={styles.scrollForm}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >

           
    {/* ========================================================== */}
{/* SHIPPING / ORDER STATUS TIMELINE                           */}
{/* ========================================================== */}

<View style={styles.section}>

  <Text
    style={[
      styles.sectionLabel,
      isRTL && {
        textAlign: 'right',
      },
    ]}
  >
    {(
      t('orderStatus') ||
      'ORDER STATUS'
    ).toUpperCase()}
  </Text>


  {/* ======================================================== */}
  {/* CURRENT STATUS                                           */}
  {/* ======================================================== */}

  <View
    style={[
      styles.liveStatusCard,
      isCancelled && {
        backgroundColor: '#FFF2F2',
        borderColor: 'rgba(255,59,48,0.15)',
      },
      isRTL && {
        alignItems: 'flex-end',
      },
    ]}
  >

    <Text
      style={[
        styles.liveStatusLabel,
        isCancelled && {
          color: '#FF3B30',
        },
      ]}
    >
      {(
        t('liveDeliveryStatus') ||
        'LIVE DELIVERY STATUS'
      )}
    </Text>

    <Text
      style={[
        styles.liveStatusValue,
        isCancelled && {
          color: '#FF3B30',
        },
      ]}
    >
      {(
  t(currentStatusString) ||
  currentStatusString.replace(/_/g, ' ')
).toUpperCase()}
    </Text>

  </View>

{/* ======================================================== */}
{/* SHEIN-STYLE HORIZONTAL ORDER TIMELINE                   */}
{/* ======================================================== */}

{/* ======================================================== */}
{/* SHEIN-STYLE ORDER TRACKING TIMELINE                     */}
{/* ======================================================== */}

{!isCancelled && (
  <View
    style={[
      styles.orderTimelineOuter,
    ]}
  >
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.orderTimelineScrollContent,
        isRTL && {
          flexDirection: 'row-reverse',
        },
      ]}
    >
              {ORDER_TIMELINE_STAGES.map((stage, index) => {
        const isCompleted =
          index < safeTimelineIndex;

        const isCurrent =
          index === safeTimelineIndex;

        const isFuture =
          index > safeTimelineIndex;

        return (
          <View
            key={stage.key}
            style={[
              styles.orderTimelineStage,
            ]}
          >
            <Text style={styles.orderTimelineDate}>
              {statusDates.get(stage.key)
                ? new Date(statusDates.get(stage.key) as string).toLocaleDateString()
                : index === safeTimelineIndex && order?.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : ''}
            </Text>

            {/* ================================================= */}
            {/* STAGE NAME — ABOVE THE TRACKING LINE             */}
            {/* ================================================= */}

            <Text
              style={[
                styles.orderTimelineLabel,

                isCompleted && {
                  color: '#111111',
                },

                isCurrent && {
                  color: '#111111',
                  fontWeight: '900',
                },

                isFuture && {
                  color: '#A1A1AA',
                },
              ]}
              numberOfLines={2}
            >
              {(
                t(stage.label) ||
                stage.label.replace(/_/g, ' ')
              ).toUpperCase()}
            </Text>

            {/* ================================================= */}
            {/* TRACKING LINE + SMALL STAGE DOT                  */}
            {/* ================================================= */}

            <View style={styles.orderTimelineTrackRow}>

              {/* LEFT HALF OF LINE */}

              {index > 0 ? (
                <View
                  style={[
                    styles.orderTimelineConnector,
                    isCompleted && {
                      backgroundColor: '#111111',
                    },
                  ]}
                />
              ) : (
                <View
                  style={styles.orderTimelineConnectorPlaceholder}
                />
              )}

              {/* STAGE DOT */}

              <View
                style={[
                  styles.orderTimelinePoint,

                  isFuture && {
                    backgroundColor: '#FFFFFF',
                    borderColor: '#D4D4D8',
                  },

                  isCompleted && {
                    backgroundColor: '#111111',
                    borderColor: '#111111',
                  },

                  isCurrent && {
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#111111',
                    borderColor: '#111111',
                  },
                ]}
              />

              {/* RIGHT HALF OF LINE */}

              {index <
              ORDER_TIMELINE_STAGES.length - 1 ? (
                <View
                  style={[
                    styles.orderTimelineConnector,
                    isCompleted && {
                      backgroundColor: '#111111',
                    },
                  ]}
                />
              ) : (
                <View
                  style={styles.orderTimelineConnectorPlaceholder}
                />
              )}

            </View>
          </View>
        );
      })}
    </ScrollView>
  </View>
)}

  {/* ======================================================== */}
  {/* CANCELLED / REFUND STATES                                */}
  {/* ======================================================== */}

  {isCancelled && (
    <View
      style={[
        styles.orderTimelineSpecialState,
        {
          backgroundColor: '#FFF2F2',
          borderColor: '#FECACA',
        },
        isRTL && {
          alignItems: 'flex-end',
        },
      ]}
    >

      <Ionicons
        name="close-circle"
        size={22}
        color="#DC2626"
      />

      <View
        style={[
          {
            flex: 1,
            marginLeft: 10,
          },
          isRTL && {
            marginLeft: 0,
            marginRight: 10,
            alignItems: 'flex-end',
          },
        ]}
      >

        <Text
          style={[
            styles.orderTimelineSpecialTitle,
            {
              color: '#DC2626',
            },
            isRTL && {
              textAlign: 'right',
            },
          ]}
        >
          {(
            t('cancelled') ||
            'ORDER CANCELLED'
          ).toUpperCase()}
        </Text>

        <Text
          style={[
            styles.orderTimelineSpecialText,
            isRTL && {
              textAlign: 'right',
            },
          ]}
        >
          {(
            t('orderCancelledDescription') ||
            'This order is no longer being processed.'
          )}
        </Text>

      </View>

    </View>
  )}

</View>

{canRequestRefund && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>
      {(t('afterDelivery') || 'AFTER DELIVERY').toUpperCase()}
    </Text>

    <TouchableOpacity
      style={styles.reviewBtn}
      onPress={() => setRefundOpen(true)}
    >
      <Text style={styles.reviewBtnText}>
        {(t('requestRefund') || 'REQUEST REFUND').toUpperCase()}
      </Text>
    </TouchableOpacity>

    <Text style={styles.pendingText}>
      {t('refundHint') ||
        'You can request refund for size, material, or defects'}
    </Text>
  </View>
)}

{canCancelOrder && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>
      {(t('orderManagement') || 'ORDER MANAGEMENT').toUpperCase()}
    </Text>

    <TouchableOpacity
      style={[styles.reviewBtn, { backgroundColor: '#FF3B30' }]}
      disabled={cancelSubmitting}
      onPress={() => {
        Alert.alert(
          t('confirmCancel') || 'Confirm',
          t('confirmCancelPrompt') || 'Are you sure you want to cancel this order?',
          [
            { text: t('no') || 'No', style: 'cancel' },
            { text: t('yes') || 'Yes', onPress: () => orderId && submitCancelOrder(orderId) },
          ]
        );
      }}
    >
      <Text style={styles.reviewBtnText}>
        {cancelSubmitting ? (t('cancelling') || 'CANCELLING...') : (t('cancelOrder') || 'CANCEL ORDER').toUpperCase()}
      </Text>
    </TouchableOpacity>

    <Text style={styles.pendingText}>
      {t('cancelHint') || 'You can cancel the order if it has not yet been delivered.'}
    </Text>
  </View>
)}

{isRefundRequested && (
  <Text style={styles.pendingText}>
    {t('refundPending') || 'Refund request pending review'}
  </Text>
)}
            <View style={styles.section}>
              <View style={[styles.sectionHeadingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
                  {(t('items') || 'ITEMS').toUpperCase()}
                </Text>
                <Text style={styles.sectionCount}>{toLocalNumbers(order.items?.length || 0)}</Text>
              </View>
              {(visibleItems as any[]).map((item: any, index: number) => {
                const itemName = locale === 'ps'
                  ? item.product?.namePs || item.namePs || item.productNamePs || item.product?.name || item.productName || item.name
                  : locale === 'fa'
                    ? item.product?.nameFa || item.nameFa || item.productNameFa || item.product?.name || item.productName || item.name
                    : item.product?.name || item.productName || item.name;
                const itemPrice = Number(item.price || item.unitPrice || 0);
                const itemQuantity = getEditedQuantity(item);
                const imageUrl = item.product?.imageUrl || item.imageUrl || item.productImage || item.product?.image;

                return (
                  <View key={item.id || `${item.productId || index}`} style={[styles.orderItemRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.orderItemImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.orderItemImagePlaceholder}><Ionicons name="image-outline" size={20} color="#A1A1AA" /></View>
                    )}
                    <View style={[styles.orderItemCopy, isRTL && { alignItems: 'flex-end' }]}>
                      <Text style={[styles.itemName, isRTL && { textAlign: 'right' }]} numberOfLines={2}>{itemName || t('unknownProduct') || 'Unknown product'}</Text>
                      <Text style={[styles.itemMeta, isRTL && { textAlign: 'right' }]}>
                        {t('qty') || 'Qty'}: {toLocalNumbers(itemQuantity)}
                        {item.selectedSize ? `  ${t('size') || 'Size'}: ${item.selectedSize}` : ''}
                        {item.selectedColor ? `  ${t('color') || 'Color'}: ${item.selectedColor}` : ''}
                      </Text>
                      <Text style={styles.priceText}>{isRTL ? `${toLocalNumbers(itemPrice * itemQuantity)} افغانۍ` : `AFN ${toLocalNumbers((itemPrice * itemQuantity).toLocaleString('en-US'))}`}</Text>
                    </View>
                  </View>
                );
              })}
              {Array.isArray(order.items) && order.items.length > 3 && (
                <TouchableOpacity onPress={() => setItemsExpanded((expanded) => !expanded)} style={styles.itemsToggle}>
                  <Text style={styles.itemsToggleText}>{t(itemsExpanded ? 'showLess' : 'showMore') || (itemsExpanded ? 'SHOW LESS' : 'SHOW MORE')}</Text>
                  <Ionicons name={itemsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#111111" />
                </TouchableOpacity>
              )}
            </View>
            {/* ========================================================================= */}
            {/* FINANCIAL SUMMARY RECAP BILLING PANEL (HYPER-SAFE CASTER CURE)            */}
            {/* ========================================================================= */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, isRTL && { textAlign: 'right' }]}>
                {(t('financialRecap') || 'ORDER FINANCIAL RECAP').toUpperCase()}
              </Text>

              {(() => {
                // 🎯 FIXED ACCUSATION CONTEXTS:
                // Safely maps arithmetic lines on array instances, or defaults to 0 to block NaN propagation!
                const safeItemsArray = Array.isArray(order?.items) ? order.items : [];
                
                const derivedSubtotal = safeItemsArray.reduce((sum: number, it: any) => {
                  const cost = parseFloat(String(it.price || '0').replace(/,/g, '')) || 0;
                  const qty = getEditedQuantity(it);
                  return sum + (cost * qty);
                }, 0);

                // Check for dynamic variations across table structures (camelCase vs snake_case)
                const rawDiscountVal = String(order?.discount || order?.discountAmount || order?.discount_amount || '0').replace(/,/g, '');
                const cleanDiscountNum = Math.ceil(parseFloat(rawDiscountVal) || 0);

                const rawShippingVal = String(order?.shippingFee || order?.shipping_fee || '0').replace(/,/g, '');
                const cleanShippingNum = Math.ceil(parseFloat(rawShippingVal) || 0);

                const cleanGrandTotalNum = Math.ceil((derivedSubtotal + cleanShippingNum) - cleanDiscountNum);

                return (
                  <>
                    {/* SUB-TOTAL BALANCE CELLS */}
                    <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={styles.billLabel}>{t('subtotal') || 'Subtotal'}</Text>
                      <Text style={styles.billValue}>
                        {isRTL ? `${toLocalNumbers(Math.ceil(derivedSubtotal))} افغانۍ` : `AFN ${toLocalNumbers(Math.ceil(derivedSubtotal).toLocaleString('en-US'))}`}
                      </Text>
                    </View>

                    {/* DISCOUNT BALANCE CELLS */}
                    {cleanDiscountNum > 0 && (
                      <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Text style={[styles.billLabel, { color: '#FF3B30' }]}>{t('discount') || 'Discount'}</Text>
                        <Text style={[styles.billValue, { color: '#FF3B30' }]}>
                          {isRTL ? `- ${toLocalNumbers(cleanDiscountNum)} افغانۍ` : `- AFN ${toLocalNumbers(cleanDiscountNum.toLocaleString('en-US'))}`}
                        </Text>
                      </View>
                    )}

                    {/* LOGISTICS FREIGHT CELLS */}
                    <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={styles.billLabel}>{t('shipping') || 'Shipping'}</Text>
                      <Text style={styles.billValue}>
                        {cleanShippingNum === 0 
                          ? (t('free') || 'FREE')
                          : isRTL ? `${toLocalNumbers(cleanShippingNum)} افغانۍ` : `AFN ${toLocalNumbers(cleanShippingNum.toLocaleString('en-US'))}`}
                      </Text>
                    </View>

                    <View style={styles.dividerLine} />

                    {/* COMPLETE PAYABLE BALANCE CELLS */}
                    <View style={[styles.billingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.billLabel, { fontWeight: '900', color: '#000000' }]}>
                        {t('totalLabel') || 'TOTAL'}
                      </Text>
                      <Text style={[styles.billValue, { fontSize: 16, fontWeight: '900', color: '#000000' }]}>
                        {isRTL ? `${toLocalNumbers(cleanGrandTotalNum)} افغانۍ` : `AFN ${toLocalNumbers(cleanGrandTotalNum.toLocaleString('en-US'))}`}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

          </ScrollView>
          
{refundOpen && (
  <View style={styles.modalOverlay}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      
      <View style={{ flex: 1, width: '100%', justifyContent: 'center' }}>

        <Animated.View
          style={[
            styles.modalCard,
            {
              transform: [{ translateY: shift }],
            },
          ]}
        >

          <Text style={styles.modalTitle}>
            {(t('refundRequest') || 'REFUND REQUEST').toUpperCase()}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={t('refundReasonPlaceholder') || 'Explain your issue'}
            value={refundReason}
            onChangeText={setRefundReason}
            multiline
          />

          <TouchableOpacity
            disabled={refundSubmitting}
            style={styles.reviewBtn}
            onPress={() => orderId && submitRefundRequest(orderId)}
          >
            <Text style={styles.reviewBtnText}>
              {refundSubmitting ? "SENDING..." : "SUBMIT"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setRefundOpen(false)}>
            <Text style={{ textAlign: 'center', marginTop: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>

        </Animated.View>

      </View>

    </TouchableWithoutFeedback>
  </View>
)}
        </View>
      )}
    </View>
  );
}

  


export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // High-end solid white runway contrast
  },

  orderPageHeader: {
    minHeight: 74,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  orderBackButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },

  orderHeaderCopy: {
    flex: 1,
    marginLeft: 12,
  },

  orderHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#111111',
  },

  orderHeaderMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#888888',
    letterSpacing: 0.5,
  },

  orderHeaderStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#111111',
  },

  // =========================
  // MAP SECTION (FLOATING GEOMETRIC ANCHOR)
  // =========================
  mapCollapsedHost: {
    width: '100%',
    height: 300,
    backgroundColor: '#FAFAFA',
    position: 'relative',
    borderBottomLeftRadius: 0, // Sharp crisp corners matching luxury catalogs
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: '#F2F2F2',
  },

  deliveryInfoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F1F1F1',
  },

  deliveryInfoText: {
    color: '#555555',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },

  deliveryInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  orderStatusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 999,
  },

  orderStatusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  orderStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionCount: {
    color: '#8A8A8A',
    fontSize: 12,
    marginBottom: 10,
  },

  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },

  orderItemImage: {
    width: 64,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
  },

  orderItemImagePlaceholder: {
    width: 64,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orderItemCopy: {
    flex: 1,
    marginHorizontal: 12,
  },

  itemsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
  },

  itemsToggleText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  backFloatBtn: {
    position: 'absolute',
    top: 54,
    width: 40,
    height: 40,
    borderRadius: 0, // Hard minimalist square box geometry
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 1000,
  },
  section: {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#F1F1F1',
},

sectionLabel: {
  fontSize: 12,
  fontWeight: '800',
  letterSpacing: 1,
  color: '#666',
  marginBottom: 10,
},

reviewBtn: {
  backgroundColor: '#111',
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
},

reviewBtnText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '800',
  letterSpacing: 1,
},

pendingText: {
  marginTop: 10,
  fontSize: 12,
  color: '#888',
  lineHeight: 18,
},

modalOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 10,
  backgroundColor: 'rgba(0,0,0,0.55)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
  zIndex: 999,
},

modalCard: {
  width: '100%',
  maxWidth: 420,
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: 16,
  elevation: 10,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 10,
},

modalTitle: {
  fontSize: 14,
  fontWeight: '900',
  letterSpacing: 1,
  marginBottom: 12,
  color: '#111',
},


input: {
  borderWidth: 1,
  borderColor: '#E5E5E5',
  borderRadius: 10,
  padding: 12,
  minHeight: 90,
  textAlignVertical: 'top',
  fontSize: 13,
  color: '#111',
},

  scrollForm: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 60,
  },
  orderRejectedHeaderCalloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,59,48,0.2)',
    marginTop: 10,
    gap: 10
  },
  orderRejectedCalloutMainText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#FF3B30',
    lineHeight: 14,
    letterSpacing: 0.3
  },
  userAppRejectionLogCard: {
    backgroundColor: '#FDFDFD',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  rejectionLogTitleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userAppRejectionLogTitleText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FF3B30',
    letterSpacing: 0.8
  },
  userAppRejectionLogBodyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444444',
    lineHeight: 17,
  },

  // =========================
  // LIVE STATUS INDUSTRIAL ROW BARS
  // =========================
  liveStatusCard: {
    backgroundColor: '#000000', // Deep ink solid primary accent block
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  liveStatusLabel: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  liveStatusValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  orderTimelineDate: {
    minHeight: 16,
    marginTop: 4,
    color: '#777777',
    fontSize: 9,
    textAlign: 'center',
  },

  // =========================
  // CARDLESS SYSTEM SECTIONS SYSTEM
  // =========================


  // =========================
  // STEPPER TIMELINE BLOCK (HYPER MINIMAL)
  // =========================
  statusStepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },

  stepContainer: {
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },

  stepCircle: {
    width: 8,
    height: 8,
    borderRadius: 0, // Hard tactical square indicator nodes
    backgroundColor: '#EAEAEA',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  stepText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#999999',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EAEAEA',
    marginHorizontal: -4,
    marginTop: -16,
    zIndex: 1,
  },

  // =========================
  // LUXURY SLAT ITEM INVENTORY ROWS
  // =========================
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EAEAEA',
  },

  thumb: {
    width: 52,
    height: 70,
    borderRadius: 0, // Crisp unrounded bounding box proportions
    backgroundColor: '#FAFAFA',
    borderWidth: 0.5,
    borderColor: '#EAEAEA',
  },

  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },

  itemName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: 0.5,
    lineHeight: 15,
  },

  itemMeta: {
    fontSize: 9,
    color: '#888888',
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  priceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // =========================
  // FINANCE BREAKDOWN STATEMENTS
  // =========================
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },

  billLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '400',
    letterSpacing: 0.3,
  },

  billValue: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  dividerLine: {
    height: 1,
    backgroundColor: '#000000', // High-contrast solid line anchor before final grand total string
    marginVertical: 14,
  },

  // =========================
  // FULLSCREEN MAP LAYER OVERLAYS
  // =========================
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    zIndex: 999999,
    elevation: 999999,
  },

  fullscreenExitBtn: {
    position: 'absolute',
    top: 54,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000000,
  },

  // =========================
  // UTILITIES DISPATCH CHANNELS
  // =========================
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  emptyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  orderTimelineOuter: {
  marginTop: 14,
  width: '100%',
  overflow: 'hidden',
},

orderTimelineScrollContent: {
  paddingVertical: 18,
  paddingHorizontal: 8,
  alignItems: 'flex-start',
},

orderTimelineStage: {
  width: 125,
  alignItems: 'center',
},

orderTimelinePointRow: {
  width: 125,
  height: 28,
  alignItems: 'center',
},

orderTimelineConnector: {
  height: 2,
  width: 44,
  backgroundColor: '#E5E7EB',
},

orderTimelinePoint: {
  width: 24,
  height: 24,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#E5E7EB',
  backgroundColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
},

orderTimelineCurrentDot: {
  width: 7,
  height: 7,
  borderRadius: 4,
  backgroundColor: '#FFFFFF',
},

orderTimelineCurrentBadge: {
  marginTop: 5,
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: 8,
  backgroundColor: '#111111',
},

orderTimelineCurrentBadgeText: {
  color: '#FFFFFF',
  fontSize: 7,
  fontWeight: '900',
  letterSpacing: 0.5,
},

orderTimelineSpecialState: {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  borderWidth: 1,
  flexDirection: 'row',
  alignItems: 'center',
},

orderTimelineSpecialTitle: {
  fontSize: 11,
  fontWeight: '900',
  letterSpacing: 0.5,
},

orderTimelineSpecialText: {
  marginTop: 4,
  fontSize: 10,
  lineHeight: 15,
  color: '#6B7280',
},
// =========================
// SHEIN-STYLE ORDER TIMELINE
// =========================

orderTimelineLabel: {
  width: 108,
  minHeight: 28,
  marginBottom: 9,

  textAlign: 'center',

  fontSize: 9,
  lineHeight: 12,
  fontWeight: '700',
  letterSpacing: 0.35,

  color: '#A1A1AA',
},

orderTimelineTrackRow: {
  width: 120,
  height: 14,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},

orderTimelineConnectorPlaceholder: {
  flex: 1,
  height: 2,
  backgroundColor: 'transparent',
},

});
