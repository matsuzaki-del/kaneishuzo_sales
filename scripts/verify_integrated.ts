import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('--- 最終データ検証 ---');

    // 1. 各テーブルの件数確認
    const customerCount = await prisma.customer.count();
    const productCount = await prisma.product.count();
    const salesCount = await prisma.monthlySales.count();

    console.log(`得意先数: ${customerCount}`);
    console.log(`商品数: ${productCount}`);
    console.log(`実績明細数: ${salesCount}`);

    // 2. 製成種別（カテゴリー）ごとの売上集計
    console.log('\n製成種別ごとの売上集計 (上位5件):');
    const categorySales = await prisma.monthlySales.groupBy({
        by: ['productId'],
        _sum: {
            salesAmount: true
        }
    });

    // カテゴリー名（製成）を取得して集計
    const products = await prisma.product.findMany({
        select: { id: true, category: true }
    });
    const catMap = new Map(products.map(p => [p.id, p.category || '未設定']));

    const summary: Record<string, number> = {};
    for (const item of categorySales) {
        const cat = catMap.get(item.productId) || '未設定';
        summary[cat] = (summary[cat] || 0) + (item._sum.salesAmount || 0);
    }

    Object.entries(summary)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, amount]) => {
            console.log(`${cat}: ${Math.round(amount).toLocaleString()} 円`);
        });

    console.log('\n--- 検証完了 ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
