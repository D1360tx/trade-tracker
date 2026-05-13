import { describe, expect, it } from 'vitest';
import type { Trade } from '../types';
import {
    aggregateDailyPnL,
    aggregateSchwabOptionPositions,
    filterTradesForAnalysis,
    getClosedTrades,
} from './tradeAnalytics';

const baseTrade: Trade = {
    id: 'base',
    exchange: 'Schwab',
    ticker: 'SPXW 05/01/2026 6500.00 P',
    type: 'OPTION',
    direction: 'LONG',
    entryPrice: 10,
    exitPrice: 0,
    quantity: 1,
    entryDate: '2026-05-01T09:30:00.000Z',
    exitDate: '2026-05-01T16:00:00.000Z',
    status: 'CLOSED',
    pnl: 0,
    pnlPercentage: 0,
    fees: 0,
};

const trade = (overrides: Partial<Trade>): Trade => ({ ...baseTrade, ...overrides });

describe('trade analytics helpers', () => {
    it('filters closed trades with inclusive date boundaries', () => {
        const trades = [
            trade({ id: 'boundary-loss', exitDate: '2026-05-01T00:00:00.000Z', pnl: -945.26 }),
            trade({ id: 'midday-win', exitDate: '2026-05-01T12:00:00.000Z', pnl: 477 }),
            trade({ id: 'open-trade', status: 'OPEN', exitDate: '2026-05-01T13:00:00.000Z', pnl: 100 }),
            trade({ id: 'outside', exitDate: '2026-04-30T23:59:59.000Z', pnl: 999 }),
        ];

        const filtered = filterTradesForAnalysis(trades, {
            dateRange: {
                start: new Date('2026-05-01T00:00:00.000Z'),
                end: new Date('2026-05-01T23:59:59.999Z'),
            },
            aggregateSchwabOptions: false,
        });

        expect(filtered.map(t => t.id)).toEqual(['boundary-loss', 'midday-win']);
    });

    it('aggregates daily P&L to match calendar net values', () => {
        const trades = [
            trade({ id: 'boundary-loss', pnl: -945.26, exitDate: '2026-05-01T00:00:00' }),
            trade({ id: 'midday-win', pnl: 477, exitDate: '2026-05-01T12:00:00' }),
        ];

        expect(aggregateDailyPnL(trades)['2026-05-01'].pnl).toBeCloseTo(-468.26);
    });

    it('aggregates Schwab option fills with shared reporting logic', () => {
        const trades = [
            trade({ id: 'fill-1', quantity: 1, pnl: -400, margin: 1000 }),
            trade({ id: 'fill-2', quantity: 2, pnl: -545.26, margin: 2000 }),
        ];

        const aggregated = aggregateSchwabOptionPositions(trades);

        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].quantity).toBe(3);
        expect(aggregated[0].pnl).toBeCloseTo(-945.26);
        expect(aggregated[0].pnlPercentage).toBeCloseTo(-31.5086, 3);
    });

    it('excludes open trades from the closed trade rule', () => {
        const trades = [
            trade({ id: 'closed', status: 'CLOSED', pnl: 25 }),
            trade({ id: 'open', status: 'OPEN', pnl: 100 }),
        ];

        expect(getClosedTrades(trades).map(t => t.id)).toEqual(['closed']);
    });
});
