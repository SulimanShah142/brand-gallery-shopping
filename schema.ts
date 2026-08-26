import { 
  pgTable, text, timestamp, boolean, uuid, pgEnum, 
  integer, numeric, decimal, index ,uniqueIndex,
   foreignKey, real, varchar,
   jsonb
} from "drizzle-orm/pg-core";
// 1. Roles Enum (Marketplace wide)
export const roleEnum = pgEnum('user_role', ['admin', 'seller', 'deliverer', 'customer']);



// ======================================================
// USER TABLE
// ======================================================



// ======================================================
// USER TABLE
// ======================================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    email: text("email")
      .notNull()
      .unique(),

    // 🔐 PASSWORD HASH ONLY
    passwordHash: text("password_hash")
      .notNull(),

    emailVerified: boolean("email_verified")
      .notNull()
      .default(false),

    image: text("image"),

    // OPTIONAL PHONE LOGIN
    phoneNumber: text("phone_number")
      .unique(),

    phoneNumberVerified: boolean(
      "phone_number_verified"
    )
      .notNull()
      .default(false),

    role: roleEnum("role")
      .notNull()
      .default("customer"),

    onesignalPlayerId: text(
      "onesignal_player_id"
    ),

    isNewUser: boolean("is_new_user")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex(
      "user_email_idx"
    ).on(table.email),

    phoneIdx: uniqueIndex(
      "user_phone_idx"
    ).on(table.phoneNumber),
  })
);

// ======================================================
// SESSION TABLE
// ======================================================

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    token: text("token")
      .notNull()
      .unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    ipAddress: text("ip_address"),

    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex(
      "session_token_idx"
    ).on(table.token),

    userIdx: index(
      "session_user_idx"
    ).on(table.userId),
  })
);

// ======================================================
// VERIFICATION TABLE
// ======================================================

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),

    identifier: text("identifier")
      .notNull(),

    // HASHED OTP
    value: text("value")
      .notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    identifierIdx: index(
      "verification_identifier_idx"
    ).on(table.identifier),
  })
);
// ======================================================
// PHONE OTP VERIFICATION TABLE
// ======================================================


// =========================================================================
// ADVERTISEMENTS
// =========================================================================

export const advertisements = pgTable('advertisements', {
  id: uuid('id').primaryKey().defaultRandom(),

  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, {
      onDelete: 'cascade',
    }),

  title: text('title'),
  titlePs: text('title_ps'),
  titleFa: text('title_fa'),

  subtitle: text('subtitle'),
  subtitlePs: text('subtitle_ps'),
  subtitleFa: text('subtitle_fa'),

  isActive: boolean('is_active').default(true),

  sortOrder: integer('sort_order').default(0),

  createdAt: timestamp('created_at').defaultNow(),
});

// 3. MARKETPLACE TABLES (SHEIN-style)


// 3. CATEGORIES (With SHEIN-style nesting)
// =========================================================================
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 🗺️ LOCALE STRING CHANNELS: 
  // Admin inputs these fields explicitly inside the Management Portal on save.
  name: text('name').notNull(),                  // English Default (e.g., "Dresses")
  namePs: text('name_ps'),                       // Pashto Translation (e.g., "جامې")
  nameFa: text('name_fa'),                       // Dari/Persian Translation (e.g., "لباس‌ها")
  
  description: text('description'),              // English Default
  descriptionPs: text('description_ps'),         // Pashto Description
  descriptionFa: text('description_fa'),         // Dari Description

  imageUrl: text('image_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// =========================================================================
// 🎯 2. MULTILINGUAL PRODUCTS TABLE SCHEMA
// =========================================================================
// =========================================================================
// 🎯 PRODUCTS
// =========================================================================

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    categoryId: uuid("category_id")
      .references(() => categories.id),

    // ======================================================
    // MULTILINGUAL PRODUCT NAME
    // ======================================================

    name: text("name")
      .notNull(),

    namePs: text("name_ps"),

    nameFa: text("name_fa"),

    // ======================================================
    // MULTILINGUAL PRODUCT DESCRIPTION
    // ======================================================

    description: text("description"),

    descriptionPs: text("description_ps"),

    descriptionFa: text("description_fa"),

    // ======================================================
    // PRICING
    // ======================================================

    usdPrice: numeric("usd_price", {
      precision: 10,
      scale: 2,
    }).notNull(),

    profitPercentage: numeric(
      "profit_percentage",
      {
        precision: 5,
        scale: 2,
      }
    ).default("20.00"),

    // ======================================================
    // MAIN PRODUCT IMAGE
    // ======================================================

    imageUrl: text("image_url"),

    // ======================================================
    // LEGACY COLOR IMAGE SYSTEM
    //
    // Keep these for compatibility with the existing
    // backend/frontend until everything is migrated.
    // New color functionality should use productColors.
    // ======================================================

    colorImageUrls: text("color_image_urls").array(),

    // ======================================================
    // LEGACY SIZE/COLOR ARRAYS
    //
    // Keep them for compatibility with existing code.
    // The new detailed color system uses productColors.
    // ======================================================

    availableSizes: text("available_sizes").array(),

    availableColors: text("available_colors").array(),

    availableColorsPs: text("available_colors_ps").array(),

    availableColorsFa: text("available_colors_fa").array(),

    // ======================================================
    // STOCK
    // ======================================================

    stockQuantity: integer("stock_quantity")
      .default(0),

    isAvailable: boolean("is_available")
      .notNull()
      .default(true),

    // ======================================================
    // SOFT DELETE
    // ======================================================

    isDeleted: boolean("is_deleted")
      .notNull()
      .default(false),

    deletedAt: timestamp(
      "deleted_at",
      {
        withTimezone: true,
      }
    ),

    // ======================================================
    // TIMESTAMPS
    // ======================================================

    createdAt: timestamp(
      "created_at"
    )
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at"
    )
      .defaultNow(),
  }
);



