
import * as SQLite from 'expo-sqlite';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { API_URL } from './config';

const DATABASE_NAME = 'ecommerce-offline.db';
const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}image-cache/`;
const FALLBACK_IMAGE = 'https://placehold.co/220?text=No+Image';

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * All writes go through one queue.
 *
 * This prevents category, product, message, and settings writes from
 * accidentally overlapping transactions on the same SQLite connection.
 */
let databaseWriteQueue: Promise<void> = Promise.resolve();

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = databaseWriteQueue.then(operation);

  databaseWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

function apiUrl(path: string): string {
  return `${API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
}

function asJson(value: unknown, fallback: unknown = []): string {
  return JSON.stringify(value ?? fallback);
}

function toNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBooleanInteger(value: unknown, defaultValue = true): number {
  if (value === undefined || value === null) {
    return defaultValue ? 1 : 0;
  }

  return value === false || value === 0 ? 0 : 1;
}

function randomId(): string {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createId(): string {
  try {
    const cryptoModule = Crypto as typeof Crypto & {
      randomUUID?: () => string;
    };

    if (typeof cryptoModule.randomUUID === 'function') {
      return cryptoModule.randomUUID();
    }
  } catch {
    // Fall back to a locally generated identifier.
  }

  return randomId();
}

function extractArray(
  data: unknown,
  possibleKeys: string[] = [],
): any[] | null {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;

  for (const key of possibleKeys) {
    if (Array.isArray(record[key])) {
      return record[key] as any[];
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// DATABASE INITIALIZATION
// -----------------------------------------------------------------------------

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return db;
}

async function ensureColumnExists(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  // These identifiers are fixed internally by this module, not user input.
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table});`,
  );

  if (!columns.some((item) => item.name === column)) {
    await database.execAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${type};`,
    );
  }
}

export async function initOfflineDb(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const database = await getDatabase();

    try {
      await database.execAsync('PRAGMA journal_mode = WAL;');

      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.execAsync(`
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
            usageInstructions TEXT,
            usageInstructionsPs TEXT,
            usageInstructionsFa TEXT,
            usdPrice REAL NOT NULL DEFAULT 0,
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
      });

      // Migrate existing installations without deleting existing data.
      const migrations: Array<[string, string, string]> = [
        ['categories', 'namePs', 'TEXT'],
        ['categories', 'nameFa', 'TEXT'],
        ['categories', 'descriptionPs', 'TEXT'],
        ['categories', 'descriptionFa', 'TEXT'],
        ['categories', 'usageInstructions', 'TEXT'],
        ['categories', 'usageInstructionsPs', 'TEXT'],
        ['categories', 'usageInstructionsFa', 'TEXT'],
        ['categories', 'imageUrl', 'TEXT'],
        ['categories', 'parentId', 'TEXT'],
        ['categories', 'isActive', 'INTEGER DEFAULT 1'],

        ['products', 'categoryId', 'TEXT'],
        ['products', 'namePs', 'TEXT'],
        ['products', 'nameFa', 'TEXT'],
        ['products', 'description', 'TEXT'],
        ['products', 'descriptionPs', 'TEXT'],
        ['products', 'descriptionFa', 'TEXT'],
        ['products', 'usageInstructions', 'TEXT'],
        ['products', 'usageInstructionsPs', 'TEXT'],
        ['products', 'usageInstructionsFa', 'TEXT'],
        ['products', 'usdPrice', 'REAL NOT NULL DEFAULT 0'],
        ['products', 'profitPercentage', 'REAL DEFAULT 20.0'],
        ['products', 'imageUrl', 'TEXT'],
        ['products', 'availableSizes', 'TEXT'],
        ['products', 'availableColors', 'TEXT'],
        ['products', 'availableColorsPs', 'TEXT'],
        ['products', 'availableColorsFa', 'TEXT'],
        ['products', 'stockQuantity', 'INTEGER DEFAULT 0'],
        ['products', 'isAvailable', 'INTEGER DEFAULT 1'],

        ['messages', 'attachmentUrl', 'TEXT'],
        ['messages', 'isRead', 'INTEGER DEFAULT 0'],
        ['messages', 'isSyncedToServer', 'INTEGER DEFAULT 0'],
        ['messages', 'createdAt', 'TEXT'],
      ];

      for (const [table, column, type] of migrations) {
        await ensureColumnExists(database, table, column, type);
      }

      isInitialized = true;
      console.log('✅ Offline database initialized');
    } catch (error) {
      console.error('❌ Offline database initialization failed:', error);
      throw error;
    }
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

async function ensureInit(): Promise<SQLite.SQLiteDatabase> {
  if (!isInitialized) {
    await initOfflineDb();
  }

  return getDatabase();
}

// -----------------------------------------------------------------------------
// GENERAL HELPERS
// -----------------------------------------------------------------------------

export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

// -----------------------------------------------------------------------------
// APP SETTINGS
// -----------------------------------------------------------------------------

export async function saveAppSettings(settings: any): Promise<void> {
  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.runAsync(
      `INSERT OR REPLACE INTO app_settings
       (id, usdToAfnRate, newUserDiscountActive, newUserDiscountType,
        newUserDiscountValue, discountDurationHours)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        'app-settings',
        toNumber(settings?.usdToAfnRate, 65),
        toBooleanInteger(settings?.newUserDiscountActive, false),
        settings?.newUserDiscountType ?? 'percentage',
        toNumber(settings?.newUserDiscountValue, 0),
        toNumber(settings?.discountDurationHours, 24),
      ],
    );
  });

  console.log('⚙️ Local settings updated');
}

