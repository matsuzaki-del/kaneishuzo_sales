'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Target,
  Package,
  History,
  BarChart3,
  Zap,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';

// --- Types ---
interface AnalysisRecord {
  month?: string;
  year?: string;
  actual: number;
  categories: Record<string, number>;
  customers: Record<string, number>;
}

interface KPI {
  latestMonth: string | null;
  currentSales: number;
  momChange: number;
  yoyChange: number;
}

interface Advice {
  title: string;
  content: string;
  priority: 'HIGH' | 'MEDIUM' | 'INFO';
}

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active
        ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
    )}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const CATEGORY_COLORS: Record<string, string> = {
  "純米大吟醸酒": "#eab308", // gold-500
  "純米吟醸酒": "#facc15",   // gold-400
  "純米酒": "#06b6d4",       // aqua-500
  "本醸造酒": "#6366f1",     // indigo-500
  "普通酒": "#8b5cf6",       // violet-500
  "リキュール": "#ec4899",     // pink-500
  "未分類": "#64748b"        // slate-500
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  const [monthlyData, setMonthlyData] = useState<AnalysisRecord[]>([]);
  const [yearlyData, setYearlyData] = useState<AnalysisRecord[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);

  const [advices, setAdvices] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. 分析APIから基本データ取得
        const analysisRes = await fetch('/api/sales/analysis');
        if (!analysisRes.ok) throw new Error("売上分析データの取得に失敗しました。");
        const analysisData = await analysisRes.json();

        // 直近24ヶ月分のみに絞る（多すぎるとチャートが潰れるため）
        const monthlySeries = analysisData.monthly || [];
        const recentMonthly = monthlySeries.slice(-24);

        setMonthlyData(recentMonthly);
        setYearlyData(analysisData.yearly || []);
        setKpi(analysisData.kpi || null);

        // 2. AI予測APIからのアドバイス取得 (非同期・失敗許容)
        try {
          const forecastRes = await fetch('/api/forecast', { method: 'POST' });
          if (forecastRes.ok) {
            const forecastData = await forecastRes.json();
            const fetchedAdvices: Advice[] = (forecastData.brandStrategies || []).slice(0, 5).map((s: { title: string; content: string; priority: 'HIGH' | 'MEDIUM' | 'INFO' }) => ({
              title: s.title,
              content: s.content,
              priority: s.priority
            }));

            if (forecastData.overallAdvice) {
              fetchedAdvices.unshift({
                title: "全体方針",
                content: forecastData.overallAdvice,
                priority: "HIGH"
              });
            }
            setAdvices(fetchedAdvices);
          }
        } catch (fErr) {
          console.warn("Forecast fetch failed:", fErr);
        }

      } catch (error: unknown) {
        console.error("Dashboard Data Error:", error);
        setErrorMsg(error instanceof Error ? error.message : "エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 派生データの計算 ---
  const currentChartData = useMemo(() => {
    if (viewMode === 'month') {
      return monthlyData.map(d => ({
        name: d.month,
        actual: d.actual,
        ...d.categories // 積み上げ棒グラフ用に展開
      }));
    } else {
      return yearlyData.map(d => ({
        name: d.year,
        actual: d.actual,
        ...d.categories
      }));
    }
  }, [viewMode, monthlyData, yearlyData]);

  // 最新データの特定（ランキング用）
  const latestRecord = useMemo(() => {
    const target = viewMode === 'month' ? monthlyData : yearlyData;
    return target.length > 0 ? target[target.length - 1] : null;
  }, [viewMode, monthlyData, yearlyData]);

  const topCustomers = useMemo(() => {
    if (!latestRecord) return [];
    const entries = Object.entries(latestRecord.customers);
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, val]) => ({
      name,
      value: val,
      progress: Math.min(Math.round((val / latestRecord.actual) * 100), 100)
    }));
  }, [latestRecord]);

  const topCategories = useMemo(() => {
    if (!latestRecord) return [];
    const entries = Object.entries(latestRecord.categories);
    return entries.sort((a, b) => b[1] - a[1]).map(([name, val]) => ({
      name,
      value: val,
      progress: Math.min(Math.round((val / latestRecord.actual) * 100), 100),
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS["未分類"]
    }));
  }, [latestRecord]);


  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100 font-sans">
      <aside className="w-64 border-r border-slate-800 bg-navy-900/50 backdrop-blur-xl flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-navy-950" />
            </div>
            <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gold-400 to-gold-200">
              KANAI ANALYTICS
            </h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="需要予測" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <NavItem icon={<Target size={20} />} label="生産目標" active={activeTab === 'targets'} onClick={() => window.location.href = '/targets'} />
          <NavItem icon={<Package size={20} />} label="在庫管理" />
          <NavItem icon={<History size={20} />} label="過去データ" />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-navy-900 via-navy-950 to-black p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">売上・需要分析ダッシュボード</h2>
            <p className="text-slate-400">最新の実績データに基づく多角的な売上分析</p>
          </div>
          <div className="flex gap-4">
            <div className="flex p-1 bg-slate-800/50 rounded-lg border border-slate-700">
              <button
                onClick={() => setViewMode('month')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'month' ? "bg-gold-500 text-navy-950" : "text-slate-400 hover:text-white")}
              >
                月次表示
              </button>
              <button
                onClick={() => setViewMode('year')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'year' ? "bg-gold-500 text-navy-950" : "text-slate-400 hover:text-white")}
              >
                年次表示
              </button>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-gold-500/20">
            <p className="text-sm font-medium text-slate-400 mb-2">最新集計月</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white">{kpi?.latestMonth || "---"}</h3>
              <span className="text-xs font-bold px-2 py-1 rounded-full text-gold-400 bg-gold-400/10">Base</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-aqua-500/20">
            <p className="text-sm font-medium text-slate-400 mb-2">該当期間 売上実績</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white">{latestRecord ? latestRecord.actual.toLocaleString() : "---"} <span className="text-base text-slate-400 font-normal">本</span></h3>
              <span className="text-xs font-bold px-2 py-1 rounded-full text-aqua-400 bg-aqua-400/10">確定値</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-white/10">
            <p className="text-sm font-medium text-slate-400 mb-2">前月比 (MoM)</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                {kpi?.momChange != null ? (
                  <>
                    {kpi.momChange > 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
                    {kpi.momChange > 0 ? "+" : ""}{kpi.momChange.toFixed(1)}%
                  </>
                ) : "---"}
              </h3>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-white/10">
            <p className="text-sm font-medium text-slate-400 mb-2">昨対比 (YoY)</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                {kpi?.yoyChange != null ? (
                  <>
                    {kpi.yoyChange > 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
                    {kpi.yoyChange > 0 ? "+" : ""}{kpi.yoyChange.toFixed(1)}%
                  </>
                ) : "---"}
              </h3>
            </div>
          </div>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <h3 className="text-xl font-bold text-white mb-6">売上推移と製成別構成 ({viewMode === 'month' ? '月次' : '年次'})</h3>
            <div className="h-[350px] w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">データを集計中...</div>
              ) : errorMsg ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-rose-400">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p>{errorMsg}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                    {Object.keys(CATEGORY_COLORS).filter(k => k !== "未分類").map(category => (
                      <Bar key={category} dataKey={category} stackId="a" fill={CATEGORY_COLORS[category]} />
                    ))}
                    <Bar dataKey="未分類" stackId="a" fill={CATEGORY_COLORS["未分類"]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="p-6 flex flex-col space-y-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex items-center gap-3">
              <Zap className="text-gold-400 w-5 h-5" />
              <h3 className="font-bold text-lg text-white">AI戦略アドバイス</h3>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {advices.length > 0 ? advices.map((advice, i) => (
                <div key={i} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md mb-2 block w-fit",
                    advice.priority === 'HIGH' ? "bg-red-500/20 text-red-400" : "bg-gold-500/20 text-gold-400")}>
                    {advice.priority}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 mb-1">{advice.title}</h4>
                  <p className="text-xs text-slate-400">{advice.content}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-500 text-center py-10">アドバイス生成中...</p>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">上位取引先 ({viewMode === 'month' ? '単月' : '年間'})</h3>
              <span className="text-xs font-medium bg-slate-800 text-slate-300 px-3 py-1 rounded-full">Top 5</span>
            </div>
            <div className="space-y-5">
              {topCustomers.length > 0 ? topCustomers.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-200 font-medium truncate pr-4">{item.name}</span>
                    <span className="text-slate-400 font-mono">{item.value.toLocaleString()} <span className="text-[10px] ml-1">本</span> ({item.progress}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500">データ読み込み中...</p>
              )}
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">製成別構成 ({viewMode === 'month' ? '単月' : '年間'})</h3>
              <span className="text-xs font-medium bg-slate-800 text-slate-300 px-3 py-1 rounded-full">All Categories</span>
            </div>
            <div className="space-y-5">
              {topCategories.length > 0 ? topCategories.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-200 font-medium">{item.name}</span>
                    <span className="text-slate-400 font-mono">{item.value.toLocaleString()} <span className="text-[10px] ml-1">本</span> ({item.progress}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.progress}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500">データ読み込み中...</p>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
