import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  console.log('Env file path:', envPath);
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
    console.log('Loaded env keys:', Object.keys(process.env).filter(k => k.includes('FIREBASE')));
  } else {
    console.log('Env file does not exist');
  }
}

loadEnv();

async function main() {
  const { adminDb } = await import('../lib/firebase-admin');
  const query = adminDb.collection('projects').where('status', '==', 'ACTIVE').orderBy('name', 'asc').limit(5);
  console.log('Query class name:', query.constructor.name);
  
  const util = require('util');
  console.log('Query structure:', util.inspect(query, { depth: 4 }));
}

main().catch(console.error);
