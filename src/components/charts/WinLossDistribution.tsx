import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

interface WinLossDistributionProps {
    trades?: Trade[];
}

const WinLossDistribution = ({ trades: tradesProp }: WinLossDistributionProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const data = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);

        if (closedTrades.length === 0) return [];

        // Define bins for P&L ranges
        const bins = [
            { label: '< -$500', min: -Infinity, max: -500, count: 0 },
            { label: '-$500 to -$250', min: -500, max: -250, count: 0 },
            { label: '-$250 to -$100', min: -250, max: -100, count: 0 },
            { label: '-$100 to -$50', min: -100, max: -50, count: 0 },
            { label: '-$50 to $0', min: -50, max: 0, count: 0 },
            { label: '$0 to $50', min: 0, max: 50, count: 0 },
            { label: '$50 to $100', min: 50, max: 100, count: 0 },
            { label: '$100 to $250', min: 100, max: 250, count: 0 },
            { label: '$250 to $500', min: 250, max: 500, count: 0 },
            { label: '> $500', min: 500, max: Infinity, count: 0 }
        ];

        // Count trades in each bin
        closedTrades.forEach(t => {
            const pnl = t.pnl;
            for (const bin of bins) {
                if (pnl > bin.min && pnl <= bin.max) {
                    bin.count++;
                    break;
                }
            }
        });

        // Return only bins with data
        return bins.filter(b => b.count > 0);
    }, [trades]);

    if (trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).length === 0) {
        return (
            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No closed trades found.</p>
                <p className="text-sm mt-1">Import trades or generate data.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Win/Loss Distribution</h3>
                <span className="text-xs text-[var(--text-tertiary)]">Trade Count by P&L Range</span>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        dataKey="label"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        label={{ value: 'Trade Count', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-tertiary)', fontSize: 12 } }}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded shadow-xl text-xs">
                                        <div className="font-bold">{d.label}</div>
                                        <div className="text-[var(--text-primary)]">
                                            Trades: <span className="font-medium">{d.count}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.min < 0 ? 'var(--danger)' : 'var(--success)'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default WinLossDistribution;
