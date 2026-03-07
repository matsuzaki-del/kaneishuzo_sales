import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Standard Vercel Config) ---");

// Vercel が統合機能で提供する標準的な環境変数をそのまま利用する
// POSTGRES_PRISMA_URL: 接続プール用 (推奨)
// POSTGRES_URL: 一般的な接続用
const connectionString =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ CRITICAL: No connection string found (POSTGRES_PRISMA_URL, POSTGRES_URL, or DATABASE_URL).");
} else {
    // 文字列の正体を確認せず、そのままドライバに委ねる (SNI等の標準機能を生かすため)
    console.log(`✅ Using connection string from process.env (Length: ${connectionString.length})`);
}

let client: PrismaClient;

if (connectionString) {
    // 証明書検証をスキップする設定のみを付与した標準的な Pool インスタンス
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
