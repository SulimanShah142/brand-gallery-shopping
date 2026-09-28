import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,StyleSheet
  ,Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/Contexts/LanguageContext';
import { authClient } from '@/lib/auth-client';
import { loadMyOrdersLocal, saveMyOrders, isOnline } from '../lib/offline';
import { API_URL } from '@/lib/config';
import * as SecureStore from 'expo-secure-store';
type Order = {
  id: string;
  status: string;
  createdAt?: string;
  totalAmount?: number;
  rejectionReason?: string;
  reason?: string;
  items?: Array<{
    productName?: string;
    imageUrl?: string;
    quantity?: number;
  }>;
};

// =========================
// CANONICAL STATUS ENGINE
// =========================
export const STATUS_CANONICAL_MAP: Record<string, string> = {
  pending: 'pending',

  accepted: 'confirmed',
  confirmed: 'confirmed',
  processing: 'confirmed',

  awaiting_packaging: 'awaiting_packaging',
  packaging: 'packaging',
  packaged: 'packaged',
  assigned_to_deliverer: 'confirmed',

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

  failed: 'cancelled',

   refunded: 'refunded',

  refund_requested: 'refund_requested',
  refund_approved: 'refund_approved',

  refund_pickup_in_progress: 'refund_pickup_in_progress',

  refund_rejected: 'refund_rejected',

};

// =========================
// SAFE NORMALIZER
// =========================
export const normalizeStatus = (status?: string) => {
  if (!status) return 'pending';

  const key = String(status).trim().toLowerCase();
  return STATUS_CANONICAL_MAP[key] || key;
};

// =========================
// UI STATUS STYLE ENGINE
// =========================
const getStatusStyle = (status?: string) => {
  const s = normalizeStatus(status);

  switch (s) {
    case 'pending':
      return { bg: '#F3F4F6', color: '#6B7280', label: 'pending' };

    case 'confirmed':
      return { bg: '#DBEAFE', color: '#2563EB', label: 'confirmed' };

    case 'picked_up':
      return { bg: '#E0F2FE', color: '#0284C7', label: 'picked_up' };

    case 'delivered':
      return { bg: '#DCFCE7', color: '#16A34A', label: 'delivered' };

    case 'refund_requested':
      return { bg: '#FFF7ED', color: '#F97316', label: 'refund_requested' };

    case 'refund_approved':
      return { bg: '#DCFCE7', color: '#16A34A', label: 'refund_approved' };
case 'refund_pickup_in_progress':
  return {
    bg: '#E0F2FE',
    color: '#0284C7',
    label: 'refund_pickup_in_progress',
  };
    case 'refund_rejected':
      return { bg: '#FEF2F2', color: '#DC2626', label: 'refund_rejected' };

    case 'refunded':
      return { bg: '#ECFEFF', color: '#0891B2', label: 'refunded' };

    case 'cancelled':
      return { bg: '#FEF2F2', color: '#DC2626', label: 'cancelled' };

    default:
      return { bg: '#F3F4F6', color: '#6B7280', label: 'pending' };
  }
};

