import CryptoJS from 'crypto-js';
import type { Trade } from '../types';

const MEXC_FUTURES_PROXY = '/api/mexc-futures';

// MEXC Futures: Standard User History Endpoint (Reverted)
export const fetchMEXCTradeHistory = async (apiKey: string, apiSecret: string): Promise<{ trades: Trade[], raw: any }> => {
    let allTrades: any[] = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 5; // Limit for safety

    try {
        if (!apiKey || !apiSecret) return { trades: [], raw: null };

        while (hasMore && page <= MAX_PAGES) {
            const timestamp = Date.now().toString();
            // Test with minimal params first
            const params: Record<string, string> = {};

            // If no params, queryRange is empty string
            const queryRange = Object.keys(params).length === 0 ? '' :
                Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
            const signString = apiKey + timestamp + queryRange;
            const signature = CryptoJS.HmacSHA256(signString, apiSecret).toString(CryptoJS.enc.Hex);

            console.log('[MEXC Futures] Signature Debug:', {
                timestamp,
                queryRange,
                signStringPreview: `${signString.substring(0, 50)}...`,
                signaturePreview: `${signature.substring(0, 20)}...`,
                apiKeyPreview: `${apiKey.substring(0, 8)}...`
            });

            const headers = {
                'ApiKey': apiKey,
                'Request-Time': timestamp,
                'Signature': signature,
                'Content-Type': 'application/json'
            };

            // Switch BACK to history_orders
            const response = await fetch(`${MEXC_FUTURES_PROXY}/api/v1/private/order/list/history_orders?${queryRange}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                console.error("MEXC Fetch Error:", await response.text());
                break;
            }

            const data = await response.json();

            // Log full response for debugging
            console.log('[MEXC Futures] Page', page, 'full response:', data);

            console.log('[MEXC Futures] Page', page, 'response structure:', {
                hasData: !!data.data,
                dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
                dataLength: Array.isArray(data.data) ? data.data.length : 'N/A',
                topLevelKeys: Object.keys(data),
                success: data.success,
                code: data.code,
                message: data.message
            });

            // Check for error responses
            if (data.success === false || data.code !== 0) {
                console.error('[MEXC Futures] API Error:', {
                    code: data.code,
                    message: data.message,
                    fullResponse: data
                });
                throw new Error(`MEXC API Error: ${data.message || 'Unknown error'}`);
            }

            const pageTrades = data.data || [];

            if (pageTrades.length === 0) {
                hasMore = false;
            } else {
                allTrades = [...allTrades, ...pageTrades];
                if (pageTrades.length < 100) hasMore = false;
                page++;
            }
        }

        console.log('[MEXC Futures] Total raw trades fetched:', allTrades.length);
        console.log('[MEXC Futures] First raw trade:', allTrades[0]);
        console.log('[MEXC Futures] Sample trade keys:', allTrades[0] ? Object.keys(allTrades[0]) : []);

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
                fees: parseFloat(t.fee || 0),
                leverage: t.leverage || 10,
                type: 'FUTURES',
                notes: `MEXC Order Side: ${t.side}`,
                isBot: false, // Handled by Context heuristics
                externalOid: t.externalOid || t.external_oid,
                pnlPercentage: 0 // Placeholder
            };
        });

        return { trades, raw: allTrades.slice(0, 5) };

    } catch (error) {
        console.error("Failed to fetch MEXC history", error);
        return { trades: [], raw: null };
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
    const signV3 = (queryString: string) => CryptoJS.HmacSHA256(queryString, apiSecret).toString(CryptoJS.enc.Hex);

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
