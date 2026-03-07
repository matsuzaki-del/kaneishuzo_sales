import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 接続文字列の候補リスト（標準的な名前を優先）
const envVars = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASEURL_DATABASE_URL",
    "DATABASEURL_POSTGRES_PRISMA_URL",
    "DATABASEURL_POSTGRES_URL",
    "DATABASEURL_DATABASE_URL_UNPOOLED",
    "DATABASEURL_POSTGRES_URL_NON_POOLING"
];

let connectionString = "";
let foundVar = "";

for (const envVar of envVars) {
    const val = process.env[envVar];
    if (val && val.trim() !== "") {
        connectionString = val.trim();
        foundVar = envVar;
        break;
    }
}

if (!connectionString) {
    const checked = envVars.join(", ");
    console.error(`❌ No database connection string found. Checked: ${checked}`);
    throw new Error("DATABASE_CONNECTION_ERROR: Connection string is missing.");
} else {
    // セキュリティのため先頭部分のみログ出力
    const masked = connectionString.substring(0, 15) + "...";
    console.log(`✅ Using connection string from: ${foundVar} (${masked})`);
}

// Neonサーバーレスアダプターの初期化
// オブジェクト形式ではなく直接文字列を渡すことで、pgドライバのパースエラーを回避
const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon(pool as any);

export const prisma =
    globalForPrisma.prisma ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new PrismaClient({ adapter: adapter as any });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
