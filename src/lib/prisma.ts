import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

// Node.js 環境で WebSocket を有効にする（Neon用）
neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Extreme Clean Mode) ---");

// 診断出力: 利用可能な環境変数のキー名を列挙（値は秘匿）
const envKeys = Object.keys(process.env).filter(key =>
    key.startsWith("POSTGRES") || key.startsWith("DATABASE") || key.startsWith("NEON") || key.startsWith("DATABASEURL")
);
console.log(`🔍 Available DB Env Vars: ${envKeys.join(", ")}`);

// Vercel の接続文字列を優先順位順に取得
// DATABASEURL_ 系は Vercel がストレージ統合でリンクした環境変数
const rawConnectionString = (
    process.env.DATABASEURL_DATABASE_URL ||           // Vercel リンク済み変数（最優先）
    process.env.DATABASEURL_DATABASE_URL_UNPOOLED ||  // Vercel リンク済み変数（unpooled）
    process.env.DATABASEURL_POSTGRES_URL_NON_POOLING ||
    process.env.DATABASEURL_POSTGRES_PRISMA_URL ||
    process.env.DATABASEURL_POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
);

// 制御文字のみ削除（\s を除外し、接続文字列の正常な文字が削除されるのを防ぐ）
// eslint-disable-next-line no-control-regex
const connectionString = rawConnectionString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();

if (!connectionString) {
    console.error("❌ CRITICAL: No connection string found. DB接続に必要な環境変数が設定されていません。");
}

function createPrismaClient(): PrismaClient {
    if (!connectionString) {
        // Vercel デプロイ環境では必ず接続文字列が存在するはず
        // ローカル開発時は .env ファイルに DATABASE_URL を設定してください
        throw new Error(
            "DB接続文字列が見つかりません。DATABASE_URL 環境変数を設定してください。\n" +
            `検出された環境変数: ${envKeys.join(", ") || "なし"}`
        );
    }

    const isNeon = connectionString.includes("neon.tech") || connectionString.includes("pooler.vercel-storage.com");
    const isSupabase = connectionString.includes("supabase.com");

    if (isNeon) {
        console.log("✅ Using Neon Serverless Adapter (Cleaned)");
        const neonPool = new NeonPool({ connectionString });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapter = new PrismaNeon(neonPool as any);
        return new PrismaClient({ adapter });
    } else if (isSupabase) {
        console.log("⚠️ Using Supabase (pg adapter)");
        const pgPool = new PgPool({ connectionString });
        const adapter = new PrismaPg(pgPool);
        return new PrismaClient({ adapter });
    } else {
        // その他のPostgreSQL（neon.tech / supabase.com 以外）
        console.log("ℹ️ Using pg adapter (standard PostgreSQL)");
        const pgPool = new PgPool({ connectionString });
        const adapter = new PrismaPg(pgPool);
        return new PrismaClient({ adapter });
    }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
