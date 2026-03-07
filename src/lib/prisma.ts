import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Secure URL Mode) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * 接続文字列の正規化と補正
 */
const getFinalUrl = () => {
    const candidates = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];
    let rawUrl = "";

    for (const k of candidates) {
        const v = getSafeEnv(k);
        if (v && v.startsWith("postgres") && !v.includes("localhost")) {
            rawUrl = v;
            console.log(`🚀 Found base configuration in: ${k}`);
            break;
        }
    }

    // URL が見つからない場合は個別パラメーターから構築を試みる
    if (!rawUrl) {
        const h = getSafeEnv("PGHOST") || getSafeEnv("DATABASEURL_PGHOST");
        const u = getSafeEnv("PGUSER") || getSafeEnv("DATABASEURL_PGUSER");
        const p = getSafeEnv("PGPASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD");
        const d = getSafeEnv("PGDATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "postgres";
        if (h && u && p) {
            console.log("🚀 Constructing URL from individual parameters.");
            rawUrl = `postgresql://${u}:${p}@${h}/${d}?sslmode=require`;
        }
    }

    if (!rawUrl) return null;

    try {
        // URL オブジェクトを使用してパースと再構成を行う (エスケープの自動化)
        const urlObj = new URL(rawUrl);

        // Neon 特有の補正 (user@endpoint-id)
        if (urlObj.hostname.includes("neon.tech") && !urlObj.username.includes("@")) {
            const endpointId = urlObj.hostname.split(".")[0].replace("-pooler", "");
            console.log(`💡 Neon Fix: Adding @${endpointId} to user`);
            urlObj.username = `${urlObj.username}@${endpointId}`;
        }

        // SSL 強制
        if (!urlObj.searchParams.has("sslmode")) {
            urlObj.searchParams.set("sslmode", "require");
        }

        const final = urlObj.toString();
        console.log(`✅ Connection info ready (Host: ${urlObj.hostname}, DB: ${urlObj.pathname.replace("/", "")})`);
        return final;
    } catch (e) {
        console.error("❌ URL normalized failed:", e);
        return rawUrl;
    }
};

const finalUrl = getFinalUrl();

if (!finalUrl) {
    console.error("❌ CRITICAL: No connection string could be formed.");
} else {
    // 環境変数を上書き (Prisma エンジンや他のパーツ用)
    process.env.DATABASE_URL = finalUrl;
}

// 3. アダプターを使用した Prisma Client の初期化
let client: PrismaClient;

if (finalUrl) {
    const pool = new Pool({
        connectionString: finalUrl,
        ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
