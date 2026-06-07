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

// Require Interceptor to mock next-auth
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'next-auth') {
    return {
      __esModule: true,
      default: {},
      getServerSession: () => Promise.resolve({
        user: {
          id: 'user_001',
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'ADMIN',
          projectId: null
        }
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

import { NextRequest } from 'next/server';

async function main() {
  const { GET } = await import('../app/api/projects/[id]/google-sheet/route');

  const req = new NextRequest('http://localhost:3000/api/projects/proj_001/google-sheet');
  const params = Promise.resolve({ id: 'proj_001' });

  console.log('Calling GET /api/projects/proj_001/google-sheet...');
  const res = await GET(req, { params });
  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
