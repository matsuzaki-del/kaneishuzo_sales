import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

console.log("--- DB Connection Diagnostics (Native Engine) ---");

// 診断: 関連する環境変数名のリスト (値は秘匿)
const envNames = Object.keys(process.env).filter(k => 
  k.includes("DATABASE") || k.includes("POSTGRES") || k.includes("URL") || k.includes("NEON")
);
console.log("Relevant Env Names:", envNames.join(", "));

const getSafeEnv = (key: string): string => {
  const val = process.env[key];
  if (typeof val !== "string") return "";
  return val.trim().replace(/[\s\u3000]/g, "");
};

/**
 * Neon 接続文字列の補正
 */
const fixNeonUrl = (urlStr: string): string => {
  if (!urlStr || !urlStr.includes("neon.tech")) return urlStr;
  try {
    const u = new URL(urlStr);
    if (u.username && !u.username.includes("@")) {
      const ep = u.hostname.split(".")[0].replace("-pooler", "");
      console.log(`💡 Neon Fix: Appending @${ep} to user`);
      u.username = `${u.username}@${ep}`;
      return u.toString();
    }
  } catch (e) {
    console.warn("⚠️ Neon Fix Error:", e);
  }
  return urlStr;
};

// 1. 接続URLの探索
const findUrl = () => {
  const candidates = [
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASEURL_POSTGRES_URL_NO_SSL",
    "DATABASEURL_DATABASE_URL"
  ];
  for (const k of candidates) {
    const v = getSafeEnv(k);
    if (v && v.startsWith("postgres") && !v.includes("localhost")) {
      console.log(`🚀 Found DB URL in: ${k}`);
      return fixNeonUrl(v);
    }
  }
  return null;
};

let finalUrl = findUrl();

// 2. パラメータからの構築 (フォールバック)
if (!finalUrl) {
  const h = getSafeEnv("DATABASEURL_POSTGRES_HOST") || getSafeEnv("DATABASEURL_PGHOST") || getSafeEnv("PGHOST");
  const u = getSafeEnv("DATABASEURL_POSTGRES_USER") || getSafeEnv("DATABASEURL_PGUSER") || getSafeEnv("PGUSER");
  const p = getSafeEnv("DATABASEURL_POSTGRES_PASSWORD") || getSafeEnv("DATABASEURL_PGPASSWORD") || getSafeEnv("PGPASSWORD");
  const d = getSafeEnv("DATABASEURL_POSTGRES_DATABASE") || getSafeEnv("DATABASEURL_PGDATABASE") || getSafeEnv("PGDATABASE") || "neondb";

  if (h && u && p) {
    console.log("🚀 Reconstructing URL from individual parameters.");
    finalUrl = fixNeonUrl(`postgresql://${u}:${p}@${h}/${d}?sslmode=require`);
  }
}

if (!finalUrl) {
  console.error("❌ CRITICAL: No database connection info found.");
} else {
  console.log(`✅ Final DB URL Ready (Length: ${finalUrl.length})`);
  process.env.DATABASE_URL = finalUrl;
}

// ネイティブの Prisma Client を使用
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    datasources: {
      db: {
        url: finalUrl || undefined
      }
    }
  } as any);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
