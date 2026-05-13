import { describe, expect, it } from 'vitest';
import { mapWebullRowToTrade } from './csvParsers';

describe('mapWebullRowToTrade', () => {
    it('maps Webull realized stock rows with negative P&L', () => {
        const trade = mapWebullRowToTrade({
            Symbol: 'AAPL',
            Side: 'Sell',
            Quantity: '10',
            'Avg Price': '$195.00',
            'Cost Basis': '$2,000.00',
            Proceeds: '$1,950.00',
            'Realized P&L': '($50.00)',
            'Filled Time': '2026-05-01 10:15:00',
            Fees: '$0.12',
            Status: 'Filled',
        });

        expect(trade).toMatchObject({
            exchange: 'Webull',
            ticker: 'AAPL',
            type: 'STOCK',
            direction: 'SHORT',
            quantity: 10,
            entryPrice: 200,
            exitPrice: 195,
            pnl: -50,
            fees: 0.12,
            status: 'CLOSED',
        });
        expect(trade?.exitDate).toContain('2026-05-01');
    });

    it('detects Webull options and applies the 100x contract basis for percentages', () => {
        const trade = mapWebullRowToTrade({
            Symbol: 'AAPL250117C00200000',
            Description: 'AAPL Jan 17 2025 200 Call',
            Action: 'Buy',
            Qty: '2',
            Price: '$1.50',
            'Cost Basis': '$300.00',
            Proceeds: '$500.00',
            'P&L': '$200.00',
            Date: '2026-05-02',
            Status: 'Filled',
        });

        expect(trade).toMatchObject({
            exchange: 'Webull',
            type: 'OPTION',
            direction: 'LONG',
            quantity: 2,
            entryPrice: 1.5,
            exitPrice: 2.5,
            pnl: 200,
        });
        expect(trade?.pnlPercentage).toBeCloseTo(66.67, 2);
    });

    it('skips cancelled Webull rows', () => {
        expect(mapWebullRowToTrade({
            Symbol: 'TSLA',
            Side: 'Buy',
            Status: 'Cancelled',
        })).toBeNull();
    });
});
