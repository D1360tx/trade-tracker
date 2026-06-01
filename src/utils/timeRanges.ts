import {
    addDays,
    endOfDay,
    endOfMonth,
    endOfYear,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subDays,
    subMonths,
    subYears,
    parseISO,
} from 'date-fns';

export type TimeRange =
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | '30d'
    | '60d'
    | '90d'
    | 'ytd'
    | 'last_year'
    | 'all'
    | 'custom';

export const timeRangeOptions: { value: TimeRange; label: string }[] = [
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

export const getDateRangeForFilter = (range: TimeRange, now: Date = new Date()): { start: Date; end: Date } => {
    const today = startOfDay(now);

    switch (range) {
        case 'today':
            return { start: today, end: now };
        case 'yesterday':
            return { start: subDays(today, 1), end: endOfDay(subDays(today, 1)) };
        case 'this_week':
            return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
        case 'last_week': {
            const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
            return { start: lastWeekStart, end: endOfDay(addDays(lastWeekStart, 6)) };
        }
        case 'this_month':
            return { start: startOfMonth(now), end: now };
        case 'last_month': {
            const lastMonthStart = startOfMonth(subMonths(now, 1));
            return { start: lastMonthStart, end: endOfMonth(lastMonthStart) };
        }
        case '30d':
            return { start: subDays(now, 30), end: now };
        case '60d':
            return { start: subDays(now, 60), end: now };
        case '90d':
            return { start: subDays(now, 90), end: now };
        case 'ytd':
            return { start: startOfYear(now), end: now };
        case 'last_year': {
            const lastYearStart = startOfYear(subYears(now, 1));
            return { start: lastYearStart, end: endOfYear(lastYearStart) };
        }
        case 'all':
        case 'custom':
        default:
            return { start: new Date(0), end: now };
    }
};

export const getCustomDateRangeForFilter = (
    customStart: string,
    customEnd: string,
    now: Date = new Date()
): { start: Date; end: Date } | undefined => {
    if (!customStart) return undefined;

    return {
        start: startOfDay(parseISO(customStart)),
        end: customEnd ? endOfDay(parseISO(customEnd)) : now,
    };
};

export const getCalendarAnchorDateForRange = (
    range: TimeRange,
    options: {
        customStart?: string;
        customEnd?: string;
        now?: Date;
    } = {}
): Date => {
    const now = options.now ?? new Date();

    if (range === 'all') return now;

    if (range === 'custom') {
        if (options.customEnd) return parseISO(options.customEnd);
        if (options.customStart) return parseISO(options.customStart);
        return now;
    }

    if (range === 'ytd') return now;

    return getDateRangeForFilter(range, now).end;
};
