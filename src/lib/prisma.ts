import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

// Node.js 環境で WebSocket を有効にする（Neon用）
neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * 環境変数から非表示文字や予期しない空白を削除する
 */
const cleanEnvVar = (val: string | undefined): string => {
    if (!val) return "";
    // eslint-disable-next-line no-control-regex
    return val.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "").trim();
};

console.log("--- DB Connection (Extreme Clean Mode) ---");

// 診断出力: 利用可能な環境変数のキー名を列挙（値は秘匿）
const envKeys = Object.keys(process.env).filter(key =>
    key.startsWith("POSTGRES") || key.startsWith("DATABASE") || key.startsWith("NEON")
);
console.log(`🔍 Available DB Env Vars: ${envKeys.join(", ")}`);

// Vercel Postgres (Neon) を最優先する。診断結果に基づき、特殊なプレフィックス付きも対応。
const connectionString = (
    process.env.DATABASEURL_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASEURL_POSTGRES_PRISMA_URL ||
    process.env.DATABASEURL_POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
).trim();

if (!connectionString) {
    console.error("❌ CRITICAL: No connection string found.");
}

let client: PrismaClient;

if (connectionString) {
    const isNeon = connectionString.includes("neon.tech") || connectionString.includes("pooler.vercel-storage.com");
    const isSupabase = connectionString.includes("supabase.com");

    if (isNeon) {
        console.log("✅ Using Neon Serverless Adapter (Cleaned)");
        const neonPool = new NeonPool({ connectionString });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapter = new PrismaNeon(neonPool as any);
        client = new PrismaClient({ adapter });
    } else if (isSupabase) {
        // Supabase の場合は PrismaPg を使用（PGBouncer パラメータを考慮）
        console.log("⚠️ Using Supabase (pg adapter) - Host: supabase.com (Cleaned)");
        const pgPool = new PgPool({ connectionString });
        const adapter = new PrismaPg(pgPool);
        client = new PrismaClient({ adapter });
    } else {
        console.log("ℹ️ Using Standard Prisma Client (Cleaned)");
        client = new PrismaClient();
    }
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
