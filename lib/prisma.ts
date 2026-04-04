import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use an absolute path to ensure all Next.js server components and CLI tools point to the SAME database file.
const databasePath = "D:/Automation/Playwright/CB QOps/prisma/dev.db";

const adapter = new PrismaLibSql({
  url: `file:${databasePath}`,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
