import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon Serverless driver の設定
if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Final Sync) ---");

const getEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/\s/g, "");
};

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
    console.log("🚀 Reconstructing connection string.");
    // 特殊文字を考慮せず、最も単純な形式で結合（不純物を混ぜない）
    finalConnectionString = `postgresql://${user}:${password}@${host}/${dbName}?sslmode=require`;
} else if (rawConnString) {
    console.log("🚀 Using raw connection string.");
    finalConnectionString = rawConnString;
}

if (!finalConnectionString || typeof finalConnectionString !== "string") {
    console.error("❌ CRITICAL: Invalid connection string.");
    throw new Error("DATABASE_CONNECTION_ERROR");
}

console.log(`✅ Ready to connect (Length: ${finalConnectionString.length})`);

// グローバルな環境変数を更新（Prismaの深層対策）
process.env.DATABASE_URL = finalConnectionString;

/* eslint-disable @typescript-eslint/no-explicit-any */

// Pool の初期化 (TypeError を避けるため、極力シンプルに)
const pool = new Pool({
    connectionString: finalConnectionString
} as any);

const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });

/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
