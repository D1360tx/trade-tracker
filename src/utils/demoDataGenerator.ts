import type { Trade } from '../types';
import { subDays, addDays, format } from 'date-fns';

/**
 * Demo Data Generator for Trade Tracker
 * Generates realistic trade data based on actual Schwab CSV structure
 * Randomizes values for privacy while maintaining realistic patterns
 */

// Popular stocks and index options seen in real trading
const OPTION_SYMBOLS = [
    { symbol: 'SPXW', name: 'S & P 500 INDEX', multiplier: 100 },
    { symbol: 'SPY', name: 'SPDR S&P 500', multiplier: 100 },
    { symbol: 'NVDA', name: 'NVIDIA CORP', multiplier: 100 },
    { symbol: 'AMD', name: 'ADVANCED MICRO DEVIC', multiplier: 100 },
    { symbol: 'TSLA', name: 'TESLA INC', multiplier: 100 },
    { symbol: 'AAPL', name: 'APPLE INC', multiplier: 100 },
    { symbol: 'MSFT', name: 'MICROSOFT CORP', multiplier: 100 },
    { symbol: 'GOOGL', name: 'ALPHABET INC', multiplier: 100 },
    { symbol: 'META', name: 'META PLATFORMS INC', multiplier: 100 },
    { symbol: 'AMZN', name: 'AMAZON COM INC', multiplier: 100 },
    { symbol: 'COIN', name: 'COINBASE GLOBAL INC', multiplier: 100 },
    { symbol: 'MSTR', name: 'STRATEGY INC', multiplier: 100 },
    { symbol: 'AVGO', name: 'BROADCOM INC', multiplier: 100 },
    { symbol: 'ASML', name: 'ASML HLDG N V', multiplier: 100 },
    { symbol: 'MU', name: 'MICRON TECHNOLOGY INC', multiplier: 100 },
    { symbol: 'ORCL', name: 'ORACLE CORP', multiplier: 100 },
];

const STOCK_SYMBOLS = [
    { symbol: 'NVDA', name: 'NVIDIA CORP', price: 140 },
    { symbol: 'TSLA', name: 'TESLA INC', price: 380 },
    { symbol: 'AAPL', name: 'APPLE INC', price: 230 },
    { symbol: 'MSFT', name: 'MICROSOFT CORP', price: 430 },
    { symbol: 'AMD', name: 'ADVANCED MICRO DEVIC', price: 130 },
];

interface DemoTradeConfig {
    /** Number of trades to generate */
    count?: number;
    /** Start date for trade range */
    startDate?: Date;
    /** End date for trade range */
    endDate?: Date;
    /** Win rate percentage (0-100) */
    winRate?: number;
    /** Percentage of options vs stocks (0-100) */
    optionsPercentage?: number;
    /** Target net P&L range */
    targetPnlRange?: { min: number; max: number };
}

/**
 * Generate a random date between start and end
 */
function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Round to nearest expiration (Friday)
 */
function getNextFriday(date: Date): Date {
    const dayOfWeek = date.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    return addDays(date, daysUntilFriday);
}

/**
 * Generate option strike price near current price
 */
function generateStrike(basePrice: number, putCall: 'P' | 'C', isITM: boolean): number {
    const range = basePrice * 0.1; // 10% range
    let strike: number;

    if (putCall === 'C') {
        // Call: ITM = strike below price, OTM = strike above price
        strike = isITM
            ? basePrice - Math.random() * range
            : basePrice + Math.random() * range;
    } else {
        // Put: ITM = strike above price, OTM = strike below price
        strike = isITM
            ? basePrice + Math.random() * range
            : basePrice - Math.random() * range;
    }

    // Round to nearest $5 for most stocks, $50 for SPX
    const roundTo = basePrice > 1000 ? 50 : 5;
    return Math.round(strike / roundTo) * roundTo;
}

/**
 * Generate realistic option premium based on moneyness and time to expiration
 */
function generatePremium(
    basePrice: number,
    strike: number,
    putCall: 'P' | 'C',
    daysToExpiration: number,
    volatility: number = 0.3
): number {
    const isITM = putCall === 'C' ? strike < basePrice : strike > basePrice;
    const moneyness = Math.abs(basePrice - strike) / basePrice;

    // Intrinsic value
    const intrinsic = isITM ? Math.abs(basePrice - strike) : 0;

    // Time value (simplified Black-Scholes approximation)
    const timeValue = basePrice * volatility * Math.sqrt(daysToExpiration / 365) * 0.4;

    // Add some randomness
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

    const premium = (intrinsic + timeValue) * randomFactor;

    // Ensure minimum premium of $0.05
    return Math.max(0.05, parseFloat(premium.toFixed(2)));
}

