import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

interface SymbolPerformanceChartProps {
    trades?: Trade[];
}

const SymbolPerformanceChart = ({ trades: tradesProp }: SymbolPerformanceChartProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;
    const [groupBy, setGroupBy] = useState<'ticker' | 'type'>('ticker');

    const data = useMemo(() => {
        const aggregator: Record<string, number> = {};

        trades.forEach(t => {
            if (t.status !== 'CLOSED') return;
            const key = groupBy === 'ticker' ? t.ticker : t.type;
            const normalizedKey = key ? key.toUpperCase() : 'UNKNOWN';
            aggregator[normalizedKey] = (aggregator[normalizedKey] || 0) + t.pnl;
        });

        let result = Object.entries(aggregator)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort by P&L descending

        // If grouping by ticker, limit to Top 10 (5 Winners + 5 Losers optimally, or just top activity)
        if (groupBy === 'ticker') {
            // Let's show the extremes: Top 5 Winners and Top 5 Losers
            const winners = result.filter(d => d.value > 0);
            const losers = result.filter(d => d.value < 0);
            const topWinners = winners.slice(0, 8);
            const topLosers = losers.reverse().slice(0, 8).reverse(); // Sort losers ascending (biggest loss first for slice) then reverse back

            // Merge and re-sort
            result = [...topWinners, ...topLosers].sort((a, b) => b.value - a.value);
        }

        return result;
    }, [trades, groupBy]);

    return (
        <div className="w-full h-full min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Performance by {groupBy === 'ticker' ? 'Symbol' : 'Asset Type'}</h3>

                <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                    <button
                        onClick={() => setGroupBy('ticker')}
                        className={`px-3 py-1 rounded-md transition-colors text-xs ${groupBy === 'ticker' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        Ticker
                    </button>
                    <button
                        onClick={() => setGroupBy('type')}
                        className={`px-3 py-1 rounded-md transition-colors text-xs ${groupBy === 'type' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        Asset Class
                    </button>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        type="number"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
                        tickFormatter={(val) => `$${val}`}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
                        width={150}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded shadow-xl text-sm">
                                        <div className="font-bold text-[var(--text-primary)] mb-1">{d.name}</div>
                                        <div className={`font-semibold ${d.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {d.value >= 0 ? '+' : ''}${d.value.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.value >= 0 ? 'var(--success)' : 'var(--danger)'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SymbolPerformanceChart;
