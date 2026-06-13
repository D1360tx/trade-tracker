import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapSchwabTransactionsToTrades, type SchwabTransaction } from './schwabTransactions';

/** Buy-to-open of an option contract that is never closed (e.g. a 0DTE that expires). */
const optionOpen = (
    activityId: number,
    time: string,
    occSymbol: string,
    contracts: number,
    premium: number
): SchwabTransaction => ({
    activityId,
    time,
    type: 'TRADE',
    netAmount: contracts * premium * 100,
    transferItems: [
        {
            instrument: {
                assetType: 'OPTION',
                symbol: occSymbol,
                underlyingSymbol: occSymbol.split(/\s+/)[0],
                putCall: occSymbol.includes('P') ? 'PUT' : 'CALL',
                strikePrice: 0,
            },
            amount: contracts,
            price: premium,
            positionEffect: 'OPENING',
        },
    ],
});

/**
 * Builds a Schwab TRADE transaction for an equity fill.
 * Omitting `positionEffect` mirrors how Schwab reports same-day equity
 * fills pulled from the orders endpoint (plain BUY/SELL, no OPEN/CLOSE).
 */
const equityFill = (
    activityId: number,
    time: string,
    symbol: string,
    signedQty: number,
    price: number,
    positionEffect?: 'OPENING' | 'CLOSING'
): SchwabTransaction => ({
    activityId,
    time,
    type: 'TRADE',
    netAmount: Math.abs(signedQty) * price,
    transferItems: [
        {
            instrument: { assetType: 'EQUITY', symbol },
            amount: signedQty,
            price,
            ...(positionEffect ? { positionEffect } : {}),
        },
    ],
});

describe('mapSchwabTransactionsToTrades — positionEffect inference', () => {
    it('pairs untagged equity day-trades instead of dropping them as orphans', () => {
        const txs: SchwabTransaction[] = [
            // AAPL long day-trade: buy 100 @150, sell 100 @148 => -200
            equityFill(1, '2026-06-05T14:30:00Z', 'AAPL', 100, 150),
            equityFill(2, '2026-06-05T15:00:00Z', 'AAPL', -100, 148),
            // MSFT long day-trade: buy 100 @300, sell 100 @305 => +500
            equityFill(3, '2026-06-05T14:31:00Z', 'MSFT', 100, 300),
            equityFill(4, '2026-06-05T15:01:00Z', 'MSFT', -100, 305),
        ];

        const trades = mapSchwabTransactionsToTrades(txs);

        expect(trades).toHaveLength(2);
        const byTicker = Object.fromEntries(trades.map(t => [t.ticker, t]));
        expect(byTicker.AAPL.pnl).toBeCloseTo(-200, 6);
        expect(byTicker.AAPL.direction).toBe('LONG');
        expect(byTicker.MSFT.pnl).toBeCloseTo(500, 6);
        trades.forEach(t => expect(t.status).toBe('CLOSED'));
    });

    it('infers a short open/cover when positionEffect is missing', () => {
        const txs: SchwabTransaction[] = [
            // TSLA short: sell-to-open 50 @200, buy-to-cover 50 @195 => +250
            equityFill(10, '2026-06-05T14:30:00Z', 'TSLA', -50, 200),
            equityFill(11, '2026-06-05T15:00:00Z', 'TSLA', 50, 195),
        ];

        const trades = mapSchwabTransactionsToTrades(txs);

        expect(trades).toHaveLength(1);
        expect(trades[0].direction).toBe('SHORT');
        expect(trades[0].pnl).toBeCloseTo(250, 6);
    });

    it('still honors explicit positionEffect (options path unchanged)', () => {
        const txs: SchwabTransaction[] = [
            equityFill(20, '2026-06-05T14:30:00Z', 'NVDA', 100, 120, 'OPENING'),
            equityFill(21, '2026-06-05T15:00:00Z', 'NVDA', -100, 123, 'CLOSING'),
        ];

        const trades = mapSchwabTransactionsToTrades(txs);

        expect(trades).toHaveLength(1);
        expect(trades[0].pnl).toBeCloseTo(300, 6);
    });
});

describe('mapSchwabTransactionsToTrades — same-day (0DTE) expiration', () => {
    afterEach(() => vi.useRealTimers());

    it('books a 0DTE option that expired worthless today as a full loss', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-05T23:00:00Z')); // after the ~4pm ET cutoff

        // Bought 1 MSFT 6/5 put @ $0.38, never closed -> expired worthless -> -$38
        const txs = [optionOpen(100, '2026-06-05T14:30:00Z', 'MSFT  260605P00415000', 1, 0.38)];

        const trades = mapSchwabTransactionsToTrades(txs);

        expect(trades).toHaveLength(1);
        expect(trades[0].exitPrice).toBe(0);
        expect(trades[0].pnl).toBeCloseTo(-38, 6);
        expect(trades[0].status).toBe('CLOSED');
    });

    it('does NOT book a 0DTE before the expiration cutoff (still tradeable)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-05T15:00:00Z')); // ~10am ET, market still open

        const txs = [optionOpen(101, '2026-06-05T14:30:00Z', 'MSFT  260605P00415000', 1, 0.38)];

        const trades = mapSchwabTransactionsToTrades(txs);

        // Position is still live -> no trade booked yet
        expect(trades).toHaveLength(0);
    });
});
