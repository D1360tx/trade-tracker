import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { Trade } from '../types';
import { fetchMEXCTradeHistory, fetchMEXCSpotHistory, fetchByBitTradeHistory } from '../utils/apiClient';

interface TradeContextType {
    trades: Trade[];
    addTrades: (newTrades: Trade[]) => void;
    updateTrade: (id: string, updates: Partial<Trade>) => void;
    deleteTrades: (ids: string[]) => void;
    clearTrades: () => void;
    clearTradesByExchange: (exchange: string) => void;
    fetchTradesFromAPI: (exchange: any) => Promise<void>;
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

                const entryValue = openRow.price * qty;
                const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

                mappedTrades.push({
                    id: openRow.id, // KEEP STABLE ID FROM OPENING ORDER
                    exchange: exchangeName as any,
                    ticker: symbol,
                    type: 'CRYPTO',
                    direction: openRow.direction,
                    entryPrice: openRow.price,
                    exitPrice: price,
                    quantity: qty,
                    entryDate: new Date(openRow.time).toISOString(),
                    exitDate: new Date(time).toISOString(),
                    fees: fees + (openRow.fees || 0),
                    pnl: pnl,
                    pnlPercentage: pnlPercentage,
                    status: 'CLOSED',
                    notes: `Imported via ${exchangeName} API`
                });
            } else {
                // Orphan Close
                mappedTrades.push({
                    id: currentId,
                    exchange: exchangeName as any,
                    ticker: symbol,
                    type: 'CRYPTO',
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
                    notes: `Imported via ${exchangeName} API (Orphan)`
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
                    type: 'CRYPTO',
                    direction: openRow.direction,
                    entryPrice: openRow.price,
                    exitPrice: price,
                    quantity: qty,
                    entryDate: new Date(openRow.time).toISOString(),
                    exitDate: new Date(time).toISOString(),
                    fees: fees + (openRow.fees || 0),
                    pnl: calculatedPnl,
                    pnlPercentage: (entryValue => entryValue > 0 ? (calculatedPnl / entryValue) * 100 : 0)(openRow.price * qty),
                    status: 'CLOSED',
                    notes: `Imported via ${exchangeName} API (Auto-Netted)`,
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
                    isBot
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
                type: 'CRYPTO',
                direction: pos.direction,
                entryPrice: pos.price,
                exitPrice: pos.price, // Current price not known, use entry
                quantity: pos.qty,
                entryDate: new Date(pos.time).toISOString(),
                exitDate: new Date(pos.time).toISOString(),
                fees: pos.fees,
                pnl: 0,
                pnlPercentage: 0,
                status: 'OPEN',
                notes: `Imported via ${exchangeName} API`,
                isBot: pos.isBot
            });
        });
    });

    return mappedTrades.reverse();
};

