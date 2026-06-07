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

  // Mock base Query.get to simulate quota exceeded
  admin.firestore.Query.prototype.get = async function() {
    const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.');
    (err as any).code = 8;
    throw err;
  };

  admin.firestore.DocumentReference.prototype.get = async function() {
    const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.');
    (err as any).code = 8;
    throw err;
  };

  // Now import our database fallback wrapper
  const { adminDb } = await import('../lib/firebase-admin');

  console.log('Fetching audit logs via query...');
  const auditLogsSnap = await adminDb
    .collection('projects')
    .doc('proj_001')
    .collection('audit_logs')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();

  console.log('Found docs:', auditLogsSnap.size);
  const auditLogs = auditLogsSnap.docs.map(d => {
    const data = d.data();
    console.log('Doc ID:', d.id, 'Raw timestamp:', data.timestamp, 'Constructor:', data.timestamp?.constructor?.name);
    let toDateFn = data.timestamp?.toDate;
    console.log('toDate is function:', typeof toDateFn === 'function');
    const isoString = data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : null;
    return {
      id: d.id,
      ...data,
      timestamp: isoString
    };
  });

  console.log('Successfully processed audit logs:', auditLogs);
}

main().catch(console.error);
