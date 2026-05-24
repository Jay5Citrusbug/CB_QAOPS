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

let admin: any;
let adminDb: any;
let adminAuth: any;

async function createAdminUser() {
  const adminModule = await import('firebase-admin');
  admin = adminModule.default || adminModule;
  const firebaseAdminConfig = await import('../lib/firebase-admin');
  adminDb = firebaseAdminConfig.adminDb;
  adminAuth = firebaseAdminConfig.adminAuth;

  const email = "jay5.citrusbug@gmail.com";
  const password = "Jayqa@1234";
  const displayName = "Jay Citrusbug";

  console.log(`🚀 Attempting to create/update Admin user in Firebase: ${email}...`);

  try {
    let userRecord;
    try {
      // Check if user already exists in Firebase Auth
      userRecord = await adminAuth.getUserByEmail(email);
      console.log(`ℹ️ User already exists in Firebase Auth with UID: ${userRecord.uid}. Updating password...`);
      await adminAuth.updateUser(userRecord.uid, {
        password: password,
        displayName: displayName
      });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        // Create new user in Firebase Auth
        userRecord = await adminAuth.createUser({
          email: email,
          password: password,
          displayName: displayName,
        });
        console.log(`✅ Created user in Firebase Auth with UID: ${userRecord.uid}`);
      } else {
        throw e;
      }
    }

    // Upsert user into Firestore users collection with ADMIN role
    await adminDb.collection('users').doc(userRecord.uid).set({
      name: displayName,
      email: email,
      role: 'ADMIN',
      project_id: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Successfully set ADMIN role for ${email} in Firestore 'users' collection!`);
    console.log(`🎉 You can now log in using:\n📧 Email: ${email}\n🔑 Password: ${password}`);
  } catch (error: any) {
    console.error("❌ Failed to create admin user:", error.message || error);
  }
}

createAdminUser();
