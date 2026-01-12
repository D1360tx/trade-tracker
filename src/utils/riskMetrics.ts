import type { Trade } from '../types';

/**
 * Calculate Sharpe Ratio
 * Measures risk-adjusted return vs a risk-free rate
 * Formula: (Average Return - Risk Free Rate) / Standard Deviation of Returns
 * 
 * > 1.0 = Good, > 2.0 = Excellent, > 3.0 = Outstanding
 */
export const calculateSharpeRatio = (trades: Trade[], riskFreeRate = 0.02): number => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length < 2) return 0;

    // Calculate returns as percentage of entry value
    const returns = validTrades.map(t => {
        const entryValue = t.entryPrice * t.quantity * (t.type === 'OPTION' ? 100 : 1);
        return entryValue > 0 ? (t.pnl / entryValue) : 0;
    });

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize (assuming daily returns, 252 trading days)
    const annualizedReturn = avgReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
};

/**
 * Calculate Sortino Ratio
 * Similar to Sharpe but only penalizes downside volatility
 * Better for asymmetric return distributions
 * 
 * > 1.0 = Good, > 2.0 = Very Good, > 3.0 = Excellent
 */
export const calculateSortinoRatio = (trades: Trade[], riskFreeRate = 0.02, targetReturn = 0): number => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length < 2) return 0;

    const returns = validTrades.map(t => {
        const entryValue = t.entryPrice * t.quantity * (t.type === 'OPTION' ? 100 : 1);
        return entryValue > 0 ? (t.pnl / entryValue) : 0;
    });

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Only consider downside deviations (returns below target)
    const downsideReturns = returns.filter(r => r < targetReturn);
    if (downsideReturns.length === 0) return Infinity;

    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / returns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    if (downsideStdDev === 0) return Infinity;

    // Annualize
    const annualizedReturn = avgReturn * 252;
    const annualizedDownsideStdDev = downsideStdDev * Math.sqrt(252);

    return (annualizedReturn - riskFreeRate) / annualizedDownsideStdDev;
};

/**
 * Calculate Calmar Ratio
 * Annual return / Maximum Drawdown
 * Measures return per unit of drawdown risk
 * 
 * > 0.5 = Acceptable, > 1.0 = Good, > 3.0 = Excellent
 */
export const calculateCalmarRatio = (trades: Trade[]): number => {
    const validTrades = trades
        .filter(t => t.status === 'CLOSED' && t.pnl !== undefined && t.exitDate)
        .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

    if (validTrades.length < 2) return 0;

    // Calculate cumulative P&L and find max drawdown
    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;

    validTrades.forEach(t => {
        cumulative += t.pnl;
        if (cumulative > peak) {
            peak = cumulative;
        }
        const drawdown = peak - cumulative;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });

    if (maxDrawdown === 0) return Infinity;

    // Calculate annualized return
    const totalPnL = validTrades.reduce((sum, t) => sum + t.pnl, 0);
    const firstDate = new Date(validTrades[0].exitDate);
    const lastDate = new Date(validTrades[validTrades.length - 1].exitDate);
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365;

    if (years === 0) return 0;

    const annualReturn = totalPnL / years;

    return annualReturn / maxDrawdown;
};

/**
 * Calculate win rate by position size buckets
 * Helps identify optimal bet sizing
 */
export interface PositionSizeMetric {
    bucket: string;
    minSize: number;
    maxSize: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    avgPnL: number;
    totalPnL: number;
}

/**
 * Format dollar amount for bucket labels
 */
const formatBucketLabel = (value: number): string => {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `$${Math.round(value / 1000)}k`;
    } else if (value >= 100) {
        return `$${Math.round(value / 100) * 100}`;
    } else {
        return `$${Math.round(value)}`;
    }
};

