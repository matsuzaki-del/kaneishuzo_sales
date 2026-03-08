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
        const monthlyMap = new Map<string, { totalQty: number; totalAmount: number; categoriesQty: Record<string, number>; categoriesAmount: Record<string, number>; customersQty: Record<string, number>; customersAmount: Record<string, number> }>();
        const yearlyMap = new Map<string, { totalQty: number; totalAmount: number; categoriesQty: Record<string, number>; categoriesAmount: Record<string, number>; customersQty: Record<string, number>; customersAmount: Record<string, number> }>();

        let latestMonth = "";
        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        salesRecords.forEach((record: any) => {
            let m = record.month; // "YYYY-MM"
            if (!m) return;

            // 4000年問題の補正（2021年がインポート時に4021年になっている場合等）
            const parts = m.split('-');
            if (parts.length === 2) {
                let yNum = parseInt(parts[0], 10);
                if (yNum >= 4000) {
                    yNum -= 2000;
                    m = `${yNum}-${parts[1]}`;
                }
            }

            if (m > latestMonth && m <= "2026-12") {
                latestMonth = m;
            }

            const y = m.substring(0, 4);
            const qty = record.quantity || 0;
            // salesAmountがNULLまたは0の場合に、単価 * 数量で補完する（集計の正確性向上）
            let amount = record.salesAmount || 0;
            if (amount === 0 && record.unitPrice && record.quantity) {
                amount = record.unitPrice * record.quantity;
            }
            const cat = record.product?.category || "未分類";
            const customerName = record.customer?.name || "不明な取引先";

            // 月次集計
            if (!monthlyMap.has(m)) {
                monthlyMap.set(m, { totalQty: 0, totalAmount: 0, categoriesQty: {}, categoriesAmount: {}, customersQty: {}, customersAmount: {} });
            }
            const mData = monthlyMap.get(m)!;
            mData.totalQty += qty;
            mData.totalAmount += amount;
            mData.categoriesQty[cat] = (mData.categoriesQty[cat] || 0) + qty;
            mData.categoriesAmount[cat] = (mData.categoriesAmount[cat] || 0) + amount;
            mData.customersQty[customerName] = (mData.customersQty[customerName] || 0) + qty;
            mData.customersAmount[customerName] = (mData.customersAmount[customerName] || 0) + amount;

            // 累計
            grandTotalQty += qty;
            grandTotalAmount += amount;

            // 年次集計
            if (!yearlyMap.has(y)) {
                yearlyMap.set(y, { totalQty: 0, totalAmount: 0, categoriesQty: {}, categoriesAmount: {}, customersQty: {}, customersAmount: {} });
            }
            const yData = yearlyMap.get(y)!;
            yData.totalQty += qty;
            yData.totalAmount += amount;
            yData.categoriesQty[cat] = (yData.categoriesQty[cat] || 0) + qty;
            yData.categoriesAmount[cat] = (yData.categoriesAmount[cat] || 0) + amount;
            yData.customersQty[customerName] = (yData.customersQty[customerName] || 0) + qty;
            yData.customersAmount[customerName] = (yData.customersAmount[customerName] || 0) + amount;
        });

        // 配列化しつつソート
        const monthlySeries = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, actual: data.totalQty, actualAmount: data.totalAmount, categories: data.categoriesQty, categoriesAmount: data.categoriesAmount, customers: data.customersQty, customersAmount: data.customersAmount }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const yearlySeries = Array.from(yearlyMap.entries())
            .map(([year, data]) => ({ year, actual: data.totalQty, actualAmount: data.totalAmount, categories: data.categoriesQty, categoriesAmount: data.categoriesAmount, customers: data.customersQty, customersAmount: data.customersAmount }))
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

        let currentMonthAmount = 0;
        let prevMonthAmount = 0;
        let prevYearSameMonthAmount = 0;

        if (actualLatestMonth) {
            const currentData = monthlyMap.get(actualLatestMonth);
            currentMonthTotal = currentData?.totalQty || 0;
            currentMonthAmount = currentData?.totalAmount || 0;

            // 前月の計算 (YYYY-MM の減算)
            const [yStr, mStr] = actualLatestMonth.split('-');
            let prevYearNum = parseInt(yStr, 10);
            let prevMonthNum = parseInt(mStr, 10) - 1;
            if (prevMonthNum === 0) {
                prevMonthNum = 12;
                prevYearNum -= 1;
            }
            const prevMonthKey = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`;
            const prevData = monthlyMap.get(prevMonthKey);
            prevMonthTotal = prevData?.totalQty || 0;
            prevMonthAmount = prevData?.totalAmount || 0;

            // 昨対同月の計算 (YYYY-1 - MM)
            const yoyKey = `${parseInt(yStr, 10) - 1}-${mStr}`;
            const yoyData = monthlyMap.get(yoyKey);
            prevYearSameMonthTotal = yoyData?.totalQty || 0;
            prevYearSameMonthAmount = yoyData?.totalAmount || 0;
        }

        const momChange = prevMonthTotal > 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
        const yoyChange = prevYearSameMonthTotal > 0 ? ((currentMonthTotal - prevYearSameMonthTotal) / prevYearSameMonthTotal) * 100 : 0;

        const momChangeAmount = prevMonthAmount > 0 ? ((currentMonthAmount - prevMonthAmount) / prevMonthAmount) * 100 : 0;
        const yoyChangeAmount = prevYearSameMonthAmount > 0 ? ((currentMonthAmount - prevYearSameMonthAmount) / prevYearSameMonthAmount) * 100 : 0;

        return NextResponse.json({
            monthly: monthlySeries,
            yearly: yearlySeries,
            kpi: {
                latestMonth: actualLatestMonth,
                currentSales: currentMonthTotal,
                currentAmount: currentMonthAmount,
                momChange,
                yoyChange,
                momChangeAmount,
                yoyChangeAmount,
                grandTotal: grandTotalQty,
                grandTotalAmount: grandTotalAmount
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
