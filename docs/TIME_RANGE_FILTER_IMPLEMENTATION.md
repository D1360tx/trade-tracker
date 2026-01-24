# Time Range Filter - Implementation Guide

## Overview

The **TimeRangeFilter** component is a dropdown that allows users to filter data by predefined time periods (Today, This Week, Last Month, etc.) or custom date ranges. It's used across Journal, Dashboard, Reports, and Overview pages.

---

## Component Structure

### File Location
**Component**: `src/components/TimeRangeFilter.tsx`

### Key Features
1. **13 Predefined Time Ranges** (Today through All Time)
2. **Custom Date Range** with dual date pickers
3. **Click-outside to close** behavior
4. **Animated chevron** on dropdown toggle
5. **Active state highlighting** for selected option
6. **Dark mode optimized** with CSS variables

---

## Time Range Options

### Available Ranges

```typescript
export type TimeRange = 'today' | 'yesterday' | 'this_week' | 'last_week' |
    'this_month' | 'last_month' | '30d' | '60d' | '90d' | 'ytd' | 'last_year' | 'all' | 'custom';

const timeRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '60d', label: 'Last 60 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'last_year', label: 'Last Year' },
    { value: 'all', label: 'All Time' },
    { value: 'custom', label: 'Custom' },
];
```

### Date Range Calculations

The `getDateRangeForFilter()` function converts each time range into `{ start: Date; end: Date }`:

```typescript
export const getDateRangeForFilter = (range: TimeRange): { start: Date; end: Date } => {
    const now = new Date();
    const today = startOfDay(now);

    switch (range) {
        case 'today':
            return { start: today, end: now };

        case 'yesterday':
            return { start: subDays(today, 1), end: today };

        case 'this_week':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };

        case 'last_week':
            const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
            return { start: lastWeekStart, end: addDays(lastWeekStart, 7) };

        case 'this_month':
            return { start: startOfMonth(now), end: now };

        case 'last_month':
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            return { start: lastMonthStart, end: endOfMonth(lastMonthStart) };

        case '30d':
            return { start: subDays(now, 30), end: now };

        case '60d':
            return { start: subDays(now, 60), end: now };

        case '90d':
            return { start: subDays(now, 90), end: now };

        case 'ytd':
            return { start: startOfYear(now), end: now };

        case 'last_year':
            const lastYearStart = startOfYear(subYears(now, 1));
            return { start: lastYearStart, end: endOfYear(lastYearStart) };

        case 'all':
            return { start: new Date(0), end: now };

        case 'custom':
        default:
            return { start: new Date(0), end: now };
    }
};
```

**Important Notes**:

1. **Week starts on Monday** (`weekStartsOn: 1`)
   - Sunday = 0, Monday = 1
   - Change to `0` for Sunday-starting weeks

2. **"This Week" includes today**
   - Start: Monday 00:00:00
   - End: Current moment

3. **"All Time"**
   - Start: Unix epoch (Jan 1, 1970)
   - End: Current moment

---

## Component Props

```typescript
interface TimeRangeFilterProps {
    selectedRange: TimeRange;                    // Current selected range
    onRangeChange: (range: TimeRange) => void;   // Callback when range changes
    customStartDate?: string;                    // Custom start (YYYY-MM-DD format)
    customEndDate?: string;                      // Custom end (YYYY-MM-DD format)
    onCustomDateChange?: (start: string, end: string) => void; // Custom date callback
}
```

### Required Props
- `selectedRange`: The currently active time range
- `onRangeChange`: Handler called when user selects a range

### Optional Props (for Custom Range)
- `customStartDate`: ISO date string (e.g., "2025-01-15")
- `customEndDate`: ISO date string (e.g., "2025-01-21")
- `onCustomDateChange`: Handler for custom date changes

---

## Usage Example (From Journal Page)

### 1. State Setup

```typescript
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import { isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

const MyPage = () => {
    // State for time range filter
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Your data source (trades, transactions, etc.)
    const { trades } = useTrades();

    // ... rest of component
};
```

