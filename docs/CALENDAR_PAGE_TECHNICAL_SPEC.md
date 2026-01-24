# Calendar Page - Complete Technical Specification

## Overview

The Calendar page is a sophisticated P&L visualization component that displays daily trading performance in both monthly grid and weekly card layouts. It features responsive design with separate mobile/desktop views, real-time filtering, detailed day modals, and persistent view preferences.

---

## Table of Contents

1. [Architecture & Data Flow](#architecture--data-flow)
2. [View Modes & Responsive Behavior](#view-modes--responsive-behavior)
3. [Core Features](#core-features)
4. [Data Processing & Aggregation](#data-processing--aggregation)
5. [UI Components Breakdown](#ui-components-breakdown)
6. [State Management](#state-management)
7. [Styling & Theming](#styling--theming)
8. [Edge Cases & Quirks](#edge-cases--quirks)
9. [Performance Considerations](#performance-considerations)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture & Data Flow

### Dependencies

```typescript
import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  addMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  BarChart3,
  Calendar as CalendarIcon
} from 'lucide-react';
```

### Data Flow

```
Trades Context
    ↓
Filter by Status & Exchange
    ↓
Aggregate by Exit Date (Local Time)
    ↓
Calculate Daily P&L
    ↓
Render Calendar Views
    ↓
User Clicks Day
    ↓
Calculate Day Stats
    ↓
Display Modal with Detailed Breakdown
```

---

## View Modes & Responsive Behavior

### Four Distinct View Configurations

The calendar has **independent view states** for mobile and desktop:

| Device  | View Modes Available          | Default | Persisted In               |
|---------|-------------------------------|---------|----------------------------|
| Mobile  | Monthly Grid, Weekly Cards    | Monthly | `localStorage: calendar_mobile_view` |
| Desktop | Monthly Grid, Weekly Enhanced | Monthly | `localStorage: calendar_desktop_view` |

### Key Implementation Detail

**Mobile and Desktop views are INDEPENDENT**:
- Mobile can be in "weekly" mode while desktop is in "monthly" mode
- Each has its own localStorage key
- Each has its own toggle button
- Navigation buttons respect the current device's view mode

```typescript
// State initialization with localStorage persistence
const [mobileView, setMobileView] = useState<'monthly' | 'weekly'>(() => {
    const saved = localStorage.getItem('calendar_mobile_view');
    return (saved as 'monthly' | 'weekly') || 'monthly';
});

const [desktopView, setDesktopView] = useState<'monthly' | 'weekly'>(() => {
    const saved = localStorage.getItem('calendar_desktop_view');
    return (saved as 'monthly' | 'weekly') || 'monthly';
});
```

### Responsive Breakpoints

- **Mobile**: `< 768px` (uses `md:` prefix for desktop styles)
- **Desktop**: `>= 768px`

---

## Core Features

### 1. Monthly Grid View (Default)

**Desktop Layout** (`desktopView === 'monthly'`):
- 7-column grid (Sun-Sat)
- Shows full month with blank cells for leading days before month starts
- Each day cell displays:
  - Day number (top-left corner)
  - P&L amount (centered, with + sign for profits)
  - Color-coded background (green for profit, red for loss, gray for no trades)
  - Subtle glow effect on profit/loss days
- Cells have `aspect-square` ratio for perfect squares
- Hover effect: scales up 1.05x
- Today indicator: Blue ring around cell
- Responsive text sizing:
  - Mobile: 10px font, abbreviated amounts (e.g., "1.2k")
  - Desktop: 14px font, full precision with 2 decimals

**Mobile Layout** (when `mobileView === 'monthly'`):
- Same grid structure as desktop
- Compressed spacing (gap-1 vs gap-4)
- Single-letter day headers (S M T W T F S) instead of full names
- Smaller text throughout

### 2. Weekly Card View

**Desktop Enhanced View** (`desktopView === 'weekly'`, hidden on mobile):
- **Weekly Stats Summary** (4 cards at top):
  - Total Trades (count)
  - Best Day (day name + P&L)
  - Worst Day (day name + P&L, color based on actual value)
  - Avg Per Day (only counts trading days with P&L ≠ 0)

- **7-Column Day Cards**:
  - Minimum height: 220px
  - Each card shows:
    - Day name (e.g., "Monday") + date (e.g., "Jan 15")
    - "Today" badge if current day
    - Large P&L amount (with 2 decimal precision)
    - Win/Loss ratio (e.g., "3W / 2L")
    - Quick stats footer:
      - Total trades
      - Win % (color-coded: green ≥50%, red <50%)
      - Average P&L per trade
  - Cards with no trades show "No Trades" and are semi-transparent (60% opacity)
  - Clickable cards scale up slightly on hover (1.01x)

**Mobile Weekly View** (`mobileView === 'weekly'`, hidden on desktop):
- **Separate Navigation** (not shared with monthly view):
  - Week navigation arrows
  - Date range display (e.g., "Jan 15 - Jan 21, 2025")
  - "Current Week" button (when not viewing current week)

- **Vertical Stack of Cards** (one per day):
  - Full-width cards with 4px spacing
  - Each card displays:
    - Day name + full date
    - Number of trades (e.g., "3 trades")
    - Large P&L on right side
    - No extra stats (simplified for mobile)

### 3. Exchange Filter

**Location**: Top-right controls area

**Behavior**:
- Dropdown showing all exchanges with trades
- Multi-select (checkboxes)
- Empty selection = show all exchanges
- Filters apply immediately to:
  - Daily P&L aggregation
  - Monthly/weekly totals
  - Day detail modal trades
  - All statistics

**Implementation**:
```typescript
const filteredTrades = useMemo(() => {
    return trades.filter(t => {
        const isClosed = t.status === 'CLOSED' || t.pnl !== 0;
        const matchesExchange = selectedExchanges.length === 0 ||
                               selectedExchanges.includes(t.exchange);
        return isClosed && matchesExchange;
    });
}, [trades, selectedExchanges]);
```

### 4. Navigation Controls

**Monthly Navigation** (used in monthly view):
- Previous/Next month buttons (ChevronLeft/Right icons)
- Date display: "January 2025"
- Jumps to first day of previous/next month

**Weekly Navigation** (used in weekly view):
- Previous/Next week buttons
- Date display: "Jan 15 - Jan 21"
- Moves by 7-day increments
- Week boundaries: Sunday to Saturday (US standard)

**"Current Week/Month" Button**:
- **Visibility Logic**:
  ```typescript
  const now = new Date();
  const isCurrentPeriod = desktopView === 'weekly'
      ? format(currentDate, 'yyyy-ww') === format(now, 'yyyy-ww')
      : format(currentDate, 'yyyy-MM') === format(now, 'yyyy-MM');

  if (isCurrentPeriod) return null; // Hide button
  ```
- Only appears when viewing a past or future period
- Desktop: Shows "Current Week" or "Current Month" based on view mode
- Mobile: Always shows "Current Month" in top controls, "Current Week" in weekly view navigation
- Clicking resets `currentDate` to `new Date()`

### 5. Day Detail Modal

**Trigger**: Click any day cell that has trades (`hasTrades === true`)

**Layout**: Full-screen overlay with centered modal

**Header**:
- Full date: "Monday, January 15, 2025"
- Total P&L (large, color-coded)
- Close button (X icon)

**Content Sections** (scrollable):

1. **Key Stats Grid** (4 cards, 2x2 on mobile, 4x1 on desktop):
   - **Win Rate**: Percentage + W/L count
   - **Avg P&L**: Average per trade
   - **Profit Factor**: `avgWin / avgLoss` (shows ∞ if no losses)
   - **Avg Win/Loss**: Side-by-side values

2. **Best & Worst Trade** (2 cards):
   - Ticker + P&L amount
   - Color-coded borders (green for best, red for worst)

3. **P&L by Symbol**:
   - Grouped by ticker
   - Shows total P&L per ticker + trade count
   - Sorted by P&L (highest first)

4. **All Trades List**:
   - Sorted by P&L (best to worst)
   - Each row shows:
     - Ticker + direction badge (LONG/SHORT) + type badge (OPTION/STOCK/FUTURES)
     - Quantity × Entry Price → Exit Price
     - P&L dollar amount + P&L percentage

---

## Data Processing & Aggregation

### Trade Filtering

**Criteria** (both must be true):
1. `status === 'CLOSED'` OR `pnl !== 0`
2. Exchange matches selected filters (or no filters selected)

### Date Aggregation

**Critical Detail**: Uses **Exit Date** in **Local Time**

```typescript
const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTrades.forEach(t => {
        const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
        map.set(dateStr, (map.get(dateStr) || 0) + t.pnl);
    });
    return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }));
}, [filteredTrades]);
```

**Why `parseISO`?**
- Trade exit dates are ISO strings (e.g., `"2025-01-15T14:30:00.000Z"`)
- `parseISO()` converts to Date object
- `format(date, 'yyyy-MM-dd')` extracts just the date part in local timezone

**Quirk**: If trades have UTC timestamps, they'll be rendered in user's local timezone. For example:
- Trade with `exitDate: "2025-01-15T23:00:00.000Z"`
- In EST (UTC-5): Shows on January 15
- In PST (UTC-8): Shows on January 15
- In JST (UTC+9): Shows on January 16

### Statistics Calculations

**Monthly Stats**:
```typescript
const monthlyTotalPnL = daysInMonth.reduce((acc, date) =>
    acc + getPnLForDate(date), 0
);

const { greenDays, redDays } = useMemo(() => {
    let green = 0, red = 0;
    daysInMonth.forEach(date => {
        const pnl = getPnLForDate(date);
        if (pnl > 0) green++;
        else if (pnl < 0) red++;
    });
    return { greenDays: green, redDays: red };
}, [dailyData, currentDate]);
```

**Weekly Stats**:
- Same logic, but uses `daysInWeek` (7 days from Sunday to Saturday)
- Week determined by `startOfWeek(currentDate)` and `endOfWeek(currentDate)`

**Day Stats** (for modal):
```typescript
const getDayStats = (date: Date) => {
    const dayTrades = getTradesForDate(date);
    if (dayTrades.length === 0) return null;

    const wins = dayTrades.filter(t => t.pnl > 0);
    const losses = dayTrades.filter(t => t.pnl < 0);
    const totalPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgPnL = totalPnL / dayTrades.length;
    const winRate = (wins.length / dayTrades.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    const bestTrade = dayTrades.reduce((best, t) => t.pnl > best.pnl ? t : best, dayTrades[0]);
    const worstTrade = dayTrades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, dayTrades[0]);

    // Group by ticker
    const byTicker = new Map<string, { pnl: number; count: number }>();
    dayTrades.forEach(t => {
        const existing = byTicker.get(t.ticker) || { pnl: 0, count: 0 };
        byTicker.set(t.ticker, { pnl: existing.pnl + t.pnl, count: existing.count + 1 });
    });

    return {
        trades: dayTrades,
        totalPnL,
        avgPnL,
        winRate,
        wins: wins.length,
        losses: losses.length,
        profitFactor,
        bestTrade,
        worstTrade,
        avgWin,
        avgLoss,
        byTicker: Array.from(byTicker.entries()).sort((a, b) => b[1].pnl - a[1].pnl)
    };
};
```

---

## UI Components Breakdown

### Color Coding Function

```typescript
const getDayClass = (pnl: number) => {
    if (pnl > 0) return 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30';
    if (pnl < 0) return 'bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30';
    return 'bg-[var(--bg-tertiary)]/30 text-[var(--text-tertiary)]';
};
```

**CSS Variable Requirements**:
- `--success`: Green color for profits
- `--danger`: Red color for losses
- `--bg-tertiary`: Gray background for no-trade days
- `--text-tertiary`: Gray text for no-trade days
- `--accent-primary`: Blue for "today" ring and action buttons
- `--bg-primary`: Background for ring offset
- `--bg-secondary`: Card backgrounds
- `--border`: Border colors

### Monthly Grid Structure

**Desktop HTML Structure**:
```html
<div class="grid grid-cols-7 gap-4">
  {/* Blank cells for days before month starts */}
  <div key="blank-0" class="aspect-square"></div>
  <div key="blank-1" class="aspect-square"></div>
  <!-- ... based on getDay(monthStart) -->

  {/* Actual day cells */}
  <div
    key={date.toISOString()}
    onClick={() => hasTrades && setSelectedDate(date)}
    class="aspect-square rounded-xl p-2 flex flex-col items-center justify-center border
           transition-all hover:scale-105 relative overflow-hidden cursor-pointer
           bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30
           ring-2 ring-[var(--accent-primary)] ring-offset-2"
  >
    <span class="absolute top-2 left-2 text-xs opacity-60">15</span>
    <div class="mt-4 text-center">
      <span class="text-sm font-bold">+$1,234.56</span>
      <div class="absolute inset-0 bg-green-500/5 blur-xl"></div>
    </div>
  </div>
</div>
```

**Blank Cell Calculation**:
```typescript
const startDay = getDay(monthStart); // 0 = Sunday, 6 = Saturday
const blanks = Array(startDay).fill(null);
```

**Mobile Responsive Adjustments**:
- Gap: `gap-1` instead of `gap-4`
- Padding: `p-1` instead of `p-2`
- Text: `text-[10px]` instead of `text-xs`
- Amount display: Abbreviated (e.g., "1.2k") instead of full "$1,234.56"

### Weekly Enhanced Cards (Desktop Only)

**Stats Summary Grid**:
```html
<div class="grid grid-cols-4 gap-4 mb-6">
  <div class="bg-[var(--bg-tertiary)] rounded-xl p-4">
    <p class="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Total Trades</p>
    <p class="text-2xl font-bold">42</p>
  </div>
  <!-- Best Day, Worst Day, Avg Per Day -->
</div>
```

**Day Cards Grid**:
```html
<div class="grid grid-cols-7 gap-3">
  <div class="rounded-xl p-4 border min-h-[220px] flex flex-col cursor-pointer hover:scale-[1.01]">
    {/* Day Header */}
    <div class="flex justify-between items-start mb-3">
      <div>
        <p class="text-sm font-semibold">Monday</p>
        <p class="text-xs text-[var(--text-secondary)]">Jan 15</p>
      </div>
      <span class="text-[10px] uppercase bg-[var(--accent-primary)] text-white px-2 py-0.5 rounded-full">
        Today
      </span>
    </div>

    {/* P&L Amount */}
    <div class="flex-1 flex flex-col items-center justify-center">
      <p class="text-2xl font-bold">+$1,234.56</p>
      <p class="text-xs mt-1">
        <span class="text-[var(--success)]">3W</span>
        <span class="mx-1 text-[var(--text-tertiary)]">/</span>
        <span class="text-[var(--danger)]">2L</span>
      </p>
    </div>

    {/* Quick Stats Footer */}
    <div class="mt-3 pt-3 border-t border-[var(--border)]/50">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div>
          <p class="text-[10px] text-[var(--text-tertiary)] uppercase">Trades</p>
          <p class="text-sm font-semibold">5</p>
        </div>
        <div>
          <p class="text-[10px] text-[var(--text-tertiary)] uppercase">Win%</p>
          <p class="text-sm font-semibold text-[var(--success)]">60%</p>
        </div>
        <div>
          <p class="text-[10px] text-[var(--text-tertiary)] uppercase">Avg</p>
          <p class="text-sm font-semibold text-[var(--success)]">$247</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Modal Structure

**Full Modal HTML** (simplified):
```html
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
     onClick={() => setSelectedDate(null)}>
  <div class="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-hidden"
       onClick={e => e.stopPropagation()}>

    {/* Header */}
    <div class="flex items-center justify-between p-6 border-b border-[var(--border)]">
      <div>
        <h3 class="text-xl font-bold">Monday, January 15, 2025</h3>
        <p class="text-2xl font-bold mt-1 text-[var(--success)]">+$1,234.56</p>
      </div>
      <button onClick={() => setSelectedDate(null)} class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg">
        <X size={24} />
      </button>
    </div>

    {/* Scrollable Content */}
    <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
      {/* Stats Grid, Best/Worst, Ticker Groups, Trade List */}
    </div>
  </div>
</div>
```

**Click-away Behavior**:
- Clicking backdrop closes modal
- Clicking modal content does NOT close (uses `e.stopPropagation()`)

---

## State Management

### React State Variables

```typescript
// Global state from context
const { trades } = useTrades();

// Filter state
const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);

// Date selection for modal
const [selectedDate, setSelectedDate] = useState<Date | null>(null);

// View modes (persisted in localStorage)
const [mobileView, setMobileView] = useState<'monthly' | 'weekly'>(() => {
    const saved = localStorage.getItem('calendar_mobile_view');
    return (saved as 'monthly' | 'weekly') || 'monthly';
});

const [desktopView, setDesktopView] = useState<'monthly' | 'weekly'>(() => {
    const saved = localStorage.getItem('calendar_desktop_view');
    return (saved as 'monthly' | 'weekly') || 'monthly';
});

// Current date for navigation
const [currentDate, setCurrentDate] = useState(new Date());
```

### Memoized Computations

All expensive computations are memoized with `useMemo`:

```typescript
// Unique exchanges for filter dropdown
const uniqueExchanges = useMemo(() => {
    const exchanges = new Set(trades.map(t => t.exchange));
    return Array.from(exchanges).sort();
}, [trades]);

// Filtered trades
const filteredTrades = useMemo(() => {
    return trades.filter(t => {
        const isClosed = t.status === 'CLOSED' || t.pnl !== 0;
        const matchesExchange = selectedExchanges.length === 0 ||
                               selectedExchanges.includes(t.exchange);
        return isClosed && matchesExchange;
    });
}, [trades, selectedExchanges]);

// Daily aggregation
const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTrades.forEach(t => {
        const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
        map.set(dateStr, (map.get(dateStr) || 0) + t.pnl);
    });
    return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }));
}, [filteredTrades]);

// Monthly P&L
const monthlyTotalPnL = useMemo(() => {
    return daysInMonth.reduce((acc, date) => acc + getPnLForDate(date), 0);
}, [dailyData, currentDate]);

// Green/Red days
const { greenDays, redDays } = useMemo(() => {
    let green = 0, red = 0;
    daysInMonth.forEach(date => {
        const pnl = getPnLForDate(date);
        if (pnl > 0) green++;
        else if (pnl < 0) red++;
    });
    return { greenDays: green, redDays: red };
}, [dailyData, currentDate]);

// Weekly equivalents
const weeklyTotalPnL = useMemo(() => { /* ... */ }, [dailyData, currentDate]);
const { weeklyGreenDays, weeklyRedDays } = useMemo(() => { /* ... */ }, [dailyData, currentDate]);
```

### localStorage Persistence

When toggling views:
```typescript
const handleDesktopToggle = () => {
    const newView = desktopView === 'monthly' ? 'weekly' : 'monthly';
    setDesktopView(newView);
    localStorage.setItem('calendar_desktop_view', newView);
};

const handleMobileToggle = () => {
    const newView = mobileView === 'monthly' ? 'weekly' : 'monthly';
    setMobileView(newView);
    localStorage.setItem('calendar_mobile_view', newView);
};
```

---

## Styling & Theming

### Required CSS Variables

```css
:root {
  --success: #10b981;      /* Green for profits */
  --danger: #ef4444;       /* Red for losses */
  --accent-primary: #3b82f6; /* Blue for highlights */
  --bg-primary: #0f172a;   /* Page background */
  --bg-secondary: #1e293b; /* Card backgrounds */
  --bg-tertiary: #334155;  /* Section backgrounds */
  --text-primary: #f1f5f9; /* Main text */
  --text-secondary: #94a3b8; /* Secondary text */
  --text-tertiary: #64748b; /* Tertiary text */
  --border: #475569;       /* Borders */
}
```

### Tailwind Classes Used

**Layout**:
- `grid grid-cols-7` - 7-column calendar grid
- `aspect-square` - Square cells
- `space-y-3` - Vertical spacing between elements
- `gap-1 md:gap-4` - Responsive gaps

**Responsive**:
- `md:hidden` - Hide on desktop (≥768px)
- `hidden md:block` - Show only on desktop
- `text-xs md:text-sm` - Responsive text sizes

**Effects**:
- `hover:scale-105` - Slight zoom on hover
- `transition-all` - Smooth transitions
- `ring-2 ring-[var(--accent-primary)]` - "Today" indicator
- `backdrop-blur-sm` - Modal backdrop blur
- `blur-xl` - Subtle glow effect on P&L cells

**Colors** (using CSS variables):
- `bg-[var(--success)]/20` - 20% opacity green
- `text-[var(--danger)]` - Red text
- `border-[var(--border)]` - Border color

---

## Edge Cases & Quirks

### 1. **Blank Cells at Month Start**

Months don't always start on Sunday. Use `getDay(monthStart)` to calculate leading blanks:

```typescript
const startDay = getDay(monthStart); // 0-6 (Sun-Sat)
const blanks = Array(startDay).fill(null);
```

Example: January 2025 starts on Wednesday (getDay = 3), so render 3 blank cells.

### 2. **Worst Day Color Logic**

The "Worst Day" card uses **actual P&L value** for color, not "worst" designation:

```typescript
// Worst day might still be profitable!
const worst = daysInWeek.reduce((worst, d) => {
    const pnl = getPnLForDate(d);
    return pnl < worst.pnl && pnl !== 0 ? { date: d, pnl } : worst;
}, { date: daysInWeek[0], pnl: Infinity });

// Color based on PnL sign, not "worst" label
<p className={`text-2xl font-bold ${worst.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
```

If all days are profitable, "worst day" will be green.

### 3. **Average Per Day Calculation**

Only counts **trading days** (days with P&L ≠ 0):

```typescript
const tradingDays = daysInWeek.filter(d => getPnLForDate(d) !== 0).length;
const avg = tradingDays > 0 ? weeklyTotalPnL / tradingDays : 0;
```

Does NOT divide by 7 (total days in week).

### 4. **Timezone Handling**

Dates are parsed as ISO strings then formatted in **local timezone**:

```typescript
const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
```

**Implication**:
- A trade closed at `2025-01-15T23:59:59Z` (UTC) will show on:
  - January 15 in EST (UTC-5)
  - January 16 in Tokyo (UTC+9)

For consistent cross-timezone behavior, ensure all exitDate values are stored in UTC and displayed consistently.

### 5. **Modal Click-away Behavior**

```typescript
<div onClick={() => setSelectedDate(null)}>  {/* Backdrop */}
  <div onClick={e => e.stopPropagation()}>  {/* Modal content */}
    {/* Clicking here does NOT close modal */}
  </div>
</div>
```

Must use `stopPropagation()` to prevent clicks inside modal from bubbling to backdrop.

### 6. **Empty State Handling**

If a day has no trades:
- Monthly grid: Shows dash "—" in gray
- Weekly cards: Shows "No Trades" text
- Cards are NOT clickable (`cursor-default`)
- Modal does NOT open

```typescript
const hasTrades = getTradesForDate(date).length > 0;
onClick={() => hasTrades && setSelectedDate(date)}
```

### 7. **Profit Factor Infinity**

When a day has only wins (no losses):

```typescript
const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
```

Display as:
```typescript
{profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
```

### 8. **View Mode Independence**

Mobile and desktop views are **completely independent**:
- User can toggle mobile to "weekly" while desktop stays "monthly"
- Navigation respects device-specific view mode
- Stats displayed (monthly vs weekly) adapt per device
- localStorage keys are separate

### 9. **Current Week/Month Button Logic**

Button only appears when NOT viewing current period:

```typescript
const now = new Date();
const isCurrentPeriod = desktopView === 'weekly'
    ? format(currentDate, 'yyyy-ww') === format(now, 'yyyy-ww')
    : format(currentDate, 'yyyy-MM') === format(now, 'yyyy-MM');

if (isCurrentPeriod) return null;
```

Uses week number comparison for weekly view, month comparison for monthly.

---

## Performance Considerations

### Optimization Strategies

1. **useMemo for Expensive Calculations**:
   - `uniqueExchanges` - Recomputed only when trades change
   - `filteredTrades` - Recomputed when trades or filters change
   - `dailyData` - Aggregation only runs when filtered trades change
   - `monthlyTotalPnL` - Only recalculates when dailyData or currentDate changes
   - Stats (green/red days, weekly totals) - Memoized separately

2. **Lazy Day Stats Calculation**:
   - `getDayStats()` is NOT memoized
   - Only called when user clicks a day
   - Prevents 30+ stats calculations for every day in the month

3. **Conditional Rendering**:
   - Weekly view only renders when selected (not hidden with CSS)
   - Monthly grid only renders when selected
   - Modal only renders when `selectedDate !== null`

4. **Event Handler Optimization**:
   - Click handlers use arrow functions inline (acceptable for this use case)
   - Could be optimized with `useCallback` if performance issues arise

### Potential Bottlenecks

1. **Large Trade Datasets**:
   - 10,000+ trades: Daily aggregation may take ~100-200ms
   - Solution: Consider Web Workers for aggregation, or server-side pre-aggregation

2. **Re-renders on Filter Change**:
   - Changing exchange filter triggers re-aggregation and re-render
   - Solution: Already optimized with useMemo

3. **Modal Rendering**:
   - Opening modal recalculates all day stats (win rate, profit factor, ticker grouping)
   - Solution: Acceptable since it's user-initiated

---

## Implementation Checklist

### Phase 1: Core Structure

- [ ] Set up page component with basic layout
- [ ] Import all required dependencies (date-fns, lucide-react)
- [ ] Create state variables (currentDate, selectedDate, mobileView, desktopView)
- [ ] Implement localStorage persistence for view modes
- [ ] Create trades context integration

### Phase 2: Data Processing

- [ ] Implement trade filtering (status + exchange)
- [ ] Create daily aggregation function (use Map for O(1) lookups)
- [ ] Implement `getPnLForDate(date)` helper
- [ ] Implement `getTradesForDate(date)` helper
- [ ] Create `getDayStats(date)` calculation function
- [ ] Add useMemo for all expensive computations

### Phase 3: Monthly Grid View

- [ ] Calculate month boundaries (startOfMonth, endOfMonth)
- [ ] Generate blank cells for leading days
- [ ] Render 7-column grid with day headers
- [ ] Implement day cells with P&L display
- [ ] Add color coding based on P&L
- [ ] Implement "today" indicator (ring)
- [ ] Add hover effects and click handlers
- [ ] Make responsive (single-letter headers, abbreviated amounts on mobile)

### Phase 4: Weekly Views

- [ ] Calculate week boundaries (startOfWeek, endOfWeek)
- [ ] Implement mobile weekly cards (vertical stack)
- [ ] Implement desktop weekly enhanced view
  - [ ] Weekly stats summary cards
  - [ ] 7-column day cards
  - [ ] Quick stats footer per day
- [ ] Add separate navigation for mobile weekly view

### Phase 5: Navigation & Controls

- [ ] Implement month navigation (prev/next)
- [ ] Implement week navigation (prev/next)
- [ ] Add view mode toggle buttons (mobile + desktop)
- [ ] Implement "Current Week/Month" button with conditional visibility
- [ ] Add date range display (responsive)

### Phase 6: Exchange Filter

- [ ] Create ExchangeFilter component (or integrate existing)
- [ ] Extract unique exchanges from trades
- [ ] Implement multi-select checkboxes
- [ ] Wire up filter state to trade filtering
- [ ] Add "All" option (deselect all)

### Phase 7: Day Detail Modal

- [ ] Create modal backdrop with click-away
- [ ] Implement modal header (date + total P&L + close button)
- [ ] Add key stats grid (4 cards)
- [ ] Add best/worst trade cards
- [ ] Implement P&L by ticker section
- [ ] Add all trades list (sorted by P&L)
- [ ] Make scrollable with max-height
- [ ] Test click-away behavior (stopPropagation)

### Phase 8: Stats & Calculations

- [ ] Calculate monthly totals (P&L, green/red days, win rate)
- [ ] Calculate weekly totals (P&L, green/red days, win rate)
- [ ] Implement best/worst day detection
- [ ] Calculate average per trading day
- [ ] Add profit factor calculation
- [ ] Group trades by ticker with counts

### Phase 9: Styling & Polish

- [ ] Set up CSS variables for theming
- [ ] Apply color coding consistently
- [ ] Add all responsive breakpoints
- [ ] Implement hover effects and transitions
- [ ] Add subtle glow effects on P&L cells
- [ ] Test in both light and dark themes (if applicable)
- [ ] Add loading states (if needed)

### Phase 10: Edge Cases & Testing

- [ ] Test with empty trade data
- [ ] Test with single-day trading history
- [ ] Test timezone edge cases (trades near midnight)
- [ ] Test profit-only and loss-only days
- [ ] Test months starting on different days (blanks)
- [ ] Test responsive behavior at various breakpoints
- [ ] Test localStorage persistence across sessions
- [ ] Test modal on mobile (full-screen behavior)
- [ ] Test with 1000+ trades (performance)
- [ ] Test exchange filter with no matching trades

---

## Implementation Tips

### 1. Start with Data Flow

Before building UI, ensure data flows correctly:
```typescript
console.log('Filtered Trades:', filteredTrades);
console.log('Daily Data:', dailyData);
console.log('Monthly P&L:', monthlyTotalPnL);
```

### 2. Build Views Incrementally

1. Start with monthly grid (desktop only)
2. Add mobile responsiveness
3. Then add weekly views
4. Finally add modal

### 3. Use Placeholder Data

Create mock trades for testing:
```typescript
const mockTrades = [
  { id: '1', exitDate: '2025-01-15T14:00:00Z', pnl: 250, exchange: 'Schwab', status: 'CLOSED', /* ... */ },
  { id: '2', exitDate: '2025-01-15T16:00:00Z', pnl: -150, exchange: 'MEXC', status: 'CLOSED', /* ... */ },
  // ...
];
```

### 4. Test Edge Cases Early

- Empty state (no trades)
- Single trade
- All green days
- All red days
- Months with 28, 29, 30, 31 days
- Leap years

### 5. Component Extraction

Consider extracting reusable components:
- `<DayCell>` - Monthly grid cell
- `<WeeklyCard>` - Weekly view day card
- `<StatCard>` - Reusable stat display
- `<DayModal>` - Full modal component

### 6. Accessibility

- Add `aria-label` to navigation buttons
- Ensure modal can be closed with Escape key
- Add keyboard navigation for day selection
- Use semantic HTML (`<time>` for dates)

---

## Common Issues & Solutions

### Issue 1: Date Aggregation Mismatch

**Problem**: Trades not appearing on expected days

**Solution**: Ensure consistent timezone handling. Use `parseISO` and `format` from date-fns:
```typescript
const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
```

### Issue 2: Modal Won't Close

**Problem**: Clicking inside modal closes it

**Solution**: Add `onClick={e => e.stopPropagation()}` to modal content div

### Issue 3: View Mode Not Persisting

**Problem**: View resets to monthly on refresh

**Solution**: Check localStorage keys match:
```typescript
localStorage.setItem('calendar_mobile_view', newView);
```

### Issue 4: Stats Showing 0% Win Rate

**Problem**: Division by zero when no trades

**Solution**: Check for empty arrays:
```typescript
const winRate = dayTrades.length > 0 ? (wins.length / dayTrades.length) * 100 : 0;
```

### Issue 5: Current Week/Month Button Always Showing

**Problem**: Button doesn't hide when viewing current period

**Solution**: Use proper date comparison:
```typescript
format(currentDate, 'yyyy-ww') === format(now, 'yyyy-ww')  // Weekly
format(currentDate, 'yyyy-MM') === format(now, 'yyyy-MM')  // Monthly
```

### Issue 6: Blank Cells Misaligned

**Problem**: Month starts on wrong day

**Solution**: Ensure `getDay()` returns 0-6 (Sunday-Saturday), not 1-7

### Issue 7: Profit Factor Shows NaN

**Problem**: Division by zero or invalid calculations

**Solution**: Handle edge cases:
```typescript
const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
```

---

## API Integration Points

### Required from Context

```typescript
interface TradeContextType {
  trades: Trade[];  // Array of all trades
}

interface Trade {
  id: string;
  ticker: string;
  exchange: string;
  exitDate: string;  // ISO string
  entryDate: string;  // ISO string
  pnl: number;
  pnlPercentage: number;
  status: 'OPEN' | 'CLOSED';
  direction: 'LONG' | 'SHORT';
  type: 'STOCK' | 'OPTION' | 'FUTURES' | 'FOREX';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  fees?: number;
  notes?: string;
}
```

### External Components

```typescript
// ExchangeFilter component
<ExchangeFilter
  exchanges={string[]}          // List of available exchanges
  selectedExchanges={string[]}  // Currently selected exchanges
  onSelectionChange={(exchanges: string[]) => void}
/>
```

---

## Future Enhancements

### Potential Features

1. **Export Calendar as Image**
   - Screenshot current month/week
   - Share on social media

2. **Heatmap Color Intensity**
   - Scale color opacity based on P&L magnitude
   - Darker green = bigger wins, darker red = bigger losses

3. **Multi-Month View**
   - Show 3 months side-by-side
   - Year-at-a-glance view

4. **Trade Notes on Hover**
   - Tooltip showing trade count + top ticker without clicking

5. **Drag to Select Date Range**
   - Click and drag across multiple days
   - Show aggregated stats for range

6. **Goal Tracking**
   - Set daily/weekly/monthly P&L goals
   - Visual indicator when goals are met

7. **Comparison Mode**
   - Compare current month to previous month
   - Show percentage change

8. **Custom Week Start Day**
   - Allow users to set Monday as week start (international standard)

---

## Dependencies & Versions

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.562.0"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "tailwindcss": "^3.4.17"
  }
}
```

---

## Related Documentation

- [Trade Context Documentation](./TRADE_CONTEXT.md) *(if exists)*
- [Exchange Filter Component](./EXCHANGE_FILTER.md) *(if exists)*
- [Theme System](./THEME_SYSTEM.md) *(if exists)*
- [Date Handling Standards](./DATE_STANDARDS.md) *(if exists)*

---

## File Location

**Source File**: `src/pages/Calendar.tsx` (782 lines)

**Last Updated**: January 2026 (v1.5.0-stable)

---

**End of Technical Specification**

This document should provide everything needed to replicate the Calendar page in another dashboard. For questions or clarifications, refer to the source code at [src/pages/Calendar.tsx](../src/pages/Calendar.tsx).
