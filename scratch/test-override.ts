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
  const admin = (await import('firebase-admin')).default;
  const { adminDb } = await import('../lib/firebase-admin');

  console.log('Query proto:', !!admin.firestore.Query.prototype.get);
  console.log('DocumentReference proto get:', !!admin.firestore.DocumentReference.prototype.get);
  console.log('DocumentReference proto set:', !!admin.firestore.DocumentReference.prototype.set);
  console.log('DocumentReference proto update:', !!admin.firestore.DocumentReference.prototype.update);
  console.log('DocumentReference proto delete:', !!admin.firestore.DocumentReference.prototype.delete);
  console.log('CollectionReference proto add:', !!admin.firestore.CollectionReference.prototype.add);
  console.log('WriteBatch proto commit:', !!admin.firestore.WriteBatch.prototype.commit);
}

main().catch(console.error);
