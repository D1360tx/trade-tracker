import type { Trade } from '../types';
import { parseISO, differenceInDays } from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface ParsedOptionTicker {
    underlying: string;      // "AMD"
    expirationDate: string;  // "2026-01-23"
    strikePrice: number;     // 265.00
    optionType: 'CALL' | 'PUT';
    raw: string;             // Original ticker string
}

export interface ScaleOutEvent {
    date: string;
    quantity: number;
    price: number;
    proceeds: number;
    cumulativeProceeds: number;
    cumulativeRecoveryPercent: number;
    madeFree: boolean;       // This exit made position free
    pnl: number;
}

export interface OptionPositionGroup {
    ticker: string;                  // "AMD 01/23/2026 265.00 C"
    underlying: string;              // "AMD"
    optionType: 'CALL' | 'PUT';
    strikePrice: number;
    expirationDate: string;
    entryDate: string;
    trades: Trade[];
    totalContracts: number;          // Total contracts in position
    totalCostBasis: number;          // Initial investment (entryPrice * qty * 100)
    totalProceeds: number;           // Sum of exit proceeds
    realizedPnL: number;             // Sum of all trade PnL
    isFree: boolean;                 // proceeds >= costBasis
    freeAt?: string;                 // When it became free
    percentRecovered: number;        // proceeds / costBasis * 100
    scaleOutHistory: ScaleOutEvent[];
    status: 'free' | 'profit' | 'loss' | 'breakeven';
}

export interface OptionsMetricsSummary {
    // Basic Counts
    totalOptionsTrades: number;
    totalPositions: number;
    freeTradesCount: number;
    freeTradesPercent: number;

    // Financial
    totalCostBasis: number;
    totalProceeds: number;
    totalRealizedPnL: number;
    avgPnLPerTrade: number;

    // Free Trade Specifics
    totalProfitFromFreePositions: number;
    avgScaleOutToBecomeFree: number;
    avgTimeToBecomeFree: number;      // Days

    // Performance
    winRate: number;
    profitFactor: number;
    avgWinningTrade: number;
    avgLosingTrade: number;

    // By Option Type
    callsStats: { count: number; pnl: number; winRate: number; positions: number };
    putsStats: { count: number; pnl: number; winRate: number; positions: number };

    // Top performers
    topUnderlyings: { underlying: string; pnl: number; trades: number; winRate: number; freeCount: number }[];
}

// ============================================
// PARSING FUNCTIONS
// ============================================

/**
 * Parse an option ticker like "AMD 01/23/2026 265.00 C" into components
 */
export function parseOptionTicker(ticker: string): ParsedOptionTicker | null {
    if (!ticker) return null;

    // Handle different formats:
    // Format 1: "AMD 01/23/2026 265.00 C" (standard)
    // Format 2: "SPXW 01/22/2026 6950.00 C" (index options)

    const parts = ticker.trim().split(' ');

    if (parts.length < 4) return null;

    const underlying = parts[0];
    const dateStr = parts[1];
    const strikeStr = parts[2];
    const typeChar = parts[3];

    // Parse date (MM/DD/YYYY format)
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return null;

    const [month, day, year] = dateParts;
    const expirationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Parse strike price
    const strikePrice = parseFloat(strikeStr);
    if (isNaN(strikePrice)) return null;

    // Parse option type
    const optionType: 'CALL' | 'PUT' = typeChar.toUpperCase() === 'C' ? 'CALL' : 'PUT';

    return {
        underlying,
        expirationDate,
        strikePrice,
        optionType,
        raw: ticker
    };
}

/**
 * Check if a trade is an option
 */
export function isOptionTrade(trade: Trade): boolean {
    return trade.type === 'OPTION';
}

// ============================================
// GROUPING FUNCTIONS
// ============================================

/**
 * Group option trades into positions based on ticker and entry date
 * Trades with same ticker and entry date (to the minute) are considered same position
 */
