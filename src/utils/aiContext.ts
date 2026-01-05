import type { Trade } from '../types';
// import { format, parseISO } from 'date-fns';

export const buildTradeContext = (trades: Trade[]): string => {
    if (trades.length === 0) return "User has no trades logged yet.";

    const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);
    const totalPnL = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
    const winRate = (closedTrades.filter(t => t.pnl > 0).length / closedTrades.length * 100) || 0;

    // Group by Day
    const dailyPnL: Record<string, number> = {};
    closedTrades.forEach(t => {
        const date = t.exitDate.split('T')[0];
        dailyPnL[date] = (dailyPnL[date] || 0) + t.pnl;
    });

    // Best/Worst Day
    const days = Object.entries(dailyPnL);
    const bestDay = days.reduce((max, current) => current[1] > max[1] ? current : max, ['', -Infinity]);
    const worstDay = days.reduce((min, current) => current[1] < min[1] ? current : min, ['', Infinity]);

    // Recent Trades (Last 5)
    // Sort chronologically descending
    const recentTrades = [...closedTrades]
        .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime())
        .slice(0, 5)
        .map(t => `${t.ticker} (${t.direction}): $${t.pnl.toFixed(2)}`)
        .join(', ');

    // Strategy Performance
    const strategyStats: Record<string, { wins: number, total: number, pnl: number }> = {};
    closedTrades.forEach(t => {
        const s = t.strategyId || 'No Strategy';
        if (!strategyStats[s]) strategyStats[s] = { wins: 0, total: 0, pnl: 0 };
        strategyStats[s].total++;
        strategyStats[s].pnl += t.pnl;
        if (t.pnl > 0) strategyStats[s].wins++;
    });

    const strategySummary = Object.entries(strategyStats)
        .map(([id, stats]) => {
            const wr = (stats.wins / stats.total * 100).toFixed(0);
            return `${id}: ${wr}% WR, $${stats.pnl.toFixed(0)} PnL`;
        })
        .join('; ');

    return `
    Current Stats:
    - Total P&L: $${totalPnL.toFixed(2)}
    - Win Rate: ${winRate.toFixed(1)}%
    - Total Trades: ${closedTrades.length}
    - Best Day: ${bestDay[0]} ($${bestDay[1].toFixed(2)})
    - Worst Day: ${worstDay[0]} ($${worstDay[1].toFixed(2)})

    Recent Activity: ${recentTrades}

    Strategy Performance: ${strategySummary}
    `;
};
