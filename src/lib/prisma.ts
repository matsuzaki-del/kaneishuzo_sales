import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Node.js 環境（Vercel Serverless 等）で WebSocket を有効にする
neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Neon Serverless + WebSocket Mode) ---");

// 接続文字列の取得。プーラー（5432 + pgbouncer）用ではなく、直接接続用を優先する。
const connectionString = (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
).trim();

if (!connectionString) {
    console.error("❌ CRITICAL: No connection string found in environment variables.");
} else {
    // 安全なデバッグ（パスワードを除いて表示）
    try {
        const url = new URL(connectionString);
        console.log(`✅ Using Neon Adapter: host=${url.hostname}, protocol=${url.protocol}`);
    } catch {
        console.log(`✅ Using Neon Adapter (URL Length: ${connectionString.length})`);
    }
}

let client: PrismaClient;

if (connectionString) {
    // Neon 公式のサーバーレスドライバを使用
    const neonPool = new Pool({ connectionString });
    // 型不整合を回避するために any キャストを使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeon(neonPool as any);
    client = new PrismaClient({ adapter });
} else {
    // フォールバック（通常はここに来ないはず）
    client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
