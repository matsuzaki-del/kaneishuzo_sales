import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        // 全商品の月別合計売上を取得
        const sales = await prisma.monthlySales.groupBy({
            by: ['month'],
            _sum: {
                quantity: true
            },
            orderBy: {
                month: 'asc'
            }
        });

        // フロントエンドの AreaChart 形式に整形
        const chartData = sales.map((s: any) => ({
            month: s.month,
            actual: s._sum.quantity || 0,
            // 予測値は一旦 null または 0 で返す（後ほど AI 連携で埋める）
            forecast: null
        }));

        return NextResponse.json(chartData);
    } catch (error) {
        console.error("Failed to fetch sales data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
