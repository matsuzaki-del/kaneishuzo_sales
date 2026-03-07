import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon Serverless driver の設定 (WebSocket を使用)
neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Deep Sync) ---");

const getEnv = (key: string) => (process.env[key] || "").trim().replace(/\s/g, "");

// 1. 各種接続成分の抽出
const host = getEnv("DATABASEURL_POSTGRES_HOST") || getEnv("DATABASEURL_PGHOST") || getEnv("DATABASEURL_PGHOST_UNPOOLED");
const user = getEnv("DATABASEURL_POSTGRES_USER") || getEnv("DATABASEURL_PGUSER");
const password = getEnv("DATABASEURL_POSTGRES_PASSWORD") || getEnv("DATABASEURL_PGPASSWORD");
const dbName = getEnv("DATABASEURL_POSTGRES_DATABASE") || getEnv("DATABASEURL_PGDATABASE") || "neondb";

// 2. 既存の接続文字列候補
const rawConnString =
    getEnv("DATABASEURL_POSTGRES_URL_NO_SSL") ||
    getEnv("DATABASE_URL") ||
    getEnv("POSTGRES_PRISMA_URL") ||
    getEnv("DATABASEURL_POSTGRES_PRISMA_URL") ||
    getEnv("POSTGRES_URL") ||
    getEnv("DATABASEURL_POSTGRES_URL");

let finalConnectionString = "";

// 3. 接続情報の優先度決定
if (host && user && password) {
    console.log("🚀 Reconstructing connection string from individual parameters.");
    try {
        const url = new URL(`postgresql://${host}/${dbName}`);
        url.username = user;
        url.password = password;
        url.searchParams.set("sslmode", "require");
        finalConnectionString = url.toString();

        // --- 蒸留側（最上流）の対策 ---
        // ドライバがフォールバック時に参照する標準環境変数を直接上書きする
        process.env.PGHOST = host;
        process.env.PGUSER = user;
        process.env.PGPASSWORD = password;
        process.env.PGDATABASE = dbName;
        process.env.PGPORT = "5432";
    } catch (e) {
        console.error("❌ Failed to construct URL:", e);
        finalConnectionString = rawConnString;
    }
} else if (rawConnString) {
    console.log("🚀 Using existing connection string.");
    finalConnectionString = rawConnString;
}

if (!finalConnectionString) {
    console.error("❌ CRITICAL: No DB connection info available.");
    throw new Error("DATABASE_CONNECTION_ERROR");
}

console.log(`✅ Ready to connect (URL length: ${finalConnectionString.length})`);

// 前面で同期
process.env.DATABASE_URL = finalConnectionString;

/* eslint-disable @typescript-eslint/no-explicit-any */

// Neonサーバーレスアダプターの初期化
const pool = new Pool({
    connectionString: finalConnectionString,
    connectionTimeoutMillis: 30000,
    max: 1
} as any);

const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });

/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
