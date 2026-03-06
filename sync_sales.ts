import { prisma } from "./src/lib/prisma";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

async function syncSalesData() {
    const csvPath = path.resolve("C:/agent/金井酒造店/monthly_sales_summary.csv");
    if (!fs.existsSync(csvPath)) {
        console.error("CSV file not found:", csvPath);
        return;
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
    });

    console.log(`Processing ${records.length} records...`);

    for (const record of records as any[]) {
        const { Month, ProductName, Quantity } = record;
        const qty = parseFloat(Quantity);

        if (isNaN(qty)) continue;

        // 商品の取得または作成（簡易化のためProductNameをキーに、コードはUnknownまたは既存から推測）
        // NOTE: 本来はコードで紐付けるべきだが、サマリーCSVの構造に合わせる
        const product = await prisma.product.upsert({
            where: { code: ProductName }, // 暫定的に名前をコードとして扱うか、集計時にコードを残す修正が必要
            update: { name: ProductName },
            create: {
                code: ProductName,
                name: ProductName
            },
        });

        // 売上データのアップサート
        await prisma.monthlySales.upsert({
            where: {
                month_productId: {
                    month: Month,
                    productId: product.id,
                },
            },
            update: { quantity: qty },
            create: {
                month: Month,
                productId: product.id,
                quantity: qty,
            },
        });
    }

    console.log("Sync completed successfully.");
}

syncSalesData()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