export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id),
  sku: text('sku').unique(), // For warehouse tracking
  color: text('color'),
  size: text('size'),
  stockQuantity: integer('stock_quantity').default(0),
  additionalPrice: numeric('additional_price', { precision: 10, scale: 2 }).default('0.00'),
});



// ======================================================
// PRODUCT COLORS
// ======================================================
// Each product can have multiple colors.
// Every color has its own image.
// Example:
// Product → Black → black-shirt.jpg
//        → White → white-shirt.jpg
//        → Blue  → blue-shirt.jpg
// ======================================================

// =========================================================================
// 🎨 PRODUCT COLORS
// =========================================================================
//
// Every product can have unlimited colors.
//
// Product
//   ├── Black  → black-image.jpg
//   ├── White  → white-image.jpg
//   ├── Blue   → blue-image.jpg
//   └── Red    → red-image.jpg
//
// This is the proper source of truth for the new color system.
// =========================================================================

export const productColors = pgTable(
  "product_colors",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, {
        onDelete: "cascade",
      }),

    // ======================================================
    // COLOR NAME
    // ======================================================

    name: text("name")
      .notNull(),

    namePs: text("name_ps"),

    nameFa: text("name_fa"),

    // Optional actual color value
    // Example: #000000
    colorCode: text("color_code"),

    // ======================================================
    // IMAGE FOR THIS SPECIFIC COLOR
    // ======================================================

    imageUrl: text("image_url"),

    // ======================================================
    // DISPLAY ORDER
    // ======================================================

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productIdx: index(
      "product_colors_product_idx"
    ).on(table.productId),
  })
);


// ======================================================
// PRODUCT SPECIFICATION / SIZE GUIDE TABLES
// ======================================================
//
// Product
//   └── productSizeGuides
//          ├── Size Guide
//          │      ├── S
//          │      ├── M
//          │      └── L
//          │
//          └── Material Information
//                 ├── Cotton
//                 └── Polyester
//
// This gives us a flexible specification system while
// still supporting the current frontend "sizeGuide"
// compatibility object.
// ======================================================

export const productSizeGuides = pgTable(
  "product_size_guides",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, {
        onDelete: "cascade",
      }),

    title: text("title")
      .notNull()
      .default("Size Guide"),

    titlePs: text("title_ps"),

    titleFa: text("title_fa"),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    productIdx: index(
      "product_size_guides_product_idx"
    ).on(table.productId),
  })
);


// ======================================================
// PRODUCT SIZE GUIDE ROWS
// ======================================================
//
// Example:
//
// Size | Height | Chest | Waist | Length
// -----|--------|-------|-------|-------
// S    | 68 cm  | 100cm | 90cm | 70cm
// M    | 70 cm  | 104cm | 94cm | 72cm
// L    | 72 cm  | 108cm | 98cm | 74cm
//
// measurements is intentionally JSONB so different
// products can have different measurement columns.
// ======================================================

export const productSizeGuideRows = pgTable(
  "product_size_guide_rows",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    sizeGuideId: uuid("size_guide_id")
      .notNull()
      .references(() => productSizeGuides.id, {
        onDelete: "cascade",
      }),

    size: text("size")
      .notNull(),

    measurements: jsonb("measurements")
      .notNull()
      .default({}),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sizeGuideIdx: index(
      "product_size_guide_rows_guide_idx"
    ).on(table.sizeGuideId),
  })
);


