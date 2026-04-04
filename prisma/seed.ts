import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaLibSql({ url: "file:prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "jay5.citrusbug@gmail.com";
  const hashedPassword = await bcrypt.hash("Jayqa@1234", 10);

  const adminId = "admin-id-123";
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { id: adminId }] },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        id: adminId,
        name: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log("Admin user created.");
  } else {
    console.log("Admin user already exists.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
