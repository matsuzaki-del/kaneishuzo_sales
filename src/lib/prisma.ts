import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Neon Serverless driver の設定: HTTP Fetch を使用 (WebSocketおよびそれに伴う型エラーを回避)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(neonConfig as any).poolQueryViaFetch = true;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Exhaustive & HTTP Mode) ---");

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
            console.log(`🚀 Found valid URL in: ${key} `);
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
    console.error("❌ CRITICAL: No DB connection info available in environment.");
    console.log("Available Env Keys:", Object.keys(process.env).filter(k => k.includes("DATABASE") || k.includes("POSTGRES") || k.includes("URL")).join(", "));
    throw new Error("DATABASE_CONFIG_NOT_FOUND");
}

console.log(`✅ Ready to connect (Length: ${finalUrl.length})`);

// 3. プロセス環境変数を確定 (Prisma 7 内部用)
process.env.DATABASE_URL = finalUrl;

/* eslint-disable @typescript-eslint/no-explicit-any */
// Pool 初期化 (HTTP Fetch モード)
const pool = new Pool({ connectionString: finalUrl });
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });
/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
