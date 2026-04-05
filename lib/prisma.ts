import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

// PrismaLibSql accepts the same Config object as createClient
const adapterConfig = authToken
  ? { url: databaseUrl, authToken }  // Turso cloud (Vercel)
  : { url: databaseUrl };            // Local SQLite

const adapter = new PrismaLibSql(adapterConfig as Parameters<typeof createClient>[0]);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
