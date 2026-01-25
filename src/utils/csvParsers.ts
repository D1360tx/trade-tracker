import Papa from 'papaparse';
import { fromZonedTime } from 'date-fns-tz';
import type { Trade, ExchangeName } from '../types';

export interface ParseResult {
    trades: Trade[];
    logs: string[];
}

const parseNumber = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, ''));
};

const safeGet = (row: Record<string, string>, keys: string[]): string => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        if (row[key] !== undefined) return row[key];
        const trimmedKey = rowKeys.find(k => k.trim() === key);
        if (trimmedKey && row[trimmedKey] !== undefined) return row[trimmedKey];
        const lowerKey = key.toLowerCase();
        const fuzzyKey = rowKeys.find(k => k.trim().toLowerCase() === lowerKey);
        if (fuzzyKey && row[fuzzyKey] !== undefined) return row[fuzzyKey];
    }
    return '';
};

const mapRowToGeneric = (row: Record<string, string>, exchange: ExchangeName): Partial<Trade> => {
    const id = Math.random().toString(36).substr(2, 9);
    const entryDate = new Date().toISOString();
    const price = parseNumber(safeGet(row, ['Price', 'Avg Price', 'Fill Price', 'Average Filled Price', 'Exec Price']));
    const qty = parseNumber(safeGet(row, ['Quantity', 'Amount', 'Qty', 'Filled Qty (Crypto)', 'Filled Qty', 'Exec Qty']));
    const profit = parseNumber(safeGet(row, ['P&L', 'Profit', 'Realized P&L', 'Closing PNL', 'Closed P&L']));
    const sideRaw = safeGet(row, ['Side', 'Action', 'Type', 'Direction']).toUpperCase();
    let isLong = sideRaw.includes('BUY') || sideRaw.includes('LONG');

    if (sideRaw.includes('SHORT')) isLong = false;
    else if (sideRaw.includes('LONG')) isLong = true;
    else if (sideRaw.includes('BUY') && !sideRaw.includes('SHORT')) isLong = true;

    return {
        id,
        exchange,
        ticker: safeGet(row, ['Symbol', 'Ticker', 'Pair', 'Futures Trading Pair', 'Contracts', 'Market']) || 'UNKNOWN',
        type: exchange === 'Schwab' || exchange === 'Interactive Brokers' ? 'STOCK' : 'CRYPTO',
        direction: isLong ? 'LONG' : 'SHORT',
        entryPrice: price,
        exitPrice: price,
        quantity: qty,
        entryDate: new Date(safeGet(row, ['Time', 'Date', 'Transaction Time', 'Time(UTC)']) || entryDate).toISOString(),
        exitDate: new Date(safeGet(row, ['Time', 'Date', 'Transaction Time', 'Time(UTC)']) || entryDate).toISOString(),
        fees: parseNumber(safeGet(row, ['Fee', 'Commission', 'Trading Fee', 'Exec Fee'])),
        pnl: profit,
        pnlPercentage: 0,
        status: 'CLOSED'
    };
};

// Safe date parser that handles various formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
const safeParseDateString = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === '') {
        return new Date().toISOString();
    }

    // Try parsing directly first
    let parsed = new Date(dateStr);

    // If invalid, try common formats
    if (isNaN(parsed.getTime())) {
        // Try MM/DD/YYYY format (common in Schwab)
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [month, day, year] = parts;
            parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
    }

    // If still invalid, try other formats
    if (isNaN(parsed.getTime())) {
        // Try removing "as of" text that Schwab sometimes includes
        const cleaned = dateStr.replace(/as of.*/i, '').trim();
        parsed = new Date(cleaned);
    }

    // Final fallback - use current date
    if (isNaN(parsed.getTime())) {
        console.warn(`Could not parse date: "${dateStr}", using current date`);
        return new Date().toISOString();
    }

    return parsed.toISOString();
};

// Parse monetary value from Schwab format (e.g., "$1,234.56" or "-$987.65")
const parseSchwabMoney = (value: string): number => {
    if (!value) return 0;
    // Remove $ sign, commas, and handle negative values
    const clean = value.replace(/[$,]/g, '').trim();
    return parseFloat(clean) || 0;
};

