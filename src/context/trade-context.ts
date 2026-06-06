import { createContext } from 'react';
import type { ExchangeName, Trade } from '../types';
import type { SchwabAccountSnapshot } from '../utils/schwabAuth';

export type ApiSyncExchange = Extract<ExchangeName, 'MEXC' | 'ByBit' | 'Schwab'>;

export type SyncDebugData = {
    futures?: unknown;
    spot?: {
        balances?: unknown;
        scanned?: string[];
        found?: string[];
    };
    detectedBotPairs?: string[];
    debugKeys?: string[];
} | null;

export interface TradeContextType {
    trades: Trade[];
    addTrades: (newTrades: Trade[]) => void;
    updateTrade: (id: string, updates: Partial<Trade>) => void;
    deleteTrades: (ids: string[]) => void;
    clearTrades: () => void;
    clearTradesByExchange: (exchange: string) => void;
    fetchTradesFromAPI: (exchange: ApiSyncExchange, silent?: boolean) => Promise<number>;
    hasTrades: boolean;
    isLoading: boolean;
    lastUpdated: number | null;
    lastDebugData?: SyncDebugData;
    syncWarning?: string | null;
    schwabAccountSnapshot: SchwabAccountSnapshot | null;
    schwabBalanceUpdatedAt: number | null;
    refreshSchwabAccountBalance: () => Promise<SchwabAccountSnapshot | null>;
}

export const TradeContext = createContext<TradeContextType | undefined>(undefined);