// =========================
// MAIN SCREEN
// =========================
export default function MyOrdersScreen() {
  const { data: session } = authClient.useSession();
  const { t, isRTL, locale } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState(false);

  // =========================
  // ORDER NORMALIZER (FIXED)
  // =========================
  const normalizeOrder = (order: any): Order => ({
    ...order,

    status: normalizeStatus(order?.status),

    cancellationReason:
      order?.cancellationReason ||
      order?.cancelReason ||
      order?.rejectionReason ||
      order?.reason ||
      null,
  });

  // =========================
  // SAFE FETCH USER ID
  // =========================
  const getUserId = async () => {
    let id = session?.user?.id;

    if (!id) {
      try {
        const cached = await SecureStore.getItemAsync('cached_user_profile');
        if (cached) {
          id = JSON.parse(cached)?.id;
        }
      } catch {}
    }

    return id;
  };

  // =========================
  // FETCH ORDERS (HARDENED)
  // =========================
  const fetchOrders = useCallback(async () => {
    if (!refreshing) setLoading(true);
    setRefreshing(true);

    try {
      const userId = await getUserId();

      if (!userId) {
        setOrders([]);
        return;
      }

      const res = await fetch(
        `${API_URL}/api/orders/my-orders?userId=${userId}`
      );

      if (!res.ok) return;

      const payload = await res.json();

      const raw = Array.isArray(payload) ? payload : payload?.data || [];

      const normalized = raw.map(normalizeOrder);

      setOrders(normalized);
    } catch (e) {
      console.log('Order fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  // =========================
  // DISPLAY DATA
  // =========================
  const dataToShow = expanded ? orders : orders.slice(0, 4);

  const toLocalNumbers = (num: any) => {
    const str = Math.ceil(Number(num || 0)).toLocaleString();
    if (locale === 'en') return str;

    const digits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return str.replace(/[0-9]/g, d => digits[parseInt(d, 10)]);
  };

  // =========================
  // RENDER ITEM (FIXED PIPELINE)
  // =========================
const renderOrder = ({ item }: { item: Order }) => {
  const config = getStatusStyle(item.status);
  const firstItem = item.items?.[0];

  const normalizedStatus = normalizeStatus(item.status);

  const isCancelled =
    normalizedStatus === 'cancelled';

  const isRefundFlow =
    [
      'refund_requested',
      'refund_approved',
      'refund_rejected',
      'refunded',
    ].includes(normalizedStatus);

  const displayReason =
    item.rejectionReason ||
    item.refundReason ||
    item.refundAdminNote;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`orders/${item.id}`)}
      style={{
        padding: 14,
        marginBottom: 10,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* ================= HEADER ================= */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', flex: 1 }}>
          {firstItem?.imageUrl ? (
            <Image
              source={{ uri: firstItem.imageUrl }}
              style={{ width: 58, height: 58, borderRadius: 10, marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0, backgroundColor: '#F3F4F6' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 58, height: 58, borderRadius: 10, marginRight: isRTL ? 0 : 10, marginLeft: isRTL ? 10 : 0, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cube-outline" size={24} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ textAlign: isRTL ? 'right' : 'left', fontWeight: '700' }} numberOfLines={1}>
              {firstItem?.productName || 'Order'}
            </Text>
            {!!firstItem?.quantity && (
              <Text style={{ marginTop: 4, fontSize: 12, color: '#6B7280', textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? `${toLocalNumbers(firstItem.quantity)} items` : `${firstItem.quantity} ${firstItem.quantity === 1 ? 'item' : 'items'}`}
              </Text>
            )}
          </View>
        </View>

        <View
          style={{
            backgroundColor: config.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: config.color,
              fontSize: 12,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {(t(`status_${config.label}`) || config.label)
              .toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ================= DATE ================= */}
      <Text
        style={{
          marginTop: 6,
          opacity: 0.6,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {item.createdAt
          ? new Date(item.createdAt).toLocaleDateString()
          : 'Recent'}
      </Text>

      {/* ================= CANCEL / REFUND REASON ================= */}
      {(isCancelled || isRefundFlow) && displayReason && (
        <Text
          style={{
            color: isRefundFlow ? '#D97706' : '#FF3B30',
            marginTop: 6,
            fontSize: 12,
            fontWeight: '600',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          ⚠️ {displayReason}
        </Text>
      )}

      {/* ================= FOOTER ================= */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          marginTop: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ textAlign: isRTL ? 'right' : 'left' }}>
          TOTAL:{' '}
          <Text style={{ fontWeight: 'bold' }}>
            {isRTL
              ? `${toLocalNumbers(item.totalAmount)} AFN`
              : `AFN ${toLocalNumbers(item.totalAmount)}`}
          </Text>
        </Text>

        <Ionicons
          name={isRTL ? 'chevron-forward' : 'chevron-forward'}
          size={14}
        />
      </View>
    </TouchableOpacity>
  );
};

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {(t('myOrders') || 'MY ORDERS').toUpperCase()}
      </Text>

      <FlatList
        data={dataToShow}
        renderItem={renderOrder}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchOrders}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t('noOrders') || "You haven't placed any orders yet."}
            </Text>
          </View>
        }
      />

      {orders.length > 4 && (
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.expandBtn}
        >
          <Text style={styles.expandText}>
            {expanded ? 'SHOW LESS' : 'SHOW ALL'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },

  header: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#111111',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },

  rtlText: {
    textAlign: 'right',
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // =========================
  // ORDER CARD (MODERN MINIMAL LUXURY)
  // =========================
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,

    paddingVertical: 16,
    paddingHorizontal: 14,

    marginBottom: 12,

    borderWidth: 1,
    borderColor: '#F1F1F1',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statusBadge: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 20,
  alignSelf: 'flex-start',
},

statusText: {
  fontSize: 12,
  fontWeight: '700',
},

refundPending: {
  marginTop: 6,
  fontSize: 12,
  color: '#F97316',
  fontWeight: '600',
},

refreshHint: {
  textAlign: 'center',
  fontSize: 12,
  opacity: 0.5,
  marginTop: 6,
},

  orderInfo: {
    width: '100%',
  },

  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  orderId: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.6,
  },

  // =========================
  // STATUS BADGE (MODERN PILLS)
  // =========================
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,

    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
    historyCardRejectionReasonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 4,
    backgroundColor: '#FFF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden'
  },


  orderDate: {
    fontSize: 11,
    color: '#8A8A8A',
    marginTop: 6,
    fontWeight: '500',
  },

  // =========================
  // FOOTER ROW
  // =========================
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginTop: 14,
    width: '100%',
  },

  orderAmount: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },

  priceAmount: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 13,
  },

  // =========================
  // VIEW DETAILS LINK (MORE PREMIUM FEEL)
  // =========================
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 6,
    paddingHorizontal: 10,

    borderRadius: 8,
    backgroundColor: '#F7F7F7',
  },

  detailText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: 0.6,
  },

  // =========================
  // EXPAND BUTTON (IMPROVED CTA STYLE)
  // =========================
  expandBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    gap: 6,

    paddingVertical: 14,
    marginTop: 10,

    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 10,

    backgroundColor: '#FFFFFF',
  },

  expandText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#555555',
    letterSpacing: 1,
  },

  // =========================
  // EMPTY STATE (MORE MODERN + SOFT)
  // =========================
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 120,
    paddingHorizontal: 30,
  },

  emptyText: {
    fontSize: 12,
    color: '#9A9A9A',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
});