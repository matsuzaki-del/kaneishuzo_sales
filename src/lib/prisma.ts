import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Vercel Postgres Mode) ---");

/**
 * 文字列から全ての制御文字、不可視の空白、全角スペースを除去する
 */
const extremeClean = (val: unknown): string => {
    if (typeof val !== "string") return "";
    let s = val.trim();
    s = s.replace(/[\x00-\x1F\x7F]/g, "");
    s = s.replace(/\u3000/g, "");
    return s;
};

const toHex = (s: string) => {
    return Array.from(s).map(c => `0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(' ');
};

const getDatabaseParams = () => {
    // Vercel 標準の環境変数を最優先で探索する
    const candidates = [
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
        "DATABASE_URL"
    ];
    let rawUrl = "";
    let sourceKey = "";

    for (const k of candidates) {
        const v = process.env[k];
        if (v && typeof v === "string" && v.startsWith("postgres") && !v.includes("localhost")) {
            rawUrl = extremeClean(v);
            sourceKey = k;
            break;
        }
    }

    // フォールバック: DATABASEURL_ プレフィックス
    if (!rawUrl) {
        const fallback = process.env["DATABASEURL_DATABASE_URL"] || process.env["DATABASEURL_POSTGRES_URL"];
        if (fallback && typeof fallback === "string") {
            rawUrl = extremeClean(fallback);
            sourceKey = "DATABASEURL_FALLBACK";
        }
    }

    if (!rawUrl) {
        console.error("❌ No database URL found in env.");
        return null;
    }

    try {
        const u = new URL(rawUrl);
        let user = extremeClean(decodeURIComponent(u.username));
        const host = extremeClean(u.hostname);
        const database = extremeClean(u.pathname.replace("/", ""));
        const port = parseInt(u.port || "5432");
        const password = extremeClean(decodeURIComponent(u.password));

        // バイナリ診断
        const checkStr = (name: string, val: string) => {
            if (!val) return;
            const start = val.slice(0, 2);
            const end = val.slice(-2);
            console.log(`Binary [${name}]: Start[${toHex(start)}] End[${toHex(end)}] (Len:${val.length})`);
        };

        checkStr("User", user);
        checkStr("Pass", password);

        // --- Vercel Postgres / Neon 特有の補正 ---
        if (host.includes("neon.tech") || host.includes("vercel-storage.com")) {
            if (user && !user.includes("@")) {
                const ep = host.split(".")[0].replace("-pooler", "");
                user = `${user}@${ep}`;
                console.log(`💡 Vercel/Neon Augment applied: ${user}`);
            }
        }

        console.log(`✅ Final Route: ${host}:${port}/${database} (Source: ${sourceKey})`);

        return {
            user,
            host,
            database,
            password,
            port,
            ssl: { rejectUnauthorized: false }
        };
    } catch (e) {
        console.error("❌ Failed to parse DB URL:", e);
        return null;
    }
};

const params = getDatabaseParams();

if (params) {
    process.env.DATABASE_URL = `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${params.database}?sslmode=require`;
}

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