// Schwab Realized Gain/Loss CSV Processor (PREFERRED - uses pre-calculated P&L)
const processSchwabRealizedGains = (rows: Record<string, string>[]): ParseResult => {
    const logs: string[] = [];
    logs.push(`Starting Schwab Realized Gain/Loss processing with ${rows.length} rows`);

    // Diagnostic: Show first row's keys
    if (rows.length > 0) {
        const firstRowKeys = Object.keys(rows[0]);
        logs.push(`Column names: ${firstRowKeys.slice(0, 10).join(', ')}...`);
    }

    const trades: Trade[] = [];

    // Skip header rows and total row (usually first and last)
    const dataRows = rows.filter((row) => {
        const symbol = safeGet(row, ['Symbol']);
        // Skip if symbol is empty, "Symbol" (header), or "Total" (summary)
        if (!symbol || symbol === 'Symbol' || symbol.toLowerCase() === 'total') {
            return false;
        }
        return true;
    });

    logs.push(`Found ${dataRows.length} valid trade rows (filtered from ${rows.length} total)`);

    logs.push(`🔍 DEBUG: Processing dataRows. First row keys: ${dataRows.length > 0 ? Object.keys(dataRows[0]).join(', ') : 'NONE'}`);
    if (dataRows.length > 0) {
        const firstRow = dataRows[0];
        logs.push(`🔍 First row sample: Symbol="${safeGet(firstRow, ['Symbol'])}", Gain/Loss="${safeGet(firstRow, ['Gain/Loss ($)', 'Total Gain/Loss ($)'])}"`);
    }

    dataRows.forEach((row) => {
        const symbol = safeGet(row, ['Symbol']);
        const name = safeGet(row, ['Name', 'Description']);
        const closedDate = safeGet(row, ['Closed Date', 'Transaction Closed Date']);
        // NEW: Try to get Opened Date from Details CSV format
        const openedDate = safeGet(row, ['Opened Date', 'Open Date', 'Opening Date']);
        const quantity = Math.abs(parseNumber(safeGet(row, ['Quantity', 'Qty'])));
        const proceeds = parseSchwabMoney(safeGet(row, ['Proceeds']));
        const costBasis = parseSchwabMoney(safeGet(row, ['Cost Basis (CB)', 'Cost Basis']));
        const totalGainLoss = parseSchwabMoney(safeGet(row, ['Total Gain/Loss ($)', 'Total Gain/Loss', 'Gain/Loss ($)']));
        if (totalGainLoss === 0 && safeGet(row, ['Total Gain/Loss ($)', 'Total Gain/Loss', 'Gain/Loss ($)'])) {
            // Debug: Why is P&L 0?
            console.warn(`[CSV Parse Warning] P&L is 0 for ${symbol}. Raw value: "${safeGet(row, ['Total Gain/Loss ($)', 'Total Gain/Loss', 'Gain/Loss ($)'])}"`);
        }
        const gainLossPercent = parseFloat(safeGet(row, ['Total Gain/Loss (%)', 'Total Gain/Loss Pct', 'Gain/Loss (%)']).replace('%', '')) || 0;

        // Detect if this is an options trade
        // Options have format like "ORCL 12/26/2025 202.50 C" or "SPY 11/26/2025 680.00 P"
        const isCall = symbol.endsWith(' C') || name.toLowerCase().includes('call');
        const isPut = symbol.endsWith(' P') || name.toLowerCase().includes('put');
        const isOption = isCall || isPut;

        // Determine trade type
        let tradeType: 'STOCK' | 'OPTION' = 'STOCK';
        if (isOption) {
            tradeType = 'OPTION';
        }

        // Calculate entry/exit prices
        // Priority 1: Use direct per-share columns (available in Details CSV)
        let entryPrice = parseSchwabMoney(safeGet(row, ['Cost Per Share', 'Average Cost', 'Price']));
        let exitPrice = parseSchwabMoney(safeGet(row, ['Proceeds Per Share', 'Average Price', 'Closing Price']));

        // Priority 2: Calculate from totals if per-share not found (Summary CSV)
        // For options, cost basis is per contract (100 shares), but quantity is in contracts
        if (entryPrice === 0 && quantity > 0) {
            const basis = costBasis / quantity;
            entryPrice = isOption ? basis / 100 : basis;
        }
        if (exitPrice === 0 && quantity > 0) {
            const totalProceeds = proceeds / quantity;
            exitPrice = isOption ? totalProceeds / 100 : totalProceeds;
        }

        // P&L is already calculated in the CSV - no need to recalculate
        const pnl = totalGainLoss;
        const pnlPercentage = gainLossPercent;

        // Determine direction based on option type
        // Calls = LONG (bullish bet), Puts = SHORT (bearish bet)
        let direction: 'LONG' | 'SHORT' = 'LONG';
        if (isPut) {
            direction = 'SHORT';
        }

        // Parse dates - use Opened Date if available (Details CSV), otherwise use Closed Date
        const exitDate = safeParseDateString(closedDate);
        const entryDate = openedDate ? safeParseDateString(openedDate) : exitDate;

        // Log if we're using Details format (has Opened Date)
        if (openedDate && !logs.some(l => l.includes('Details format detected'))) {
            logs.push('✅ Details format detected - using Opened Date and Closed Date');
        }

        // Create the trade
        trades.push({
            id: Math.random().toString(36).substr(2, 9),
            exchange: 'Schwab',
            ticker: symbol,
            type: tradeType,
            direction,
            entryPrice,
            exitPrice,
            quantity,
            entryDate, // Now uses Opened Date if available!
            exitDate,
            fees: 0, // Fees are already embedded in Schwab's P&L calculation - setting to 0 to avoid double-counting
            pnl,
            pnlPercentage,
            status: 'CLOSED',
            notes: isOption
                ? `${isCall ? 'CALL' : 'PUT'} Option - Imported from Schwab ${openedDate ? 'Details' : 'Summary'} CSV`
                : `Imported from Schwab ${openedDate ? 'Details' : 'Summary'} CSV`
        });
    });

    logs.push(`Generated ${trades.length} trades from Schwab Realized Gain/Loss CSV`);

    // Debug: Show date range of trades
    if (trades.length > 0) {
        const dates = trades.map(t => new Date(t.exitDate || t.entryDate)).sort((a, b) => a.getTime() - b.getTime());
        const earliest = dates[0].toISOString().split('T')[0];
        const latest = dates[dates.length - 1].toISOString().split('T')[0];
        logs.push(`📅 Trade date range: ${earliest} to ${latest}`);

        // Log a few recent trades for verification
        const recentTrades = trades.filter(t => {
            const exitDate = new Date(t.exitDate || t.entryDate);
            return exitDate.getFullYear() === 2026 && exitDate.getMonth() === 0; // January 2026
        });
        if (recentTrades.length > 0) {
            logs.push(`✅ Found ${recentTrades.length} January 2026 trades in CSV`);
        }
    }

    return { trades, logs };
};

