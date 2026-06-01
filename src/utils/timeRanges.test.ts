import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
    getCalendarAnchorDateForRange,
    getCustomDateRangeForFilter,
    getDateRangeForFilter
} from './timeRanges';

const day = (date: Date) => format(date, 'yyyy-MM-dd');
const now = new Date('2026-06-15T15:30:00.000Z');

describe('time range calendar anchors', () => {
    it('anchors last month to the previous month', () => {
        expect(day(getCalendarAnchorDateForRange('last_month', { now }))).toBe('2026-05-31');
    });

    it('anchors yesterday to yesterday even across month boundaries', () => {
        const firstOfMonth = new Date('2026-06-01T15:30:00.000Z');

        expect(day(getCalendarAnchorDateForRange('yesterday', { now: firstOfMonth }))).toBe('2026-05-31');
    });

    it('anchors rolling ranges to the range end date', () => {
        expect(day(getCalendarAnchorDateForRange('30d', { now }))).toBe('2026-06-15');
        expect(day(getCalendarAnchorDateForRange('60d', { now }))).toBe('2026-06-15');
        expect(day(getCalendarAnchorDateForRange('90d', { now }))).toBe('2026-06-15');
    });

    it('anchors custom ranges to end date when present, otherwise start date', () => {
        expect(day(getCalendarAnchorDateForRange('custom', {
            customStart: '2026-04-15',
            customEnd: '2026-05-20',
            now
        }))).toBe('2026-05-20');
        expect(day(getCalendarAnchorDateForRange('custom', {
            customStart: '2026-04-15',
            now
        }))).toBe('2026-04-15');
    });
});

describe('date ranges', () => {
    it('builds inclusive custom date ranges through the end date', () => {
        const range = getCustomDateRangeForFilter('2026-05-01', '2026-05-31');

        expect(range).toBeDefined();
        expect(day(range!.start)).toBe('2026-05-01');
        expect(day(range!.end)).toBe('2026-05-31');
        expect(range!.end.getHours()).toBe(23);
        expect(range!.end.getMinutes()).toBe(59);
    });

    it('keeps last month range in the previous calendar month', () => {
        const range = getDateRangeForFilter('last_month', now);

        expect(day(range.start)).toBe('2026-05-01');
        expect(day(range.end)).toBe('2026-05-31');
    });
});
