import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

async function main() {
    const client = new Client({ connectionString });
    await client.connect();

    try {
        console.log('--- DB登録状況確認 ---');

        const resStats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM "Customer") as customers,
                (SELECT COUNT(*) FROM "Product") as products,
                (SELECT COUNT(*) FROM "MonthlySales") as sales
        `);
        console.log(`得意先数: ${resStats.rows[0].customers}`);
        console.log(`商品数: ${resStats.rows[0].products}`);
        console.log(`実績明細数: ${salesCount = resStats.rows[0].sales}`);

        console.log('\n--- 製成種別ごとの売上集計 ---');
        const resCat = await client.query(`
            SELECT p.category, SUM(s."salesAmount") as total
            FROM "MonthlySales" s
            JOIN "Product" p ON s."productId" = p.id
            GROUP BY p.category
            ORDER BY total DESC
        `);

        resCat.rows.forEach(row => {
            console.log(`${(row.category || '未設定').padEnd(15)}: ${Math.round(row.total).toLocaleString()} 円`);
        });

    } finally {
        await client.end();
    }
}

main().catch(console.error);
