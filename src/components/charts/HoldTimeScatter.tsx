import { useMemo } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

interface HoldTimeScatterProps {
    trades?: Trade[];
}

const HoldTimeScatter = ({ trades: tradesProp }: HoldTimeScatterProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const data = useMemo(() => {
        return trades
            .filter(t => t.status === 'CLOSED' && t.entryDate && t.exitDate)
            .map(t => {
                const start = new Date(t.entryDate).getTime();
                const end = new Date(t.exitDate).getTime();
                // Duration in minutes
                let duration = (end - start) / (1000 * 60);

                // Fallback for weird data where exit < entry (simulated or bad import)
                if (duration < 0) duration = 0;
                // Cap at reasonable max for visualization (e.g. 24 hours * 60 = 1440 min)
                // or just log view it. For now let's keep raw.

                return {
                    id: t.id,
                    ticker: t.ticker,
                    pnl: t.pnl,
                    duration: duration,
                    type: t.pnl > 0 ? 'Win' : 'Loss'
                };
            })
            // Filter out extreme outliers (e.g. > 30 days) if needed, or bad data (0 duration)
            // UPDATE: We allow 0 duration now to handle imported data, but will warn user.
            .filter(d => (d.duration >= 0 || d.pnl !== 0));
    }, [trades]);

    if (trades.length === 0) {
        return (
            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No trades found.</p>
                <p className="text-sm mt-1">Import trades or generate mock data.</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No closed trades with valid P&L.</p>
            </div>
        );
    }

    // Helper to format duration
    const formatDuration = (minutes: number) => {
        if (minutes < 1) return `${(minutes * 60).toFixed(0)}s`;
        if (minutes < 60) {
            const m = Math.floor(minutes);
            const s = Math.round((minutes - m) * 60);
            return s > 0 ? `${m}m ${s}s` : `${m}m`;
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            const m = Math.round(minutes % 60);
            return m > 0 ? `${hours}h ${m}m` : `${hours}h`;
        }
        const days = Math.floor(hours / 24);
        const h = hours % 24;
        return h > 0 ? `${days}d ${h}h` : `${days}d`;
    };

    // Check if we have valid duration variance
    const hasDuration = data.some(d => d.duration > 0);

    return (
        <div className="w-full h-full min-h-[350px] relative">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Hold Time Analysis</h3>
                <span className="text-xs text-[var(--text-tertiary)]">Duration (Minutes) vs P&L</span>
            </div>

            {!hasDuration && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--warning)] text-[var(--warning)] z-10 text-center shadow-2xl max-w-[80%]">
                    <p className="font-bold mb-1">Duration Not Available</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                        Your trades all have 0 duration (Entry Time = Exit Time).
                        This is common with simple CSV imports.
                    </p>
                </div>
            )}

            <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        type="number"
                        dataKey="duration"
                        name="Duration"
                        unit=" min"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        domain={[0, 'auto']}
                    />
                    <YAxis
                        type="number"
                        dataKey="pnl"
                        name="P&L"
                        unit="$"
                        stroke="var(--text-tertiary)"
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                    />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded shadow-xl text-xs">
                                        <div className="font-bold">{d.ticker}</div>
                                        <div>Time: <span className="text-[var(--text-primary)] font-medium">{formatDuration(d.duration)}</span></div>
                                        <div className={d.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            ${d.pnl.toFixed(2)}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Scatter name="Trades" data={data} fill="#8884d8">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};

export default HoldTimeScatter;
