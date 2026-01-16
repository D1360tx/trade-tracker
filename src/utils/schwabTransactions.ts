/**
 * Schwab Transaction to Trade Mapper
 * 
 * Converts Schwab API transaction responses to our Trade schema
 * Uses FIFO matching to pair buy/sell transactions
 */

import type { Trade } from '../types';

export interface SchwabTransferItem {
    instrument: {
        assetType: 'EQUITY' | 'OPTION' | 'MUTUAL_FUND' | 'ETF' | 'FIXED_INCOME' | 'INDEX' | 'CURRENCY';
        symbol: string;
        description?: string;
        cusip?: string;
        putCall?: 'PUT' | 'CALL';
        strikePrice?: number;
        underlyingSymbol?: string;
    };
    amount: number;
    cost?: number;
    price?: number;
    positionEffect?: 'OPENING' | 'CLOSING';
    feeType?: 'COMMISSION' | 'SEC_FEE' | 'OPT_REG_FEE' | 'TAF_FEE' | 'INDEX_OPTION_FEE';
}

export interface SchwabTransaction {
    activityId: number;
    accountNumber?: string;
    time: string;  // Schwab uses "time" not "transactionDate"
    tradeDate?: string;
    type: 'TRADE' | 'DIVIDEND_OR_INTEREST' | 'JOURNAL' | 'RECEIVE_AND_DELIVER';
    status?: 'VALID' | 'INVALID';
    netAmount: number;
    transferItems?: SchwabTransferItem[];  // Array of items including trades and fees
}

interface OpenPosition {
    transactionId: string;
    date: string;
    price: number;
    quantity: number;
    direction: 'LONG' | 'SHORT';
    fees: number;
}

/**
 * Extract expiration date from Schwab option symbol format
 * Schwab format: "SPXW  251124C00672000" -> YYMMDD embedded
 * Returns: "11/24/2025" (MM/DD/YYYY format to match CSV)
 */
const extractExpirationDate = (fullSymbol: string): string | null => {
    // Schwab option format: SYMBOL  YYMMDDCPSTRIKE
    // Example: "SPXW  251124C00672000"
    //           SPXW  25 11 24 C 00672000
    //                 YY MM DD P STRIKE

    const match = fullSymbol.match(/\s+(\d{2})(\d{2})(\d{2})[CP]/);
    if (!match) return null;

    const [, yy, mm, dd] = match;
    const year = 2000 + parseInt(yy, 10);

    return `${mm}/${dd}/${year}`;
};

/**
 * Map Schwab API transactions to Trade objects
 * Uses FIFO matching to pair opening and closing transactions
 */
