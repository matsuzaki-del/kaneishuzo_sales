import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Binary Clean Mode) ---");

/**
 * 文字列から全ての制御文字、不可視の空白、全角スペースを除去する
 */
const extremeClean = (val: any): string => {
    if (typeof val !== "string") return "";
    // 1. 前後の空白除去
    let s = val.trim();
    // 2. 制御文字 ([\x00-\x1F\x7F]) の完全除去
    s = s.replace(/[\x00-\x1F\x7F]/g, "");
    // 3. 全角スペースの除去
    s = s.replace(/\u3000/g, "");
    return s;
};

const toHex = (s: string) => {
    return Array.from(s).map(c => `0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(' ');
};

const getDatabaseParams = () => {
    const candidates = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];
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

    if (!rawUrl) {
        console.error("❌ No database URL found.");
        return null;
    }

    try {
        const u = new URL(rawUrl);
        let user = extremeClean(decodeURIComponent(u.username));
        let host = extremeClean(u.hostname);
        const database = extremeClean(u.pathname.replace("/", ""));
        let port = parseInt(u.port || "5432");
        const password = extremeClean(decodeURIComponent(u.password));

        // バイナリ診断 (最初と最後の2文字ずつ)
        const checkStr = (name: string, val: string) => {
            if (!val) return;
            const start = val.slice(0, 2);
            const end = val.slice(-2);
            console.log(`Binary [${name}]: Start[${toHex(start)}] End[${toHex(end)}] (Len:${val.length})`);
        };

        checkStr("User", user);
        checkStr("Pass", password);

        // --- Supabase / Supavisor 特有の補正 ---
        if (host.includes("pooler.supabase.com")) {
            if (port === 5432) {
                console.log("💡 Supabase detected on 5432. Switching to 6543 (Transaction Mode) for reliability.");
                port = 6543;
            }
        }

        // --- Neon 特有の補正 ---
        if (host.includes("neon.tech") && !user.includes("@")) {
            const ep = host.split(".")[0].replace("-pooler", "");
            user = `${user}@${ep}`;
            console.log(`💡 Neon Augment applied: ${user}`);
        }

        console.log(`✅ Final Config: ${host}:${port}/${database} (User: ${user.split('.')[0]}...)`);

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
