import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST() {
    try {
        // 1. 全銘柄と過去の実績を取得
        const products = await (prisma.product as any).findMany({
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
        const dataString = products.map((p: any) => {
            const salesHistory = p.sales.map((s: any) => `${s.month}: ${s.quantity}`).join(", ");
            return `銘柄: ${p.name} (Code: ${p.code})\n実績: ${salesHistory || "なし"}`;
        }).join("\n\n");

        const currentMonth = new Date().toISOString().slice(0, 7);
        // 来月の月文字列を計算 (簡易的)
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const nextMonth = d.toISOString().slice(0, 7);

        const prompt = `
あなたは老舗酒造店「金井酒造店」のAI経営・営業コンサルタントです。
以下の各銘柄の過去の月別売上データに基づき、次月（${nextMonth}）の需要予測と、売上目標達成のための具体的な「銘柄別営業アクション」を提案してください。

【過去のデータ（銘柄別）】
${dataString}

【要件】
1. 各銘柄について、次月の販売予測本数を算出してください。
2. 重点的に取り組むべき銘柄について、具体的な営業アクションを提案してください。
   アクションには「どこで（例：居酒屋、地酒専門店）」「どのように（例：飲み比べセットの提案）」といった具体性を持たせてください。
3. 全体的な月次営業方針も1つ含めてください。

【出力形式（JSONのみ）】
{
  "forecasts": [
    { "productId": "id", "productName": "名前", "forecast": 数値 }
  ],
  "brandStrategies": [
    { "productId": "id", "title": "アクション名", "content": "具体的な説明", "priority": "HIGH|MEDIUM|INFO" }
  ],
  "overallAdvice": "全体の月次方針"
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
                    await (prisma.forecast as any).upsert({
                        where: { month_productId: { month: nextMonth, productId: f.productId } },
                        update: { quantity: f.forecast },
                        create: { month: nextMonth, productId: f.productId, quantity: f.forecast }
                    });
                }
            }
        }

        // 営業戦略の保存
        const allStrategies = [];

        // 銘柄別
        if (aiResponse.brandStrategies && Array.isArray(aiResponse.brandStrategies)) {
            for (const s of aiResponse.brandStrategies) {
                allStrategies.push({
                    month: currentMonth,
                    productId: s.productId,
                    title: s.title || "銘柄別施策",
                    content: s.content,
                    priority: s.priority || "MEDIUM",
                    category: "AI_GENERATED",
                    status: "PENDING"
                });
            }
        }

        // 全体方針
        if (aiResponse.overallAdvice) {
            allStrategies.push({
                month: currentMonth,
                title: "今月の全体方針",
                content: aiResponse.overallAdvice,
                priority: "HIGH",
                category: "AI_GENERATED",
                status: "ACTIVE"
            });
        }

        if (allStrategies.length > 0) {
            // 当月の既存AI生成施策をクリア
            await (prisma.salesStrategy as any).deleteMany({
                where: { month: currentMonth, category: "AI_GENERATED" }
            });

            // まとめて作成
            await (prisma.salesStrategy as any).createMany({
                data: allStrategies
            });
        }

        return NextResponse.json(aiResponse);
    } catch (error) {
        console.error("AI Forecast failed:", error);
        return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
    }
}
