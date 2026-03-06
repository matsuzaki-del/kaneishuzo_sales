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
  ChevronRight
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 実績データの取得
        const salesRes = await fetch('/api/sales');
        const salesData = await salesRes.json();

        // AI予測データの取得
        const forecastRes = await fetch('/api/forecast', { method: 'POST' });
        const forecastData = await forecastRes.json();

        if (forecastData.forecast) {
          // 最後に予測データを追加
          const lastMonthData = salesData[salesData.length - 1];
          const combined = [...salesData, {
            month: "予測",
            actual: null,
            forecast: forecastData.forecast
          }];
          setChartData(combined);
          setAdvices(forecastData.advices || []);
        } else {
          setChartData(salesData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100 font-sans">
      {/* Sidebar */}
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

        <div className="p-4 mt-auto">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/50 to-navy-900/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-gold-400" />
              <span className="text-xs font-semibold text-slate-300">AI STATUS</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              モデル: Gemini 1.5 Flash<br />
              ステータス: 稼働中
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-navy-900 via-navy-950 to-black p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">需要予測ダッシュボード</h2>
            <p className="text-slate-400">実績データに基づくAI需要予測と生産最適化</p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-sm font-medium hover:bg-slate-700/50 transition-colors">
              <Calendar className="w-4 h-4" />
              2024年 3月
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]">
              <Download className="w-4 h-4" />
              レポート出力
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: '予測総需要', value: chartData.find(d => d.month === '予測')?.forecast?.toLocaleString() + ' 本' || '---', change: '+12.5%', color: 'border-gold-500/20' },
            { label: '生産進捗', value: '68%', change: '好調', color: 'border-aqua-500/20' },
            { label: '推奨仕込み量', value: '3,800kg', change: '-5.2%', color: 'border-white/10' },
            { label: '分析機材ステータス', value: '正常', change: 'Online', color: 'border-green-500/20' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "p-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border",
                stat.color
              )}
            >
              <p className="text-sm font-medium text-slate-400 mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full",
                  stat.change.startsWith('+') ? "text-green-400 bg-green-400/10" : "text-gold-400 bg-gold-400/10"
                )}>
                  {stat.change}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-white">需要トレンド予測</h3>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-aqua-500"></div>
                  <span className="text-slate-400">実績値</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gold-500"></div>
                  <span className="text-slate-400">AI予測</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500">AIがデータを解析中...</div>
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
                    <XAxis
                      dataKey="month"
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorActual)"
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      stroke="#eab308"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      fillOpacity={1}
                      fill="url(#colorForecast)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="p-6 flex flex-col space-y-6 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold-500/20">
                <Zap className="text-gold-400 w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">AI戦略アドバイス</h3>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse bg-slate-800/30 h-24 rounded-2xl border border-slate-700/30" />
                ))
              ) : advices.length > 0 ? (
                advices.map((advice, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 group hover:border-gold-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-md",
                        advice.priority === 'HIGH' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                          advice.priority === 'MEDIUM' ? "bg-gold-500/20 text-gold-400 border border-gold-500/30" :
                            "bg-aqua-500/20 text-aqua-400 border border-aqua-500/30"
                      )}>
                        {advice.priority}
                      </span>
                      <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-gold-400 transition-colors" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-100 mb-1 leading-snug">{advice.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{advice.content}</p>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">現在、新しいアドバイスはありません。</p>
                </div>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500 hover:text-navy-950 transition-all duration-300 text-sm font-bold"
            >
              予測を更新する
              <Zap className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <h3 className="text-xl font-bold text-white mb-6">銘柄別需要内訳</h3>
            <div className="space-y-6">
              {[
                { name: '笹の露', progress: 75, color: 'bg-gold-500' },
                { name: '白笹', progress: 45, color: 'bg-aqua-500' },
                { name: '相模大山', progress: 60, color: 'bg-indigo-500' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300 font-medium">{item.name}</span>
                    <span className="text-slate-400">{item.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={cn("h-full rounded-full", item.color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-navy-900/40 backdrop-blur-md border border-slate-800/50">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="text-aqua-400 w-5 h-5" />
              <h3 className="font-bold text-xl">生産ライン効率</h3>
            </div>
            <div className="flex items-center justify-center h-48">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    strokeDasharray="85, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">85%</span>
                  <span className="text-[10px] text-slate-400 uppercase">Optimal</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