export const mapSchwabTransactionsToTrades = (transactions: SchwabTransaction[]): Trade[] => {
    console.log('[Schwab Mapper] Processing', transactions.length, 'transactions');

    // Filter to only TRADE type transactions with transferItems
    const tradeTransactions = transactions.filter(t =>
        t.type === 'TRADE' && t.transferItems && t.transferItems.length > 0
    );

    console.log('[Schwab Mapper] Found', tradeTransactions.length, 'trade transactions');

    // Sort by date (oldest first for FIFO)
    // Sort by date (oldest first for FIFO), use activityId as tiebreaker
    const sorted = [...tradeTransactions].sort((a, b) => {
        const timeDiff = new Date(a.time).getTime() - new Date(b.time).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.activityId - b.activityId;
    });

    const trades: Trade[] = [];
    const openPositions: Map<string, OpenPosition[]> = new Map();
    const orphanedTrades: Array<{symbol: string, date: string, activityId: number}> = [];

    for (const tx of sorted) {
        // Find the trade item (non-fee item with price)
        const tradeItem = tx.transferItems?.find(
            item => item.price !== undefined && !item.feeType && item.instrument.assetType !== 'CURRENCY'
        );

        if (!tradeItem) {
            console.log('[Schwab Mapper] No trade item found in transaction:', tx.activityId);
            continue;
        }

        // Calculate total fees from fee items
        const fees = tx.transferItems?.filter(item => item.feeType)
            .reduce((sum, item) => sum + Math.abs(item.cost || 0), 0) || 0;

        const symbol = tradeItem.instrument.underlyingSymbol || tradeItem.instrument.symbol;
        const positionEffect = tradeItem.positionEffect;
        const isOpening = positionEffect === 'OPENING';

        // Use cost/amount to get actual price with precision (not rounded price field)
        const quantity = Math.abs(tradeItem.amount);
        const multiplier = tradeItem.instrument.assetType === 'OPTION' ? 100 : 1;
        const price = tradeItem.cost && quantity > 0
            ? Math.abs(tradeItem.cost) / (quantity * multiplier)
            : (tradeItem.price || 0);

        // For position tracking, we MUST use the unique instrument symbol match specific options contracts
        // ignoring underlyingSymbol for the key, otherwise COIN calls and puts get mixed in the same FIFO queue!
        const positionKey = tradeItem.instrument.symbol || symbol;

        console.log('[Schwab Mapper] Processing:', {
            activityId: tx.activityId,
            symbol,
            positionEffect,
            rawPrice: tradeItem.price,
            rawCost: tradeItem.cost,
            calculatedPrice: price,
            quantity,
            multiplier,
            assetType: tradeItem.instrument.assetType
        });

        // Debug ISRG trades specifically
        if (symbol.includes('ISRG')) {
            console.log('[ISRG DEBUG]', {
                activityId: tx.activityId,
                symbol,
                fullInstrumentSymbol: tradeItem.instrument.symbol,
                positionKey,
                positionEffect,
                price,
                quantity,
                strike: tradeItem.instrument.strikePrice,
                putCall: tradeItem.instrument.putCall,
                date: tx.time
            });
        }

        if (isOpening) {
            // Determine direction from amount sign or putCall
            const direction: 'LONG' | 'SHORT' = tradeItem.amount > 0 ? 'LONG' : 'SHORT';

            // Add to open positions
            if (!openPositions.has(positionKey)) {
                openPositions.set(positionKey, []);
            }
            openPositions.get(positionKey)!.push({
                transactionId: String(tx.activityId),
                date: tx.time,
                price,
                quantity,
                direction,
                fees
            });
        } else {
            // CLOSING transaction - match with open position (FIFO)
            const positions = openPositions.get(positionKey) || [];

            if (positions.length === 0) {
                // Track orphaned trade for summary
                orphanedTrades.push({
                    symbol: positionKey,
                    date: tx.time,
                    activityId: tx.activityId
                });

                // Enhanced warning with more context
                const syncWindowStart = sorted[0]?.time ? new Date(sorted[0].time).toISOString().split('T')[0] : 'unknown';
                const daysSinceStart = sorted[0]?.time
                    ? Math.ceil((Date.now() - new Date(sorted[0].time).getTime()) / (24 * 60 * 60 * 1000))
                    : 0;

                console.warn(
                    `[Schwab Mapper] ORPHANED CLOSING TRADE: Could not find opening position for ${positionKey} (TxId: ${tx.activityId}).`,
                    `\nClosed: ${tx.time.split('T')[0]}`,
                    `\nThis position was likely opened before ${syncWindowStart}.`,
                    `\nTrade will be skipped. Consider extending sync window beyond ${daysSinceStart} days.`
                );
            }

            let remainingQty = quantity;

            while (remainingQty > 0 && positions.length > 0) {
                const openPos = positions[0];
                const matchQty = Math.min(remainingQty, openPos.quantity);

                // Total fees for both entry and exit
                const totalFees = fees + openPos.fees;

                let grossPnl: number;
                if (openPos.direction === 'LONG') {
                    grossPnl = (price - openPos.price) * matchQty * multiplier;
                } else {
                    grossPnl = (openPos.price - price) * matchQty * multiplier;
                }

                // Subtract fees to get NET P&L (matching Schwab's Realized Gain/Loss report)
                const pnl = grossPnl - totalFees;

                const entryValue = openPos.price * matchQty * multiplier;
                const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

                // Determine asset type
                let assetType: Trade['type'] = 'STOCK';
                if (tradeItem.instrument.assetType === 'OPTION') assetType = 'OPTION';
                else if (tradeItem.instrument.assetType === 'INDEX') assetType = 'OPTION';

                // Build the display symbol (include option details if applicable)
                // Format to match CSV: "SYMBOL MM/DD/YYYY STRIKE.00 P/C"
                let displaySymbol = symbol;
                if (tradeItem.instrument.assetType === 'OPTION') {
                    const putCall = tradeItem.instrument.putCall || '';
                    const strikePrice = tradeItem.instrument.strikePrice || 0;
                    const fullSymbol = tradeItem.instrument.symbol || '';

                    // Extract expiration from Schwab's internal format (e.g., "SPXW  251124C00672000")
                    const expirationDate = extractExpirationDate(fullSymbol);

                    if (expirationDate && strikePrice > 0) {
                        // Format to match CSV: "SPXW 11/24/2025 6720.00 C"
                        displaySymbol = `${symbol} ${expirationDate} ${strikePrice.toFixed(2)} ${putCall.charAt(0)}`;
                    } else {
                        // Fallback if we can't extract expiration (shouldn't happen for standard options)
                        displaySymbol = `${symbol} ${strikePrice}${putCall.charAt(0)}`;
                    }
                }

                trades.push({
                    id: `${openPos.transactionId}-${tx.activityId}`,
                    exchange: 'Schwab',
                    ticker: displaySymbol,
                    type: assetType,
                    direction: openPos.direction,
                    entryPrice: openPos.price,
                    exitPrice: price,
                    quantity: matchQty,
                    entryDate: openPos.date,
                    exitDate: tx.time,
                    fees: totalFees,
                    pnl, // Now NET P&L (gross - fees)
                    pnlPercentage,
                    status: 'CLOSED',
                    notes: `Imported from Schwab API`,
                    externalOid: String(tx.activityId)
                });

                console.log('[Schwab Mapper] Created trade:', {
                    symbol: displaySymbol,
                    pnl,
                    grossPnl,
                    entryPrice: openPos.price,
                    exitPrice: price,
                    entryFees: openPos.fees,
                    exitFees: fees,
                    totalFees,
                    quantity: matchQty,
                    multiplier
                });

                // Update remaining quantities
                remainingQty -= matchQty;
                openPos.quantity -= matchQty;

                // Remove fully matched position
                if (openPos.quantity <= 0) {
                    positions.shift();
                }
            }
        }
    }

    // Handle expired options that were never closed (expired worthless)
    const now = new Date();
    for (const [positionKey, positions] of openPositions.entries()) {
        for (const openPos of positions) {
            // Check if this is an option with an expiration date
            // Schwab option format: "SYMBOL  YYMMDDCPSTRIKE000"
            // Example: "ISRG  251031C00600000" = ISRG expiring 2025-10-31, Call, $600
            const optionMatch = positionKey.match(/(\w+)\s+(\d{6})([CP])(\d{8})/);

            if (optionMatch) {
                const [, baseSymbol, dateStr, putCall, strikeStr] = optionMatch;

                // Parse expiration date (YYMMDD format)
                const year = 2000 + parseInt(dateStr.substring(0, 2));
                const month = parseInt(dateStr.substring(2, 4)) - 1; // JS months are 0-indexed
                const day = parseInt(dateStr.substring(4, 6));
                const expirationDate = new Date(year, month, day);

                // If expired, create a loss trade
                if (expirationDate < now) {
                    const strike = parseInt(strikeStr) / 1000; // Strike is in thousandths
                    const putCallLabel = putCall === 'C' ? 'CALL' : 'PUT';

                    // Format expiration date as MM/DD/YYYY to match CSV
                    const mm = String(expirationDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(expirationDate.getDate()).padStart(2, '0');
                    const yyyy = expirationDate.getFullYear();
                    const expirationStr = `${mm}/${dd}/${yyyy}`;

                    // Format symbol to match CSV: "SYMBOL MM/DD/YYYY STRIKE.00 P/C"
                    const displaySymbol = `${baseSymbol} ${expirationStr} ${strike.toFixed(2)} ${putCallLabel.charAt(0)}`;

                    // For expired options, exit price is $0 and we lost the full premium paid
                    const multiplier = 100; // Options multiplier
                    const pnl = -(openPos.price * openPos.quantity * multiplier) - openPos.fees;
                    const pnlPercentage = -100; // Total loss

                    trades.push({
                        id: `${openPos.transactionId}-expired`,
                        exchange: 'Schwab',
                        ticker: displaySymbol,
                        type: 'OPTION',
                        direction: openPos.direction,
                        entryPrice: openPos.price,
                        exitPrice: 0, // Expired worthless
                        quantity: openPos.quantity,
                        entryDate: openPos.date,
                        exitDate: expirationDate.toISOString(),
                        fees: openPos.fees,
                        pnl,
                        pnlPercentage,
                        status: 'CLOSED',
                        notes: `Imported from Schwab API (Expired Worthless)`,
                        externalOid: openPos.transactionId
                    });

                    console.log('[Schwab Mapper] Created expired option trade:', {
                        symbol: displaySymbol,
                        expiration: expirationDate.toISOString().split('T')[0],
                        pnl,
                        entryPrice: openPos.price
                    });
                }
            }
        }
    }

    // Aggregate trades that are multiple contracts of the same position closed at the same time
    console.log('[Schwab Mapper] Aggregating multiple contracts closed simultaneously...');
    const aggregatedTrades: Trade[] = [];
    const tradeGroups = new Map<string, Trade[]>();

    trades.forEach(trade => {
        // Group key: symbol + entry date (minute precision) + exit date (minute precision)
        const entryMinute = trade.entryDate.substring(0, 16); // YYYY-MM-DDTHH:MM
        const exitMinute = trade.exitDate.substring(0, 16);
        const key = `${trade.ticker}|${entryMinute}|${exitMinute}`;

        console.log('[Schwab Aggregation] Trade:', {
            ticker: trade.ticker,
            entryDate: trade.entryDate,
            exitDate: trade.exitDate,
            key,
            pnl: trade.pnl
        });

        if (!tradeGroups.has(key)) {
            tradeGroups.set(key, []);
        }
        tradeGroups.get(key)!.push(trade);
    });

    // Combine trades in each group
    tradeGroups.forEach(group => {
        if (group.length === 1) {
            aggregatedTrades.push(group[0]);
        } else {
            // Multiple contracts closed together - aggregate them
            const first = group[0];
            const totalQuantity = group.reduce((sum, t) => sum + t.quantity, 0);
            const totalPnl = group.reduce((sum, t) => sum + t.pnl, 0);
            const totalFees = group.reduce((sum, t) => sum + (t.fees || 0), 0);
            const avgEntryPrice = group.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0) / totalQuantity;
            const avgExitPrice = group.reduce((sum, t) => sum + (t.exitPrice * t.quantity), 0) / totalQuantity;

            aggregatedTrades.push({
                ...first,
                quantity: totalQuantity,
                pnl: totalPnl,
                fees: totalFees,
                entryPrice: avgEntryPrice,
                exitPrice: avgExitPrice,
                pnlPercentage: first.margin ? (totalPnl / (first.margin * group.length)) * 100 : 0
            });

            console.log(`[Schwab Mapper] Aggregated ${group.length} contracts of ${first.ticker}: Total P&L $${totalPnl.toFixed(2)}`);
        }
    });

    console.log('[Schwab Mapper] Created', aggregatedTrades.length, 'trades (aggregated from', trades.length, 'raw trades)');

    // Display orphaned trades summary
    if (orphanedTrades.length > 0) {
        const uniqueSymbols = [...new Set(orphanedTrades.map(t => t.symbol))];
        console.warn(
            `\n⚠️  [Schwab Mapper] SYNC INCOMPLETE: ${orphanedTrades.length} orphaned closing trades detected.`,
            `\nThese positions were opened before the sync window started.`,
            `\nOrphaned symbols (${uniqueSymbols.length}):`, uniqueSymbols.join(', '),
            `\nTo include these trades, extend the sync window or manually import CSV data.`
        );
    } else {
        console.log('[Schwab Mapper] ✅ All closing trades successfully matched with opening positions.');
    }

    return aggregatedTrades;
};

