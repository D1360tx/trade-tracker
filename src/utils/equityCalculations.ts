import type { Trade } from '../types';

export interface EquityPoint {
    date: string;
    equity: number;
    pnl: number;
    tradeCount: number;
    displayDate: string; // Formatted for tooltip
}

export interface SignificantEvent {
    date: string;
    type: 'biggest_win' | 'biggest_loss' | 'milestone';
    value: number;
    label: string;
}

/**
 * Calculate cumulative equity curve from trades
 * Assumes starting with $0, each trade adds/subtracts from total
 */
export const calculateEquityCurve = (trades: Trade[], startingBalance = 0): EquityPoint[] => {
    // Filter to only closed trades with valid dates
    const closedTrades = trades
        .filter(t => t.status === 'CLOSED' && t.pnl !== undefined && t.exitDate)
        .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

    if (closedTrades.length === 0) {
        return [];
    }

    let runningEquity = startingBalance;
    const equityPoints: EquityPoint[] = [];

    // Add starting point
    const firstDate = new Date(closedTrades[0].exitDate);
    equityPoints.push({
        date: closedTrades[0].exitDate,
        equity: startingBalance,
        pnl: 0,
        tradeCount: 0,
        displayDate: firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });

    // Calculate cumulative P&L for each trade
    closedTrades.forEach((trade, index) => {
        runningEquity += trade.pnl || 0;
        const tradeDate = new Date(trade.exitDate);

        equityPoints.push({
            date: trade.exitDate,
            equity: runningEquity,
            pnl: trade.pnl || 0,
            tradeCount: index + 1,
            displayDate: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
    });

    return equityPoints;
};

/**
 * Identify significant events in the equity curve
 */
export const findSignificantEvents = (trades: Trade[]): SignificantEvent[] => {
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (closedTrades.length === 0) return [];

    const events: SignificantEvent[] = [];

    // Find biggest win
    const biggestWin = closedTrades.reduce((max, t) =>
        (t.pnl || 0) > (max.pnl || 0) ? t : max
    );

    if (biggestWin.pnl && biggestWin.pnl > 0) {
        events.push({
            date: biggestWin.exitDate,
            type: 'biggest_win',
            value: biggestWin.pnl,
            label: `Biggest Win: $${biggestWin.pnl.toFixed(2)}`
        });
    }

    // Find biggest loss
    const biggestLoss = closedTrades.reduce((min, t) =>
        (t.pnl || 0) < (min.pnl || 0) ? t : min
    );

    if (biggestLoss.pnl && biggestLoss.pnl < 0) {
        events.push({
            date: biggestLoss.exitDate,
            type: 'biggest_loss',
            value: biggestLoss.pnl,
            label: `Biggest Loss: $${biggestLoss.pnl.toFixed(2)}`
        });
    }

    // Find milestones ($1k, $5k, $10k, $25k, $50k, $100k)
    const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
    const equityCurve = calculateEquityCurve(trades, 0);

    milestones.forEach(milestone => {
        const crossingPoint = equityCurve.find((point, i) => {
            if (i === 0) return false;
            const prev = equityCurve[i - 1];
            return prev.equity < milestone && point.equity >= milestone;
        });

        if (crossingPoint) {
            events.push({
                date: crossingPoint.date,
                type: 'milestone',
                value: milestone,
                label: `Milestone: $${(milestone / 1000).toFixed(0)}k`
            });
        }
    });

    return events;
};

/**
 * Calculate maximum drawdown
 */
export const calculateMaxDrawdown = (equityCurve: EquityPoint[]): {
    percentage: number;
    absolute: number;
    peak: number;
    trough: number;
    startDate: string;
    endDate: string;
} | null => {
    if (equityCurve.length < 2) return null;

    let maxDrawdown = 0;
    let maxDrawdownAbs = 0;
    let peak = equityCurve[0].equity;
    let peakDate = equityCurve[0].date;
    let troughDate = equityCurve[0].date;
    let currentPeak = equityCurve[0].equity;
    let currentPeakDate = equityCurve[0].date;

    equityCurve.forEach(point => {
        if (point.equity > currentPeak) {
            currentPeak = point.equity;
            currentPeakDate = point.date;
        }

        const drawdown = currentPeak - point.equity;
        const drawdownPct = currentPeak > 0 ? (drawdown / currentPeak) * 100 : 0;

        if (drawdownPct > maxDrawdown) {
            maxDrawdown = drawdownPct;
            maxDrawdownAbs = drawdown;
            peak = currentPeak;
            peakDate = currentPeakDate;
            troughDate = point.date;
        }
    });

    return {
        percentage: maxDrawdown,
        absolute: maxDrawdownAbs,
        peak,
        trough: peak - maxDrawdownAbs,
        startDate: peakDate,
        endDate: troughDate
    };
};

/**
 * Calculate current drawdown
 */
export const calculateCurrentDrawdown = (equityCurve: EquityPoint[]): number => {
    if (equityCurve.length === 0) return 0;

    const currentEquity = equityCurve[equityCurve.length - 1].equity;
    const peak = Math.max(...equityCurve.map(p => p.equity));

    if (peak <= 0) return 0;

    const drawdown = peak - currentEquity;
    return (drawdown / peak) * 100;
};
