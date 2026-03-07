import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Deep Analytics Mode) ---");

const getSafeEnv = (key: string): string => {
    const val = process.env[key];
    if (typeof val !== "string") return "";
    // 前後の空白と全角スペースのみ除去 (URL内の記号は維持)
    return val.trim().replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
};

/**
 * 接続パラメーターの抽出と詳細診断
 */
const getDatabaseParams = () => {
    const candidates = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];
    let rawUrl = "";
    let sourceKey = "";

    for (const k of candidates) {
        const v = getSafeEnv(k);
        if (v && v.startsWith("postgres") && !v.includes("localhost")) {
            rawUrl = v;
            sourceKey = k;
            break;
        }
    }

    if (!rawUrl) {
        console.error("❌ No database URL found in env.");
        return null;
    }

    // 秘密情報の秘匿処理 (ログ用)
    const maskedUrl = rawUrl.replace(/:([^:@]+)@/, ":****@");
    console.log(`--- Raw Data Diagnostics ---`);
    console.log(`Source: ${sourceKey}`);
    console.log(`Masked URL: ${maskedUrl}`);

    try {
        const u = new URL(rawUrl);
        let user = decodeURIComponent(u.username);
        const host = u.hostname;
        const database = u.pathname.replace("/", "");
        const portStr = u.port || "5432";
        const password = decodeURIComponent(u.password);

        // ネームパース診断
        console.log(`User Check: [${user.charAt(0)}...${user.charAt(user.length - 1)}] (L:${user.length})`);
        console.log(`Pass Check: [${password.charAt(0)}...${password.charAt(password.length - 1)}] (L:${password.length})`);

        // Supabase Pooler への最適化助言
        if (host.includes("pooler.supabase.com") && portStr === "5432") {
            console.warn("⚠️ Warning: Supabase pooler on port 5432 (Session mode). If this fails, specify port 6543 (Transaction mode) in your env.");
        }

        // Neon 特有の補正
        if (host.includes("neon.tech") && !user.includes("@")) {
            const ep = host.split(".")[0].replace("-pooler", "");
            user = `${user}@${ep}`;
            console.log(`💡 Applied Neon Augment: ${user}`);
        }

        return {
            user,
            host,
            database,
            password,
            port: parseInt(portStr),
            ssl: {
                rejectUnauthorized: false
            }
        };
    } catch (e) {
        console.error("❌ Failed to parse raw URL:", e);
        return null;
    }
};

const params = getDatabaseParams();

if (params) {
    process.env.DATABASE_URL = `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${params.database}?sslmode=require`;
}

// 3. アダプターを使用した Prisma Client の初期化
let client: PrismaClient;

if (params) {
    const pool = new Pool(params);
    const adapter = new PrismaPg(pool);
    client = new PrismaClient({ adapter });
} else {
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
