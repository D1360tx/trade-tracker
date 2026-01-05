import type { Trade, ExchangeName } from '../types';
import { subDays } from 'date-fns';

const TICKERS = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'ETH', 'SOL', 'AMD', 'MSFT', 'META', 'GOOGL'];
const EXCHANGES: ExchangeName[] = ['Schwab', 'Interactive Brokers', 'Coinbase', 'Binance', 'ByBit', 'MEXC', 'BloFin'];

function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export const generateMockTrades = (count: number = 50): Trade[] => {
    const trades: Trade[] = [];

    for (let i = 0; i < count; i++) {
        const isWin = Math.random() > 0.45; // 55% win rate
        const entryPrice = Math.random() * 1000 + 10;
        const pnlPercent = isWin ? (Math.random() * 20 + 5) : -(Math.random() * 10 + 2);
        const exitPrice = entryPrice * (1 + pnlPercent / 100);
        const quantity = Math.floor(Math.random() * 100) + 1;
        const pnl = (exitPrice - entryPrice) * quantity;

        const entryDate = randomDate(subDays(new Date(), 90), new Date());
        // Random duration between 1 minute and 3 days (in milliseconds)
        const durationMs = (Math.random() * 3 * 24 * 60 * 60 * 1000) + (60 * 1000);
        const exitDate = new Date(entryDate.getTime() + durationMs);

        const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
        // Unified logic for crypto detection
        const isCrypto = ['BTC', 'ETH', 'SOL'].includes(ticker);

        trades.push({
            id: Math.random().toString(36).substr(2, 9),
            ticker,
            type: isCrypto ? 'CRYPTO' : 'STOCK',
            direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            exitPrice: parseFloat(exitPrice.toFixed(2)),
            quantity,
            entryDate: entryDate.toISOString(),
            exitDate: exitDate.toISOString(),
            exchange: EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)],
            fees: Math.random() * 5,
            pnl: parseFloat(pnl.toFixed(2)),
            pnlPercentage: parseFloat(pnlPercent.toFixed(2)),
            status: 'CLOSED',
        });
    }

    return trades.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());
};

export const getDailyPnL = (trades: Trade[]) => {
    const dailyPnL: Record<string, number> = {};

    trades.forEach(trade => {
        const date = trade.exitDate.split('T')[0];
        if (dailyPnL[date]) {
            dailyPnL[date] += trade.pnl;
        } else {
            dailyPnL[date] = trade.pnl;
        }
    });

    return Object.entries(dailyPnL).map(([date, pnl]) => ({ date, pnl }));
};

export const getAIInsights = () => {
    return {
        metrics: [
            { id: 1, label: 'FOMO Score', value: 'Low', color: 'text-green-500', desc: 'You rarely chase trades.' },
            { id: 2, label: 'Revenge Trading', value: 'Moderate', color: 'text-yellow-500', desc: 'Watch out after losing streaks.' },
            { id: 3, label: 'Discipline', value: '88%', color: 'text-blue-500', desc: 'Following plan consistently.' },
        ],
        patterns: [
            { id: 1, title: 'Best Setup', desc: 'Long Breakouts on AAPL between 10-11 AM (+76% win rate).', type: 'positive' },
            { id: 2, title: 'Leak Detected', desc: 'Shorting uptrends on Fridays results in -15% avg P&L.', type: 'negative' },
            { id: 3, title: 'Hidden Strength', desc: 'Small cap crypto (SOL) swings have highest R:R (3.2).', type: 'positive' },
        ]
    };
};
