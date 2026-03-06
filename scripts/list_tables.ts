import pg from 'pg';
import 'dotenv/config';

const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log("Tables in database:", res.rows.map(r => r.table_name));

        for (const table of res.rows) {
            const countRes = await client.query(`SELECT COUNT(*) FROM "${table.table_name}"`);
            console.log(`- ${table.table_name}: ${countRes.rows[0].count} records`);
        }
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
