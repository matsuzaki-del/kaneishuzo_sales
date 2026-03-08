import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST() {
    try {
        // 1. 全銘柄と過去の実績を取得
        const products = await prisma.product.findMany({
            include: {
                sales: {
                    orderBy: { month: 'asc' },
                    take: 24 // 最大2年分
                }
            }
        });

        if (products.length === 0) {
            return NextResponse.json({ error: "No products found" }, { status: 404 });
        }

        // 2. AI用のデータ文字列を作成（銘柄別）
        const dataString = products.map((p: typeof products[0]) => {
            const salesHistory = p.sales.map((s: typeof products[0]["sales"][0]) => `${s.month}: ${s.quantity}`).join(", ");
            return `銘柄: ${p.name} (ID: ${p.id})\nカテゴリー: ${p.category || "未分類"}\n実績: ${salesHistory || "なし"}`;
        }).join("\n\n");

        const currentMonth = new Date().toISOString().slice(0, 7);
        // 来月の月文字列を計算 (簡易的)
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const nextMonth = d.toISOString().slice(0, 7);

        const prompt = `
あなたは老舗酒造店「金井酒造店」のAI経営・営業コンサルタントです。
以下の各銘柄の過去の月別売上データに基づき、次月（${nextMonth}）の需要予測と、それを基にした「経営の次の一手」を提案してください。

【過去のデータ（銘柄別）】
${dataString}

【要件】
1. 各銘柄について、次月の販売予測本数を算出してください (forecasts)。
2. それらの予測を踏まえた上で、来週の営業方針（どこにどう売り込むか）を立案してください (nextWeekStrategy)。
3. 指定の月（次月）の製造本数の目標数値を銘柄ごとに論理的に算出してください (monthlyProductionTargets)。
4. 週次でどのような在庫がどれくらいあればいいかの推論を行ってください (weeklyInventoryInference)。

【出力形式（JSONのみ）】
{
  "forecasts": [
    { "productId": "id", "productName": "名前", "forecast": 数値 }
  ],
  "nextWeekStrategy": {
    "title": "来週の重点営業方針",
    "content": "具体的な方針やアクション"
  },
  "monthlyProductionTargets": [
    { "productId": "id", "productName": "名前", "target": 数値, "reasoning": "目標設定の理由" }
  ],
  "weeklyInventoryInference": [
    { "productId": "id", "productName": "名前", "requiredInventory": 数値, "reasoning": "推論の理由" }
  ]
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid AI response format");

        const aiResponse = JSON.parse(jsonMatch[0]);

        // 3. データの保存
        // 予測値の保存
        if (aiResponse.forecasts && Array.isArray(aiResponse.forecasts)) {
            for (const f of aiResponse.forecasts) {
                if (f.productId && f.forecast) {
                    await prisma.forecast.upsert({
                        where: { month_productId: { month: nextMonth, productId: f.productId } },
                        update: { quantity: f.forecast },
                        create: { month: nextMonth, productId: f.productId, quantity: f.forecast }
                    });
                }
            }
        }

        // AIの戦略・推論の保存
        const allStrategies = [];

        // 1. 来週の営業方針
        if (aiResponse.nextWeekStrategy) {
            allStrategies.push({
                month: currentMonth,
                title: aiResponse.nextWeekStrategy.title || "来週の営業方針",
                content: aiResponse.nextWeekStrategy.content,
                priority: "HIGH",
                category: "WEEKLY_STRATEGY",
                status: "ACTIVE"
            });
        }

        // 2. 次月の製造目標
        if (aiResponse.monthlyProductionTargets && Array.isArray(aiResponse.monthlyProductionTargets)) {
            for (const t of aiResponse.monthlyProductionTargets) {
                allStrategies.push({
                    month: currentMonth,
                    productId: t.productId,
                    title: `製造目標: ${t.target}本`,
                    content: t.reasoning,
                    priority: "MEDIUM",
                    category: "MONTHLY_PRODUCTION",
                    status: "PENDING"
                });
            }
        }

        // 3. 週次必要在庫推論
        if (aiResponse.weeklyInventoryInference && Array.isArray(aiResponse.weeklyInventoryInference)) {
            for (const i of aiResponse.weeklyInventoryInference) {
                allStrategies.push({
                    month: currentMonth,
                    productId: i.productId,
                    title: `週次適正在庫: ${i.requiredInventory}本`,
                    content: i.reasoning,
                    priority: "INFO",
                    category: "WEEKLY_INVENTORY",
                    status: "PENDING"
                });
            }
        }

        if (allStrategies.length > 0) {
            // 当月の既存AI生成施策をクリア (WEEKLY_STRATEGY, MONTHLY_PRODUCTION, WEEKLY_INVENTORY)
            await prisma.salesStrategy.deleteMany({
                where: {
                    month: currentMonth,
                    category: { in: ["WEEKLY_STRATEGY", "MONTHLY_PRODUCTION", "WEEKLY_INVENTORY", "AI_GENERATED"] }
                }
            });

            // まとめて作成
            await prisma.salesStrategy.createMany({
                data: allStrategies
            });
        }

        return NextResponse.json(aiResponse);
    } catch (error) {
        console.error("AI Forecast failed:", error);
        return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
    }
}
