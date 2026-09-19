import * as SQLite from 'expo-sqlite'; // NO /legacy
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { API_URL } from './config';
const DATABASE_NAME = 'ecommerce-offline.db';


let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let productWriteQueue: Promise<void> = Promise.resolve();

// Helper to open connection
async function getDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return db;
}

async function ensureColumnExists(database: SQLite.SQLiteDatabase, table: string, column: string, type: string) {
  const pragma = await database.getAllAsync(`PRAGMA table_info(${table});`);
  const hasColumn = Array.isArray(pragma) && pragma.some((col: any) => col.name === column);
  if (!hasColumn) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
  }
}

export async function initOfflineDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await getDatabase();
    try {
      // 1. Set journal mode (Must be outside transaction)
      await database.execAsync('PRAGMA journal_mode = WAL;');

      // 2. Execute Table Creation in an Exclusive Transaction
      await database.withExclusiveTransactionAsync(async () => {
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS app_settings (
            id TEXT PRIMARY KEY NOT NULL,
            usdToAfnRate REAL DEFAULT 65.0,
            newUserDiscountActive INTEGER DEFAULT 0,
            newUserDiscountType TEXT,
            newUserDiscountValue REAL,
            discountDurationHours INTEGER DEFAULT 24
          );

          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            namePs TEXT,
            nameFa TEXT,
            description TEXT,
            descriptionPs TEXT,
            descriptionFa TEXT,
            usageInstructions TEXT,
            usageInstructionsPs TEXT,
            usageInstructionsFa TEXT,
            imageUrl TEXT,
            parentId TEXT,
            isActive INTEGER DEFAULT 1
          );

          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY NOT NULL,
            categoryId TEXT,
            name TEXT NOT NULL,
            namePs TEXT,
            nameFa TEXT,
            description TEXT,
            descriptionPs TEXT,
            descriptionFa TEXT,
            usdPrice REAL NOT NULL,
            profitPercentage REAL DEFAULT 20.0,
            imageUrl TEXT,
            availableSizes TEXT,
            availableColors TEXT,
            availableColorsPs TEXT,
            availableColorsFa TEXT,
            stockQuantity INTEGER DEFAULT 0,
            isAvailable INTEGER DEFAULT 1
         
          );

          CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY NOT NULL,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            category TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            customerName TEXT NOT NULL,
            totalAmount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            createdAt TEXT
          );

          CREATE TABLE IF NOT EXISTS local_categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        name_ps TEXT,
        name_fa TEXT,
        description TEXT,
        description_ps TEXT,
        description_fa TEXT,
        image_url TEXT,
        parent_id TEXT
      );
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY NOT NULL,
            userId TEXT NOT NULL,
            userName TEXT,
            lastMessage TEXT,
            lastMessageTime TEXT,
            status TEXT DEFAULT 'active',
            createdAt TEXT 
          );

          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY NOT NULL,
            conversationId TEXT NOT NULL,
            senderId TEXT NOT NULL,
            content TEXT,
            attachmentUrl TEXT,
            isRead INTEGER DEFAULT 0,
             isSyncedToServer INTEGER DEFAULT 0,
            createdAt TEXT
          );
        `);
      }); // Fixed: Closed transaction correctly

      // Ensure translation columns exist for existing installations too.
      await ensureColumnExists(database, 'categories', 'namePs', 'TEXT');
      await ensureColumnExists(database, 'categories', 'nameFa', 'TEXT');
      await ensureColumnExists(database, 'categories', 'descriptionPs', 'TEXT');
      await ensureColumnExists(database, 'categories', 'descriptionFa', 'TEXT');

      await ensureColumnExists(database, 'products', 'namePs', 'TEXT');
      await ensureColumnExists(database, 'products', 'nameFa', 'TEXT');
      await ensureColumnExists(database, 'products', 'descriptionPs', 'TEXT');
      await ensureColumnExists(database, 'products', 'descriptionFa', 'TEXT');
      await ensureColumnExists(database, 'products', 'usageInstructions', 'TEXT');
      await ensureColumnExists(database, 'products', 'usageInstructionsPs', 'TEXT');
      await ensureColumnExists(database, 'products', 'usageInstructionsFa', 'TEXT');
      await ensureColumnExists(database, 'products', 'availableSizes', 'TEXT');
      await ensureColumnExists(database, 'products', 'availableColorsPs', 'TEXT');
      await ensureColumnExists(database, 'products', 'availableColorsFa', 'TEXT');
      await ensureColumnExists(database, 'products', 'stockQuantity', 'INTEGER');
      await ensureColumnExists(database, 'products', 'isAvailable', 'INTEGER');
      await ensureColumnExists(database, 'products', 'profitPercentage', 'REAL');

      isInitialized = true;
      console.log("✅ Offline Tables Initialized and Ready");
    } catch (error) {
      console.error("❌ Offline DB Init Error:", error);
      initPromise = null; 
      throw error;
    }
  })(); // Fixed: Properly closed and invoked the async IIFE

  return initPromise;
}

export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// WRAPPER: Every data function MUST call this to ensure tables exist
async function ensureInit() {
  if (!isInitialized) {
    await initOfflineDb();
  }
  return await getDatabase();
}

export const addExpense = async (amount: number, description: string, category: string) => {
  const database = await ensureInit(); // Wait for tables!
  await database.runAsync(
    'INSERT INTO expenses (id, amount, description, category) VALUES (?, ?, ?, ?)',
    [Date.now().toString(), amount, description, category]
  );
};

export const getExpenses = async () => {
  const database = await ensureInit(); // Wait for tables!
  return await database.getAllAsync('SELECT * FROM expenses ORDER BY createdAt DESC');
};

// ... keep your other functions like syncCategories but wrap with ensureInit()

export async function saveAppSettings(settings: any) {
  const database = await ensureInit();
  // Ensure we are using the correct data types for SQLite (Numeric as Strings/Reals)
  await database.runAsync(
    `INSERT OR REPLACE INTO app_settings 
    (id, usdToAfnRate, newUserDiscountActive, newUserDiscountType, newUserDiscountValue, discountDurationHours) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'app-settings', 
      (settings.usdToAfnRate ?? 65).toString(),
      settings.newUserDiscountActive ? 1 : 0,
      settings.newUserDiscountType || 'percentage',
      (settings.newUserDiscountValue || 0).toString(),
      settings.discountDurationHours ?? 24
    ]
  );
  console.log("⚙️ Local Settings Updated");
}