// -----------------------------------------------------------------------------
// EXPENSES
// -----------------------------------------------------------------------------

export async function addExpense(
  amount: number,
  description: string,
  category: string,
): Promise<void> {
  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.runAsync(
      'INSERT INTO expenses (id, amount, description, category) VALUES (?, ?, ?, ?);',
      [createId(), amount, description, category],
    );
  });
}

export async function getExpenses(): Promise<any[]> {
  const database = await ensureInit();

  return database.getAllAsync(
    'SELECT * FROM expenses ORDER BY createdAt DESC;',
  );
}

// -----------------------------------------------------------------------------
// CATEGORIES
// -----------------------------------------------------------------------------

export async function saveCategories(categories: any[]): Promise<void> {
  if (!Array.isArray(categories)) {
    throw new Error('saveCategories expected an array');
  }

  if (categories.length === 0) {
    return;
  }

  const validCategories = categories.filter(
    (category) =>
      category &&
      category.id !== undefined &&
      category.id !== null &&
      category.name !== undefined &&
      category.name !== null,
  );

  if (validCategories.length === 0) {
    throw new Error('No valid categories received; local categories preserved');
  }

  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.withTransactionAsync(async () => {
      for (const category of validCategories) {
        await database.runAsync(
          `INSERT OR REPLACE INTO categories
           (id, name, namePs, nameFa, description, descriptionPs, descriptionFa,
            usageInstructions, usageInstructionsPs, usageInstructionsFa,
            imageUrl, parentId, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            String(category.id),
            String(category.name),
            asNullableString(category.namePs),
            asNullableString(category.nameFa),
            asNullableString(category.description),
            asNullableString(category.descriptionPs),
            asNullableString(category.descriptionFa),
            asNullableString(category.usageInstructions),
            asNullableString(category.usageInstructionsPs),
            asNullableString(category.usageInstructionsFa),
            asNullableString(category.imageUrl),
            asNullableString(category.parentId),
            toBooleanInteger(category.isActive, true),
          ],
        );
      }
    });
  });
}

export async function syncCategories(): Promise<any[] | null> {
  try {
    if (!(await isOnline())) {
      return null;
    }

    const categories = await fetchRemoteCategories();

    if (categories.length === 0) {
      // An empty result is not sufficient evidence that the server's
      // category catalog is genuinely empty.
      return [];
    }

    await saveCategories(categories);

    console.log(`✅ Synced ${categories.length} categories`);
    return categories;
  } catch (error) {
    console.error('❌ Category sync failed:', error);
    return null;
  }
}

export async function loadCategoriesLocal(): Promise<any[]> {
  try {
    return await execSql('SELECT * FROM categories;');
  } catch (error) {
    console.error('Local category load failed:', error);
    return [];
  }
}

export async function loadCategoryLocal(id: string): Promise<any | null> {
  try {
    const database = await ensureInit();

    if (await isOnline()) {
      const categories = await fetchRemoteCategories();
      const category = categories.find((item) => String(item.id) === String(id));

      if (category) {
        await saveCategories([category]);
        return category;
      }
    }

    const result = await database.getAllAsync(
      'SELECT * FROM categories WHERE id = ? LIMIT 1;',
      [id],
    );

    return result[0] ?? null;
  } catch (error) {
    console.warn('Could not load category:', error);
    const result = await execSql(
      'SELECT * FROM categories WHERE id = ? LIMIT 1;',
      [id],
    );

    return result[0] ?? null;
  }
}

export async function loadSubcategoriesLocal(parentId: string): Promise<any[]> {
  return execSql(
    'SELECT * FROM categories WHERE parentId = ?;',
    [parentId],
  );
}

// -----------------------------------------------------------------------------
// PRODUCTS
// -----------------------------------------------------------------------------

function validateProducts(products: any[]): any[] {
  if (!Array.isArray(products)) {
    throw new Error('Product response is not an array');
  }

  const invalidProduct = products.find(
    (product) =>
      !product ||
      product.id === undefined ||
      product.id === null ||
      product.name === undefined ||
      product.name === null,
  );

  if (invalidProduct) {
    throw new Error(
      'Invalid product received: a product is missing its ID or name',
    );
  }

  return products;
}

async function writeProducts(
  database: SQLite.SQLiteDatabase,
  products: any[],
): Promise<void> {
  for (const product of products) {
    await database.runAsync(
      `INSERT OR REPLACE INTO products
       (id, categoryId, name, namePs, nameFa, description, descriptionPs,
        descriptionFa, usageInstructions, usageInstructionsPs,
        usageInstructionsFa, usdPrice, profitPercentage, imageUrl,
        availableSizes, availableColors, availableColorsPs, availableColorsFa,
        stockQuantity, isAvailable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        String(product.id),
        asNullableString(product.categoryId),
        String(product.name),
        asNullableString(product.namePs),
        asNullableString(product.nameFa),
        asNullableString(product.description),
        asNullableString(product.descriptionPs),
        asNullableString(product.descriptionFa),
        asNullableString(product.usageInstructions),
        asNullableString(product.usageInstructionsPs),
        asNullableString(product.usageInstructionsFa),
        toNumber(product.usdPrice, 0),
        toNumber(product.profitPercentage, 20),
        asNullableString(product.imageUrl),
        product.availableSizes == null
          ? null
          : asJson(product.availableSizes, []),
        asJson(product.availableColors, []),
        asJson(product.availableColorsPs, []),
        asJson(product.availableColorsFa, []),
        toNumber(product.stockQuantity, 0),
        toBooleanInteger(product.isAvailable, true),
      ],
    );
  }
}

/**
 * Saves products without deleting unrelated or previously cached products.
 *
 * pruneMissing is retained for compatibility. Deletion is only considered
 * when the caller explicitly enables it and a non-empty, valid list arrives.
 */
export async function saveProducts(
  products: any[],
  pruneMissing = false,
): Promise<void> {
  const validProducts = validateProducts(products);

  // Never interpret an empty response as permission to wipe the cache.
  if (validProducts.length === 0) {
    console.warn('⚠️ Empty product list; existing product cache preserved');
    return;
  }

  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.withTransactionAsync(async () => {
      await writeProducts(database, validProducts);

      if (pruneMissing) {
        const productIds = [
          ...new Set(validProducts.map((product) => String(product.id))),
        ];

        const placeholders = productIds.map(() => '?').join(', ');

        await database.runAsync(
          `DELETE FROM products WHERE id NOT IN (${placeholders});`,
          productIds,
        );
      }
    });
  });

  console.log(`📦 Saved ${validProducts.length} products to SQLite`);
}

