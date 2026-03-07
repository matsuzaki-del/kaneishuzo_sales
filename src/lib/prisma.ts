import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Neon Endpoint Sync) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * Neon の接続文字列を補正する (user@endpoint-id 形式への変換)
 */
const augmentNeonUrl = (urlStr: string): string => {
    if (!urlStr.includes("neon.tech")) return urlStr;

    try {
        const url = new URL(urlStr);
        // ホスト名からエンドポイントIDを抽出 (例: ep-xxx-pooler.region.aws.neon.tech -> ep-xxx)
        const endpointId = url.hostname.split('.')[0].replace("-pooler", "");

        // ユーザー名に @endpointId が含まれていない場合に付加する
        if (url.username && !url.username.includes("@")) {
            console.log(`💡 Augmenting Neon username with endpoint ID: ${endpointId}`);
            url.username = `${url.username}@${endpointId}`;
            return url.toString();
        }
    } catch (e) {
        console.warn("⚠️ Failed to parse/augment URL:", e);
    }
    return urlStr;
};

/**
 * 接続情報の探索と構築
 */
const findDatabaseUrl = (): string => {
    // 1. 有効な環境変数の探索
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
            return augmentNeonUrl(val);
        }
    }

    // 2. パラメータからの構築
    const host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
    const user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
    const pass = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
    const db = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

    if (host && user && pass) {
        console.log("🚀 Reconstructing URL from individual parameters.");
        const rawUrl = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;
        return augmentNeonUrl(rawUrl);
    }

    return "";
};

const finalUrl = findDatabaseUrl();

if (!finalUrl) {
    console.error("❌ CRITICAL: No DB connection info available.");
    throw new Error("DATABASE_CONFIG_NOT_FOUND");
}

console.log(`✅ DB URL Ready (Length: ${finalUrl.length})`);

// 3. プロセス環境変数を確定 (Prisma Client 内部用)
process.env.DATABASE_URL = finalUrl;

// 4. 標準 PG ドライバによる Pool の初期化
const pool = new Pool({
    connectionString: finalUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
