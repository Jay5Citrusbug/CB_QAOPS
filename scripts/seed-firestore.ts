import fs from 'fs';
import path from 'path';

// 1. Manually load environment variables from .env file before imports run
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      // Always overwrite if process.env value is missing, empty, or whitespace-only
      if (!process.env[key] || process.env[key].trim() === "") {
        process.env[key] = val;
      }
    });
    console.log('✅ Loaded environment variables from .env file.');
  } else {
    console.log('⚠️ .env file not found. Relying on system environment variables.');
  }
}

loadEnv();

// We will dynamically import the firebase configs at runtime in the main function to bypass ES Module hoisting.
let admin: any;
let adminDb: any;

// 2. Helper to recursively convert ISO date strings into Firestore Timestamps
function convertTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check if string matches ISO datetime formats (e.g. 2026-05-24T18:00:00.000Z)
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (isoPattern.test(obj)) {
      const date = new Date(obj);
      if (!isNaN(date.getTime())) {
        return admin.firestore.Timestamp.fromDate(date);
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertTimestamps(item));
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        // Handle specific date or timestamp fields
        if (typeof val === 'string' && (key.endsWith('_at') || key === 'date' || key.includes('date') || key.includes('remind_at'))) {
          const date = new Date(val);
          if (!isNaN(date.getTime())) {
            converted[key] = admin.firestore.Timestamp.fromDate(date);
            continue;
          }
        }
        converted[key] = convertTimestamps(val);
      }
    }
    return converted;
  }

  return obj;
}

// 3. Main Seeding Function
async function seedDatabase() {
  console.log('🚀 Starting Firestore seeding script...');
  
  // Dynamically load imports after environment loading has run
  const adminModule = await import('firebase-admin');
  admin = adminModule.default || adminModule;
  const firebaseAdminConfig = await import('../lib/firebase-admin');
  adminDb = firebaseAdminConfig.adminDb;


  const seedDataPath = path.resolve(process.cwd(), 'seed-data.json');
  if (!fs.existsSync(seedDataPath)) {
    console.error('❌ Error: seed-data.json file not found at root directory!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(seedDataPath, 'utf8');
  let seedData: Record<string, any[]>;
  try {
    seedData = JSON.parse(rawData);
  } catch (err: any) {
    console.error('❌ Error: Failed to parse seed-data.json. Check syntax.', err.message);
    process.exit(1);
  }

  // Define collections to seed in order of dependency
  const collections = ['users', 'projects', 'tasks', 'task_steps', 'daily_statuses', 'prompt_categories', 'prompts'];

  for (const collectionName of collections) {
    const items = seedData[collectionName];
    if (!items || !Array.isArray(items)) {
      console.log(`⚠️ Warning: Collection '${collectionName}' not found in seed-data.json. Skipping...`);
      continue;
    }

    console.log(`📦 Seeding collection: '${collectionName}' with ${items.length} documents...`);

    // Firestore allows maximum of 500 writes per batch
    const BATCH_LIMIT = 400;
    let batch = adminDb.batch();
    let count = 0;

    for (const item of items) {
      // 1. Separate document ID from payload
      const { id, ...payload } = item;
      
      // If document ID is missing, auto-generate one
      const docRef = id 
        ? adminDb.collection(collectionName).doc(id) 
        : adminDb.collection(collectionName).doc();

      // 2. Recursively convert date strings to Timestamp objects
      const processedPayload = convertTimestamps(payload);

      // 3. Add to batch write (upsert/set)
      batch.set(docRef, processedPayload);
      count++;

      if (count >= BATCH_LIMIT) {
        console.log(`   ⚡ Committing batch of ${count} writes for '${collectionName}'...`);
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }

    if (count > 0) {
      console.log(`   ⚡ Committing final batch of ${count} writes for '${collectionName}'...`);
      await batch.commit();
    }

    console.log(`✅ Collection '${collectionName}' successfully seeded!`);
  }

  console.log('🎉 Firestore seeding finished successfully!');
}

seedDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal Seeding Error:', err);
    process.exit(1);
  });
