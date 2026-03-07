import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
    try {
        // デバッグ用に接続確認
        await prisma.$connect();

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
        const chartData = sales.map((s: { month: string; _sum: { quantity: number | null } }) => ({
            month: s.month,
            actual: s._sum.quantity || 0,
            forecast: null
        }));

        return NextResponse.json(chartData);
    } catch (error) {
        console.error("Failed to fetch sales data:", error);
        return NextResponse.json({
            error: "Database Connection Error",
            details: error instanceof Error ? error.message : String(error),
            code: (error as { code?: string })?.code
        }, { status: 500 });
    }
}
