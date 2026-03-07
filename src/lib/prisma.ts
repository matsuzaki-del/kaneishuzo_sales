import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Vercel Postgres (Neon) の接続文字列
// 提示された環境変数一覧に基づき、プレフィックス付きのものも含めて優先順位をつけて取得
const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASEURL_POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASEURL_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASEURL_POSTGRES_URL;

if (!connectionString) {
    console.error("❌ Database connection string is not set. Checked: POSTGRES_PRISMA_URL, DATABASEURL_POSTGRES_PRISMA_URL, DATABASE_URL, DATABASEURL_DATABASE_URL, POSTGRES_URL, DATABASEURL_POSTGRES_URL");
}

// Neonサーバーレスアダプターの初期化
const pool = new Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new PrismaClient({ adapter: adapter as any });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
