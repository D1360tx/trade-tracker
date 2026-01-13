import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    DollarSign, Activity, TrendingUp, BarChart3,
    TrendingDown, Target, Zap, Receipt, Calendar,
    Award, AlertTriangle, Clock, Flame, ChevronDown, ChevronUp,
    BarChart2, Percent, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import StatCard from '../components/StatCard';
import ExchangeFilter from '../components/ExchangeFilter';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import DayDetailModal from '../components/DayDetailModal';
import KPIDetailModal from '../components/KPIDetailModal';
import type { KPIModalType } from '../components/KPIDetailModal';

import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { useTrades } from '../context/TradeContext';

const Dashboard = () => {
    const { trades, isLoading } = useTrades();
    const [timeRange, setTimeRange] = useState<TimeRange>('this_week');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [showAdvancedStats, setShowAdvancedStats] = useState(false);
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
    const [kpiModal, setKpiModal] = useState<{ type: KPIModalType, trades: any[], metrics?: any } | null>(null);

    const filteredTrades = useMemo(() => {
        const now = new Date();
        // 1. Filter by Status (Closed only)
        let filtered = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);

        // 2. Filter by Exchange
        if (selectedExchanges.length > 0) {
            filtered = filtered.filter(t => selectedExchanges.includes(t.exchange));
        }

        // 3. Filter by Date
        if (timeRange === 'all') return filtered;

        let dateRange: { start: Date; end: Date };

        if (timeRange === 'custom' && customStart) {
            dateRange = {
                start: startOfDay(parseISO(customStart)),
                end: customEnd ? endOfDay(parseISO(customEnd)) : now
            };
        } else {
            dateRange = getDateRangeForFilter(timeRange);
        }

        filtered = filtered.filter(t => {
            const tradeDate = parseISO(t.exitDate);
            return isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
        });


        // 4. Aggregate Schwab options (same logic as Journal)
        const groupedByPosition = new Map<string, typeof filtered>();
        const nonAggregatable: typeof filtered = [];

        filtered.forEach(trade => {
            if (trade.exchange === 'Schwab' && trade.type === 'OPTION') {
                const entryMinute = trade.entryDate?.substring(0, 16) || '';
                const exitMinute = trade.exitDate?.substring(0, 16) || '';
                const key = `${trade.ticker}|${entryMinute}|${exitMinute}`;

                if (!groupedByPosition.has(key)) {
                    groupedByPosition.set(key, []);
                }
                groupedByPosition.get(key)!.push(trade);
            } else {
                nonAggregatable.push(trade);
            }
        });

        const aggregated: typeof filtered = [];
        groupedByPosition.forEach(group => {
            if (group.length === 1) {
                aggregated.push(group[0]);
            } else {
                const first = group[0];
                const totalQuantity = group.reduce((sum, t) => sum + t.quantity, 0);
                const totalPnl = group.reduce((sum, t) => sum + t.pnl, 0);
                const totalFees = group.reduce((sum, t) => sum + (t.fees || 0), 0);
                const avgEntryPrice = group.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0) / totalQuantity;
                const avgExitPrice = group.reduce((sum, t) => sum + (t.exitPrice * t.quantity), 0) / totalQuantity;

                aggregated.push({
                    ...first,
                    quantity: totalQuantity,
                    pnl: totalPnl,
                    fees: totalFees,
                    entryPrice: avgEntryPrice,
                    exitPrice: avgExitPrice,
                    pnlPercentage: first.margin ? (totalPnl / (first.margin * group.length)) * 100 : 0
                });
            }
        });

        return [...aggregated, ...nonAggregatable];
    }, [trades, timeRange, customStart, customEnd, selectedExchanges]);

    // Core Stats
    const stats = useMemo(() => {
        const totalPnL = filteredTrades.reduce((acc, t) => acc + t.pnl, 0);
        const winningTrades = filteredTrades.filter(t => t.pnl > 0);
        const losingTrades = filteredTrades.filter(t => t.pnl < 0);
        const breakEvenTrades = filteredTrades.filter(t => t.pnl === 0);
        const winRate = filteredTrades.length > 0 ? (winningTrades.length / filteredTrades.length) * 100 : 0;

        const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 100 : 0;

        // New metrics
        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
        const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
        const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

        // Expectancy: (WinRate × AvgWin) - (LossRate × AvgLoss)
        const lossRate = filteredTrades.length > 0 ? (losingTrades.length / filteredTrades.length) : 0;
        const expectancy = (winRate / 100 * avgWin) - (lossRate * avgLoss);

        // Total fees
        const totalFees = filteredTrades.reduce((acc, t) => acc + (t.fees || 0), 0);

        // Max Drawdown calculation
        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;
        const sortedTrades = [...filteredTrades].sort((a, b) =>
            new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );
        sortedTrades.forEach(t => {
            cumulative += t.pnl;
            if (cumulative > peak) peak = cumulative;
            const drawdown = peak - cumulative;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        // Daily P&L for best/worst day
        const dailyPnL: Record<string, number> = {};
        filteredTrades.forEach(t => {
            const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyPnL[day] = (dailyPnL[day] || 0) + t.pnl;
        });
        const dailyEntries = Object.entries(dailyPnL);
        const dailyValues = Object.values(dailyPnL);
        const bestDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
        const worstDay = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
        const bestDayDate = dailyEntries.find(([_, v]) => v === bestDay)?.[0] || null;
        const worstDayDate = dailyEntries.find(([_, v]) => v === worstDay)?.[0] || null;
        const winDays = dailyValues.filter(v => v > 0).length;
        const loseDays = dailyValues.filter(v => v < 0).length;

        // Win/Lose streaks
        let currentWinStreak = 0;
        let currentLoseStreak = 0;
        let maxWinStreak = 0;
        let maxLoseStreak = 0;
        sortedTrades.forEach(t => {
            if (t.pnl > 0) {
                currentWinStreak++;
                currentLoseStreak = 0;
                if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
            } else if (t.pnl < 0) {
                currentLoseStreak++;
                currentWinStreak = 0;
                if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
            }
        });

        // Average trade duration
        let totalDuration = 0;
        let durationCount = 0;
        filteredTrades.forEach(t => {
            if (t.entryDate && t.exitDate) {
                const duration = differenceInMinutes(parseISO(t.exitDate), parseISO(t.entryDate));
                if (duration > 0) {
                    totalDuration += duration;
                    durationCount++;
                }
            }
        });
        const avgDurationMinutes = durationCount > 0 ? totalDuration / durationCount : 0;

        // Win/Loss ratio
        const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 100 : 0;

        // Recovery factor
        const recoveryFactor = maxDrawdown > 0 ? totalPnL / maxDrawdown : totalPnL > 0 ? 100 : 0;

        return {
            totalPnL,
            winRate,
            profitFactor,
            totalTrades: filteredTrades.length,
            // New core metrics
            avgWin,
            avgLoss,
            largestWin,
            largestLoss,
            expectancy,
            totalFees,
            maxDrawdown,
            bestDay,
            bestDayDate,
            // Advanced metrics
            worstDay,
            worstDayDate,
            winDays,
            loseDays,
            maxWinStreak,
            maxLoseStreak,
            currentWinStreak,
            currentLoseStreak,
            avgDurationMinutes,
            winLossRatio,
            recoveryFactor,
            grossProfit,
            grossLoss,
            winningCount: winningTrades.length,
            losingCount: losingTrades.length,
            breakEvenCount: breakEvenTrades.length
        };
    }, [filteredTrades]);

    const chartData = useMemo(() => {
        const sorted = [...filteredTrades].sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
        let cumulative = 0;
        return sorted.map(t => {
            cumulative += t.pnl;
            return {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                value: cumulative,
                pnl: t.pnl
            };
        });
    }, [filteredTrades]);

    // Format duration for display
    const formatDuration = (minutes: number): string => {
        if (minutes < 60) return `${Math.round(minutes)}m`;
        if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
        return `${(minutes / 1440).toFixed(1)}d`;
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex justify-between items-center mb-6">
                    <div className="h-10 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                    <div className="flex gap-2">
                        <div className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg" />
                        <div className="h-10 w-40 bg-[var(--bg-tertiary)] rounded-lg" />
                    </div>
                </div>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                    ))}
                </div>
                {/* Secondary Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-36 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                    ))}
                </div>
                {/* Chart */}
                <div className="h-[400px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-2 py-1 rounded-lg border border-[var(--border)]">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                            <span className="text-[var(--text-tertiary)]">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                        </div>
                    )}
                    <ExchangeFilter
                        exchanges={Array.from(new Set(trades.map(t => t.exchange))).sort()}
                        selectedExchanges={selectedExchanges}
                        onSelectionChange={setSelectedExchanges}
                    />
                    <TimeRangeFilter
                        selectedRange={timeRange}
                        onRangeChange={setTimeRange}
                        customStartDate={customStart}
                        customEndDate={customEnd}
                        onCustomDateChange={(start, end) => {
                            setCustomStart(start);
                            setCustomEnd(end);
                        }}
                    />
                </div>
            </div>

            {/* Empty State */}
            {(!isLoading && trades.length === 0) ? (
                <div className="glass-panel p-12 text-center rounded-xl space-y-4 col-span-full">
                    <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto text-[var(--accent-primary)]">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-2">No Trades Found</h3>
                        <p className="text-[var(--text-secondary)] mb-6">Import your trade history to see your dashboard metrics.</p>
                        <Link
                            to="/import"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-medium transition-colors"
                        >
                            Import Data
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    {/* Primary KPI Grid (Original 4) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            label="Net P&L"
                            value={`$${stats.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            trend={stats.totalPnL >= 0 ? 'up' : 'down'}
                            icon={<DollarSign size={20} />}
                        />
                        <StatCard
                            label="Win Rate"
                            value={`${stats.winRate.toFixed(1)}%`}
                            trend={stats.winRate > 50 ? 'up' : 'neutral'}
                            icon={<Activity size={20} />}
                        />
                        <StatCard
                            label="Profit Factor"
                            value={stats.profitFactor.toFixed(2)}
                            trend={stats.profitFactor >= 1.5 ? 'up' : stats.profitFactor >= 1 ? 'neutral' : 'down'}
                            icon={<TrendingUp size={20} />}
                        />
                        <StatCard
                            label="Total Trades"
                            value={stats.totalTrades.toString()}
                            icon={<BarChart3 size={20} />}
                        />
                    </div>

                    {/* Secondary KPI Grid (New 8 metrics) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--success)]/50 transition-all"
                            onClick={() => {
                                const wins = filteredTrades.filter(t => t.pnl > 0).sort((a, b) => b.pnl - a.pnl);
                                setKpiModal({ type: 'avg_win', trades: wins });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--success)] mb-2">
                                <ArrowUpRight size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Avg Win</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--success)]">
                                ${stats.avgWin.toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--danger)]/50 transition-all"
                            onClick={() => {
                                const losses = filteredTrades.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl);
                                setKpiModal({ type: 'avg_loss', trades: losses });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--danger)] mb-2">
                                <ArrowDownRight size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Avg Loss</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--danger)]">
                                ${stats.avgLoss.toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--success)]/50 transition-all"
                            onClick={() => {
                                const wins = filteredTrades.filter(t => t.pnl > 0).sort((a, b) => b.pnl - a.pnl);
                                setKpiModal({ type: 'best_trade', trades: wins.slice(0, 10) });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--success)] mb-2">
                                <Award size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Best Trade</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--success)]">
                                ${stats.largestWin.toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--danger)]/50 transition-all"
                            onClick={() => {
                                const losses = filteredTrades.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl);
                                setKpiModal({ type: 'worst_trade', trades: losses.slice(0, 10) });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--danger)] mb-2">
                                <AlertTriangle size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Worst Trade</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--danger)]">
                                ${Math.abs(stats.largestLoss).toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all"
                            onClick={() => {
                                const lossRate = filteredTrades.length > 0 ? (filteredTrades.filter(t => t.pnl < 0).length / filteredTrades.length * 100) : 0;
                                setKpiModal({
                                    type: 'expectancy',
                                    trades: [],
                                    metrics: {
                                        winRate: stats.winRate,
                                        avgWin: stats.avgWin,
                                        lossRate: lossRate,
                                        avgLoss: Math.abs(stats.avgLoss),
                                        expectancy: stats.expectancy
                                    }
                                });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--accent-primary)] mb-2">
                                <Target size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Expectancy</span>
                            </div>
                            <p className={`text-lg font-bold ${stats.expectancy >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${stats.expectancy.toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--danger)]/50 transition-all"
                            onClick={() => {
                                // For now, showing largest losses as a proxy for what contributed to drawdown
                                const losses = filteredTrades.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl);
                                setKpiModal({ type: 'max_drawdown', trades: losses.slice(0, 5) });
                            }}
                        >
                            <div className="flex items-center gap-2 text-[var(--danger)] mb-2">
                                <TrendingDown size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Max DD</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--danger)]">
                                ${stats.maxDrawdown.toFixed(2)}
                            </p>
                        </div>
                        <div className="glass-panel p-4 rounded-xl">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] mb-2">
                                <Receipt size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Total Fees</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--text-secondary)]">
                                ${stats.totalFees.toFixed(2)}
                            </p>
                        </div>
                        <div
                            className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--success)]/50 transition-all"
                            onClick={() => stats.bestDayDate && setSelectedDayDate(stats.bestDayDate)}
                            title="Click to view day details"
                        >
                            <div className="flex items-center gap-2 text-[var(--success)] mb-2">
                                <Calendar size={16} />
                                <span className="text-xs text-[var(--text-tertiary)]">Best Day</span>
                            </div>
                            <p className="text-lg font-bold text-[var(--success)]">
                                ${stats.bestDay.toFixed(2)}
                            </p>
                            {stats.bestDayDate && (
                                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                    {format(parseISO(stats.bestDayDate), 'MMM d, yyyy')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Expandable Advanced Stats Section */}
                    <div className="glass-panel rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <BarChart2 size={20} className="text-[var(--accent-primary)]" />
                                <span className="font-semibold">Advanced Statistics</span>
                                <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                                    {showAdvancedStats ? 'Click to collapse' : 'Click to expand'}
                                </span>
                            </div>
                            {showAdvancedStats ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>

                        {showAdvancedStats && (
                            <div className="px-6 pb-6 pt-2 border-t border-[var(--border)]">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                                    {/* Win/Loss Ratio */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Percent size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Win/Loss Ratio</span>
                                        </div>
                                        <p className="text-xl font-bold">{stats.winLossRatio.toFixed(2)}</p>
                                    </div>

                                    {/* Recovery Factor */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Recovery Factor</span>
                                        </div>
                                        <p className="text-xl font-bold">{stats.recoveryFactor.toFixed(2)}</p>
                                    </div>

                                    {/* Worst Day */}
                                    <div
                                        className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg cursor-pointer hover:ring-2 hover:ring-[var(--danger)]/50 transition-all"
                                        onClick={() => stats.worstDayDate && setSelectedDayDate(stats.worstDayDate)}
                                        title="Click to view day details"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingDown size={14} className="text-[var(--danger)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Worst Day</span>
                                        </div>
                                        <p className="text-xl font-bold text-[var(--danger)]">${Math.abs(stats.worstDay).toFixed(2)}</p>
                                        {stats.worstDayDate && (
                                            <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                {format(parseISO(stats.worstDayDate), 'MMM d')}
                                            </p>
                                        )}
                                    </div>

                                    {/* Win Days vs Lose Days */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Win/Lose Days</span>
                                        </div>
                                        <p className="text-xl font-bold">
                                            <span className="text-[var(--success)]">{stats.winDays}</span>
                                            <span className="text-[var(--text-tertiary)] mx-1">/</span>
                                            <span className="text-[var(--danger)]">{stats.loseDays}</span>
                                        </p>
                                    </div>

                                    {/* Best Win Streak */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Flame size={14} className="text-[var(--success)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Best Streak</span>
                                        </div>
                                        <p className="text-xl font-bold text-[var(--success)]">{stats.maxWinStreak} wins</p>
                                    </div>

                                    {/* Worst Lose Streak */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle size={14} className="text-[var(--danger)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Worst Streak</span>
                                        </div>
                                        <p className="text-xl font-bold text-[var(--danger)]">{stats.maxLoseStreak} losses</p>
                                    </div>

                                    {/* Avg Trade Duration */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Avg Duration</span>
                                        </div>
                                        <p className="text-xl font-bold">{formatDuration(stats.avgDurationMinutes)}</p>
                                    </div>

                                    {/* Gross Profit */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp size={14} className="text-[var(--success)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Gross Profit</span>
                                        </div>
                                        <p className="text-xl font-bold text-[var(--success)]">${stats.grossProfit.toFixed(2)}</p>
                                    </div>

                                    {/* Gross Loss */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingDown size={14} className="text-[var(--danger)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Gross Loss</span>
                                        </div>
                                        <p className="text-xl font-bold text-[var(--danger)]">${stats.grossLoss.toFixed(2)}</p>
                                    </div>

                                    {/* Trade Breakdown */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <BarChart3 size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Trade Breakdown</span>
                                        </div>
                                        <p className="text-sm">
                                            <span className="text-[var(--success)] font-bold">{stats.winningCount}W</span>
                                            <span className="text-[var(--text-tertiary)] mx-1">/</span>
                                            <span className="text-[var(--danger)] font-bold">{stats.losingCount}L</span>
                                            {stats.breakEvenCount > 0 && (
                                                <>
                                                    <span className="text-[var(--text-tertiary)] mx-1">/</span>
                                                    <span className="text-[var(--text-secondary)] font-bold">{stats.breakEvenCount}BE</span>
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    {/* Current Streaks */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Activity size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Current Streak</span>
                                        </div>
                                        {stats.currentWinStreak > 0 ? (
                                            <p className="text-xl font-bold text-[var(--success)]">🔥 {stats.currentWinStreak} wins</p>
                                        ) : stats.currentLoseStreak > 0 ? (
                                            <p className="text-xl font-bold text-[var(--danger)]">❄️ {stats.currentLoseStreak} losses</p>
                                        ) : (
                                            <p className="text-xl font-bold text-[var(--text-secondary)]">—</p>
                                        )}
                                    </div>

                                    {/* Net After Fees */}
                                    <div className="bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign size={14} className="text-[var(--accent-primary)]" />
                                            <span className="text-xs text-[var(--text-tertiary)]">Net After Fees</span>
                                        </div>
                                        <p className={`text-xl font-bold ${(stats.totalPnL - stats.totalFees) >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            ${(stats.totalPnL - stats.totalFees).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Main Chart */}
            {trades.length > 0 && (
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-semibold mb-6">Equity Curve</h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                    </linearGradient>
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
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-primary)'
                                    }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                    formatter={(val: number | undefined) => [val !== undefined ? `$${val.toFixed(2)}` : '', 'Equity']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="var(--accent-primary)"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Day Detail Modal */}
            {selectedDayDate && (
                <DayDetailModal
                    date={selectedDayDate}
                    trades={filteredTrades}
                    onClose={() => setSelectedDayDate(null)}
                />
            )}

            {kpiModal && (
                <KPIDetailModal
                    type={kpiModal.type}
                    trades={kpiModal.trades}
                    metrics={kpiModal.metrics}
                    onClose={() => setKpiModal(null)}
                />
            )}
        </div>
    );
};

export default Dashboard;
