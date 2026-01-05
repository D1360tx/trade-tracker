import { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../types';

interface DrawdownAnalysisProps {
    trades?: Trade[];
}

const DrawdownAnalysis = ({ trades: tradesProp }: DrawdownAnalysisProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const { data, maxDrawdown, maxDrawdownPct } = useMemo(() => {
        const closedTrades = trades
            .filter(t => t.status === 'CLOSED' || t.pnl !== 0)
            .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

        if (closedTrades.length === 0) {
            return { data: [], maxDrawdown: 0, maxDrawdownPct: 0 };
        }

        let cumulative = 0;
        let peak = 0;
        let maxDD = 0;
        let maxDDPct = 0;

        const dataPoints = closedTrades.map(t => {
            cumulative += t.pnl;

            // Update peak
            if (cumulative > peak) {
                peak = cumulative;
            }

            // Calculate drawdown
            const drawdown = peak - cumulative;
            const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 0;

            // Track max drawdown
            if (drawdown > maxDD) {
                maxDD = drawdown;
            }
            if (drawdownPct > maxDDPct) {
                maxDDPct = drawdownPct;
            }

            return {
                date: format(parseISO(t.exitDate), 'MMM dd'),
                equity: cumulative,
                peak: peak,
                drawdown: -drawdown, // Negative for visual clarity
                drawdownPct: -drawdownPct
            };
        });

        return {
            data: dataPoints,
            maxDrawdown: maxDD,
            maxDrawdownPct: maxDDPct
        };
    }, [trades]);

    if (data.length === 0) {
        return (
            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No closed trades found.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-bold">Drawdown Analysis</h3>
                    <p className="text-xs text-[var(--text-tertiary)]">Distance from Peak Equity</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-[var(--text-tertiary)]">Max Drawdown</div>
                    <div className="text-lg font-bold text-[var(--danger)]">
                        ${maxDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-[var(--danger)]">
                        ({maxDrawdownPct.toFixed(1)}%)
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <defs>
                        <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
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
                                        <div className="font-bold mb-1">{label}</div>
                                        <div className="space-y-1">
                                            <div>
                                                Equity: <span className="text-[var(--accent-primary)] font-medium">${d.equity.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                Peak: <span className="text-[var(--success)] font-medium">${d.peak.toLocaleString()}</span>
                                            </div>
                                            <div>
                                                Drawdown: <span className="text-[var(--danger)] font-medium">${Math.abs(d.drawdown).toLocaleString()}</span>
                                            </div>
                                            <div className="text-[var(--danger)]">
                                                ({Math.abs(d.drawdownPct).toFixed(1)}%)
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                    <Area
                        type="monotone"
                        dataKey="drawdown"
                        stroke="var(--danger)"
                        fillOpacity={1}
                        fill="url(#colorDrawdown)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DrawdownAnalysis;