async function fetchRemoteProducts(
  limit = 20,
  page = 1,
  categoryId?: string,
): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const params = new URLSearchParams();

    if (limit > 0) params.set('limit', String(limit));
    if (page > 0) params.set('page', String(page));
    if (categoryId) params.set('categoryId', String(categoryId));

    const query = params.toString();
    const url = `${apiUrl('/api/products')}${query ? `?${query}` : ''}`;

    console.log('📡 Fetching products:', { limit, page, categoryId });

    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Product request failed: HTTP ${response.status}`);
    }

    const responseData: unknown = await response.json();
    const products = extractArray(responseData, ['products', 'data', 'items']);

    if (!products) {
      throw new Error('The product endpoint returned an unexpected response');
    }

    validateProducts(products);
    return products;
  } catch (error) {
    console.warn('❌ Remote product fetch failed:', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRemoteProduct(id: string): Promise<any | null> {
  try {
    const response = await fetch(
      apiUrl(`/api/products/${encodeURIComponent(id)}`),
    );

    if (!response.ok) {
      throw new Error(`Product request failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const product = data?.product ?? data?.data ?? data;

    if (
      !product ||
      typeof product !== 'object' ||
      product.id == null ||
      product.name == null
    ) {
      throw new Error('The product endpoint returned an invalid product');
    }

    return product;
  } catch (error) {
    console.warn('Remote product fetch failed:', error);
    return null;
  }
}