// Schwab CSV FIFO Processor
const processSchwabRows = (rows: Record<string, string>[]): ParseResult => {
    const logs: string[] = [];
    logs.push(`Starting Schwab CSV processing with ${rows.length} rows`);

    // Diagnostic: Show first row's keys to debug column name issues
    if (rows.length > 0) {
        const firstRowKeys = Object.keys(rows[0]);
        logs.push(`Sample column names: ${firstRowKeys.join(', ')}`);
        logs.push(`First row Action: "${safeGet(rows[0], ['Action', 'Type'])}"`);
        logs.push(`First row Symbol: "${safeGet(rows[0], ['Symbol', 'Ticker', 'Security'])}"`);
    }

    // Filter to only Buy/Sell transactions (skip dividends, transfers, etc.)
    // Also filter out rows without symbols early to reduce processing
    const tradeRows = rows.filter(row => {
        const action = safeGet(row, ['Action', 'Type']).toLowerCase();
        const hasAction = action.includes('buy') || action.includes('sell') ||
            action.includes('short') || action.includes('cover');

        if (!hasAction) return false;

        // Early filter: Skip rows without symbol
        const symbol = safeGet(row, ['Symbol', 'Ticker', 'Security']);
        if (!symbol || symbol.trim() === '') return false;

        return true;
    });

    logs.push(`Found ${tradeRows.length} valid trade rows (filtered from ${rows.length} total)`);

    // Sort by date (oldest first for FIFO) - now sorting fewer items
    const sorted = [...tradeRows].sort((a, b) => {
        const dateA = new Date(safeGet(a, ['Date', 'Trade Date', 'Transaction Date']) || Date.now()).getTime();
        const dateB = new Date(safeGet(b, ['Date', 'Trade Date', 'Transaction Date']) || Date.now()).getTime();
        return dateA - dateB;
    });

    const trades: Trade[] = [];
    const openPositions: Record<string, { date: string; price: number; qty: number; direction: 'LONG' | 'SHORT'; fees: number }[]> = {};

    sorted.forEach((row) => {
        // Symbol is already validated in the filter step
        const symbol = safeGet(row, ['Symbol', 'Ticker', 'Security']);

        const action = safeGet(row, ['Action', 'Type']).toLowerCase();
        const dateStr = safeGet(row, ['Date', 'Trade Date', 'Transaction Date']);
        const date = safeParseDateString(dateStr);
        const price = parseNumber(safeGet(row, ['Price', 'Exec Price', 'Fill Price']));
        const qty = Math.abs(parseNumber(safeGet(row, ['Quantity', 'Qty', 'Shares'])));
        const fees = parseNumber(safeGet(row, ['Fees & Comm', 'Fee', 'Commission', 'Fees']));

        // Determine if opening or closing
        const isBuy = action.includes('buy') || action.includes('cover');
        const isSellShort = action.includes('short') && action.includes('sell');
        const isSell = action.includes('sell') && !isSellShort;

        // Determine direction
        let isOpening = false;
        let direction: 'LONG' | 'SHORT' = 'LONG';

        if (isBuy && !action.includes('cover')) {
            // Regular Buy - opens LONG
            isOpening = true;
            direction = 'LONG';
        } else if (isSellShort) {
            // Sell Short - opens SHORT
            isOpening = true;
            direction = 'SHORT';
        } else if (isSell) {
            // Regular Sell - closes LONG
            isOpening = false;
            direction = 'LONG';
        } else if (action.includes('cover')) {
            // Buy to Cover - closes SHORT
            isOpening = false;
            direction = 'SHORT';
        }

        if (isOpening) {
            // Add to open positions
            if (!openPositions[symbol]) openPositions[symbol] = [];
            openPositions[symbol].push({ date, price, qty, direction, fees });
        } else {
            // Try to match with open position (FIFO)
            const positions = openPositions[symbol] || [];
            let remainingQty = qty;

            while (remainingQty > 0 && positions.length > 0) {
                const openPos = positions[0];
                const matchQty = Math.min(remainingQty, openPos.qty);

                // Detect if this is an options trade (Schwab format: "AAPL 240119C00195000" or similar)
                // Options have a C (Call) or P (Put) followed by strike price
                const isOption = /\d{6}[CP]\d+/.test(symbol) || / [CP]\d/.test(symbol) ||
                    symbol.includes(' C ') || symbol.includes(' P ');
                const isCall = symbol.includes('C');

                // Each options contract controls 100 shares
                const multiplier = isOption ? 100 : 1;

                // Calculate P&L
                let pnl: number;
                if (openPos.direction === 'LONG') {
                    pnl = (price - openPos.price) * matchQty * multiplier;
                } else {
                    pnl = (openPos.price - price) * matchQty * multiplier;
                }

                const entryValue = openPos.price * matchQty * multiplier;
                const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

                // Determine type
                let tradeType: 'STOCK' | 'OPTION' = 'STOCK';
                if (isOption) {
                    tradeType = 'OPTION';
                }

                trades.push({
                    id: Math.random().toString(36).substr(2, 9),
                    exchange: 'Schwab',
                    ticker: symbol,
                    type: tradeType,
                    direction: openPos.direction,
                    entryPrice: openPos.price,
                    exitPrice: price,
                    quantity: matchQty,
                    entryDate: openPos.date,
                    exitDate: date,
                    fees: fees + openPos.fees,
                    pnl,
                    pnlPercentage,
                    status: 'CLOSED',
                    notes: isOption
                        ? `${isCall ? 'CALL' : 'PUT'} Option - Imported from Schwab CSV (FIFO matched, 100x multiplier applied)`
                        : 'Imported from Schwab CSV (FIFO matched)'
                });

                // Update remaining quantities
                remainingQty -= matchQty;
                openPos.qty -= matchQty;

                // Remove fully matched position
                if (openPos.qty <= 0) {
                    positions.shift();
                }
            }

            if (remainingQty > 0) {
                logs.push(`Warning: ${symbol} - ${remainingQty} shares sold without matching open position`);
            }
        }
    });

    // Report any unclosed positions
    Object.entries(openPositions).forEach(([symbol, positions]) => {
        const totalOpen = positions.reduce((sum, p) => sum + p.qty, 0);
        if (totalOpen > 0) {
            logs.push(`Open position: ${symbol} - ${totalOpen} shares still held`);
        }
    });

    logs.push(`Generated ${trades.length} closed trades from Schwab CSV`);
    return { trades: trades.reverse(), logs };
};

