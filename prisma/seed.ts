import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
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
