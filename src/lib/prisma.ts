import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

// Node.js 環境で WebSocket を有効にする（Neon用）
neonConfig.webSocketConstructor = ws;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Multi-Adapter Mode) ---");

// Vercel Postgres (Neon) の環境変数を最優先する
const connectionString = (
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ""
).trim();

if (!connectionString) {
  console.error("❌ CRITICAL: No connection string found.");
}

let client: PrismaClient;

if (connectionString) {
  const isNeon = connectionString.includes("neon.tech");
  const isSupabase = connectionString.includes("supabase.com");

  if (isNeon) {
    console.log("✅ Using Neon Serverless Adapter");
    const neonPool = new NeonPool({ connectionString });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaNeon(neonPool as any);
    client = new PrismaClient({ adapter });
  } else if (isSupabase) {
    console.log("⚠️ Using Supabase (pg adapter) - Host detected as supabase.com");
    const pgPool = new PgPool({ connectionString });
    const adapter = new PrismaPg(pgPool);
    client = new PrismaClient({ adapter });
  } else {
    // その他のデータベース（標準の PrismaClient 挙動に任せる）
    console.log("ℹ️ Using Standard Prisma Client (Legacy/Other)");
    client = new PrismaClient();
  }
} else {
  client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
