import { describe, expect, it } from 'vitest';
import type { Trade } from '../types';
import {
    calculateOptionsMetrics,
    getOptionTypeFromTicker,
    groupOptionPositions,
    parseOptionTicker,
} from './optionsAnalysis';

const baseTrade: Trade = {
    id: 'base',
    exchange: 'Schwab',
    ticker: 'AAPL 05/15/2026 200.00 C',
    type: 'OPTION',
    direction: 'LONG',
    entryPrice: 1,
    exitPrice: 2,
    quantity: 1,
    entryDate: '2026-05-01T14:30:00.000Z',
    exitDate: '2026-05-01T15:30:00.000Z',
    status: 'CLOSED',
    pnl: 100,
    pnlPercentage: 100,
    fees: 0,
};

const trade = (overrides: Partial<Trade>): Trade => ({ ...baseTrade, ...overrides });

describe('options analysis helpers', () => {
    it('parses standard, normalized, and OCC compact option tickers', () => {
        expect(parseOptionTicker('AAPL 05/15/2026 200.00 C')).toMatchObject({
            underlying: 'AAPL',
            expirationDate: '2026-05-15',
            strikePrice: 200,
            optionType: 'CALL',
        });

        expect(parseOptionTicker('ISRG 2025-10-31 600 CALL')).toMatchObject({
            underlying: 'ISRG',
            expirationDate: '2025-10-31',
            strikePrice: 600,
            optionType: 'CALL',
        });

        expect(parseOptionTicker('TSLA 260515P00200000')).toMatchObject({
            underlying: 'TSLA',
            expirationDate: '2026-05-15',
            strikePrice: 200,
            optionType: 'PUT',
        });
    });

    it('detects call and put types through the shared parser', () => {
        expect(getOptionTypeFromTicker('AAPL 05/15/2026 200.00 C')).toBe('CALL');
        expect(getOptionTypeFromTicker('AAPL 2026-05-15 200 PUT')).toBe('PUT');
        expect(getOptionTypeFromTicker('TSLA 260515P00200000')).toBe('PUT');
    });

    it('groups scale-out fills into one position and detects when it becomes free', () => {
        const trades = [
            trade({ id: 'first-scale', quantity: 1, entryPrice: 1, exitPrice: 2, pnl: 100 }),
            trade({ id: 'runner', quantity: 1, entryPrice: 1, exitPrice: 0.5, pnl: -50, exitDate: '2026-05-01T16:30:00.000Z' }),
        ];

        const positions = groupOptionPositions(trades);

        expect(positions).toHaveLength(1);
        expect(positions[0].totalContracts).toBe(2);
        expect(positions[0].totalCostBasis).toBe(200);
        expect(positions[0].totalProceeds).toBe(250);
        expect(positions[0].realizedPnL).toBe(50);
        expect(positions[0].isFree).toBe(true);
        expect(positions[0].scaleOutHistory[0].madeFree).toBe(true);
    });

    it('calculates calls, puts, free positions, and losing trade metrics', () => {
        const trades = [
            trade({ id: 'call-win', ticker: 'AAPL 05/15/2026 200.00 C', pnl: 100, entryPrice: 1, exitPrice: 2 }),
            trade({ id: 'call-loss', ticker: 'AAPL 05/15/2026 200.00 C', pnl: -50, entryPrice: 1, exitPrice: 0.5, exitDate: '2026-05-01T16:30:00.000Z' }),
            trade({
                id: 'put-loss',
                ticker: 'TSLA 260515P00200000',
                entryPrice: 3,
                exitPrice: 1,
                pnl: -200,
                entryDate: '2026-05-02T14:30:00.000Z',
                exitDate: '2026-05-02T15:30:00.000Z',
            }),
        ];

        const metrics = calculateOptionsMetrics(trades);

        expect(metrics.totalOptionsTrades).toBe(3);
        expect(metrics.totalPositions).toBe(2);
        expect(metrics.callsStats.count).toBe(2);
        expect(metrics.callsStats.pnl).toBe(50);
        expect(metrics.putsStats.count).toBe(1);
        expect(metrics.putsStats.pnl).toBe(-200);
        expect(metrics.freeTradesCount).toBe(1);
        expect(metrics.totalRealizedPnL).toBe(-150);
        expect(metrics.avgLosingTrade).toBe(125);
        expect(metrics.profitFactor).toBeCloseTo(0.4);
    });
});
