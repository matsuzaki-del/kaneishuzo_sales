import "dotenv/config";
import { defineConfig } from "prisma/config";

const getEnv = (key: string) => (process.env[key] || "").trim().replace(/\s/g, "");

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url:
            getEnv("DATABASEURL_POSTGRES_URL_NO_SSL") ||
            getEnv("DATABASE_URL") ||
            getEnv("POSTGRES_PRISMA_URL") ||
            getEnv("POSTGRES_URL") ||
            getEnv("DATABASEURL_DATABASE_URL") ||
            getEnv("DATABASEURL_POSTGRES_PRISMA_URL") ||
            getEnv("DATABASEURL_POSTGRES_URL") ||
            getEnv("DATABASEURL_DATABASE_URL_UNPOOLED") ||
            getEnv("DATABASEURL_POSTGRES_URL_NON_POOLING"),
    },
});