// HeroFX CSV Processor - Forex broker
// Supports two formats:
// 1. Complete Trading History (PREFERRED) - Each row is a complete closed trade
//    Columns: Instrument, Entry Time (EET), Type, Side, Amount, Entry Price, SL Price, TP Price, 
//             Exit Time (EET), Exit Price, Fee, Swap, P&L, Net P&L, Order ID, Position ID
// 2. Transactions format - Open/Close as separate rows matched by Position ID
const processHeroFXRows = (rows: Record<string, string>[]): ParseResult => {
    const logs: string[] = [];
    logs.push(`Starting HeroFX CSV processing with ${rows.length} rows`);

    // Diagnostic: Show first row's keys
    if (rows.length > 0) {
        const firstRowKeys = Object.keys(rows[0]);
        logs.push(`Column names: ${firstRowKeys.join(', ')}`);
    }

    // Auto-detect format based on column presence
    const hasEntryTime = rows.length > 0 && safeGet(rows[0], ['Entry Time (EET)', 'Entry Time']) !== '';
    const hasExitTime = rows.length > 0 && safeGet(rows[0], ['Exit Time (EET)', 'Exit Time']) !== '';
    const hasEntryPrice = rows.length > 0 && safeGet(rows[0], ['Entry Price']) !== '';
    const hasExitPrice = rows.length > 0 && safeGet(rows[0], ['Exit Price']) !== '';

    const isCompleteHistoryFormat = hasEntryTime && hasExitTime && hasEntryPrice && hasExitPrice;

    if (isCompleteHistoryFormat) {
        logs.push('Detected Complete Trading History format (preferred)');
        return processHeroFXCompleteHistory(rows, logs);
    } else {
        logs.push('Detected Transactions format - using Position ID matching');
        return processHeroFXTransactions(rows, logs);
    }
};

// Process Complete Trading History format (PREFERRED)
// Each row is already a complete closed trade with all data
const processHeroFXCompleteHistory = (rows: Record<string, string>[], logs: string[]): ParseResult => {
    const trades: Trade[] = [];
    let skipped = 0;

    rows.forEach((row) => {
        const instrument = safeGet(row, ['Instrument', 'Symbol', 'Pair']);
        if (!instrument) {
            skipped++;
            return;
        }

        // Parse entry and exit times
        const entryTimeStr = safeGet(row, ['Entry Time (EET)', 'Entry Time']);
        const exitTimeStr = safeGet(row, ['Exit Time (EET)', 'Exit Time']);
        const entryDate = parseHeroFXDate(entryTimeStr);
        const exitDate = parseHeroFXDate(exitTimeStr);

        // Parse prices (may have commas in large numbers like "4,549.92")
        const entryPrice = parseHeroFXPrice(safeGet(row, ['Entry Price']));
        const exitPrice = parseHeroFXPrice(safeGet(row, ['Exit Price']));
        const slPrice = parseHeroFXPrice(safeGet(row, ['SL Price']));
        const tpPrice = parseHeroFXPrice(safeGet(row, ['TP Price']));

        // Parse amounts and P&L
        const amount = parseNumber(safeGet(row, ['Amount', 'Quantity', 'Lots']));
        const fee = Math.abs(parseHeroFXMoney(safeGet(row, ['Fee', 'Commission'])));
        const swap = parseHeroFXMoney(safeGet(row, ['Swap']));
        const grossPnl = parseHeroFXMoney(safeGet(row, ['P&L', 'PnL', 'Profit']));
        const netPnl = parseHeroFXMoney(safeGet(row, ['Net P&L', 'Net PnL', 'Net Profit']));

        // Use Net P&L if available, otherwise use gross P&L
        const pnl = netPnl !== 0 ? netPnl : grossPnl;

        // Total fees = commission + swap (swap can be negative or positive)
        const totalFees = fee + Math.abs(swap);

        // Determine direction from Side
        const side = safeGet(row, ['Side', 'Direction']).toUpperCase();
        const direction: 'LONG' | 'SHORT' = (side === 'BUY' || side === 'LONG') ? 'LONG' : 'SHORT';

        // Get trade type (Market, Stop loss, Trailing Stop Loss, Stop Out, etc.)
        const tradeType = safeGet(row, ['Type', 'Order Type']);
        const positionId = safeGet(row, ['Position ID', 'PositionID']);

        // Calculate P&L percentage based on entry value
        const entryValue = entryPrice * amount;
        const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

        // Determine asset type based on instrument
        let assetType: 'FOREX' | 'CRYPTO' | 'STOCK' = 'FOREX';
        if (instrument.includes('BTC') || instrument.includes('ETH') || instrument.includes('CRYPTO')) {
            assetType = 'CRYPTO';
        } else if (instrument.includes('SPX') || instrument.includes('NAS') || instrument.includes('.PRO')) {
            assetType = 'STOCK'; // Index CFDs treated as stocks
        }

        // Build notes with trade details
        const notesParts: string[] = [];
        if (tradeType) notesParts.push(`Exit: ${tradeType}`);
        if (slPrice > 0) notesParts.push(`SL: ${slPrice}`);
        if (tpPrice > 0) notesParts.push(`TP: ${tpPrice}`);
        if (swap !== 0) notesParts.push(`Swap: $${swap.toFixed(2)}`);
        notesParts.push(`Position: ${positionId}`);

        trades.push({
            id: Math.random().toString(36).substr(2, 9),
            exchange: 'HeroFX',
            ticker: instrument,
            type: assetType,
            direction,
            entryPrice,
            exitPrice,
            quantity: amount,
            entryDate: entryDate.toISOString(),
            exitDate: exitDate.toISOString(),
            fees: totalFees,
            pnl,
            pnlPercentage,
            status: 'CLOSED',
            notes: notesParts.join(' | ')
        });
    });

    // Sort trades by exit date (newest first)
    trades.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());

    logs.push(`Processed ${trades.length} trades, skipped ${skipped} rows`);
    logs.push(`Generated ${trades.length} completed trades from HeroFX Complete History`);
    return { trades, logs };
};