/**
 * Generate a realistic option trade
 */
function generateOptionTrade(
    entryDate: Date,
    isWin: boolean,
    symbol: typeof OPTION_SYMBOLS[0]
): Trade {
    const daysToExpiration = Math.floor(Math.random() * 5) + 1; // 1-5 days
    const expirationDate = getNextFriday(entryDate);
    const exitDate = new Date(entryDate.getTime() + Math.random() * (expirationDate.getTime() - entryDate.getTime()));

    const putCall: 'P' | 'C' = Math.random() > 0.5 ? 'P' : 'C';
    const quantity = [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)]; // Common quantities

    // Estimate current price based on symbol
    let basePrice: number;
    if (symbol.symbol === 'SPXW') {
        basePrice = 6000 + Math.random() * 1000; // SPX around 6000-7000
    } else if (symbol.symbol === 'NVDA') {
        basePrice = 120 + Math.random() * 60; // NVDA around 120-180
    } else if (symbol.symbol === 'TSLA') {
        basePrice = 350 + Math.random() * 100; // TSLA around 350-450
    } else {
        basePrice = 100 + Math.random() * 300; // Other stocks 100-400
    }

    const strike = generateStrike(basePrice, putCall, Math.random() > 0.6); // 40% ITM, 60% OTM
    const entryPremium = generatePremium(basePrice, strike, putCall, daysToExpiration);

    // Determine exit premium based on win/loss
    let exitPremium: number;
    if (isWin) {
        // Winner: 10% to 150% gain
        const gainMultiplier = 1 + (0.1 + Math.random() * 1.4);
        exitPremium = entryPremium * gainMultiplier;
    } else {
        // Loser: 20% to 100% loss (including expirations)
        const isExpiration = Math.random() < 0.3; // 30% chance of expiration
        if (isExpiration) {
            exitPremium = 0; // Expired worthless
        } else {
            const lossMultiplier = 0.2 + Math.random() * 0.6; // 20% to 80% remaining
            exitPremium = entryPremium * lossMultiplier;
        }
    }

    exitPremium = parseFloat(exitPremium.toFixed(2));

    const pnl = (exitPremium - entryPremium) * quantity * symbol.multiplier;
    const pnlPercentage = entryPremium > 0 ? ((exitPremium - entryPremium) / entryPremium) * 100 : -100;

    // Format ticker like Schwab CSV: "SYMBOL MM/DD/YYYY STRIKE.00 P/C"
    const expDateStr = format(expirationDate, 'MM/dd/yyyy');
    const ticker = `${symbol.symbol} ${expDateStr} ${strike.toFixed(2)} ${putCall}`;

    return {
        id: `demo-${Math.random().toString(36).substr(2, 9)}`,
        exchange: 'Schwab',
        ticker,
        type: 'OPTION',
        direction: 'LONG',
        entryPrice: entryPremium,
        exitPrice: exitPremium,
        quantity,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        status: 'CLOSED',
        fees: 0, // Schwab has $0 fees for options
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
        notes: 'Demo data - randomly generated',
    };
}

/**
 * Generate a realistic stock trade
 */
function generateStockTrade(
    entryDate: Date,
    isWin: boolean,
    symbol: typeof STOCK_SYMBOLS[0]
): Trade {
    const holdDays = Math.floor(Math.random() * 30) + 1; // 1-30 days
    const exitDate = addDays(entryDate, holdDays);

    const direction: 'LONG' | 'SHORT' = Math.random() > 0.3 ? 'LONG' : 'SHORT'; // 70% long, 30% short
    const quantity = Math.floor(Math.random() * 100) + 10; // 10-109 shares

    const entryPrice = symbol.price * (0.9 + Math.random() * 0.2); // +/- 10% from base

    let exitPrice: number;
    if (isWin) {
        // Winner: 2% to 20% gain
        const gainPct = 0.02 + Math.random() * 0.18;
        exitPrice = direction === 'LONG'
            ? entryPrice * (1 + gainPct)
            : entryPrice * (1 - gainPct);
    } else {
        // Loser: 2% to 15% loss
        const lossPct = 0.02 + Math.random() * 0.13;
        exitPrice = direction === 'LONG'
            ? entryPrice * (1 - lossPct)
            : entryPrice * (1 + lossPct);
    }

    exitPrice = parseFloat(exitPrice.toFixed(2));

    const pnl = direction === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;

    const pnlPercentage = direction === 'LONG'
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100;

    return {
        id: `demo-${Math.random().toString(36).substr(2, 9)}`,
        exchange: 'Schwab',
        ticker: symbol.symbol,
        type: 'STOCK',
        direction,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice,
        quantity,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        status: 'CLOSED',
        fees: 0,
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
        notes: 'Demo data - randomly generated',
    };
}