### 2. Add Filter to Page

```tsx
<TimeRangeFilter
    selectedRange={timeRange}
    onRangeChange={setTimeRange}
    customStartDate={customStart}
    customEndDate={customEnd}
    onCustomDateChange={(start, end) => {
        setCustomStart(start);
        setCustomEnd(end);
    }}
/>
```

### 3. Apply Filter to Data

```typescript
const filteredData = useMemo(() => {
    let result = [...trades];

    // Apply time range filter
    if (timeRange !== 'all') {
        let dateRange;

        // Handle custom range separately
        if (timeRange === 'custom' && customStart) {
            const now = new Date();
            dateRange = {
                start: startOfDay(new Date(customStart)),
                end: customEnd ? endOfDay(new Date(customEnd)) : now
            };
        } else {
            // Use built-in date range calculator
            dateRange = getDateRangeForFilter(timeRange);
        }

        const { start, end } = dateRange;

        // Filter by date range
        if (start) result = result.filter(item => isAfter(new Date(item.date), start));
        if (end) result = result.filter(item => isBefore(new Date(item.date), end));
    }

    return result;
}, [trades, timeRange, customStart, customEnd]);
```

---

## Complete Implementation Example

Here's a full working example:

```tsx
import React, { useState, useMemo } from 'react';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import { isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

interface DataItem {
    id: string;
    date: string; // ISO date string
    value: number;
    // ... other fields
}

const MyDashboard: React.FC = () => {
    // Sample data
    const [data] = useState<DataItem[]>([
        { id: '1', date: '2025-01-20T10:00:00Z', value: 100 },
        { id: '2', date: '2025-01-15T14:30:00Z', value: 200 },
        // ... more data
    ]);

    // Time range state
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Apply time range filter
    const filteredData = useMemo(() => {
        if (timeRange === 'all') return data;

        let dateRange;

        if (timeRange === 'custom' && customStart) {
            const now = new Date();
            dateRange = {
                start: startOfDay(new Date(customStart)),
                end: customEnd ? endOfDay(new Date(customEnd)) : now
            };
        } else {
            dateRange = getDateRangeForFilter(timeRange);
        }

        const { start, end } = dateRange;

        return data.filter(item => {
            const itemDate = new Date(item.date);
            if (start && !isAfter(itemDate, start)) return false;
            if (end && !isBefore(itemDate, end)) return false;
            return true;
        });
    }, [data, timeRange, customStart, customEnd]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1>My Dashboard</h1>

                {/* Time Range Filter */}
                <TimeRangeFilter
                    selectedRange={timeRange}
                    onRangeChange={setTimeRange}
                    customStartDate={customStart}
                    customEndDate={customEnd}
                    onCustomDateChange={(start, end) => {
                        setCustomStart(start);
                        setCustomEnd(end);
                    }}
                />
            </div>

            {/* Display filtered data */}
            <div>
                <p>Showing {filteredData.length} items</p>
                {filteredData.map(item => (
                    <div key={item.id}>{item.value}</div>
                ))}
            </div>
        </div>
    );
};

export default MyDashboard;
```

---

## UI Component Breakdown

### Button (Trigger)

```tsx
<button
    onClick={() => setIsOpen(!isOpen)}
    className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
>
    <Calendar size={16} className="text-[var(--text-secondary)]" />
    <span>{selectedLabel}</span>
    <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
</button>
```

**Features**:
- Calendar icon on left
- Selected label text in middle
- Chevron icon on right (rotates 180° when open)
- Hover effect on border

### Dropdown Menu

