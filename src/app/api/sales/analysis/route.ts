import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
// Vercel Edge / Serverless でのタイムアウト拡張
export const maxDuration = 60;

export async function GET() {
    try {
        await prisma.$connect();

        // 分析対象：直近数年分（過去3年＋現在）など絞り込む手もあるが、
        // 現時点では全量取得してNode.js側で柔軟に集計するアプローチを採用
        // Product と紐付けてカテゴリ情報を引く
        const salesRecords = await prisma.monthlySales.findMany({
            include: {
                product: {
                    select: {
                        category: true
                    }
                },
                customer: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                month: 'asc'
            }
        });

        // --------------------------------------------------------
        // 1. 月次（Monthly）の集計
        // --------------------------------------------------------
        const monthlyMap = new Map<string, { total: number; categories: Record<string, number>; customers: Record<string, number> }>();
        const yearlyMap = new Map<string, { total: number; categories: Record<string, number>; customers: Record<string, number> }>();

        let latestMonth = "";

        salesRecords.forEach(record => {
            const m = record.month; // "YYYY-MM"
            if (!m) return;
            if (m > latestMonth && m <= "2026-12") { // NOTE: 未来データ（2500年等）の異常値カット想定なら上限を設ける
                latestMonth = m;
            }

            const y = m.substring(0, 4);
            const qty = record.quantity || 0;
            const cat = record.product?.category || "未分類";
            const customerName = record.customer?.name || "不明な取引先";

            // 月次集計
            if (!monthlyMap.has(m)) {
                monthlyMap.set(m, { total: 0, categories: {}, customers: {} });
            }
            const mData = monthlyMap.get(m)!;
            mData.total += qty;
            mData.categories[cat] = (mData.categories[cat] || 0) + qty;
            mData.customers[customerName] = (mData.customers[customerName] || 0) + qty;

            // 年次集計
            if (!yearlyMap.has(y)) {
                yearlyMap.set(y, { total: 0, categories: {}, customers: {} });
            }
            const yData = yearlyMap.get(y)!;
            yData.total += qty;
            yData.categories[cat] = (yData.categories[cat] || 0) + qty;
            yData.customers[customerName] = (yData.customers[customerName] || 0) + qty;
        });

        // 配列化しつつソート
        const monthlySeries = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, actual: data.total, categories: data.categories, customers: data.customers }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const yearlySeries = Array.from(yearlyMap.entries())
            .map(([year, data]) => ({ year, actual: data.total, categories: data.categories, customers: data.customers }))
            .sort((a, b) => a.year.localeCompare(b.year));

        // --------------------------------------------------------
        // 2. KPI計算 (MoM, YoY) 
        // --------------------------------------------------------
        // latestMonth があればそれを基点に計算。データが未来日を含む場合は実際の現在月に補正する等が必要だが、
        // 今回はシンプルに「データ上の最新月」を基点とする。（あるいは前月を基点とするなど要件次第）
        // テストデータによっては2026-03等になる。

        const actualLatestMonth = monthlySeries.length > 0 ? monthlySeries[monthlySeries.length - 1].month : null;

        let currentMonthTotal = 0;
        let prevMonthTotal = 0; // MoM
        let prevYearSameMonthTotal = 0; // YoY

        if (actualLatestMonth) {
            currentMonthTotal = monthlyMap.get(actualLatestMonth)?.total || 0;

            // 前月の計算 (YYYY-MM の減算)
            const [yStr, mStr] = actualLatestMonth.split('-');
            let prevYearNum = parseInt(yStr);
            let prevMonthNum = parseInt(mStr) - 1;
            if (prevMonthNum === 0) {
                prevMonthNum = 12;
                prevYearNum -= 1;
            }
            const prevMonthKey = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`;
            prevMonthTotal = monthlyMap.get(prevMonthKey)?.total || 0;

            // 昨対同月の計算 (YYYY-1 - MM)
            const yoyKey = `${parseInt(yStr) - 1}-${mStr}`;
            prevYearSameMonthTotal = monthlyMap.get(yoyKey)?.total || 0;
        }

        const momChange = prevMonthTotal > 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
        const yoyChange = prevYearSameMonthTotal > 0 ? ((currentMonthTotal - prevYearSameMonthTotal) / prevYearSameMonthTotal) * 100 : 0;

        return NextResponse.json({
            monthly: monthlySeries,
            yearly: yearlySeries,
            kpi: {
                latestMonth: actualLatestMonth,
                currentSales: currentMonthTotal,
                momChange,
                yoyChange
            }
        });

    } catch (error) {
        console.error("Failed to fetch analysis data:", error);
        return NextResponse.json({
            error: "Data Calculation Error",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