export async function saveCategories(categories: any[]) {
  const database = await ensureInit();
  await database.withTransactionAsync(async () => {
    // Upsert categories individually to avoid destructive deletes
    for (const cat of categories) {
      await database.runAsync(
        `INSERT OR REPLACE INTO categories (id, name, namePs, nameFa, description, descriptionPs, descriptionFa, imageUrl, parentId, isActive) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cat.id,
          cat.name,
          cat.namePs || null,
          cat.nameFa || null,
          cat.description || null,
          cat.descriptionPs || null,
          cat.descriptionFa || null,
          cat.imageUrl || null,
          cat.parentId || null,
          cat.isActive ? 1 : 0
        ]
      );
    }
  });
}

export async function syncCategories() {
  try {
    const online = await isOnline();
    if (!online) return null;

    const response = await fetch(`${API_URL}/api/admin/categories`);
    const remoteData = await response.json();

    if (Array.isArray(remoteData)) {
      await saveCategories(remoteData);
      console.log(`✅ Synced ${remoteData.length} categories`);
      return remoteData; // Return the array so caller can 'setCategories(remoteData)'
    }
    return [];
  } catch (error) {
    console.error("❌ syncCategories failed:", error);
    return null;
  }
}



/**
 * Saves a single message to the local SQLite database.
 * Used for instant UI feedback (Offline First) and incoming Socket messages.
 */
export async function addLocalMessage(message: any) {
  const database = await getDatabase();
  if (!database) return null;

  const safeConvId = message.conversationId || 'unknown_chat';
  const timestamp = message.createdAt || new Date().toISOString();

  try {
    await database.runAsync(
      `INSERT OR REPLACE INTO messages
       (id, conversationId, senderId, content, attachmentUrl, isRead, isSyncedToServer, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        message.id || `msg_${Date.now()}`,
        safeConvId,
        message.senderId,
        message.content || '',
        message.attachmentUrl || null,
        message.isRead ? 1 : 0,
        message.isSyncedToServer ? 1 : 0,
        timestamp
      ]
    );
    return message.id;
  } catch (error) {
    console.error("❌ SQLite Message Error:", error);
    throw error;
  }
}

export async function loadMessages(conversationId: string) {
  const database = await getDatabase();
  if (!database) return [];
  // Use strftime or simple string sort for ISO dates
  return await database.getAllAsync(
    'SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC',
    [conversationId]
  );
}


/**
 * Loads all messages for a specific conversation from the local database.
 * Returns an array of message objects.
*/

export async function loadMyOrdersLocal(userId: string) {
  const database = await getDatabase();
  if (!database) return [];
  return await database.getAllAsync(
    'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  );
}

export async function saveMyOrders(ordersList: any[]) {
  const database = await getDatabase();
  if (!database || !ordersList.length) return;

  await database.withTransactionAsync(async () => {
    for (const order of ordersList) {
      await database.runAsync(
        `INSERT OR REPLACE INTO orders (id, userId, customerName, totalAmount, status, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [order.id, order.userId, order.customerName, order.totalAmount, order.status, order.createdAt]
      );
    }
  });
}



export async function execSql(sql: string, params: any[] = []): Promise<any[]> {
  const database = await ensureInit();
  if (!database) return [];
  return await database.getAllAsync(sql, params);
}

export async function saveProducts(products: any[], pruneMissing = false) {
  const write = productWriteQueue.then(async () => {
    const database = await ensureInit();
    await database.withTransactionAsync(async () => {
      // Upsert products to avoid wiping local-only rows
      for (const p of products) {
        await database.runAsync(
          `INSERT OR REPLACE INTO products (id, categoryId, name, namePs, nameFa, description, descriptionPs, descriptionFa, usageInstructions, usageInstructionsPs, usageInstructionsFa, usdPrice, profitPercentage, imageUrl, availableSizes, availableColors, availableColorsPs, availableColorsFa, stockQuantity, isAvailable)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.categoryId,
            p.name,
            p.namePs || null,
            p.nameFa || null,
            p.description || null,
            p.descriptionPs || null,
            p.descriptionFa || null,
            p.usageInstructions || null,
            p.usageInstructionsPs || null,
            p.usageInstructionsFa || null,
            p.usdPrice?.toString() || '0',
            p.profitPercentage ?? 20,
            p.imageUrl || null,
            p.availableSizes != null ? JSON.stringify(p.availableSizes) : null,
            JSON.stringify(p.availableColors || []),
            JSON.stringify(p.availableColorsPs || []),
            JSON.stringify(p.availableColorsFa || []),
            typeof p.stockQuantity === 'number' ? p.stockQuantity : 0,
            p.isAvailable ? 1 : 0
          ]
        );
      }

      if (pruneMissing) {
        const productIds = products.map((item) => item.id).filter(Boolean);
        if (productIds.length > 0) {
          const placeholders = productIds.map(() => '?').join(', ');
          await database.runAsync(
            `DELETE FROM products WHERE id NOT IN (${placeholders});`,
            productIds
          );
        } else {
          await database.execAsync('DELETE FROM products;');
        }
      }
    });
  });

  productWriteQueue = write.catch(() => undefined);
  await write;
  console.log("📦 Fresh Product Catalog saved to SQLite");
}



