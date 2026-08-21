import { API_URL } from "@/lib/config";
import { useEffect, useState } from "react";
export function useReviews(userId?: string) {
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    fetch(
      `${API_URL}/api/reviews/my-reviews?userId=${userId}`
    )
      .then((r) => {
        if (!r.ok) throw new Error();

        return r.json();
      })
      .then((data) => {
        setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => setReviews([]));
  }, [userId]);

  return { reviews };
}