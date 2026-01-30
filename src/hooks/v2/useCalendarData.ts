import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getWeek, startOfWeek, endOfWeek, getYear, getMonth } from 'date-fns';
import type { Trade } from '../../types';

export interface CalendarDayData {
    date: string; // yyyy-MM-dd
    dayOfMonth: number;
    pnl: number;
    winRate: number;
    tradeCount: number;
    winCount: number;
    lossCount: number;
    trades: Trade[];
    isCurrentMonth: boolean;
}

export interface WeeklyData {
    weekNumber: number;
    weekLabel: string;
    startDate: string;
    endDate: string;
    pnl: number;
    tradingDays: number;
}

export interface MonthlyCalendarData {
    year: number;
    month: number; // 0-indexed
    monthName: string;
    pnl: number;
    winRate: number;
    tradeCount: number;
}

export interface YearlyData {
    year: number;
    months: MonthlyCalendarData[];
    totalPnL: number;
    totalTrades: number;
    avgWinRate: number;
}

// Group trades by exit date (yyyy-MM-dd)
const groupTradesByDay = (trades: Trade[]): Record<string, Trade[]> => {
    const grouped: Record<string, Trade[]> = {};
    trades.filter(t => t.status === 'CLOSED').forEach(t => {
        const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(t);
    });
    return grouped;
};

export const useCalendarDays = (trades: Trade[], year: number, month: number): CalendarDayData[] => {
    return useMemo(() => {
        const targetDate = new Date(year, month, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        // Get all days to display (including padding from adjacent months)
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const tradesByDay = groupTradesByDay(trades);

        return allDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTrades = tradesByDay[dateStr] || [];
            const pnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
            const winCount = dayTrades.filter(t => t.pnl > 0).length;
            const lossCount = dayTrades.filter(t => t.pnl < 0).length;
            const winRate = dayTrades.length > 0 ? (winCount / dayTrades.length) * 100 : 0;

            return {
                date: dateStr,
                dayOfMonth: day.getDate(),
                pnl,
                winRate,
                tradeCount: dayTrades.length,
                winCount,
                lossCount,
                trades: dayTrades,
                isCurrentMonth: getMonth(day) === month,
            };
        });
    }, [trades, year, month]);
};

export const useWeeklyData = (trades: Trade[], year: number, month: number): WeeklyData[] => {
    return useMemo(() => {
        const targetDate = new Date(year, month, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        // Get all days in the month
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const tradesByDay = groupTradesByDay(trades);

        // Group by week number
        const weekMap: Record<number, { days: string[]; pnl: number }> = {};

        allDays.forEach(day => {
            const weekIdx = getWeek(day, { weekStartsOn: 0 });
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayTrades = tradesByDay[dateStr] || [];
            const dayPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);

            if (!weekMap[weekIdx]) {
                weekMap[weekIdx] = { days: [], pnl: 0 };
            }
            weekMap[weekIdx].days.push(dateStr);
            weekMap[weekIdx].pnl += dayPnL;
        });

        // Convert to array and calculate trading days
        return Object.entries(weekMap)
            .map(([_weekNum, data], index) => {
                const tradingDays = data.days.filter(d => tradesByDay[d]?.length > 0).length;
                const sortedDays = data.days.sort();

                return {
                    weekNumber: index + 1, // Week 1, 2, 3, 4, 5
                    weekLabel: `Week ${index + 1}`,
                    startDate: sortedDays[0],
                    endDate: sortedDays[sortedDays.length - 1],
                    pnl: data.pnl,
                    tradingDays,
                };
            })
            .sort((a, b) => a.weekNumber - b.weekNumber);
    }, [trades, year, month]);
};

export const useMonthlyCalendarData = (trades: Trade[], year: number): MonthlyCalendarData[] => {
    return useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');

        // Group trades by month
        const monthlyMap: Record<number, Trade[]> = {};
        closedTrades.forEach(t => {
            const tradeDate = parseISO(t.exitDate);
            if (getYear(tradeDate) === year) {
                const month = getMonth(tradeDate);
                if (!monthlyMap[month]) monthlyMap[month] = [];
                monthlyMap[month].push(t);
            }
        });

        // Create data for all 12 months
        return Array.from({ length: 12 }, (_, month) => {
            const monthTrades = monthlyMap[month] || [];
            const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
            const winCount = monthTrades.filter(t => t.pnl > 0).length;
            const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length) * 100 : 0;

            return {
                year,
                month,
                monthName: format(new Date(year, month), 'MMM'),
                pnl,
                winRate,
                tradeCount: monthTrades.length,
            };
        });
    }, [trades, year]);
};

