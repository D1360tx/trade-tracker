# Demo Data Generator

## Overview

The Demo Data Generator creates realistic trading data for the demo account (`demo@tradetracker.app`) based on actual Schwab CSV structure and real trading patterns.

## Features

### Supported Exchanges

1. **Schwab** - Options & Stocks
   - SPX/SPXW index options
   - Individual stock options (NVDA, AMD, TSLA, etc.)
   - Stock trades
   - Realistic option pricing and expiration dates
   - Formatted exactly like Schwab CSV exports

2. **MEXC** - Crypto Futures
   - BTC, ETH, SOL, BNB, ADA, DOGE, AVAX, LINK
   - Leverage: 5x to 20x
   - Short holding periods (15 min to 8 hours)
   - Realistic futures fees (0.06% taker)

3. **HeroFX/TradeLocker** - Forex
   - XAUUSD (Gold), EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD
   - Lot sizes: 0.01 to 1.0
   - Pip-based P&L calculations
   - Spread costs included

## Usage

### In the UI

When logged in as `demo@tradetracker.app`, visit the **Import** page to see the Demo Data Generator panel.

#### Quick Presets:

1. **Complete Portfolio** (~220 trades)
   - 120 Schwab options trades
   - 60 MEXC futures trades
   - 40 HeroFX forex trades
   - Covers ~6 months of trading

2. **Profitable Trader** (150 trades)
   - 58% win rate
   - +$3,000 to +$8,000 P&L
   - 80% options, 20% stocks

3. **Learning Trader** (80 trades)
   - 48% win rate
   - ~breakeven P&L
   - 70% options, 30% stocks

4. **Aggressive Options** (200 trades)
   - 45% win rate
   - High volatility
   - 95% options

#### Exchange-Specific Buttons:
- **+50 Schwab** - Add 50 random Schwab trades
- **+50 MEXC** - Add 50 crypto futures trades
- **+50 Forex** - Add 50 HeroFX forex trades

### Programmatically

```typescript
import {
    generateCompleteDemoAccount,
    generateDemoTrades,
    generateMEXCDemoTrades,
    generateForexDemoTrades,
    generateProfitableTraderData,
    generateLearningTraderData,
    generateAggressiveOptionsTraderData,
} from '../utils/demoDataGenerator';

// Generate complete mixed portfolio
const allTrades = generateCompleteDemoAccount();

// Generate specific preset
const profitableTrades = generateProfitableTraderData();

// Generate custom Schwab trades
const customTrades = generateDemoTrades({
    count: 100,
    winRate: 55,
    optionsPercentage: 85,
    targetPnlRange: { min: -2000, max: 8000 },
});

// Generate MEXC futures only
const mexcTrades = generateMEXCDemoTrades(50);

// Generate HeroFX forex only
const forexTrades = generateForexDemoTrades(40);
```

## Data Characteristics

### Schwab Options

- **Symbol Format**: Matches CSV exactly
  - Example: `SPXW 12/15/2025 6800.00 P`
  - Format: `SYMBOL MM/DD/YYYY STRIKE.00 P/C`

- **Pricing**: Realistic option premiums
  - Based on moneyness (ITM vs OTM)
  - Time value decay
  - Volatility adjustments

- **Expirations**: Always on Fridays
  - 30% chance of worthless expiration for losers

- **Quantities**: Common lot sizes
  - 1, 2, 3, 5, or 10 contracts

### MEXC Futures

- **Symbols**: Major cryptocurrencies with USDT pairs
  - BTCUSDT, ETHUSDT, SOLUSDT, etc.

- **Leverage**: 5x to 20x

- **Position Sizes**:
  - BTC: 0.01 to 0.1 contracts
  - Altcoins: 0.1 to 1.0 contracts

- **Holding Period**: 15 minutes to 8 hours

- **Fees**: 0.06% taker fee on entry and exit

### HeroFX Forex

- **Pairs**: Gold (XAUUSD) and major currency pairs

- **Lot Sizes**: 0.01 to 1.0 standard lots

- **Holding Period**: 30 minutes to 6 hours

- **Win/Loss**: Measured in pips
  - Wins: 10-50 pips
  - Losses: 15-40 pips (stop loss)

- **Spread**: 2-5 pips

## Privacy & Randomization

All values are **completely randomized**:
- ✅ Entry/exit prices randomized
- ✅ P&L values randomized
- ✅ Dates randomized within ranges
- ✅ Quantities randomized
- ✅ Win/loss outcomes randomized

**No actual trading data is used** - everything is synthetically generated based on realistic market patterns.

## Safety

- **Demo Account Only**: The `DemoAccountSeeder` component only renders for `demo@tradetracker.app`
- **Confirmation Dialogs**: All seeding and clearing operations require user confirmation
- **Non-Destructive**: Adding trades doesn't overwrite existing data
- **Clear All Option**: Easy way to reset and start fresh

## Implementation Files

- **Generator**: `src/utils/demoDataGenerator.ts`
- **UI Component**: `src/components/DemoAccountSeeder.tsx`
- **Integration**: `src/pages/ImportPage.tsx`

## Future Enhancements

Potential additions:
- ByBit perpetuals
- Binance spot trades
- Interactive Brokers stocks
- Time-based patterns (e.g., "morning trader", "afternoon trader")
- Strategy-based generation (e.g., "breakout trader", "mean reversion")
- Custom ticker selection
- Import from templates
