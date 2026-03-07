import "dotenv/config";
import { defineConfig } from "prisma/config";

// Vercel の標準的な接続プールの環境変数を最優先する
const databaseUrl =
    process.env.DATABASEURL_DATABASE_URL ||
    process.env.DATABASEURL_DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: (databaseUrl || "").trim(),
    },
});
