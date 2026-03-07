"use client";

import React, { useState } from 'react';
import {
    Target,
    ArrowLeft,
    Search,
    Plus,
    Filter,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface TargetItem {
    id: string;
    name: string;
    category: string | null;
    currentMonthActual: number;
    diff: number;
    status: 'in-progress' | 'warning' | 'completed';
}

export default function TargetsPage() {
    const [targetItems, setTargetItems] = useState<TargetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchTargets = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/products');
                if (!res.ok) throw new Error("データの取得に失敗しました。");
                const data = await res.json();
                setTargetItems(data);
            } catch (err: unknown) {
                console.error(err);
                setErrorMsg(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        };
        fetchTargets();
    }, []);

    const targetMonth = new Date().getMonth() + 1;
    return (
        <div className="min-h-screen bg-brand-navy text-slate-100 p-6 lg:p-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex items-center space-x-4">
                    <Link href="/" className="p-2 glass-card hover:bg-white/10 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3">
                            <Target className="text-brand-gold" />
                            <span>生産目標管理</span>
                        </h1>
                        <p className="text-slate-400">2026年{targetMonth}月度の醸造・出荷スケジュール</p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="銘柄を検索..."
                            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 w-64"
                        />
                    </div>
                    <button className="bg-brand-gold text-brand-navy font-bold px-4 py-2 rounded-lg flex items-center space-x-2 glow-gold">
                        <Plus size={18} />
                        <span>新規目標</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6">
                <div className="glass-card overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <h2 className="font-bold flex items-center space-x-2">
                            <Filter size={18} className="text-slate-400" />
                            <span>目標一覧</span>
                        </h2>
                        <div className="flex space-x-2">
                            <span className="px-3 py-1 rounded-full bg-brand-gold/10 text-brand-gold text-xs border border-brand-gold/20">全て</span>
                            <span className="px-3 py-1 rounded-full bg-white/5 text-slate-400 text-xs hover:bg-white/10 cursor-pointer">進行中</span>
                            <span className="px-3 py-1 rounded-full bg-white/5 text-slate-400 text-xs hover:bg-white/10 cursor-pointer">警告</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-slate-500 text-sm border-b border-white/5">
                                    <th className="px-6 py-4 font-medium">銘柄名称</th>
                                    <th className="px-6 py-4 font-medium">カテゴリー</th>
                                    <th className="px-6 py-4 font-medium">進捗状況</th>
                                    <th className="px-6 py-4 font-medium">目標 / 実績</th>
                                    <th className="px-6 py-4 font-medium text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                                            データを読み込み中...
                                        </td>
                                    </tr>
                                ) : errorMsg ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-rose-400">
                                            {errorMsg}
                                        </td>
                                    </tr>
                                ) : targetItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                                            データが見つかりませんでした。
                                        </td>
                                    </tr>
                                ) : (
                                    targetItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4 font-bold">{item.name}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                                                    {item.category || '未分類'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col space-y-1 w-32">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className={cn(item.diff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                            前月比 {item.diff > 0 ? "+" : ""}{item.diff.toFixed(1)}%
                                                        </span>
                                                        <span className="text-slate-500">{item.currentMonthActual.toLocaleString()}本</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, Math.max(0, 50 + item.diff))}%` }} // 実績がないため、一旦比率で簡易表現
                                                            className={cn(
                                                                "h-full rounded-full",
                                                                item.status === 'completed' ? "bg-emerald-500" :
                                                                    item.status === 'warning' ? "bg-rose-500" : "bg-brand-aqua"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: 'in-progress' | 'completed' | 'warning' }) {
    const configs = {
        'in-progress': { icon: <Clock size={14} />, label: '進行中', color: 'text-brand-aqua bg-brand-aqua/10 border-brand-aqua/20' },
        'completed': { icon: <CheckCircle2 size={14} />, label: '達成', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
        'warning': { icon: <AlertCircle size={14} />, label: '遅延・不足', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    };

    return (
        <div className={cn("inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-bold", configs[status].color)}>
            {configs[status].icon}
            <span>{configs[status].label}</span>
        </div>
    );
}