```tsx
{isOpen && (
    <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1">
        {timeRangeOptions.map(option => (
            <button
                key={option.value}
                onClick={() => {
                    onRangeChange(option.value);
                    if (option.value !== 'custom') {
                        setIsOpen(false); // Close dropdown unless custom
                    }
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    selectedRange === option.value
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
            >
                {option.label}
            </button>
        ))}

        {/* Custom date inputs (shown when Custom is selected) */}
        {selectedRange === 'custom' && onCustomDateChange && (
            <div className="px-3 py-2 border-t border-[var(--border)] space-y-2">
                <input
                    type="date"
                    value={customStartDate || ''}
                    onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
                    className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                    style={{ colorScheme: 'dark' }}
                />
                <input
                    type="date"
                    value={customEndDate || ''}
                    onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
                    className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                    style={{ colorScheme: 'dark' }}
                />
            </div>
        )}
    </div>
)}
```

**Features**:
- Positioned absolutely (right-aligned)
- Width: 192px (`w-48`)
- Active option highlighted with blue background
- Hover effect on non-active options
- Custom date inputs appear at bottom when "Custom" selected
- Dropdown stays open when "Custom" selected (for date picking)

### Click-Outside Behavior

```typescript
const dropdownRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**How it works**:
1. Attach ref to container div
2. Listen for clicks anywhere on document
3. If click is outside container, close dropdown
4. Clean up listener on unmount

---

## Styling & Theme Variables

### Required CSS Variables

```css
:root {
  --bg-primary: #0f172a;      /* Page background */
  --bg-secondary: #1e293b;    /* Dropdown background */
  --bg-tertiary: #334155;     /* Button background, input background */
  --text-primary: #f1f5f9;    /* Main text */
  --text-secondary: #94a3b8;  /* Icon color */
  --text-tertiary: #64748b;   /* Muted text */
  --accent-primary: #3b82f6;  /* Blue for active state */
  --border: #475569;          /* Borders */
}
```

### Tailwind Classes Used

**Layout**:
- `relative` - Container positioning
- `absolute right-0 mt-2` - Dropdown positioning (right-aligned, 8px below)
- `z-50` - Ensure dropdown appears above other content

**Sizing**:
- `w-48` - Dropdown width (192px)
- `px-3 py-2` - Button padding
- `text-sm` / `text-xs` - Font sizes

**Colors** (using CSS variables):
- `bg-[var(--bg-tertiary)]` - Background
- `text-[var(--text-primary)]` - Text color
- `border-[var(--border)]` - Border color

**Effects**:
- `hover:bg-[var(--bg-tertiary)]` - Hover state
- `transition-colors` - Smooth color transitions
- `transition-transform` - Chevron rotation animation
- `shadow-xl` - Dropdown shadow

---

## Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.562.0"
  }
}
```

### date-fns Functions Used

```typescript
import {
    startOfDay,
    subDays,
    startOfWeek,
    addDays,
    startOfYear,
    startOfMonth,
    subMonths,
    endOfMonth,
    subYears,
    endOfYear,
    isAfter,
    isBefore,
    endOfDay
} from 'date-fns';
```

### Lucide Icons Used

```typescript
import { ChevronDown, Calendar } from 'lucide-react';
```

---

## Edge Cases & Gotchas

### 1. Week Start Day

**Default**: Monday (`weekStartsOn: 1`)

To change to Sunday:
```typescript
case 'this_week':
    return { start: startOfWeek(now, { weekStartsOn: 0 }), end: now };
```

### 2. Custom Range Validation

The component **does not validate** that end date >= start date. You may want to add:

```typescript
onCustomDateChange={(start, end) => {
    if (end && start && new Date(end) < new Date(start)) {
        alert('End date must be after start date');
        return;
    }
    setCustomStart(start);
    setCustomEnd(end);
}}
```

### 3. Timezone Handling

All dates use **local timezone**:
- `startOfDay(now)` returns midnight in user's timezone
- `new Date()` returns current moment in user's timezone

**Cross-timezone Issues**:
- User in EST sees different ranges than user in PST
- Solution: Convert to UTC or force specific timezone

### 4. "All Time" Performance

`{ start: new Date(0), end: now }` starts at Unix epoch (1970).

