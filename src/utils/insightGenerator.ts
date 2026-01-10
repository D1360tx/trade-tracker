import type { Trade } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';

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

export interface CoachingRecommendation {
    id: number;
    category: 'psychology' | 'risk' | 'strategy' | 'timing';
    priority: 'high' | 'medium' | 'low';
    title: string;
    insight: string;
    action: string;
}

export const generateInsights = (trades: Trade[]): {
    metrics: InsightMetric[],
    patterns: InsightPattern[],
    recommendations: CoachingRecommendation[]
} => {
    if (trades.length === 0) {
        return {
            metrics: [
                { id: 1, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
                { id: 2, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
                { id: 3, label: 'Data Needed', value: 'N/A', color: 'text-gray-500', desc: 'Import trades to generate insights.' },
            ],
            patterns: [],
            recommendations: []
        };
    }

    const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());
    const recommendations: CoachingRecommendation[] = [];

    // --- 1. Tilt / Discipline (Consecutive Losses) ---
    let maxLossStreak = 0;
    let currentLossStreak = 0;
    let currentLossStreakDates: string[] = [];

    closedTrades.reverse().forEach((t) => {
        if (t.pnl < 0) {
            currentLossStreak++;
            currentLossStreakDates.push(t.exitDate);
        } else {
            if (currentLossStreak > maxLossStreak) {
                maxLossStreak = currentLossStreak;
            }
            currentLossStreak = 0;
            currentLossStreakDates = [];
        }
    });

    if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
    }

    // Discipline Score
    let disciplineScore = Math.max(0, 100 - (maxLossStreak * 5));
    if (maxLossStreak > 4) disciplineScore -= 10;

    // Revenge Trading Detection
    const revengeVal = maxLossStreak > 3 ? 'High Risk' : maxLossStreak > 1 ? 'Moderate' : 'Low';
    const revengeColor = maxLossStreak > 3 ? 'text-red-500' : maxLossStreak > 1 ? 'text-yellow-500' : 'text-green-500';

    if (maxLossStreak > 3) {
        recommendations.push({
            id: 1,
            category: 'psychology',
            priority: 'high',
            title: 'Break the Revenge Cycle',
            insight: `You hit a ${maxLossStreak}-trade losing streak. This indicates possible emotional trading or strategy breakdown.`,
            action: 'Implement a "3-strike rule": After 3 consecutive losses, take a mandatory break. Review your playbook before re-entering.'
        });
    }

    // --- 2. Asset & Direction Analysis ---
    const tickerStats: Record<string, { pnl: number, wins: number, total: number, totalRisk: number }> = {};
    const dirStats: Record<string, { pnl: number, wins: number, total: number }> = {
        LONG: { pnl: 0, wins: 0, total: 0 },
        SHORT: { pnl: 0, wins: 0, total: 0 }
    };
    const dayStats: Record<string, { pnl: number, count: number, wins: number }> = {};
    const hourStats: Record<number, { pnl: number, count: number }> = {};

    closedTrades.forEach(t => {
        // Ticker Stats
        if (!tickerStats[t.ticker]) tickerStats[t.ticker] = { pnl: 0, wins: 0, total: 0, totalRisk: 0 };
        tickerStats[t.ticker].pnl += t.pnl;
        tickerStats[t.ticker].total += 1;
        tickerStats[t.ticker].totalRisk += Math.abs(t.pnl);
        if (t.pnl > 0) tickerStats[t.ticker].wins += 1;

        // Direction Stats
        if (t.direction) {
            const d = t.direction.toUpperCase();
            if (dirStats[d]) {
                dirStats[d].pnl += t.pnl;
                dirStats[d].total += 1;
                if (t.pnl > 0) dirStats[d].wins += 1;
            }
        }

        // Day Stats
        const day = format(parseISO(t.exitDate), 'EEEE');
        if (!dayStats[day]) dayStats[day] = { pnl: 0, count: 0, wins: 0 };
        dayStats[day].pnl += t.pnl;
        dayStats[day].count += 1;
        if (t.pnl > 0) dayStats[day].wins += 1;

        // Hour Stats (for timing analysis)
        const hour = new Date(t.exitDate).getHours();
        if (!hourStats[hour]) hourStats[hour] = { pnl: 0, count: 0 };
        hourStats[hour].pnl += t.pnl;
        hourStats[hour].count += 1;
    });

    const sortedTickers = Object.entries(tickerStats).sort((a, b) => b[1].pnl - a[1].pnl);
    const bestTicker = sortedTickers[0];
    const worstTicker = sortedTickers[sortedTickers.length - 1];

    // Pattern Detection
    const patterns: InsightPattern[] = [];

    // Best Ticker Pattern
    if (bestTicker && bestTicker[1].pnl > 0) {
        const wr = ((bestTicker[1].wins / bestTicker[1].total) * 100).toFixed(0);
        patterns.push({
            id: 1,
            title: 'Power Ticker',
            desc: `${bestTicker[0]} is your best asset with $${bestTicker[1].pnl.toFixed(0)} profit and ${wr}% win rate across ${bestTicker[1].total} trades.`,
            type: 'positive'
        });
    }

    // Worst Ticker Warning
    if (worstTicker && worstTicker[1].pnl < -100 && worstTicker[1].total > 2) {
        const wr = ((worstTicker[1].wins / worstTicker[1].total) * 100).toFixed(0);
        patterns.push({
            id: 2,
            title: 'Problem Ticker',
            desc: `${worstTicker[0]} has cost you $${Math.abs(worstTicker[1].pnl).toFixed(0)} with only ${wr}% win rate. Consider avoiding or revising your strategy.`,
            type: 'negative'
        });

        recommendations.push({
            id: 2,
            category: 'strategy',
            priority: 'high',
            title: `Reassess ${worstTicker[0]} Strategy`,
            insight: `$${Math.abs(worstTicker[1].pnl).toFixed(0)} lost across ${worstTicker[1].total} trades suggests this asset doesn't align with your edge.`,
            action: `Either develop a specific playbook entry for ${worstTicker[0]} or add it to your "avoid" list.`
        });
    }

    // Directional Bias
    if (Math.abs(dirStats.LONG.pnl - dirStats.SHORT.pnl) > 100 || dirStats.LONG.total === 0 || dirStats.SHORT.total === 0) {
        const betterDir = dirStats.LONG.pnl > dirStats.SHORT.pnl ? 'LONG' : 'SHORT';
        const worseDir = betterDir === 'LONG' ? 'SHORT' : 'LONG';
        const betterWR = dirStats[betterDir].total > 0 ? ((dirStats[betterDir].wins / dirStats[betterDir].total) * 100).toFixed(0) : '0';
        const worseWR = dirStats[worseDir].total > 0 ? ((dirStats[worseDir].wins / dirStats[worseDir].total) * 100).toFixed(0) : '0';

        patterns.push({
            id: 3,
            title: 'Directional Bias',
            desc: `${betterDir} trades have a ${betterWR}% win rate vs ${worseWR}% for ${worseDir} trades. Your edge is clearly directional.`,
            type: dirStats[worseDir].pnl < 0 ? 'negative' : 'positive'
        });

        if (dirStats[worseDir].pnl < -200) {
            recommendations.push({
                id: 3,
                category: 'strategy',
                priority: 'medium',
                title: `Focus on ${betterDir} Setups`,
                insight: `${worseDir} trades are dragging down your performance by $${Math.abs(dirStats[worseDir].pnl).toFixed(0)}.`,
                action: `Consider specializing in ${betterDir} trades or dramatically reducing ${worseDir} position sizes while you refine that strategy.`
            });
        }
    }

    // Day of Week Analysis
    const avgDayStats = Object.entries(dayStats).map(([day, data]) => ({
        day,
        totalPnl: data.pnl,
        avgPnl: data.pnl / data.count,
        winRate: (data.wins / data.count) * 100
    }));

    const bestDay = [...avgDayStats].sort((a, b) => b.totalPnl - a.totalPnl)[0];
    const worstDay = [...avgDayStats].sort((a, b) => a.totalPnl - b.totalPnl)[0];

    if (worstDay && worstDay.totalPnl < 0) {
        patterns.push({
            id: 4,
            title: 'Weekly Leak',
            desc: `${worstDay.day} is your worst day, down $${Math.abs(worstDay.totalPnl).toFixed(0)} (${worstDay.winRate.toFixed(0)}% win rate).`,
            type: 'negative'
        });

        recommendations.push({
            id: 4,
            category: 'timing',
            priority: 'medium',
            title: `Beware of ${worstDay.day}s`,
            insight: `You consistently underperform on ${worstDay.day}s. This could be due to market conditions, psychology, or routine disruption.`,
            action: `Either take ${worstDay.day}s off entirely, or reduce position sizes by 50% and trade only your highest-conviction setups.`
        });
    } else if (bestDay && bestDay.totalPnl > 0) {
        patterns.push({
            id: 4,
            title: 'Golden Day',
            desc: `${bestDay.day} is your strongest day, netting $${bestDay.totalPnl.toFixed(0)} (${bestDay.winRate.toFixed(0)}% win rate).`,
            type: 'positive'
        });
    }

    // Trading Frequency Analysis
    const recentTrades = closedTrades.slice(0, 20);
    if (recentTrades.length > 5) {
        const dates = recentTrades.map(t => parseISO(t.exitDate));
        const daysBetween = dates.slice(1).map((date, i) => differenceInDays(dates[i], date));
        const avgDaysBetween = daysBetween.reduce((sum, d) => sum + d, 0) / daysBetween.length;

        if (avgDaysBetween < 0.2) { // Multiple trades per day
            const overtradesCount = recentTrades.filter(t => t.pnl < 0).length;
            if (overtradesCount / recentTrades.length > 0.6) {
                recommendations.push({
                    id: 5,
                    category: 'psychology',
                    priority: 'high',
                    title: 'Overtrading Alert',
                    insight: `You're averaging ${(1 / avgDaysBetween).toFixed(1)} trades per day with a ${((recentTrades.length - overtradesCount) / recentTrades.length * 100).toFixed(0)}% win rate. High frequency often correlates with emotional trading.`,
                    action: 'Set a hard limit: Max 3 trades per day. Quality over quantity. Each trade should meet strict playbook criteria.'
                });
            }
        }
    }

    // Win/Loss Streak Analysis
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

    // Risk Management Check
    const avgWin = closedTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / closedTrades.filter(t => t.pnl > 0).length || 0;
    const avgLoss = Math.abs(closedTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / closedTrades.filter(t => t.pnl < 0).length || 0);
    const riskRewardRatio = avgWin / avgLoss;

    if (riskRewardRatio < 1.5 && closedTrades.length > 10) {
        recommendations.push({
            id: 6,
            category: 'risk',
            priority: 'high',
            title: 'Improve Risk/Reward Ratio',
            insight: `Your average win ($${avgWin.toFixed(2)}) to average loss ($${avgLoss.toFixed(2)}) ratio is ${riskRewardRatio.toFixed(2)}:1. Professional traders aim for 2:1 or better.`,
            action: 'Let winners run longer and cut losses earlier. Review your exit rules in your playbook and consider wider profit targets.'
        });
    }

    return {
        metrics: [
            {
                id: 1,
                label: 'Revenge Risk',
                value: revengeVal,
                color: revengeColor,
                desc: maxLossStreak > 3 ? `Max loss streak: ${maxLossStreak} trades` : 'Losing streaks kept short ✓'
            },
            {
                id: 2,
                label: 'Discipline Score',
                value: `${disciplineScore.toFixed(0)}%`,
                color: disciplineScore > 80 ? 'text-blue-500' : disciplineScore > 60 ? 'text-yellow-500' : 'text-red-500',
                desc: 'Based on streak management & consistency'
            },
            {
                id: 3,
                label: 'Risk/Reward',
                value: riskRewardRatio > 0 ? `${riskRewardRatio.toFixed(2)}:1` : 'N/A',
                color: riskRewardRatio >= 2 ? 'text-green-500' : riskRewardRatio >= 1.5 ? 'text-yellow-500' : 'text-red-500',
                desc: `Avg win: $${avgWin.toFixed(0)} | Avg loss: $${avgLoss.toFixed(0)}`
            },
        ],
        patterns: patterns.slice(0, 6),
        recommendations: recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }).slice(0, 5)
    };
};
