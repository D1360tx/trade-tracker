import { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { useWeeklyData } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface WeeklySidebarProps {
    trades: Trade[];
    year: number;
    month: number;
    onTradeClick?: (trade: Trade) => void;
}

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const WeeklySidebar = ({ trades, year, month, onTradeClick }: WeeklySidebarProps) => {
    const [activeTab, setActiveTab] = useState<'recent' | 'open'>('recent');
    const weeklyData = useWeeklyData(trades, year, month);

    // Get recent trades (sorted by exit date, most recent first)
    const recentTrades = useMemo(() => {
        return trades
            .filter(t => t.status === 'CLOSED')
            .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime())
            .slice(0, 10);
    }, [trades]);

    // Get open trades
    const openTrades = useMemo(() => {
        return trades.filter(t => t.status === 'OPEN');
    }, [trades]);

    // Calculate daily cumulative P&L for the chart
    const cumulativePnLData = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');
        const sorted = [...closedTrades].sort(
            (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        let cumulative = 0;
        const dailyMap: Record<string, number> = {};

        sorted.forEach(t => {
            cumulative += t.pnl;
            const day = format(parseISO(t.exitDate), 'MM/dd');
            dailyMap[day] = cumulative;
        });

        return Object.entries(dailyMap).map(([date, pnl]) => ({ date, pnl }));
    }, [trades]);

    const displayTrades = activeTab === 'recent' ? recentTrades : openTrades;

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Weekly Summary */}
            <div className="glass-panel rounded-xl p-4 flex-shrink-0">
                <div className="space-y-2">
                    {weeklyData.map((week, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                        >
                            <div>
                                <div className="text-xs text-[var(--text-secondary)]">{week.weekLabel}</div>
                                <div className={`text-sm font-semibold ${week.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    {formatCurrency(week.pnl)}
                                </div>
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)]">
                                {week.tradingDays} day{week.tradingDays !== 1 ? 's' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Trades / Open Positions */}
            <div className="glass-panel rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-[var(--border)] flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('recent')}
                        className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
                            activeTab === 'recent'
                                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        Recent trades
                    </button>
                    <button
                        onClick={() => setActiveTab('open')}
                        className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
                            activeTab === 'open'
                                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        Open positions
                    </button>
                </div>

                {/* Trades Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-[var(--bg-secondary)]">
                            <tr className="text-[10px] text-[var(--text-tertiary)]">
                                <th className="text-left px-3 py-2 font-medium">Close Date</th>
                                <th className="text-left px-3 py-2 font-medium">Symbol</th>
                                <th className="text-right px-3 py-2 font-medium">Net P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayTrades.map((trade) => (
                                <tr
                                    key={trade.id}
                                    onClick={() => onTradeClick?.(trade)}
                                    className="hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                >
                                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                                        {format(parseISO(trade.exitDate), 'MM/dd/yyyy')}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-[var(--text-primary)]">
                                        {trade.ticker}
                                    </td>
                                    <td className={`px-3 py-2 text-xs text-right font-medium ${
                                        trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                    }`}>
                                        {formatCurrency(trade.pnl)}
                                    </td>
                                </tr>
                            ))}
                            {displayTrades.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
                                        No {activeTab === 'recent' ? 'recent trades' : 'open positions'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Daily Net Cumulative P&L Chart */}
            <div className="glass-panel rounded-xl p-4 flex-shrink-0">
                <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs text-[var(--text-secondary)]">Daily net cumulative P&L</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="h-[120px]">
                    {cumulativePnLData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={cumulativePnLData}>
                                <defs>
                                    <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => formatCurrency(v)}
                                    width={60}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    labelStyle={{ color: 'var(--text-secondary)' }}
                                    formatter={(value) => [formatCurrency(value as number), 'Cumulative P&L']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="pnl"
                                    stroke="var(--success)"
                                    strokeWidth={2}
                                    dot={false}
                                    fill="url(#cumulativeGradient)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                            No data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WeeklySidebar;