export async function fetchAndSyncProducts(
  limit = 20,
  page = 1,
  categoryId?: string,
): Promise<any[]> {
  try {
    await ensureInit();

    if (!(await isOnline())) {
      return [];
    }

    const products = await fetchRemoteProducts(limit, page, categoryId);

    if (products.length === 0) {
      // Could be a genuinely empty page or a failed request. Either way,
      // do not modify the cached catalog.
      return [];
    }

    await saveProducts(products);
    return products;
  } catch (error) {
    console.warn('fetchAndSyncProducts failed:', error);
    return [];
  }
}

export async function loadProductsLocal(limit?: number): Promise<any[]> {
  try {
    const database = await ensureInit();

    if (
      typeof limit === 'number' &&
      Number.isSafeInteger(limit) &&
      limit > 0
    ) {
      return await database.getAllAsync(
        'SELECT * FROM products LIMIT ?;',
        [limit],
      );
    }

    return await database.getAllAsync('SELECT * FROM products;');
  } catch (error) {
    console.error('Local product load failed:', error);
    return [];
  }
}

export async function loadProductsByCategoryLocal(
  categoryId: string,
): Promise<any[]> {
  const database = await ensureInit();

  return database.getAllAsync(
    'SELECT * FROM products WHERE categoryId = ?;',
    [categoryId],
  );
}

export async function loadProductLocal(id: string): Promise<any | null> {
  const database = await ensureInit();

  if (await isOnline()) {
    const product = await fetchRemoteProduct(id);

    if (product) {
      try {
        await saveProducts([product]);
      } catch (error) {
        console.warn('Could not cache remote product:', error);
      }

      return product;
    }
  }

  const result = await database.getAllAsync(
    'SELECT * FROM products WHERE id = ? LIMIT 1;',
    [id],
  );

  return result[0] ?? null;
}

// -----------------------------------------------------------------------------
// NETWORK STATUS AND REMOTE CATEGORIES
// -----------------------------------------------------------------------------

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    const connected =
      !!state.isConnected && (state.isInternetReachable ?? true);

    if (!connected) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(apiUrl('/api/categories'), {
        signal: controller.signal,
      });

      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return false;
  }
}

