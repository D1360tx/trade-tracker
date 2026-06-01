import { describe, expect, it } from 'vitest';
import type { Trade } from '../../types';
import { buildCalendarDays } from './useCalendarData';

const trade = (overrides: Partial<Trade>): Trade => ({
    id: 'trade-1',
    exchange: 'Schwab',
    ticker: 'SPY',
    type: 'OPTION',
    direction: 'LONG',
    entryPrice: 1,
    exitPrice: 2,
    quantity: 1,
    entryDate: '2026-05-01T14:00:00.000Z',
    exitDate: '2026-05-01T15:00:00.000Z',
    status: 'CLOSED',
    pnl: 100,
    pnlPercentage: 100,
    fees: 0,
    ...overrides,
});

describe('buildCalendarDays', () => {
    it('builds day P&L from the provided filtered trade set only', () => {
        const calendarDays = buildCalendarDays([
            trade({ id: 'may-win', exitDate: '2026-05-01T15:00:00.000Z', pnl: 100 }),
            trade({ id: 'may-loss', exitDate: '2026-05-01T16:00:00.000Z', pnl: -50 }),
        ], 2026, 4);

        const mayFirst = calendarDays.find(day => day.date === '2026-05-01');
        const juneFirst = calendarDays.find(day => day.date === '2026-06-01');

        expect(mayFirst).toMatchObject({
            pnl: 50,
            tradeCount: 2,
            winCount: 1,
            lossCount: 1,
        });
        expect(juneFirst?.tradeCount ?? 0).toBe(0);
    });

    it('ignores open trades in calendar day aggregation', () => {
        const calendarDays = buildCalendarDays([
            trade({ id: 'open-trade', status: 'OPEN', exitDate: '2026-05-01T15:00:00.000Z', pnl: 100 }),
        ], 2026, 4);

        expect(calendarDays.find(day => day.date === '2026-05-01')?.tradeCount).toBe(0);
    });
});
