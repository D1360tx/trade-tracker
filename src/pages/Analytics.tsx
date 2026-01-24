import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, Activity, BarChart2, PieChart as PieIcon, AlertTriangle, Target } from 'lucide-react';
import OptionsAnalysis from '../components/charts/OptionsAnalysis';

type AnalyticsTab = 'general' | 'options';

const Analytics = () => {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('general');
    const { trades } = useTrades();

    const closedTrades = useMemo(() => trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0), [trades]);

    // 1. Cumulative P&L Over Time
    const cumulativeData = useMemo(() => {
        const sorted = [...closedTrades].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
        let cumulative = 0;
        return sorted.map(t => {
            cumulative += t.pnl;
            return {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                pnl: cumulative,
                tradePnl: t.pnl
            };
        });
    }, [closedTrades]);

    // 2. Daily P&L Distribution (Histogram)
    const dailyPnLData = useMemo(() => {
        if (closedTrades.length === 0) return [];

        // Map of date -> pnl
        const dailyMap = new Map<string, number>();
        closedTrades.forEach(t => {
            const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + t.pnl);
        });

        // Convert to array, sort by date descending, take last 30, then reverse for chronological display
        return Array.from(dailyMap.entries())
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()) // Sort chronologically
            .slice(-30) // Take last 30 days
            .map(([date, pnl]) => ({
                date: format(parseISO(date), 'MMM dd'),
                pnl
            }));

    }, [closedTrades]);

    // 3. Win Rate by Ticker (Top 5)
    const tickerStats = useMemo(() => {
        const stats = new Map<string, { wins: number, total: number, pnl: number }>();

        closedTrades.forEach(t => {
            const current = stats.get(t.ticker) || { wins: 0, total: 0, pnl: 0 };
            stats.set(t.ticker, {
                wins: current.wins + (t.pnl > 0 ? 1 : 0),
                total: current.total + 1,
                pnl: current.pnl + t.pnl
            });
        });

        return Array.from(stats.entries())
            .map(([ticker, data]) => ({
                name: ticker,
                winRate: (data.wins / data.total) * 100,
                total: data.total,
                pnl: data.pnl
            }))
            .sort((a, b) => b.total - a.total) // Sort by volume
            .slice(0, 5);
    }, [closedTrades]);

    // 4. Direction Stats (Long vs Short)
    const directionStats = useMemo(() => {
        const longArgs = closedTrades.filter(t => t.direction === 'LONG');
        const shortArgs = closedTrades.filter(t => t.direction === 'SHORT');

        return [
            { name: 'Long', value: longArgs.length, pnl: longArgs.reduce((acc, t) => acc + t.pnl, 0) },
            { name: 'Short', value: shortArgs.length, pnl: shortArgs.reduce((acc, t) => acc + t.pnl, 0) },
        ];
    }, [closedTrades]);

    const { strategies } = useStrategies();

    // 5. Strategy Performance
    const strategyStats = useMemo(() => {
        const stats = new Map<string, { wins: number, total: number, pnl: number, name: string, color: string }>();

        // Pre-fill with defined strategies
        strategies.forEach(s => {
            stats.set(s.id, { wins: 0, total: 0, pnl: 0, name: s.name, color: s.color });
        });
        // Add "None" category
        stats.set('none', { wins: 0, total: 0, pnl: 0, name: 'No Strategy', color: 'bg-gray-500' });

        closedTrades.forEach(t => {
            const sid = t.strategyId || 'none';
            let entry = stats.get(sid);
            if (!entry && sid !== 'none') {
                entry = stats.get('none');
            }

            if (entry) {
                entry.wins += (t.pnl > 0 ? 1 : 0);
                entry.total += 1;
                entry.pnl += t.pnl;
            }
        });

        return Array.from(stats.values())
            .filter(s => s.total > 0) // Only show strategies with trades
            .sort((a, b) => b.pnl - a.pnl);
    }, [closedTrades, strategies]);

    const { mistakes } = useMistakes();

    // 6. Cost of Mistakes (Psychology)
    const mistakeStats = useMemo(() => {
        const stats = new Map<string, { count: number, cost: number, name: string, color: string }>();

        mistakes.forEach(m => {
            stats.set(m.id, { count: 0, cost: 0, name: m.name, color: m.color });
        });

        closedTrades.forEach(t => {
            if (t.mistakes && t.mistakes.length > 0) {
                t.mistakes.forEach(mid => {
                    const entry = stats.get(mid);
                    if (entry) {
                        entry.count += 1;
                        // Use absolute cost? Or just PnL? 
                        // Usually mistakes result in losses. If positive, it's still a "cost" to process technically (bad habit).
                        // But for "Cost of Mistakes" chart, users want to see how much they LOST.
                        // Let's sum the NEGATIVE PnL. If they made money on a mistake, the 'cost' is 0 (or negative cost?), 
                        // but let's stick to summing PnL.
                        // Actually better: Sum the PnL of trades with this mistake. 
                        // If PnL is negative, it adds to cost (displayed as positive number usually "Cost: $500").
                        // Let's keep it simple: Sum PnL.
                        entry.cost += t.pnl;
                    }
                });
            }
        });

        return Array.from(stats.values())
            .filter(s => s.count > 0)
            .sort((a, b) => a.cost - b.cost); // Sort by biggest losses (lowest PnL) first
    }, [closedTrades, mistakes]);

    const shadowPnLData = useMemo(() => {
        const sorted = [...closedTrades].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
        let actualCum = 0;
        let shadowCum = 0;

        return sorted.map(t => {
            actualCum += t.pnl;

            // If trade has mistakes, we exclude it from Shadow PnL (as if we didn't take it)
            // So if it was a loss of -100, Shadow PnL doesn't change (saved 100).
            // If it was a win of +100, Shadow PnL doesn't change (missed 100 - shouldn't have taken it).
            const hasMistakes = t.mistakes && t.mistakes.length > 0;
            if (!hasMistakes) {
                shadowCum += t.pnl;
            }

            return {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                actual: actualCum,
                shadow: shadowCum,
                difference: shadowCum - actualCum
            };
        });
    }, [closedTrades]);

    const totalMistakeCost = useMemo(() => {
        if (shadowPnLData.length === 0) return 0;
        const last = shadowPnLData[shadowPnLData.length - 1];
        return last.shadow - last.actual;
    }, [shadowPnLData]);

    // 7. R-Multiple Analysis
    const rStats = useMemo(() => {
        const withR = closedTrades.filter(t => t.initialRisk && t.initialRisk > 0).map(t => ({
            ...t,
            r: t.pnl / (t.initialRisk as number)
        }));

        if (withR.length === 0) return null;

        // Distribution
        const buckets = {
            '<-2R': 0,
            '-2R to -1R': 0,
            '-1R to 0R': 0,
            '0R to 1R': 0,
            '1R to 2R': 0,
            '2R to 3R': 0,
            '>3R': 0
        };

        let totalR = 0;
        let winners = 0;
        let losers = 0;
        let winR = 0;
        let loseR = 0;

        withR.forEach(t => {
            const r = t.r;
            totalR += r;

            if (r > 0) {
                winners++;
                winR += r;
            } else {
                losers++;
                loseR += r;
            }

            if (r < -2) buckets['<-2R']++;
            else if (r < -1) buckets['-2R to -1R']++;
            else if (r < 0) buckets['-1R to 0R']++;
            else if (r < 1) buckets['0R to 1R']++;
            else if (r < 2) buckets['1R to 2R']++;
            else if (r < 3) buckets['2R to 3R']++;
            else buckets['>3R']++;
        });

        const distributionData = Object.entries(buckets).map(([range, count]) => ({ range, count }));

        // Cumulative R
        const sorted = [...withR].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
        let cumR = 0;
        const cumulativeRData = sorted.map(t => {
            cumR += t.r;
            return {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                r: cumR
            };
        });

        // Metrics
        const avgWinR = winners > 0 ? winR / winners : 0;
        const avgLossR = losers > 0 ? loseR / losers : 0;
        const winRate = withR.length > 0 ? winners / withR.length : 0;
        const expectancy = (avgWinR * winRate) + (avgLossR * (1 - winRate)); // avgLossR is negative

        return {
            distributionData,
            cumulativeRData,
            totalR,
            expectancy,
            avgWinR,
            avgLossR,
            count: withR.length
        };
    }, [closedTrades]);

    // 8. General KPIs (Win/Loss Ratio, Profit Factor)
    const kpis = useMemo(() => {
        const wins = closedTrades.filter(t => t.pnl > 0);
        const losses = closedTrades.filter(t => t.pnl < 0);

        const totalWinAmt = wins.reduce((acc, t) => acc + t.pnl, 0);
        const totalLossAmt = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));

        const avgWin = wins.length > 0 ? totalWinAmt / wins.length : 0;
        const avgLoss = losses.length > 0 ? totalLossAmt / losses.length : 0;

        const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
        const profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : totalWinAmt > 0 ? Infinity : 0;

        return {
            avgWin,
            avgLoss,
            winLossRatio,
            profitFactor
        };
    }, [closedTrades]);

    // 9. Performance by Time of Day (Hourly)
    const hourlyPerformance = useMemo(() => {
        const hourlyStats = new Map<number, { pnl: number; wins: number; total: number }>();

        // Initialize all hours
        for (let i = 0; i < 24; i++) {
            hourlyStats.set(i, { pnl: 0, wins: 0, total: 0 });
        }

        closedTrades.forEach(t => {
            const hour = parseISO(t.exitDate).getHours();
            const stats = hourlyStats.get(hour)!;
            stats.pnl += t.pnl;
            stats.total += 1;
            if (t.pnl > 0) stats.wins += 1;
        });

        return Array.from(hourlyStats.entries())
            .map(([hour, stats]) => ({
                hour: `${hour.toString().padStart(2, '0')}:00`,
                hourNum: hour,
                pnl: stats.pnl,
                winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
                trades: stats.total
            }))
            .filter(h => h.trades > 0); // Only show hours with trades
    }, [closedTrades]);

    // 10. Performance by Day of Week
    const dayOfWeekPerformance = useMemo(() => {
        const dayStats = new Map<number, { pnl: number; wins: number; total: number }>();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Initialize all days
        for (let i = 0; i < 7; i++) {
            dayStats.set(i, { pnl: 0, wins: 0, total: 0 });
        }

        closedTrades.forEach(t => {
            const day = parseISO(t.exitDate).getDay();
            const stats = dayStats.get(day)!;
            stats.pnl += t.pnl;
            stats.total += 1;
            if (t.pnl > 0) stats.wins += 1;
        });

        return Array.from(dayStats.entries())
            .map(([day, stats]) => ({
                day: dayNames[day],
                dayShort: dayNames[day].slice(0, 3),
                pnl: stats.pnl,
                winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
                trades: stats.total
            }))
            .filter(d => d.trades > 0); // Only show days with trades
    }, [closedTrades]);

    // 11. Cumulative P&L by Strategy (for comparison chart)
    const cumulativePnLByStrategy = useMemo(() => {
        if (strategies.length === 0) return [];

        // Get all trades sorted by date
        const sorted = [...closedTrades].sort((a, b) =>
            new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        // Track cumulative for each strategy
        const cumulatives = new Map<string, number>();
        strategies.forEach(s => cumulatives.set(s.id, 0));
        cumulatives.set('none', 0); // For untagged trades

        const dataPoints: any[] = [];

        sorted.forEach(t => {
            const sid = t.strategyId || 'none';
            if (cumulatives.has(sid)) {
                cumulatives.set(sid, cumulatives.get(sid)! + t.pnl);
            }

            // Create a data point with all strategy values
            const point: any = {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                dateTime: new Date(t.exitDate).getTime()
            };

            cumulatives.forEach((value, key) => {
                const strategy = strategies.find(s => s.id === key);
                const name = strategy ? strategy.name : 'No Strategy';
                point[name] = value;
            });

            dataPoints.push(point);
        });

        return dataPoints;
    }, [closedTrades, strategies]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-3xl font-bold">Analytics</h2>

                {/* Tab Navigation */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            activeTab === 'general'
                                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]'
                        }`}
                    >
                        <BarChart2 size={16} />
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('options')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            activeTab === 'options'
                                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]'
                        }`}
                    >
                        <Target size={16} />
                        Options Analysis
                    </button>
                </div>
            </div>

            {activeTab === 'options' ? (
                <OptionsAnalysis />
            ) : (
            <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Top Strategy */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1 lg:col-span-1">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Top Strategy</p>
                        {strategyStats.length > 0 ? (
                            <>
                                <h3 className="text-lg font-bold text-[var(--accent-primary)] mb-1">
                                    {strategyStats[0].name}
                                </h3>
                                <p className={`text-sm font-medium ${strategyStats[0].pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    ${strategyStats[0].pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--text-tertiary)] italic">No data</p>
                        )}
                    </div>
                </div>

                {/* Most Costly Mistake */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1 lg:col-span-1">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-2">Worst Mistake</p>
                        {mistakeStats.length > 0 ? (
                            <>
                                <h3 className="text-lg font-bold text-[var(--danger)] mb-1">
                                    {mistakeStats[0].name}
                                </h3>
                                <p className="text-sm font-medium text-[var(--danger)]">
                                    ${mistakeStats[0].cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-[var(--text-tertiary)] italic">No data</p>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">Win / Loss Ratio</p>
                        <h3 className="text-2xl font-bold mt-1 text-[var(--accent-primary)]">
                            {kpis.winLossRatio === Infinity ? '∞' : kpis.winLossRatio.toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">Profit Factor</p>
                        <h3 className={`text-2xl font-bold mt-1 ${kpis.profitFactor >= 2 ? 'text-[var(--success)]' : kpis.profitFactor >= 1 ? 'text-[var(--text-primary)]' : 'text-[var(--danger)]'}`}>
                            {kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)}
                        </h3>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">Avg Win</p>
                        <h3 className="text-2xl font-bold mt-1 text-[var(--success)]">
                            +${kpis.avgWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                    <div>
                        <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider">Avg Loss</p>
                        <h3 className="text-2xl font-bold mt-1 text-[var(--danger)]">
                            -${kpis.avgLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Cumulative P&L */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Cumulative P&L</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cumulativeData}>
                                <defs>
                                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `$${val}`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const value = payload[0].value;
                                            return (
                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                    <p className="text-[var(--text-primary)] font-medium mb-1">{label}</p>
                                                    <p className="text-[var(--accent-primary)] font-bold">
                                                        ${Number(value).toFixed(2)}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area type="monotone" dataKey="pnl" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorPnl)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Daily P&L Distribution */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart2 className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Daily P&L (Last 30 Active Days)</h3>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyPnLData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `$${val}`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const pnl = Number(payload[0].value);
                                            return (
                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                    <p className="text-[var(--text-primary)] font-medium mb-1">{label}</p>
                                                    <p className={`font-bold ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        PnL: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                    {dailyPnLData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={_entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Win Rate by Ticker */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Performance by Ticker (Top 5 Volume)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    <th className="pb-2">Ticker</th>
                                    <th className="pb-2 text-right">Trades</th>
                                    <th className="pb-2 text-right">Win Rate</th>
                                    <th className="pb-2 text-right">Total P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickerStats.map((stat) => (
                                    <tr key={stat.name} className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                                        <td className="py-3 font-medium">{stat.name}</td>
                                        <td className="py-3 text-right text-[var(--text-secondary)]">{stat.total}</td>
                                        <td className="py-3 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${stat.winRate >= 50 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                                }`}>
                                                {stat.winRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className={`py-3 text-right font-medium ${stat.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            ${stat.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Long vs Short Split */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <PieIcon className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Trade Distribution</h3>
                    </div>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={directionStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {directionStats.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--success)' : 'var(--danger)'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const { name, value, pnl } = payload[0].payload;
                                            return (
                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                    <p className="text-[var(--text-primary)] font-medium mb-1">{name}</p>
                                                    <p className="text-[var(--text-secondary)] text-sm mb-1">{value} Trades</p>
                                                    <p className={`text-sm font-medium ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        PnL: {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-center">
                        <div className="p-3 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-secondary)]">Long P&L</p>
                            <p className={`font-bold ${directionStats[0].pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${directionStats[0].pnl.toLocaleString()}
                            </p>
                        </div>
                        <div className="p-3 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-secondary)]">Short P&L</p>
                            <p className={`font-bold ${directionStats[1].pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${directionStats[1].pnl.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Strategy Performance */}
                <div className="glass-panel p-6 rounded-xl col-span-full lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart2 className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Performance by Strategy</h3>
                    </div>
                    {strategyStats.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={strategyStats} layout="vertical" margin={{ left: 0, right: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                        <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} tickFormatter={val => `$${val}`} />
                                        <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                        <Tooltip
                                            cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.5 }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const { name, pnl, total, wins } = payload[0].payload;
                                                    const winRate = total > 0 ? (wins / total) * 100 : 0;
                                                    return (
                                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg min-w-[150px]">
                                                            <p className="text-[var(--text-primary)] font-medium mb-2 border-b border-[var(--border)] pb-1">{name}</p>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-[var(--text-secondary)]">PnL:</span>
                                                                    <span className={`font-medium ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                        {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-[var(--text-secondary)]">Trades:</span>
                                                                    <span className="text-[var(--text-primary)]">{total}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-[var(--text-secondary)]">Win Rate:</span>
                                                                    <span className={`font-medium ${winRate >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                        {winRate.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={20}>
                                            {strategyStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                            <th className="pb-2">Strategy</th>
                                            <th className="pb-2 text-right">Trades</th>
                                            <th className="pb-2 text-right">Win Rate</th>
                                            <th className="pb-2 text-right">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {strategyStats.map((stat) => (
                                            <tr key={stat.name} className="border-b border-[var(--border)]/50 last:border-0">
                                                <td className="py-3 font-medium flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${stat.color.startsWith('bg-') ? stat.color : 'bg-gray-500'}`}></div>
                                                    {stat.name}
                                                </td>
                                                <td className="py-3 text-right text-[var(--text-secondary)]">{stat.total}</td>
                                                <td className="py-3 text-right">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${(stat.wins / stat.total) >= 0.5 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                                        }`}>
                                                        {((stat.wins / stat.total) * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className={`py-3 text-right font-medium ${stat.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    ${stat.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-[var(--text-tertiary)]">
                            <p>No strategy data available. Tag your trades in the Journal!</p>
                        </div>
                    )}
                </div>

                {/* Cost of Mistakes Analysis */}
                <div className="glass-panel p-6 rounded-xl col-span-full lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="text-[var(--danger)]" size={20} />
                            <h3 className="text-lg font-semibold">Psychology & Discipline</h3>
                        </div>
                        {totalMistakeCost > 0 && (
                            <div className="bg-[var(--danger)]/10 text-[var(--danger)] px-4 py-2 rounded-lg text-sm font-medium border border-[var(--danger)]/20">
                                Total Cost of Mistakes: ${totalMistakeCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Shadow PnL Chart */}
                        <div>
                            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Shadow Equity (If you followed rules)</h4>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={shadowPnLData}>
                                        <defs>
                                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--text-tertiary)" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="var(--text-tertiary)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorShadow" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `$${val}`} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length >= 2) {
                                                    const actual = payload[0].value;
                                                    const shadow = payload[1].value;
                                                    const diff = Number(shadow) - Number(actual);
                                                    return (
                                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                            <p className="text-[var(--text-primary)] font-medium mb-1">{label}</p>
                                                            <div className="space-y-1">
                                                                <p className="text-[var(--text-secondary)] text-sm flex justify-between gap-4">
                                                                    <span>Actual:</span>
                                                                    <span className="font-mono">${Number(actual).toLocaleString()}</span>
                                                                </p>
                                                                <p className="text-[var(--accent-primary)] text-sm font-bold flex justify-between gap-4">
                                                                    <span>Potential:</span>
                                                                    <span className="font-mono">${Number(shadow).toLocaleString()}</span>
                                                                </p>
                                                                <div className="border-t border-[var(--border)] mt-1 pt-1 text-xs">
                                                                    <span className="text-[var(--text-tertiary)]">Difference: </span>
                                                                    <span className="text-[var(--success)]">+${diff.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area type="monotone" dataKey="actual" stroke="var(--text-secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Actual P&L" />
                                        <Area type="monotone" dataKey="shadow" stroke="var(--accent-primary)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorShadow)" name="Potential P&L" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Mistakes Breakdown */}
                        <div>
                            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Cost by Mistake Type</h4>
                            {mistakeStats.length > 0 ? (
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={mistakeStats} layout="vertical" margin={{ left: 0, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                            <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} tickFormatter={val => `$${val}`} />
                                            <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                            <Tooltip
                                                cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.5 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const { name, cost, count } = payload[0].payload;
                                                        return (
                                                            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                                <p className="text-[var(--text-primary)] font-medium mb-1">{name}</p>
                                                                <div className="space-y-1 text-sm">
                                                                    <p className={`font-medium ${cost >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                        PnL Impact: ${cost.toLocaleString()}
                                                                    </p>
                                                                    <p className="text-[var(--text-secondary)]">Occurrences: {count}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={20}>
                                                {mistakeStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color.replace('bg-', 'text-').replace('500', '500') /* rough hack to get color, better to store hex */}
                                                        fillOpacity={0.8}
                                                        // Fallback color logic if tailwind class
                                                        style={{ fill: entry.cost < 0 ? 'var(--danger)' : 'var(--success)' }}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                                    <AlertTriangle className="mb-2 opacity-50" size={32} />
                                    <p>No mistakes tagged yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* R-Multiple Analysis */}
                <div className="glass-panel p-6 rounded-xl col-span-full lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">R-Multiple Analysis</h3>
                    </div>

                    {rStats ? (
                        <div className="space-y-8">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Total R</p>
                                    <p className={`text-xl font-bold ${rStats.totalR >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {rStats.totalR.toFixed(2)}R
                                    </p>
                                </div>
                                <div className="p-4 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Expectancy</p>
                                    <p className={`text-xl font-bold ${rStats.expectancy >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {rStats.expectancy.toFixed(2)}R
                                    </p>
                                    <p className="text-[10px] text-[var(--text-tertiary)]">per trade</p>
                                </div>
                                <div className="p-4 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Avg Win</p>
                                    <p className="text-xl font-bold text-[var(--success)]">
                                        +{rStats.avgWinR.toFixed(2)}R
                                    </p>
                                </div>
                                <div className="p-4 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Avg Loss</p>
                                    <p className="text-xl font-bold text-[var(--danger)]">
                                        {rStats.avgLossR.toFixed(2)}R
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Distribution Chart */}
                                <div>
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">R Distributions</h4>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={rStats.distributionData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                                <XAxis dataKey="range" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.5 }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded shadow-lg">
                                                                    <p className="text-[var(--text-primary)] text-sm mb-1">{label}</p>
                                                                    <p className="text-[var(--accent-primary)] font-bold">{payload[0].value} Trades</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Cumulative R Chart */}
                                <div>
                                    <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Cumulative R</h4>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={rStats.cumulativeRData}>
                                                <defs>
                                                    <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                                <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `${val}R`} />
                                                <Tooltip
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const value = payload[0].value;
                                                            return (
                                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                                    <p className="text-[var(--text-primary)] font-medium mb-1">{label}</p>
                                                                    <p className="text-[var(--accent-primary)] font-bold">
                                                                        {Number(value).toFixed(2)}R
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Area type="monotone" dataKey="r" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorR)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-40 flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                            <p>No trades with Risk defined.</p>
                            <p className="text-sm mt-1">Set "Risk ($)" in your Journal to see R-Metrics.</p>
                        </div>
                    )}
                </div>

                {/* Time-Based Performance Section */}
                <div className="col-span-full">
                    <h3 className="text-2xl font-bold mb-6 mt-8">⏰ Time-Based Performance</h3>
                </div>

                {/* Performance by Time of Day */}
                <div className="glass-panel p-6 rounded-xl col-span-full">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Performance by Time of Day</h3>
                    </div>
                    {hourlyPerformance.length > 0 ? (
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyPerformance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="hour"
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={val => `$${val}`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={val => `${val}%`}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                        <p className="text-[var(--text-primary)] font-medium mb-2">{label}</p>
                                                        <div className="space-y-1 text-sm">
                                                            <p className={`font-medium ${data.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                P&L: {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)]">
                                                                Win Rate: {data.winRate.toFixed(1)}%
                                                            </p>
                                                            <p className="text-[var(--text-secondary)]">
                                                                Trades: {data.trades}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar yAxisId="left" dataKey="pnl" radius={[4, 4, 0, 0]} barSize={30}>
                                        {hourlyPerformance.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                            <p>No hourly data available yet.</p>
                        </div>
                    )}
                </div>

                {/* Performance by Day of Week & Win Rate */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <BarChart2 className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Performance by Day of Week</h3>
                    </div>
                    {dayOfWeekPerformance.length > 0 ? (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dayOfWeekPerformance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="dayShort"
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={val => `$${val}`}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                        <p className="text-[var(--text-primary)] font-medium mb-2">{data.day}</p>
                                                        <div className="space-y-1 text-sm">
                                                            <p className={`font-medium ${data.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                P&L: {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </p>
                                                            <p className="text-[var(--text-secondary)]">
                                                                Win Rate: {data.winRate.toFixed(1)}%
                                                            </p>
                                                            <p className="text-[var(--text-secondary)]">
                                                                Trades: {data.trades}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                        {dayOfWeekPerformance.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                            <p>No daily data available yet.</p>
                        </div>
                    )}
                </div>

                {/* Win Rate by Day */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                        <h3 className="text-lg font-semibold">Win Rate by Day</h3>
                    </div>
                    {dayOfWeekPerformance.length > 0 ? (
                        <div className="space-y-3">
                            {dayOfWeekPerformance.map((dayData) => (
                                <div key={dayData.day} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]/30 rounded-lg">
                                    <span className="font-medium text-[var(--text-primary)]">{dayData.day}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-[var(--text-secondary)]">{dayData.trades} trades</span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${dayData.winRate >= 50 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                            }`}>
                                            {dayData.winRate.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                            <p>No data available yet.</p>
                        </div>
                    )}
                </div>

                {/* Cumulative P&L by Strategy Comparison */}
                {cumulativePnLByStrategy.length > 0 && strategies.length > 0 && (
                    <div className="glass-panel p-6 rounded-xl col-span-full">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                            <h3 className="text-lg font-semibold">Cumulative P&L by Strategy</h3>
                        </div>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={cumulativePnLByStrategy}>
                                    <defs>
                                        {strategies.map((s, idx) => (
                                            <linearGradient key={s.id} id={`gradient-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={`hsl(${idx * 360 / strategies.length}, 70%, 50%)`} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={`hsl(${idx * 360 / strategies.length}, 70%, 50%)`} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="var(--text-tertiary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={val => `$${val}`}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg min-w-[200px]">
                                                        <p className="text-[var(--text-primary)] font-medium mb-2">{label}</p>
                                                        <div className="space-y-1 text-sm">
                                                            {payload.map((p, idx) => (
                                                                p.dataKey !== 'date' && p.dataKey !== 'dateTime' && (
                                                                    <p key={idx} className="flex justify-between gap-3">
                                                                        <span className="text-[var(--text-secondary)]">{p.name}:</span>
                                                                        <span className={`font-medium ${Number(p.value) >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                                            ${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </span>
                                                                    </p>
                                                                )
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    {strategies.map((s, idx) => (
                                        <Area
                                            key={s.id}
                                            type="monotone"
                                            dataKey={s.name}
                                            stroke={`hsl(${idx * 360 / strategies.length}, 70%, 50%)`}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill={`url(#gradient-${s.id})`}
                                        />
                                    ))}
                                    {cumulativePnLByStrategy.some(d => d['No Strategy'] !== undefined) && (
                                        <Area
                                            type="monotone"
                                            dataKey="No Strategy"
                                            stroke="var(--text-tertiary)"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            fillOpacity={0.1}
                                            fill="var(--text-tertiary)"
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

            </div>
            </>
            )}
        </div>
    );
};

export default Analytics;
