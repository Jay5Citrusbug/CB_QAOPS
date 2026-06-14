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

const KEEP_EMAIL = 'jay5.citrusbug@gmail.com';

async function cleanupUsers() {
  const { adminDb, adminAuth } = await import('../lib/firebase-admin');

  console.log(`\n🚀 Starting user cleanup. Keeping only: ${KEEP_EMAIL}\n`);

  // ─── Step 1: Get the UID of the user to keep ────────────────────────────────
  let keepUid: string | null = null;
  try {
    const keepUser = await adminAuth.getUserByEmail(KEEP_EMAIL);
    keepUid = keepUser.uid;
    console.log(`✅ Found keeper user in Firebase Auth — UID: ${keepUid}`);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.warn(`⚠️ Keeper user ${KEEP_EMAIL} not found in Firebase Auth. Will keep their Firestore doc if it exists.`);
    } else {
      throw err;
    }
  }

  // ─── Step 2: Delete all Firebase Auth users except the keeper ───────────────
  console.log('\n--- Cleaning Firebase Authentication users ---');
  let nextPageToken: string | undefined;
  let deletedAuthCount = 0;

  do {
    const listResult = await adminAuth.listUsers(1000, nextPageToken);
    for (const user of listResult.users) {
      if (user.email === KEEP_EMAIL) {
        console.log(`  ⏭️  Skipping keeper: ${user.email} (${user.uid})`);
        continue;
      }
      try {
        await adminAuth.deleteUser(user.uid);
        console.log(`  🗑️  Deleted Auth user: ${user.email || user.uid}`);
        deletedAuthCount++;
      } catch (err: any) {
        console.error(`  ❌ Failed to delete Auth user ${user.email || user.uid}:`, err.message);
      }
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`\n✅ Deleted ${deletedAuthCount} user(s) from Firebase Authentication.`);

  // ─── Step 3: Delete all Firestore users docs except the keeper ──────────────
  console.log('\n--- Cleaning Firestore users collection ---');
  const usersSnap = await adminDb.collection('users').get();
  let deletedFirestoreCount = 0;

  const batch = adminDb.batch();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const isKeeper = (data.email === KEEP_EMAIL) || (keepUid && doc.id === keepUid);
    if (isKeeper) {
      console.log(`  ⏭️  Skipping keeper Firestore doc: ${doc.id} (${data.email})`);
      continue;
    }
    batch.delete(doc.ref);
    console.log(`  🗑️  Queued Firestore delete: ${doc.id} (${data.email || 'no email'})`);
    deletedFirestoreCount++;
  }

  await batch.commit();
  console.log(`\n✅ Deleted ${deletedFirestoreCount} user document(s) from Firestore.`);

  // ─── Step 4: Clean the local cache file ──────────────────────────────────────
  console.log('\n--- Cleaning local cache (tmp/local_db_cache.json) ---');
  const cachePath = path.join(process.cwd(), 'tmp', 'local_db_cache.json');
  if (fs.existsSync(cachePath)) {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw);

    if (cache.users) {
      const originalCount = Object.keys(cache.users).length;
      const filteredUsers: Record<string, any> = {};

      for (const [uid, userData] of Object.entries(cache.users as Record<string, any>)) {
        const isKeeper =
          userData.email === KEEP_EMAIL ||
          (keepUid && uid === keepUid);

        if (isKeeper) {
          filteredUsers[uid] = userData;
          console.log(`  ⏭️  Keeping cache entry: ${uid} (${userData.email})`);
        } else {
          console.log(`  🗑️  Removed cache entry: ${uid} (${userData.email || 'no email'})`);
        }
      }

      cache.users = filteredUsers;
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
      const removedCount = originalCount - Object.keys(filteredUsers).length;
      console.log(`\n✅ Removed ${removedCount} user(s) from local cache. ${Object.keys(filteredUsers).length} user(s) remaining.`);
    } else {
      console.log('  ℹ️  No users key in cache. Nothing to clean.');
    }
  } else {
    console.log('  ℹ️  No local cache file found. Skipping.');
  }

  console.log('\n🎉 User cleanup complete!\n');
  console.log(`📋 Summary:`);
  console.log(`   - Firebase Auth: deleted ${deletedAuthCount} user(s)`);
  console.log(`   - Firestore:     deleted ${deletedFirestoreCount} user(s)`);
  console.log(`   - Keeper user:   ${KEEP_EMAIL} (${keepUid || 'UID not found in Auth'})`);
}

cleanupUsers().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
