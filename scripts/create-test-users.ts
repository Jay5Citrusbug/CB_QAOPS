import fs from 'fs';
import path from 'path';

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
  } else {
    console.log('⚠️ .env file not found.');
  }
}

loadEnv();

const usersToCreate = [
  { email: 'qa1@test.com', name: 'QA Lead', role: 'USER' },
  { email: 'qa2@test.com', name: 'QA Assistant', role: 'USER' },
  { email: 'dev1@test.com', name: 'Dev Senior', role: 'DEV' },
  { email: 'dev2@test.com', name: 'Dev Junior', role: 'DEV' },
];

const password = "Jayqa@1234";

async function createUsers() {
  const adminModule = await import('firebase-admin');
  const admin = adminModule.default || adminModule;
  const { adminDb, adminAuth } = await import('../lib/firebase-admin');

  console.log(`🚀 Starting creation of ${usersToCreate.length} test users in Firebase...`);

  for (const user of usersToCreate) {
    try {
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(user.email);
        console.log(`ℹ️ User ${user.email} already exists in Firebase Auth. Updating password...`);
        await adminAuth.updateUser(userRecord.uid, {
          password: password,
          displayName: user.name,
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email: user.email,
            password: password,
            displayName: user.name,
          });
          console.log(`✅ Created user ${user.email} in Firebase Auth with UID: ${userRecord.uid}`);
        } else {
          throw e;
        }
      }

      // Upsert into Firestore
      await adminDb.collection('users').doc(userRecord.uid).set({
        name: user.name,
        email: user.email,
        role: user.role,
        project_id: 'proj_001',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`✅ Upserted ${user.email} as ${user.role} in Firestore!`);
    } catch (err: any) {
      console.error(`❌ Failed to create/upsert user ${user.email}:`, err.message || err);
    }
  }

  console.log('🎉 Done creating test users.');
}

createUsers().catch(console.error);
