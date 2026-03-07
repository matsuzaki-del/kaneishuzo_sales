import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection Setup (Native Engine: Stable) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
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
            console.log(`🚀 Using URL from: ${k}`);
            return v;
        }
    }
    return null;
};

// 2. パラメータからの手動構成 (フォールバック)
const reconstructUrl = (): string => {
    const h = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
    const u = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
    const p = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
    const d = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

    if (h && u && p) {
        console.log("🚀 Reconstructing URL from parameters.");
        return `postgresql://${u}:${p}@${h}/${d}?sslmode=require`;
    }
    return "";
};

const finalUrl = findUrl() || reconstructUrl();

if (!finalUrl) {
    // ビルドを止めないためのダミー (実行時にエラーになる)
    console.warn("⚠️ No DB connection info found at initialization.");
} else {
    console.log(`✅ Connection string ready (Length: ${finalUrl.length})`);
    // 環境変数を同期 (Prisma エンジンへの予備策)
    process.env.DATABASE_URL = finalUrl;
}

// 3. Prisma Client の初期化
// Prisma 7 で最も確実かつ型エラーが出にくい、明示的な URL 指定を行う
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaOptions: any = {};
if (finalUrl) {
    // Prisma 7.x 互換の datasourceUrl 指定 (型エラー回避のため any キャスト)
    prismaOptions.datasourceUrl = finalUrl;
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
