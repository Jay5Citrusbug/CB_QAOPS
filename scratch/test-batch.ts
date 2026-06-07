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
      process.env[key] = val;
    });
  }
}

loadEnv();

async function main() {
  const { adminDb } = await import('../lib/firebase-admin');
  const batch = adminDb.batch();
  const docRef1 = adminDb.collection('tasks').doc('temp_task_1');
  const docRef2 = adminDb.collection('tasks').doc('temp_task_2');
  
  batch.set(docRef1, { title: 'Task 1' });
  batch.delete(docRef2);
  
  console.log('WriteBatch keys:', Object.keys(batch));
  const util = require('util');
  console.log('WriteBatch structure:', util.inspect(batch, { depth: 4 }));
}

main().catch(console.error);
