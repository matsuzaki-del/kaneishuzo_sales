import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// SupabaseのTransaction Pooler (6543) を使う場合、pgbouncer=true が必要です
const baseConnectionString = process.env.DATABASE_URL;
const connectionString = baseConnectionString?.includes("pgbouncer")
    ? baseConnectionString
    : `${baseConnectionString}${baseConnectionString?.includes("?") ? "&" : "?"}pgbouncer=true`;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in environment variables.");
}

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1 // サーバーレス環境でのコネクション枯渇を防ぐ
});
const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
