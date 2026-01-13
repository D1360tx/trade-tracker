import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { Trade } from '../types';
import { fetchMEXCTradeHistory, fetchMEXCSpotHistory, fetchByBitTradeHistory } from '../utils/apiClient';
import { fetchTrades, insertTrades as dbInsertTrades, updateTrade as dbUpdateTrade, deleteTrade as dbDeleteTrade, subscribeTrades } from '../lib/supabase/trades';
import { useAuth } from './AuthContext';

interface TradeContextType {
    trades: Trade[];
    addTrades: (newTrades: Trade[]) => void;
    updateTrade: (id: string, updates: Partial<Trade>) => void;
    deleteTrades: (ids: string[]) => void;
    clearTrades: () => void;
    clearTradesByExchange: (exchange: string) => void;
    fetchTradesFromAPI: (exchange: any, silent?: boolean) => Promise<number>;
    hasTrades: boolean;
    isLoading: boolean;
    lastUpdated: number | null;
    lastDebugData?: any;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

// Helper to generate deterministic ID if missing
const generateStableId = (t: any): string => {
    if (t.orderId) return t.orderId;
    if (t.id) return t.id;
    if (t.execId) return t.execId;
    // Fallback composite for CSV rows without IDs
    const key = `${t.symbol}-${t.time || t.createTime}-${t.price}-${t.qty}-${t.side}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `gen-${Math.abs(hash).toString(16)}`;
};

// Helper for FIFO Aggregation (Shared between API integrations)
const aggregateTrades = (fills: any[], exchangeName: string): Trade[] => {
    // 1. Sort by Time Ascending (Oldest First)
    // Support both raw API fields (createTime, time) and pre-mapped Trade objects (entryDate)
    const sortedFills = [...fills].sort((a: any, b: any) => {
        const timeA = new Date(a.createTime || a.time || a.entryDate || 0).getTime();
        const timeB = new Date(b.createTime || b.time || b.entryDate || 0).getTime();
        return timeA - timeB;
    });

    const mappedTrades: Trade[] = [];
    const openPositions: Record<string, any[]> = {};

    sortedFills.forEach((t: any) => {
        // Support both raw API fields and pre-mapped Trade objects
        const price = parseFloat(t.price || t.dealAvgPrice || t.avgPrice || t.entryPrice || t.exitPrice || t.execPrice || '0');
        // Prioritize actual filled quantity fields over 'vol' (ordered qty)
        // Use checks against undefined to ensure we capture 0 if explicitly returned as 0 (e.g. canceled order)
        const rawQty = t.dealVol ?? t.execQty ?? t.executedQty ?? t.quantity ?? t.qty ?? t.vol ?? 0;
        const qty = parseFloat(rawQty);

        // Skip un-filled orders (Canceled, etc)
        if (qty <= 0) return;

        const pnl = parseFloat(t.pnl || t.profit || t.closedPnl || t.realised_pnl || t.realisedPnl || '0');
        const fees = parseFloat(t.fee || t.commission || t.execFee || '0');
        const leverage = parseFloat(t.leverage || '1');
        const incomingNotional = parseFloat(t.notional || '0');
        // If notional is provided (Futures), calc per-unit. Else default to price (Spot).
        const notionalPerUnit = incomingNotional > 0 ? incomingNotional / qty : price;

        // Handle varied timestamp formats (MEXC number vs ByBit string)
        const rawTime = t.createTime || t.time || t.entryDate || Date.now();
        const time = isNaN(Number(rawTime)) ? new Date(rawTime).getTime() : Number(rawTime);
        // Support both raw API data (symbol) and pre-mapped Trade objects (ticker)
        const symbol = t.symbol || t.ticker || 'UNKNOWN';
        const currentId = generateStableId(t);

        // Normalize direction
        let direction: 'LONG' | 'SHORT' = 'LONG';
        const side = String(t.side || '').toUpperCase();
        // MEXC Futures: 1=Open Long, 2=Close Short, 3=Open Short, 4=Close Long
        // Also supports standard BUY/SELL strings
        if (side === 'BUY' || side === '1' || side === '2' || side.includes('LONG')) direction = 'LONG';
        else if (side === 'SELL' || side === '3' || side === '4' || side.includes('SHORT')) direction = 'SHORT';

        const isBot = t.isBot === true;

        if (pnl !== 0) {
            // CLOSE Trade (Explicit PnL)
            let matchIndex = -1;
            if (openPositions[symbol] && openPositions[symbol].length > 0) {
                // FIFO Match
                matchIndex = openPositions[symbol].findIndex(pos => Math.abs(pos.qty - qty) < 0.0001);
                if (matchIndex === -1) matchIndex = 0;
            }

            if (matchIndex !== -1 && openPositions[symbol]) {
                const openRow = openPositions[symbol][matchIndex];
                openPositions[symbol].splice(matchIndex, 1);

                const tradeNotional = qty * (openRow.notionalPerUnit || openRow.price);
                const tradeMargin = tradeNotional / (openRow.leverage || 1);
                const pnlPercentage = tradeMargin > 0 ? (pnl / tradeMargin) * 100 : 0;

                mappedTrades.push({
                    notional: tradeNotional,
                    margin: tradeMargin,
                    id: openRow.id, // KEEP STABLE ID FROM OPENING ORDER
                    exchange: exchangeName as any,
                    ticker: symbol,
                    type: (openRow.type || 'CRYPTO') as any,
                    direction: openRow.direction,
                    entryPrice: openRow.price,
                    exitPrice: price,
                    quantity: qty,
                    entryDate: new Date(openRow.time).toISOString(),
                    exitDate: new Date(time).toISOString(),
                    fees: fees + (openRow.fees || 0),
                    pnl: pnl,
                    pnlPercentage: pnlPercentage,
                    leverage: openRow.leverage,

                    status: 'CLOSED',
                    notes: `Imported via ${exchangeName} API` + (openRow.notes ? ` | ${openRow.notes}` : '')
                });
            } else {
                // Orphan Close
                mappedTrades.push({
                    id: currentId,
                    exchange: exchangeName as any,
                    ticker: symbol,
                    type: (t.type || 'CRYPTO') as any,
                    direction: direction,
                    entryPrice: price,
                    exitPrice: price,
                    quantity: qty,
                    entryDate: new Date(time).toISOString(),
                    exitDate: new Date(time).toISOString(),
                    fees: fees,
                    pnl: pnl,
                    pnlPercentage: 0,
                    status: 'CLOSED',
                    notes: `Imported via ${exchangeName} API (Orphan)` + (t.notes ? ` | ${t.notes}` : '')
                });
            }
        } else {
            // OPEN Trade or Trade History Item
            // Check for Auto-Netting if this is a "Close" direction without PnL? 
            // For simplicity in API aggregation, we assume API returns PnL if closed, OR we rely on standard Open/Close logic.
            // If API doesn't return PnL (like some endpoints), we might need the Auto-Netting logic here too.
            // But let's stick to standard Open logic for now unless we detect a Close direction.

            // Determine if this is essentially a "Close" action by direction against existing positions?
            // MEXC API usually separates Opens and Closes or gives PnL.
            // Let's assume standard behavior:

            let isClose = false;
            let matchIndex = -1;

            if (openPositions[symbol] && openPositions[symbol].length > 0) {
                const holdingDir = openPositions[symbol][0].direction;
                if (holdingDir !== direction) {
                    isClose = true;
                    matchIndex = 0; // Simple FIFO
                }
            }

            if (isClose && matchIndex !== -1) {
                const openRow = openPositions[symbol][matchIndex];
                openPositions[symbol].splice(matchIndex, 1);

                // Calc PnL
                let calculatedPnl = 0;
                if (openRow.direction === 'LONG') calculatedPnl = (price - openRow.price) * qty;
                else calculatedPnl = (openRow.price - price) * qty;

                mappedTrades.push({
                    id: openRow.id, // KEEP STABLE ID
                    exchange: exchangeName as any,
                    ticker: symbol,
                    type: (openRow.type || 'CRYPTO') as any,
                    direction: openRow.direction,
                    entryPrice: openRow.price,
                    exitPrice: price,
                    quantity: qty,
                    entryDate: new Date(openRow.time).toISOString(),
                    exitDate: new Date(time).toISOString(),
                    fees: fees + (openRow.fees || 0),
                    pnl: calculatedPnl,
                    pnlPercentage: ((notionalVal, lev) => {
                        const margin = notionalVal / (lev || 1);
                        return margin > 0 ? (calculatedPnl / margin) * 100 : 0;
                    })(qty * (openRow.notionalPerUnit || openRow.price), openRow.leverage),
                    notional: qty * (openRow.notionalPerUnit || openRow.price),
                    margin: (qty * (openRow.notionalPerUnit || openRow.price)) / (openRow.leverage || 1),
                    status: 'CLOSED',

                    notes: `Imported via ${exchangeName} API (Auto-Netted)` + (openRow.notes ? ` | ${openRow.notes}` : ''),
                    leverage: openRow.leverage,
                    isBot: isBot
                });
            } else {
                // New Position
                if (!openPositions[symbol]) openPositions[symbol] = [];
                openPositions[symbol].push({
                    id: currentId, // Store ID here to reuse on Close
                    time,
                    price,
                    qty,
                    direction,
                    fees,
                    leverage,
                    notionalPerUnit,
                    type: t.type || 'CRYPTO',
                    isBot,
                    notes: t.notes // Capture notes for Open Positions too
                });
            }
        }
    });

    // Add remaining open positions as OPEN trades
    Object.keys(openPositions).forEach(symbol => {
        openPositions[symbol].forEach(pos => {
            mappedTrades.push({
                id: pos.id,
                exchange: exchangeName as any,
                ticker: symbol,
                type: (pos.type || 'CRYPTO') as any,
                direction: pos.direction,
                entryPrice: pos.price,
                exitPrice: pos.price, // Current price not known, use entry
                quantity: pos.qty,
                entryDate: new Date(pos.time).toISOString(),
                exitDate: new Date(pos.time).toISOString(),
                fees: pos.fees,
                pnl: 0,
                pnlPercentage: 0,
                notional: pos.qty * pos.price,
                margin: (pos.qty * pos.price) / (pos.leverage || 1),
                status: 'OPEN',
                notes: `Imported via ${exchangeName} API`,
                isBot: pos.isBot
            });
        });
    });

    return mappedTrades.reverse();
};

export const TradeProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastDebugData, setLastDebugData] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    // Load trades from Supabase on mount
    useEffect(() => {
        if (!user) {
            setTrades([]);
            setIsLoading(false);
            return;
        }

        const loadTrades = async () => {
            try {
                setIsLoading(true);
                const cloudTrades = await fetchTrades();
                setTrades(cloudTrades);
                setLastUpdated(Date.now());
            } catch (error) {
                console.error('Error loading trades:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTrades();
    }, [user]);

    // Subscribe to real-time changes
    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeTrades(
            // onInsert
            (newTrade) => {
                setTrades(prev => [newTrade, ...prev]);
            },
            // onUpdate
            (updatedTrade) => {
                setTrades(prev => prev.map(t => t.id === updatedTrade.id ? updatedTrade : t));
            },
            // onDelete
            (deletedId) => {
                setTrades(prev => prev.filter(t => t.id !== deletedId));
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Ref for auto-sync to avoid stale closures
    const lastUpdatedRef = useRef(lastUpdated);
    useEffect(() => { lastUpdatedRef.current = lastUpdated; }, [lastUpdated]);

    // Hourly & Scheduled Auto-Sync
    useEffect(() => {
        const checkTimeAndSync = () => {
            const now = new Date();
            const minutes = now.getMinutes();
            const hours = now.getHours(); // 0-23
            const day = now.getDay(); // 0=Sun, 1=Mon... 6=Sat

            // Standard Hourly Sync (for crypto exchanges)
            const isTopHour = minutes === 0;
            const msSinceLast = lastUpdatedRef.current ? now.getTime() - lastUpdatedRef.current : Infinity;

            if (isTopHour && msSinceLast > 50 * 60 * 1000) {
                ['MEXC', 'ByBit'].forEach(ex => fetchTradesFromAPI(ex as any, true));
            }

            // Schwab Aggressive Schedule (for active day traders):
            // 1. Hourly During Market Hours: Mon-Fri 9 AM - 3 PM (9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00)
            // 2. After Market Close: Mon-Fri after 3:30 PM (15:30)
            // 3. Monday Morning: Monday after 8:31 AM (08:31) to catch weekend/Friday after-hours
            const isWeekday = day >= 1 && day <= 5;
            const isMarketHours = hours >= 9 && hours <= 15; // 9 AM - 3 PM CST
            const isAfterMarketClose = hours > 15 || (hours === 15 && minutes >= 30);
            const isMondayMorning = day === 1 && (hours > 8 || (hours === 8 && minutes >= 31));

            // Hourly sync during market hours (on the hour)
            if (isWeekday && isMarketHours && isTopHour && msSinceLast > 50 * 60 * 1000) {
                console.log(`[AutoSync] Triggering Schwab hourly sync (Market Hours: ${hours}:00)`);
                fetchTradesFromAPI('Schwab' as any, true);
            }
            // After-hours and Monday morning sync (scheduled times)
            else if ((isWeekday && isAfterMarketClose) || isMondayMorning) {
                // Determine the "Threshold Time" for today
                const threshold = new Date(now);
                if (isMondayMorning && hours < 15) { // Prioritize morning check if it's Monday morning (before market close)
                    threshold.setHours(8, 31, 0, 0);
                } else {
                    threshold.setHours(15, 30, 0, 0);
                }

                const lastUpdateDate = lastUpdatedRef.current ? new Date(lastUpdatedRef.current) : new Date(0);

                // If we haven't synced since the threshold time, trigger it
                if (lastUpdateDate.getTime() < threshold.getTime()) {
                    console.log(`[AutoSync] Triggering Schwab sync (Schedule: ${isMondayMorning && hours < 15 ? 'Mon Morning' : 'Market Close'})`);
                    fetchTradesFromAPI('Schwab' as any, true);
                }
            }
        };
        // Check every 10 seconds to catch sync times accurately
        const interval = setInterval(checkTimeAndSync, 10000);
        return () => clearInterval(interval);
    }, []);

    // Generate a fingerprint for duplicate detection based on trade content
    const getTradeFingerprint = (trade: Trade): string => {
        // Use key trade characteristics to identify duplicates
        // Round P&L to 2 decimals to avoid floating point issues
        const pnlRounded = Math.round((trade.pnl || 0) * 100) / 100;
        const exitDateStr = trade.exitDate ? trade.exitDate.split('T')[0] : '';
        return `${trade.exchange}|${trade.ticker}|${exitDateStr}|${pnlRounded}|${trade.quantity}`;
    };

    const mergeTrades = (incomingTrades: Trade[]) => {
        setTrades(prev => {
            const next = [...prev];
            let addedCount = 0;
            let updatedCount = 0;
            let duplicateCount = 0;

            // Build a fingerprint map of existing trades for fast lookup
            const existingFingerprints = new Map<string, number>();
            next.forEach((t, idx) => {
                existingFingerprints.set(getTradeFingerprint(t), idx);
            });

            incomingTrades.forEach(incoming => {
                // First check by ID (for API-sourced trades that have consistent IDs)
                const idMatchIndex = next.findIndex(t => t.id === incoming.id);

                // Then check by content fingerprint (for CSV imports with random IDs)
                const fingerprint = getTradeFingerprint(incoming);
                const fpMatchIndex = existingFingerprints.get(fingerprint);

                if (idMatchIndex !== -1) {
                    // Update existing by ID match
                    const existing = next[idMatchIndex];
                    if (existing.status !== incoming.status || existing.pnl !== incoming.pnl || existing.isBot !== incoming.isBot || existing.type !== incoming.type || existing.margin !== incoming.margin) {
                        next[idMatchIndex] = {
                            ...incoming,
                            notes: existing.notes || incoming.notes,
                            screenshotIds: existing.screenshotIds
                        };
                        updatedCount++;
                    }
                } else if (fpMatchIndex !== undefined) {
                    // Duplicate detected by fingerprint - skip but preserve user data
                    duplicateCount++;
                    // Optionally update if the incoming has more info
                    const existing = next[fpMatchIndex];
                    if (!existing.notes && incoming.notes) {
                        next[fpMatchIndex] = { ...existing, notes: incoming.notes };
                    }
                } else {
                    // New trade - add it
                    next.push(incoming);
                    existingFingerprints.set(fingerprint, next.length - 1);
                    addedCount++;
                }
            });

            if (addedCount > 0 || updatedCount > 0 || duplicateCount > 0) {
                // Merge complete - stats available in dev tools if needed
            }
            return next;
        });
    };

    const addTrades = (newTrades: Trade[]) => {
        mergeTrades(newTrades);
    };

    const clearTrades = () => {
        setTrades([]);
    };

    const clearTradesByExchange = (exchange: string) => {
        setTrades(prev => prev.filter(t => t.exchange !== exchange));
    };

    const updateTrade = (id: string, updates: Partial<Trade>) => {
        setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const deleteTrades = (ids: string[]) => {
        setTrades(prev => prev.filter(t => !ids.includes(t.id)));
    };

    const fetchTradesFromAPI = async (exchange: 'MEXC' | 'Binance' | 'ByBit' | 'Coinbase' | 'BloFin' | 'Schwab' | 'Interactive Brokers', silent = false): Promise<number> => {
        const apiKey = localStorage.getItem(`${exchange.toLowerCase()}_api_key`);
        const apiSecret = localStorage.getItem(`${exchange.toLowerCase()}_api_secret`);

        if (!apiKey || !apiSecret) {
            if (!silent) alert(`Please configure ${exchange} API keys in Settings first.`);
            return 0;
        }

        if (!silent) setIsLoading(true);
        try {
            let apiTrades: any[] = [];
            let raw: any = null;

            if (exchange === 'MEXC') {
                // Fetch Orders/Deals (Reverting to History to be safe + Heuristic Bot Detection)

                // Extract unique symbols from existing MEXC trades to ensure we re-scan 0-balance pairs
                // Include both raw and normalized (no underscore) versions to cover Spot/Futures format differences
                const mexcTickers = trades.filter(t => t.exchange === 'MEXC').map(t => t.ticker);
                const knownSymbols = Array.from(new Set([
                    ...mexcTickers,
                    ...mexcTickers.map(t => t.replace('_', '')) // Convert SOL_USDT -> SOLUSDT for Spot API
                ]));

                const futuresResult = await fetchMEXCTradeHistory(apiKey, apiSecret);
                const spotResult = await fetchMEXCSpotHistory(apiKey, apiSecret, knownSymbols);

                // Bot Detection: Futures with specific externalOid tags
                // We track the FIRST timestamp where a bot tag is seen.
                // Any trade BEFORE this timestamp is considered Manual.
                const botStartTimes = new Map<string, number>();
                let sampleTradeKeys: string[] = [];

                futuresResult.trades.forEach((t: any, index) => {
                    if (index === 0) sampleTradeKeys = Object.keys(t);
                    const oid = t.externalOid;
                    if (oid && (oid.includes('[BBOS1]') || oid.includes('stoporder_'))) {
                        const tTime = new Date(t.entryDate).getTime();
                        const currentTime = botStartTimes.get(t.ticker);
                        if (!currentTime || tTime < currentTime) {
                            botStartTimes.set(t.ticker, tTime);
                        }
                    }
                });

                const mappedFutures = futuresResult.trades.map(t => {
                    const tTime = new Date(t.entryDate).getTime();
                    const startTime = botStartTimes.get(t.ticker);
                    const hasTag = (t.externalOid || '').match(/\[BBOS1\]|stoporder_/);
                    const isSession = startTime && tTime >= startTime;

                    return {
                        ...t,
                        isBot: !!(hasTag || isSession)
                    };
                });

                const mappedSpot = spotResult.trades.map(t => ({
                    ...t,
                    side: t.isBuyer ? 'BUY' : 'SELL',
                    type: 'SPOT',
                    isBot: true // Assume all Spot trades via API are Bot for now (Grid)
                }));

                apiTrades = [...mappedFutures, ...mappedSpot];
                raw = {
                    futures: futuresResult.raw,
                    spot: spotResult.raw,
                    detectedBotPairs: Array.from(botStartTimes.keys()),
                    debugKeys: sampleTradeKeys
                };
            } else if (exchange === 'ByBit') {
                const result = await fetchByBitTradeHistory(apiKey, apiSecret);
                apiTrades = result.trades;
                raw = result.raw;
            } else if (exchange === 'Schwab') {
                // Dynamically import Schwab utils
                const { fetchSchwabTransactions } = await import('../utils/schwabAuth');
                const { mapSchwabTransactionsToTrades } = await import('../utils/schwabTransactions');

                // Use 180 day window (extended from 90 to reduce orphaned trades)
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const transactions = await fetchSchwabTransactions(startDate, endDate);
                const mappedTrades = mapSchwabTransactionsToTrades(transactions);

                // Add exchange field if missing (mapper should hande it but safety first)
                const tradesWithExchange = mappedTrades.map(t => ({ ...t, exchange: 'Schwab' as const }));

                // Directly add trades (bypassing generic aggregateTrades since mapper handles it)
                addTrades(tradesWithExchange as Trade[]);
                setLastUpdated(Date.now());
                if (!silent) setIsLoading(false);
                return mappedTrades.length;
            } else {
                throw new Error('Simulation_Mode');
            }

            setLastDebugData(raw);
            console.log(`[${exchange}] Raw API response sample:`, raw);
            console.log(`[${exchange}] API Trades before aggregation:`, apiTrades.length);

            const newTrades = aggregateTrades(apiTrades, exchange);
            console.log(`[${exchange}] Trades after aggregation:`, newTrades.length);
            console.log(`[${exchange}] Sample aggregated trade:`, newTrades[0]);

            // deduplication logic is now inside mergeTrades (called by addTrades)
            addTrades(newTrades);
            setLastUpdated(Date.now());

            console.log(`[${exchange}] Sync complete - added ${newTrades.length} trades`);

            if (!silent) {
                // Return count instead of alerting
            }
            return newTrades.length;

        } catch (error: any) {
            if (error.message === 'Simulation_Mode') {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const { generateMockTrades } = await import('../utils/mockData');
                const mockTrades = generateMockTrades(15).map(t => ({
                    ...t,
                    exchange: exchange as any,
                    ticker: t.ticker,
                    id: Math.random().toString(36).substr(2, 9), // Sim mode IDs are random, so they will dup. That's fine for sim.
                    notes: `Imported via ${exchange} API (Simulated)`
                }));
                addTrades(mockTrades);
                addTrades(mockTrades);
                return mockTrades.length;
            } else {
                console.error(error);
                // Suppress ByBit 403 (CloudFront Block)
                const isByBit403 = exchange === 'ByBit' && (error.message.includes('403') || error.message.includes('CloudFront') || error.message.includes('HTML'));
                if (!silent && !isByBit403) {
                    throw error;
                }
                return 0;
            }
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    return (
        <TradeContext.Provider value={{
            trades,
            addTrades,
            updateTrade,
            deleteTrades,
            clearTrades,
            clearTradesByExchange,
            fetchTradesFromAPI,
            hasTrades: trades.length > 0,
            isLoading,
            lastUpdated,
            lastDebugData
        }}>
            {children}
        </TradeContext.Provider>
    );
};

export const useTrades = () => {
    const context = useContext(TradeContext);
    if (context === undefined) {
        throw new Error('useTrades must be used within a TradeProvider');
    }
    return context;
};
