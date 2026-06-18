import admin from "firebase-admin";

let isMockMode = false;
let isOfflineMode = false;
let lastQuotaCheckTime = 0;
const QUOTA_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function enterOfflineMode() {
  if (!isOfflineMode) {
    isOfflineMode = true;
    lastQuotaCheckTime = Date.now();
    console.warn(`⚠️ [Firestore Fallback] Entering offline fallback mode. All subsequent database operations will load instantly from local cache.`);
  }
}

function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("⚠️ Firebase Admin SDK environment variables are not configured. Using dummy/mock credentials and forcing offline mode.");
    isMockMode = true;
    enterOfflineMode();

    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "mock-project-id",
        clientEmail: "mock-client@mock.iam.gserviceaccount.com",
        privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n",
      } as admin.ServiceAccount),
    });
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    } as admin.ServiceAccount),
  });
}

// Lazy singletons — only initialized on first use, not at module load time
let _adminDb: admin.firestore.Firestore | null = null;
let _adminAuth: admin.auth.Auth | null = null;

export function getAdminDb(): admin.firestore.Firestore {
  if (!_adminDb) {
    _adminDb = getAdminApp().firestore();
  }
  return _adminDb;
}

export function getAdminAuth(): admin.auth.Auth {
  if (!_adminAuth) {
    _adminAuth = getAdminApp().auth();
  }
  return _adminAuth;
}

// Backwards-compatible named exports (used throughout the codebase)
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    return (getAdminDb() as any)[prop];
  },
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    return (getAdminAuth() as any)[prop];
  },
});


// ─── FIRESTORE LOCAL FALLBACK ENGINE ──────────────────────────────────────────

let cacheData: Record<string, Record<string, any>> = {};
let cacheLoaded = false;
let lastCacheReadTime = 0;
const CACHE_MIN_READ_INTERVAL_MS = 200;

function loadCacheIfNeeded() {
  const now = Date.now();
  if (cacheLoaded && (now - lastCacheReadTime < CACHE_MIN_READ_INTERVAL_MS)) return;
  const fs = require('fs');
  const path = require('path');
  const cacheDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'tmp');
  const cachePath = path.join(cacheDir, 'local_db_cache.json');
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf8');
      cacheData = JSON.parse(data);
      cacheLoaded = true;
      lastCacheReadTime = now;
      console.log('✅ Loaded Firestore local cache from file.');
    } else {
      // Check if there is a committed local_db_cache.json in process.cwd()/tmp
      const committedCachePath = path.join(process.cwd(), 'tmp', 'local_db_cache.json');
      if (fs.existsSync(committedCachePath)) {
        const data = fs.readFileSync(committedCachePath, 'utf8');
        cacheData = JSON.parse(data);
        // Save it to Vercel's /tmp so subsequent writes can succeed
        fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
        cacheLoaded = true;
        lastCacheReadTime = now;
        console.log('✅ Loaded Firestore local cache from committed local_db_cache.json.');
      } else {
        const seedPath = path.join(process.cwd(), 'seed-data.json');
        if (fs.existsSync(seedPath)) {
          const seedRaw = fs.readFileSync(seedPath, 'utf8');
          const seedObj = JSON.parse(seedRaw);
          cacheData = {};
          for (const colName of Object.keys(seedObj)) {
            cacheData[colName] = {};
            for (const item of seedObj[colName]) {
              const { id, ...payload } = item;
              cacheData[colName][id] = payload;
            }
          }
          fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
          cacheLoaded = true;
          console.log('✅ Initialized Firestore local cache from seed-data.json.');
        } else {
          cacheData = {};
          cacheLoaded = true;
          console.warn('⚠️ No seed-data.json found. Firestore local cache initialized as empty.');
        }
      }
    }
  } catch (err) {
    console.error('Failed to initialize local Firestore cache:', err);
    cacheData = {};
    cacheLoaded = true;
  }
}

function saveCache() {
  const fs = require('fs');
  const path = require('path');
  const cacheDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'tmp');
  const cachePath = path.join(cacheDir, 'local_db_cache.json');
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local Firestore cache:', err);
  }
}