export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    const connected = !!state.isConnected && (state.isInternetReachable ?? true);
    
    if (!connected) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  } catch (error) {
    return false;
  }
}

export async function fetchRemoteCategories() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    console.log('📡 Fetching remote categories...');
    const response = await fetch(`${API_URL}/api/categories`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch remote categories: ${response.status}`);
    }
    const data = await response.json();
    console.log(`✅ Fetched ${data.length} categories from server`);
    return data;
  } catch (error) {
    console.warn('❌ Remote categories fetch failed', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}image-cache/`;

async function fetchRemoteProducts(limit: number = 20, page: number = 1, categoryId?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log('📡 Fetching remote products...', { limit, page, categoryId });
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (page) params.append('page', String(page));
    if (categoryId) params.append('categoryId', String(categoryId));

    const url = `${API_URL}/api/products${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    return data as any[];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('❌ Remote products fetch timed out', { categoryId, limit, page });
    } else {
      console.warn('❌ Remote products fetch failed', error);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRemoteProduct(id: string) {
  try {
    const response = await fetch(`${API_URL}/api/products/${id}`);
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    console.warn('Remote product fetch failed', error);
    return null;
  }
}

function safeFileName(url: string) {
  const sanitized = url.replace(/[^a-zA-Z0-9]/g, '_');
  return sanitized.length > 200 ? `${sanitized.slice(0, 200)}_${url.length}` : sanitized;
}

// Utility to ensure directory exists
async function ensureImageCacheDir() {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
}

export async function getCachedImageUri(remoteUrl: string | undefined, fallbackUri = 'https://placehold.co/220?text=No+Image') {
  if (!remoteUrl || typeof remoteUrl !== 'string') return fallbackUri;

  try {
    await ensureImageCacheDir();
    const fileName = `${safeFileName(remoteUrl)}.jpg`;
    const localPath = `${IMAGE_CACHE_DIR}${fileName}`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    if (fileInfo.exists) return localPath;

    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);
    return downloadResult.uri;
  } catch (error) {
    console.warn('Image cache failed, using remote', error);
    return remoteUrl;
  }
}
// 🎯 HIGH-PRECISION LINEAR OFFLINE DATA SYNC PIPELINE
// 🎯 HIGH-PRECISION LINEAR OFFLINE DATA SYNC TUNNEL PIPELINE (SCHEMA LOCKED)
export const syncRemoteCatalog = async () => {
  try {
    await initOfflineDb();
    console.log("🛰️ [SYNC TUNNEL] Ingesting multi-lingual cloud datasets linearly...");

    const [catsRes, prodsRes, settingsRes] = await Promise.all([
      fetch(`${API_URL}/api/categories`),
      fetch(`${API_URL}/api/products`),
      fetch(`${API_URL}/api/admin/settings`)
    ]);

    if (!catsRes.ok || !prodsRes.ok) {
      console.warn('⚠️ Remote catalog sync skipped because one or more endpoints failed', {
        categories: catsRes.status,
        products: prodsRes.status,
      });
      return false;
    }

    const catsList = await catsRes.json();
    const prodsList = await prodsRes.json();
    const settingsData = settingsRes.ok ? await settingsRes.json() : null;

    // Upsert remote lists into local DB and remove stale products that are no longer on the server
    await saveCategories(catsList || []);
    await saveProducts(prodsList || [], true);

    if (settingsData) {
      await saveAppSettings(settingsData);
    }

    console.log(`✅ Remote catalog sync completed: ${catsList?.length ?? 0} categories, ${prodsList?.length ?? 0} products`);
    return true;
  } catch (e: any) {
    console.error("❌ Catalog local cache ingestion failed:", e.message || e);
    return false;
  }
};




export async function loadCategoriesLocal() {
  try {
    const data = await execSql('SELECT * FROM categories;');
    // In Legacy, the data is usually in 'rows._array'. 
    // In our new helper, we fixed it to return just the array.
    return data || []; 
  } catch (err) {
    console.error("Local load failed", err);
    return [];
  }
}

export async function loadCategoryLocal(id: string) {
  const online = await isOnline();
  if (online) {
    // Better to fetch specific category than whole list if possible
    const categories = await fetchRemoteCategories();
    const category = categories.find((item: any) => item.id === id) ?? null;
    if (category) {
      await saveCategories([category]);
      return category;
    }
  }

  const result = await execSql('SELECT * FROM categories WHERE id = ? LIMIT 1;', [id]);
  return result[0] ?? null;
}

export async function loadProductsLocal() {
  try {
    const local = await execSql('SELECT * FROM products;');
    return (local || []) as any[];
  } catch (err) {
    console.error('loadProductsLocal error', err);
    return [];
  }
}

export async function fetchAndSyncProducts(limit: number = 20, page: number = 1, categoryId?: string) {
  try {
    await initOfflineDb();
    const online = await isOnline();
    if (!online) return [];
    const prods = await fetchRemoteProducts(limit, page, categoryId);
    if (prods && prods.length > 0) {
      if (!categoryId) {
        await saveProducts(prods);
      } else {
        await databaseOpSaveCategoryProducts(prods);
      }
    }
    return prods;
  } catch (e) {
    console.warn('fetchAndSyncProducts failed', e);
    return [];
  }
}

async function databaseOpSaveCategoryProducts(products: any[]) {
  const database = await ensureInit();
  if (!database) return;
  await database.withTransactionAsync(async () => {
    for (const p of products) {
      await database.runAsync(
          `INSERT OR REPLACE INTO products (id, categoryId, name, namePs, nameFa, description, descriptionPs, descriptionFa, usageInstructions, usageInstructionsPs, usageInstructionsFa, usdPrice, profitPercentage, imageUrl, availableSizes, availableColors, availableColorsPs, availableColorsFa, stockQuantity, isAvailable)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.categoryId,
          p.name,
          p.namePs || null,
          p.nameFa || null,
          p.description || null,
          p.descriptionPs || null,
          p.descriptionFa || null,
            p.usageInstructions || null,
            p.usageInstructionsPs || null,
            p.usageInstructionsFa || null,
          p.usdPrice?.toString() || '0',
          p.profitPercentage ?? 20,
          p.imageUrl || null,
          p.availableSizes != null ? JSON.stringify(p.availableSizes) : null,
          JSON.stringify(p.availableColors || []),
          JSON.stringify(p.availableColorsPs || []),
          JSON.stringify(p.availableColorsFa || []),
          typeof p.stockQuantity === 'number' ? p.stockQuantity : 0,
          p.isAvailable ? 1 : 0
        ]
      );
    }
  });
}



