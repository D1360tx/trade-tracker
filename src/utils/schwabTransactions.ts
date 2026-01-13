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
    const sorted = [...tradeTransactions].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    const trades: Trade[] = [];
    const openPositions: Map<string, OpenPosition[]> = new Map();

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
        const price = tradeItem.price || 0;
        const quantity = Math.abs(tradeItem.amount);

        // For position tracking, we MUST use the unique instrument symbol match specific options contracts
        // ignoring underlyingSymbol for the key, otherwise COIN calls and puts get mixed in the same FIFO queue!
        const positionKey = tradeItem.instrument.symbol || symbol;

        console.log('[Schwab Mapper] Processing:', {
            activityId: tx.activityId,
            symbol,
            positionEffect,
            price,
            quantity,
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
            let remainingQty = quantity;

            while (remainingQty > 0 && positions.length > 0) {
                const openPos = positions[0];
                const matchQty = Math.min(remainingQty, openPos.quantity);

                // Calculate P&L using the multiplier for options (usually 100)
                const multiplier = tradeItem.instrument.assetType === 'OPTION' ? 100 : 1;
                const totalFees = fees + openPos.fees; // Total fees for both entry and exit

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
                let displaySymbol = symbol;
                if (tradeItem.instrument.assetType === 'OPTION') {
                    const putCall = tradeItem.instrument.putCall || '';
                    const strike = tradeItem.instrument.strikePrice || '';
                    displaySymbol = `${symbol} ${strike}${putCall.charAt(0)}`;
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
                    entryPrice: openPos.price,
                    exitPrice: price
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
                    const displaySymbol = `${baseSymbol} ${strike}${putCallLabel.charAt(0)}`;

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
