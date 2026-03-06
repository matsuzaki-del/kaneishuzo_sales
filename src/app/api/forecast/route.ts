import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST() {
    try {
        // 過去1年分の月別売上データを取得
        const historicalSales = await prisma.monthlySales.groupBy({
            by: ['month'],
            _sum: {
                quantity: true
            },
            orderBy: {
                month: 'asc'
            },
            take: 12
        });

        const dataString = historicalSales.map(s => `${s.month}: ${s._sum.quantity}`).join("\n");

        const prompt = `
あなたは老舗酒造店「金井酒造店」のAI経営コンサルタントです。
以下の過去の月別売上データ（単位：本/升）に基づき、次月の需要予測と、具体的な営業アクションを3つ提案してください。

【過去のデータ】
${dataString}

【出力形式（JSONのみ）】
{
  "forecast": 数値（次月の予測販売本数）,
  "advices": [
    { "title": "アクション名", "content": "具体的な説明", "priority": "HIGH|MEDIUM|INFO" },
    ...
  ]
}
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // JSON部分のみを抽出（GeminiがMarkdown記法で返した場合の対策）
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid AI response");

        const forecastResult = JSON.parse(jsonMatch[0]);
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        // サーバー施策の保存（既存のものを一旦クリアして最新を保存）
        if (forecastResult.advices && Array.isArray(forecastResult.advices)) {
            try {
                // AI生成のアドバイスを削除
                await prisma.salesStrategy.deleteMany({
                    where: {
                        month: currentMonth,
                        category: "AI_GENERATED"
                    }
                });

                await prisma.salesStrategy.createMany({
                    data: forecastResult.advices.map((a: any) => ({
                        month: currentMonth,
                        title: a.title || "AI提案",
                        content: a.content,
                        priority: a.priority || "INFO",
                        category: "AI_GENERATED",
                        status: "PENDING"
                    }))
                });
            } catch (dbError) {
                console.error("Failed to persist strategies:", dbError);
            }
        }

        return NextResponse.json(forecastResult);
    } catch (error) {
        console.error("AI Forecast failed:", error);
        return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
    }
}
