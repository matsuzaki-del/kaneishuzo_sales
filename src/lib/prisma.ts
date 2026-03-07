import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup ---");

/**
 * 環境変数の値を安全に（空白を除去して）取得する
 */
const getEnv = (key: string) => (process.env[key] || "").trim().replace(/\s/g, "");

// 1. 個別パラメータの取得（Vercelの DATABASEURL_ プレフィックスを優先）
const host = getEnv("DATABASEURL_POSTGRES_HOST") || getEnv("DATABASEURL_PGHOST") || getEnv("DATABASEURL_PGHOST_UNPOOLED");
const user = getEnv("DATABASEURL_POSTGRES_USER") || getEnv("DATABASEURL_PGUSER");
const password = getEnv("DATABASEURL_POSTGRES_PASSWORD") || getEnv("DATABASEURL_PGPASSWORD");
const database = getEnv("DATABASEURL_POSTGRES_DATABASE") || getEnv("DATABASEURL_PGDATABASE") || "neondb";

// 2. 接続文字列の取得
const connectionString =
    getEnv("DATABASEURL_POSTGRES_URL_NO_SSL") ||
    getEnv("DATABASE_URL") ||
    getEnv("POSTGRES_PRISMA_URL") ||
    getEnv("DATABASEURL_POSTGRES_PRISMA_URL") ||
    getEnv("POSTGRES_URL") ||
    getEnv("DATABASEURL_POSTGRES_URL");

console.log(`🔎 Diagnostics: host=${!!host}, user=${!!user}, password=${!!password}, db=${!!database}, connString=${!!connectionString}`);

// 3. Pool構成の作成
let poolConfig: Record<string, unknown>;

if (host && user && password) {
    console.log("🚀 Using INDIVIDUAL parameters for DB connection.");
    poolConfig = {
        host,
        user,
        password,
        database,
        port: 5432,
    };
} else if (connectionString) {
    console.log("🚀 Using CONNECTION STRING for DB connection.");
    poolConfig = { connectionString };
} else {
    console.error("❌ CRITICAL: No DB connection info found in environment variables.");
    throw new Error("DATABASE_CONNECTION_ERROR: Connection info missing.");
}

// 共通設定
poolConfig.ssl = { rejectUnauthorized: false };
poolConfig.connectionTimeoutMillis = 20000;
poolConfig.max = 1; // サーバーレス環境では接続数を制限

console.log("Final Pool Config Keys:", Object.keys(poolConfig).join(", "));
console.log("--- DB Connection Setup End ---");

// Neonサーバーレスアダプターの初期化
const pool = new Pool(poolConfig as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new PrismaClient({ adapter: adapter as any });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
