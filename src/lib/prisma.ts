import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Individual Parameter Mode) ---");

/**
 * 環境変数を安全に取得し、空白を除去する
 */
const getSafeEnv = (key: string): string => {
  const val = process.env[key];
  if (typeof val !== "string") return "";
  return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * 文字列または各成分から接続パラメーターを抽出・構築する
 */
const getDatabaseConfig = () => {
  const candidates = [
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "POSTGRES_URL"
  ];

  let connectionString = "";
  for (const k of candidates) {
    const v = getSafeEnv(k);
    if (v && v.startsWith("postgres") && !v.includes("localhost")) {
      connectionString = v;
      console.log(`🚀 Found base configuration in: ${k}`);
      break;
    }
  }

  try {
    let host = "";
    let user = "";
    let password = "";
    let database = "";
    let port = 5432;

    if (connectionString) {
      const u = new URL(connectionString);
      host = u.hostname;
      user = u.username;
      password = decodeURIComponent(u.password);
      database = u.pathname.replace("/", "");
      port = parseInt(u.port || "5432");
    } else {
      // フォールバック: 個別環境変数から取得
      host = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
      user = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
      password = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
      database = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";
      port = parseInt(getSafeEnv("PGPORT") || "5432");
    }

    // --- Neon 特有の認証補正 (ここが最重要) ---
    // ホスト名が neon.tech を含む場合、ユーザー名にエンドポイントIDを強制付与する
    if (host.includes("neon.tech") && user && !user.includes("@")) {
      const endpointId = host.split(".")[0].replace("-pooler", "");
      console.log(`💡 Neon Authentication Fix: Appending @${endpointId} to user`);
      user = `${user}@${endpointId}`;
    }

    return {
      host,
      user,
      password,
      database,
      port,
      ssl: { rejectUnauthorized: false }
    };
  } catch (e) {
    console.error("❌ Failed to parse database configuration:", e);
    return null;
  }
};

const config = getDatabaseConfig();

if (!config || !config.host) {
  console.error("❌ CRITICAL: Incomplete database connection parameters.");
} else {
  console.log(`✅ DB Connection parameters established (Host: ${config.host}, User: ${config.user?.split('@')[0]}... [Augmented])`);
  // プロセス環境変数を更新 (Prisma 内部用)
  const fullUrl = `postgresql://${config.user}:${config.password}@${config.host}/${config.database}?sslmode=require`;
  process.env.DATABASE_URL = fullUrl;
}

// 3. アダプターを使用した Prisma Client の初期化
let client: PrismaClient;

if (config && config.host) {
  const pool = new Pool(config);
  const adapter = new PrismaPg(pool);
  client = new PrismaClient({ adapter });
} else {
  client = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
