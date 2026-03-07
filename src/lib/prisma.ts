import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection Diagnostics (Final Strategy) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * Neon 接続文字列の補正 (user@endpointID)
 */
const fixNeonUrl = (urlStr: string): string => {
    if (!urlStr || !urlStr.includes("neon.tech")) return urlStr;
    try {
        const u = new URL(urlStr);
        const hostname = u.hostname;
        const currentUsername = u.username;

        if (currentUsername && !currentUsername.includes("@")) {
            const ep = hostname.split(".")[0].replace("-pooler", "");
            console.log(`💡 Neon Auth Fix: Appending @${ep} to username`);
            u.username = `${currentUsername}@${ep}`;
            return u.toString();
        }
    } catch (e) {
        console.warn("⚠️ URL Parsing for Neon Fix failed:", e);
    }
    return urlStr;
};

// 1. 環境変数の探索
const findUrl = () => {
    const candidates = [
        "POSTGRES_PRISMA_URL",
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_URL_NON_POOLING",
        "DATABASEURL_POSTGRES_URL_NO_SSL",
        "DATABASEURL_DATABASE_URL"
    ];
    for (const k of candidates) {
        const v = getSafeEnv(k);
        if (v && v.startsWith("postgres") && !v.includes("localhost")) {
            console.log(`🚀 Found DB URL candidate in: ${k}`);
            return fixNeonUrl(v);
        }
    }
    return null;
};

let finalUrl = findUrl();

// 2. パラメータからの構築 (フォールバック)
if (!finalUrl) {
    const h = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
    const u = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
    const p = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
    const d = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

    if (h && u && p) {
        console.log("🚀 Reconstructing URL from individual parameters.");
        finalUrl = fixNeonUrl(`postgresql://${u}:${p}@${h}/${d}?sslmode=require`);
    }
}

if (!finalUrl) {
    console.error("❌ CRITICAL: No database connection info found.");
} else {
    console.log(`✅ Connection info established (Length: ${finalUrl.length})`);
    // Prisma エンジンが確実に拾えるように環境変数を更新
    process.env.DATABASE_URL = finalUrl;
}

// 3. Prisma Client の初期化 (ESLint エラー回避のため型定義をバイパス)
/* eslint-disable @typescript-eslint/no-explicit-any */
const prismaOptions: any = {};
if (finalUrl) {
    prismaOptions.datasources = {
        db: {
            url: finalUrl
        }
    };
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient(prismaOptions);
/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
