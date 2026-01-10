export type ExchangeName = 'MEXC' | 'ByBit' | 'Binance' | 'Coinbase' | 'BloFin' | 'Schwab' | 'Interactive Brokers' | 'HeroFX';

export interface Strategy {
    id: string;
    name: string;
    description?: string;
    color: string;
}

export interface Mistake {
    id: string;
    name: string;
    description?: string;
    color: string;
}

export interface Trade {
    id: string;
    exchange: ExchangeName;
    ticker: string;
    type: 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX' | 'FUTURES' | 'SPOT';
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryDate: string;
    exitDate: string;
    status: 'OPEN' | 'CLOSED';
    pnl: number;
    pnlPercentage: number;
    fees: number;
    notes?: string;
    strategyId?: string; // Link to a Strategy
    mistakes?: string[]; // Array of mistake tags
    initialRisk?: number; // Dollar amount risked
    screenshotIds?: string[]; // IDs of attached screenshots (stored in IndexedDB)
    isBot?: boolean; // True if identified as an automated trade
    externalOid?: string; // Original Exchange Order ID (useful for bot detection)
    leverage?: number;
    notional?: number; // Total position value (e.g. $6,637)
    margin?: number;   // Invested amount (notional / leverage, e.g. $221)
}

export interface KPI {
    totalPnL: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    totalTrades: number;
}
