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
  TrendingDown,
  RefreshCw
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
  actualAmount: number;
  categories: Record<string, number>;
  categoriesAmount: Record<string, number>;
  customers: Record<string, number>;
  customersAmount: Record<string, number>;
}

interface NewAdvice {
  weeklyStrategy: { title: string, content: string } | null;
  monthlyProduction: {
    name: string;
    target: number;
    reasoning: string;
    weeklyGuideline?: { week: number; percentage: number; amount: number; note: string }[];
  }[];
  weeklyInventory: { name: string, required: number, reasoning: string }[];
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
  const [metricMode, setMetricMode] = useState<'quantity' | 'amount'>('quantity');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('latest');

  const [monthlyData, setMonthlyData] = useState<AnalysisRecord[]>([]);
  const [yearlyData, setYearlyData] = useState<AnalysisRecord[]>([]);

  const [advices, setAdvices] = useState<NewAdvice>({ weeklyStrategy: null, monthlyProduction: [], weeklyInventory: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [grandTotal, setGrandTotal] = useState<{ qty: number, amount: number } | null>(null);

  // 1. 初回基本データロード
  const fetchBaseData = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      // ブラウザ・Nextキャッシュをバイパスして最新のDBを強制集計
      const analysisRes = await fetch('/api/sales/analysis', { cache: 'no-store' });
      if (!analysisRes.ok) throw new Error("売上分析データの取得に失敗しました。");
      const analysisData = await analysisRes.json();
      const monthlySeries = analysisData.monthly || [];
      // 直近48ヶ月分を保持（タイムマシン表示用にある程度持っておく）
      setMonthlyData(monthlySeries.slice(-48));
      setYearlyData(analysisData.yearly || []);

      if (analysisData.kpi) {
        setGrandTotal({
          qty: analysisData.kpi.grandTotal || 0,
          amount: analysisData.kpi.grandTotalAmount || 0
        });
      }
    } catch (error: unknown) {
      console.error("Dashboard Data Error:", error);
      setErrorMsg(error instanceof Error ? error.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  // --- 派生データの計算 ---
  const availablePeriods = useMemo(() => {
    if (viewMode === 'month') {
      return [...monthlyData].map(d => d.month || '').reverse();
    } else {
      return [...yearlyData].map(d => d.year || '').reverse();
    }
  }, [viewMode, monthlyData, yearlyData]);

  const activeRecord = useMemo(() => {
    const target = viewMode === 'month' ? monthlyData : yearlyData;
    if (target.length === 0) return null;
    if (selectedPeriod === 'latest' || !selectedPeriod) {
      return target[target.length - 1];
    } else {
      const field = viewMode === 'month' ? 'month' : 'year';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = target.find((d: any) => d[field] === selectedPeriod);
      return found || target[target.length - 1];
    }
  }, [viewMode, monthlyData, yearlyData, selectedPeriod]);

  // 2. AIアドバイスロード（activeRecord の期間が変化した時）
  useEffect(() => {
    const fetchAdvices = async () => {
      if (!activeRecord || viewMode === 'year') {
        setAdvices({ weeklyStrategy: null, monthlyProduction: [], weeklyInventory: [] });
        return;
      }
      setAdvices({ weeklyStrategy: null, monthlyProduction: [], weeklyInventory: [] });
      const targetMonth = activeRecord.month;
      if (!targetMonth) return;
      try {
        const res = await fetch(`/api/forecast?month=${targetMonth}`);
        if (res.ok) {
          const data = await res.json();
          setAdvices({
            weeklyStrategy: data.nextWeekStrategy,
            monthlyProduction: data.monthlyProductionTargets || [],
            weeklyInventory: data.weeklyInventoryInference || []
          });
        }
      } catch (err) {
        console.warn("Forecast fetch failed:", err);
      }
    };
    fetchAdvices();
  }, [activeRecord, viewMode]);

  // --- 派生データの計算 ---
  const currentChartData = useMemo(() => {
    const isQty = metricMode === 'quantity';
    if (viewMode === 'month') {
      return monthlyData.map(d => ({
        name: d.month ? formatDate(d.month) : '',
        actual: isQty ? d.actual : (d.actualAmount || 0),
        ...(isQty ? d.categories : d.categoriesAmount)
      }));
    } else {
      return yearlyData.map(d => ({
        name: d.year ? `${d.year}年` : '',
        actual: isQty ? d.actual : (d.actualAmount || 0),
        ...(isQty ? d.categories : d.categoriesAmount)
      }));
    }
  }, [viewMode, metricMode, monthlyData, yearlyData]);

  const dynamicKpi = useMemo(() => {
    if (!activeRecord) return null;
    const isQty = metricMode === 'quantity';
    const currentQty = activeRecord.actual;
    const currentAmt = activeRecord.actualAmount || 0;

    if (viewMode === 'year') {
      // 年次のMoM/YoYは計算簡略化のため一旦null・または前年比のみ
      // 今回は単月のMoM, YoY表示を重視するため省略
      return { momChange: null, yoyChange: null };
    }

    const [yStr, mStr] = (activeRecord.month || "").split("-");
    if (!yStr || !mStr) return { momChange: null, yoyChange: null };

    let prevYNum = parseInt(yStr, 10);
    let prevMNum = parseInt(mStr, 10) - 1;
    if (prevMNum === 0) {
      prevMNum = 12;
      prevYNum -= 1;
    }
    const prevMonthKey = `${prevYNum}-${String(prevMNum).padStart(2, '0')}`;
    const momRecord = monthlyData.find(d => d.month === prevMonthKey);

    const prevYyNum = parseInt(yStr, 10) - 1;
    const yoyKey = `${prevYyNum}-${mStr}`;
    const yoyRecord = monthlyData.find(d => d.month === yoyKey);

    const momQtyDiff = momRecord && momRecord.actual > 0 ? ((currentQty - momRecord.actual) / momRecord.actual) * 100 : null;
    const momAmtDiff = momRecord && momRecord.actualAmount && momRecord.actualAmount > 0
      ? ((currentAmt - momRecord.actualAmount) / momRecord.actualAmount) * 100 : null;

    const yoyQtyDiff = yoyRecord && yoyRecord.actual > 0 ? ((currentQty - yoyRecord.actual) / yoyRecord.actual) * 100 : null;
    const yoyAmtDiff = yoyRecord && yoyRecord.actualAmount && yoyRecord.actualAmount > 0
      ? ((currentAmt - yoyRecord.actualAmount) / yoyRecord.actualAmount) * 100 : null;

    return {
      momChange: isQty ? momQtyDiff : momAmtDiff,
      yoyChange: isQty ? yoyQtyDiff : yoyAmtDiff
    };
  }, [activeRecord, monthlyData, viewMode, metricMode]);

  const topCustomers = useMemo(() => {
    if (!activeRecord) return [];
    const isQty = metricMode === 'quantity';
    const source = isQty ? activeRecord.customers : activeRecord.customersAmount;
    const total = isQty ? activeRecord.actual : (activeRecord.actualAmount || 0);

    const entries = Object.entries(source || {});
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, val]) => ({
      name,
      value: val,
      progress: total > 0 ? Math.min(Math.round((val / total) * 100), 100) : 0
    }));
  }, [activeRecord, metricMode]);

