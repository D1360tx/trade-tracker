/**
 * Schwab Transaction to Trade Mapper
 * 
 * Converts Schwab API transaction responses to our Trade schema
 * Uses FIFO matching to pair buy/sell transactions
 */

import type { Trade } from '../types';

export interface SchwabTransaction {
    transactionId: string;
    accountNumber?: string;
    transactionDate: string;
    settlementDate?: string;
    type: 'TRADE' | 'DIVIDEND' | 'INTEREST' | 'FEE' | 'CASH_RECEIPT' | 'TRANSFER';
    description?: string;
    netAmount: number;
    transactionItem?: {
        instrument: {
            symbol: string;
            assetType: 'EQUITY' | 'OPTION' | 'MUTUAL_FUND' | 'ETF' | 'FIXED_INCOME';
            cusip?: string;
        };
        instruction: 'BUY' | 'SELL' | 'SELL_SHORT' | 'BUY_TO_COVER';
        positionEffect?: 'OPENING' | 'CLOSING';
        amount: number;
        price: number;
        cost?: number;
    };
    fees?: {
        commission?: number;
        optRegFee?: number;
        secFee?: number;
        additionalFee?: number;
    };
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
    // Filter to only trade transactions
    const tradeTransactions = transactions.filter(t => t.type === 'TRADE' && t.transactionItem);

    // Sort by date (oldest first for FIFO)
    const sorted = [...tradeTransactions].sort((a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    const trades: Trade[] = [];
    const openPositions: Map<string, OpenPosition[]> = new Map();

    for (const tx of sorted) {
        const item = tx.transactionItem!;
        const symbol = item.instrument.symbol;
        const instruction = item.instruction;

        // Calculate total fees
        const fees = (tx.fees?.commission || 0) +
            (tx.fees?.optRegFee || 0) +
            (tx.fees?.secFee || 0) +
            (tx.fees?.additionalFee || 0);

        // Determine if this is an opening or closing transaction
        const isOpening = item.positionEffect === 'OPENING' ||
            instruction === 'BUY' ||
            instruction === 'SELL_SHORT';

        // Direction is set inline in the openPositions.push call below

        if (isOpening && (instruction === 'BUY' || instruction === 'SELL_SHORT')) {
            // Add to open positions
            if (!openPositions.has(symbol)) {
                openPositions.set(symbol, []);
            }
            openPositions.get(symbol)!.push({
                transactionId: tx.transactionId,
                date: tx.transactionDate,
                price: item.price,
                quantity: item.amount,
                direction: instruction === 'BUY' ? 'LONG' : 'SHORT',
                fees
            });
        } else {
            // Closing transaction - match with open position (FIFO)
            const positions = openPositions.get(symbol) || [];
            let remainingQty = item.amount;

            while (remainingQty > 0 && positions.length > 0) {
                const openPos = positions[0];
                const matchQty = Math.min(remainingQty, openPos.quantity);

                // Calculate P&L
                let pnl: number;
                if (openPos.direction === 'LONG') {
                    pnl = (item.price - openPos.price) * matchQty;
                } else {
                    pnl = (openPos.price - item.price) * matchQty;
                }

                const entryValue = openPos.price * matchQty;
                const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

                // Determine asset type
                let assetType: Trade['type'] = 'STOCK';
                if (item.instrument.assetType === 'OPTION') assetType = 'OPTION';
                else if (item.instrument.assetType === 'ETF') assetType = 'STOCK';
                else if (item.instrument.assetType === 'MUTUAL_FUND') assetType = 'STOCK';

                trades.push({
                    id: `${openPos.transactionId}-${tx.transactionId}`,
                    exchange: 'Schwab',
                    ticker: symbol,
                    type: assetType,
                    direction: openPos.direction,
                    entryPrice: openPos.price,
                    exitPrice: item.price,
                    quantity: matchQty,
                    entryDate: openPos.date,
                    exitDate: tx.transactionDate,
                    fees: fees + openPos.fees,
                    pnl,
                    pnlPercentage,
                    status: 'CLOSED',
                    notes: `Imported from Schwab API`,
                    externalOid: tx.transactionId
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

    return trades;
};

/**
 * Get summary of open positions (not yet closed)
 */
export const getOpenPositionsSummary = (transactions: SchwabTransaction[]): { symbol: string; quantity: number; direction: string }[] => {
    const tradeTransactions = transactions.filter(t => t.type === 'TRADE' && t.transactionItem);
    const sorted = [...tradeTransactions].sort((a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    const openPositions: Map<string, { quantity: number; direction: 'LONG' | 'SHORT' }> = new Map();

    for (const tx of sorted) {
        const item = tx.transactionItem!;
        const symbol = item.instrument.symbol;

        const current = openPositions.get(symbol) || { quantity: 0, direction: 'LONG' as const };

        if (item.instruction === 'BUY') {
            current.quantity += item.amount;
            current.direction = 'LONG';
        } else if (item.instruction === 'SELL') {
            current.quantity -= item.amount;
        } else if (item.instruction === 'SELL_SHORT') {
            current.quantity -= item.amount;
            current.direction = 'SHORT';
        } else if (item.instruction === 'BUY_TO_COVER') {
            current.quantity += item.amount;
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
