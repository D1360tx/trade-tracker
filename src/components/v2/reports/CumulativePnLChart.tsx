import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../../types';

interface CumulativePnLChartProps {
    trades: Trade[];
    title?: string;
}

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const CumulativePnLChart = ({ trades, title = 'DAILY NET CUMULATIVE P&L' }: CumulativePnLChartProps) => {
    const chartData = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');
        const sorted = [...closedTrades].sort(
            (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        if (sorted.length === 0) return [];

        // Aggregate by day
        const dailyMap: Record<string, number> = {};
        let cumulative = 0;

        sorted.forEach(t => {
            cumulative += t.pnl;
            const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyMap[day] = cumulative;
        });

        return Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, pnl]) => ({
                date,
                displayDate: format(parseISO(date), 'MM/dd/yy'),
                pnl,
            }));
    }, [trades]);

    if (chartData.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">(ALL DATES)</span>
                </div>
                <div className="h-[250px] flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                    No trading data available
                </div>
            </div>
        );
    }

    const finalValue = chartData[chartData.length - 1]?.pnl || 0;
    const isPositive = finalValue >= 0;

    return (
        <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">(ALL DATES)</span>
                </div>
                <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text-tertiary)]">
                        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                        <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                        <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                    </svg>
                </button>
            </div>
            <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="cumulativeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isPositive ? 'var(--success)' : 'var(--danger)'} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={isPositive ? 'var(--success)' : 'var(--danger)'} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="displayDate"
                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatCurrency}
                            width={70}
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
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="pnl"
                            stroke={isPositive ? 'var(--success)' : 'var(--danger)'}
                            strokeWidth={2}
                            fill="url(#cumulativeAreaGradient)"
                        />
                        {/* End point marker */}
                        {chartData.length > 0 && (
                            <ReferenceDot
                                x={chartData[chartData.length - 1].displayDate}
                                y={chartData[chartData.length - 1].pnl}
                                r={4}
                                fill={isPositive ? 'var(--success)' : 'var(--danger)'}
                                stroke="var(--bg-primary)"
                                strokeWidth={2}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CumulativePnLChart;