For large datasets, consider:
- Limiting "All Time" to reasonable range (e.g., last 5 years)
- Implementing pagination
- Using virtual scrolling

### 5. Date Input Browser Support

```tsx
<input type="date" style={{ colorScheme: 'dark' }} />
```

`colorScheme: 'dark'` forces dark calendar popup in supported browsers.

**Fallback**: On older browsers, renders as text input. Consider adding date validation.

---

## Customization Options

### Add New Time Ranges

To add "Last 7 Days":

1. **Add to type**:
```typescript
export type TimeRange = 'today' | 'yesterday' | 'this_week' | 'last_week' |
    'this_month' | 'last_month' | '7d' | '30d' | '60d' | '90d' | 'ytd' | 'last_year' | 'all' | 'custom';
```

2. **Add to options array**:
```typescript
{ value: '7d', label: 'Last 7 Days' },
```

3. **Add case to calculator**:
```typescript
case '7d':
    return { start: subDays(now, 7), end: now };
```

### Change Dropdown Position

**Left-aligned**:
```tsx
<div className="absolute left-0 mt-2 ...">
```

**Centered**:
```tsx
<div className="absolute left-1/2 -translate-x-1/2 mt-2 ...">
```

### Change Button Style

**Icon-only button**:
```tsx
<button className="p-2 rounded-lg ...">
    <Calendar size={20} />
</button>
```

**Different color scheme**:
```tsx
<button className="bg-blue-500 text-white hover:bg-blue-600 ...">
```

---

## Performance Considerations

### Memoization

Always wrap filtered data in `useMemo`:

```typescript
const filteredData = useMemo(() => {
    // filtering logic
}, [data, timeRange, customStart, customEnd]);
```

**Why**: Prevents re-filtering on every render

### Dependencies

Only include variables that affect filtering:
- `data` - Source data
- `timeRange` - Selected range
- `customStart` - Custom start date (if using custom range)
- `customEnd` - Custom end date (if using custom range)

**Don't include**: UI state like `isOpen`, `showFilters`, etc.

---

## Testing Checklist

### Functionality
- [ ] Clicking button toggles dropdown
- [ ] Clicking option closes dropdown (except Custom)
- [ ] Clicking outside closes dropdown
- [ ] Selected option is highlighted
- [ ] Chevron rotates when open
- [ ] Custom date inputs appear when "Custom" selected
- [ ] Custom dates update when changed
- [ ] Date filtering works for all ranges

### Edge Cases
- [ ] "This Week" includes today
- [ ] "Last Week" is full 7-day period
- [ ] "Last Month" includes full month (1st to last day)
- [ ] "All Time" shows all data
- [ ] Custom range with only start date works
- [ ] Custom range with both dates works
- [ ] Switching from Custom to another range clears custom dates

### Visual
- [ ] Dropdown aligns correctly (right edge)
- [ ] Active state is visible
- [ ] Hover states work
- [ ] Icons render correctly
- [ ] Text is readable in dark mode
- [ ] Dropdown has proper shadow
- [ ] Date inputs have dark calendar picker (if supported)

---

## Integration with Other Filters

Commonly combined with:

### 1. Exchange Filter

```tsx
<div className="flex items-center gap-3">
    <ExchangeFilter
        exchanges={uniqueExchanges}
        selectedExchanges={selectedExchanges}
        onSelectionChange={setSelectedExchanges}
    />
    <TimeRangeFilter
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
    />
</div>
```

### 2. Search Filter

```tsx
<div className="flex items-center gap-3">
    <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
            type="text"
            placeholder="Search ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg"
        />
    </div>
    <TimeRangeFilter
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
    />
</div>
```

### 3. Multiple Filters (Journal Example)

```tsx
<div className="flex flex-wrap items-center gap-3">
    {/* Search */}
    <input type="text" ... />

    {/* Exchange Filter */}
    <ExchangeFilter ... />

    {/* Time Range Filter */}
    <TimeRangeFilter ... />

    {/* Strategy Filter */}
    <select ...>
        <option value="">All Strategies</option>
        {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
</div>
```

