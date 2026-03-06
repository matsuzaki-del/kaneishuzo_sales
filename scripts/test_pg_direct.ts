import pg from 'pg';
import crypto from 'crypto';
import 'dotenv/config';

const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        console.log("✅ Connected via pg driver.");

        const id = crypto.randomUUID();
        const now = new Date();

        // MonthlySales テーブルへの直接挿入 (Prisma 7 のスキーマに対応)
        const query = `
      INSERT INTO "MonthlySales" (id, month, "productName", quantity, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
        const values = [id, '2024-01', 'Test Product PG', 123.45, now, now];

        const res = await client.query(query, values);
        console.log("✅ Success! Inserted ID:", res.rows[0].id);

    } catch (err) {
        console.error("❌ pg driver failure:", err);
    } finally {
        await client.end();
    }
}

main();