// Process Transactions format (fallback for older export format)
// Open/Close as separate rows matched by Position ID
const processHeroFXTransactions = (rows: Record<string, string>[], logs: string[]): ParseResult => {
    const trades: Trade[] = [];

    // Group rows by Position ID for matching
    const positionMap: Record<string, Record<string, string>[]> = {};

    rows.forEach((row) => {
        const positionId = safeGet(row, ['Position ID', 'PositionID', 'position_id']);
        if (!positionId) {
            return;
        }

        if (!positionMap[positionId]) {
            positionMap[positionId] = [];
        }
        positionMap[positionId].push(row);
    });

    logs.push(`Found ${Object.keys(positionMap).length} unique positions`);

    // Process each position
    Object.entries(positionMap).forEach(([positionId, positionRows]) => {
        // Sort by time (oldest first)
        const sorted = [...positionRows].sort((a, b) => {
            const dateA = parseHeroFXDate(safeGet(a, ['Time (EET)', 'Time', 'Date']));
            const dateB = parseHeroFXDate(safeGet(b, ['Time (EET)', 'Time', 'Date']));
            return dateA.getTime() - dateB.getTime();
        });

        // Find the opening trade (P&L = $0.00, usually first BUY)
        // and closing trade (P&L != $0.00, usually last SELL)
        let openRow: Record<string, string> | null = null;
        let closeRow: Record<string, string> | null = null;

        sorted.forEach(row => {
            const pnl = parseHeroFXMoney(safeGet(row, ['P&L', 'PnL', 'Profit']));
            const side = safeGet(row, ['Side', 'Direction', 'Type']).toUpperCase();

            if (pnl === 0 && (side === 'BUY' || side === 'LONG')) {
                if (!openRow) openRow = row;
            } else if (pnl !== 0) {
                closeRow = row;
            }
        });

        // If we have both open and close, create a complete trade
        if (openRow && closeRow) {
            const instrument = safeGet(openRow, ['Instrument', 'Symbol', 'Pair', 'Market']);
            const amount = parseNumber(safeGet(openRow, ['Amount', 'Quantity', 'Qty', 'Lots']));
            const entryPrice = parseNumber(safeGet(openRow, ['Price', 'Entry Price', 'Open Price']));
            const exitPrice = parseNumber(safeGet(closeRow, ['Price', 'Exit Price', 'Close Price']));
            const pnl = parseHeroFXMoney(safeGet(closeRow, ['P&L', 'PnL', 'Profit']));
            const entryFee = Math.abs(parseHeroFXMoney(safeGet(openRow, ['Fee', 'Commission'])));
            const exitFee = Math.abs(parseHeroFXMoney(safeGet(closeRow, ['Fee', 'Commission'])));
            const totalFees = entryFee + exitFee;

            const entryDateStr = safeGet(openRow, ['Time (EET)', 'Time', 'Date']);
            const exitDateStr = safeGet(closeRow, ['Time (EET)', 'Time', 'Date']);
            const entryDate = parseHeroFXDate(entryDateStr);
            const exitDate = parseHeroFXDate(exitDateStr);

            const openSide = safeGet(openRow, ['Side', 'Direction', 'Type']).toUpperCase();
            const direction: 'LONG' | 'SHORT' = (openSide === 'BUY' || openSide === 'LONG') ? 'LONG' : 'SHORT';

            const entryValue = entryPrice * amount;
            const pnlPercentage = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

            trades.push({
                id: Math.random().toString(36).substr(2, 9),
                exchange: 'HeroFX',
                ticker: instrument,
                type: 'FOREX',
                direction,
                entryPrice,
                exitPrice,
                quantity: amount,
                entryDate: entryDate.toISOString(),
                exitDate: exitDate.toISOString(),
                fees: totalFees,
                pnl,
                pnlPercentage,
                status: 'CLOSED',
                notes: `Position ID: ${positionId} - Imported from HeroFX Transactions`
            });
        } else if (openRow && !closeRow) {
            logs.push(`Position ${positionId}: Still open`);
        } else if (!openRow && closeRow) {
            logs.push(`Position ${positionId}: Missing open trade`);
        }
    });

    trades.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());

    logs.push(`Generated ${trades.length} completed trades from HeroFX Transactions`);
    return { trades, logs };
};

