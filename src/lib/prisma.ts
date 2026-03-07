import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Standard PG Adapter) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * 接続情報の探索と構築
 */
const findDatabaseUrl = (): string => {
    // 1. 有効な環境変数の探索 (優先順位順)
    const envCandidates = [
        "DATABASE_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL",
        "POSTGRES_URL_NON_POOLING",
        "DATABASEURL_POSTGRES_URL_NO_SSL",
        "DATABASEURL_DATABASE_URL",
        "DATABASEURL_POSTGRES_URL"
    ];

    for (const key of envCandidates) {
        const val = getSafeEnv(key);
        if (val && val.startsWith("postgres") && !val.includes("localhost")) {
            console.log(`🚀 Using connection info found in: ${key}`);
            return val;
        }
    }

    // 2. パラメータからの手動構築 (フォールバック)
    const host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
    const user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
    const pass = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
    const db = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

    if (host && user && pass) {
        console.log("🚀 Reconstructing URL from individual parameters.");
        return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
    }

    return "";
};

const finalUrl = findDatabaseUrl();

if (!finalUrl) {
    console.error("❌ CRITICAL: No DB connection info available.");
    throw new Error("DATABASE_CONFIG_NOT_FOUND");
}

console.log(`✅ DB Connection Setup Complete (Length: ${finalUrl.length})`);

// 3. プロセス環境変数を確定 (Prisma Client 内部用)
process.env.DATABASE_URL = finalUrl;

// 4. 標準 PG ドライバによる Pool の初期化 (SSL 有効化)
const pool = new Pool({
    connectionString: finalUrl,
    ssl: {
        rejectUnauthorized: false // Cloud型DB (Neonなど) 用の一般的な設定
    }
});

const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