// Add this at the top if not already defined for the message/convo functions
function randomId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function loadProductsByCategoryLocal(categoryId: string) {
  const database = await ensureInit();
  if (!database) return [];

  return await database.getAllAsync(
    'SELECT * FROM products WHERE categoryId = ?',
    [categoryId]
  );
}


  // Modern API: result is the array itself
 

export async function loadProductLocal(id: string) {
  await initOfflineDb();
  const online = await isOnline();
  if (online) {
    const product = await fetchRemoteProduct(id);
    if (product) {
      await saveProducts([product]);
      return product;
    }
  }

  const result = await execSql('SELECT * FROM products WHERE id = ? LIMIT 1;', [id]);
  return (result as any[])[0] ?? null;
}


export async function getOrCreateConversation(userId: string) {
  const database = await getDatabase();
  const safeUserId = userId || 'offline-user';
  
  // 1. Check local SQLite first
  const existing = await database.getAllAsync(
    'SELECT * FROM conversations WHERE userId = ? LIMIT 1', 
    [safeUserId]
  );
  
  let conversation;
  if (existing && existing.length > 0) {
    conversation = existing[0];
  } else {
    // 2. Create new locally using a VALID UUID
    let id: string;
    try {
      // Prefer native crypto UUID when available
      id = (Crypto && (Crypto as any).randomUUID) ? (Crypto as any).randomUUID() : randomId();
    } catch (e) {
      id = randomId();
    }
    const newConv = { 
      id, 
      userId: safeUserId, 
      status: 'active', 
      createdAt: new Date().toISOString() 
    };
    
    await database.runAsync(
      'INSERT INTO conversations (id, userId, status, createdAt) VALUES (?, ?, ?, ?)',
      [newConv.id, newConv.userId, newConv.status, newConv.createdAt]
    );
    conversation = newConv;
  }

  // 3. Sync to Server
  const online = await isOnline().catch(() => false);
  if (online) {
    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation),
      });
      
      if (response.ok) {
        console.log("✅ Conversation synced to server with UUID:", conversation.id);
      } else {
        const errText = await response.text();
        console.warn("❌ Server rejected sync:", errText);
      }
    } catch (e) {
      console.warn("Could not sync conversation to server");
    }
  }

  return conversation;
}



