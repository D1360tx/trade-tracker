import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Award } from 'lucide-react';
import type { Trade } from '../../types';
import { calculateEquityCurve, findSignificantEvents, calculateMaxDrawdown, calculateCurrentDrawdown } from '../../utils/equityCalculations';

interface EquityCurveChartProps {
    trades: Trade[];
    startingBalance?: number;
    showEvents?: boolean;
}

const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
    trades,
    startingBalance = 0,
    showEvents = true
}) => {
    const equityData = useMemo(() => calculateEquityCurve(trades, startingBalance), [trades, startingBalance]);
    const events = useMemo(() => findSignificantEvents(trades), [trades]);
    const maxDrawdown = useMemo(() => calculateMaxDrawdown(equityData), [equityData]);
    const currentDrawdown = useMemo(() => calculateCurrentDrawdown(equityData), [equityData]);

    if (equityData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <TrendingUp size={48} className="text-[var(--text-tertiary)] mb-4" />
                <h3 className="text-xl font-bold text-[var(--text-secondary)] mb-2">No Equity Data</h3>
                <p className="text-[var(--text-tertiary)] text-center">
                    Import trades to see your equity curve
                </p>
            </div>
        );
    }

    const currentEquity = equityData[equityData.length - 1].equity;
    const totalReturn = currentEquity - startingBalance;
    const returnPercentage = startingBalance > 0 ? ((totalReturn / startingBalance) * 100) : 0;
    const isProfit = totalReturn >= 0;

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload[0]) return null;

        const data = payload[0].payload;
        return (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 shadow-xl">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">{data.displayDate}</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                    ${data.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs ${data.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)} this trade
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                    Trade #{data.tradeCount}
                </p>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp size={20} className="text-[var(--accent-primary)]" />
                Equity Curve
            </h3>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-[var(--accent-primary)]" />
                        <span className="text-xs text-[var(--text-secondary)]">Current Equity</span>
                    </div>
                    <p className={`text-xl font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        ${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                        {isProfit ? '+' : ''}{returnPercentage.toFixed(2)}% overall
                    </p>
                </div>

                <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Award size={14} className="text-yellow-500" />
                        <span className="text-xs text-[var(--text-secondary)]">Total Trades</span>
                    </div>
                    <p className="text-xl font-bold text-[var(--text-primary)]">
                        {equityData[equityData.length - 1].tradeCount}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        {equityData.length} data points
                    </p>
                </div>

                {maxDrawdown && (
                    <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown size={14} className="text-red-500" />
                            <span className="text-xs text-[var(--text-secondary)]">Max Drawdown</span>
                        </div>
                        <p className="text-xl font-bold text-red-500">
                            -{maxDrawdown.percentage.toFixed(2)}%
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            ${maxDrawdown.absolute.toFixed(2)}
                        </p>
                    </div>
                )}

                <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown size={14} className={currentDrawdown > 10 ? 'text-red-500' : 'text-yellow-500'} />
                        <span className="text-xs text-[var(--text-secondary)]">Current Drawdown</span>
                    </div>
                    <p className={`text-xl font-bold ${currentDrawdown > 10 ? 'text-red-500' : currentDrawdown > 5 ? 'text-yellow-500' : 'text-green-500'}`}>
                        -{currentDrawdown.toFixed(2)}%
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        {currentDrawdown === 0 ? 'At peak!' : 'from peak'}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={equityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis
                        dataKey="displayDate"
                        stroke="var(--text-tertiary)"
                        fontSize={11}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        fontSize={11}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    {/* Main equity line */}
                    <Line
                        type="monotone"
                        dataKey="equity"
                        stroke="var(--accent-primary)"
                        strokeWidth={2}
                        dot={false}
                        name="Account Equity"
                        activeDot={{ r: 6 }}
                    />

                    {/* Event markers */}
                    {showEvents && events.map((event, index) => {
                        const dataPoint = equityData.find(p => p.date === event.date);
                        if (!dataPoint) return null;

                        let fill = 'var(--accent-primary)';
                        if (event.type === 'biggest_win') fill = '#10b981'; // green
                        if (event.type === 'biggest_loss') fill = '#ef4444'; // red
                        if (event.type === 'milestone') fill = '#f59e0b'; // yellow/gold

                        return (
                            <ReferenceDot
                                key={`event-${index}`}
                                x={dataPoint.displayDate}
                                y={dataPoint.equity}
                                r={7}
                                fill={fill}
                                stroke="#fff"
                                strokeWidth={2}
                                label={{
                                    value: event.type === 'milestone' ? `$${(event.value / 1000)}k` : '',
                                    position: 'top',
                                    fill: 'var(--text-primary)',
                                    fontSize: 10
                                }}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>

            {/* Legend for events */}
            {showEvents && events.length > 0 && (
                <div className="flex flex-wrap gap-4 text-xs">
                    {events.some(e => e.type === 'biggest_win') && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-[var(--text-secondary)]">Biggest Win</span>
                        </div>
                    )}
                    {events.some(e => e.type === 'biggest_loss') && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-[var(--text-secondary)]">Biggest Loss</span>
                        </div>
                    )}
                    {events.some(e => e.type === 'milestone') && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span className="text-[var(--text-secondary)]">Milestone</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EquityCurveChart;
