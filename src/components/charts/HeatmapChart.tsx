import { useMemo, useState } from 'react';
import { useTrades } from '../../context/TradeContext';
import type { Trade } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

interface HeatmapChartProps {
    trades?: Trade[];
}

const HeatmapChart = ({ trades: tradesProp }: HeatmapChartProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;
    const [metric, setMetric] = useState<'pnl' | 'winrate'>('pnl');

    const data = useMemo(() => {
        // Initialize grid
        const grid: Record<string, { pnl: number; wins: number; total: number }> = {};

        DAYS.forEach(day => {
            HOURS.forEach(hour => {
                grid[`${day}-${hour}`] = { pnl: 0, wins: 0, total: 0 };
            });
        });

        // Fill grid
        trades.forEach(t => {
            if (!t.entryDate) return;
            const date = new Date(t.entryDate);
            const dayIndex = date.getDay(); // 0=Sun, 1=Mon...
            if (dayIndex === 0 || dayIndex === 6) return; // Skip weekends for now

            const dayName = DAYS[dayIndex - 1]; // Mon is index 1 -> DAYS[0]
            const hour = date.getHours();
            const key = `${dayName}-${hour}`;

            if (grid[key]) {
                grid[key].pnl += t.pnl;
                grid[key].total += 1;
                if (t.pnl > 0) grid[key].wins += 1;
            }
        });

        return grid;
    }, [trades]);

    const getIntensityColor = (value: number, max: number, min: number) => {
        if (metric === 'winrate') {
            // 0-100% : Red to Green
            if (value >= 50) return `rgba(34, 197, 94, ${value / 100})`; // Green
            return `rgba(239, 68, 68, ${1 - (value / 100)})`; // Red
        } else {
            // P&L
            if (value > 0) return `rgba(34, 197, 94, ${Math.min(value / max, 1)})`; // Green
            if (value < 0) return `rgba(239, 68, 68, ${Math.min(Math.abs(value) / Math.abs(min), 1)})`; // Red
            return 'transparent';
        }
    };

    // Calculate max/min for scaling
    const pnlValues = Object.values(data).map(d => d.pnl);
    const maxPnL = Math.max(...pnlValues, 100);
    const minPnL = Math.min(...pnlValues, -100);

    return (
        <div className="w-full text-xs">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Performance Heatmap</h3>
                <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-1">
                    <button
                        onClick={() => setMetric('pnl')}
                        className={`px-3 py-1 rounded-md transition-colors ${metric === 'pnl' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        P&L
                    </button>
                    <button
                        onClick={() => setMetric('winrate')}
                        className={`px-3 py-1 rounded-md transition-colors ${metric === 'winrate' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                    >
                        Win Rate
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Header Row (Hours) */}
                    <div className="flex ml-12 mb-2">
                        {HOURS.map(h => (
                            <div key={h} className="flex-1 text-center text-[var(--text-tertiary)]">
                                {h}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {DAYS.map((day, dayIndex) => (
                        <div key={day} className="flex items-center mb-1 h-8">
                            <div className="w-12 text-[var(--text-secondary)] font-medium">{day}</div>
                            {HOURS.map(hour => {
                                const cell = data[`${day}-${hour}`];
                                const val = metric === 'pnl' ? cell.pnl : (cell.total > 0 ? (cell.wins / cell.total) * 100 : 0);
                                const isEmpty = cell.total === 0;

                                // Show tooltip below for top 2 rows (Mon, Tue), above for others
                                const showBelow = dayIndex < 2;

                                return (
                                    <div
                                        key={hour}
                                        className="flex-1 h-full mx-[1px] rounded-sm relative group"
                                        style={{
                                            backgroundColor: isEmpty
                                                ? 'var(--bg-tertiary)'
                                                : getIntensityColor(val, maxPnL, minPnL)
                                        }}
                                    >
                                        {!isEmpty && (
                                            <div className={`absolute opacity-0 group-hover:opacity-100 ${showBelow ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 z-10 bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded shadow-xl whitespace-nowrap pointer-events-none`}>
                                                <div className="font-bold">{day} {hour}:00</div>
                                                <div>Trades: {cell.total}</div>
                                                <div className={`${cell.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    P&L: ${cell.pnl.toFixed(2)}
                                                </div>
                                                <div>WR: {((cell.wins / cell.total) * 100).toFixed(0)}%</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-end gap-4 mt-2 text-[var(--text-tertiary)]">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div> Costly
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[var(--bg-tertiary)] rounded-sm"></div> No Trades
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div> Profitable
                </div>
            </div>
        </div>
    );
};

export default HeatmapChart;
