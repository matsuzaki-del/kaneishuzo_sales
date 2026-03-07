import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection (Extreme Diagnostics Mode) ---");

const getSafeEnv = (key: string): string => {
  const val = process.env[key];
  if (typeof val !== "string") return "";
  return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * 接続パラメーターの抽出と構築 (詳細ログ付)
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
    const h = getSafeEnv("PGHOST") || getSafeEnv("DATABASEURL_PGHOST");
    const u = getSafeEnv("PGUSER") || getSafeEnv("DATABASEURL_PGUSER");
    const p = getSafeEnv("PGPASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD");
    const d = getSafeEnv("PGDATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || "postgres";
    if (h && u && p) {
      console.log("🚀 Constructing from individual env vars.");
      rawUrl = `postgresql://${u}:${p}@${h}/${d}`;
    }
  }

  if (!rawUrl) {
    console.error("❌ No database URL found in env.");
    return null;
  }

  try {
    const u = new URL(rawUrl);
    let user = decodeURIComponent(u.username);
    const host = u.hostname;
    const database = u.pathname.replace("/", "");
    const port = u.port || "5432";
    const password = decodeURIComponent(u.password);

    // Neon 特有の補正
    if (host.includes("neon.tech") && !user.includes("@")) {
      const ep = host.split(".")[0].replace("-pooler", "");
      user = `${user}@${ep}`;
      console.log(`💡 Applied Neon Augment: ${user}`);
    }

    // 詳細診断ログ (パスワードは伏せる)
    console.log(`--- Diagnostics ---`);
    console.log(`Source: ${sourceKey || "Manual"}`);
    console.log(`Host: ${host}`);
    console.log(`Port: ${port}`);
    console.log(`User: ${user} (Length: ${user.length})`);
    console.log(`DB: ${database}`);
    console.log(`Pass Length: ${password.length}`);
    console.log(`SSL Mode: ${u.searchParams.get("sslmode") || "default"}`);
    console.log(`------------------`);

    return {
      user,
      host,
      database,
      password,
      port: parseInt(port),
      ssl: {
        rejectUnauthorized: false
      }
    };
  } catch (e) {
    console.error("❌ Failed to resolve DB params:", e);
    return null;
  }
};

const params = getDatabaseParams();

if (params) {
  // Prisma 内部/静的生成用の環境変数を「補正済み」で上書き
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
