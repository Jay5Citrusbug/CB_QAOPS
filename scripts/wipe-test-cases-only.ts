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

async function runWipe() {
  const { adminDb } = await import('../lib/firebase-admin');

  console.log('\n🚀 Wiping connected sheet settings and test cases from Firestore...\n');

  // 1. Fetch all projects
  const projectsSnap = await adminDb.collection('projects').get();
  if (projectsSnap.empty) {
    console.log('ℹ️ No projects found to clear.');
  } else {
    console.log(`Found ${projectsSnap.size} project(s) to process.`);
    for (const projectDoc of projectsSnap.docs) {
      const projectId = projectDoc.id;
      const projectName = projectDoc.data().name || projectId;
      console.log(`\nProcessing project: "${projectName}" (${projectId})...`);

      // Clear Google Sheet connection
      await projectDoc.ref.update({
        googleSheet: null
      });
      console.log('  ✅ Disconnected googleSheet config.');

      // Clear test_cases subcollection
      const testCasesSnap = await projectDoc.ref.collection('test_cases').get();
      if (testCasesSnap.empty) {
        console.log('  ℹ️ No subcollection test cases to delete.');
      } else {
        const batch = adminDb.batch();
        testCasesSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  🗑️ Deleted ${testCasesSnap.size} test case(s) from subcollection.`);
      }

      // Clear sync_history subcollection
      const syncHistorySnap = await projectDoc.ref.collection('sync_history').get();
      if (!syncHistorySnap.empty) {
        const batch = adminDb.batch();
        syncHistorySnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  🗑️ Deleted ${syncHistorySnap.size} sync log(s).`);
      }

      // Clear audit_logs subcollection
      const auditLogsSnap = await projectDoc.ref.collection('audit_logs').get();
      if (!auditLogsSnap.empty) {
        const batch = adminDb.batch();
        auditLogsSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  🗑️ Deleted ${auditLogsSnap.size} audit log(s).`);
      }
    }
  }

  // 2. Clear global collections if any
  const collectionsToWipe = ['test_cases', 'sync_history', 'audit_logs'];
  for (const col of collectionsToWipe) {
    const snap = await adminDb.collection(col).get();
    if (!snap.empty) {
      const batch = adminDb.batch();
      snap.docs.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`🗑️ Deleted ${snap.size} documents from global "${col}" collection.`);
    }
  }

  console.log('\n🎉 Finished wiping all connected sheet connections and test cases!\n');
}

runWipe().catch(err => {
  console.error('❌ Wipe failed:', err);
  process.exit(1);
});
