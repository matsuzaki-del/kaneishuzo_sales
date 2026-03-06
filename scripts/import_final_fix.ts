import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

// 接続文字列を取得
const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    console.log("🚀 Starting data import (Fixing Root Cause: ID type mismatch)...");

    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        console.log("✅ DB Connected.");
    } catch (e) {
        console.error("❌ DB Connection Error:", e);
        process.exit(1);
    }

    const csvPath = path.join(process.cwd(), '..', 'monthly_sales_summary.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
    });

    console.log(`📊 Total records to process: ${records.length}`);

    // インポート前に一度テーブルを空にする場合
    // await client.query('TRUNCATE TABLE "MonthlySales"');

    const BATCH_SIZE = 500; // 安全のために500件ずつ
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, records.length - i);
        const batch = records.slice(i, i + batchSize);

        try {
            // idカラムを省略してPostgresの自動採番に任せる
            // カラム名はダブルクォートで正確に囲む
            let query = 'INSERT INTO "MonthlySales" ("month", "productName", "quantity", "createdAt", "updatedAt") VALUES ';
            const values: any[] = [];

            batch.forEach((r, idx) => {
                const base = idx * 5; // 5カラム分
                query += `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})${idx === batchSize - 1 ? '' : ','}`;

                const now = new Date();
                values.push(
                    r.Month || "2000-01",
                    r.ProductName || "不明",
                    parseFloat(r.Quantity) || 0,
                    now,
                    now
                );
            });

            await client.query(query, values);
            if ((i + batchSize) % 5000 === 0 || i + batchSize === records.length) {
                console.log(`✅ Progress: ${i + batchSize} / ${records.length}`);
            }
        } catch (error) {
            console.error(`❌ Batch starting at ${i} failed:`, error);
            // 最初のエラーで止める
            break;
        }
    }

    console.log("✨ Import complete!");

    // 最終件数確認
    const finalCount = await client.query('SELECT COUNT(*) FROM "MonthlySales"');
    console.log(`📊 Final record count: ${finalCount.rows[0].count}`);

    await client.end();
}

main();