export async function loadPendingMessages(conversationId?: string) {
  const query = conversationId
    ? 'SELECT * FROM messages WHERE conversationId = ? AND isSyncedToServer = 0;'
    : 'SELECT * FROM messages WHERE isSyncedToServer = 0;';
  const params = conversationId ? [conversationId] : [];
  
  const result = await execSql(query, params);
  return result as any[];
}

export async function markMessageSynced(messageId: string) {
  await execSql('UPDATE messages SET isSyncedToServer = 1 WHERE id = ?;', [messageId]);
}


export async function saveRemoteMessages(messages: any[]) {
  if (!messages?.length) return;
  const database = getDatabase();
  if (!database) return;

  return new Promise((resolve, reject) => {
    database.transaction(
      (tx: any) => {
        for (const message of messages) {
          tx.executeSql(
            `INSERT OR REPLACE INTO messages (id, conversationId, content, isSyncedToServer)
             VALUES (?, ?, ?, ?);`,
            [message.id, message.conversationId, message.content, 1]
          );
        }
      },
      (err: any) => reject(err),
      () => resolve(true)
    );
  });
}

// Fixed: result is a direct array in modern expo-sqlite
export async function loadSubcategoriesLocal(parentId: string) {
  console.log(`📴 Loading subcategories for parent: ${parentId}`);
  const result = await execSql(
    'SELECT * FROM categories WHERE parentId = ?;',
    [parentId]
  );
  return result as any[]; 
}