---

## Common Patterns

### Pattern 1: Filter + Statistics

Show filtered count alongside filter:

```tsx
<div className="flex items-center justify-between">
    <p className="text-sm text-[var(--text-secondary)]">
        Showing {filteredData.length} of {allData.length} items
    </p>
    <TimeRangeFilter
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
    />
</div>
```

### Pattern 2: Persist to localStorage

Remember user's last selection:

```typescript
const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem('my_page_time_range');
    return (saved as TimeRange) || 'all';
});

const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    localStorage.setItem('my_page_time_range', range);
};
```

### Pattern 3: Reset All Filters

```tsx
<button onClick={() => {
    setTimeRange('all');
    setCustomStart('');
    setCustomEnd('');
    setSearchQuery('');
    setSelectedExchanges([]);
}}>
    <RotateCcw size={16} />
    Reset Filters
</button>
```

---

## Accessibility

### Keyboard Navigation

Add keyboard support:

```tsx
<button
    onClick={() => setIsOpen(!isOpen)}
    onKeyDown={(e) => {
        if (e.key === 'Escape') setIsOpen(false);
        if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen);
    }}
    aria-expanded={isOpen}
    aria-haspopup="listbox"
>
```

### Screen Readers

Add ARIA labels:

```tsx
<button aria-label="Filter by time range">
    <Calendar size={16} aria-hidden="true" />
    <span>{selectedLabel}</span>
</button>
```

---

## Troubleshooting

### Dropdown Doesn't Close

**Issue**: Clicking outside doesn't close dropdown

**Solution**: Ensure ref is attached to container:
```tsx
<div className="relative" ref={dropdownRef}>
```

### Dates Not Filtering Correctly

**Issue**: Trades not showing up in range

**Debug**:
```typescript
console.log('Date Range:', getDateRangeForFilter(timeRange));
console.log('Trade Date:', new Date(trade.exitDate));
console.log('Is After Start:', isAfter(new Date(trade.exitDate), dateRange.start));
```

### Custom Dates Not Working

**Issue**: Custom range not applying

**Check**:
1. Are `customStartDate` and `customEndDate` in correct format? (YYYY-MM-DD)
2. Is `onCustomDateChange` handler updating state?
3. Is filtering logic checking for `timeRange === 'custom'`?

---

## Migration Guide

### From Other Date Pickers

If migrating from another date picker (e.g., react-datepicker, Material-UI DatePicker):

**Before**:
```tsx
<DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onChange={(start, end) => {
        setStartDate(start);
        setEndDate(end);
    }}
/>
```

**After**:
```tsx
<TimeRangeFilter
    selectedRange={timeRange}
    onRangeChange={setTimeRange}
    customStartDate={customStart}
    customEndDate={customEnd}
    onCustomDateChange={(start, end) => {
        setCustomStart(start);
        setCustomEnd(end);
    }}
/>
```

**Filter logic changes**:
```typescript
// Before
const filtered = data.filter(item =>
    item.date >= startDate && item.date <= endDate
);

// After
if (timeRange !== 'all') {
    const dateRange = getDateRangeForFilter(timeRange);
    filtered = data.filter(item =>
        isAfter(new Date(item.date), dateRange.start) &&
        isBefore(new Date(item.date), dateRange.end)
    );
}
```

---

## File Location

**Component**: `src/components/TimeRangeFilter.tsx`

**Used In**:
- `src/pages/Journal.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/ReportsPage.tsx`
- `src/pages/OverviewPage.tsx`

**Dependencies**:
- `date-fns` (v4.1.0+)
- `lucide-react` (v0.562.0+)

---

**End of Implementation Guide**

For questions or issues, refer to the source code at [src/components/TimeRangeFilter.tsx](../src/components/TimeRangeFilter.tsx) or check usage examples in [src/pages/Journal.tsx](../src/pages/Journal.tsx).
