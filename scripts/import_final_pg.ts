import { Client } from 'pg';
import fs from 'fs';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const MASTER_PATH = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\商品ﾏｽﾀﾘｽﾄ.csv";
const URIKAKE_PATH = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\2101-2602urikakekin_v2.csv";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

async function main() {
    console.log('--- pg ドライバ直接使用による統合インポート開始 ---');
    const client = new Client({ connectionString });
    await client.connect();

    try {
        // 1. 商品マスタ読み込み
        console.log('商品マスタ読み込み中...');
        const masterContent = iconv.decode(fs.readFileSync(MASTER_PATH), 'shift-jis');
        const masterRecords = parse(masterContent, { columns: false, skip_empty_lines: true, from_line: 2 });

        const productsMap = new Map();
        for (const row of masterRecords) {
            const code = row[0]?.trim();
            if (!code) continue;
            productsMap.set(code, { name: row[2]?.trim(), category: row[9]?.trim() });
        }
        console.log(`商品マスタ: ${productsMap.size} 件ロード`);

        // 商品の登録 (UPSERT)
        for (const [code, info] of productsMap.entries()) {
            await client.query(
                `INSERT INTO "Product" (id, name, category, "updatedAt") 
                 VALUES ($1, $2, $3, NOW()) 
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, "updatedAt" = NOW()`,
                [code, (info as any).name, (info as any).category]
            );
        }
        console.log('Productマスタ同期完了');

        // 2. 売掛金データの読み込み
        console.log('売掛金データ読み込み中...');
        const urikakeContent = iconv.decode(fs.readFileSync(URIKAKE_PATH), 'shift-jis');
        const urikakeRecords = parse(urikakeContent, { columns: false, skip_empty_lines: true, from_line: 2 });
        console.log(`売掛金データ: ${urikakeRecords.length} 件`);

        const customerCache = new Map();
        const batchSize = 1000;
        let count = 0;

        for (let i = 0; i < urikakeRecords.length; i += batchSize) {
            const batch = urikakeRecords.slice(i, i + batchSize);

            await client.query('BEGIN');
            try {
                for (const row of batch) {
                    const cName = row[1]?.trim();
                    const dStr = row[2]?.trim();
                    const pCode = row[6]?.trim();
                    const amount = parseFloat(row[15]?.replace(/,/g, '') || "0");
                    const qty = parseFloat(row[13]?.replace(/,/g, '') || "0");

                    if (!cName || !pCode || !dStr) continue;

                    // 得意先
                    let cId = customerCache.get(cName);
                    if (!cId) {
                        const res = await client.query(
                            `INSERT INTO "Customer" (name, "updatedAt") VALUES ($1, NOW()) 
                             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
                            [cName]
                        );
                        cId = res.rows[0].id;
                        customerCache.set(cName, cId);
                    }

                    // 月
                    const parts = dStr.split('/');
                    if (parts.length !== 3) continue;
                    const month = `${parseInt(parts[0]) + 2000}-${parts[1].padStart(2, '0')}`;

                    // 商品がない場合のフォールバック
                    if (!productsMap.has(pCode)) {
                        await client.query(
                            `INSERT INTO "Product" (id, name, "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING`,
                            [pCode, row[7]?.trim() || "不明"]
                        );
                    }

                    await client.query(
                        `INSERT INTO "MonthlySales" (month, quantity, "salesAmount", "customerId", "productId", "updatedAt") 
                         VALUES ($1, $2, $3, $4, $5, NOW())`,
                        [month, qty, amount, cId, pCode]
                    );
                }
                await client.query('COMMIT');
                count += batch.length;
                if (count % 5000 === 0) console.log(`進捗: ${count} / ${urikakeRecords.length}`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        console.log(`--- 完了: ${count} 件インポートしました ---`);

    } finally {
        await client.end();
    }
}

main().catch(console.error);
