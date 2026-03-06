import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

async function main() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query('SELECT COUNT(*) FROM "MonthlySales"');
        console.log(`📊 Total records in MonthlySales: ${res.rows[0].count}`);

        if (parseInt(res.rows[0].count) > 0) {
            const samples = await client.query('SELECT * FROM "MonthlySales" LIMIT 2');
            console.log("📝 Sample records:", JSON.stringify(samples.rows, null, 2));
        }
    } catch (err) {
        console.error("❌ Error connecting or querying:", err);
    } finally {
        await client.end();
    }
}

main();
