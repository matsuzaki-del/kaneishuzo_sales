import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url:
            process.env["POSTGRES_PRISMA_URL"] ||
            process.env["DATABASEURL_POSTGRES_PRISMA_URL"] ||
            process.env["DATABASE_URL"] ||
            process.env["DATABASEURL_DATABASE_URL"] ||
            process.env["DATABASEURL_DATABASE_URL_UNPOOLED"] ||
            process.env["POSTGRES_URL"] ||
            process.env["DATABASEURL_POSTGRES_URL"] ||
            process.env["DATABASEURL_POSTGRES_URL_NON_POOLING"],
    },
});
