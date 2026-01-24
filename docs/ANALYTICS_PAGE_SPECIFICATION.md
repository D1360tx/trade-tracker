# Analytics Page - Complete Technical Specification

## Overview

The Analytics page provides comprehensive trading performance visualization and analysis across 11 key areas: cumulative P&L, daily distribution, ticker performance, directional analysis, strategy performance, mistake cost analysis, R-multiple analysis, and time-based performance metrics.

---

## Table of Contents

1. [Data Processing & Filtering](#data-processing--filtering)
2. [KPI Cards](#kpi-cards)
3. [Chart Sections](#chart-sections)
4. [Calculations & Formulas](#calculations--formulas)
5. [Known Issues & Fixes](#known-issues--fixes)
6. [Implementation Notes](#implementation-notes)

---

## Data Processing & Filtering

### Base Trade Filter

All analytics use **closed trades only**:

```typescript
const closedTrades = useMemo(() =>
    trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0),
    [trades]
);
```

**Criteria**: Trade must have `status === 'CLOSED'` OR `pnl !== 0`

**Why**: Ensures only completed trades are included in analytics. Open positions are excluded.

---

## KPI Cards

Six key performance indicators displayed at the top:

### 1. Top Strategy

**Calculation**:
- Groups trades by `strategyId`
- Calculates total P&L per strategy
- Sorts by P&L (descending)
- Shows the best-performing strategy

**Display**:
- Strategy name
- Total P&L (color-coded: green if positive, red if negative)

**Edge Case**: Shows "No data" if no strategies defined or no trades

### 2. Worst Mistake

**Calculation**:
- Groups trades by mistake tags (`t.mistakes[]`)
- Sums P&L for each mistake type
- Sorts by cost (ascending - lowest/most negative first)
- Shows the mistake with the lowest P&L

**Display**:
- Mistake name
- Total P&L impact (always displayed in red)

**Note**: "Worst" = most negative P&L, but the value shown is the actual P&L (could be positive if mistakes led to profitable trades, though uncommon)

### 3. Win / Loss Ratio

**Formula**:
```typescript
const avgWin = totalWinAmount / winCount;
const avgLoss = totalLossAmount / lossCount;
const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
```

**Interpretation**:
- `2.0` = Average win is 2x average loss
- `1.0` = Average win equals average loss
- `0.5` = Average win is half the average loss
- `∞` = No losses (all wins)

**Display**: Blue accent color, shows ∞ if no losses

### 4. Profit Factor

**Formula**:
```typescript
const profitFactor = totalLossAmt > 0 ? totalWinAmt / totalLossAmt : totalWinAmt > 0 ? Infinity : 0;
```

**Interpretation**:
- `> 2.0` = Excellent (green)
- `>= 1.0` = Profitable (white)
- `< 1.0` = Losing (red)
- `∞` = No losses

**Example**: Profit factor of 2.5 means you make $2.50 for every $1.00 you lose

### 5. Average Win

**Calculation**:
```typescript
const wins = closedTrades.filter(t => t.pnl > 0);
const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
```

**Display**: Green color, always shows + sign, 2 decimal precision

### 6. Average Loss

**Calculation**:
```typescript
const losses = closedTrades.filter(t => t.pnl < 0);
const totalLossAmt = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
const avgLoss = losses.length > 0 ? totalLossAmt / losses.length : 0;
```

**Display**: Red color, shows - sign, 2 decimal precision

**Note**: Value is displayed as positive (e.g., "-$150.50") for readability

---

## Chart Sections

### 1. Cumulative P&L

**Data Source**: All closed trades sorted by exit date

**Calculation**:
```typescript
const sorted = [...closedTrades].sort((a, b) =>
    new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
);

let cumulative = 0;
const data = sorted.map(t => {
    cumulative += t.pnl;
    return {
        date: format(parseISO(t.exitDate), 'MMM dd'),
        pnl: cumulative,
        tradePnl: t.pnl
    };
});
```

**Chart Type**: Area chart with gradient fill

**X-Axis**: Trade exit dates (formatted as "Jan 15")

**Y-Axis**: Cumulative P&L in dollars

**Tooltip**: Shows date and cumulative P&L at that point

**Purpose**: Visualize account growth over time

---

### 2. Daily P&L (Last 30 Active Days)

**Fixed Issue**: Previously showed random 30 days due to unsorted Map

**Current Implementation** (Fixed):
```typescript
const dailyMap = new Map<string, number>();
closedTrades.forEach(t => {
    const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + t.pnl);
});

return Array.from(dailyMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()) // CRITICAL: Sort by date
    .slice(-30) // Take last 30 days
    .map(([date, pnl]) => ({
        date: format(parseISO(date), 'MMM dd'),
        pnl
    }));
```

**Chart Type**: Bar chart with conditional coloring

**X-Axis**: Dates (last 30 trading days with activity)

**Y-Axis**: Daily P&L in dollars

**Bar Colors**:
- Green if `pnl >= 0`
- Red if `pnl < 0`

**Tooltip**: Shows date and daily P&L

**Note**: Only includes days where trades were closed (gaps for non-trading days)

---

### 3. Performance by Ticker (Top 5 Volume)

**Data Processing**:
```typescript
const stats = new Map<string, { wins: number, total: number, pnl: number }>();

closedTrades.forEach(t => {
    const current = stats.get(t.ticker) || { wins: 0, total: 0, pnl: 0 };
    stats.set(t.ticker, {
        wins: current.wins + (t.pnl > 0 ? 1 : 0),
        total: current.total + 1,
        pnl: current.pnl + t.pnl
    });
});

return Array.from(stats.entries())
    .map(([ticker, data]) => ({
        name: ticker,
        winRate: (data.wins / data.total) * 100,
        total: data.total,
        pnl: data.pnl
    }))
    .sort((a, b) => b.total - a.total) // Sort by volume (trade count)
    .slice(0, 5); // Top 5 only
```

**Display**: Table with 4 columns

**Columns**:
1. **Ticker**: Symbol name
2. **Trades**: Total count
3. **Win Rate**: Percentage (color-coded: green ≥50%, red <50%)
4. **Total P&L**: Dollar amount (color-coded)

**Sorting**: By total trade count (descending)

---

### 4. Trade Distribution (Long vs Short)

**Data Processing**:
```typescript
const longTrades = closedTrades.filter(t => t.direction === 'LONG');
const shortTrades = closedTrades.filter(t => t.direction === 'SHORT');

return [
    {
        name: 'Long',
        value: longTrades.length,
        pnl: longTrades.reduce((sum, t) => sum + t.pnl, 0)
    },
    {
        name: 'Short',
        value: shortTrades.length,
        pnl: shortTrades.reduce((sum, t) => sum + t.pnl, 0)
    }
];
```

**Chart Type**: Donut chart (pie with inner radius)

**Colors**:
- Long: Green (`var(--success)`)
- Short: Red (`var(--danger)`)

**Tooltip**: Shows direction, trade count, and P&L

**Additional Display**: Two cards below chart showing Long P&L and Short P&L separately

---

### 5. Performance by Strategy

**Data Processing**:
```typescript
const stats = new Map<string, { wins: number, total: number, pnl: number, name: string, color: string }>();

// Pre-fill with all defined strategies
strategies.forEach(s => {
    stats.set(s.id, { wins: 0, total: 0, pnl: 0, name: s.name, color: s.color });
});
stats.set('none', { wins: 0, total: 0, pnl: 0, name: 'No Strategy', color: 'bg-gray-500' });

closedTrades.forEach(t => {
    const sid = t.strategyId || 'none';
    const entry = stats.get(sid);
    if (entry) {
        entry.wins += (t.pnl > 0 ? 1 : 0);
        entry.total += 1;
        entry.pnl += t.pnl;
    }
});

return Array.from(stats.values())
    .filter(s => s.total > 0) // Only show strategies with trades
    .sort((a, b) => b.pnl - a.pnl); // Sort by P&L (descending)
```

**Layout**: Horizontal bar chart + table

**Chart**:
- Horizontal bars sorted by P&L
- Bar color: Green if positive, red if negative
- Y-Axis: Strategy names (max width 100px)
- X-Axis: P&L in dollars

**Table Columns**:
1. **Strategy**: Name with color dot indicator
2. **Trades**: Count
3. **Win Rate**: Percentage badge (color-coded)
4. **P&L**: Dollar amount (color-coded)

**Empty State**: "No strategy data available. Tag your trades in the Journal!"

---

### 6. Psychology & Discipline (Shadow P&L)

**Concept**: Shows what your P&L would be if you had avoided all trades tagged with mistakes

**Calculation**:
```typescript
let actualCum = 0;
let shadowCum = 0;

sorted.map(t => {
    actualCum += t.pnl;

    // If trade has mistakes, exclude from shadow P&L
    const hasMistakes = t.mistakes && t.mistakes.length > 0;
    if (!hasMistakes) {
        shadowCum += t.pnl;
    }

    return {
        date: format(parseISO(t.exitDate), 'MMM dd'),
        actual: actualCum,
        shadow: shadowCum,
        difference: shadowCum - actualCum
    };
});
```

**Chart**: Dual area chart
- **Actual P&L**: Solid line (gray)
- **Shadow P&L** (Potential): Dashed line (blue)

**Total Cost of Mistakes**: Displayed in red badge at top
```typescript
totalMistakeCost = shadowPnL - actualPnL
```

**Interpretation**:
- If shadow line is **above** actual line: Mistakes cost you money
- If lines are identical: No mistakes tagged or mistakes didn't affect P&L
- Cost = amount you would have saved/gained by avoiding mistake trades

**Right Side**: Bar chart showing cost breakdown by mistake type

---

### 7. R-Multiple Analysis

**Prerequisite**: Trades must have `initialRisk` field populated

**Data Processing**:
```typescript
const withR = closedTrades
    .filter(t => t.initialRisk && t.initialRisk > 0)
    .map(t => ({
        ...t,
        r: t.pnl / (t.initialRisk as number)
    }));
```

**Metrics Calculated**:

1. **Total R**:
```typescript
totalR = sum of all R-values
```

2. **Expectancy (R)**:
```typescript
expectancy = (avgWinR × winRate) + (avgLossR × (1 - winRate))
```
- Represents expected R-return per trade
- Positive = profitable system over time
- Example: 0.5R expectancy means you expect to gain 0.5R per trade on average

3. **Average Win R**:
```typescript
avgWinR = sum(positive R-values) / count(positive R-values)
```

4. **Average Loss R**:
```typescript
avgLossR = sum(negative R-values) / count(negative R-values)
```
- Displayed as negative (e.g., "-1.2R")

**Distribution Chart**:
Buckets trades into R-ranges:
- `< -2R`: Large losses
- `-2R to -1R`: Controlled losses
- `-1R to 0R`: Small losses (stop not honored)
- `0R to 1R`: Small wins
- `1R to 2R`: Target wins
- `2R to 3R`: Large wins
- `> 3R`: Exceptional wins

**Cumulative R Chart**: Shows R-accumulation over time

**Empty State**: "No trades with Risk defined. Set 'Risk ($)' in your Journal to see R-Metrics."

---

### 8. Performance by Time of Day

**Data Processing**:
```typescript
const hourlyStats = new Map<number, { pnl: number; wins: number; total: number }>();

// Initialize all 24 hours
for (let i = 0; i < 24; i++) {
    hourlyStats.set(i, { pnl: 0, wins: 0, total: 0 });
}

closedTrades.forEach(t => {
    const hour = parseISO(t.exitDate).getHours(); // 0-23
    const stats = hourlyStats.get(hour)!;
    stats.pnl += t.pnl;
    stats.total += 1;
    if (t.pnl > 0) stats.wins += 1;
});

return Array.from(hourlyStats.entries())
    .map(([hour, stats]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`, // "09:00"
        hourNum: hour,
        pnl: stats.pnl,
        winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        trades: stats.total
    }))
    .filter(h => h.trades > 0); // Only show hours with trades
```

**Chart Type**: Bar chart

**X-Axis**: Hour of day (24-hour format)

**Y-Axis (Left)**: P&L in dollars

**Y-Axis (Right)**: Win rate percentage

**Bar Colors**: Green if positive, red if negative

**Tooltip**: Shows hour, P&L, win rate, and trade count

**Timezone Note**: Uses **local timezone** from `parseISO(t.exitDate).getHours()`
- Trade with `exitDate: "2025-01-15T14:30:00.000Z"` (UTC)
- In EST (UTC-5): Shows at hour 9 (9:30 AM)
- In PST (UTC-8): Shows at hour 6 (6:30 AM)

---

### 9. Performance by Day of Week

**Data Processing**:
```typescript
const dayStats = new Map<number, { pnl: number; wins: number; total: number }>();
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Initialize all 7 days
for (let i = 0; i < 7; i++) {
    dayStats.set(i, { pnl: 0, wins: 0, total: 0 });
}

closedTrades.forEach(t => {
    const day = parseISO(t.exitDate).getDay(); // 0 = Sunday, 6 = Saturday
    const stats = dayStats.get(day)!;
    stats.pnl += t.pnl;
    stats.total += 1;
    if (t.pnl > 0) stats.wins += 1;
});

return Array.from(dayStats.entries())
    .map(([day, stats]) => ({
        day: dayNames[day],
        dayShort: dayNames[day].slice(0, 3), // "Mon"
        pnl: stats.pnl,
        winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        trades: stats.total
    }))
    .filter(d => d.trades > 0); // Only show days with trades
```

**Chart Type**: Bar chart

**X-Axis**: Day abbreviations (Sun, Mon, Tue, etc.)

**Y-Axis**: P&L in dollars

**Bar Colors**: Green if positive, red if negative

**Companion Display**: "Win Rate by Day" card list showing all days with win rate badges

---

### 10. Win Rate by Day (List View)

**Layout**: Vertical list of cards

**Each Card Shows**:
- Day name (full: "Monday")
- Trade count (e.g., "12 trades")
- Win rate badge (color-coded: green ≥50%, red <50%)

**Sorting**: By day of week (Sunday to Saturday)

---

### 11. Cumulative P&L by Strategy (Comparison)

**Only shows if**: User has defined strategies AND has trades with strategy tags

**Data Processing**:
```typescript
// Get all trades sorted by date
const sorted = [...closedTrades].sort((a, b) =>
    new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
);

// Track cumulative for each strategy
const cumulatives = new Map<string, number>();
strategies.forEach(s => cumulatives.set(s.id, 0));
cumulatives.set('none', 0);

const dataPoints: any[] = [];

sorted.forEach(t => {
    const sid = t.strategyId || 'none';
    if (cumulatives.has(sid)) {
        cumulatives.set(sid, cumulatives.get(sid)! + t.pnl);
    }

    // Create data point with all strategy cumulative values
    const point: any = {
        date: format(parseISO(t.exitDate), 'MMM dd'),
        dateTime: new Date(t.exitDate).getTime()
    };

    cumulatives.forEach((value, key) => {
        const strategy = strategies.find(s => s.id === key);
        const name = strategy ? strategy.name : 'No Strategy';
        point[name] = value;
    });

    dataPoints.push(point);
});
```

**Chart Type**: Multi-line area chart

**Lines**: One per strategy

**Line Styles**:
- Defined strategies: Solid lines with gradient fill
- "No Strategy": Dashed gray line with minimal fill

**Colors**: Generated dynamically using HSL color wheel
```typescript
hsl(${idx * 360 / strategies.length}, 70%, 50%)
```

**Tooltip**: Shows all strategy values at that point in time

**Purpose**: Compare strategy performance over time to see which consistently outperforms

---

## Calculations & Formulas

### Win Rate
```typescript
winRate = (winCount / totalTrades) × 100
```

### Profit Factor
```typescript
profitFactor = totalWinAmount / totalLossAmount
```
- `> 2.0` = Excellent
- `1.0-2.0` = Good
- `< 1.0` = Losing

### Win/Loss Ratio
```typescript
winLossRatio = avgWin / avgLoss
```
- `> 1.0` = Average win bigger than average loss
- `< 1.0` = Average loss bigger than average win

### R-Multiple
```typescript
R = actualPnL / initialRisk
```
- `1R` = Hit your risk target (e.g., risked $100, made $100)
- `2R` = Made 2× your risk
- `-1R` = Lost your full risk amount

### Expectancy (R)
```typescript
expectancy = (avgWinR × winRate) + (avgLossR × (1 - winRate))
```
- Example: `avgWinR = 2.5`, `avgLossR = -1.0`, `winRate = 50%`
- Expectancy = `(2.5 × 0.5) + (-1.0 × 0.5) = 1.25 - 0.5 = 0.75R`
- You expect to gain 0.75R per trade on average

### Shadow P&L Cost
```typescript
cost = shadowCumulativePnL - actualCumulativePnL
```
- Positive cost = money lost due to mistakes
- Example: Shadow = $10,000, Actual = $8,500 → Cost = $1,500

---

## Known Issues & Fixes

### Issue 1: Daily P&L Showing Wrong Date Range (FIXED)

**Problem**: Chart title said "Last 30 Active Days" but showed dates like "Sept 19 to July 25"

**Root Cause**:
```typescript
// OLD (WRONG):
return Array.from(dailyMap.entries())
    .map(([date, pnl]) => ({ date: format(parseISO(date), 'MMM dd'), pnl }))
    .slice(-30); // Took last 30 from unsorted Map
```

Map entries have no guaranteed order, so `.slice(-30)` was taking random 30 days.

**Fix**:
```typescript
// NEW (CORRECT):
return Array.from(dailyMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()) // Sort chronologically
    .slice(-30) // Take last 30 days
    .map(([date, pnl]) => ({ date: format(parseISO(date), 'MMM dd'), pnl }));
```

**Committed**: `ca48d0c` - "fix: correct Daily P&L chart to show actual last 30 trading days"

### Issue 2: Timezone Inconsistencies

**Current Behavior**: All time-based charts use **local timezone**

**Impact**:
- User in EST sees trades at different hours than user in PST
- Day-of-week can shift for trades near midnight UTC

**Mitigation**: Consistent within single user's timezone. Not an issue unless comparing across timezones.

**Future Enhancement**: Add timezone selection or force UTC display

---

## Implementation Notes

### Performance Optimizations

All expensive calculations use `useMemo`:
```typescript
const cumulativeData = useMemo(() => { /* ... */ }, [closedTrades]);
const dailyPnLData = useMemo(() => { /* ... */ }, [closedTrades]);
const tickerStats = useMemo(() => { /* ... */ }, [closedTrades]);
// ... etc
```

**Dependency**: All depend on `closedTrades`, which itself is memoized:
```typescript
const closedTrades = useMemo(() =>
    trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0),
    [trades]
);
```

**Recalculation Trigger**: Only when `trades` array changes (new trade added, trade updated, trade deleted)

### Data Dependencies

```
trades (from TradeContext)
    ↓
closedTrades (filtered)
    ↓
┌────────────────┬──────────────────┬─────────────────┐
↓                ↓                  ↓                 ↓
cumulativeData   dailyPnLData      tickerStats     kpis
strategyStats    mistakeStats      rStats          hourlyPerf
dayOfWeekPerf    cumulativeByStrat shadowPnL       directionStats
```

All derived data recalculates automatically when trades change.

### External Context Dependencies

1. **StrategyContext**:
```typescript
const { strategies } = useStrategies();
```
Used for: Strategy performance chart, cumulative by strategy

2. **MistakeContext**:
```typescript
const { mistakes } = useMistakes();
```
Used for: Cost of mistakes analysis, shadow P&L

**Note**: If strategies or mistakes are undefined, respective charts show empty states

---

## Empty States

Each chart has graceful empty state handling:

1. **No Closed Trades**: Most charts show dashed border box with message
2. **No Strategy Data**: "No strategy data available. Tag your trades in the Journal!"
3. **No R-Multiple Data**: "No trades with Risk defined. Set 'Risk ($)' in your Journal to see R-Metrics."
4. **No Mistake Data**: Shows AlertTriangle icon + "No mistakes tagged yet."
5. **No Hourly/Daily Data**: "No hourly data available yet." / "No daily data available yet."

---

## Chart Library: Recharts

All charts use **Recharts** components:

```typescript
import {
    AreaChart, Area,
    BarChart, Bar, Cell,
    PieChart, Pie,
    CartesianGrid, XAxis, YAxis,
    Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
```

### Common Chart Props

**ResponsiveContainer**:
```typescript
<ResponsiveContainer width="100%" height="100%">
```
Makes charts responsive to container size

**CartesianGrid**:
```typescript
<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
```
Horizontal gridlines only (no vertical)

**XAxis/YAxis Styling**:
```typescript
<XAxis
    stroke="var(--text-tertiary)"
    fontSize={12}
    tickLine={false}
    axisLine={false}
/>
```
Minimal styling, no tick lines or axis lines

**Tooltip Custom Content**:
All tooltips use custom content function for consistent styling:
```typescript
<Tooltip
    content={({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-lg shadow-lg">
                    {/* Custom content */}
                </div>
            );
        }
        return null;
    }}
/>
```

---

## Color Coding

### CSS Variables Used

```css
--success: #10b981;       /* Green - profits, wins */
--danger: #ef4444;        /* Red - losses, mistakes */
--accent-primary: #3b82f6; /* Blue - highlights, shadow P&L */
--text-primary: #f1f5f9;  /* Main text */
--text-secondary: #94a3b8; /* Secondary text */
--text-tertiary: #64748b; /* Tertiary text, axis labels */
--bg-primary: #0f172a;    /* Page background */
--bg-secondary: #1e293b;  /* Card backgrounds, tooltips */
--bg-tertiary: #334155;   /* Section backgrounds */
--border: #475569;        /* Borders, gridlines */
```

### Conditional Coloring

**P&L Values**:
```typescript
className={pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
```

**Win Rate Badges**:
```typescript
className={winRate >= 50 ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]'}
```

**Profit Factor**:
```typescript
className={profitFactor >= 2 ? 'text-[var(--success)]' : profitFactor >= 1 ? 'text-[var(--text-primary)]' : 'text-[var(--danger)]'}
```
- Excellent (≥2.0): Green
- Profitable (1.0-2.0): White
- Losing (<1.0): Red

---

## Testing Checklist

### Data Accuracy

- [ ] Cumulative P&L matches sum of all trade P&L
- [ ] Daily P&L sums match trade P&L on those days
- [ ] Last 30 days chart shows most recent 30 trading days (chronologically)
- [ ] Ticker stats win rates match manual calculation
- [ ] Long/Short split sums to total trades
- [ ] Strategy P&L sums match trades tagged with those strategies
- [ ] Shadow P&L excludes only trades with mistakes
- [ ] R-Multiple calculations match formula: `R = pnl / initialRisk`
- [ ] Hourly performance groups trades by exit hour correctly
- [ ] Day of week performance groups trades by exit day correctly

### Edge Cases

- [ ] No closed trades: All charts show empty states
- [ ] All profitable trades: Profit factor shows ∞
- [ ] All losing trades: Win/Loss ratio shows 0
- [ ] No strategy tags: Strategy chart shows "No data" message
- [ ] No mistake tags: Shadow P&L line matches actual P&L
- [ ] No initialRisk set: R-Multiple shows empty state
- [ ] Single trade: All charts render without errors
- [ ] Trades on same day: Daily P&L aggregates correctly

### Visual

- [ ] Charts responsive on mobile and desktop
- [ ] Tooltips readable and don't overflow
- [ ] Colors consistent across all charts
- [ ] Gradients render smoothly
- [ ] Empty states have dashed borders and icons
- [ ] KPI cards aligned and evenly spaced
- [ ] Tables scrollable horizontally if needed

---

## Future Enhancements

1. **Date Range Filter**: Allow users to select custom date ranges for all analytics
2. **Exchange Filter**: Filter analytics by specific exchanges
3. **Export Data**: Download analytics data as CSV/Excel
4. **Comparison Mode**: Compare current period to previous period
5. **Goals Tracking**: Set targets and show progress
6. **Advanced R-Multiple**: Kelly Criterion, optimal position sizing
7. **Monte Carlo Simulation**: Predict future performance based on historical data
8. **Correlation Analysis**: Which tickers/strategies correlate?
9. **Drawdown Analysis**: Max drawdown, recovery time, drawdown periods
10. **Trade Quality Score**: Composite metric combining multiple factors

---

## File Location

**Source File**: `src/pages/Analytics.tsx` (1,232 lines)

**Dependencies**:
- `src/context/TradeContext.tsx` - Provides `trades` array
- `src/context/StrategyContext.tsx` - Provides `strategies` array
- `src/context/MistakeContext.tsx` - Provides `mistakes` array

**Last Updated**: January 2026

**Recent Fixes**:
- `ca48d0c` - Fixed Daily P&L chart date range sorting

---

**End of Technical Specification**

For questions or to report data discrepancies, refer to the source code at [src/pages/Analytics.tsx](../src/pages/Analytics.tsx).
