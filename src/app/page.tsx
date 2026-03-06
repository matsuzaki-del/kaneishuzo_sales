'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Target,
  Package,
  History,
  BarChart3,
  Calendar,
  Download,
  Zap,
  TrendingUp,
  CloudLightning,
  MessageSquare,
  ArrowUpRight,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// --- Types ---
interface ForecastData {
  month: string;
  actual: number | null;
  forecast: number | null;
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [chartData, setChartData] = useState<ForecastData[]>([]);
  const [advices, setAdvices] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topProducts, setTopProducts] = useState<{ name: string; progress: number; color: string }[]>([]);
  const [stats, setStats] = useState([
    { label: '予測総需要', value: '---', change: '-', color: 'border-gold-500/20' },
    { label: '最新月・売上実績', value: '---', change: '-', color: 'border-aqua-500/20' },
    { label: '実績前月比', value: '---', change: '-', color: 'border-white/10' },
    { label: 'AIシステム状態', value: 'データ解析中', change: 'Wait', color: 'border-green-500/20' },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 実績データ取得
        const salesRes = await fetch('/api/sales');
        if (!salesRes.ok) {
          const errData = await salesRes.json().catch(() => ({}));
          throw new Error(errData.details || errData.error || "実績データの取得に失敗しました。");
        }
        const salesData = await salesRes.json();

        // 銘柄別Top3取得 (以前のハードコード箇所を実データへ)
        const productsRes = await fetch('/api/products');
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const sorted = productsData.sort((a: any, b: any) => b.currentMonthActual - a.currentMonthActual).slice(0, 3);
          const max = sorted[0]?.currentMonthActual || 1;
          const colors = ['bg-gold-500', 'bg-aqua-500', 'bg-indigo-500'];
          setTopProducts(sorted.map((p: any, i: number) => ({
            name: p.name,
            progress: Math.round((p.currentMonthActual / max) * 100),
            color: colors[i]
          })));
        }

        // KPI計算
        let currentActual = 0;
        let prevActual = 0;
        let momChangeStr = "-";

        if (Array.isArray(salesData) && salesData.length >= 2) {
          currentActual = salesData[salesData.length - 1].actual || 0;
          prevActual = salesData[salesData.length - 2].actual || 0;
          if (prevActual > 0) {
            const diff = ((currentActual - prevActual) / prevActual) * 100;
            momChangeStr = (diff > 0 ? "+" : "") + diff.toFixed(1) + "%";
          }
        }

        let newStats = [
          { label: '次月・予測総需要', value: 'AI計算中...', change: 'Wait', color: 'border-gold-500/20' },
          { label: '最新月・売上実績', value: currentActual.toLocaleString() + ' 本', change: '確定値', color: 'border-aqua-500/20' },
          { label: '実績前月比', value: momChangeStr, change: momChangeStr.startsWith('+') ? '上昇傾向' : '下降傾向', color: 'border-white/10' },
          { label: 'AIシステム状態', value: '稼働中', change: 'Online', color: 'border-green-500/20' },
        ];

        // 予測データ取得
        let combinedData = salesData;
        let fetchedAdvices = [];

        try {
          const forecastRes = await fetch('/api/forecast', { method: 'POST' });
          if (forecastRes.ok) {
            const forecastData = await forecastRes.json();
            // forecastData.forecasts (銘柄別予測) の合計を全体予測とする
            const totalForecast = forecastData.forecasts?.reduce((sum: number, f: any) => sum + (f.forecast || 0), 0) || 0;

            if (totalForecast > 0) {
              combinedData = [...salesData, {
                month: "来月予測",
                actual: null,
                forecast: totalForecast
              }];
              newStats[0].value = totalForecast.toLocaleString() + ' 本';
              newStats[0].change = 'AI予測';
            }

            // 銘柄別戦略をアドバイス欄に表示
            fetchedAdvices = (forecastData.brandStrategies || []).slice(0, 5).map((s: any) => ({
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
          }
        } catch (fErr) {
          console.warn("Forecast fail:", fErr);
        }

        setChartData(combinedData);
        setAdvices(fetchedAdvices);
        setStats(newStats);

      } catch (error: any) {
        console.error("Dashboard Data Error:", error);
        setErrorMsg(error.message || "エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
            <h2 className="text-3xl font-bold text-white mb-2">需要予測ダッシュボード</h2>
            <p className="text-slate-400">11.3万件の実績に基づくAI需要予測と生産最適化</p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              2026年 3月
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className={cn("p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border", stat.color)}>
              <p className="text-sm font-medium text-slate-400 mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full text-gold-400 bg-gold-400/10">
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <h3 className="text-xl font-bold text-white mb-8">需要トレンド予測 (全銘柄合計)</h3>
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">AIがデータを解析中...</div>
              ) : errorMsg ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-rose-400">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p>{errorMsg}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="actual" stroke="#06b6d4" strokeWidth={3} fill="url(#colorActual)" />
                    <Area type="monotone" dataKey="forecast" stroke="#eab308" strokeWidth={3} strokeDasharray="5 5" fill="url(#colorForecast)" />
                  </AreaChart>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <h3 className="text-xl font-bold text-white mb-6">主力銘柄・実績内訳</h3>
            <div className="space-y-6">
              {topProducts.length > 0 ? topProducts.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300 font-medium">{item.name}</span>
                    <span className="text-slate-400">{item.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500">データ読み込み中...</p>
              )}
            </div>
          </div>
          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50 flex flex-col items-center justify-center">
            <MessageSquare className="text-aqua-400 w-8 h-8 mb-4" />
            <p className="text-slate-400 text-center">AIがリアルタイムでデータを監視し、<br />在庫・配送の最適化を提案しています。</p>
          </div>
        </div>
      </main>
    </div>
  );
}
