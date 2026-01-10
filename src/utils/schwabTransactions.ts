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

    console.log('[Schwab Mapper] Created', trades.length, 'matched trades');
    return trades;
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
