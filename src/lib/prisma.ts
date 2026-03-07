import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool as PgPool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Prisma v7 + adapter-pg Mode) ---");

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
        // Vercel のビルド時（データ収集フェーズ）は環境変数が未設定でトップレベル評価されることがあるため、
        // ここではエラーを投げず、警告ログにとどめます。実際の接続時（ランタイム）に失敗します。
        console.warn(
            "⚠️ WARNING: DB接続文字列が見つかりません。ビルド時、または環境設定漏れの可能性があります。\n" +
            `検出された環境変数: ${envKeys.join(", ") || "なし"}`
        );
    }

    // Prisma v7 では Adapter が必須です。
    // Node.js 環境（edge ではない）ため、安定した標準の pg モジュールを使用します。
    // Neon Serverless (webSocket) のバンドル起因の接続情報喪失バグを回避します。
    console.log("✅ Using Standard pg Pool (adapter-pg)");

    const pool = new PgPool({
        connectionString,
        // Prisma v7 でのプールの安定性確保
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
