import { API_URL } from "@/lib/config";
import { useEffect, useState } from "react";


export function useOrders(userId?: string) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    fetch(
      `${API_URL}/api/orders/my-orders?userId=${userId}`
    )
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => setOrders([]));
  }, [userId]);

  return { orders };
}