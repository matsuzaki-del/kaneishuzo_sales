import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon Serverless driver の設定
if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// --- データベース接続情報の取得と正規化 ---
console.log("--- DB Connection Setup (Standard) ---");

const getSafeEnv = (key: string): string => {
    const original = process.env[key];
    if (typeof original !== "string") return "";
    // 全角スペースも含む空白を完全に除去
    return original.trim().replace(/[\s\u3000]/g, "");
};

// 1. 各種接続成分の抽出
const host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || "ep-snowy-heart-ai9cc23s-pooler.c-4.us-east-1.aws.neon.tech";
const user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || "neondb_owner";
const pass = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || "npg_3Pe2ZjLTXsbW";
const db = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "neondb";

// 2. 接続情報の決定 (パラメータから直接組み立てるのが最も安全)
const connectionString = `postgresql://${user}:${pass}@${host}/${db}?sslmode=require`;

// 3. 環境変数の同期
process.env.DATABASE_URL = connectionString;
process.env.PGHOST = host;
process.env.PGUSER = user;
process.env.PGPASSWORD = pass;
process.env.PGDATABASE = db;

console.log(`✅ DB URL length: ${connectionString.length}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
// 最もシンプルな Pool 初期化
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter: adapter as any
    });
/* eslint-enable @typescript-eslint/no-explicit-any */

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