export async function fetchRemoteCategories(): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    console.log('📡 Fetching remote categories...');

    const response = await fetch(apiUrl('/api/categories'), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Category request failed: HTTP ${response.status}`);
    }

    const responseData: unknown = await response.json();
    const categories = extractArray(responseData, [
      'categories',
      'data',
      'items',
    ]);

    if (!categories) {
      throw new Error('The category endpoint returned an unexpected response');
    }

    console.log(`✅ Fetched ${categories.length} categories`);
    return categories;
  } catch (error) {
    console.warn('❌ Remote category fetch failed:', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// -----------------------------------------------------------------------------
// REMOTE CATALOG SYNC
// -----------------------------------------------------------------------------

export async function syncRemoteCatalog(): Promise<boolean> {
  try {
    await ensureInit();

    if (!(await isOnline())) {
      console.log('📴 Offline; keeping the existing catalog');
      return false;
    }

    console.log('🛰️ Starting remote catalog sync...');

    const [categoriesResponse, productsResponse, settingsResponse] =
      await Promise.all([
        fetch(apiUrl('/api/categories')),
        fetch(apiUrl('/api/products')),
        fetch(apiUrl('/api/admin/settings')),
      ]);

    if (!categoriesResponse.ok || !productsResponse.ok) {
      console.warn('⚠️ Catalog sync skipped because a request failed', {
        categoriesStatus: categoriesResponse.status,
        productsStatus: productsResponse.status,
      });

      return false;
    }

    const [categoriesData, productsData] = await Promise.all([
      categoriesResponse.json(),
      productsResponse.json(),
    ]);

    const categories = extractArray(categoriesData, [
      'categories',
      'data',
      'items',
    ]);

    const products = extractArray(productsData, [
      'products',
      'data',
      'items',
    ]);

    // Validate both responses before modifying the local database.
    if (!categories || !products) {
      console.warn('⚠️ Invalid catalog response; existing cache preserved');
      return false;
    }

    validateProducts(products);

    let settings: any = null;

    if (settingsResponse.ok) {
      try {
        settings = await settingsResponse.json();
      } catch (error) {
        console.warn('Settings response could not be parsed:', error);
      }
    }

    if (categories.length > 0) {
      await saveCategories(categories);
    }

    if (products.length > 0) {
      // The endpoint must return the complete catalog for pruning to be safe.
      // This retains the old intended behavior for a non-empty full catalog.
      await saveProducts(products, true);
    } else {
      console.warn(
        '⚠️ Server returned zero products; existing product cache preserved',
      );
    }

    if (settings && typeof settings === 'object') {
      await saveAppSettings(settings);
    }

    console.log(
      `✅ Catalog sync completed: ${categories.length} categories, ${products.length} products`,
    );

    return true;
  } catch (error) {
    console.error('❌ Catalog sync failed:', error);
    return false;
  }
}

// -----------------------------------------------------------------------------
// GENERIC SQLITE ACCESS
// -----------------------------------------------------------------------------

export async function execSql(
  sql: string,
  params: any[] = [],
): Promise<any[]> {
  const database = await ensureInit();
  return database.getAllAsync(sql, params);
}

// -----------------------------------------------------------------------------
// MESSAGES
// -----------------------------------------------------------------------------

export async function addLocalMessage(message: any): Promise<string> {
  const database = await ensureInit();

  const id = String(message?.id ?? `msg_${createId()}`);
  const conversationId = String(message?.conversationId ?? 'unknown_chat');
  const senderId = String(message?.senderId ?? 'unknown');
  const createdAt = String(
    message?.createdAt ?? new Date().toISOString(),
  );

  await serializeWrite(async () => {
    await database.runAsync(
      `INSERT OR REPLACE INTO messages
       (id, conversationId, senderId, content, attachmentUrl,
        isRead, isSyncedToServer, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        conversationId,
        senderId,
        message?.content ?? '',
        asNullableString(message?.attachmentUrl),
        toBooleanInteger(message?.isRead, false),
        toBooleanInteger(message?.isSyncedToServer, false),
        createdAt,
      ],
    );
  });

  return id;
}

export async function loadMessages(conversationId: string): Promise<any[]> {
  const database = await ensureInit();

  return database.getAllAsync(
    'SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC;',
    [conversationId],
  );
}

export async function loadPendingMessages(
  conversationId?: string,
): Promise<any[]> {
  if (conversationId) {
    return execSql(
      `SELECT * FROM messages
       WHERE conversationId = ? AND isSyncedToServer = 0;`,
      [conversationId],
    );
  }

  return execSql('SELECT * FROM messages WHERE isSyncedToServer = 0;');
}