/**
 * Generate demo trades with realistic patterns
 */
export function generateDemoTrades(config: DemoTradeConfig = {}): Trade[] {
    const {
        count = 100,
        startDate = subDays(new Date(), 180), // Last 6 months
        endDate = new Date(),
        winRate = 55, // 55% win rate
        optionsPercentage = 85, // 85% options, 15% stocks
        targetPnlRange = { min: -5000, max: 5000 }
    } = config;

    const trades: Trade[] = [];
    let currentPnl = 0;

    for (let i = 0; i < count; i++) {
        const tradeDate = randomDate(startDate, endDate);

        // Determine if this should be a win based on win rate and current P&L
        // Add some realism: if way behind target, increase win probability slightly
        const adjustedWinRate = currentPnl < targetPnlRange.min
            ? Math.min(winRate + 5, 70)
            : winRate;

        const isWin = Math.random() * 100 < adjustedWinRate;

        // Determine if option or stock
        const isOption = Math.random() * 100 < optionsPercentage;

        let trade: Trade;
        if (isOption) {
            const symbol = OPTION_SYMBOLS[Math.floor(Math.random() * OPTION_SYMBOLS.length)];
            trade = generateOptionTrade(tradeDate, isWin, symbol);
        } else {
            const symbol = STOCK_SYMBOLS[Math.floor(Math.random() * STOCK_SYMBOLS.length)];
            trade = generateStockTrade(tradeDate, isWin, symbol);
        }

        trades.push(trade);
        currentPnl += trade.pnl;
    }

    // Sort by exit date (most recent first)
    return trades.sort((a, b) =>
        new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
    );
}

/**
 * Generate demo trades for specific time periods (useful for testing calendar views)
 */
export function generateDemoTradesForPeriod(
    year: number = 2025,
    month?: number // 0-11 (undefined = whole year)
): Trade[] {
    const startDate = month !== undefined
        ? new Date(year, month, 1)
        : new Date(year, 0, 1);

    const endDate = month !== undefined
        ? new Date(year, month + 1, 0) // Last day of month
        : new Date(year, 11, 31);

    // Generate more trades for longer periods
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const tradeCount = Math.floor(daysInPeriod / 2); // Roughly 1 trade every 2 days

    return generateDemoTrades({
        count: tradeCount,
        startDate,
        endDate,
        winRate: 52, // Slightly profitable
        optionsPercentage: 90, // Heavy options trader
    });
}

/**
 * Quick preset: Profitable trader profile
 */
export function generateProfitableTraderData(): Trade[] {
    return generateDemoTrades({
        count: 150,
        winRate: 58,
        optionsPercentage: 80,
        targetPnlRange: { min: 3000, max: 8000 },
    });
}

/**
 * Quick preset: Learning trader profile (breakeven with some losses)
 */
export function generateLearningTraderData(): Trade[] {
    return generateDemoTrades({
        count: 80,
        winRate: 48,
        optionsPercentage: 70,
        targetPnlRange: { min: -2000, max: 500 },
    });
}

/**
 * Quick preset: Aggressive options trader
 */
export function generateAggressiveOptionsTraderData(): Trade[] {
    return generateDemoTrades({
        count: 200,
        winRate: 45,
        optionsPercentage: 95,
        targetPnlRange: { min: -5000, max: 10000 },
    });
}

// ============================================================================
// MEXC Crypto Futures Generator
// ============================================================================

