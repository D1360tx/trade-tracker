import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../../types';

interface DailyPnLBarChartProps {
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

const DailyPnLBarChart = ({ trades, title = 'NET DAILY P&L' }: DailyPnLBarChartProps) => {
    const chartData = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');

        // Aggregate by day
        const dailyMap: Record<string, number> = {};

        closedTrades.forEach(t => {
            const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyMap[day] = (dailyMap[day] || 0) + t.pnl;
        });

        return Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, pnl]) => ({
                date,
                displayDate: format(parseISO(date), 'MM/dd'),
                pnl,
                isPositive: pnl >= 0,
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

    return (
        <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">(ALL DATES)</span>
                </div>
            </div>
            <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                            formatter={(value) => [formatCurrency(value as number), 'Daily P&L']}
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isPositive ? 'var(--success)' : 'var(--danger)'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DailyPnLBarChart;
