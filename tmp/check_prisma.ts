import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// @ts-ignore
console.log(Object.keys(prisma).filter(k => !k.startsWith('_')));
process.exit(0);
