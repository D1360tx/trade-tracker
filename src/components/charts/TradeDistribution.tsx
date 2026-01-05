import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ScatterChart, Scatter } from 'recharts';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

interface TradeDistributionProps {
    trades?: Trade[];
}

const TradeDistribution = ({ trades: tradesProp }: TradeDistributionProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;
    const [view, setView] = useState<'distribution' | 'holdtime'>('distribution');

    // Win/Loss Distribution Data
    const distributionData = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);

        if (closedTrades.length === 0) return [];

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

        closedTrades.forEach(t => {
            const pnl = t.pnl;
            for (const bin of bins) {
                if (pnl > bin.min && pnl <= bin.max) {
                    bin.count++;
                    break;
                }
            }
        });

        return bins.filter(b => b.count > 0);
    }, [trades]);

    // Hold Time Scatter Data
    const holdTimeData = useMemo(() => {
        return trades
            .filter(t => t.status === 'CLOSED' && t.entryDate && t.exitDate)
            .map(t => {
                const start = new Date(t.entryDate).getTime();
                const end = new Date(t.exitDate).getTime();
                let duration = (end - start) / (1000 * 60);
                if (duration < 0) duration = 0;

                return {
                    id: t.id,
                    ticker: t.ticker,
                    pnl: t.pnl,
                    duration: duration,
                    type: t.pnl > 0 ? 'Win' : 'Loss'
                };
            })
            .filter(d => (d.duration >= 0 || d.pnl !== 0));
    }, [trades]);

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

    const hasDuration = holdTimeData.some(d => d.duration > 0);

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
                <h3 className="text-lg font-bold">
                    {view === 'distribution' ? 'Win/Loss Distribution' : 'Hold Time Analysis'}
                </h3>
                <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                    <button
                        onClick={() => setView('distribution')}
                        className={`px-3 py-1 rounded-md transition-colors text-xs ${view === 'distribution' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        Distribution
                    </button>
                    <button
                        onClick={() => setView('holdtime')}
                        className={`px-3 py-1 rounded-md transition-colors text-xs ${view === 'holdtime' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        Hold Time
                    </button>
                </div>
            </div>

            {view === 'distribution' ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={distributionData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
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
                            {distributionData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.min < 0 ? 'var(--danger)' : 'var(--success)'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="relative h-[300px]">
                    {!hasDuration && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--warning)] text-[var(--warning)] z-10 text-center shadow-2xl max-w-[80%]">
                            <p className="font-bold mb-1">Duration Not Available</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                                Your trades all have 0 duration (Entry Time = Exit Time).
                                This is common with simple CSV imports.
                            </p>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
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
                            <Scatter name="Trades" data={holdTimeData} fill="#8884d8">
                                {holdTimeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default TradeDistribution;