export const TradeProvider = ({ children }: { children: ReactNode }) => {
    const [trades, setTrades] = useState<Trade[]>(() => {
        const stored = localStorage.getItem('trade_tracker_trades');
        const parsed = stored ? JSON.parse(stored) : [];
        return parsed.map((t: Trade) => ({
            ...t,
            status: t.pnl !== 0 ? 'CLOSED' : 'OPEN'
        }));
    });
    const [isLoading, setIsLoading] = useState(false);
    const [lastDebugData, setLastDebugData] = useState<any>(null);

    const [lastUpdated, setLastUpdated] = useState<number | null>(() => {
        const stored = localStorage.getItem('trade_tracker_last_updated');
        return stored ? Number(stored) : null;
    });

    useEffect(() => {
        localStorage.setItem('trade_tracker_trades', JSON.stringify(trades));
    }, [trades]);

    useEffect(() => {
        if (lastUpdated) {
            localStorage.setItem('trade_tracker_last_updated', lastUpdated.toString());
        }
    }, [lastUpdated]);

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

            // Schwab Smart Schedule: Mon-Fri after 3:30 PM (15:30)
            const isWeekday = day >= 1 && day <= 5;
            const isAfterMarketClose = hours > 15 || (hours === 15 && minutes >= 30);

            if (isWeekday && isAfterMarketClose) {
                // Check if we have already synced TODAY after 15:30
                // If lastUpdated was before today 15:30, we need to sync
                const marketCloseToday = new Date(now);
                marketCloseToday.setHours(15, 30, 0, 0);

                const lastUpdateDate = lastUpdatedRef.current ? new Date(lastUpdatedRef.current) : new Date(0);

                // If we haven't synced since today's market close, trigger it
                if (lastUpdateDate.getTime() < marketCloseToday.getTime()) {
                    console.log('[AutoSync] Triggering daily Schwab sync (post-market)');
                    fetchTradesFromAPI('Schwab' as any, true);
                }
            }
        };
        // Check every minute (60000ms) instead of 10s to save resources, but 10s is fine too
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
                    if (existing.status !== incoming.status || existing.pnl !== incoming.pnl || existing.isBot !== incoming.isBot) {
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

    const fetchTradesFromAPI = async (exchange: 'MEXC' | 'Binance' | 'ByBit' | 'Coinbase' | 'BloFin' | 'Schwab' | 'Interactive Brokers', silent = false) => {
        const apiKey = localStorage.getItem(`${exchange.toLowerCase()}_api_key`);
        const apiSecret = localStorage.getItem(`${exchange.toLowerCase()}_api_secret`);

        if (!apiKey || !apiSecret) {
            if (!silent) alert(`Please configure ${exchange} API keys in Settings first.`);
            return;
        }

        if (!silent) setIsLoading(true);
        try {
            let apiTrades: any[] = [];
            let raw: any = null;

            if (exchange === 'MEXC') {
                // Fetch Orders/Deals (Reverting to History to be safe + Heuristic Bot Detection)
                const futuresResult = await fetchMEXCTradeHistory(apiKey, apiSecret);
                const spotResult = await fetchMEXCSpotHistory(apiKey, apiSecret);

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

                // Use 90 day window
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                const transactions = await fetchSchwabTransactions(startDate, endDate);
                const mappedTrades = mapSchwabTransactionsToTrades(transactions);

                // Add exchange field if missing (mapper should hande it but safety first)
                const tradesWithExchange = mappedTrades.map(t => ({ ...t, exchange: 'Schwab' as const }));

                // Directly add trades (bypassing generic aggregateTrades since mapper handles it)
                addTrades(tradesWithExchange as Trade[]);
                setLastUpdated(Date.now());
                if (!silent) alert(`Schwab Sync Complete: ${mappedTrades.length} trades processed.`);

                // Return early as we handled everything
                if (!silent) setIsLoading(false);
                return;
            } else {
                throw new Error('Simulation_Mode');
            }

            setLastDebugData(raw);
            console.log(`[${exchange}] Raw API response sample:`, raw);
            console.log(`[${exchange}] API Trades before aggregation:`, apiTrades.length);

            const trades = aggregateTrades(apiTrades, exchange);
            console.log(`[${exchange}] Trades after aggregation:`, trades.length);
            console.log(`[${exchange}] Sample aggregated trade:`, trades[0]);

            // deduplication logic is now inside mergeTrades (called by addTrades)
            addTrades(trades);
            setLastUpdated(Date.now());

            console.log(`[${exchange}] Sync complete - added ${trades.length} trades`);

            if (!silent) {
                // We use a small timeout to let the state update so we can count? 
                // Actually mergeTrades is sync but state update is async.
                // Just generic success message.
                // alert(`Sync complete for ${exchange}.`);
            }

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
                if (!silent) alert(`Fetched ${mockTrades.length} trades from ${exchange} (Simulated).`);
            } else {
                console.error(error);
                // Suppress ByBit 403 (CloudFront Block)
                const isByBit403 = exchange === 'ByBit' && (error.message.includes('403') || error.message.includes('CloudFront') || error.message.includes('HTML'));
                if (!silent && !isByBit403) {
                    alert(`Failed to fetch trades: ${error.message || 'Unknown error'}`);
                }
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
