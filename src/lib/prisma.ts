import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Strict SSL Override Mode) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * 接続パラメーターの抽出と構築
 */
const getDatabaseParams = () => {
    const candidates = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];
    let rawUrl = "";

    for (const k of candidates) {
        const v = getSafeEnv(k);
        if (v && v.startsWith("postgres") && !v.includes("localhost")) {
            rawUrl = v;
            console.log(`🚀 Base config source: ${k}`);
            break;
        }
    }

    if (!rawUrl) {
        const h = getSafeEnv("PGHOST") || getSafeEnv("DATABASEURL_PGHOST");
        const u = getSafeEnv("PGUSER") || getSafeEnv("DATABASEURL_PGUSER");
        const p = getSafeEnv("PGPASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD");
        const d = getSafeEnv("PGDATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "postgres";
        if (h && u && p) {
            rawUrl = `postgresql://${u}:${p}@${h}/${d}`;
        }
    }

    if (!rawUrl) return null;

    try {
        const u = new URL(rawUrl);
        let user = u.username;
        const host = u.hostname;

        // Neon 特有の補正
        if (host.includes("neon.tech") && !user.includes("@")) {
            const ep = host.split(".")[0].replace("-pooler", "");
            console.log(`💡 Neon Augment: user@${ep}`);
            user = `${user}@${ep}`;
        }

        // 接続情報を個別に返却 (Pool オブジェクト形式)
        // connectionString を使うと SSL の優先順位で競合が発生しやすいため。
        return {
            user: decodeURIComponent(user),
            host: host,
            database: u.pathname.replace("/", ""),
            password: decodeURIComponent(u.password),
            port: parseInt(u.port || "5432"),
            // 明示的な SSL 設定
            ssl: {
                rejectUnauthorized: false
            }
        };
    } catch (e) {
        console.error("❌ Failed to resolve DB params:", e);
        return null;
    }
};

const params = getDatabaseParams();

if (!params) {
    console.error("❌ CRITICAL: Database connection information is missing.");
} else {
    console.log(`✅ Connection params established (Host: ${params.host}, User: ${params.user.split('@')[0]}...)`);
    // Prisma 内部/静的生成用の環境変数も更新
    process.env.DATABASE_URL = `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${params.database}?sslmode=require`;
}

// 3. アダプターを使用した Prisma Client の初期化
let client: PrismaClient;

if (params) {
    // connectionString ではなく params オブジェクトを直接渡し、SSL オプションを確定させる
    const pool = new Pool(params);
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
