import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import 'dotenv/config';

const connectionString = "postgresql://neondb_owner:npg_3Pe2ZjLTXsbW@ep-snowy-heart-ai9cc23s.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
    const client = new pg.Client({ connectionString });
    await client.connect();

    const csvPath = path.join(process.cwd(), '..', 'monthly_sales_summary.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true }).slice(0, 100);

    console.log(`🧪 Testing with ${records.length} records...`);

    let query = 'INSERT INTO "MonthlySales" ("id", "month", "productName", "quantity", "createdAt", "updatedAt") VALUES ';
    const values: any[] = [];

    records.forEach((r, idx) => {
        const base = idx * 6;
        query += `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})${idx === records.length - 1 ? '' : ','}`;
        const now = new Date();
        values.push(crypto.randomUUID(), r.Month, r.ProductName, parseFloat(r.Quantity) || 0, now, now);
    });

    try {
        await client.query(query, values);
        console.log("✅ Small batch success!");
    } catch (e) {
        console.error("❌ Small batch failed:", e);
    }

    await client.end();
}

main();
