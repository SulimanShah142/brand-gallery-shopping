// components/DeliveredOrderReviewCard.tsx
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

export function DeliveredOrderReviewCard({
  order,
  onWriteReview,
}: any) {
  const hasReview = !!order.review;

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.row}>
        <Text style={styles.orderId}>
          ORDER #{order.id.slice(0, 8).toUpperCase()}
        </Text>

        <Text style={styles.status}>DELIVERED</Text>
      </View>

      {/* MINI PRODUCT PREVIEW (SHEIN STYLE) */}
      <View style={styles.productRow}>
        {(order.items || []).slice(0, 3).map((item: any, i: number) => (
          <Image
            key={i}
            source={{ uri: item.image }}
            style={styles.productImage}
          />
        ))}
      </View>

      {/* REVIEW SECTION */}
      {!hasReview ? (
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => onWriteReview(order)}
        >
          <Text style={styles.reviewBtnText}>
            WRITE REVIEW
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.reviewBox}>
          <Text style={styles.stars}>
            {"⭐".repeat(order.review.rating)}
          </Text>
          <Text numberOfLines={2} style={styles.comment}>
            {order.review.comment}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  orderId: {
    fontSize: 12,
    fontWeight: "700",
  },

  status: {
    fontSize: 10,
    color: "green",
    fontWeight: "800",
  },

  productRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 6,
  },

  productImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "#f2f2f2",
  },

  reviewBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  reviewBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  reviewBox: {
    marginTop: 10,
    backgroundColor: "#fafafa",
    padding: 10,
    borderRadius: 10,
  },

  stars: {
    fontSize: 12,
  },

  comment: {
    fontSize: 12,
    marginTop: 4,
    color: "#333",
  },
});