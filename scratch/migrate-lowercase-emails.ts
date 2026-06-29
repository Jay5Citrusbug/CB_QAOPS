import fs from 'fs';
import path from 'path';

// Load env variables
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
      if (!process.env[key] || process.env[key].trim() === "") {
        process.env[key] = val;
      }
    });
    console.log('✅ Loaded environment variables from .env file.');
  }
}

loadEnv();

async function migrate() {
  const firebaseAdminConfig = await import('../lib/firebase-admin');
  const adminDb = firebaseAdminConfig.adminDb;
  const adminAuth = firebaseAdminConfig.adminAuth;

  console.log('🔍 Fetching all users from Firestore...');
  const snapshot = await adminDb.collection('users').get();
  
  let totalCount = 0;
  let migratedCount = 0;

  for (const doc of snapshot.docs) {
    totalCount++;
    const data = doc.data();
    const currentEmail = data.email || '';
    const lowercaseEmail = currentEmail.trim().toLowerCase();

    if (currentEmail !== lowercaseEmail) {
      console.log(`⚠️ Found case mismatch for user: ${currentEmail} (UID: ${doc.id})`);
      
      // 1. Update Firebase Auth first
      try {
        await adminAuth.updateUser(doc.id, {
          email: lowercaseEmail
        });
        console.log(`  ✅ Updated email in Firebase Auth to: ${lowercaseEmail}`);
      } catch (authError: any) {
        console.warn(`  ⚠️ Failed to update email in Firebase Auth (might be simulated user or credentials issue): ${authError.message}`);
      }

      // 2. Update Firestore
      try {
        await adminDb.collection('users').doc(doc.id).update({
          email: lowercaseEmail
        });
        console.log(`  ✅ Updated email in Firestore to: ${lowercaseEmail}`);
        migratedCount++;
      } catch (dbError: any) {
        console.error(`  ❌ Failed to update email in Firestore: ${dbError.message}`);
      }
    }
  }

  console.log(`\n🎉 Migration completed. Processed ${totalCount} users. Migrated ${migratedCount} users with uppercase emails.`);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
