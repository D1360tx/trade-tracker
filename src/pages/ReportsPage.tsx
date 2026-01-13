import { useState, useMemo } from 'react';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import { Download, X, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import HeatmapChart from '../components/charts/HeatmapChart';
import TradeDistribution from '../components/charts/TradeDistribution';
import EquityCurveChart from '../components/charts/EquityCurveChart';
import SymbolPerformanceChart from '../components/charts/SymbolPerformanceChart';
import DrawdownAnalysis from '../components/charts/DrawdownAnalysis';
import MonthlyPerformance from '../components/charts/MonthlyPerformance';
import StreakAnalysis from '../components/charts/StreakAnalysis';
import RiskMetricsDashboard from '../components/RiskMetricsDashboard';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import DayDetailModal from '../components/DayDetailModal';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

const ReportsPage = () => {
    const { trades } = useTrades();
    const { strategies } = useStrategies();
    const { mistakes } = useMistakes();

    // Filter state
    const [timeRange, setTimeRange] = useState<TimeRange>('this_week');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterStrategy, setFilterStrategy] = useState('');
    const [filterMistake, setFilterMistake] = useState('');
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

    // Filtered trades
    const filteredTrades = useMemo(() => {
        return trades.filter(t => {
            // Only closed trades
            const isClosed = t.status === 'CLOSED' || t.pnl !== 0;
            if (!isClosed) return false;

            // Time range filter
            let matchesDate = true;
            if (timeRange !== 'all') {
                const now = new Date();
                let dateRange: { start: Date; end: Date };

                if (timeRange === 'custom' && filterStartDate) {
                    dateRange = {
                        start: startOfDay(parseISO(filterStartDate)),
                        end: filterEndDate ? endOfDay(parseISO(filterEndDate)) : now
                    };
                } else {
                    dateRange = getDateRangeForFilter(timeRange);
                }

                const tradeDate = parseISO(t.exitDate);
                matchesDate = isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
            } else {
                // Legacy date filter support
                if (filterStartDate) {
                    const startDate = new Date(filterStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    matchesDate = matchesDate && new Date(t.exitDate) >= startDate;
                }
                if (filterEndDate) {
                    const endDate = new Date(filterEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && new Date(t.exitDate) <= endDate;
                }
            }

            // Strategy filter
            const matchesStrategy = !filterStrategy || t.strategyId === filterStrategy;

            // Mistake filter
            const matchesMistake = !filterMistake || (t.mistakes && t.mistakes.includes(filterMistake));

            return matchesDate && matchesStrategy && matchesMistake;
        });
    }, [trades, timeRange, filterStartDate, filterEndDate, filterStrategy, filterMistake]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const totalPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
        const wins = filteredTrades.filter(t => t.pnl > 0);
        const losses = filteredTrades.filter(t => t.pnl < 0);
        const winRate = filteredTrades.length > 0 ? (wins.length / filteredTrades.length) * 100 : 0;

        const totalWinAmt = wins.reduce((sum, t) => sum + t.pnl, 0);
        const totalLossAmt = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : totalWinAmt > 0 ? Infinity : 0;

        // Best and worst days
        const dailyPnL = new Map<string, number>();
        filteredTrades.forEach(t => {
            const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyPnL.set(dateStr, (dailyPnL.get(dateStr) || 0) + t.pnl);
        });

        let bestDay = { date: '', pnl: -Infinity };
        let worstDay = { date: '', pnl: Infinity };
        dailyPnL.forEach((pnl, date) => {
            if (pnl > bestDay.pnl) bestDay = { date, pnl };
            if (pnl < worstDay.pnl) worstDay = { date, pnl };
        });

        return {
            totalPnL,
            winRate,
            profitFactor,
            bestDay: bestDay.pnl !== -Infinity ? bestDay : null,
            worstDay: worstDay.pnl !== Infinity ? worstDay : null,
            totalTrades: filteredTrades.length
        };
    }, [filteredTrades]);

    // Clear all filters
    const handleClearFilters = () => {
        setTimeRange('all');
        setFilterStartDate('');
        setFilterEndDate('');
        setFilterStrategy('');
        setFilterMistake('');
    };

    // Export functionality
    const handleExport = () => {
        const exportData = filteredTrades.map(t => ({
            date: t.exitDate,
            ticker: t.ticker,
            type: t.type,
            direction: t.direction,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            pnl: t.pnl,
            pnlPercentage: t.pnlPercentage,
            strategy: strategies.find(s => s.id === t.strategyId)?.name || 'None',
            mistakes: t.mistakes?.map(mid => mistakes.find(m => m.id === mid)?.name).filter(Boolean).join(', ') || 'None'
        }));

        const csv = [
            Object.keys(exportData[0] || {}).join(','),
            ...exportData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trade-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const hasActiveFilters = filterStartDate || filterEndDate || filterStrategy || filterMistake;

    return (
        <div className="space-y-6">
            {/* Header with Time Range */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-cyan-400 bg-clip-text text-transparent">
                        Advanced Reporting
                    </h1>
                    <p className="text-[var(--text-secondary)]">Deep dive analytics and performance visualization.</p>
                </div>
                <TimeRangeFilter
                    selectedRange={timeRange}
                    onRangeChange={(range) => {
                        setTimeRange(range);
                        if (range !== 'custom') {
                            setFilterStartDate('');
                            setFilterEndDate('');
                        }
                    }}
                    customStartDate={filterStartDate}
                    customEndDate={filterEndDate}
                    onCustomDateChange={(start, end) => {
                        setFilterStartDate(start);
                        setFilterEndDate(end);
                    }}
                />
            </div>

            {/* Filters */}
            <div className="glass-panel p-4 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                            <Calendar size={12} />
                            From Date
                        </label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => {
                                setFilterStartDate(e.target.value);
                                setTimeRange('custom');
                            }}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] text-[var(--text-secondary)] [color-scheme:dark]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                            <Calendar size={12} />
                            To Date
                        </label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => {
                                setFilterEndDate(e.target.value);
                                setTimeRange('custom');
                            }}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] text-[var(--text-secondary)] [color-scheme:dark]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Strategy</label>
                        <select
                            value={filterStrategy}
                            onChange={(e) => setFilterStrategy(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="">All Strategies</option>
                            {strategies.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Mistake</label>
                        <select
                            value={filterMistake}
                            onChange={(e) => setFilterMistake(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="">All Mistakes</option>
                            {mistakes.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)] opacity-0">Actions</label>
                        <button
                            onClick={handleClearFilters}
                            disabled={!hasActiveFilters}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <X size={14} />
                            Clear
                        </button>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)] opacity-0">Actions</label>
                        <button
                            onClick={handleExport}
                            disabled={filteredTrades.length === 0}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent-primary)] text-white rounded text-sm hover:bg-[var(--accent-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={14} />
                            Export CSV
                        </button>
                    </div>
                </div>
                {hasActiveFilters && (
                    <div className="mt-3 text-xs text-[var(--text-secondary)]">
                        Showing {filteredTrades.length} of {trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).length} trades
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="glass-panel p-4 rounded-xl">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Total P&L</p>
                    <p className={`text-2xl font-bold ${kpis.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {kpis.totalPnL >= 0 ? '+' : ''}${kpis.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Win Rate</p>
                    <p className={`text-2xl font-bold ${kpis.winRate >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {kpis.winRate.toFixed(1)}%
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Profit Factor</p>
                    <p className={`text-2xl font-bold ${kpis.profitFactor >= 2 ? 'text-[var(--success)]' : kpis.profitFactor >= 1 ? 'text-[var(--text-primary)]' : 'text-[var(--danger)]'}`}>
                        {kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)}
                    </p>
                </div>
                <div
                    className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--success)]/50 transition-all"
                    onClick={() => kpis.bestDay && setSelectedDayDate(kpis.bestDay.date)}
                    title="Click to view day details"
                >
                    <p className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                        <TrendingUp size={12} />
                        Best Day
                    </p>
                    {kpis.bestDay ? (
                        <>
                            <p className="text-lg font-bold text-[var(--success)]">
                                +${kpis.bestDay.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                                {format(parseISO(kpis.bestDay.date), 'MMM dd, yyyy')}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-[var(--text-tertiary)]">-</p>
                    )}
                </div>
                <div
                    className="glass-panel p-4 rounded-xl cursor-pointer hover:ring-2 hover:ring-[var(--danger)]/50 transition-all"
                    onClick={() => kpis.worstDay && setSelectedDayDate(kpis.worstDay.date)}
                    title="Click to view day details"
                >
                    <p className="text-xs text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                        <TrendingDown size={12} />
                        Worst Day
                    </p>
                    {kpis.worstDay ? (
                        <>
                            <p className="text-lg font-bold text-[var(--danger)]">
                                ${kpis.worstDay.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                                {format(parseISO(kpis.worstDay.date), 'MMM dd, yyyy')}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-[var(--text-tertiary)]">-</p>
                    )}
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {kpis.totalTrades}
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                    <HeatmapChart trades={filteredTrades} />
                </div>
                <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                    <TradeDistribution trades={filteredTrades} />
                </div>
                <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                    <EquityCurveChart trades={filteredTrades} />
                </div>
                <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                    <SymbolPerformanceChart trades={filteredTrades} />
                </div>
            </div>

            {/* New Analytics Section */}
            <div className="mt-6">
                <h2 className="text-2xl font-bold mb-6">📊 Advanced Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                        <DrawdownAnalysis trades={filteredTrades} />
                    </div>
                    <div className="glass-panel p-6 rounded-xl min-h-[400px]">
                        <MonthlyPerformance trades={filteredTrades} />
                    </div>
                </div>
            </div>

            {/* Streak Analysis - Full Width */}
            <div className="mt-6">
                <div className="glass-panel p-6 rounded-xl">
                    <StreakAnalysis trades={filteredTrades} />
                </div>
            </div>

            {/* Risk-Adjusted Metrics - Full Width */}
            <div className="mt-6">
                <div className="glass-panel p-6 rounded-xl">
                    <RiskMetricsDashboard trades={filteredTrades} />
                </div>
            </div>

            {/* Day Detail Modal */}
            {selectedDayDate && (
                <DayDetailModal
                    date={selectedDayDate}
                    trades={filteredTrades}
                    onClose={() => setSelectedDayDate(null)}
                />
            )}
        </div>
    );
};

export default ReportsPage;