function updateCacheDoc(colName: string, docId: string, data: any, options?: any) {
  loadCacheIfNeeded();
  if (!cacheData[colName]) {
    cacheData[colName] = {};
  }
  const merge = options?.merge === true || options?.mergeFields !== undefined;
  
  const keysToDelete: string[] = [];
  const normalizedData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (value && typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        const sec = typeof value.seconds === 'number' ? value.seconds : (value._seconds ?? Math.floor(value.toDate().getTime() / 1000));
        const nano = typeof value.nanoseconds === 'number' ? value.nanoseconds : (value._nanoseconds ?? 0);
        return { seconds: sec, nanoseconds: nano };
      }
      if (
        value.methodName === 'FieldValue.delete' ||
        value.constructor?.name === 'DeleteTransform' || 
        value._methodName === 'FieldValue.delete' ||
        value.constructor?.name?.includes('Delete')
      ) {
        keysToDelete.push(key);
        return undefined;
      }
      if (
        value.methodName !== undefined ||
        value instanceof admin.firestore.FieldValue ||
        value.constructor?.name === 'FieldValue' ||
        value.constructor?.name?.includes('Transform') ||
        value._methodName !== undefined
      ) {
        return new Date().toISOString();
      }
    }
    return value;
  }));

  if (merge && cacheData[colName][docId]) {
    cacheData[colName][docId] = {
      ...cacheData[colName][docId],
      ...normalizedData
    };
    keysToDelete.forEach(k => {
      delete cacheData[colName][docId][k];
    });
  } else {
    cacheData[colName][docId] = normalizedData;
    keysToDelete.forEach(k => {
      delete cacheData[colName][docId][k];
    });
  }
  saveCache();
}

function deleteCacheDoc(colName: string, docId: string) {
  loadCacheIfNeeded();
  if (cacheData[colName] && cacheData[colName][docId]) {
    delete cacheData[colName][docId];
    saveCache();
  }
}

function getCacheDoc(colName: string, docId: string) {
  loadCacheIfNeeded();
  return cacheData[colName]?.[docId];
}

function getCacheCollection(colName: string) {
  loadCacheIfNeeded();
  const colCache = cacheData[colName] || {};
  return Object.keys(colCache).map(id => ({
    id,
    data: colCache[id]
  }));
}

function isQuotaError(err: any) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code;
  
  const isQuota = code === 8 || 
                  msg.includes('quota exceeded') || 
                  msg.includes('resource_exhausted') || 
                  msg.includes('quota');
                  
  const isConnection = code === 14 || // UNAVAILABLE
                       code === 4 ||  // DEADLINE_EXCEEDED
                       msg.includes('could not reach') ||
                       msg.includes('unavailable') ||
                       msg.includes('offline') ||
                       msg.includes('timeout') ||
                       msg.includes('connection') ||
                       msg.includes('failed to connect') ||
                       msg.includes('getaddrinfo') ||
                       msg.includes('network') ||
                       msg.includes('failed to get document') ||
                       msg.includes('status code');
                       
  return isQuota || isConnection;
}

function instantiateTimestamps(obj: any, keyName?: string): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (isoPattern.test(obj)) {
      const date = new Date(obj);
      if (!isNaN(date.getTime())) {
        return admin.firestore.Timestamp.fromDate(date);
      }
    }
    return obj;
  }
  if (typeof obj === 'object') {
    if (typeof obj.toDate === 'function') {
      return obj;
    }
    // Heal empty objects that represent deleted/empty fields in cache (to prevent errors like `.toDate is not a function`)
    // Only heal if the key name suggests it is a timestamp/date/sync field.
    const isDateField = keyName && (
      keyName.toLowerCase().includes('time') ||
      keyName.toLowerCase().includes('date') ||
      keyName.toLowerCase().includes('created') ||
      keyName.toLowerCase().includes('updated') ||
      keyName.toLowerCase().includes('synced')
    );
    if (Object.keys(obj).length === 0) {
      if (isDateField) {
        return admin.firestore.Timestamp.now();
      }
      return obj;
    }
    const hasSec = obj.seconds !== undefined || obj._seconds !== undefined;
    const hasNano = obj.nanoseconds !== undefined || obj._nanoseconds !== undefined;
    if (hasSec && hasNano) {
      const sec = obj.seconds !== undefined ? obj.seconds : obj._seconds;
      const nano = obj.nanoseconds !== undefined ? obj.nanoseconds : obj._nanoseconds;
      return new admin.firestore.Timestamp(sec, nano);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => instantiateTimestamps(item, keyName));
    }
    const converted: any = {};
    for (const key of Object.keys(obj)) {
      converted[key] = instantiateTimestamps(obj[key], key);
    }
    return converted;
  }
  return obj;
}

function getNestedValue(obj: any, segments: string[]) {
  return segments.reduce((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[part];
  }, obj);
}

