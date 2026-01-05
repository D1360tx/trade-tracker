import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { startOfDay, subDays, startOfWeek, addDays, startOfYear, startOfMonth, subMonths, endOfMonth } from 'date-fns';

export type TimeRange = 'today' | 'yesterday' | 'this_week' | 'last_week' |
    'this_month' | 'last_month' | '30d' | '60d' | '90d' | 'ytd' | 'all' | 'custom';

interface TimeRangeFilterProps {
    selectedRange: TimeRange;
    onRangeChange: (range: TimeRange) => void;
    customStartDate?: string;
    customEndDate?: string;
    onCustomDateChange?: (start: string, end: string) => void;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
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
    { value: 'all', label: 'All Time' },
    { value: 'custom', label: 'Custom' },
];

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
        case 'all':
            return { start: new Date(0), end: now };
        case 'custom':
        default:
            return { start: new Date(0), end: now };
    }
};

const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
    selectedRange,
    onRangeChange,
    customStartDate,
    customEndDate,
    onCustomDateChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
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

    const selectedLabel = timeRangeOptions.find(opt => opt.value === selectedRange)?.label || 'Select Range';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
                <Calendar size={16} className="text-[var(--text-secondary)]" />
                <span>{selectedLabel}</span>
                <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1">
                    {timeRangeOptions.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onRangeChange(option.value);
                                if (option.value !== 'custom') {
                                    setIsOpen(false);
                                }
                            }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedRange === option.value
                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}

                    {selectedRange === 'custom' && onCustomDateChange && (
                        <div className="px-3 py-2 border-t border-[var(--border)] space-y-2">
                            <input
                                type="date"
                                value={customStartDate || ''}
                                onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
                                className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                            />
                            <input
                                type="date"
                                value={customEndDate || ''}
                                onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
                                className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TimeRangeFilter;