const MEXC_SYMBOLS = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 95000, volatility: 0.05 },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 3500, volatility: 0.06 },
    { symbol: 'SOLUSDT', name: 'Solana', price: 190, volatility: 0.08 },
    { symbol: 'BNBUSDT', name: 'Binance Coin', price: 680, volatility: 0.05 },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 1.05, volatility: 0.07 },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.38, volatility: 0.10 },
    { symbol: 'AVAXUSDT', name: 'Avalanche', price: 42, volatility: 0.09 },
    { symbol: 'LINKUSDT', name: 'Chainlink', price: 23, volatility: 0.07 },
];

/**
 * Generate MEXC futures trade
 */
function generateMEXCTrade(entryDate: Date, isWin: boolean): Trade {
    const symbol = MEXC_SYMBOLS[Math.floor(Math.random() * MEXC_SYMBOLS.length)];
    const direction: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT';

    // Futures typically held for minutes to hours
    const holdMinutes = Math.floor(Math.random() * 480) + 15; // 15 min to 8 hours
    const exitDate = new Date(entryDate.getTime() + holdMinutes * 60 * 1000);

    // Leverage 5x to 20x
    const leverage = [5, 10, 15, 20][Math.floor(Math.random() * 4)];

    // Position size in contracts (crypto amount)
    const quantity = symbol.symbol === 'BTCUSDT'
        ? parseFloat((0.01 + Math.random() * 0.09).toFixed(3)) // 0.01-0.1 BTC
        : parseFloat((0.1 + Math.random() * 0.9).toFixed(2)); // 0.1-1.0 for altcoins

    const entryPrice = symbol.price * (0.98 + Math.random() * 0.04); // +/- 2%

    let exitPrice: number;
    if (isWin) {
        // Futures wins: 0.5% to 5% (amplified by leverage)
        const movePercent = (0.005 + Math.random() * 0.045) / leverage;
        exitPrice = direction === 'LONG'
            ? entryPrice * (1 + movePercent * leverage)
            : entryPrice * (1 - movePercent * leverage);
    } else {
        // Futures losses: 0.3% to 3%
        const movePercent = (0.003 + Math.random() * 0.027) / leverage;
        exitPrice = direction === 'LONG'
            ? entryPrice * (1 - movePercent * leverage)
            : entryPrice * (1 + movePercent * leverage);
    }

    exitPrice = parseFloat(exitPrice.toFixed(2));

    // P&L calculation for futures
    const pnl = direction === 'LONG'
        ? (exitPrice - entryPrice) * quantity * leverage
        : (entryPrice - exitPrice) * quantity * leverage;

    const notional = entryPrice * quantity;
    const margin = notional / leverage;

    const pnlPercentage = (pnl / margin) * 100;

    // Fees: 0.02% maker, 0.06% taker (use taker for demo)
    const fees = notional * 0.0006 * 2; // Entry + exit

    return {
        id: `demo-mexc-${Math.random().toString(36).substr(2, 9)}`,
        exchange: 'MEXC',
        ticker: symbol.symbol,
        type: 'FUTURES',
        direction,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice,
        quantity,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        status: 'CLOSED',
        fees: parseFloat(fees.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
        leverage,
        notional: parseFloat(notional.toFixed(2)),
        margin: parseFloat(margin.toFixed(2)),
        notes: 'Demo data - MEXC Futures',
    };
}

/**
 * Generate MEXC demo trades
 */
export function generateMEXCDemoTrades(count: number = 50): Trade[] {
    const trades: Trade[] = [];
    const startDate = subDays(new Date(), 90); // Last 3 months
    const endDate = new Date();

    for (let i = 0; i < count; i++) {
        const tradeDate = randomDate(startDate, endDate);
        const isWin = Math.random() < 0.52; // 52% win rate (typical for futures)

        trades.push(generateMEXCTrade(tradeDate, isWin));
    }

    return trades.sort((a, b) =>
        new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
    );
}

// ============================================================================
// HeroFX / TradeLocker Forex Generator
// ============================================================================

const FOREX_PAIRS = [
    { symbol: 'XAUUSD', name: 'Gold', price: 2700, pipValue: 0.01, volatility: 0.02 },
    { symbol: 'EURUSD', name: 'Euro/US Dollar', price: 1.05, pipValue: 0.0001, volatility: 0.015 },
    { symbol: 'GBPUSD', name: 'British Pound/US Dollar', price: 1.27, pipValue: 0.0001, volatility: 0.018 },
    { symbol: 'USDJPY', name: 'US Dollar/Japanese Yen', price: 148, pipValue: 0.01, volatility: 0.015 },
    { symbol: 'AUDUSD', name: 'Australian Dollar/US Dollar', price: 0.64, pipValue: 0.0001, volatility: 0.017 },
    { symbol: 'USDCAD', name: 'US Dollar/Canadian Dollar', price: 1.36, pipValue: 0.0001, volatility: 0.014 },
    { symbol: 'NZDUSD', name: 'New Zealand Dollar/US Dollar', price: 0.58, pipValue: 0.0001, volatility: 0.019 },
];

/**
 * Generate HeroFX/TradeLocker forex trade
 */
function generateForexTrade(entryDate: Date, isWin: boolean): Trade {
    const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)];
    const direction: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT';

    // Forex typically held for minutes to hours
    const holdMinutes = Math.floor(Math.random() * 360) + 30; // 30 min to 6 hours
    const exitDate = new Date(entryDate.getTime() + holdMinutes * 60 * 1000);

    // Lot size: 0.01 to 1.0 (standard lots)
    const quantity = parseFloat((0.01 + Math.random() * 0.99).toFixed(2));

    const entryPrice = pair.price * (0.998 + Math.random() * 0.004); // +/- 0.2%

    let exitPrice: number;
    if (isWin) {
        // Forex wins: 10-50 pips
        const pips = 10 + Math.random() * 40;
        const priceMove = pips * pair.pipValue;
        exitPrice = direction === 'LONG'
            ? entryPrice + priceMove
            : entryPrice - priceMove;
    } else {
        // Forex losses: 15-40 pips (stop loss)
        const pips = 15 + Math.random() * 25;
        const priceMove = pips * pair.pipValue;
        exitPrice = direction === 'LONG'
            ? entryPrice - priceMove
            : entryPrice + priceMove;
    }

    // Format price correctly based on pair
    const decimals = pair.symbol === 'XAUUSD' || pair.symbol === 'USDJPY' ? 2 : 5;
    exitPrice = parseFloat(exitPrice.toFixed(decimals));

    // P&L calculation for forex (simplified)
    const priceDiff = direction === 'LONG'
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;

    // For gold (XAUUSD), 1 lot = 100 oz, so multiply by 100
    const contractSize = pair.symbol === 'XAUUSD' ? 100 : 100000;
    const pnl = priceDiff * quantity * contractSize;

    const pnlPercentage = (priceDiff / entryPrice) * 100;

    // Spread cost (typical 2-5 pips)
    const spreadPips = 2 + Math.random() * 3;
    const fees = spreadPips * pair.pipValue * quantity * contractSize * 0.5; // Approximate spread cost

    return {
        id: `demo-forex-${Math.random().toString(36).substr(2, 9)}`,
        exchange: 'HeroFX',
        ticker: pair.symbol,
        type: 'FOREX',
        direction,
        entryPrice: parseFloat(entryPrice.toFixed(decimals)),
        exitPrice,
        quantity,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        status: 'CLOSED',
        fees: parseFloat(fees.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
        notes: 'Demo data - HeroFX/TradeLocker',
    };
}

/**
 * Generate HeroFX demo trades
 */
export function generateForexDemoTrades(count: number = 50): Trade[] {
    const trades: Trade[] = [];
    const startDate = subDays(new Date(), 60); // Last 2 months
    const endDate = new Date();

    for (let i = 0; i < count; i++) {
        const tradeDate = randomDate(startDate, endDate);
        const isWin = Math.random() < 0.54; // 54% win rate (typical for forex)

        trades.push(generateForexTrade(tradeDate, isWin));
    }

    return trades.sort((a, b) =>
        new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
    );
}

// ============================================================================
// Complete Demo Account Generator
// ============================================================================

/**
 * Generate a complete demo account with mixed exchanges
 */
export function generateCompleteDemoAccount(): Trade[] {
    const schwabTrades = generateDemoTrades({
        count: 120,
        winRate: 55,
        optionsPercentage: 85,
        targetPnlRange: { min: -2000, max: 8000 },
    });

    const mexcTrades = generateMEXCDemoTrades(60);
    const forexTrades = generateForexDemoTrades(40);

    // Combine and sort by date
    return [...schwabTrades, ...mexcTrades, ...forexTrades].sort((a, b) =>
        new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
    );
}
