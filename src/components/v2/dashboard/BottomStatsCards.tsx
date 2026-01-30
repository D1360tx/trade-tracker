import { useMemo } from 'react';
import { Info, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { parseISO, format } from 'date-fns';
import type { Trade } from '../../../types';

interface BottomStatsCardsProps {
    trades: Trade[];
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

const BottomStatsCards = ({ trades }: BottomStatsCardsProps) => {
    // Calculate win/loss stats
    const winLossStats = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');
        const wins = closedTrades.filter(t => t.pnl > 0);
        const losses = closedTrades.filter(t => t.pnl < 0);

        const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;

        // Data for the combined chart
        const chartData = [
            { name: 'Avg Win', value: avgWin, fill: 'var(--success)' },
            { name: 'Avg Loss', value: avgLoss, fill: 'var(--danger)' },
        ];

        return { winRate, avgWin, avgLoss, chartData, totalTrades: closedTrades.length };
    }, [trades]);

    // Calculate trade time performance (by hour of day)
    const timePerformance = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.entryDate);

        // Group by hour
        const hourlyData: Record<number, { pnl: number; count: number }> = {};

        closedTrades.forEach(trade => {
            try {
                const entryDate = parseISO(trade.entryDate);
                const hour = entryDate.getHours();

                if (!hourlyData[hour]) {
                    hourlyData[hour] = { pnl: 0, count: 0 };
                }
                hourlyData[hour].pnl += trade.pnl;
                hourlyData[hour].count += 1;
            } catch {
                // Skip invalid dates
            }
        });

        // Convert to chart data (only hours with trades)
        const chartData = Object.entries(hourlyData)
            .map(([hour, data]) => ({
                hour: parseInt(hour),
                label: format(new Date().setHours(parseInt(hour), 0, 0, 0), 'ha'),
                pnl: data.pnl,
                count: data.count,
            }))
            .sort((a, b) => a.hour - b.hour);

        return chartData;
    }, [trades]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Win % - Avg Win - Avg Loss Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-secondary)]">Win % - Avg Win - Avg Loss</span>
                        <Info size={14} className="text-[var(--text-tertiary)]" />
                    </div>
                </div>

                <div className="flex gap-6">
                    {/* Chart */}
                    <div className="flex-1 h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={winLossStats.chartData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={60}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value) => [formatCurrency(value as number), '']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {winLossStats.chartData.map((entry, index) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-col justify-center gap-3 min-w-[100px]">
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Win Rate</div>
                            <div className="text-lg font-semibold text-[var(--text-primary)]">
                                {winLossStats.winRate.toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Avg Win</div>
                            <div className="text-sm font-medium text-[var(--success)]">
                                {formatCurrency(winLossStats.avgWin)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Avg Loss</div>
                            <div className="text-sm font-medium text-[var(--danger)]">
                                -{formatCurrency(winLossStats.avgLoss)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trade Time Performance Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-secondary)]">Trade time performance</span>
                        <Info size={14} className="text-[var(--text-tertiary)]" />
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                            <Settings size={14} className="text-[var(--text-tertiary)]" />
                        </button>
                    </div>
                </div>

                <div className="h-[140px]">
                    {timePerformance.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timePerformance}>
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => formatCurrency(v)}
                                    width={50}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value, name) => {
                                        if (name === 'pnl') return [formatCurrency(value as number), 'P&L'];
                                        return [value, name];
                                    }}
                                    labelFormatter={(label) => `Time: ${label}`}
                                />
                                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                    {timePerformance.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                            No trade time data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BottomStatsCards;