  const topCategories = useMemo(() => {
    if (!activeRecord) return [];
    const isQty = metricMode === 'quantity';
    const source = isQty ? activeRecord.categories : activeRecord.categoriesAmount;
    const total = isQty ? activeRecord.actual : (activeRecord.actualAmount || 0);

    const entries = Object.entries(source || {});
    return entries.sort((a, b) => b[1] - a[1]).map(([name, val]) => ({
      name,
      value: val,
      progress: total > 0 ? Math.min(Math.round((val / total) * 100), 100) : 0,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS["未分類"]
    }));
  }, [activeRecord, metricMode]);

  // 日付のフォーマット関数
  function formatDate(raw: string) {
    if (!raw) return "";
    const [y, m] = raw.split('-');
    if (!m) return `${y}年`;
    return `${y}年 ${parseInt(m, 10)}月`;
  }


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
          <div className="flex gap-4 items-center">
            {/* 再集計ボタン */}
            <button
              onClick={fetchBaseData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition text-sm font-medium border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              再集計
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>

            {/* 表示期間セレクト */}
            <div className="flex items-center gap-2">
              <select
                className="bg-slate-800/50 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold-500"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="latest">最新の{viewMode === 'month' ? '月' : '年'}</option>
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{viewMode === 'month' ? formatDate(p) : `${p}年`}</option>
                ))}
              </select>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>

            <div className="flex p-1 bg-slate-800/50 rounded-lg border border-slate-700">
              <button
                onClick={() => setMetricMode('quantity')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", metricMode === 'quantity' ? "bg-gold-500 text-navy-950" : "text-slate-400 hover:text-white")}
              >
                販売本数
              </button>
              <button
                onClick={() => setMetricMode('amount')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", metricMode === 'amount' ? "bg-gold-500 text-navy-950" : "text-slate-400 hover:text-white")}
              >
                金額ベース
              </button>
            </div>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <div className="flex p-1 bg-slate-800/50 rounded-lg border border-slate-700">
              <button
                onClick={() => setViewMode('month')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'month' ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white")}
              >
                月次表示
              </button>
              <button
                onClick={() => setViewMode('year')}
                className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'year' ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white")}
              >
                年次表示
              </button>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-gold-500/20">
            <p className="text-sm font-medium text-slate-400 mb-2">表示{viewMode === 'month' ? '月' : '年'}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white">
                {activeRecord ? (viewMode === 'month' ? formatDate(activeRecord.month!) : `${activeRecord.year}年`) : "---"}
              </h3>
              <span className="text-xs font-bold px-2 py-1 rounded-full text-gold-400 bg-gold-400/10">Base</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-aqua-500/20">
            <p className="text-sm font-medium text-slate-400 mb-2">該当期間 売上実績</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-white">
                  {metricMode === 'amount' && '¥'}
                  {activeRecord ? (metricMode === 'quantity' ? activeRecord.actual.toLocaleString() : (activeRecord.actualAmount || 0).toLocaleString()) : "---"}
                  <span className="text-base text-slate-400 font-normal ml-1">{metricMode === 'quantity' ? '本' : ''}</span>
                </h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full text-aqua-400 bg-aqua-400/10">確定値</span>
              </div>
              <div className="text-sm text-aqua-200/80 font-mono">
                {metricMode === 'quantity'
                  ? `合計金額: ¥${activeRecord ? (activeRecord.actualAmount || 0).toLocaleString() : "---"}`
                  : `販売本数: ${activeRecord ? activeRecord.actual.toLocaleString() : "---"} 本`}
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-white/10">
            <p className="text-sm font-medium text-slate-400 mb-2">前月比 (MoM)</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                {dynamicKpi?.momChange != null ? (
                  <>
                    {dynamicKpi.momChange > 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
                    {dynamicKpi.momChange > 0 ? "+" : ""}{dynamicKpi.momChange.toFixed(1)}%
                  </>
                ) : "---"}
              </h3>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-white/10">
            <p className="text-sm font-medium text-slate-400 mb-2">昨対比 (YoY)</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                {dynamicKpi?.yoyChange != null ? (
                  <>
                    {dynamicKpi.yoyChange > 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
                    {dynamicKpi.yoyChange > 0 ? "+" : ""}{dynamicKpi.yoyChange.toFixed(1)}%
                  </>
                ) : "---"}
              </h3>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-gold-500/10">
            <p className="text-sm font-medium text-gold-400/80 mb-2">累計売上合計 (Accumulated)</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-white">
                  ¥{grandTotal ? grandTotal.amount.toLocaleString() : "---"}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-gold-400 bg-gold-400/10 uppercase">Total</span>
              </div>
              <div className="text-sm text-gold-200/60 font-mono">
                累計本数: {grandTotal ? grandTotal.qty.toLocaleString() : "---"} 本
              </div>
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

          <div className="p-6 flex flex-col space-y-4 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50 h-[450px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="text-gold-400 w-5 h-5" />
                <h3 className="font-bold text-lg text-white">AI 戦略オラクル</h3>
              </div>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">

              {/* 週次営業方針 */}
              {advices.weeklyStrategy ? (
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md mb-2 bg-indigo-500/20 text-indigo-400 inline-block">次週営業方針</span>
                  <h4 className="text-sm font-bold text-slate-100 mb-1">{advices.weeklyStrategy.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{advices.weeklyStrategy.content}</p>
                </div>
              ) : null}

              {/* 製造目標 */}
              {advices.monthlyProduction.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md mb-2 bg-emerald-500/20 text-emerald-400 inline-block">次月製造目標</span>
                  <div className="mt-2 space-y-3">
                    {advices.monthlyProduction.map((p, idx) => (
                      <div key={idx} className="border-b border-emerald-500/10 pb-3 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-200">{p.name}</span>
                          <span className="text-sm font-mono text-emerald-300">{p.target.toLocaleString()}本</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{p.reasoning}</p>

                        {/* 4週ごとのペース配分 */}
                        {p.weeklyGuideline && p.weeklyGuideline.length > 0 && (
                          <div className="mt-2 space-y-1.5 bg-navy-950/40 p-2 rounded-lg border border-emerald-500/10">
                            {p.weeklyGuideline.map(wg => (
                              <div key={wg.week}>
                                <div className="flex justify-between mb-0.5 items-end">
                                  <span className="text-[9px] font-bold text-slate-300">Week {wg.week}</span>
                                  <span className="text-[10px] text-emerald-400 font-mono">{wg.amount.toLocaleString()}本 <span className="text-slate-500 text-[8px]">({wg.percentage}%)</span></span>
                                </div>
                                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-1">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${wg.percentage}%` }} />
                                </div>
                                <p className="text-[9px] text-slate-400 leading-tight">{wg.note}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 週次在庫 */}
              {advices.weeklyInventory.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md mb-2 bg-amber-500/20 text-amber-500 inline-block">週次適正在庫 推論</span>
                  <div className="mt-2 space-y-3">
                    {advices.weeklyInventory.map((inv, idx) => (
                      <div key={idx} className="border-b border-amber-500/10 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-200">{inv.name}</span>
                          <span className="text-sm font-mono text-amber-300">{inv.required.toLocaleString()}本維持</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{inv.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!advices.weeklyStrategy && advices.monthlyProduction.length === 0) && (
                <p className="text-xs text-slate-500 text-center py-10">推論AIを起動中...</p>
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
                    <span className="text-slate-400 font-mono">
                      {metricMode === 'amount' && '¥'}
                      {item.value.toLocaleString()}
                      <span className="text-[10px] ml-1">{metricMode === 'quantity' ? '本' : ''}</span>
                      ({item.progress}%)
                    </span>
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
                    <span className="text-slate-400 font-mono">
                      {metricMode === 'amount' && '¥'}
                      {item.value.toLocaleString()}
                      <span className="text-[10px] ml-1">{metricMode === 'quantity' ? '本' : ''}</span>
                      ({item.progress}%)
                    </span>
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