async function createOrFetchRemoteConversation(conversation: any, userId: string) {
  try {
    const body = {
      id: conversation.id,
      userId,
      adminId: conversation.adminId,
      status: conversation.status,
    };

    const response = await fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error('Failed to create/fetch conversation');

    return await response.json();
  } catch (error) {
    console.warn('Remote conversation sync failed', error);
    return conversation;
  }
}

export async function syncMessagesForConversation(conversation: any, userId: string) {
  const online = await isOnline();
  if (!online || !conversation?.id) return;

  try {
    const remoteConversation = await createOrFetchRemoteConversation(conversation, userId);
    
    // Fetch and save fresh messages from server
    const response = await fetch(`${API_URL}/api/conversations/${remoteConversation.id}/messages`);
    const remoteMessages = (await response.json()) || [];
    await saveRemoteMessages(remoteMessages);

    // Sync any messages the user sent while offline
    const pendingMessages = await loadPendingMessages(remoteConversation.id);
    for (const pending of pendingMessages) {
      try {
        const sendResponse = await fetch(`${API_URL}/api/conversations/${remoteConversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: pending.senderId,
            content: pending.content,
            attachmentUrl: pending.attachmentUrl,
            createdAt: pending.createdAt,
          }),
        });

        if (sendResponse.ok) {
          await markMessageSynced(pending.id);
        }
      } catch (sendError) {
        console.warn('Message send failed, will retry later', sendError);
      }
    }
  } catch (error) {
    console.warn('Failed to sync messages', error);
  }
}

export async function syncAll(userId?: string, conversation?: any) {
  const online = await isOnline();
  if (!online) {
    console.log("📴 Offline: Skipping background sync");
    return;
  }
  
  // Run these in parallel to save time
  await Promise.all([
    syncRemoteCatalog(),
    conversation ? syncMessagesForConversation(conversation, userId || 'offline-user') : Promise.resolve()
  ]);
  
  console.log("✅ Full background sync complete");
}