export const calculateWinRateByPositionSize = (trades: Trade[]): PositionSizeMetric[] => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length === 0) return [];

    // Calculate position sizes (actual capital risked)
    const sizes = validTrades.map(t => {
        // For options: premium × quantity (already in $/share, no need for 100x)
        // For stocks: price × quantity
        // For futures/crypto: we use the entry value as notional, but could be adjusted
        let entryValue: number;

        if (t.type === 'OPTION') {
            // Premium is already per share, quantity is contracts
            // Actual cost = premium × quantity × 100 shares per contract
            entryValue = Math.abs(t.entryPrice * t.quantity * 100);
        } else {
            // Stocks, crypto, futures: price × quantity
            entryValue = Math.abs(t.entryPrice * t.quantity);
        }

        return { trade: t, size: entryValue };
    });

    // Find min/max for bucketing
    const allSizes = sizes.map(s => s.size);
    const minSize = Math.min(...allSizes);
    const maxSize = Math.max(...allSizes);
    const range = maxSize - minSize;

    // Create 5 buckets
    const bucketSize = range / 5;
    const buckets: PositionSizeMetric[] = [];

    for (let i = 0; i < 5; i++) {
        const bucketMin = minSize + (i * bucketSize);
        const bucketMax = i === 4 ? maxSize : minSize + ((i + 1) * bucketSize);

        const bucketTrades = sizes.filter(s => s.size >= bucketMin && s.size <= bucketMax);
        const wins = bucketTrades.filter(s => s.trade.pnl > 0);
        const losses = bucketTrades.filter(s => s.trade.pnl <= 0);
        const totalPnL = bucketTrades.reduce((sum, s) => sum + s.trade.pnl, 0);
        const avgPnL = bucketTrades.length > 0 ? totalPnL / bucketTrades.length : 0;

        buckets.push({
            bucket: `${formatBucketLabel(bucketMin)} - ${formatBucketLabel(bucketMax)}`,
            minSize: bucketMin,
            maxSize: bucketMax,
            trades: bucketTrades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: bucketTrades.length > 0 ? (wins.length / bucketTrades.length) * 100 : 0,
            avgPnL,
            totalPnL
        });
    }

    return buckets.filter(b => b.trades > 0);
};

/**
 * Calculate R-Multiple distribution
 * R = Risk unit (initial stop loss or planned risk)
 * Shows if you're getting 2R, 3R, 5R wins consistently
 */
export interface RMultipleData {
    range: string;
    count: number;
    percentage: number;
    color: string;
}

export const calculateRMultipleDistribution = (trades: Trade[]): RMultipleData[] => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length === 0) return [];

    // For simplicity, we'll use P&L % as a proxy for R-multiples
    // Ideally, users would define their risk per trade, but we don't have that data
    // So we approximate: R = 1% risk, then R-multiple = PnL% / 1%

    const rMultiples = validTrades.map(t => t.pnlPercentage / 1); // Assuming 1% base risk

    // Create buckets
    const buckets = [
        { range: '< -3R', min: -Infinity, max: -3, color: '#dc2626' },
        { range: '-3R to -2R', min: -3, max: -2, color: '#ef4444' },
        { range: '-2R to -1R', min: -2, max: -1, color: '#f87171' },
        { range: '-1R to 0', min: -1, max: 0, color: '#fca5a5' },
        { range: '0 to 1R', min: 0, max: 1, color: '#86efac' },
        { range: '1R to 2R', min: 1, max: 2, color: '#4ade80' },
        { range: '2R to 3R', min: 2, max: 3, color: '#22c55e' },
        { range: '3R to 5R', min: 3, max: 5, color: '#16a34a' },
        { range: '> 5R', min: 5, max: Infinity, color: '#15803d' }
    ];

    return buckets.map(bucket => {
        const count = rMultiples.filter(r => r >= bucket.min && r < bucket.max).length;
        return {
            range: bucket.range,
            count,
            percentage: (count / validTrades.length) * 100,
            color: bucket.color
        };
    }).filter(b => b.count > 0);
};

/**
 * Calculate expectancy (average win/loss per trade)
 * Positive expectancy means profitable system
 */
export const calculateExpectancy = (trades: Trade[]): number => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length === 0) return 0;

    const totalPnL = validTrades.reduce((sum, t) => sum + t.pnl, 0);
    return totalPnL / validTrades.length;
};

/**
 * Calculate Risk of Ruin (simplified)
 * Probability of losing all capital
 * Based on win rate, average win/loss, and risk per trade
 */
export const calculateRiskOfRuin = (trades: Trade[], riskPerTrade = 0.01): number => {
    const validTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);

    if (validTrades.length === 0) return 0;

    const wins = validTrades.filter(t => t.pnl > 0);
    const losses = validTrades.filter(t => t.pnl <= 0);

    if (wins.length === 0) return 100;
    if (losses.length === 0) return 0;

    const winRate = wins.length / validTrades.length;
    const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);

    const winLossRatio = avgWin / avgLoss;

    // Simplified Risk of Ruin formula
    // RoR = ((1 - WinRate) / WinRate) ^ (Capital / Risk per trade)
    // We'll assume 100 units of capital
    const capitalUnits = 1 / riskPerTrade; // e.g., 1% risk = 100 units
    const ruin = Math.pow((1 - winRate) / winRate, capitalUnits / winLossRatio);

    return Math.min(ruin * 100, 100); // Cap at 100%
};