// server/schema.ts -> Add these fields to appSettings table to unlock limits
export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey().default('app-settings'),
  
  newUserDiscountActive: boolean('new_user_discount_active').default(false),
  newUserDiscountType: text('new_user_discount_type'), // 'percentage' | 'fixed'
  newUserDiscountValue: numeric('new_user_discount_value'),

  // 🎯 NEW RE-ENGINEERED RETENTION COLUMNS:
  // Limits the discount to a specific number of orders (e.g., first 2 shops only!)
  newUserMaxPurchaseCount: integer('new_user_max_purchase_count').default(1),
  
  // Controls the campaign duration limit window (e.g., active until this date)
  newUserDiscountExpiresAt: timestamp('new_user_discount_expires_at', { withTimezone: true }),

  // Your existing fields continue exactly unchanged...
  deliveryFee: real("delivery_fee").default(150.0),
  freeDeliveryThreshold: real("free_delivery_threshold").default(2000.0),
  baseDeliveryFee: numeric('base_delivery_fee').default('3.00'),
  managerNumber: text('manager_number'),
  usdToAfnRate: numeric('usd_to_afn_rate', { precision: 10, scale: 2 }).default('65.00'),
  prepaymentThreshold: numeric('prepayment_threshold', { precision: 10, scale: 2 }).default('2500.00'),
  prepaymentPercentage: numeric('prepayment_percentage', { precision: 5, scale: 2 }).default('30.00'),
  rewardThreshold: numeric('reward_threshold', { precision: 10, scale: 2 }).default('5000.00'),
  rewardType: text('reward_type').default('discount'),
  rewardValue: numeric('reward_value', { precision: 10, scale: 2 }).default('500.00'),
  warehouseAddress: text("warehouse_address"),
  warehouseLat: decimal("warehouse_lat"),
  warehouseLng: decimal("warehouse_lng"),
  updatedAt: timestamp('updated_at').defaultNow(),
});


export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Enforces unique codes upper-cased constraints inside database blocks
  code: varchar("code", { length: 50 }).notNull().unique(),
  
  // Stores numeric weights or absolute fixed discount values maps
  value: text("value").notNull().default("0"),
  
  // 'percentage' or 'fixed'
  type: text("type").notNull().default("percentage"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
// 1. Chat Conversations
// This table persists longer so users can see their active tickets
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id),
  adminId: text("admin_id").references(() => user.id), 
  status: text("status").default("active"), // active, archived
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. The 7-Day Message Buffer
// We add an index on 'createdAt' to make the cleanup job (TTL) extremely fast
// server/schema.ts -> Structural Retention Table Realignment
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
    
  senderId: text("sender_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
    
  content: text("content").notNull(),
  
  attachmentUrl: text("attachment_url"),
  
  isRead: boolean("is_read").default(false),
  
  isSyncedToLocal: boolean("is_synced_to_local").default(false),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // 🎯 THE EXPLICIT AUTOMATED RETENTION TRACKER:
  // Dynamically points to the precise timestamp when the database evicts this data row!
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .notNull(),
}, (table) => ({
  createdAtIndex: index("msg_created_at_idx").on(table.createdAt),
  // 🎯 EXPRIATION INDEX: Makes the background cleaning scans extremely fast
  expiresAtIndex: index("msg_expires_at_idx").on(table.expiresAt),
}));

// 3. Notification Logs (For OneSignal tracking)
export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientId: text("recipient_id").references(() => user.id),
  oneSignalId: text("onesignal_id"), // The ID returned by OneSignal API
  title: text("title"),
  body: text("body"),
  status: text("status"), // sent, failed, opened
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderStatusEnum = pgEnum('order_status', [
  'pending',

  'confirmed',
  'rejected',

  'awaiting_packaging',
  'packaging',
  'packaged',

  'assigned_to_deliverer',
  'picked_up',
  'out_for_delivery',

  'delivered',

  // 🔥 ADD REFUND FLOW (SOURCE OF TRUTH)
 'refund_requested',
'refund_approved',
'refund_pickup_in_progress',
'refund_rejected',
'refunded',


  'cancelled_by_user',
  'cancelled_by_packager',
  'cancelled_by_deliverer',
]);

