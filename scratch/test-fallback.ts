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

async function runTests() {
  const admin = (await import('firebase-admin')).default;

  // 1. Mock the Firestore prototype get methods to simulate quota exceeded BEFORE importing our config!
  const originalProtoQueryGet = admin.firestore.Query.prototype.get;
  const originalProtoDocGet = admin.firestore.DocumentReference.prototype.get;

  admin.firestore.Query.prototype.get = async function() {
    console.log('[Mocked Base Query.get] Simulating RESOURCE_EXHAUSTED quota error.');
    const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.');
    (err as any).code = 8;
    throw err;
  };

  admin.firestore.DocumentReference.prototype.get = async function() {
    console.log('[Mocked Base DocRef.get] Simulating RESOURCE_EXHAUSTED quota error.');
    const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.');
    (err as any).code = 8;
    throw err;
  };

  // Now import our firebase-admin config. It will wrap our mocked prototype functions!
  const { adminDb } = await import('../lib/firebase-admin');

  console.log('\n--- 🧪 TEST 1: Cache Initialization ---');
  const cachePath = path.join(process.cwd(), 'tmp', 'local_db_cache.json');
  if (fs.existsSync(cachePath)) {
    console.log('✅ Local cache file exists:', cachePath);
    const content = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log('Collections in cache:', Object.keys(content));
    console.log('Total projects in cache:', Object.keys(content.projects || {}).length);
  } else {
    throw new Error('Local cache file was not created!');
  }

  console.log('\n--- 🧪 TEST 2: Querying with Quota Exceeded (Simulated) ---');

  try {
    // 2a. Query all projects ordered by name asc (used in GET /api/projects)
    console.log('\nRunning: adminDb.collection("projects").orderBy("name", "asc").get()');
    const projectsSnapshot = await adminDb.collection('projects').orderBy('name', 'asc').get();
    console.log(`✅ Returned size: ${projectsSnapshot.size}`);
    console.log(`✅ Empty: ${projectsSnapshot.empty}`);
    projectsSnapshot.docs.forEach((doc: any, i: number) => {
      console.log(`  Project ${i + 1}: ID=${doc.id}, Name="${doc.data().name}", TL="${doc.data().tl_name}"`);
    });

    if (projectsSnapshot.size === 0) {
      throw new Error('Projects query returned empty snapshot!');
    }

    // 2b. Query tasks for user_003 (used in Dashboard and GET /api/tasks)
    console.log('\nRunning: adminDb.collection("tasks").where("user_id", "==", "user_003").where("status", "==", "PENDING").get()');
    const tasksSnapshot = await adminDb.collection('tasks')
      .where('user_id', '==', 'user_003')
      .where('status', '==', 'PENDING')
      .get();
    
    console.log(`✅ Returned size: ${tasksSnapshot.size}`);
    tasksSnapshot.docs.forEach((doc: any, i: number) => {
      console.log(`  Task ${i + 1}: ID=${doc.id}, Title="${doc.data().title}", Status="${doc.data().status}", User="${doc.data().user_id}"`);
      if (doc.data().user_id !== 'user_003' || doc.data().status !== 'PENDING') {
        throw new Error('Query filters failed to apply properly in mock query simulation!');
      }
    });

    // 2c. Get a single document reference (used in authorize role lookup / settings)
    console.log('\nRunning: adminDb.collection("users").doc("user_001").get()');
    const userSnapshot = await adminDb.collection('users').doc('user_001').get();
    console.log(`✅ Exists: ${userSnapshot.exists}`);
    console.log(`✅ ID: ${userSnapshot.id}`);
    console.log(`✅ Data:`, userSnapshot.data());
    if (!userSnapshot.exists || userSnapshot.data()?.name !== 'Admin User') {
      throw new Error('Mock document snapshot returned incorrect data!');
    }

    // 2d. Test writing (creating a task offline)
    console.log('\nRunning: adminDb.collection("tasks").add({ user_id: "user_003", title: "New Offline Task", status: "PENDING" })');
    const newTaskRef = await adminDb.collection('tasks').add({
      user_id: 'user_003',
      title: 'New Offline Task',
      status: 'PENDING'
    });
    console.log(`✅ New task doc ID: ${newTaskRef.id}`);

    // Re-query to verify the task is now in the cache/query result
    console.log('\nRunning: adminDb.collection("tasks").where("user_id", "==", "user_003").where("status", "==", "PENDING").get() again');
    const updatedTasksSnapshot = await adminDb.collection('tasks')
      .where('user_id', '==', 'user_003')
      .where('status', '==', 'PENDING')
      .get();
    console.log(`✅ Returned size after add: ${updatedTasksSnapshot.size}`);
    const hasNewTask = updatedTasksSnapshot.docs.some((doc: any) => doc.data().title === 'New Offline Task');
    if (!hasNewTask) {
      throw new Error('New task was not written/returned in the mock query!');
    }
    console.log('✅ Offline add and query integration test passed!');

  } finally {
    // Restore original prototype methods
    admin.firestore.DocumentReference.prototype.get = originalProtoDocGet;
    admin.firestore.Query.prototype.get = originalProtoQueryGet;
  }

  console.log('\n🎉 ALL FALLBACK TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
