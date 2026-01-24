import { useMemo, useState } from 'react';
import { useTrades } from '../../context/TradeContext';
import {
    PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
    TrendingUp, Target, DollarSign, Clock, Percent, ChevronDown, ChevronUp,
    BarChart2, PieChart as PieIcon, Zap, X
} from 'lucide-react';
import type { Trade } from '../../types';
import TimeRangeFilter, { getDateRangeForFilter, type TimeRange } from '../TimeRangeFilter';
import {
    groupOptionPositions,
    calculateOptionsMetrics,
    formatCurrency,
    formatPercent,
    getStatusBadgeClass,
    type OptionPositionGroup
} from '../../utils/optionsAnalysis';
import { startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';

// Modal types
type ModalType = 'options_trades' | 'free_trades' | 'free_profit' | 'total_pnl' | 'calls' | 'puts' | 'losers' | 'not_scaled' | null;

interface OptionsAnalysisProps {
    trades?: Trade[];
}

const OptionsAnalysis = ({ trades: tradesProp }: OptionsAnalysisProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    // Time range state
    const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Expanded rows state for the progress table
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Modal state
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    // Handle custom date change
    const handleCustomDateChange = (start: string, end: string) => {
        setCustomStart(start);
        setCustomEnd(end);
    };

    // Filter trades by time range
    const filteredTrades = useMemo(() => {
        let dateRange: { start: Date; end: Date };

        if (timeRange === 'custom' && customStart) {
            dateRange = {
                start: startOfDay(parseISO(customStart)),
                end: customEnd ? endOfDay(parseISO(customEnd)) : new Date()
            };
        } else {
            dateRange = getDateRangeForFilter(timeRange);
        }

        return trades.filter(t => {
            if (!t.exitDate) return false;
            const tradeDate = parseISO(t.exitDate);
            return isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
        });
    }, [trades, timeRange, customStart, customEnd]);

    // Calculate positions and metrics
    const positions = useMemo(() => groupOptionPositions(filteredTrades), [filteredTrades]);
    const metrics = useMemo(() => calculateOptionsMetrics(filteredTrades), [filteredTrades]);

    // Get options trades only (for modal)
    const optionsTrades = useMemo(() =>
        filteredTrades.filter(t => t.type === 'OPTION' && (t.status === 'CLOSED' || t.pnl !== 0))
            .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()),
        [filteredTrades]
    );

    // Get free positions (for modal)
    const freePositions = useMemo(() => positions.filter(p => p.isFree), [positions]);

    // Get calls and puts trades separately (for modal)
    const callsTrades = useMemo(() =>
        optionsTrades.filter(t => t.ticker.includes(' C')),
        [optionsTrades]
    );
    const putsTrades = useMemo(() =>
        optionsTrades.filter(t => t.ticker.includes(' P')),
        [optionsTrades]
    );

    // Get losers (trades with negative P&L)
    const loserTrades = useMemo(() =>
        optionsTrades.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl),
        [optionsTrades]
    );

    // Get positions that were not scaled out of (single exit or never became free)
    const notScaledPositions = useMemo(() =>
        positions.filter(p => !p.isFree && p.scaleOutHistory.length <= 1),
        [positions]
    );

    // Data for free trades donut chart
    const donutData = useMemo(() => {
        const freeCount = positions.filter(p => p.isFree).length;
        const notFreeCount = positions.length - freeCount;
        return [
            { name: 'Free Trades', value: freeCount, color: 'var(--accent-primary)' },
            { name: 'Not Free', value: notFreeCount, color: 'var(--text-tertiary)' }
        ];
    }, [positions]);

    // Data for cumulative free trades timeline
    const timelineData = useMemo(() => {
        const freePositions = positions
            .filter(p => p.isFree && p.freeAt)
            .sort((a, b) => new Date(a.freeAt!).getTime() - new Date(b.freeAt!).getTime());

        let cumulative = 0;
        return freePositions.map(p => {
            cumulative++;
            return {
                date: format(parseISO(p.freeAt!), 'MMM dd'),
                dateRaw: p.freeAt,
                count: cumulative,
                ticker: p.ticker
            };
        });
    }, [positions]);

    // Data for calls vs puts chart
    const callsPutsData = useMemo(() => [
        {
            name: 'Calls',
            trades: metrics.callsStats.count,
            pnl: metrics.callsStats.pnl,
            winRate: metrics.callsStats.winRate,
            positions: metrics.callsStats.positions
        },
        {
            name: 'Puts',
            trades: metrics.putsStats.count,
            pnl: metrics.putsStats.pnl,
            winRate: metrics.putsStats.winRate,
            positions: metrics.putsStats.positions
        }
    ], [metrics]);

    // Toggle row expansion
    const toggleRow = (ticker: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(ticker)) {
            newExpanded.delete(ticker);
        } else {
            newExpanded.add(ticker);
        }
        setExpandedRows(newExpanded);
    };

    // Empty state
    if (metrics.totalOptionsTrades === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Target className="text-[var(--accent-primary)]" size={24} />
                        Options Analysis
                    </h3>
                    <TimeRangeFilter
                        selectedRange={timeRange}
                        onRangeChange={setTimeRange}
                        customStartDate={customStart}
                        customEndDate={customEnd}
                        onCustomDateChange={handleCustomDateChange}
                    />
                </div>

                <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center">
                    <Target className="text-[var(--text-tertiary)] mb-4" size={48} />
                    <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Options Trades Found</h4>
                    <p className="text-[var(--text-secondary)] max-w-md">
                        Import options trades from Schwab or other brokers to see your free trades analysis,
                        scale-out tracking, and options performance metrics.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Time Filter */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Target className="text-[var(--accent-primary)]" size={24} />
                    Options Analysis
                </h3>
                <TimeRangeFilter
                    selectedRange={timeRange}
                    onRangeChange={setTimeRange}
                    customStartDate={customStart}
                    customEndDate={customEnd}
                    onCustomDateChange={handleCustomDateChange}
                />
            </div>

            {/* KPI Cards - Clickable */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <button
                    onClick={() => setActiveModal('options_trades')}
                    className="glass-panel p-4 rounded-xl text-left hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart2 className="text-[var(--accent-primary)]" size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Options Trades</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {metrics.totalOptionsTrades}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {metrics.totalPositions} positions • Click for details
                    </div>
                </button>

                <button
                    onClick={() => setActiveModal('free_trades')}
                    className="glass-panel p-4 rounded-xl border-2 border-[var(--accent-primary)]/20 text-left hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="text-[var(--accent-primary)]" size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Free Trades</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--accent-primary)]">
                        {metrics.freeTradesCount}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {formatPercent(metrics.freeTradesPercent)} of positions • Click
                    </div>
                </button>

                <button
                    onClick={() => setActiveModal('free_profit')}
                    className="glass-panel p-4 rounded-xl text-left hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="text-[var(--success)]" size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Free Trade Profit</span>
                    </div>
                    <div className={`text-2xl font-bold ${metrics.totalProfitFromFreePositions >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {formatCurrency(metrics.totalProfitFromFreePositions, true)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        from {metrics.freeTradesCount} free positions • Click
                    </div>
                </button>

                <div className="glass-panel p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Percent className="text-[var(--accent-primary)]" size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Avg Scale-Out</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatPercent(metrics.avgScaleOutToBecomeFree)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        to become free
                    </div>
                </div>

                <div className="glass-panel p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="text-[var(--accent-primary)]" size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Avg Time to Free</span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {metrics.avgTimeToBecomeFree.toFixed(1)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        days
                    </div>
                </div>

                <button
                    onClick={() => setActiveModal('total_pnl')}
                    className="glass-panel p-4 rounded-xl text-left hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={metrics.totalRealizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'} size={16} />
                        <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Total P&L</span>
                    </div>
                    <div className={`text-2xl font-bold ${metrics.totalRealizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {formatCurrency(metrics.totalRealizedPnL, true)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {formatPercent(metrics.winRate)} win rate • Click
                    </div>
                </button>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Free Trades Donut */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <PieIcon className="text-[var(--accent-primary)]" size={20} />
                        <h4 className="text-lg font-semibold">Free vs Not Free</h4>
                    </div>
                    <div className="h-[250px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const { name, value } = payload[0].payload;
                                            const total = donutData.reduce((a, b) => a + b.value, 0);
                                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                            return (
                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                    <p className="text-[var(--text-primary)] font-medium">{name}</p>
                                                    <p className="text-[var(--accent-primary)] font-bold">{value} positions ({percent}%)</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-4">
                        <span className="text-3xl font-bold text-[var(--accent-primary)]">{formatPercent(metrics.freeTradesPercent)}</span>
                        <span className="text-[var(--text-secondary)] ml-2">became free</span>
                    </div>
                </div>

                {/* Cumulative Free Trades Timeline */}
                <div className="glass-panel p-6 rounded-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                        <h4 className="text-lg font-semibold">Cumulative Free Trades</h4>
                    </div>
                    {timelineData.length > 0 ? (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timelineData}>
                                    <defs>
                                        <linearGradient id="colorFree" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                        <p className="text-[var(--text-primary)] font-medium">{label}</p>
                                                        <p className="text-[var(--accent-primary)] font-bold">{data.count} free trades</p>
                                                        <p className="text-[var(--text-secondary)] text-sm">{data.ticker}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorFree)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                            <p>No free trades in selected period</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Calls vs Puts */}
            <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart2 className="text-[var(--accent-primary)]" size={20} />
                    <h4 className="text-lg font-semibold">Calls vs Puts Performance</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={callsPutsData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} tickFormatter={val => `$${val}`} />
                                <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} width={50} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                                                    <p className="text-[var(--text-primary)] font-medium mb-2">{data.name}</p>
                                                    <div className="space-y-1 text-sm">
                                                        <p className={data.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                                                            P&L: {formatCurrency(data.pnl, true)}
                                                        </p>
                                                        <p className="text-[var(--text-secondary)]">Trades: {data.trades}</p>
                                                        <p className="text-[var(--text-secondary)]">Win Rate: {formatPercent(data.winRate)}</p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={30}>
                                    {callsPutsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setActiveModal('calls')}
                            className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg border border-blue-500/20 text-left hover:ring-2 hover:ring-blue-500/50 transition-all cursor-pointer"
                        >
                            <p className="text-sm text-[var(--text-secondary)] mb-1">Calls</p>
                            <p className={`text-xl font-bold ${metrics.callsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                {formatCurrency(metrics.callsStats.pnl, true)}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">{metrics.callsStats.count} trades | {formatPercent(metrics.callsStats.winRate)} win • Click</p>
                        </button>
                        <button
                            onClick={() => setActiveModal('puts')}
                            className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg border border-purple-500/20 text-left hover:ring-2 hover:ring-purple-500/50 transition-all cursor-pointer"
                        >
                            <p className="text-sm text-[var(--text-secondary)] mb-1">Puts</p>
                            <p className={`text-xl font-bold ${metrics.putsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                {formatCurrency(metrics.putsStats.pnl, true)}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">{metrics.putsStats.count} trades | {formatPercent(metrics.putsStats.winRate)} win • Click</p>
                        </button>
                    </div>
                </div>
            </div>

            {/* Scale-Out Progress Table */}
            <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                    <Target className="text-[var(--accent-primary)]" size={20} />
                    <h4 className="text-lg font-semibold">Position Scale-Out Progress</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                <th className="pb-3 pr-4"></th>
                                <th className="pb-3 pr-4">Position</th>
                                <th className="pb-3 pr-4 text-right">Contracts</th>
                                <th className="pb-3 pr-4 text-right">Cost Basis</th>
                                <th className="pb-3 pr-4 text-center">Recovery</th>
                                <th className="pb-3 pr-4 text-right">P&L</th>
                                <th className="pb-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.slice(0, 20).map((position) => (
                                <PositionRow
                                    key={`${position.ticker}-${position.entryDate}`}
                                    position={position}
                                    isExpanded={expandedRows.has(position.ticker)}
                                    onToggle={() => toggleRow(position.ticker)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
                {positions.length > 20 && (
                    <p className="text-center text-[var(--text-tertiary)] text-sm mt-4">
                        Showing 20 of {positions.length} positions
                    </p>
                )}
            </div>

            {/* Top Underlyings */}
            <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                    <h4 className="text-lg font-semibold">Top Performing Underlyings</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                <th className="pb-3 pr-4">Underlying</th>
                                <th className="pb-3 pr-4 text-right">Trades</th>
                                <th className="pb-3 pr-4 text-right">Free</th>
                                <th className="pb-3 pr-4 text-right">Win Rate</th>
                                <th className="pb-3 text-right">Total P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.topUnderlyings.map((item) => (
                                <tr key={item.underlying} className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                                    <td className="py-3 pr-4 font-medium">{item.underlying}</td>
                                    <td className="py-3 pr-4 text-right text-[var(--text-secondary)]">{item.trades}</td>
                                    <td className="py-3 pr-4 text-right">
                                        <span className="text-[var(--accent-primary)] font-medium">{item.freeCount}</span>
                                    </td>
                                    <td className="py-3 pr-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.winRate >= 50 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'}`}>
                                            {formatPercent(item.winRate)}
                                        </span>
                                    </td>
                                    <td className={`py-3 text-right font-medium ${item.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {formatCurrency(item.pnl, true)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Losers Analysis Section */}
            <div className="glass-panel p-6 rounded-xl border border-[var(--danger)]/20">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-[var(--danger)] rotate-180" size={20} />
                        <h4 className="text-lg font-semibold">Losers & Missed Opportunities</h4>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <button
                        onClick={() => setActiveModal('losers')}
                        className="p-4 bg-[var(--danger)]/10 rounded-lg border border-[var(--danger)]/20 text-left hover:ring-2 hover:ring-[var(--danger)]/50 transition-all cursor-pointer"
                    >
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Total Losses</p>
                        <p className="text-2xl font-bold text-[var(--danger)]">
                            {formatCurrency(loserTrades.reduce((s, t) => s + t.pnl, 0), true)}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">{loserTrades.length} losing trades • Click</p>
                    </button>

                    <button
                        onClick={() => setActiveModal('not_scaled')}
                        className="p-4 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border)] text-left hover:ring-2 hover:ring-[var(--accent-primary)]/50 transition-all cursor-pointer"
                    >
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Not Scaled Out</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                            {notScaledPositions.length}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">positions with single exit • Click</p>
                    </button>

                    <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Avg Loss</p>
                        <p className="text-2xl font-bold text-[var(--danger)]">
                            {loserTrades.length > 0 ? formatCurrency(loserTrades.reduce((s, t) => s + t.pnl, 0) / loserTrades.length, true) : '$0'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">per losing trade</p>
                    </div>

                    <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">Biggest Loss</p>
                        <p className="text-2xl font-bold text-[var(--danger)]">
                            {loserTrades.length > 0 ? formatCurrency(loserTrades[0]?.pnl || 0, true) : '$0'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">{loserTrades[0]?.ticker?.split(' ')[0] || '-'}</p>
                    </div>
                </div>

                {/* Top 5 Biggest Losers Quick View */}
                {loserTrades.length > 0 && (
                    <div>
                        <p className="text-sm text-[var(--text-secondary)] mb-3">Top 5 Biggest Losses</p>
                        <div className="space-y-2">
                            {loserTrades.slice(0, 5).map((trade, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)]/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{trade.ticker}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">{format(parseISO(trade.exitDate), 'MMM dd')} | {trade.quantity} contracts</p>
                                    </div>
                                    <p className="text-lg font-bold text-[var(--danger)]">{formatCurrency(trade.pnl, true)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {activeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setActiveModal(null)}>
                    <div
                        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                            <h3 className="text-lg font-bold">
                                {activeModal === 'options_trades' && 'All Options Trades'}
                                {activeModal === 'free_trades' && 'Free Trade Positions'}
                                {activeModal === 'free_profit' && 'Free Trade Profit Breakdown'}
                                {activeModal === 'total_pnl' && 'Total P&L Breakdown'}
                                {activeModal === 'calls' && 'Call Options Trades'}
                                {activeModal === 'puts' && 'Put Options Trades'}
                                {activeModal === 'losers' && 'Losing Trades Analysis'}
                                {activeModal === 'not_scaled' && 'Positions Not Scaled Out'}
                            </h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {/* Options Trades Modal */}
                            {activeModal === 'options_trades' && (
                                <div>
                                    <div className="mb-4 p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            Showing all <span className="font-bold text-[var(--text-primary)]">{optionsTrades.length}</span> options trades
                                            from <span className="font-bold text-[var(--text-primary)]">{metrics.totalPositions}</span> positions
                                        </p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Ticker</th>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4 text-right">Qty</th>
                                                <th className="pb-2 pr-4 text-right">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Exit</th>
                                                <th className="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {optionsTrades.map((trade, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4 font-medium">{trade.ticker}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(trade.exitDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{trade.quantity}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(trade.pnl, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Free Trades Modal */}
                            {activeModal === 'free_trades' && (
                                <div>
                                    <div className="mb-4 p-3 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            <span className="font-bold text-[var(--accent-primary)]">{freePositions.length}</span> positions became FREE
                                            (recovered 100%+ of cost basis through scale-outs)
                                        </p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Position</th>
                                                <th className="pb-2 pr-4">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Cost Basis</th>
                                                <th className="pb-2 pr-4 text-right">Recovered</th>
                                                <th className="pb-2 pr-4">Free On</th>
                                                <th className="pb-2 text-right">Total P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {freePositions.map((pos, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4">
                                                        <div className="font-medium">{pos.underlying}</div>
                                                        <div className="text-xs text-[var(--text-tertiary)]">{pos.optionType} ${pos.strikePrice}</div>
                                                    </td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(pos.entryDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{formatCurrency(pos.totalCostBasis)}</td>
                                                    <td className="py-2 pr-4 text-right text-[var(--accent-primary)] font-medium">{formatPercent(pos.percentRecovered)}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{pos.freeAt ? format(parseISO(pos.freeAt), 'MMM dd HH:mm') : '-'}</td>
                                                    <td className={`py-2 text-right font-medium ${pos.realizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(pos.realizedPnL, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={5} className="py-3 text-right">Total Free Trade Profit:</td>
                                                <td className={`py-3 text-right ${metrics.totalProfitFromFreePositions >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(metrics.totalProfitFromFreePositions, true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Free Profit Modal */}
                            {activeModal === 'free_profit' && (
                                <div>
                                    <div className="mb-4 p-3 bg-[var(--success)]/10 rounded-lg border border-[var(--success)]/20">
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            <span className="font-bold text-[var(--success)]">{formatCurrency(metrics.totalProfitFromFreePositions, true)}</span> total profit
                                            from <span className="font-bold">{freePositions.length}</span> free positions.
                                            This is the sum of ALL realized P&L from positions that became free.
                                        </p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Position</th>
                                                <th className="pb-2 pr-4 text-right">Contracts</th>
                                                <th className="pb-2 pr-4 text-right">Cost Basis</th>
                                                <th className="pb-2 pr-4 text-right">Proceeds</th>
                                                <th className="pb-2 text-right">Realized P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {freePositions.map((pos, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4">
                                                        <div className="font-medium">{pos.underlying}</div>
                                                        <div className="text-xs text-[var(--text-tertiary)]">{pos.optionType} ${pos.strikePrice} | {format(parseISO(pos.entryDate), 'MMM dd')}</div>
                                                    </td>
                                                    <td className="py-2 pr-4 text-right">{pos.totalContracts}</td>
                                                    <td className="py-2 pr-4 text-right text-[var(--danger)]">-{formatCurrency(pos.totalCostBasis)}</td>
                                                    <td className="py-2 pr-4 text-right text-[var(--success)]">+{formatCurrency(pos.totalProceeds)}</td>
                                                    <td className={`py-2 text-right font-bold ${pos.realizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(pos.realizedPnL, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold text-lg">
                                                <td colSpan={4} className="py-3 text-right">Total:</td>
                                                <td className={`py-3 text-right ${metrics.totalProfitFromFreePositions >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(metrics.totalProfitFromFreePositions, true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Total P&L Modal */}
                            {activeModal === 'total_pnl' && (
                                <div>
                                    <div className="mb-4 grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Total P&L</p>
                                            <p className={`text-xl font-bold ${metrics.totalRealizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {formatCurrency(metrics.totalRealizedPnL, true)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--success)]/10 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Gross Wins</p>
                                            <p className="text-xl font-bold text-[var(--success)]">
                                                +{formatCurrency(optionsTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0))}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--danger)]/10 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Gross Losses</p>
                                            <p className="text-xl font-bold text-[var(--danger)]">
                                                {formatCurrency(optionsTrades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0), true)}
                                            </p>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Ticker</th>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4 text-right">Qty</th>
                                                <th className="pb-2 pr-4 text-right">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Exit</th>
                                                <th className="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {optionsTrades.map((trade, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4 font-medium">{trade.ticker}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(trade.exitDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{trade.quantity}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(trade.pnl, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={5} className="py-3 text-right">Total:</td>
                                                <td className={`py-3 text-right ${metrics.totalRealizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(metrics.totalRealizedPnL, true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Calls Modal */}
                            {activeModal === 'calls' && (
                                <div>
                                    <div className="mb-4 grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                            <p className="text-xs text-[var(--text-secondary)]">Calls P&L</p>
                                            <p className={`text-xl font-bold ${metrics.callsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {formatCurrency(metrics.callsStats.pnl, true)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Win Rate</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {formatPercent(metrics.callsStats.winRate)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Trades</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {callsTrades.length}
                                            </p>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Ticker</th>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4 text-right">Qty</th>
                                                <th className="pb-2 pr-4 text-right">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Exit</th>
                                                <th className="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {callsTrades.map((trade, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4 font-medium">{trade.ticker}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(trade.exitDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{trade.quantity}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(trade.pnl, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={5} className="py-3 text-right">Total:</td>
                                                <td className={`py-3 text-right ${metrics.callsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(metrics.callsStats.pnl, true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Puts Modal */}
                            {activeModal === 'puts' && (
                                <div>
                                    <div className="mb-4 grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                            <p className="text-xs text-[var(--text-secondary)]">Puts P&L</p>
                                            <p className={`text-xl font-bold ${metrics.putsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {formatCurrency(metrics.putsStats.pnl, true)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Win Rate</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {formatPercent(metrics.putsStats.winRate)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Trades</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {putsTrades.length}
                                            </p>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Ticker</th>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4 text-right">Qty</th>
                                                <th className="pb-2 pr-4 text-right">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Exit</th>
                                                <th className="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {putsTrades.map((trade, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4 font-medium">{trade.ticker}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(trade.exitDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{trade.quantity}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                                                    <td className={`py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(trade.pnl, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={5} className="py-3 text-right">Total:</td>
                                                <td className={`py-3 text-right ${metrics.putsStats.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(metrics.putsStats.pnl, true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Losers Modal */}
                            {activeModal === 'losers' && (
                                <div>
                                    <div className="mb-4 grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-[var(--danger)]/10 rounded-lg border border-[var(--danger)]/20">
                                            <p className="text-xs text-[var(--text-secondary)]">Total Losses</p>
                                            <p className="text-xl font-bold text-[var(--danger)]">
                                                {formatCurrency(loserTrades.reduce((s, t) => s + t.pnl, 0), true)}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Avg Loss</p>
                                            <p className="text-xl font-bold text-[var(--danger)]">
                                                {loserTrades.length > 0 ? formatCurrency(loserTrades.reduce((s, t) => s + t.pnl, 0) / loserTrades.length, true) : '$0'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Losing Trades</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {loserTrades.length}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mb-4 p-3 bg-[var(--danger)]/5 rounded-lg border border-[var(--danger)]/10">
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            Analyzing your losers helps identify patterns. Look for common themes:
                                            same underlying, similar time of day, held too long, or position size issues.
                                        </p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Ticker</th>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4 text-right">Qty</th>
                                                <th className="pb-2 pr-4 text-right">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Exit</th>
                                                <th className="pb-2 text-right">Loss</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loserTrades.map((trade, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4 font-medium">{trade.ticker}</td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(trade.exitDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{trade.quantity}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                                                    <td className="py-2 pr-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                                                    <td className="py-2 text-right font-medium text-[var(--danger)]">
                                                        {formatCurrency(trade.pnl, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={5} className="py-3 text-right">Total Losses:</td>
                                                <td className="py-3 text-right text-[var(--danger)]">
                                                    {formatCurrency(loserTrades.reduce((s, t) => s + t.pnl, 0), true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Not Scaled Out Modal */}
                            {activeModal === 'not_scaled' && (
                                <div>
                                    <div className="mb-4 p-3 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/20">
                                        <p className="text-sm text-[var(--text-secondary)]">
                                            <span className="font-bold text-[var(--text-primary)]">{notScaledPositions.length}</span> positions were closed
                                            in a single exit without scaling out. These are opportunities where partial profit-taking
                                            could have reduced risk or locked in gains.
                                        </p>
                                    </div>
                                    <div className="mb-4 grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Not Scaled</p>
                                            <p className="text-xl font-bold text-[var(--text-primary)]">
                                                {notScaledPositions.length}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--success)]/10 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Winners</p>
                                            <p className="text-xl font-bold text-[var(--success)]">
                                                {notScaledPositions.filter(p => p.realizedPnL > 0).length}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--danger)]/10 rounded-lg">
                                            <p className="text-xs text-[var(--text-secondary)]">Losers</p>
                                            <p className="text-xl font-bold text-[var(--danger)]">
                                                {notScaledPositions.filter(p => p.realizedPnL < 0).length}
                                            </p>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                                                <th className="pb-2 pr-4">Position</th>
                                                <th className="pb-2 pr-4">Entry</th>
                                                <th className="pb-2 pr-4 text-right">Contracts</th>
                                                <th className="pb-2 pr-4 text-right">Cost Basis</th>
                                                <th className="pb-2 text-right">P&L</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {notScaledPositions.map((pos, idx) => (
                                                <tr key={idx} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-tertiary)]/30">
                                                    <td className="py-2 pr-4">
                                                        <div className="font-medium">{pos.underlying}</div>
                                                        <div className="text-xs text-[var(--text-tertiary)]">{pos.optionType} ${pos.strikePrice}</div>
                                                    </td>
                                                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{format(parseISO(pos.entryDate), 'MMM dd')}</td>
                                                    <td className="py-2 pr-4 text-right">{pos.totalContracts}</td>
                                                    <td className="py-2 pr-4 text-right">{formatCurrency(pos.totalCostBasis)}</td>
                                                    <td className={`py-2 text-right font-medium ${pos.realizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                        {formatCurrency(pos.realizedPnL, true)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[var(--border)] font-bold">
                                                <td colSpan={4} className="py-3 text-right">Total P&L:</td>
                                                <td className={`py-3 text-right ${notScaledPositions.reduce((s, p) => s + p.realizedPnL, 0) >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {formatCurrency(notScaledPositions.reduce((s, p) => s + p.realizedPnL, 0), true)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for position rows with expansion
interface PositionRowProps {
    position: OptionPositionGroup;
    isExpanded: boolean;
    onToggle: () => void;
}

const PositionRow = ({ position, isExpanded, onToggle }: PositionRowProps) => {
    const progressPercent = Math.min(position.percentRecovered, 100);

    return (
        <>
            <tr
                className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/30 transition-colors cursor-pointer"
                onClick={onToggle}
            >
                <td className="py-3 pr-4">
                    <button className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </td>
                <td className="py-3 pr-4">
                    <div className="font-medium text-[var(--text-primary)]">{position.underlying}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {position.optionType} ${position.strikePrice} | {format(parseISO(position.entryDate), 'MMM dd')}
                    </div>
                </td>
                <td className="py-3 pr-4 text-right text-[var(--text-secondary)]">
                    {position.totalContracts}
                </td>
                <td className="py-3 pr-4 text-right text-[var(--text-secondary)]">
                    {formatCurrency(position.totalCostBasis)}
                </td>
                <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${position.isFree ? 'bg-[var(--accent-primary)]' : position.percentRecovered >= 75 ? 'bg-[var(--success)]' : position.percentRecovered >= 50 ? 'bg-yellow-500' : 'bg-[var(--danger)]'}`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium min-w-[45px] text-right">
                            {formatPercent(position.percentRecovered, 0)}
                        </span>
                    </div>
                </td>
                <td className={`py-3 pr-4 text-right font-medium ${position.realizedPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {formatCurrency(position.realizedPnL, true)}
                </td>
                <td className="py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(position.status)}`}>
                        {position.status === 'free' ? 'FREE' : position.status.toUpperCase()}
                    </span>
                </td>
            </tr>

            {/* Expanded scale-out history */}
            {isExpanded && (
                <tr>
                    <td colSpan={7} className="py-0">
                        <div className="bg-[var(--bg-tertiary)]/30 p-4 border-x border-b border-[var(--border)]/50">
                            <p className="text-xs text-[var(--text-secondary)] mb-3 uppercase tracking-wider">Scale-Out History</p>
                            <div className="space-y-2">
                                {position.scaleOutHistory.map((event, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center justify-between p-2 rounded ${event.madeFree ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20' : 'bg-[var(--bg-secondary)]'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-[var(--text-tertiary)]">
                                                {format(parseISO(event.date), 'MMM dd HH:mm')}
                                            </span>
                                            <span className="text-sm">
                                                Sold {event.quantity} @ ${event.price.toFixed(2)}
                                            </span>
                                            {event.madeFree && (
                                                <span className="text-xs bg-[var(--accent-primary)] text-white px-2 py-0.5 rounded">
                                                    BECAME FREE
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-[var(--text-secondary)]">
                                                {formatPercent(event.cumulativeRecoveryPercent, 0)} recovered
                                            </span>
                                            <span className={event.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                                                {formatCurrency(event.pnl, true)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

export default OptionsAnalysis;