export async function markMessageSynced(messageId: string): Promise<void> {
  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.runAsync(
      'UPDATE messages SET isSyncedToServer = 1 WHERE id = ?;',
      [messageId],
    );
  });
}

/**
 * Uses the modern expo-sqlite API.
 * The old callback-based database.transaction API is deliberately removed.
 */
export async function saveRemoteMessages(messages: any[]): Promise<void> {
  if (!Array.isArray(messages)) {
    throw new Error('saveRemoteMessages expected an array');
  }

  if (messages.length === 0) {
    return;
  }

  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.withTransactionAsync(async () => {
      for (const message of messages) {
        if (!message || typeof message !== 'object') {
          continue;
        }

        const id = message.id == null ? null : String(message.id);

        if (!id) {
          console.warn('Skipping remote message without an ID');
          continue;
        }

        await database.runAsync(
          `INSERT OR REPLACE INTO messages
           (id, conversationId, senderId, content, attachmentUrl,
            isRead, isSyncedToServer, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            id,
            String(message.conversationId ?? 'unknown_chat'),
            String(message.senderId ?? 'unknown'),
            message.content ?? '',
            asNullableString(message.attachmentUrl),
            toBooleanInteger(message.isRead, false),
            1,
            String(message.createdAt ?? new Date().toISOString()),
          ],
        );
      }
    });
  });
}

// -----------------------------------------------------------------------------
// CONVERSATIONS
// -----------------------------------------------------------------------------

export async function getOrCreateConversation(
  userId: string,
): Promise<any> {
  const database = await ensureInit();
  const safeUserId = userId || 'offline-user';

  const existing = await database.getAllAsync(
    'SELECT * FROM conversations WHERE userId = ? LIMIT 1;',
    [safeUserId],
  );

  let conversation: any;

  if (existing.length > 0) {
    conversation = existing[0];
  } else {
    conversation = {
      id: createId(),
      userId: safeUserId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await serializeWrite(async () => {
      await database.runAsync(
        `INSERT INTO conversations (id, userId, status, createdAt)
         VALUES (?, ?, ?, ?);`,
        [
          conversation.id,
          conversation.userId,
          conversation.status,
          conversation.createdAt,
        ],
      );
    });
  }

  if (!(await isOnline())) {
    return conversation;
  }

  try {
    const response = await fetch(apiUrl('/api/conversations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation),
    });

    if (!response.ok) {
      console.warn(
        'Conversation sync rejected by server:',
        await response.text(),
      );

      return conversation;
    }

    const remoteConversation = await response.json().catch(() => null);
    const remoteId = remoteConversation?.id;

    if (remoteId && remoteId !== conversation.id) {
      const previousId = conversation.id;

      await serializeWrite(async () => {
        await database.withTransactionAsync(async () => {
          await database.runAsync(
            'UPDATE conversations SET id = ? WHERE id = ?;',
            [remoteId, previousId],
          );

          await database.runAsync(
            'UPDATE messages SET conversationId = ? WHERE conversationId = ?;',
            [remoteId, previousId],
          );
        });
      });
    }

    if (remoteConversation) {
      conversation = { ...conversation, ...remoteConversation };
    }

    return conversation;
  } catch (error) {
    console.warn('Could not sync conversation to server:', error);
    return conversation;
  }
}

async function createOrFetchRemoteConversation(
  conversation: any,
  userId: string,
): Promise<any> {
  try {
    const response = await fetch(apiUrl('/api/conversations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: conversation.id,
        userId,
        adminId: conversation.adminId,
        status: conversation.status,
      }),
    });

    if (!response.ok) {
      throw new Error(`Conversation request failed: HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Remote conversation sync failed:', error);
    return conversation;
  }
}

export async function syncMessagesForConversation(
  conversation: any,
  userId: string,
): Promise<void> {
  if (!conversation?.id || !(await isOnline())) {
    return;
  }

  try {
    const remoteConversation = await createOrFetchRemoteConversation(
      conversation,
      userId,
    );

    if (!remoteConversation?.id) {
      return;
    }

    const messagesResponse = await fetch(
      apiUrl(
        `/api/conversations/${encodeURIComponent(remoteConversation.id)}/messages`,
      ),
    );

    if (messagesResponse.ok) {
      const responseData = await messagesResponse.json();
      const remoteMessages = extractArray(responseData, ['messages', 'data']);

      if (remoteMessages) {
        await saveRemoteMessages(remoteMessages);
      } else {
        console.warn('Unexpected remote messages response; skipped caching');
      }
    }

    const pendingMessages = await loadPendingMessages(remoteConversation.id);

    for (const pending of pendingMessages) {
      try {
        const sendResponse = await fetch(
          apiUrl(
            `/api/conversations/${encodeURIComponent(remoteConversation.id)}/messages`,
          ),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderId: pending.senderId,
              content: pending.content,
              attachmentUrl: pending.attachmentUrl,
              createdAt: pending.createdAt,
            }),
          },
        );

        if (sendResponse.ok) {
          await markMessageSynced(pending.id);
        } else {
          console.warn(
            'Pending message was not accepted:',
            sendResponse.status,
          );
        }
      } catch (error) {
        console.warn('Message send failed; it can be retried later:', error);
      }
    }
  } catch (error) {
    console.warn('Message synchronization failed:', error);
  }
}