export const orders = pgTable("orders", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),

  userId: text("user_id")
    .references(() => user.id)
    .notNull(),

  // =========================================================
  // CUSTOMER INFORMATION SNAPSHOT
  // =========================================================

  customerName: text("customer_name")
    .notNull(),

  phoneNumber: text("phone_number")
    .notNull(),

  whatsappNumber: text("whatsapp_number"),

  address: text("address")
    .notNull(),

  // =========================================================
  // DELIVERY / LOGISTICS
  // =========================================================

  delivererId: uuid("deliverer_id")
    .references(() => deliverers.id),

  packagerId: uuid("packager_id")
    .references(() => deliverers.id),

  shippingFee: numeric("shipping_fee", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  // =========================================================
  // ORDER PRICING SNAPSHOT
  // =========================================================

  subtotal: numeric("subtotal", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  promoDiscount: numeric("promo_discount", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  newUserDiscount: numeric("new_user_discount", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  milestoneDiscount: numeric("milestone_discount", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  promoCode: text("promo_code"),

  totalAmount: numeric("total_amount", {
    precision: 10,
    scale: 2,
  })
    .notNull(),

  // =========================================================
  // ORDER STATUS
  // =========================================================

  status: orderStatusEnum("status")
    .default("pending"),

  rejectionReason: text("rejection_reason"),

  // =========================================================
  // REFUND FLOW
  // =========================================================

  refundReason: text("refund_reason"),

  refundAdminNote: text("refund_admin_note"),

  refundProcessedAt: timestamp("refund_processed_at"),

  // =========================================================
  // PACKAGING / CANCELLATION TIMESTAMPS
  // =========================================================

  packagedAt: timestamp("packaged_at"),

  cancelledAt: timestamp("cancelled_at"),

  // =========================================================
  // DELIVERY DRIVER LIVE LOCATION
  //
  // IMPORTANT:
  // These are NOT customer's checkout GPS coordinates.
  // They belong to the delivery tracking system.
  // =========================================================

  driverLat: text("driver_lat"),

  driverLng: text("driver_lng"),

  lastGpsUpdate: timestamp("last_gps_update"),

latitude: decimal("latitude", {
  precision: 10,
  scale: 7,
}),

longitude: decimal("longitude", {
  precision: 10,
  scale: 7,
}),
  // =========================================================
  // TIMESTAMPS
  // =========================================================

  createdAt: timestamp("created_at")
    .defaultNow(),

  updatedAt: timestamp("updated_at")
    .defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),

  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),

  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),

  quantity: integer("quantity")
    .notNull(),

  // =========================================================
  // COMMERCIAL PRICING SNAPSHOT
  // =========================================================

  // Original/reference price before the existing discount
  originalPrice: numeric("original_price", {
    precision: 10,
    scale: 2,
  }),

  // Actual price customer receives
  price: numeric("price", {
    precision: 10,
    scale: 2,
  }).notNull(),

  // Difference between originalPrice and price
  discountAmount: numeric("discount_amount", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  // Snapshot of the percentage displayed to customer
  discountPercentage: numeric("discount_percentage", {
    precision: 5,
    scale: 2,
  })
    .default("0")
    .notNull(),

  // =========================================================
  // PRODUCT VARIANT
  // =========================================================

  selectedSize: text("selected_size"),

  selectedColor: text("selected_color"),
});

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // e.g., 'EID2024'
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed'
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: numeric("min_order_amount").default('0'),
  isActive: boolean("is_active").default(true),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

//delivers table

export const deliverers = pgTable("deliverers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),

  phoneNumber: text("phone_number"),

  // ✅ NEW ROLE SYSTEM
  role: text("role").notNull().default("deliverer"), 
  // values: "deliverer" | "packager"

  status: text("status").default("idle"), // idle, busy, offline
  isAvailable: boolean("is_available").default(true),

  currentLat: decimal("current_lat"),
  currentLng: decimal("current_lng"),

  createdAt: timestamp("created_at").defaultNow(),
});

// server/schema.ts -> Added the missing images column definition

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Keep reviews tied to the product but DO NOT cascade-delete them if a product is soft-deleted
  productId: uuid("product_id").notNull().references(() => products.id),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), 
  comment: text("comment"),
  
  // 🎯 THE CRITICAL CONFIGURATION FIX: Add the missing images column to the layout!
  // This gives your database engine a text column slot to store the UploadThing JSON arrays.
  images: text("images").default("[]").notNull(), 

  createdAt: timestamp("created_at").defaultNow(),
});

// Update the user table if you want to track total reviews (optional)

// 2. Update Orders Table (Ensure this matches your existing orders table)
// Add: delivererId: uuid("deliverer_id").references(() => deliverers.id),


export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(), // Match SQLite Client generated UUID
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").default("General"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
