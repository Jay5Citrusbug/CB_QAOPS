import fs from 'fs';
import path from 'path';

// Load env vars from .env file
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
      if (!process.env[key] || process.env[key]!.trim() === '') {
        process.env[key] = val;
      }
    });
    console.log('✅ Loaded environment variables from .env file.');
  } else {
    console.log('⚠️ .env file not found.');
  }
}

loadEnv();

// Collections to wipe (everything except users & settings)
const COLLECTIONS_TO_WIPE = [
  'projects',
  'milestones',
  'test_cases',
  'sync_history',
  'audit_logs',
  'daily_statuses',
  'tasks',
  'task_steps',
  'task_lists',
  'task_activities',
  'notifications',
];

async function deleteCollection(adminDb: any, collectionName: string) {
  const snap = await adminDb.collection(collectionName).get();
  if (snap.empty) {
    console.log(`  ℹ️  ${collectionName}: already empty`);
    return 0;
  }

  // Delete in batches of 499 (Firestore batch limit)
  const BATCH_SIZE = 499;
  const docs = snap.docs;
  let deleted = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`  🗑️  ${collectionName}: deleted ${deleted} document(s)`);
  return deleted;
}

async function wipeAllData() {
  const { adminDb } = await import('../lib/firebase-admin');

  console.log('\n🚀 Starting full data wipe for all project / test case / daily data...\n');

  const totals: Record<string, number> = {};

  for (const col of COLLECTIONS_TO_WIPE) {
    try {
      totals[col] = await deleteCollection(adminDb, col);
    } catch (err: any) {
      console.error(`  ❌ Failed to wipe ${col}:`, err.message || err);
      totals[col] = -1;
    }
  }

  // ─── Wipe local cache ────────────────────────────────────────────────────────
  console.log('\n--- Wiping local cache (tmp/local_db_cache.json) ---');
  const cachePath = path.join(process.cwd(), 'tmp', 'local_db_cache.json');
  if (fs.existsSync(cachePath)) {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw);

    for (const col of COLLECTIONS_TO_WIPE) {
      if (cache[col]) {
        const count = Object.keys(cache[col]).length;
        cache[col] = {};
        if (count > 0) console.log(`  🗑️  ${col}: wiped ${count} cached doc(s)`);
        else console.log(`  ℹ️  ${col}: already empty in cache`);
      }
    }

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    console.log('  ✅ Local cache cleaned.');
  } else {
    console.log('  ℹ️  No local cache file found. Skipping.');
  }

  console.log('\n🎉 Data wipe complete!\n');
  console.log('📋 Summary (Firestore deletions):');
  for (const [col, count] of Object.entries(totals)) {
    const icon = count === -1 ? '❌' : count === 0 ? '✅' : '🗑️ ';
    const label = count === -1 ? 'ERROR' : `${count} doc(s) deleted`;
    console.log(`   ${icon} ${col.padEnd(18)} ${label}`);
  }
  console.log('');
}

wipeAllData().catch((err) => {
  console.error('❌ Wipe failed:', err);
  process.exit(1);
});
