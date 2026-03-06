import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

// 接続文字列を取得 (UNPOOLED優先)
const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
    console.log("🚀 Debugging import process...");

    try {
        await prisma.$connect();
        console.log("✅ DB Connected.");
    } catch (e) {
        console.error("❌ DB Connection Error:", e);
        process.exit(1);
    }

    const csvPath = path.join(process.cwd(), '..', 'monthly_sales_summary.csv');
    console.log(`📖 Loading CSV from: ${csvPath}`);
    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
    });

    console.log(`📊 First 2 records from CSV:`, JSON.stringify(records.slice(0, 2), null, 2));
    console.log(`📊 Total records: ${records.length}`);

    if (records.length === 0) {
        console.warn("⚠️ No records found in CSV.");
        return;
    }

    // 小さなバッチでテスト実行
    const BATCH_SIZE = 100;
    const testRecords = records.slice(0, 200); // 最初の200件だけテスト

    console.log(`🧪 Running test import for first ${testRecords.length} records...`);

    for (let i = 0; i < testRecords.length; i += BATCH_SIZE) {
        const batch = testRecords.slice(i, i + BATCH_SIZE).map((r: any) => {
            return {
                month: r.Month || "2000-01",
                productName: r.ProductName || "Unknown",
                customerName: r.CustomerName || null,
                category: r.Category || null,
                quantity: parseFloat(r.Quantity) || 0,
                salesAmount: r.SalesAmount ? parseFloat(r.SalesAmount) : null,
                unitPrice: r.UnitPrice ? parseFloat(r.UnitPrice) : null,
            };
        });

        console.log(`📡 Sending batch ${i / BATCH_SIZE + 1}...`);
        try {
            const result = await (prisma.monthlySales as any).createMany({
                data: batch
            });
            console.log(`✅ Batch ${i / BATCH_SIZE + 1} Success! Count: ${result.count}`);
        } catch (error) {
            console.error(`❌ Batch ${i / BATCH_SIZE + 1} Failed:`, error);
        }
    }

    console.log("✨ Test run complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
