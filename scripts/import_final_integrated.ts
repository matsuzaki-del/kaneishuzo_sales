import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const MASTER_PATH = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\商品ﾏｽﾀﾘｽﾄ.csv";
const URIKAKE_PATH = "g:\\共有ドライブ\\【金井酒造店】営業・配送\\AI用_売掛金元帳\\学習用データ\\2101-2602urikakekin_v2.csv";

// 接続設定を最適化
const prisma = new PrismaClient({
    log: ['error'],
    connectionTimeout: 60000,
});

async function main() {
    console.log('--- 統合インポート開始 (安定版) ---');

    // 1. 商品マスタを読み込み (Shift-JIS)
    console.log('商品マスタを読み込み中...');
    const masterBuffer = fs.readFileSync(MASTER_PATH);
    const masterContent = iconv.decode(masterBuffer, 'shift-jis');
    const masterRecords = parse(masterContent, {
        columns: false,
        skip_empty_lines: true,
        from_line: 2
    });

    const productsMap = new Map();
    for (const row of masterRecords) {
        const code = row[0]?.trim();
        if (!code) continue;
        const name = row[2]?.trim();
        const category = row[9]?.trim();
        productsMap.set(code, { name, category });
    }
    console.log(`商品マスタ: ${productsMap.size} 件ロード完了`);

    // 商品マスタを同期
    console.log('ProductマスタをDBに同期中...');
    const productList = Array.from(productsMap.entries());
    for (let i = 0; i < productList.length; i += 100) {
        const batch = productList.slice(i, i + 100);
        await Promise.all(batch.map(([code, info]) =>
            (prisma.product as any).upsert({
                where: { id: code },
                update: { name: (info as any).name, category: (info as any).category },
                create: { id: code, name: (info as any).name, category: (info as any).category }
            })
        ));
        console.log(`商品同期中... ${Math.min(i + 100, productList.length)} / ${productList.length}`);
    }

    // 2. 売掛金データを読み込み (Shift-JIS)
    console.log('売掛金データ（11.3万件）を読み込み中...');
    const urikakeBuffer = fs.readFileSync(URIKAKE_PATH);
    const urikakeContent = iconv.decode(urikakeBuffer, 'shift-jis');
    const urikakeRecords = parse(urikakeContent, {
        columns: false,
        skip_empty_lines: true,
        from_line: 2
    });

    console.log(`売掛金データ: ${urikakeRecords.length} 件。インポートを開始します...`);

    const customerMap = new Map();
    const batchSize = 500; // 接続負荷を抑えるためにサイズを縮小
    let count = 0;

    for (let i = 0; i < urikakeRecords.length; i += batchSize) {
        const batch = urikakeRecords.slice(i, i + batchSize);
        const salesData: any[] = [];

        for (const row of batch) {
            const customerName = row[1]?.trim();
            const dateStr = row[2]?.trim();
            const productCode = row[6]?.trim();
            const salesAmount = parseFloat(row[15]?.replace(/,/g, '') || "0");
            const quantity = parseFloat(row[13]?.replace(/,/g, '') || "0");

            if (!customerName || !productCode || !dateStr) continue;

            let customerId = customerMap.get(customerName);
            if (!customerId) {
                const customer = await (prisma.customer as any).upsert({
                    where: { name: customerName },
                    update: {},
                    create: { name: customerName }
                });
                customerId = customer.id;
                customerMap.set(customerName, customerId);
            }

            let month = "";
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const year = parseInt(parts[0]) + 2000;
                month = `${year}-${parts[1].padStart(2, '0')}`;
            }
            if (!month) continue;

            if (!productsMap.has(productCode)) {
                await (prisma.product as any).upsert({
                    where: { id: productCode },
                    update: {},
                    create: { id: productCode, name: row[7]?.trim() || "不明な商品" }
                });
                productsMap.set(productCode, true);
            }

            salesData.push({
                month,
                quantity,
                salesAmount,
                customerId,
                productId: productCode
            });
        }

        if (salesData.length > 0) {
            await (prisma.monthlySales as any).createMany({
                data: salesData
            });
            count += salesData.length;
            if (count % 5000 === 0 || count === urikakeRecords.length) {
                console.log(`進捗: ${count} / ${urikakeRecords.length}`);
            }
        }
    }

    console.log(`--- 完了: ${count} 件インポート ---`);
}

main()
    .catch((e) => {
        console.error("Fatal Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect().catch(() => { });
    });
