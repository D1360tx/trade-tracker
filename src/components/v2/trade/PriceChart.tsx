import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../../types';

interface PriceChartProps {
    trade: Trade;
}

const PriceChart = ({ trade }: PriceChartProps) => {
    // Generate mock price data between entry and exit
    // In a real implementation, this would come from actual price history
    const chartData = useMemo(() => {
        const entryPrice = trade.entryPrice;
        const exitPrice = trade.exitPrice;

        // Create a simple price movement simulation
        const numPoints = 20;
        const priceRange = Math.abs(exitPrice - entryPrice);
        const volatility = priceRange * 0.5;

        const data = [];
        let currentPrice = entryPrice;

        for (let i = 0; i <= numPoints; i++) {
            const progress = i / numPoints;

            // Add some random noise but trend toward exit price
            const targetPrice = entryPrice + (exitPrice - entryPrice) * progress;
            const noise = (Math.random() - 0.5) * volatility * (1 - progress);
            currentPrice = targetPrice + noise;

            // Ensure final point is exactly at exit price
            if (i === numPoints) {
                currentPrice = exitPrice;
            }

            data.push({
                index: i,
                price: currentPrice,
                label: i === 0 ? 'Entry' : i === numPoints ? 'Exit' : '',
            });
        }

        return data;
    }, [trade.entryPrice, trade.exitPrice]);

    const isProfit = trade.pnl >= 0;
    const minPrice = Math.min(...chartData.map(d => d.price)) * 0.998;
    const maxPrice = Math.max(...chartData.map(d => d.price)) * 1.002;

    return (
        <div className="flex-1 glass-panel rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-0.5">
                        {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                            <button
                                key={tf}
                                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                    tf === '4h'
                                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-[var(--text-secondary)]">
                        {trade.ticker} - {trade.type}
                    </span>
                    <span className={`text-xs font-medium ${isProfit ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {isProfit ? '+' : ''}{trade.pnlPercentage.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Chart */}
            <div className="p-4">
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
                            <XAxis
                                dataKey="index"
                                tick={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[minPrice, maxPrice]}
                                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `$${v.toFixed(2)}`}
                                width={70}
                                orientation="right"
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                                formatter={(value) => [`$${(value as number).toFixed(2)}`, 'Price']}
                                labelFormatter={() => ''}
                            />
                            {/* Entry price reference line */}
                            <ReferenceLine
                                y={trade.entryPrice}
                                stroke="var(--accent-primary)"
                                strokeDasharray="3 3"
                                label={{
                                    value: `Entry: $${trade.entryPrice.toFixed(2)}`,
                                    position: 'left',
                                    fill: 'var(--accent-primary)',
                                    fontSize: 10,
                                }}
                            />
                            {/* Exit price reference line */}
                            <ReferenceLine
                                y={trade.exitPrice}
                                stroke={isProfit ? 'var(--success)' : 'var(--danger)'}
                                strokeDasharray="3 3"
                                label={{
                                    value: `Exit: $${trade.exitPrice.toFixed(2)}`,
                                    position: 'left',
                                    fill: isProfit ? 'var(--success)' : 'var(--danger)',
                                    fontSize: 10,
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke={isProfit ? 'var(--success)' : 'var(--danger)'}
                                strokeWidth={2}
                                dot={false}
                            />
                            {/* Entry point marker */}
                            <ReferenceDot
                                x={0}
                                y={trade.entryPrice}
                                r={6}
                                fill="var(--accent-primary)"
                                stroke="var(--bg-primary)"
                                strokeWidth={2}
                            />
                            {/* Exit point marker */}
                            <ReferenceDot
                                x={20}
                                y={trade.exitPrice}
                                r={6}
                                fill={isProfit ? 'var(--success)' : 'var(--danger)'}
                                stroke="var(--bg-primary)"
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Trade Info */}
                <div className="flex items-center justify-center gap-8 pt-4 border-t border-[var(--border)] mt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[var(--accent-primary)]" />
                        <span className="text-xs text-[var(--text-secondary)]">
                            Entry: ${trade.entryPrice.toFixed(2)} @ {trade.entryDate ? format(parseISO(trade.entryDate), 'MMM d, HH:mm') : '--'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isProfit ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                        <span className="text-xs text-[var(--text-secondary)]">
                            Exit: ${trade.exitPrice.toFixed(2)} @ {trade.exitDate ? format(parseISO(trade.exitDate), 'MMM d, HH:mm') : '--'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Future TradingView Integration Notice */}
            <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-t border-[var(--border)]">
                <p className="text-[10px] text-[var(--text-tertiary)] text-center">
                    Simplified chart view. TradingView integration coming soon.
                </p>
            </div>
        </div>
    );
};

export default PriceChart;
