import { describe, expect, it } from 'vitest';
import { parseTradeLockerPaste } from './tradeLockerParser';

describe('parseTradeLockerPaste', () => {
    it('parses TradeLocker dashboard rows with instrument column', () => {
        const paste = [
            'Instrument\tEntry Time (EET)\tType\tSide\tAmount\tEntry Price\tSL Price\tTP Price\tExit Time (EET)\tExit Price\tFee\tSwap\tP&L\tNet P&L\tOrder ID\tPosition ID',
            'XAUUSD\t2026/05/12 16:59:13\tMarket\tSell\t0.20\t4,677.34\t4,701.83\t4,673.02\t2026/05/12 17:54:50\t4,676.58\t-$2.00\t$0.00\t$15.20\t$13.20\t72057594069558622\t72057594040496837',
            'XAUUSD\t2026/05/06 20:39:58\tStop loss\tSell\t0.20\t4,679.29\t4,693.50\t4,667.47\t2026/05/06 22:08:29\t4,693.90\t-$2.00\t$0.00\t-$292.20\t-$294.20\t72057594068621691\t72057594040255149',
            'XAUUSD\t2026/05/05 18:45:10\tStop loss\tSell\t0.10\t4,573.49\t4,573.39\t4,403.56\t2026/05/06 01:56:02\t4,574.09\t-$1.00\t$0.78\t-$6.00\t-$6.22\t72057594068368153\t72057594040188621',
            'XAUUSD\t2026/05/05 18:45:10\tMarket\tSell\t0.10\t4,573.49\t4,573.39\t4,403.56\t2026/05/05 20:36:59\t4,563.10\t-$1.00\t$0.00\t$103.90\t$102.90\t72057594068390204\t72057594040188621',
            'XAUUSD\t2026/04/29 16:48:01\tStop loss\tSell\t0.20\t4,510.45\t4,517.13\t-\t2026/04/29 16:50:14\t4,517.20\t-$2.00\t$0.00\t-$135.00\t-$137.00\t7277816997897249071\t7277816997843159757',
        ].join('\n');

        const { trades } = parseTradeLockerPaste(paste);

        expect(trades).toHaveLength(5);
        expect(trades[0]).toMatchObject({
            exchange: 'HeroFX',
            ticker: 'XAUUSD',
            direction: 'SHORT',
            quantity: 0.2,
            entryPrice: 4677.34,
            exitPrice: 4676.58,
            pnl: 13.2,
            status: 'CLOSED',
        });
        expect(trades[1].pnl).toBe(-294.2);
        expect(trades.map(trade => trade.pnl)).toEqual([13.2, -294.2, -6.22, 102.9, -137]);
    });

    it('still parses rows that use a separate instrument heading', () => {
        const paste = [
            'Entry Time (EET)\tType\tSide\tAmount\tEntry Price\tSL Price\tTP Price\tExit Time (EET)\tExit Price\tFee\tSwap\tP&L\tNet P&L\tOrder ID\tPosition ID',
            'XAUUSD',
            '2026/05/12 16:59:13\tMarket\tSell\t0.20\t4,677.34\t4,701.83\t4,673.02\t2026/05/12 17:54:50\t4,676.58\t-$2.00\t$0.00\t$15.20\t$13.20\t72057594069558622\t72057594040496837',
        ].join('\n');

        const { trades } = parseTradeLockerPaste(paste);

        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            ticker: 'XAUUSD',
            pnl: 13.2,
            status: 'CLOSED',
        });
    });

    it('parses TradeLocker copies with an instrument header but separate instrument labels', () => {
        const paste = [
            'Instrument\tEntry Time (EET)\tType\tSide\tAmount\tEntry Price\tSL Price\tTP Price\tExit Time (EET)\tExit Price\tFee\tSwap\tP&L\tNet P&L\tOrder ID\tPosition ID\t',
            'Actions',
            '',
            'Currency flag',
            'XAUUSD',
            '2026/05/05 18:45:10\tStop loss\tSell\t0.10\t4,573.49\t',
            '4,573.39',
            '4,403.56\t2026/05/06 01:56:02\t4,574.09\t-$1.00\t$0.78\t-$6.00\t-$6.22\t72057594068368153\t72057594040188621\t',
            '',
            'Currency flag',
            'XAUUSD',
            '2026/05/05 18:45:10\tMarket\tSell\t0.10\t4,573.49\t',
            '4,573.39',
            '4,403.56\t2026/05/05 20:36:59\t4,563.10\t-$1.00\t$0.00\t$103.90\t$102.90\t72057594068390204\t72057594040188621\t',
            '',
            'Currency flag',
            'XAUUSD',
            '2026/04/29 16:48:01\tStop loss\tSell\t0.20\t4,510.45\t',
            '4,517.13',
            '-\t2026/04/29 16:50:14\t4,517.20\t-$2.00\t$0.00\t-$135.00\t-$137.00\t7277816997897249071\t7277816997843159757\t',
            '',
            'Currency flag',
            'XAUUSD',
            '2026/04/29 16:40:38\tMarket\tSell\t0.05\t4,521.22\t-\t-\t2026/04/29 16:46:26\t4,515.37\t-$0.50\t$0.00\t$29.25\t$28.75\t7277816997897248235\t7277816997843158589\t',
            '',
            'Currency flag',
            'XAUUSD',
            '2026/04/22 02:12:09\tMarket\tBuy\t0.05\t4,725.85\t',
            '4,714.95',
            '4,735.94\t2026/04/22 02:34:46\t4,732.15\t-$0.50\t$0.00\t$31.50\t$31.00\t7277816997896031877\t7277816997842827147',
        ].join('\n');

        const { trades } = parseTradeLockerPaste(paste);

        expect(trades).toHaveLength(5);
        expect(trades.map(trade => trade.pnl)).toEqual([-6.22, 102.9, -137, 28.75, 31]);
        expect(trades.every(trade => trade.ticker === 'XAUUSD')).toBe(true);
        expect(trades[4].direction).toBe('LONG');
    });
});
