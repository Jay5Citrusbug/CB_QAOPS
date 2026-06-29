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
  }
}

loadEnv();

async function run() {
  const { adminDb } = await import('../lib/firebase-admin');
  
  console.log('--- Projects ---');
  const projSnap = await adminDb.collection('projects').get();
  for (const doc of projSnap.docs) {
    const data = doc.data();
    console.log(`Project ID: ${doc.id}, Name: ${data.name}`);
    
    const tcSnap = await adminDb.collection('projects').doc(doc.id).collection('test_cases').get();
    console.log(`  Total test cases in DB: ${tcSnap.size}`);
    tcSnap.docs.slice(0, 5).forEach(tc => {
      const tcData = tc.data();
      console.log(`    Doc ID: "${tc.id}", testCaseId field: "${tcData.testCaseId}", Title: "${tcData.title}"`);
    });
  }
}

run().catch(console.error);
