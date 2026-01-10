import CryptoJS from 'crypto-js';
import type { Trade } from '../types';

const MEXC_FUTURES_PROXY = '/api/mexc-futures';

// Helper to check MEXC server time and get time drift
const getMEXCServerTime = async (): Promise<{ serverTime: number, drift: number }> => {
    try {
        const localTime = Date.now();
        const response = await fetch(`${MEXC_FUTURES_PROXY}/api/v1/contract/ping`);
        const data = await response.json();

        if (data.success && data.data) {
            const serverTime = data.data;
            const drift = localTime - serverTime;
            console.log('[MEXC Time Check]', {
                localTime,
                serverTime,
                drift: `${drift}ms`,
                driftSeconds: `${(drift / 1000).toFixed(2)}s`
            });
            return { serverTime, drift };
        }
        return { serverTime: localTime, drift: 0 };
    } catch (e) {
        console.warn('[MEXC Time Check] Failed:', e);
        return { serverTime: Date.now(), drift: 0 };
    }
};

// MEXC Futures: Standard User History Endpoint (Enhanced)
export const fetchMEXCTradeHistory = async (apiKey: string, apiSecret: string): Promise<{ trades: Trade[], raw: any }> => {
    let allTrades: any[] = [];
    const MAX_TOTAL_PAGES = 50;
    let totalPagesFetched = 0;

    // Time Window Config
    const HISTORY_DAYS = 365;
    const CHUNK_DAYS = 85; // < 90 days to satisfy API limit
    const WINDOW_MS = CHUNK_DAYS * 24 * 60 * 60 * 1000;
    const END_TIME_MS = Date.now();
    const START_TIME_MS = END_TIME_MS - (HISTORY_DAYS * 24 * 60 * 60 * 1000);

    let currentWindowEnd = END_TIME_MS;

    try {
        if (!apiKey || !apiSecret) {
            console.error('[MEXC] Missing API credentials');
            return { trades: [], raw: { error: 'Missing API key or secret' } };
        }

        // Check server time first
        const { drift } = await getMEXCServerTime();

        // Iterate backwards in time chunks
        while (currentWindowEnd > START_TIME_MS && totalPagesFetched < MAX_TOTAL_PAGES) {
            let currentWindowStart = currentWindowEnd - WINDOW_MS;
            if (currentWindowStart < START_TIME_MS) currentWindowStart = START_TIME_MS;

            console.log(`[MEXC Futures] Fetching Window: ${new Date(currentWindowStart).toISOString()} to ${new Date(currentWindowEnd).toISOString()}`);

            let page = 1;
            let hasMoreInWindow = true;

            // Pagination within the window
            while (hasMoreInWindow && totalPagesFetched < MAX_TOTAL_PAGES) {
                // Use server time if drift is significant (> 1 second)
                const useServerTime = Math.abs(drift) > 1000;
                const authTimestamp = (Date.now() - (useServerTime ? drift : 0)).toString();

                const params: Record<string, string> = {
                    page_num: page.toString(),
                    page_size: '100',
                    start_time: currentWindowStart.toString(),
                    end_time: currentWindowEnd.toString()
                };

                // Build query string
                const queryRange = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
                const signString = apiKey + authTimestamp + queryRange;
                const cleanSecret = apiSecret.replace(/\s/g, '');
                const signature = CryptoJS.HmacSHA256(signString, cleanSecret).toString(CryptoJS.enc.Hex);

                const url = `${MEXC_FUTURES_PROXY}/api/v1/private/order/list/history_orders?${queryRange}`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'ApiKey': apiKey,
                        'Request-Time': authTimestamp,
                        'Signature': signature,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const txt = await response.text();
                    console.error('[MEXC Futures] Window Error:', txt);
                    // If error is 6003 (Time Range) despite our logic, break window
                    if (txt.includes('6003')) {
                        hasMoreInWindow = false;
                        break;
                    }
                    // For other errors, maybe retry or skip? throwing stops everything.
                    // Let's log and try next window? Or fail?
                    // Fail logic:
                    if (response.status === 401 || response.status === 403) throw new Error(`MEXC Auth Error: ${txt}`);
                    // Non-fatal (maybe temporary), wait and break window
                    await new Promise(r => setTimeout(r, 1000));
                    hasMoreInWindow = false;
                    continue;
                }

                const data = await response.json();
                if (data.success === false || data.code !== 0) {
                    console.error('[MEXC API Error]', data);
                    hasMoreInWindow = false;
                    continue;
                }

                const pageTrades = data.data || [];
                if (pageTrades.length === 0) {
                    hasMoreInWindow = false;
                } else {
                    allTrades = [...allTrades, ...pageTrades];
                    totalPagesFetched++;
                    // If page is full (100), maybe more? If less, done with window.
                    if (pageTrades.length < 100) hasMoreInWindow = false;
                    else page++;
                }

                // Rate limit safety
                await new Promise(r => setTimeout(r, 100));
            }

            // Move to next (older) window
            currentWindowEnd = currentWindowStart;
        }

        console.log('[MEXC Futures] Total raw trades fetched:', allTrades.length);
        if (allTrades.length > 0) {
            console.log('[MEXC Futures] First raw trade:', allTrades[0]);
            console.log('[MEXC Futures] Sample trade keys:', Object.keys(allTrades[0]));
        }

        // Map standard Orders to Trade interface
        const trades: Trade[] = allTrades.map((t: any) => {
            let direction: 'LONG' | 'SHORT' = 'LONG';
            // MEXC V1 Futures Side: 1=Open Long, 2=Close Short, 3=Open Short, 4=Close Long
            if (t.side === 1 || t.side === 2) direction = 'LONG';
            if (t.side === 3 || t.side === 4) direction = 'SHORT';

            const isClose = (t.side === 2 || t.side === 4);
            // Use dealAvgPrice if available (actual execution price), fallback to order price
            const tradePrice = parseFloat(t.dealAvgPrice || t.avgPrice || t.price || 0);

            return {
                id: t.orderId,
                exchange: 'MEXC',
                ticker: t.symbol,
                direction,
                entryDate: new Date(t.createTime).toISOString(),
                exitDate: new Date(t.updateTime || t.createTime).toISOString(),
                entryPrice: tradePrice,
                exitPrice: tradePrice,
                quantity: parseFloat(t.vol),
                status: isClose ? 'CLOSED' : 'OPEN',
                // Only CLOSE orders should have PnL, OPEN orders get 0 for proper FIFO matching
                pnl: isClose ? parseFloat(t.profit || 0) : 0,
                fees: parseFloat(t.totalFee || t.takerFee || t.makerFee || t.fee || 0),
                leverage: t.leverage ? parseFloat(t.leverage) : 1,
                notional: parseFloat(t.orderMargin || t.usedMargin || t.amount || 0) * (t.leverage ? parseFloat(t.leverage) : 1),
                margin: parseFloat(t.orderMargin || t.usedMargin || t.amount || 0),
                type: 'FUTURES',
                notes: `MEXC API | state=${t.state} side=${t.side} isClose=${isClose} | FEES: total=${t.totalFee} taker=${t.takerFee} maker=${t.makerFee} fee=${t.fee} | profit=${t.profit}`,
                isBot: false, // Handled by Context heuristics
                externalOid: t.externalOid || t.external_oid,
                pnlPercentage: 0 // Placeholder
            };
        });

        return { trades, raw: allTrades.slice(0, 5) };

    } catch (error: any) {
        console.error('[MEXC Futures] Fatal Error:', {
            error: error.message,
            stack: error.stack
        });
        return { trades: [], raw: { error: error.message } };
    }
};

