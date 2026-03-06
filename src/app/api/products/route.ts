import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
    try {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthStr = nextMonth.toISOString().slice(0, 7);

        // 全銘柄の直近実績、予測、戦略を取得
        const products = await (prisma.product as any).findMany({
            include: {
                sales: {
                    orderBy: { month: 'desc' },
                    take: 2
                },
                forecasts: {
                    where: { month: nextMonthStr },
                    take: 1
                },
                strategies: {
                    where: { category: 'AI_GENERATED' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const data = (products as any[]).map((product: any) => {
            const current = product.sales[0]?.quantity || 0;
            const previous = product.sales[1]?.quantity || 0;
            const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;
            const forecast = product.forecasts[0]?.quantity || 0;
            const strategy = product.strategies[0] ? {
                title: product.strategies[0].title,
                content: product.strategies[0].content,
                priority: product.strategies[0].priority
            } : null;

            return {
                id: product.id,
                name: product.name,
                category: product.category,
                currentMonthActual: current,
                nextMonthForecast: forecast,
                diff: diff,
                strategy: strategy,
                status: diff >= 0 ? 'in-progress' : 'warning'
            };
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to fetch products sales:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
