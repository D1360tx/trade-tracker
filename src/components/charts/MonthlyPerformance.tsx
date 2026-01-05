import { useMemo } from 'react';
import { useTrades } from '../../context/TradeContext';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MonthlyPerformanceProps {
    trades?: Trade[];
}

const MonthlyPerformance = ({ trades: tradesProp }: MonthlyPerformanceProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const monthlyData = useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);

        if (closedTrades.length === 0) return [];

        // Group by month
        const byMonth = new Map<string, {
            pnl: number;
            trades: number;
            wins: number;
            bestDay: number;
            worstDay: number;
            dailyPnL: Map<string, number>;
        }>();

        closedTrades.forEach(t => {
            const monthKey = format(parseISO(t.exitDate), 'yyyy-MM');
            const dayKey = format(parseISO(t.exitDate), 'yyyy-MM-dd');

            if (!byMonth.has(monthKey)) {
                byMonth.set(monthKey, {
                    pnl: 0,
                    trades: 0,
                    wins: 0,
                    bestDay: -Infinity,
                    worstDay: Infinity,
                    dailyPnL: new Map()
                });
            }

            const month = byMonth.get(monthKey)!;
            month.pnl += t.pnl;
            month.trades += 1;
            if (t.pnl > 0) month.wins += 1;

            // Track daily P&L for best/worst day
            const currentDayPnL = month.dailyPnL.get(dayKey) || 0;
            month.dailyPnL.set(dayKey, currentDayPnL + t.pnl);
        });

        // Calculate best/worst days
        byMonth.forEach(month => {
            month.dailyPnL.forEach(pnl => {
                if (pnl > month.bestDay) month.bestDay = pnl;
                if (pnl < month.worstDay) month.worstDay = pnl;
            });

            // Reset if no valid days
            if (month.bestDay === -Infinity) month.bestDay = 0;
            if (month.worstDay === Infinity) month.worstDay = 0;
        });

        // Convert to array and sort
        return Array.from(byMonth.entries())
            .map(([month, data]) => ({
                month: format(parseISO(`${month}-01`), 'MMM yyyy'),
                monthKey: month,
                pnl: data.pnl,
                trades: data.trades,
                winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
                bestDay: data.bestDay,
                worstDay: data.worstDay
            }))
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey)); // Most recent first
    }, [trades]);

    if (monthlyData.length === 0) {
        return (
            <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No closed trades found.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[350px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Monthly Performance</h3>
                <span className="text-xs text-[var(--text-tertiary)]">{monthlyData.length} Months</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--border)]">
                            <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Month</th>
                            <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Total P&L</th>
                            <th className="text-center py-2 px-3 text-[var(--text-secondary)] font-medium">Trades</th>
                            <th className="text-center py-2 px-3 text-[var(--text-secondary)] font-medium">Win Rate</th>
                            <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Best Day</th>
                            <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Worst Day</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyData.map((row, idx) => (
                            <tr
                                key={row.monthKey}
                                className={`border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)]/30 transition-colors ${idx === 0 ? 'bg-[var(--bg-tertiary)]/20' : ''
                                    }`}
                            >
                                <td className="py-3 px-3 font-medium text-[var(--text-primary)]">
                                    {row.month}
                                </td>
                                <td className={`py-3 px-3 text-right font-bold ${row.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                    }`}>
                                    {row.pnl >= 0 ? '+' : ''}${row.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-3 text-center text-[var(--text-primary)]">
                                    {row.trades}
                                </td>
                                <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.winRate >= 50
                                            ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                            : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                        }`}>
                                        {row.winRate.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1 text-[var(--success)]">
                                        <TrendingUp size={14} />
                                        <span className="font-medium">
                                            +${row.bestDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1 text-[var(--danger)]">
                                        <TrendingDown size={14} />
                                        <span className="font-medium">
                                            ${row.worstDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlyPerformance;
