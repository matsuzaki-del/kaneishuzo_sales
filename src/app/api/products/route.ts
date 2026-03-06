import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        // 全銘柄の直近実績を取得
        const products = await prisma.product.findMany({
            include: {
                sales: {
                    orderBy: { month: 'desc' },
                    take: 2
                }
            }
        });

        const data = products.map(product => {
            const current = product.sales[0]?.quantity || 0;
            const previous = product.sales[1]?.quantity || 0;
            const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;

            return {
                id: product.id,
                name: product.name,
                category: product.category,
                currentMonthActual: current,
                diff: diff,
                status: diff >= 0 ? 'in-progress' : 'warning'
            };
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to fetch products sales:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