function compareValues(docVal: any, op: string, val: any) {
  const normalize = (v: any) => {
    if (v && typeof v === 'object' && v.constructor?.name === 'Timestamp') {
      return v.toDate().getTime();
    }
    if (v && typeof v === 'object' && (v._seconds !== undefined || v.seconds !== undefined)) {
      const sec = v._seconds !== undefined ? v._seconds : v.seconds;
      return sec * 1000;
    }
    if (v instanceof Date) {
      return v.getTime();
    }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      return new Date(v).getTime();
    }
    return v;
  };
  const normDoc = normalize(docVal);
  const normVal = normalize(val);
  switch (op) {
    case 'EQUAL':
      return normDoc === normVal;
    case 'NOT_EQUAL':
      return normDoc !== normVal;
    case 'GREATER_THAN':
      return normDoc > normVal;
    case 'GREATER_THAN_OR_EQUAL':
      return normDoc >= normVal;
    case 'LESS_THAN':
      return normDoc < normVal;
    case 'LESS_THAN_OR_EQUAL':
      return normDoc <= normVal;
    case 'IN':
      return Array.isArray(val) && val.map(normalize).includes(normDoc);
    case 'ARRAY_CONTAINS':
      return Array.isArray(docVal) && docVal.map(normalize).includes(normVal);
    default:
      return false;
  }
}

function compareForSort(valA: any, valB: any) {
  const normalize = (v: any) => {
    if (v && typeof v === 'object' && v.constructor?.name === 'Timestamp') {
      return v.toDate().getTime();
    }
    if (v && typeof v === 'object' && (v._seconds !== undefined || v.seconds !== undefined)) {
      const sec = v._seconds !== undefined ? v._seconds : v.seconds;
      return sec * 1000;
    }
    if (v instanceof Date) {
      return v.getTime();
    }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      return new Date(v).getTime();
    }
    return v;
  };
  const normA = normalize(valA);
  const normB = normalize(valB);
  if (normA === undefined || normA === null) return 1;
  if (normB === undefined || normB === null) return -1;
  if (normA < normB) return -1;
  if (normA > normB) return 1;
  return 0;
}