const MEXC_SPOT_PROXY = '/api/mexc-spot';

// MEXC Spot (V3) Trade
export interface MEXCSpotTrade {
    symbol: string;
    id: string;
    orderId: string;
    orderListId: number;
    price: string;
    qty: string;
    quoteQty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    isBuyer: boolean;
    isMaker: boolean;
    isBestMatch: boolean;
}

export const fetchMEXCSpotHistory = async (apiKey: string, apiSecret: string): Promise<{ trades: MEXCSpotTrade[], raw: any }> => {
    const timestamp = Date.now().toString();
    // V3 uses query string signing. 
    // Format: HmacSHA256(queryString, secret)

    // Helper to sign
    const signV3 = (queryString: string) => CryptoJS.HmacSHA256(queryString, apiSecret.replace(/\s/g, '')).toString(CryptoJS.enc.Hex);

    // 1. Get Account Info to find active symbols (Optimization)
    // URL: /api/v3/account
    const accParams = `timestamp=${timestamp}`;
    const accSig = signV3(accParams);
    const accountUrl = `${MEXC_SPOT_PROXY}/api/v3/account?${accParams}&signature=${accSig}`;

    try {
        // Fetch account info to determine active pairs
        const accRes = await fetch(accountUrl, {
            headers: { 'X-MEXC-APIKEY': apiKey }
        });

        if (!accRes.ok) {
            // If checking account fails, we might just return empty or throw? 
            // Better to log and return empty so we don't break Futures sync.
            const text = await accRes.text();
            console.warn("MEXC Spot Account Check Failed:", text);
            return { trades: [], raw: null };
        }

        const accData = await accRes.json();

        // Find symbols with non-zero balance
        // accData.balances = [{asset: "USDT", free: "100", locked: "0"}, ...]
        // We look for assets that are NOT USDT/USDC (quote currencies usually) to find base pairs?
        // OR we just take ALL assets with balance > 0 and assume they are paired with USDT?
        // This is a heuristic.
        const activeAssets = (accData.balances || [])
            .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
            .map((b: any) => b.asset);

        // Construct likely pairs. Scan USDT and USDC.
        const pairsToScan: string[] = [];
        activeAssets.forEach((asset: string) => {
            if (asset !== 'USDT' && asset !== 'USDC') {
                pairsToScan.push(`${asset}USDT`);
                pairsToScan.push(`${asset}USDC`);
            }
        });

        // Also add generic popular pairs just in case? No, rate limits.
        // Scan discovered pairs for trades

        let allSpotTrades: MEXCSpotTrade[] = [];

        // Fetch trades for each pair
        for (const symbol of pairsToScan) {
            const tParams = `symbol=${symbol}&limit=500&timestamp=${Date.now()}`;
            const tSig = signV3(tParams);
            const tUrl = `${MEXC_SPOT_PROXY}/api/v3/myTrades?${tParams}&signature=${tSig}`;

            try {
                const tRes = await fetch(tUrl, { headers: { 'X-MEXC-APIKEY': apiKey } });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    if (Array.isArray(tData)) {
                        allSpotTrades = [...allSpotTrades, ...tData];
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch spot trades for ${symbol}`, e);
            }

            // Rate limit protection
            await new Promise(r => setTimeout(r, 100));
        }

        // Return discovered trades
        const foundSymbols = [...new Set(allSpotTrades.map(t => t.symbol))];
        return {
            trades: allSpotTrades,
            raw: {
                balances: accData,
                scanned: pairsToScan,
                found: foundSymbols
            }
        };

    } catch (e: any) {
        console.error("MEXC Spot Fetch Failed", e);
        return { trades: [], raw: null };
    }
};

interface ByBitTrade {
    symbol: string;
    orderId: string;
    execId: string;
    execPrice: string;
    execQty: string;
    execType: string;
    side: string; // Buy, Sell
    createTime: string; // Timestamp in strings
    execFee: string;
    feeRate: string;
    tradeIv?: string;
    markIv?: string;
    markPrice?: string;
    indexPrice?: string;
    underlyingPrice?: string;
    blockTradeId?: string;
    closedPnl?: string;
}

const BYBIT_PROXY = '/api/bybit';

export const fetchByBitTradeHistory = async (apiKey: string, apiSecret: string): Promise<{ trades: ByBitTrade[], raw: any }> => {
    // Uses ByBit V5 API
    const timestamp = Date.now().toString();
    const recvWindow = '5000';

    // We want execution history (fills)
    // Category: linear (USDT Perp) is most common. We might strictly need to ask user, but defaulting to linear is safer for perps.
    // Ideally we fetch both linear and spot, or ask. For now, let's do 'linear' as it matches the futures theme.
    const params = {
        category: 'linear',
        limit: '100', // Max 100
    };

    // Sort params for signature? ByBit V5 requires specific ordering?
    // "For GET requests, parameters should be sorted alphabetically"
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map(key => `${key}=${params[key as keyof typeof params]}`).join('&');

    // String to sign: timestamp + key + recvWindow + queryString
    const signString = timestamp + apiKey + recvWindow + queryString;
    const signature = CryptoJS.HmacSHA256(signString, apiSecret).toString(CryptoJS.enc.Hex);

    const url = `${BYBIT_PROXY}/v5/execution/list?${queryString}`;

    try {
        // Execute ByBit API request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-SIGN': signature,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`ByBit API Error: ${response.status} - ${err}`);
        }

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(`ByBit API Error: ${data.retMsg} (Code: ${data.retCode})`);
        }

        let trades: ByBitTrade[] = [];
        if (data.result && Array.isArray(data.result.list)) {
            trades = data.result.list;
        }

        // ByBit V5 returns newest first.
        // We might want to loop for pagination (cursor), but let's start with first 100.
        // TODO: Implement pagination using 'nextPageCursor' if needed for deeper history.

        return { trades, raw: data };

    } catch (e: any) {
        console.error("ByBit Fetch Failed", e);
        throw e;
    }
};
