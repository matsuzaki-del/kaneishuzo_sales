import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon Serverless driver の設定
if (typeof window === "undefined") {
    // ESM/CJS混在環境では ws.default が実際のコンストラクタである場合があるため、補正する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    neonConfig.webSocketConstructor = (ws as any).default || ws;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Final Fix: ws constructor) ---");

const getSafeEnv = (key: string): string => {
    const original = process.env[key];
    if (typeof original !== "string") return "";
    return original.trim().replace(/[\s\u3000]/g, "");
};

// 1. 各種接続成分の抽出
const host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || "ep-snowy-heart-ai9cc23s-pooler.c-4.us-east-1.aws.neon.tech";
const user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || "neondb_owner";
const pass = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || "npg_3Pe2ZjLTXsbW";
const db = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "neondb";

// 2. 最もシンプルな形式で接続情報を確定
const connectionString = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;

// 3. 環境変数の同期 (最上流対策)
process.env.DATABASE_URL = connectionString;
process.env.PGHOST = host;
process.env.PGUSER = user;
process.env.PGPASSWORD = pass;
process.env.PGDATABASE = db;

console.log(`✅ DB URL Ready (Length: ${connectionString.length})`);

/* eslint-disable @typescript-eslint/no-explicit-any */
// Pool の初期化
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });
/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
