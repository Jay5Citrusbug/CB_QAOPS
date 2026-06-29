const fs = require('fs');
const path = require('path');

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
  }
}

loadEnv();

const admin = require('firebase-admin');

// Initialize admin app if not initialized
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

async function run() {
  const projectId = 'G9vtF3h9URSwrMbrHUPx';
  console.log('Fetching project:', projectId);
  
  const doc = await db.collection('projects').doc(projectId).get();
  if (!doc.exists) {
    console.log('Project NOT found!');
    return;
  }
  
  console.log('Project Data:', JSON.stringify(doc.data(), null, 2));
}

run().catch(console.error);
