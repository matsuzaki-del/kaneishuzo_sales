import pg from 'pg';
import 'dotenv/config';

const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'MonthlySales'
    `);
        console.log("Columns in MonthlySales:", res.rows);
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
