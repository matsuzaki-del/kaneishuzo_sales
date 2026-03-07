import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

// --- Neon Driver 動作構成の共通化 (HTTP 優先モード) ---
// Vercel などのサーバーレス環境で WebSocket の依存を避け、HTTP 経由でクエリを送信するように強制します
neonConfig.useFetchConnection = true;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Final Strategy: HTTP) ---");

/**
 * 環境変数を安全に取得し、空白や改行を完全に排除する
 */
const getSafeEnv = (key: string): string => {
    const original = process.env[key];
    if (typeof original !== "string") return "";
    return original.trim().replace(/\s/g, "");
};

// 1. 各種接続成分の抽出 (優先順位: ユーザー指定 -> 標準)
const host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || "ep-snowy-heart-ai9cc23s-pooler.c-4.us-east-1.aws.neon.tech";
const user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || "neondb_owner";
const pass = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || "npg_3Pe2ZjLTXsbW";
const db = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "neondb";

// 2. 接続文字列候補 (既存の URL を優先)
const rawUrl =
    getSafeEnv("DATABASEURL_POSTGRES_URL_NO_SSL") ||
    getSafeEnv("DATABASE_URL") ||
    getSafeEnv("POSTGRES_URL") ||
    getSafeEnv("DATABASEURL_POSTGRES_PRISMA_URL");

let finalUrl = "";

// 3. 接続情報の決定
if (rawUrl && rawUrl.startsWith("postgres")) {
    console.log("🚀 Using prioritized raw connection string.");
    finalUrl = rawUrl;
} else if (host && user && pass) {
    console.log("🚀 Using reconstructed connection string from parameters.");
    finalUrl = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;
} else {
    console.error("❌ CRITICAL: No DB connection info found.");
    throw new Error("DB_CONFIG_MISSING");
}

// 4. 最重要プロセスの同期: Prisma やドライバが参照する環境変数をプロセスレベルで確定させる
process.env.DATABASE_URL = finalUrl;
process.env.PGHOST = host;
process.env.PGUSER = user;
process.env.PGPASSWORD = pass;
process.env.PGDATABASE = db;

console.log(`✅ Connection string ready (Length: ${finalUrl.length})`);

/* eslint-disable @typescript-eslint/no-explicit-any */

// Neon サーバーレス Pool の初期化 (HTTP モードでは Pool も特殊な挙動になります)
const pool = new Pool({ connectionString: finalUrl } as any);
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });

/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
