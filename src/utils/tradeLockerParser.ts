import type { Trade } from '../types';

interface ParseResult {
    trades: Trade[];
    logs: string[];
}

/**
 * Parse TradeLocker/HeroFX paste data
 * Handles multi-line SL/TP values by pre-processing and merging broken rows
 */
export const parseTradeLockerPaste = (text: string): ParseResult => {
    const logs: string[] = [];
    const trades: Trade[] = [];

    try {
        const rawLines = text.split('\n');

        // Pre-process: identify and merge multi-line rows
        const mergedLines: string[] = [];
        let i = 0;

        while (i < rawLines.length) {
            let line = rawLines[i];

            // Skip pure metadata lines (no tabs, not a number)
            if (!line.includes('\t') && !/^[\d.,\-]+$/.test(line.trim()) && line.trim()) {
                mergedLines.push(line);
                i++;
                continue;
            }

            // Look ahead: if current line has tabs AND next line is a pure number, merge them
            while (i + 1 < rawLines.length) {
                const nextLine = rawLines[i + 1].trim();

                // Check if next line is a standalone number (SL or TP value)
                if (nextLine && /^[\d.,\-]+$/.test(nextLine) && nextLine.length < 20) {
                    // Add with tab separator (unless line already ends with tab)
                    line += (line.endsWith('\t') ? '' : '\t') + nextLine;
                    logs.push(`Merged: ${nextLine}`);
                    i++; // Skip the merged line
                } else if (nextLine && nextLine.includes('\t')) {
                    // Next line has tabs - it's the continuation with rest of data
                    line += (line.endsWith('\t') ? '' : '\t') + nextLine;
                    logs.push(`Merged continuation`);
                    i++;
                    break; // Done merging this row
                } else {
                    // Next line is something else, stop merging
                    break;
                }
            }

            if (line !== rawLines[i]) {
                // Line was modified by merging
                const colCount = (line.match(/\t/g) || []).length + 1;
                logs.push(`→ Merged line has ${colCount} columns`);
            }

            mergedLines.push(line);
            i++;
        }

        logs.push(`Pre-processed ${rawLines.length} → ${mergedLines.length} lines`);

        // Find header
        let headerIdx = -1;
        for (let j = 0; j < mergedLines.length; j++) {
            if (mergedLines[j].includes('Entry Time') && mergedLines[j].includes('Exit Time')) {
                headerIdx = j;
                break;
            }
        }

        if (headerIdx === -1) {
            logs.push('ERROR: No header found');
            return { trades, logs };
        }

        const headers = mergedLines[headerIdx].split('\t');
        logs.push(`Headers (${headers.length} cols)`);

        // Parse helpers
        const parseNum = (str: string): number => {
            if (!str || str === '-' || str.trim() === '') return 0;
            const cleaned = str.replace(/[$,]/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };

        const parseDate = (str: string): string => {
            if (!str || str === '-') return new Date().toISOString();
            try {
                const normalized = str.trim().replace(/\//g, '-');
                const date = new Date(normalized);
                return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
            } catch {
                return new Date().toISOString();
            }
        };

        // Process data rows
        let currentInstrument = '';
        let rowIdx = headerIdx + 1;

        while (rowIdx < mergedLines.length) {
            const line = mergedLines[rowIdx].trim();

            // Skip metadata
            if (!line ||
                line.toLowerCase().includes('actions') ||
                line.toLowerCase().includes('currency') ||
                line.toLowerCase().includes('flag')) {
                rowIdx++;
                continue;
            }

            // Instrument name
            if (!line.includes('\t') && /^[A-Z]{5,10}$/.test(line)) {
                currentInstrument = line;
                logs.push(`Instrument: ${currentInstrument}`);
                rowIdx++;
                continue;
            }

            // Data row
            const cols = mergedLines[rowIdx].split('\t');

            if (cols.length < 10) {
                logs.push(`Row ${rowIdx}: Skipped (${cols.length} cols)`);
                rowIdx++;
                continue;
            }

            try {
                let colIdx = 0;

                const instrument = currentInstrument;
                const entryTime = cols[colIdx++]?.trim() || '';
                const type = cols[colIdx++]?.trim() || '';
                const side = cols[colIdx++]?.trim() || '';
                const amount = parseNum(cols[colIdx++] || '0');
                const entryPrice = parseNum(cols[colIdx++] || '0');
                colIdx++; // SL Price
                colIdx++; // TP Price
                const exitTime = cols[colIdx++]?.trim() || '';
                const exitPrice = parseNum(cols[colIdx++] || '0');
                const fee = parseNum(cols[colIdx++] || '0');
                const swap = parseNum(cols[colIdx++] || '0');
                const pnl = parseNum(cols[colIdx++] || '0');
                const netPnl = parseNum(cols[colIdx++] || '0');

                logs.push(`${instrument} Entry=$${entryPrice.toFixed(2)} Exit=$${exitPrice.toFixed(2)} P&L=$${netPnl.toFixed(2)}`);

                if (!instrument) {
                    rowIdx++;
                    continue;
                }

                // Validation: reject if prices are invalid
                if (entryPrice <= 0 || exitPrice <= 0 || entryPrice > 1000000 || exitPrice > 1000000) {
                    logs.push(`→ Invalid prices, skipped`);
                    rowIdx++;
                    continue;
                }

                const direction = side.toLowerCase().includes('buy') ? 'LONG' : 'SHORT';
                const finalPnl = netPnl !== 0 ? netPnl : pnl;

                // Calculate ROI based on margin (with 100x leverage)
                // Contract sizes: XAGUSD = 5000 oz, XAUUSD = 100 oz, other = 100
                let contractSize = 100;
                if (instrument.includes('XAG')) {
                    contractSize = 5000; // Silver
                } else if (instrument.includes('XAU')) {
                    contractSize = 100; // Gold
                }

                const leverage = 100;
                const exposure = Math.abs(entryPrice * amount * contractSize);
                const margin = exposure / leverage;
                const pnlPercentage = margin > 0 ? (finalPnl / margin) * 100 : 0;

                const trade: Trade = {
                    id: `herofx-${Date.now()}-${trades.length}`,
                    exchange: 'HeroFX',
                    ticker: instrument,
                    type: 'FOREX',
                    direction: direction,
                    entryPrice: entryPrice,
                    exitPrice: exitPrice,
                    quantity: amount,
                    entryDate: parseDate(entryTime),
                    exitDate: parseDate(exitTime || entryTime),
                    fees: Math.abs(fee),
                    pnl: finalPnl,
                    pnlPercentage: pnlPercentage,
                    status: 'CLOSED',
                    notes: `${type}${swap !== 0 ? ` | Swap: $${swap.toFixed(2)}` : ''}`
                };

                trades.push(trade);
                logs.push(`✓ ${instrument} ${direction} P&L:$${finalPnl.toFixed(2)}`);

            } catch (err: any) {
                logs.push(`Row ${rowIdx}: ERROR - ${err.message}`);
            }

            rowIdx++;
        }

        logs.push(`=== ${trades.length} trade(s) imported ===`);
        return { trades, logs };

    } catch (err: any) {
        logs.push(`FATAL: ${err.message}`);
        return { trades, logs };
    }
};
