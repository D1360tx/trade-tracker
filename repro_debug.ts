
import { parseCSV } from './src/utils/csvParsers';

// Mock row based on USER SCREENSHOT
// Headers: Time, Futures Trading Pair, Direction, ...
const rowSellLong = {
    'Time': '2025-12-21 19:52:22',
    'Futures Trading Pair': 'SOLUSDT',
    'Direction': 'sell long',
    'Price': '100',
    'Filled Qty (Crypto)': '1'
};

const rowBuyLong = {
    'Time': '2025-12-21 19:31:59',
    'Futures Trading Pair': 'SOLUSDT',
    'Direction': 'buy long',
    'Price': '100',
    'Filled Qty (Crypto)': '1'
};

const rowSellShort = {
    'Time': '2025-12-24 10:14:44',
    'Futures Trading Pair': 'ZECUSDT',
    'Direction': 'sell short',
    'Price': '100',
    'Filled Qty (Crypto)': '1'
};

// Simulation of the Generic Helper Function currently in csvParsers.ts
const parseNumber = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, ''));
};

const mapRowToGeneric = (row: any) => {
    const sideRaw = (row['Side'] || row['Action'] || row['Type'] || row['Direction'] || '').toUpperCase();

    console.log(`[DEBUG] Raw Side: "${sideRaw}"`);

    let isLong = sideRaw.includes('BUY') || sideRaw.includes('LONG');

    // Explicit override for short
    if (sideRaw.includes('SHORT')) {
        isLong = false;
    } else if (sideRaw.includes('LONG')) {
        isLong = true;
    }

    return isLong ? 'LONG' : 'SHORT';
};

console.log("--- Testing Logic ---");
console.log(`Input: 'sell long' -> Parsed: ${mapRowToGeneric(rowSellLong)} (Expected: LONG)`);
console.log(`Input: 'buy long'  -> Parsed: ${mapRowToGeneric(rowBuyLong)} (Expected: LONG)`);
console.log(`Input: 'sell short' -> Parsed: ${mapRowToGeneric(rowSellShort)} (Expected: SHORT)`);
