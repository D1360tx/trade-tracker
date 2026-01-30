import { useMemo } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import type { Trade } from '../../types';
import { calculateEquityCurve, calculateMaxDrawdown } from '../../utils/equityCalculations';

export interface V2Stats {
    // Basic metrics
    totalPnL: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;

    // Avg Win/Loss
    avgWin: number;
    avgLoss: number;
    avgWinLossRatio: number;

    // Trade counts
    winningTrades: number;
    losingTrades: number;
    breakEvenTrades: number;
    openTrades: number;

    // Daily aggregates
    tradingDays: number;
    winningDays: number;
    losingDays: number;
    breakEvenDays: number;
    avgDailyPnL: number;
    avgWinningDayPnL: number;
    avgLosingDayPnL: number;

    // Streaks
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    maxConsecutiveWinningDays: number;
    maxConsecutiveLosingDays: number;

    // Time metrics
    avgHoldTimeAll: number; // in minutes
    avgHoldTimeWinning: number;
    avgHoldTimeLosing: number;

    // Advanced metrics
    expectancy: number;
    maxDrawdown: number;
    maxDrawdownPercentage: number;
    avgDrawdown: number;
    largestProfit: number;
    largestLoss: number;
    largestProfitableDay: number;
    largestLosingDay: number;
    avgTradeP_L: number;

    // Fees & costs
    totalCommissions: number;
    totalSwap: number;

    // R-Multiple (if initialRisk is set)
    avgRealizedRMultiple: number;

    // Volume
    avgDailyVolume: number; // trades per day
}

export interface MonthlyStats {
    year: number;
    month: number;
    monthName: string;
    pnl: number;
    trades: number;
    winRate: number;
}

