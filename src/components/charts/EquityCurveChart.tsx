import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

interface EquityCurveChartProps {
    trades?: Trade[];
}

const EquityCurveChart = ({ trades: tradesProp }: EquityCurveChartProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const data = useMemo(() => {
        // Filter valid trades and sort by date
        const sorted = [...trades]
            .filter(t => t.status === 'CLOSED' && t.exitDate)
            .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

        let cumulative = 0;
        const curve = sorted.map(t => {
            cumulative += t.pnl;
            return {
                date: new Date(t.exitDate).toLocaleDateString(),
                rawDate: t.exitDate,
                pnl: t.pnl,
                equity: cumulative
            };
        });

        // Add starting point
        if (curve.length > 0) {
            curve.unshift({
                date: 'Start',
                rawDate: '',
                pnl: 0,
                equity: 0
            });
        }

        return curve;
    }, [trades]);

    return (
        <div className="w-full h-full min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Equity Curve</h3>
                <span className="text-xs text-[var(--text-tertiary)]">Cumulative P&L Over Time</span>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        dataKey="date"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded shadow-xl text-xs">
                                        <div className="font-bold">{label}</div>
                                        <div className="text-[var(--accent-primary)] font-bold mb-1">
                                            Equity: ${d.equity.toLocaleString()}
                                        </div>
                                        {d.date !== 'Start' && (
                                            <div className={d.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                Trade P&L: ${d.pnl.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="var(--accent-primary)"
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EquityCurveChart;
