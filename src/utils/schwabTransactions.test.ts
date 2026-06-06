import { describe, it, expect } from 'vitest';
import { mapSchwabTransactionsToTrades, type SchwabTransaction } from './schwabTransactions';

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