export const useV2Stats = (trades: Trade[], allTrades?: Trade[]): V2Stats => {
    return useMemo(() => {
        // Filter to closed trades
        const closedTrades = trades.filter(t => t.status === 'CLOSED');
        const openTradesCount = allTrades
            ? allTrades.filter(t => t.status === 'OPEN').length
            : trades.filter(t => t.status === 'OPEN').length;

        // Sort by exit date for sequential analysis
        const sortedTrades = [...closedTrades].sort(
            (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        // Basic categorization
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl < 0);
        const breakEvenTrades = closedTrades.filter(t => t.pnl === 0);

        // Basic metrics
        const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
        const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

        // Avg Win/Loss
        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
        const avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;

        // Daily P&L aggregation
        const dailyPnL: Record<string, number> = {};
        closedTrades.forEach(t => {
            const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            dailyPnL[day] = (dailyPnL[day] || 0) + t.pnl;
        });

        const dailyValues = Object.values(dailyPnL);
        const winningDays = dailyValues.filter(v => v > 0);
        const losingDays = dailyValues.filter(v => v < 0);
        const breakEvenDays = dailyValues.filter(v => v === 0);

        const tradingDays = dailyValues.length;
        const avgDailyPnL = tradingDays > 0 ? totalPnL / tradingDays : 0;
        const avgWinningDayPnL = winningDays.length > 0 ? winningDays.reduce((a, b) => a + b, 0) / winningDays.length : 0;
        const avgLosingDayPnL = losingDays.length > 0 ? losingDays.reduce((a, b) => a + b, 0) / losingDays.length : 0;
        const largestProfitableDay = winningDays.length > 0 ? Math.max(...winningDays) : 0;
        const largestLosingDay = losingDays.length > 0 ? Math.min(...losingDays) : 0;

        // Volume
        const avgDailyVolume = tradingDays > 0 ? closedTrades.length / tradingDays : 0;

        // Trade streaks
        let maxConsecutiveWins = 0;
        let maxConsecutiveLosses = 0;
        let currentWinStreak = 0;
        let currentLoseStreak = 0;

        sortedTrades.forEach(t => {
            if (t.pnl > 0) {
                currentWinStreak++;
                currentLoseStreak = 0;
                maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
            } else if (t.pnl < 0) {
                currentLoseStreak++;
                currentWinStreak = 0;
                maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLoseStreak);
            } else {
                // Break-even resets both streaks
                currentWinStreak = 0;
                currentLoseStreak = 0;
            }
        });

        // Daily streaks
        const sortedDays = Object.entries(dailyPnL).sort(([a], [b]) => a.localeCompare(b));
        let maxConsecutiveWinningDays = 0;
        let maxConsecutiveLosingDays = 0;
        let currentWinDayStreak = 0;
        let currentLoseDayStreak = 0;

        sortedDays.forEach(([, pnl]) => {
            if (pnl > 0) {
                currentWinDayStreak++;
                currentLoseDayStreak = 0;
                maxConsecutiveWinningDays = Math.max(maxConsecutiveWinningDays, currentWinDayStreak);
            } else if (pnl < 0) {
                currentLoseDayStreak++;
                currentWinDayStreak = 0;
                maxConsecutiveLosingDays = Math.max(maxConsecutiveLosingDays, currentLoseDayStreak);
            } else {
                currentWinDayStreak = 0;
                currentLoseDayStreak = 0;
            }
        });

        // Hold time calculations
        const calculateAvgHoldTime = (tradesToAnalyze: Trade[]): number => {
            let totalMinutes = 0;
            let count = 0;
            tradesToAnalyze.forEach(t => {
                if (t.entryDate && t.exitDate) {
                    const minutes = differenceInMinutes(parseISO(t.exitDate), parseISO(t.entryDate));
                    if (minutes > 0) {
                        totalMinutes += minutes;
                        count++;
                    }
                }
            });
            return count > 0 ? totalMinutes / count : 0;
        };

        const avgHoldTimeAll = calculateAvgHoldTime(closedTrades);
        const avgHoldTimeWinning = calculateAvgHoldTime(winningTrades);
        const avgHoldTimeLosing = calculateAvgHoldTime(losingTrades);

        // Expectancy
        const lossRate = closedTrades.length > 0 ? losingTrades.length / closedTrades.length : 0;
        const expectancy = (winRate / 100 * avgWin) - (lossRate * avgLoss);

        // Drawdown calculations
        const equityCurve = calculateEquityCurve(closedTrades);
        const maxDrawdownResult = calculateMaxDrawdown(equityCurve);
        const maxDrawdown = maxDrawdownResult?.absolute || 0;
        const maxDrawdownPercentage = maxDrawdownResult?.percentage || 0;

        // Average drawdown (simplified: average distance from peak at each point)
        let avgDrawdown = 0;
        if (equityCurve.length > 1) {
            let peak = 0;
            let totalDrawdown = 0;
            equityCurve.forEach(point => {
                if (point.equity > peak) peak = point.equity;
                const dd = peak - point.equity;
                totalDrawdown += dd;
            });
            avgDrawdown = totalDrawdown / equityCurve.length;
        }

        // Largest single trade
        const largestProfit = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
        const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

        // Average trade P&L
        const avgTradeP_L = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0;

        // Total commissions
        const totalCommissions = closedTrades.reduce((sum, t) => sum + (t.fees || 0), 0);

        // Total swap (not tracked in current model, return 0)
        const totalSwap = 0;

        // R-Multiple calculation
        const tradesWithRisk = closedTrades.filter(t => t.initialRisk && t.initialRisk > 0);
        const avgRealizedRMultiple = tradesWithRisk.length > 0
            ? tradesWithRisk.reduce((sum, t) => sum + (t.pnl / (t.initialRisk || 1)), 0) / tradesWithRisk.length
            : 0;

        return {
            totalPnL,
            winRate,
            profitFactor,
            totalTrades: closedTrades.length,
            avgWin,
            avgLoss,
            avgWinLossRatio,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            breakEvenTrades: breakEvenTrades.length,
            openTrades: openTradesCount,
            tradingDays,
            winningDays: winningDays.length,
            losingDays: losingDays.length,
            breakEvenDays: breakEvenDays.length,
            avgDailyPnL,
            avgWinningDayPnL,
            avgLosingDayPnL,
            maxConsecutiveWins,
            maxConsecutiveLosses,
            maxConsecutiveWinningDays,
            maxConsecutiveLosingDays,
            avgHoldTimeAll,
            avgHoldTimeWinning,
            avgHoldTimeLosing,
            expectancy,
            maxDrawdown,
            maxDrawdownPercentage,
            avgDrawdown,
            largestProfit,
            largestLoss,
            largestProfitableDay,
            largestLosingDay,
            avgTradeP_L,
            totalCommissions,
            totalSwap,
            avgRealizedRMultiple,
            avgDailyVolume,
        };
    }, [trades, allTrades]);
};

export const useMonthlyStats = (trades: Trade[]): MonthlyStats[] => {
    return useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');

        // Group by year-month
        const monthlyMap: Record<string, Trade[]> = {};
        closedTrades.forEach(t => {
            const key = format(parseISO(t.exitDate), 'yyyy-MM');
            if (!monthlyMap[key]) monthlyMap[key] = [];
            monthlyMap[key].push(t);
        });

        // Calculate stats for each month
        return Object.entries(monthlyMap)
            .map(([key, monthTrades]) => {
                const [year, month] = key.split('-').map(Number);
                const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
                const wins = monthTrades.filter(t => t.pnl > 0).length;
                const winRate = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0;

                return {
                    year,
                    month,
                    monthName: format(new Date(year, month - 1), 'MMM yyyy'),
                    pnl,
                    trades: monthTrades.length,
                    winRate,
                };
            })
            .sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.month - b.month;
            });
    }, [trades]);
};

// Helper to format hold time for display
export const formatHoldTime = (minutes: number): string => {
    if (minutes === 0) return '--';

    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.round(minutes % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (mins > 0 && days === 0) parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);

    return parts.join(', ') || '--';
};