// Parse HeroFX date format: "YYYY/MM/DD HH:mm:ss" (EET timezone)
// Uses Europe/Helsinki timezone which observes EET/EEST with proper DST handling
const parseHeroFXDate = (dateStr: string): Date => {
    if (!dateStr || dateStr.trim() === '') {
        return new Date();
    }

    // HeroFX uses YYYY/MM/DD HH:mm:ss format in EET timezone
    const normalized = dateStr.replace(/\//g, '-').trim();

    try {
        // fromZonedTime converts a date string from a specific timezone to UTC
        // Europe/Helsinki uses EET (UTC+2) in winter and EEST (UTC+3) in summer
        const utcDate = fromZonedTime(normalized, 'Europe/Helsinki');

        if (isNaN(utcDate.getTime())) {
            console.warn(`HeroFX: Could not parse date: "${dateStr}"`);
            return new Date();
        }

        return utcDate;
    } catch (e) {
        console.warn(`HeroFX: Error parsing date "${dateStr}":`, e);
        return new Date();
    }
};

// Parse HeroFX money format: "$123.45" or "-$45.67" or "$0.00"
const parseHeroFXMoney = (value: string): number => {
    if (!value) return 0;
    // Remove $ sign and parse, keeping negative sign
    const clean = value.replace(/[$,]/g, '').trim();
    return parseFloat(clean) || 0;
};

// Parse HeroFX price format: handles commas in numbers like "4,549.92"
const parseHeroFXPrice = (value: string): number => {
    if (!value || value === '-') return 0;
    // Remove commas, quotes, and parse
    const clean = value.replace(/[",]/g, '').trim();
    return parseFloat(clean) || 0;
};

const mapRowToTrade = (row: Record<string, string>, exchange: ExchangeName): Partial<Trade> | null => {
    // Boilerplate mapping for simple exchanges, not aggregation
    try {
        const id = Math.random().toString(36).substr(2, 9);
        switch (exchange) {
            case 'Binance':
                if (!row['Pair'] && !row['Symbol'] && !row['Side']) return mapRowToGeneric(row, exchange);
                return {
                    id, exchange: 'Binance', ticker: row['Pair'] || row['Symbol'], type: 'CRYPTO',
                    direction: row['Side']?.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT',
                    entryPrice: parseNumber(row['Price']), exitPrice: parseNumber(row['Price']),
                    quantity: parseNumber(row['Executed'] || row['Amount']),
                    entryDate: new Date(row['Date(UTC)'] || Date.now()).toISOString(),
                    exitDate: new Date(row['Date(UTC)'] || Date.now()).toISOString(),
                    fees: parseNumber(row['Fee']), pnl: parseNumber(row['Realized Profit']),
                    pnlPercentage: parseNumber(row['Realized Profit']) / (parseNumber(row['Price']) * parseNumber(row['Executed'] || row['Amount']) || 1) * 100,
                    status: 'CLOSED'
                };
            case 'Coinbase':
                return {
                    id, exchange: 'Coinbase', ticker: row['Asset'], type: 'CRYPTO',
                    direction: row['Transaction Type'] === 'Buy' ? 'LONG' : 'SHORT',
                    entryPrice: parseNumber(row['Spot Price at Transaction']), exitPrice: parseNumber(row['Spot Price at Transaction']),
                    quantity: parseNumber(row['Quantity Transacted']),
                    entryDate: new Date(row['Timestamp'] || Date.now()).toISOString(),
                    exitDate: new Date(row['Timestamp'] || Date.now()).toISOString(),
                    fees: parseNumber(row['Fees']), pnl: 0, pnlPercentage: 0, status: 'CLOSED'
                };
            default:
                return mapRowToGeneric(row, exchange);
        }
    } catch (e) {
        console.error("Error parsing row", row, e);
        return null;
    }
};

interface ColumnMapping {
    time: string[];
    symbol: string[];
    price: string[];
    qty: string[];
    pnl: string[];
    fee: string[];
    direction: string[];
}

interface OpenPositionEntry {
    time: string;
    price: number;
    qty: number;
    direction: 'LONG' | 'SHORT';
    fees: number;
}

const processAggregatedRows = (rows: Record<string, string>[], exchangeName: string, map: ColumnMapping): ParseResult => {
    const logs: string[] = [];
    // Sort oldest first
    const sortedRows = [...rows].sort((a, b) => {
        const dateA = new Date(safeGet(a, map.time) || Date.now()).getTime();
        const dateB = new Date(safeGet(b, map.time) || Date.now()).getTime();
        return dateA - dateB;
    });

    const trades: Trade[] = [];
    const openPositions: Record<string, OpenPositionEntry[]> = {};
    let processedCount = 0;
    let symbolMissingCount = 0;

    sortedRows.forEach((row, index) => {
        const symbol = safeGet(row, map.symbol);
        if (!symbol) {
            symbolMissingCount++;
            if (symbolMissingCount < 5) logs.push(`Row ${index}: Skipped due to missing symbol. Keys found: ${Object.keys(row).join(',')}`);
            return;
        }

        processedCount++;
        const rowPnl = parseNumber(safeGet(row, map.pnl));
        const qty = Math.abs(parseNumber(safeGet(row, map.qty)));
        const price = parseNumber(safeGet(row, map.price));
        const time = new Date(safeGet(row, map.time) || Date.now()).toISOString();

        // Determine Direction
        const rawDir = safeGet(row, map.direction).toLowerCase();
        let direction: 'LONG' | 'SHORT' = 'LONG';
        if (rawDir.includes('short') || rawDir.includes('sell')) direction = 'SHORT';

        // Auto-Netting Logic
        let isClose = false;

        if (openPositions[symbol] && openPositions[symbol].length > 0) {
            const holdingDir = openPositions[symbol][0].direction;

            // Explicit PnL > 0 (Closed P&L file)
            if (rowPnl !== 0) {
                isClose = true;
            }
            // OR Opposing side (Trade History file)
            else if (holdingDir !== direction) {
                isClose = true;
            }
        }

        if (isClose) {
            // Find Match
            let matchIndex = openPositions[symbol].findIndex(pos => Math.abs(pos.qty - qty) < 0.0001);
            if (matchIndex === -1) matchIndex = 0; // standard FIFO

            const openRow = openPositions[symbol][matchIndex];
            openPositions[symbol].splice(matchIndex, 1);

            // Calculate PnL if not provided
            let finalPnl = rowPnl;
            if (finalPnl === 0) {
                // Formula: (Exit - Entry) * Qty * Sign
                // For LONG: (Price - OpenPrice) * Qty
                // For SHORT: (OpenPrice - Price) * Qty
                if (openRow.direction === 'LONG') {
                    finalPnl = (price - openRow.price) * qty;
                } else {
                    finalPnl = (openRow.price - price) * qty;
                }
            }

            // Sanity check for massive outliers? No, let raw data speak.
            const entryValue = openRow.price * qty;
            const pnlPercentage = entryValue > 0 ? (finalPnl / entryValue) * 100 : 0;

            trades.push({
                id: Math.random().toString(36).substr(2, 9),
                exchange: exchangeName as ExchangeName,
                ticker: symbol,
                type: 'CRYPTO',
                direction: openRow.direction,
                entryPrice: openRow.price,
                exitPrice: price,
                quantity: qty,
                entryDate: openRow.time,
                exitDate: time,
                fees: parseNumber(safeGet(row, map.fee)) + (openRow.fees || 0),
                pnl: finalPnl,
                pnlPercentage: pnlPercentage,
                status: 'CLOSED',
                notes: `Auto-Aggregated via FIFO (${rowPnl === 0 ? 'Calc PnL' : 'Imported PnL'})`
            });
        } else {
            // OPEN
            if (!openPositions[symbol]) openPositions[symbol] = [];
            openPositions[symbol].push({
                time, price, qty, direction,
                fees: parseNumber(safeGet(row, map.fee))
            });
        }
    });

    logs.push(`Processed ${processedCount} valid rows. Skipped ${symbolMissingCount} due to missing symbol.`);
    logs.push(`Generated ${trades.length} trades.`);
    return { trades: trades.reverse(), logs };
};

const detectColumnMapping = (headers: string[]): ColumnMapping => {
    const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dictionary: Record<keyof ColumnMapping, string[]> = {
        time: ['transactiontime', 'createtime', 'tradetime', 'timeutc', 'dateutc', 'time', 'date', 'datetime', 'timestamp'],
        symbol: ['futurestradingpair', 'contracts', 'symbol', 'pair', 'instrument', 'ticker', 'market', 'product', 'contract'],
        price: ['averagefilledprice', 'execprice', 'fillprice', 'avgprice', 'price', 'entryprice', 'spotprice', 'avgentryprice', 'filledprice'],
        qty: ['filledqtycrypto', 'execqty', 'filledqty', 'qty', 'amount', 'size', 'quantity', 'vol', 'volume', 'executed', 'filledquantity'],
        pnl: ['realizedpl', 'closedpl', 'pl', 'pnl', 'profit', 'realizedprofit', 'realizedpnl', 'netprofit', 'grossprofit', 'closedpnl'],
        fee: ['tradingfee', 'execfee', 'fee', 'commission', 'tradingcommission', 'fees', 'transactionfee'],
        direction: ['direction', 'side', 'type', 'action', 'buysell']
    };

    const map: ColumnMapping = { time: [], symbol: [], price: [], qty: [], pnl: [], fee: [], direction: [] };
    const normalizedHeaders = headers.map(h => ({ original: h, norm: normalize(h) }));

    for (const [field, synonyms] of Object.entries(dictionary)) {
        let match = '';
        for (const synonym of synonyms) {
            const exact = normalizedHeaders.find(h => h.norm === synonym);
            if (exact) { match = exact.original; break; }
            const partial = normalizedHeaders.find(h => h.norm.includes(synonym));
            if (partial) { match = partial.original; break; }
        }
        map[field as keyof ColumnMapping] = match ? [match] : [];
    }
    return map;
};

export const parseCSV = (file: File, exchange: ExchangeName): Promise<ParseResult> => {
    console.log(`[parseCSV] 🚨 STARTING PARSE with exchange="${exchange}", file="${file.name}"`);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) { reject(new Error('Empty file')); return; }
            const lines = text.split('\n');
            let headerRowIndex = 0;
            const debugLogs: string[] = [];

            // Relaxed Header Detection
            for (let i = 0; i < Math.min(lines.length, 25); i++) {
                const line = lines[i].toLowerCase();
                let matches = 0;
                ['contracts', 'symbol', 'pair', 'price', 'qty', 'amount', 'time', 'date', 'pnl', 'market'].forEach(k => {
                    if (line.includes(k)) matches++;
                });
                if (matches >= 2) {
                    headerRowIndex = i;
                    debugLogs.push(`Detected header at row ${i}: ${lines[i]}`);
                    break;
                }
            }

            const cleanText = lines.slice(headerRowIndex).join('\n');

            debugLogs.push(`Processing ${lines.length} lines`);

            Papa.parse(cleanText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    debugLogs.push(`Parsed ${results.data.length} rows.`);
                    debugLogs.push(`Headers found: ${JSON.stringify(results.meta.fields)}`);

                    // CRITICAL FIX: Normalize data to strip quotes from headers
                    // Some CSVs (especially Schwab) have headers like "Date","Action" with literal quotes
                    const normalizedData = results.data.map((row: unknown) => {
                        const cleanRow: Record<string, string> = {};
                        const rowRecord = row as Record<string, string>;
                        Object.keys(rowRecord).forEach(key => {
                            // Strip surrounding quotes from key names
                            const cleanKey = key.replace(/^["']|["']$/g, '').trim();
                            cleanRow[cleanKey] = rowRecord[key];
                        });
                        return cleanRow;
                    });

                    debugLogs.push(`Normalized ${normalizedData.length} rows with clean headers`);

                    if (exchange === 'MEXC' || exchange === 'ByBit') {
                        const map = detectColumnMapping(results.meta.fields || []);
                        debugLogs.push(`Mapped Columns: ${JSON.stringify(map)}`);

                        if (map.symbol.length === 0) {
                            debugLogs.push("Automatic mapping failed for Symbol. Attempting fallback.");
                            map.symbol = ['Contracts', 'Symbol', 'Pair', 'Market'];
                            map.price = ['Exec Price', 'Price', 'Filled Price'];
                            map.qty = ['Exec Qty', 'Qty', 'Filled Quantity'];
                            map.time = ['Transaction Time', 'Time(UTC)', 'Time.'];
                            map.pnl = ['Closed P&L', 'P&L'];
                            map.direction = ['Side', 'Direction'];
                        }

                        const result = processAggregatedRows(normalizedData, exchange, map);
                        resolve({
                            trades: result.trades,
                            logs: [...debugLogs, ...result.logs]
                        });
                    } else if (exchange === 'Schwab') {
                        console.log('[parseCSV] ✅ Entering Schwab branch');
                        debugLogs.push('✅ Exchange is Schwab - entering Schwab parsing logic');
                        // Auto-detect format: Realized Gain/Loss vs Transactions
                        const headers = results.meta.fields || [];
                        const cleanHeaders = headers.map((h: string) => h.replace(/['"]/g, '').toLowerCase());
                        console.log('[parseCSV] Headers:', cleanHeaders.slice(0, 5));

                        // Check for Realized Gain/Loss format (has Total Gain/Loss column)
                        const isRealizedGains = cleanHeaders.some((h: string) =>
                            h.includes('total gain/loss') || h.includes('cost basis') || h.includes('proceeds') || h.includes('gain/loss')
                        );
                        console.log('[parseCSV] isRealizedGains:', isRealizedGains);

                        if (isRealizedGains) {
                            debugLogs.push('Detected Schwab Realized Gain/Loss format (preferred)');
                            const result = processSchwabRealizedGains(normalizedData);
                            resolve({
                                trades: result.trades,
                                logs: [...debugLogs, ...result.logs]
                            });
                        } else {
                            debugLogs.push('Detected Schwab Transactions format - using FIFO matching');
                            const result = processSchwabRows(normalizedData);
                            resolve({
                                trades: result.trades,
                                logs: [...debugLogs, ...result.logs]
                            });
                        }
                    } else if (exchange === 'HeroFX') {
                        debugLogs.push('Processing HeroFX Forex trades');
                        const result = processHeroFXRows(normalizedData);
                        resolve({
                            trades: result.trades,
                            logs: [...debugLogs, ...result.logs]
                        });
                    } else {
                        const trades: Trade[] = [];
                        let skipped = 0;
                        results.data.forEach((row: unknown) => {
                            const tradePart = mapRowToTrade(row as Record<string, string>, exchange);
                            if (tradePart && tradePart.ticker && tradePart.ticker !== 'UNKNOWN') {
                                trades.push(tradePart as Trade);
                            } else {
                                skipped++;
                            }
                        });
                        debugLogs.push(`Mapped ${trades.length} generic trades. Skipped ${skipped}.`);
                        resolve({ trades, logs: debugLogs });
                    }
                },
                error: (error: Error) => reject(error)
            });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
};
