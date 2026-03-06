import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import 'dotenv/config';

// 接続文字列を取得
const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    console.log("🚀 Starting data import via standard pg driver...");

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

    console.log(`📊 Total records: ${records.length}`);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, records.length - i);
        const batch = records.slice(i, i + batchSize);

        try {
            // パラメータ化クエリを構築 (カラム名をダブルクォートで囲む)
            let query = 'INSERT INTO "MonthlySales" ("id", "month", "productName", "quantity", "createdAt", "updatedAt") VALUES ';
            const values: any[] = [];

            batch.forEach((r, idx) => {
                const base = idx * 6;
                query += `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})${idx === batchSize - 1 ? '' : ','}`;

                const now = new Date();
                values.push(
                    crypto.randomUUID(),
                    r.Month || "2000-01",
                    r.ProductName || "不明",
                    parseFloat(r.Quantity) || 0,
                    now,
                    now
                );
            });

            await client.query(query, values);
            console.log(`✅ Imported ${i + batchSize} / ${records.length}`);
        } catch (error) {
            console.error(`❌ Batch starting at ${i} failed:`, error);
            // 致命的なエラーなら止める
            if (i > 0) break;
        }
    }

    console.log("✨ Import via pg complete!");
    await client.end();
}

main();
