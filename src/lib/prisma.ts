import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 接続文字列の候補リスト
const envVars = [
    "POSTGRES_PRISMA_URL",
    "DATABASEURL_POSTGRES_PRISMA_URL",
    "DATABASE_URL",
    "DATABASEURL_DATABASE_URL",
    "DATABASEURL_DATABASE_URL_UNPOOLED",
    "POSTGRES_URL",
    "DATABASEURL_POSTGRES_URL",
    "DATABASEURL_POSTGRES_URL_NON_POOLING"
];

let connectionString = "";
let foundVar = "";

for (const envVar of envVars) {
    if (process.env[envVar]) {
        connectionString = process.env[envVar] as string;
        foundVar = envVar;
        break;
    }
}

if (!connectionString) {
    console.error(`❌ No database connection string found. Checked variables: ${envVars.join(", ")}`);
    // 接続文字列がない場合は、デフォルト値（localhost）による pg の自動 fallback を防ぐため空文字を渡さない
    throw new Error("DATABASE_CONNECTION_ERROR: Connection string is missing in environment variables.");
} else {
    console.log(`✅ Database connection string found in environment variable: ${foundVar}`);
}

// Neonサーバーレスアダプターの初期化
const pool = new Pool({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new PrismaClient({ adapter: adapter as any });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