export function groupOptionPositions(trades: Trade[]): OptionPositionGroup[] {
    // Filter to options only
    const optionTrades = trades.filter(t => t.type === 'OPTION' && (t.status === 'CLOSED' || t.pnl !== 0));

    if (optionTrades.length === 0) return [];

    // Group by ticker + entry date (truncated to minute for flexibility)
    const groups = new Map<string, Trade[]>();

    optionTrades.forEach(trade => {
        // Truncate entry date to minute for grouping
        const entryMinute = trade.entryDate?.substring(0, 16) || trade.entryDate;
        const key = `${trade.ticker}|${entryMinute}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(trade);
    });

    // Convert to OptionPositionGroup
    const positions: OptionPositionGroup[] = [];

    groups.forEach((groupTrades, _key) => {
        const parsed = parseOptionTicker(groupTrades[0].ticker);

        // Sort trades by exit date for scale-out tracking
        const sortedTrades = [...groupTrades].sort((a, b) =>
            new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        // Calculate totals
        const totalContracts = sortedTrades.reduce((sum, t) => sum + t.quantity, 0);
        const totalCostBasis = sortedTrades.reduce((sum, t) => sum + (t.entryPrice * t.quantity * 100), 0);
        const totalProceeds = sortedTrades.reduce((sum, t) => sum + (t.exitPrice * t.quantity * 100), 0);
        const realizedPnL = sortedTrades.reduce((sum, t) => sum + t.pnl, 0);

        // Build scale-out history and detect when position became free
        const scaleOutHistory: ScaleOutEvent[] = [];
        let cumulativeProceeds = 0;
        let isFree = false;
        let freeAt: string | undefined;

        sortedTrades.forEach(trade => {
            const proceeds = trade.exitPrice * trade.quantity * 100;
            cumulativeProceeds += proceeds;
            const cumulativeRecoveryPercent = totalCostBasis > 0
                ? (cumulativeProceeds / totalCostBasis) * 100
                : 0;

            const madeFree = !isFree && cumulativeProceeds >= totalCostBasis;
            if (madeFree) {
                isFree = true;
                freeAt = trade.exitDate;
            }

            scaleOutHistory.push({
                date: trade.exitDate,
                quantity: trade.quantity,
                price: trade.exitPrice,
                proceeds,
                cumulativeProceeds,
                cumulativeRecoveryPercent,
                madeFree,
                pnl: trade.pnl
            });
        });

        const percentRecovered = totalCostBasis > 0
            ? (totalProceeds / totalCostBasis) * 100
            : 0;

        // Determine status
        let status: 'free' | 'profit' | 'loss' | 'breakeven';
        if (isFree) {
            status = 'free';
        } else if (realizedPnL > 0) {
            status = 'profit';
        } else if (realizedPnL < 0) {
            status = 'loss';
        } else {
            status = 'breakeven';
        }

        positions.push({
            ticker: groupTrades[0].ticker,
            underlying: parsed?.underlying || groupTrades[0].ticker.split(' ')[0],
            optionType: parsed?.optionType || (groupTrades[0].ticker.endsWith(' C') ? 'CALL' : 'PUT'),
            strikePrice: parsed?.strikePrice || 0,
            expirationDate: parsed?.expirationDate || '',
            entryDate: groupTrades[0].entryDate,
            trades: sortedTrades,
            totalContracts,
            totalCostBasis,
            totalProceeds,
            realizedPnL,
            isFree,
            freeAt,
            percentRecovered,
            scaleOutHistory,
            status
        });
    });

    // Sort by entry date descending (most recent first)
    positions.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

    return positions;
}

// ============================================
// METRICS CALCULATION
// ============================================

/**
 * Calculate comprehensive options metrics from trades
 */
export function calculateOptionsMetrics(trades: Trade[]): OptionsMetricsSummary {
    const optionTrades = trades.filter(t => t.type === 'OPTION' && (t.status === 'CLOSED' || t.pnl !== 0));
    const positions = groupOptionPositions(trades);

    if (optionTrades.length === 0 || positions.length === 0) {
        return {
            totalOptionsTrades: 0,
            totalPositions: 0,
            freeTradesCount: 0,
            freeTradesPercent: 0,
            totalCostBasis: 0,
            totalProceeds: 0,
            totalRealizedPnL: 0,
            avgPnLPerTrade: 0,
            totalProfitFromFreePositions: 0,
            avgScaleOutToBecomeFree: 0,
            avgTimeToBecomeFree: 0,
            winRate: 0,
            profitFactor: 0,
            avgWinningTrade: 0,
            avgLosingTrade: 0,
            callsStats: { count: 0, pnl: 0, winRate: 0, positions: 0 },
            putsStats: { count: 0, pnl: 0, winRate: 0, positions: 0 },
            topUnderlyings: []
        };
    }

    // Basic counts
    const freePositions = positions.filter(p => p.isFree);
    const freeTradesCount = freePositions.length;
    const freeTradesPercent = (freeTradesCount / positions.length) * 100;

    // Financial totals
    const totalCostBasis = positions.reduce((sum, p) => sum + p.totalCostBasis, 0);
    const totalProceeds = positions.reduce((sum, p) => sum + p.totalProceeds, 0);
    const totalRealizedPnL = positions.reduce((sum, p) => sum + p.realizedPnL, 0);
    const avgPnLPerTrade = optionTrades.length > 0 ? totalRealizedPnL / optionTrades.length : 0;

    // Free trade specifics
    const totalProfitFromFreePositions = freePositions.reduce((sum, p) => sum + p.realizedPnL, 0);

    // Average scale-out % when became free (what % of position was sold to become free)
    const freeScaleOutPercents = freePositions
        .map(p => {
            const freeEvent = p.scaleOutHistory.find(e => e.madeFree);
            return freeEvent ? freeEvent.cumulativeRecoveryPercent : null;
        })
        .filter((v): v is number => v !== null);
    const avgScaleOutToBecomeFree = freeScaleOutPercents.length > 0
        ? freeScaleOutPercents.reduce((a, b) => a + b, 0) / freeScaleOutPercents.length
        : 0;

    // Average time to become free
    const timeToFree = freePositions
        .filter(p => p.freeAt)
        .map(p => differenceInDays(parseISO(p.freeAt!), parseISO(p.entryDate)));
    const avgTimeToBecomeFree = timeToFree.length > 0
        ? timeToFree.reduce((a, b) => a + b, 0) / timeToFree.length
        : 0;

    // Win/loss metrics
    const winningTrades = optionTrades.filter(t => t.pnl > 0);
    const losingTrades = optionTrades.filter(t => t.pnl < 0);
    const winRate = optionTrades.length > 0 ? (winningTrades.length / optionTrades.length) * 100 : 0;

    const grossWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

    const avgWinningTrade = winningTrades.length > 0
        ? grossWins / winningTrades.length
        : 0;
    const avgLosingTrade = losingTrades.length > 0
        ? grossLosses / losingTrades.length
        : 0;

    // By option type
    const callPositions = positions.filter(p => p.optionType === 'CALL');
    const putPositions = positions.filter(p => p.optionType === 'PUT');

    const callTrades = optionTrades.filter(t => t.ticker.endsWith(' C'));
    const putTrades = optionTrades.filter(t => t.ticker.endsWith(' P'));

    const callWins = callTrades.filter(t => t.pnl > 0).length;
    const putWins = putTrades.filter(t => t.pnl > 0).length;

    const callsStats = {
        count: callTrades.length,
        pnl: callTrades.reduce((sum, t) => sum + t.pnl, 0),
        winRate: callTrades.length > 0 ? (callWins / callTrades.length) * 100 : 0,
        positions: callPositions.length
    };

    const putsStats = {
        count: putTrades.length,
        pnl: putTrades.reduce((sum, t) => sum + t.pnl, 0),
        winRate: putTrades.length > 0 ? (putWins / putTrades.length) * 100 : 0,
        positions: putPositions.length
    };

    // Top underlyings
    const underlyingMap = new Map<string, { pnl: number; trades: number; wins: number; freeCount: number }>();

    positions.forEach(p => {
        const current = underlyingMap.get(p.underlying) || { pnl: 0, trades: 0, wins: 0, freeCount: 0 };
        current.pnl += p.realizedPnL;
        current.trades += p.trades.length;
        current.wins += p.trades.filter(t => t.pnl > 0).length;
        current.freeCount += p.isFree ? 1 : 0;
        underlyingMap.set(p.underlying, current);
    });

    const topUnderlyings = Array.from(underlyingMap.entries())
        .map(([underlying, data]) => ({
            underlying,
            pnl: data.pnl,
            trades: data.trades,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            freeCount: data.freeCount
        }))
        .sort((a, b) => b.pnl - a.pnl)
        .slice(0, 10);

    return {
        totalOptionsTrades: optionTrades.length,
        totalPositions: positions.length,
        freeTradesCount,
        freeTradesPercent,
        totalCostBasis,
        totalProceeds,
        totalRealizedPnL,
        avgPnLPerTrade,
        totalProfitFromFreePositions,
        avgScaleOutToBecomeFree,
        avgTimeToBecomeFree,
        winRate,
        profitFactor,
        avgWinningTrade,
        avgLosingTrade,
        callsStats,
        putsStats,
        topUnderlyings
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format currency for display
 */
export function formatCurrency(value: number, showSign = false): string {
    const formatted = Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (showSign) {
        return value >= 0 ? `+$${formatted}` : `-$${formatted}`;
    }
    return `$${formatted}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
}

/**
 * Get status color class
 */
export function getStatusColor(status: 'free' | 'profit' | 'loss' | 'breakeven'): string {
    switch (status) {
        case 'free': return 'text-[var(--accent-primary)]';
        case 'profit': return 'text-[var(--success)]';
        case 'loss': return 'text-[var(--danger)]';
        case 'breakeven': return 'text-[var(--text-secondary)]';
    }
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: 'free' | 'profit' | 'loss' | 'breakeven'): string {
    switch (status) {
        case 'free': return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20';
        case 'profit': return 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20';
        case 'loss': return 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20';
        case 'breakeven': return 'bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] border-[var(--text-secondary)]/20';
    }
}
