// hooks/useDeliveredReviewHub.ts
import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export type DeliveredOrderWithReview = {
  id: string;
  status: string;
  createdAt?: string;
  totalAmount?: number;

  items?: any[]; // optional product previews

  review?: {
    id: string;
    rating: number;
    comment: string;
    images?: string[];
  } | null;
};

export function useDeliveredReviewHub(API_URL: string, session: any) {
  const [orders, setOrders] = useState<DeliveredOrderWithReview[]>([]);
  const [loading, setLoading] = useState(true);

  const getUserId = async () => {
    let id = session?.user?.id;

    if (!id) {
      const cached = await SecureStore.getItemAsync("cached_user_profile");
      if (cached) id = JSON.parse(cached)?.id;
    }

    return id;
  };

  const fetchDeliveredOrders = useCallback(async () => {
    setLoading(true);

    try {
      const userId = await getUserId();
      if (!userId) return;

      const res = await fetch(
        `${API_URL}/api/orders/my-orders?userId=${userId}`
      );

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];

      const deliveredOnly = list.filter(
        (o: any) => o.status === "delivered" || o.status === "completed"
      );

      setOrders(deliveredOnly);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchDeliveredOrders();
  }, [fetchDeliveredOrders]);

  return {
    orders,
    loading,
    refetch: fetchDeliveredOrders,
  };
}