function simulateQuery(query: any, docs: Array<{ id: string; data: any }>) {
  let result = [...docs];
  const filters = query._queryOptions.filters || [];
  for (const filter of filters) {
    const segments = filter.field?.segments || [];
    const op = filter.op;
    const val = filter.value;
    result = result.filter(doc => {
      const docVal = getNestedValue(doc.data, segments);
      return compareValues(docVal, op, val);
    });
  }
  const orders = query._queryOptions.fieldOrders || [];
  if (orders.length > 0) {
    result.sort((a, b) => {
      for (const order of orders) {
        const segments = order.field?.segments || [];
        const direction = order.direction;
        const valA = getNestedValue(a.data, segments);
        const valB = getNestedValue(b.data, segments);
        const cmp = compareForSort(valA, valB);
        if (cmp !== 0) {
          return direction === 'DESCENDING' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }
  const limit = query._queryOptions.limit;
  if (typeof limit === 'number') {
    result = result.slice(0, limit);
  }
  return result;
}

function createMockDocumentSnapshot(docRef: any, data: any) {
  return {
    exists: data !== undefined,
    id: docRef.id,
    ref: docRef,
    data: () => (data ? instantiateTimestamps(JSON.parse(JSON.stringify(data))) : undefined),
    get: (fieldPath: string) => {
      if (!data) return undefined;
      const val = fieldPath.split('.').reduce((acc, part) => acc && acc[part], data);
      return instantiateTimestamps(val);
    }
  };
}

function createMockQueryDocumentSnapshot(query: any, docId: string, data: any) {
  const docRef = query._firestore.collection(query._queryOptions.collectionId).doc(docId);
  return {
    id: docId,
    ref: docRef,
    exists: true,
    data: () => instantiateTimestamps(JSON.parse(JSON.stringify(data))),
    get: (fieldPath: string) => {
      const val = fieldPath.split('.').reduce((acc, part) => acc && acc[part], data);
      return instantiateTimestamps(val);
    }
  };
}

function createMockQuerySnapshot(query: any, filteredDocs: Array<{ id: string; data: any }>) {
  const mockDocs = filteredDocs.map(d => createMockQueryDocumentSnapshot(query, d.id, d.data));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (callback: (doc: any, index: number) => void) => {
      mockDocs.forEach((doc, idx) => callback(doc, idx));
    }
  };
}

// Intercept DocumentReference methods
function shouldTryLive(): boolean {
  if (isMockMode) return false;
  if (!isOfflineMode) return true;
  const now = Date.now();
  if (now - lastQuotaCheckTime >= QUOTA_RETRY_INTERVAL_MS) {
    console.log(`[Firestore Fallback] Retrying live Firestore connection to check if quota has reset...`);
    return true;
  }
  return false;
}

const originalDocGet = admin.firestore.DocumentReference.prototype.get;
admin.firestore.DocumentReference.prototype.get = async function() {
  const docRef = this;
  const colName = docRef.parent.id;
  const docId = docRef.id;

  if (!shouldTryLive()) {
    const cachedData = getCacheDoc(colName, docId);
    return createMockDocumentSnapshot(docRef, cachedData) as any;
  }

  try {
    const snap = await originalDocGet.apply(docRef, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    if (snap.exists) {
      updateCacheDoc(colName, docId, snap.data());
    }
    return snap;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on DocumentReference.get() for ${colName}/${docId}. Using local cache.`);
      const cachedData = getCacheDoc(colName, docId);
      return createMockDocumentSnapshot(docRef, cachedData) as any;
    }
    throw err;
  }
};

const originalDocSet = admin.firestore.DocumentReference.prototype.set;
admin.firestore.DocumentReference.prototype.set = async function(data: any, options?: any) {
  const docRef = this;
  const colName = docRef.parent.id;
  const docId = docRef.id;

  if (!shouldTryLive()) {
    updateCacheDoc(colName, docId, data, options);
    return { writeTime: admin.firestore.Timestamp.now() } as any;
  }

  try {
    const res = await originalDocSet.apply(docRef, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    updateCacheDoc(colName, docId, data, options);
    return res;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on DocumentReference.set() for ${colName}/${docId}. Writing to local cache.`);
      updateCacheDoc(colName, docId, data, options);
      return { writeTime: admin.firestore.Timestamp.now() } as any;
    }
    throw err;
  }
};

const originalDocUpdate = admin.firestore.DocumentReference.prototype.update;
admin.firestore.DocumentReference.prototype.update = async function(data: any) {
  const docRef = this;
  const colName = docRef.parent.id;
  const docId = docRef.id;

  if (!shouldTryLive()) {
    updateCacheDoc(colName, docId, data, { merge: true });
    return { writeTime: admin.firestore.Timestamp.now() } as any;
  }

  try {
    const res = await originalDocUpdate.apply(docRef, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    updateCacheDoc(colName, docId, data, { merge: true });
    return res;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on DocumentReference.update() for ${colName}/${docId}. Writing to local cache.`);
      updateCacheDoc(colName, docId, data, { merge: true });
      return { writeTime: admin.firestore.Timestamp.now() } as any;
    }
    throw err;
  }
};

const originalDocDelete = admin.firestore.DocumentReference.prototype.delete;
admin.firestore.DocumentReference.prototype.delete = async function() {
  const docRef = this;
  const colName = docRef.parent.id;
  const docId = docRef.id;

  if (!shouldTryLive()) {
    deleteCacheDoc(colName, docId);
    return { writeTime: admin.firestore.Timestamp.now() } as any;
  }

  try {
    const res = await originalDocDelete.apply(docRef, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    deleteCacheDoc(colName, docId);
    return res;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on DocumentReference.delete() for ${colName}/${docId}. Deleting from local cache.`);
      deleteCacheDoc(colName, docId);
      return { writeTime: admin.firestore.Timestamp.now() } as any;
    }
    throw err;
  }
};

// Intercept Query.get
const originalQueryGet = admin.firestore.Query.prototype.get;
admin.firestore.Query.prototype.get = async function() {
  const query = this;
  const colName = (query as any)._queryOptions.collectionId;

  if (!shouldTryLive()) {
    const allDocs = getCacheCollection(colName);
    const filteredDocs = simulateQuery(query, allDocs);
    return createMockQuerySnapshot(query, filteredDocs) as any;
  }

  try {
    const snap = await originalQueryGet.apply(query, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    snap.docs.forEach((doc: any) => {
      updateCacheDoc(colName, doc.id, doc.data());
    });
    return snap;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on Query.get() for collection ${colName}. Using local cache.`);
      const allDocs = getCacheCollection(colName);
      const filteredDocs = simulateQuery(query, allDocs);
      return createMockQuerySnapshot(query, filteredDocs) as any;
    }
    throw err;
  }
};

// Intercept CollectionReference.add
const originalColAdd = admin.firestore.CollectionReference.prototype.add;
admin.firestore.CollectionReference.prototype.add = async function(data: any) {
  const colRef = this;
  const colName = colRef.id;

  if (!shouldTryLive()) {
    const docRef = colRef.doc();
    updateCacheDoc(colName, docRef.id, data);
    return docRef as any;
  }

  try {
    const docRef = await originalColAdd.apply(colRef, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    updateCacheDoc(colName, docRef.id, data);
    return docRef;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      const docRef = colRef.doc();
      console.warn(`[Firestore Fallback] Quota exceeded on CollectionReference.add() for ${colName}/${docRef.id}. Writing to local cache.`);
      updateCacheDoc(colName, docRef.id, data);
      return docRef as any;
    }
    throw err;
  }
};

// Intercept WriteBatch operations
const originalBatchSet = admin.firestore.WriteBatch.prototype.set;
admin.firestore.WriteBatch.prototype.set = function(docRef: any, data: any, options?: any) {
  (this as any)._localOps = (this as any)._localOps || [];
  (this as any)._localOps.push({ type: 'set', docRef, data, options });
  return originalBatchSet.apply(this, arguments as any);
};

const originalBatchUpdate = admin.firestore.WriteBatch.prototype.update;
admin.firestore.WriteBatch.prototype.update = function(docRef: any, data: any) {
  (this as any)._localOps = (this as any)._localOps || [];
  (this as any)._localOps.push({ type: 'update', docRef, data });
  return originalBatchUpdate.apply(this, arguments as any);
};

const originalBatchDelete = admin.firestore.WriteBatch.prototype.delete;
admin.firestore.WriteBatch.prototype.delete = function(docRef: any) {
  (this as any)._localOps = (this as any)._localOps || [];
  (this as any)._localOps.push({ type: 'delete', docRef });
  return originalBatchDelete.apply(this, arguments as any);
};

const originalBatchCommit = admin.firestore.WriteBatch.prototype.commit;
admin.firestore.WriteBatch.prototype.commit = async function() {
  const batch = this;

  if (!shouldTryLive()) {
    console.warn(`[Firestore Fallback] Quota exceeded. Committing WriteBatch to local cache directly.`);
    if ((batch as any)._localOps) {
      for (const op of (batch as any)._localOps) {
        const colName = op.docRef.parent.id;
        const docId = op.docRef.id;
        if (op.type === 'set') {
          updateCacheDoc(colName, docId, op.data, op.options);
        } else if (op.type === 'update') {
          updateCacheDoc(colName, docId, op.data, { merge: true });
        } else if (op.type === 'delete') {
          deleteCacheDoc(colName, docId);
        }
      }
    }
    return [{ writeTime: admin.firestore.Timestamp.now() }] as any;
  }

  try {
    const res = await originalBatchCommit.apply(batch, arguments as any);
    if (isOfflineMode) {
      console.log(`✅ [Firestore Fallback] Live Firestore connection restored! Exiting offline fallback mode.`);
      isOfflineMode = false;
    }
    if ((batch as any)._localOps) {
      for (const op of (batch as any)._localOps) {
        const colName = op.docRef.parent.id;
        const docId = op.docRef.id;
        if (op.type === 'set') {
          updateCacheDoc(colName, docId, op.data, op.options);
        } else if (op.type === 'update') {
          updateCacheDoc(colName, docId, op.data, { merge: true });
        } else if (op.type === 'delete') {
          deleteCacheDoc(colName, docId);
        }
      }
    }
    return res;
  } catch (err: any) {
    if (isQuotaError(err)) {
      enterOfflineMode();
      console.warn(`[Firestore Fallback] Quota exceeded on WriteBatch.commit(). Writing batch to local cache.`);
      if ((batch as any)._localOps) {
        for (const op of (batch as any)._localOps) {
          const colName = op.docRef.parent.id;
          const docId = op.docRef.id;
          if (op.type === 'set') {
            updateCacheDoc(colName, docId, op.data, op.options);
          } else if (op.type === 'update') {
            updateCacheDoc(colName, docId, op.data, { merge: true });
          } else if (op.type === 'delete') {
            deleteCacheDoc(colName, docId);
          }
        }
      }
      return [{ writeTime: admin.firestore.Timestamp.now() }] as any;
    }
    throw err;
  }
};