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
      ORDER BY ordinal_position
    `);
        console.log("MonthlySales Columns:");
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