export const useYearlyData = (trades: Trade[]): YearlyData[] => {
    return useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');

        // Group trades by year
        const yearMap: Record<number, Trade[]> = {};
        closedTrades.forEach(t => {
            const year = getYear(parseISO(t.exitDate));
            if (!yearMap[year]) yearMap[year] = [];
            yearMap[year].push(t);
        });

        // Create yearly data
        return Object.entries(yearMap)
            .map(([yearStr, yearTrades]) => {
                const year = parseInt(yearStr);
                const totalPnL = yearTrades.reduce((sum, t) => sum + t.pnl, 0);
                const winCount = yearTrades.filter(t => t.pnl > 0).length;
                const avgWinRate = yearTrades.length > 0 ? (winCount / yearTrades.length) * 100 : 0;

                // Get monthly breakdown
                const months: MonthlyCalendarData[] = Array.from({ length: 12 }, (_, month) => {
                    const monthTrades = yearTrades.filter(t => getMonth(parseISO(t.exitDate)) === month);
                    const pnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
                    const monthWins = monthTrades.filter(t => t.pnl > 0).length;
                    const winRate = monthTrades.length > 0 ? (monthWins / monthTrades.length) * 100 : 0;

                    return {
                        year,
                        month,
                        monthName: format(new Date(year, month), 'MMM'),
                        pnl,
                        winRate,
                        tradeCount: monthTrades.length,
                    };
                });

                return {
                    year,
                    months,
                    totalPnL,
                    totalTrades: yearTrades.length,
                    avgWinRate,
                };
            })
            .sort((a, b) => b.year - a.year); // Most recent first
    }, [trades]);
};

// Get monthly stats summary (best, worst, average)
export const useMonthlyStatsSummary = (trades: Trade[]) => {
    return useMemo(() => {
        const closedTrades = trades.filter(t => t.status === 'CLOSED');

        // Group by month
        const monthlyMap: Record<string, { pnl: number; monthName: string }> = {};
        closedTrades.forEach(t => {
            const key = format(parseISO(t.exitDate), 'yyyy-MM');
            const monthName = format(parseISO(t.exitDate), 'MMM yyyy');
            if (!monthlyMap[key]) {
                monthlyMap[key] = { pnl: 0, monthName };
            }
            monthlyMap[key].pnl += t.pnl;
        });

        const months = Object.values(monthlyMap);
        if (months.length === 0) {
            return {
                bestMonth: { pnl: 0, monthName: '--' },
                worstMonth: { pnl: 0, monthName: '--' },
                averageMonth: 0,
            };
        }

        const sortedByPnl = [...months].sort((a, b) => b.pnl - a.pnl);
        const totalPnL = months.reduce((sum, m) => sum + m.pnl, 0);

        return {
            bestMonth: sortedByPnl[0],
            worstMonth: sortedByPnl[sortedByPnl.length - 1],
            averageMonth: totalPnL / months.length,
        };
    }, [trades]);
};

// Get trades for a specific day
export const useTradesForDay = (trades: Trade[], dateStr: string): Trade[] => {
    return useMemo(() => {
        return trades.filter(t => {
            if (t.status !== 'CLOSED') return false;
            const tradeDay = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            return tradeDay === dateStr;
        }).sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
    }, [trades, dateStr]);
};

// Get running P&L for a day (cumulative within the day)
export const useDayRunningPnL = (dayTrades: Trade[]): { time: string; pnl: number }[] => {
    return useMemo(() => {
        if (dayTrades.length === 0) return [];

        const sorted = [...dayTrades].sort(
            (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        let cumulative = 0;
        return sorted.map(t => {
            cumulative += t.pnl;
            return {
                time: format(parseISO(t.exitDate), 'HH:mm'),
                pnl: cumulative,
            };
        });
    }, [dayTrades]);
};
