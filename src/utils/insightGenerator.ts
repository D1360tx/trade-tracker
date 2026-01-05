import type { Trade } from '../types';
import { format, parseISO } from 'date-fns';

export interface InsightMetric {
    id: number;
    label: string;
    value: string;
    color: string;
    desc: string;
}

export interface InsightPattern {
    id: number;
    title: string;
    desc: string;
    type: 'positive' | 'negative';
}

export const generateInsights = (trades: Trade[]): { metrics: InsightMetric[], patterns: InsightPattern[] } => {
    if (trades.length === 0) {
        return {
            metrics: [
                { id: 1, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
                { id: 2, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
                { id: 3, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
            ],
            patterns: []
        };
    }

    const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());

    // --- 1. Tilt / Discipline (Consecutive Losses in short time) ---
    // Simple heuristic: If > 3 losses happen on the same day within 2 hours, maybe tilt.
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    closedTrades.reverse().forEach((t) => { // Process chronologically
        if (t.pnl < 0) {
            currentLossStreak++;
        } else {
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            currentLossStreak = 0;
        }
    });
    maxLossStreak = Math.max(maxLossStreak, currentLossStreak);

    // Heuristic Score for "Discipline"
    // 100% - (MaxLossStreak * 5%)
    let disciplineScore = Math.max(0, 100 - (maxLossStreak * 5));
    if (maxLossStreak > 4) disciplineScore -= 10;

    // Revenge Trading Metric
    const revengeVal = maxLossStreak > 3 ? 'High Risk' : maxLossStreak > 1 ? 'Moderate' : 'Low';
    const revengeColor = maxLossStreak > 3 ? 'text-red-500' : maxLossStreak > 1 ? 'text-yellow-500' : 'text-green-500';

    // --- 2. Best Patterns ---
    // By Ticker
    const tickerStats: Record<string, { pnl: number, wins: number, total: number }> = {};
    // By Direction
    const dirStats: Record<string, { pnl: number, wins: number, total: number }> = { LONG: { pnl: 0, wins: 0, total: 0 }, SHORT: { pnl: 0, wins: 0, total: 0 } };
    // By Day of Week
    const dayStats: Record<string, { pnl: number, count: number }> = {};

    closedTrades.forEach(t => {
        // Ticker
        if (!tickerStats[t.ticker]) tickerStats[t.ticker] = { pnl: 0, wins: 0, total: 0 };
        tickerStats[t.ticker].pnl += t.pnl;
        tickerStats[t.ticker].total += 1;
        if (t.pnl > 0) tickerStats[t.ticker].wins += 1;

        // Direction
        if (t.direction) {
            const d = t.direction.toUpperCase();
            if (dirStats[d]) {
                dirStats[d].pnl += t.pnl;
                dirStats[d].total += 1;
                if (t.pnl > 0) dirStats[d].wins += 1;
            }
        }

        // Day
        const day = format(parseISO(t.exitDate), 'EEEE');
        if (!dayStats[day]) dayStats[day] = { pnl: 0, count: 0 };
        dayStats[day].pnl += t.pnl;
        dayStats[day].count += 1;
    });

    const sortedTickers = Object.entries(tickerStats).sort((a, b) => b[1].pnl - a[1].pnl);
    const bestTicker = sortedTickers[0];

    // Day Stats Sorting
    const avgDayStats = Object.entries(dayStats).map(([day, data]) => ({
        day,
        totalPnl: data.pnl,
        avgPnl: data.pnl / data.count
    }));

    const bestDay = [...avgDayStats].sort((a, b) => b.totalPnl - a.totalPnl)[0];
    const worstDay = [...avgDayStats].sort((a, b) => a.totalPnl - b.totalPnl)[0];

    const patterns: InsightPattern[] = [];

    // Add Best Ticker Pattern
    if (bestTicker && bestTicker[1].pnl > 0) {
        const wr = ((bestTicker[1].wins / bestTicker[1].total) * 100).toFixed(0);
        patterns.push({
            id: 1,
            title: 'Power Ticker',
            desc: `Your best asset is ${bestTicker[0]} with $${bestTicker[1].pnl.toFixed(0)} profit and ${wr}% win rate.`,
            type: 'positive'
        });
    }

    // Add Direction Pattern
    if (Math.abs(dirStats.LONG.pnl - dirStats.SHORT.pnl) > 100) {
        const betterDir = dirStats.LONG.pnl > dirStats.SHORT.pnl ? 'LONG' : 'SHORT';
        const worseDir = betterDir === 'LONG' ? 'SHORT' : 'LONG';
        patterns.push({
            id: 2,
            title: 'Directional Bias',
            desc: `You are significantly more profitable on ${betterDir} trades than ${worseDir}.`,
            type: dirStats[worseDir].pnl < 0 ? 'negative' : 'positive'
        });
    }

    // Add Day Pattern
    if (worstDay && worstDay.totalPnl < 0) {
        patterns.push({
            id: 3,
            title: 'Weekly Leak',
            desc: `Avoid trading on ${worstDay.day}s? You are down $${Math.abs(worstDay.totalPnl).toFixed(0)} on this day.`,
            type: 'negative'
        });
    } else if (bestDay && bestDay.totalPnl > 0) {
        patterns.push({
            id: 3,
            title: 'Golden Day',
            desc: `${bestDay.day} is your strongest day, netting $${bestDay.totalPnl.toFixed(0)}.`,
            type: 'positive'
        });
    }

    // Win Streak Calculation
    let maxWinStreak = 0;
    let currentWinStreak = 0;

    closedTrades.reverse().forEach((t) => {
        if (t.pnl > 0) {
            currentWinStreak++;
        } else {
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
            currentWinStreak = 0;
        }
    });
    maxWinStreak = Math.max(maxWinStreak, currentWinStreak);

    return {
        metrics: [
            {
                id: 1,
                label: 'Revenge Risk',
                value: revengeVal,
                color: revengeColor,
                desc: maxLossStreak > 3 ? `Max loss streak: ${maxLossStreak}` : 'Losing streaks kept short.'
            },
            {
                id: 2,
                label: 'Discipline Score',
                value: `${disciplineScore.toFixed(0)}%`,
                color: disciplineScore > 80 ? 'text-blue-500' : 'text-yellow-500',
                desc: 'Based on streak management.'
            },
            {
                id: 3,
                label: 'Best Win Streak',
                value: maxWinStreak.toString(),
                color: 'text-green-500',
                desc: `Max consecutive wins: ${maxWinStreak}`
            },
        ],
        patterns: patterns.slice(0, 4) // Limit to top results
    };
};
