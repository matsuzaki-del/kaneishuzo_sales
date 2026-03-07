import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Neon Serverless Mode) ---");

const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ CRITICAL: No connection string found.");
} else {
    console.log(`✅ Using Neon Serverless Adapter (URL Length: ${connectionString.length})`);
}

let client: PrismaClient;

if (connectionString) {
    // Neon 公式のサーバーレスドライバを使用
    const neonPool = new Pool({ connectionString });
    const adapter = new PrismaNeon(neonPool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
