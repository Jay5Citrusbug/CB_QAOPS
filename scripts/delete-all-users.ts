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

async function deleteAllUsers() {
  const { adminDb, adminAuth } = await import('../lib/firebase-admin');

  console.log('\n🚀 Starting FULL user wipe...\n');

  // ─── Step 1: Delete ALL Firebase Auth users ──────────────────────────────────
  console.log('--- Deleting ALL Firebase Authentication users ---');
  let nextPageToken: string | undefined;
  let deletedAuthCount = 0;
  const uidsToDelete: string[] = [];

  do {
    const listResult = await adminAuth.listUsers(1000, nextPageToken);
    for (const user of listResult.users) {
      uidsToDelete.push(user.uid);
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  // Delete in batches of 1000 (Firebase limit)
  for (let i = 0; i < uidsToDelete.length; i += 1000) {
    const batch = uidsToDelete.slice(i, i + 1000);
    const result = await adminAuth.deleteUsers(batch);
    deletedAuthCount += result.successCount;
    if (result.failureCount > 0) {
      console.warn(`  ⚠️  ${result.failureCount} user(s) failed to delete from Auth`);
    }
    console.log(`  🗑️  Deleted ${result.successCount} user(s) from Firebase Auth (batch ${Math.floor(i / 1000) + 1})`);
  }

  if (uidsToDelete.length === 0) {
    console.log('  ℹ️  No users found in Firebase Auth. Nothing to delete.');
  }
  console.log(`\n✅ Deleted ${deletedAuthCount} user(s) from Firebase Authentication.`);

  // ─── Step 2: Delete ALL Firestore users documents ────────────────────────────
  console.log('\n--- Deleting ALL Firestore users collection documents ---');
  const usersSnap = await adminDb.collection('users').get();
  let deletedFirestoreCount = 0;

  if (usersSnap.empty) {
    console.log('  ℹ️  Firestore users collection is already empty.');
  } else {
    const batch = adminDb.batch();
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      batch.delete(doc.ref);
      console.log(`  🗑️  Queued Firestore delete: ${doc.id} (${data.email || 'no email'})`);
      deletedFirestoreCount++;
    }
    await batch.commit();
    console.log(`\n✅ Deleted ${deletedFirestoreCount} user document(s) from Firestore.`);
  }

  // ─── Step 3: Wipe users from local cache ─────────────────────────────────────
  console.log('\n--- Wiping users from local cache (tmp/local_db_cache.json) ---');
  const cachePath = path.join(process.cwd(), 'tmp', 'local_db_cache.json');
  if (fs.existsSync(cachePath)) {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw);

    if (cache.users && Object.keys(cache.users).length > 0) {
      const removedCount = Object.keys(cache.users).length;
      cache.users = {};
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
      console.log(`  ✅ Wiped ${removedCount} user(s) from local cache.`);
    } else {
      console.log('  ℹ️  No users in local cache. Nothing to wipe.');
    }
  } else {
    console.log('  ℹ️  No local cache file found. Skipping.');
  }

  console.log('\n🎉 All users have been deleted!\n');
  console.log('📋 Summary:');
  console.log(`   - Firebase Auth:  deleted ${deletedAuthCount} user(s)`);
  console.log(`   - Firestore:      deleted ${deletedFirestoreCount} user(s)`);
  console.log('\n💡 To recreate the admin account, run:');
  console.log('   npx tsx scripts/create-admin.ts\n');
}

deleteAllUsers().catch((err) => {
  console.error('❌ Wipe failed:', err);
  process.exit(1);
});
