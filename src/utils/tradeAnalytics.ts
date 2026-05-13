import { format, isWithinInterval, parseISO } from 'date-fns';
import type { Trade } from '../types';

export interface TradeFilterOptions {
    selectedExchanges?: string[];
    dateRange?: { start: Date; end: Date };
    aggregateSchwabOptions?: boolean;
}

export interface DecisionStats {
    totalPnL: number;
    tradeCount: number;
    winCount: number;
    lossCount: number;
    breakEvenCount: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    bestDay: { date: string; pnl: number } | null;
    worstDay: { date: string; pnl: number } | null;
}

export interface DataQualityIssue {
    label: string;
    count: number;
    severity: 'info' | 'warning' | 'danger';
    description: string;
}

const hasValidExitDate = (trade: Trade): boolean => {
    if (!trade.exitDate) return false;
    const parsed = parseISO(trade.exitDate);
    return !Number.isNaN(parsed.getTime());
};

export const getClosedTrades = (trades: Trade[]): Trade[] => (
    trades.filter(trade => trade.status === 'CLOSED' && hasValidExitDate(trade))
);

export const isTradeInDateRange = (trade: Trade, range: { start: Date; end: Date }): boolean => {
    if (!hasValidExitDate(trade)) return false;
    return isWithinInterval(parseISO(trade.exitDate), range);
};

export const filterTradesForAnalysis = (trades: Trade[], options: TradeFilterOptions = {}): Trade[] => {
    let filtered = getClosedTrades(trades);

    if (options.selectedExchanges?.length) {
        filtered = filtered.filter(trade => options.selectedExchanges!.includes(trade.exchange));
    }

    if (options.dateRange) {
        filtered = filtered.filter(trade => isTradeInDateRange(trade, options.dateRange!));
    }

    return options.aggregateSchwabOptions === false ? filtered : aggregateSchwabOptionPositions(filtered);
};

export const getTradeDay = (trade: Trade): string => format(parseISO(trade.exitDate), 'yyyy-MM-dd');

export const aggregateSchwabOptionPositions = (trades: Trade[]): Trade[] => {
    const groupedByPosition = new Map<string, Trade[]>();
    const nonAggregatable: Trade[] = [];

    trades.forEach(trade => {
        if (trade.exchange === 'Schwab' && trade.type === 'OPTION') {
            const entryMinute = trade.entryDate?.substring(0, 16) || '';
            const exitMinute = trade.exitDate?.substring(0, 16) || '';
            const key = `${trade.ticker}|${entryMinute}|${exitMinute}`;
            groupedByPosition.set(key, [...(groupedByPosition.get(key) || []), trade]);
        } else {
            nonAggregatable.push(trade);
        }
    });

    const aggregated: Trade[] = [];
    groupedByPosition.forEach(group => {
        if (group.length === 1) {
            aggregated.push(group[0]);
            return;
        }

        const first = group[0];
        const totalQuantity = group.reduce((sum, trade) => sum + trade.quantity, 0);
        const totalPnl = group.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalFees = group.reduce((sum, trade) => sum + (trade.fees || 0), 0);
        const avgEntryPrice = totalQuantity > 0
            ? group.reduce((sum, trade) => sum + (trade.entryPrice * trade.quantity), 0) / totalQuantity
            : first.entryPrice;
        const avgExitPrice = totalQuantity > 0
            ? group.reduce((sum, trade) => sum + (trade.exitPrice * trade.quantity), 0) / totalQuantity
            : first.exitPrice;
        const totalMargin = group.reduce((sum, trade) => sum + (trade.margin || 0), 0);

        aggregated.push({
            ...first,
            id: group.map(trade => trade.id).join('+'),
            quantity: totalQuantity,
            pnl: totalPnl,
            fees: totalFees,
            entryPrice: avgEntryPrice,
            exitPrice: avgExitPrice,
            pnlPercentage: totalMargin > 0 ? (totalPnl / totalMargin) * 100 : first.pnlPercentage,
            notes: `${group.length} Schwab option fills aggregated for reporting`,
        });
    });

    return [...aggregated, ...nonAggregatable];
};

export const aggregateDailyPnL = (trades: Trade[]): Record<string, { pnl: number; trades: Trade[] }> => {
    return getClosedTrades(trades).reduce<Record<string, { pnl: number; trades: Trade[] }>>((days, trade) => {
        const day = getTradeDay(trade);
        if (!days[day]) days[day] = { pnl: 0, trades: [] };
        days[day].pnl += trade.pnl;
        days[day].trades.push(trade);
        return days;
    }, {});
};

export const calculateDecisionStats = (trades: Trade[]): DecisionStats => {
    const closedTrades = getClosedTrades(trades);
    const winningTrades = closedTrades.filter(trade => trade.pnl > 0);
    const losingTrades = closedTrades.filter(trade => trade.pnl < 0);
    const breakEvenTrades = closedTrades.filter(trade => trade.pnl === 0);
    const totalPnL = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
    const dailyValues = Object.entries(aggregateDailyPnL(closedTrades)).map(([date, data]) => ({ date, pnl: data.pnl }));
    const sortedBest = [...dailyValues].sort((a, b) => b.pnl - a.pnl);

    return {
        totalPnL,
        tradeCount: closedTrades.length,
        winCount: winningTrades.length,
        lossCount: losingTrades.length,
        breakEvenCount: breakEvenTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        grossProfit,
        grossLoss,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
        avgWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
        expectancy: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0,
        bestDay: sortedBest[0] || null,
        worstDay: sortedBest[sortedBest.length - 1] || null,
    };
};

export const getDataQualityIssues = (trades: Trade[], lastUpdated: number | null): DataQualityIssue[] => {
    const closedTrades = getClosedTrades(trades);
    const now = Date.now();
    const staleDays = lastUpdated ? Math.floor((now - lastUpdated) / (24 * 60 * 60 * 1000)) : null;
    const zeroPnlClosed = closedTrades.filter(trade => trade.pnl === 0).length;
    const schwabTrades = trades.filter(trade => trade.exchange === 'Schwab').length;
    const orphanNotes = trades.filter(trade => /orphan|skipped|opening position/i.test(trade.notes || '')).length;

    return [
        {
            label: 'Schwab trades',
            count: schwabTrades,
            severity: schwabTrades > 0 ? 'info' : 'warning',
            description: schwabTrades > 0 ? 'Schwab data is available for reporting.' : 'No Schwab trades found yet.',
        },
        {
            label: 'Zero P&L closed trades',
            count: zeroPnlClosed,
            severity: zeroPnlClosed > 0 ? 'warning' : 'info',
            description: 'Zero P&L closed trades can distort win rate and expectancy.',
        },
        {
            label: 'Orphan/skipped hints',
            count: orphanNotes,
            severity: orphanNotes > 0 ? 'danger' : 'info',
            description: 'Trades with orphan or skipped notes may need sync-window review.',
        },
        {
            label: 'Sync freshness',
            count: staleDays ?? 0,
            severity: !lastUpdated || (staleDays !== null && staleDays > 2) ? 'warning' : 'info',
            description: lastUpdated
                ? `Last successful sync was ${staleDays} day${staleDays === 1 ? '' : 's'} ago.`
                : 'No successful sync has been recorded.',
        },
    ];
};
