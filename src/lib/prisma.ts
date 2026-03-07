import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Prisma 7 + PG Adapter) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * Neon 接続文字列の補正
 */
const augmentNeonUrl = (urlStr: string): string => {
    if (!urlStr || !urlStr.includes("neon.tech")) return urlStr;
    try {
        const u = new URL(urlStr);
        if (u.username && !u.username.includes("@")) {
            const ep = u.hostname.split(".")[0].replace("-pooler", "");
            console.log(`💡 Neon Fix: Appending @${ep} to user`);
            u.username = `${u.username}@${ep}`;
            return u.toString();
        }
    } catch (e) {
        console.warn("⚠️ URL Augment Error:", e);
    }
    return urlStr;
};

// 1. 環境変数の探索
const findUrl = () => {
    const candidates = [
        "POSTGRES_PRISMA_URL",
        "DATABASE_URL",
        "POSTGRES_URL"
    ];
    for (const k of candidates) {
        const v = getSafeEnv(k);
        if (v && v.startsWith("postgres") && !v.includes("localhost")) {
            console.log(`🚀 Found URL in: ${k}`);
            return augmentNeonUrl(v);
        }
    }
    return null;
};

let dbUrl = findUrl();

// 2. パラメータからの手動構築
if (!dbUrl) {
    const h = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
    const u = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
    const p = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
    const d = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

    if (h && u && p) {
        console.log("🚀 Reconstructing URL from parameters.");
        dbUrl = augmentNeonUrl(`postgresql://${u}:${p}@${h}/${d}?sslmode=require`);
    }
}

if (!dbUrl) {
    console.error("❌ CRITICAL: No database connection info.");
} else {
    console.log(`✅ Connection info established (Length: ${dbUrl.length})`);
    process.env.DATABASE_URL = dbUrl;
}

// 3. アダプターを使用した Prisma Client の初期化
let client: PrismaClient;

if (dbUrl) {
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
