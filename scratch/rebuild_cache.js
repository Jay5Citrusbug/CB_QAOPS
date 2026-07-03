const fs = require('fs');
const path = require('path');

const seedDataPath = path.join(__dirname, '..', 'seed-data.json');
const cachePath = path.join(__dirname, '..', 'tmp', 'local_db_cache.json');

try {
  const seedRaw = fs.readFileSync(seedDataPath, 'utf8');
  const seedData = JSON.parse(seedRaw);

  const cacheData = {};

  Object.keys(seedData).forEach((collectionName) => {
    cacheData[collectionName] = {};
    const items = seedData[collectionName];
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const id = item.id || `doc_${Math.random().toString(36).substr(2, 9)}`;
        // For local cache, it expects date strings to be formatted or objects.
        // We will keep them as ISO strings, and the local fallback engine's
        // instantiateTimestamps function will automatically convert them at read time!
        cacheData[collectionName][id] = { ...item };
      });
    }
  });

  // Ensure directories exist
  const cacheDir = path.dirname(cachePath);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  console.log('✅ Rebuilt local_db_cache.json from seed-data.json successfully!');
} catch (err) {
  console.error('Error rebuilding cache:', err);
}