// -----------------------------------------------------------------------------
// ORDERS
// -----------------------------------------------------------------------------

export async function loadMyOrdersLocal(userId: string): Promise<any[]> {
  const database = await ensureInit();

  return database.getAllAsync(
    'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC;',
    [userId],
  );
}

export async function saveMyOrders(ordersList: any[]): Promise<void> {
  if (!Array.isArray(ordersList) || ordersList.length === 0) {
    return;
  }

  const database = await ensureInit();

  await serializeWrite(async () => {
    await database.withTransactionAsync(async () => {
      for (const order of ordersList) {
        if (
          !order?.id ||
          order.userId == null ||
          order.customerName == null ||
          order.totalAmount == null
        ) {
          console.warn('Skipping invalid order record');
          continue;
        }

        await database.runAsync(
          `INSERT OR REPLACE INTO orders
           (id, userId, customerName, totalAmount, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            String(order.id),
            String(order.userId),
            String(order.customerName),
            toNumber(order.totalAmount, 0),
            order.status ?? 'pending',
            order.createdAt ?? new Date().toISOString(),
          ],
        );
      }
    });
  });
}

// -----------------------------------------------------------------------------
// IMAGE CACHE
// -----------------------------------------------------------------------------

function safeFileName(url: string): string {
  const sanitized = url.replace(/[^a-zA-Z0-9]/g, '_');

  return sanitized.length > 200
    ? `${sanitized.slice(0, 200)}_${url.length}`
    : sanitized;
}

async function ensureImageCacheDir(): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    throw new Error('FileSystem cache directory is unavailable');
  }

  const info = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, {
      intermediates: true,
    });
  }
}

export async function getCachedImageUri(
  remoteUrl: string | undefined,
  fallbackUri = FALLBACK_IMAGE,
): Promise<string> {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return fallbackUri;
  }

  try {
    await ensureImageCacheDir();

    const localPath = `${IMAGE_CACHE_DIR}${safeFileName(remoteUrl)}.jpg`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    if (fileInfo.exists) {
      return localPath;
    }

    const download = await FileSystem.downloadAsync(remoteUrl, localPath);
    return download.uri;
  } catch (error) {
    console.warn('Image cache failed; using remote URL:', error);
    return remoteUrl || fallbackUri;
  }
}

// -----------------------------------------------------------------------------
// FULL BACKGROUND SYNC
// -----------------------------------------------------------------------------

export async function syncAll(
  userId?: string,
  conversation?: any,
): Promise<void> {
  if (!(await isOnline())) {
    console.log('📴 Offline: skipping background sync');
    return;
  }

  const tasks: Promise<unknown>[] = [syncRemoteCatalog()];

  if (conversation) {
    tasks.push(
      syncMessagesForConversation(conversation, userId || 'offline-user'),
    );
  }

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('A background sync task failed:', result.reason);
    }
  }

  console.log('✅ Background sync tasks finished');
}
