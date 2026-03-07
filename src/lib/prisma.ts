import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 接続文字列候補（引き続き診断に利用）
const envVars = [
    "DATABASEURL_POSTGRES_URL_NO_SSL",
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASEURL_POSTGRES_PRISMA_URL"
];

let connectionString = "";
for (const envVar of envVars) {
    const val = process.env[envVar];
    if (val && val.trim() !== "") {
        connectionString = val.replace(/\s/g, "");
        break;
    }
}

// 個別パラメータの取得
const dbConfig = {
    host: process.env.DATABASEURL_POSTGRES_HOST || process.env.DATABASEURL_PGHOST || process.env.DATABASEURL_PGHOST_UNPOOLED,
    user: process.env.DATABASEURL_POSTGRES_USER || process.env.DATABASEURL_PGUSER,
    password: process.env.DATABASEURL_POSTGRES_PASSWORD || process.env.DATABASEURL_PGPASSWORD,
    database: process.env.DATABASEURL_POSTGRES_DATABASE || process.env.DATABASEURL_PGDATABASE || "neondb",
    port: 5432,
};

if (dbConfig.host && dbConfig.user && dbConfig.password) {
    console.log(`✅ Using individual DB parameters. Host: ${dbConfig.host.substring(0, 10)}...`);
} else if (connectionString) {
    console.log("✅ Using connection string as fallback.");
} else {
    throw new Error("DATABASE_CONNECTION_ERROR: No connection parameters available.");
}

// Neonサーバーレスアダプターの初期化
const pool = new Pool({
    ...(connectionString ? { connectionString } : dbConfig),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new PrismaClient({ adapter: adapter as any });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