/**
 * Get summary of open positions (not yet closed)
 */
export const getOpenPositionsSummary = (transactions: SchwabTransaction[]): { symbol: string; quantity: number; direction: string }[] => {
    const tradeTransactions = transactions.filter(t =>
        t.type === 'TRADE' && t.transferItems && t.transferItems.length > 0
    );
    const sorted = [...tradeTransactions].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    const openPositions: Map<string, { quantity: number; direction: 'LONG' | 'SHORT' }> = new Map();

    for (const tx of sorted) {
        const tradeItem = tx.transferItems?.find(
            item => item.price !== undefined && !item.feeType && item.instrument.assetType !== 'CURRENCY'
        );

        if (!tradeItem) continue;

        const symbol = tradeItem.instrument.underlyingSymbol || tradeItem.instrument.symbol;
        const current = openPositions.get(symbol) || { quantity: 0, direction: 'LONG' as const };

        if (tradeItem.positionEffect === 'OPENING') {
            if (tradeItem.amount > 0) {
                current.quantity += Math.abs(tradeItem.amount);
                current.direction = 'LONG';
            } else {
                current.quantity -= Math.abs(tradeItem.amount);
                current.direction = 'SHORT';
            }
        } else if (tradeItem.positionEffect === 'CLOSING') {
            if (tradeItem.amount < 0) {
                // Closing a long position
                current.quantity -= Math.abs(tradeItem.amount);
            } else {
                // Closing a short position
                current.quantity += Math.abs(tradeItem.amount);
            }
        }

        openPositions.set(symbol, current);
    }

    return Array.from(openPositions.entries())
        .filter(([_, pos]) => pos.quantity !== 0)
        .map(([symbol, pos]) => ({
            symbol,
            quantity: Math.abs(pos.quantity),
            direction: pos.direction
        }));
};
