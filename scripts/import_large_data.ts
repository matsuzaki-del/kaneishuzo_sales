import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

// 接続文字列を取得
const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
    console.log("🚀 Starting data import with ID generation...");

    try {
        await prisma.$connect();
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

    const BATCH_SIZE = 2000;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, records.length - i);
        const batch = records.slice(i, i + batchSize).map((r: any) => {
            return {
                id: crypto.randomUUID(), // createMany のために明示的にIDを生成
                month: r.Month || "2000-01",
                productName: r.ProductName || "不明",
                customerName: r.CustomerName || null,
                category: r.Category || null,
                quantity: parseFloat(r.Quantity) || 0,
                salesAmount: r.SalesAmount ? parseFloat(r.SalesAmount) : null,
                unitPrice: r.UnitPrice ? parseFloat(r.UnitPrice) : null,
            };
        });

        try {
            await (prisma.monthlySales as any).createMany({
                data: batch
            });
            console.log(`✅ Imported ${i + batchSize} / ${records.length}`);
        } catch (error) {
            console.error(`❌ Batch starting at ${i} failed:`, error);
        }
    }

    console.log("✨ Import complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
