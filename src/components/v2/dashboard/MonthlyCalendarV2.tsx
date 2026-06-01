import { ChevronLeft, ChevronRight, Settings, Camera, Info } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useCalendarDays, type CalendarDayData } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface MonthlyCalendarV2Props {
    trades: Trade[];
    onDayClick: (date: string, trades: Trade[]) => void;
    currentDate: Date;
    onCurrentDateChange: (date: Date) => void;
}

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const getDayBgColor = (day: CalendarDayData): string => {
    if (!day.isCurrentMonth) return 'transparent';
    if (day.tradeCount === 0) return 'transparent';
    if (day.pnl > 0) return 'rgba(46, 176, 134, 0.15)'; // success with opacity
    if (day.pnl < 0) return 'rgba(246, 71, 93, 0.15)'; // danger with opacity
    return 'rgba(96, 165, 250, 0.15)'; // blue for breakeven
};

const getDayBorderColor = (day: CalendarDayData): string => {
    if (!day.isCurrentMonth) return 'transparent';
    if (day.tradeCount === 0) return 'var(--border)';
    if (day.pnl > 0) return 'var(--success)';
    if (day.pnl < 0) return 'var(--danger)';
    return 'rgb(96, 165, 250)'; // blue for breakeven
};

const MonthlyCalendarV2 = ({ trades, onDayClick, currentDate, onCurrentDateChange }: MonthlyCalendarV2Props) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarDays = useCalendarDays(trades, year, month);

    // Calculate monthly stats
    const monthDays = calendarDays.filter(d => d.isCurrentMonth);
    const monthlyPnL = monthDays.reduce((sum, d) => sum + d.pnl, 0);
    const tradingDays = monthDays.filter(d => d.tradeCount > 0).length;

    const goToPrevMonth = () => onCurrentDateChange(subMonths(currentDate, 1));
    const goToNextMonth = () => onCurrentDateChange(addMonths(currentDate, 1));
    const goToThisMonth = () => onCurrentDateChange(new Date());

    const today = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="glass-panel rounded-xl flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col gap-3 px-3 py-3 border-b border-[var(--border)] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2">
                <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <button
                        onClick={goToPrevMonth}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors sm:p-1"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
                    </button>
                    <span className="text-base font-semibold text-[var(--text-primary)] min-w-0 flex-1 text-center sm:min-w-[120px] sm:flex-none sm:text-sm sm:font-medium">
                        {format(currentDate, 'MMMM yyyy')}
                    </span>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors sm:p-1"
                        aria-label="Next month"
                    >
                        <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                    </button>
                    <button
                        onClick={goToThisMonth}
                        className="hidden ml-2 px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors sm:inline-flex"
                    >
                        This month
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-4">
                    <button
                        onClick={goToThisMonth}
                        className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors sm:hidden"
                    >
                        This month
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="hidden text-xs text-[var(--text-secondary)] sm:inline">Monthly stats:</span>
                        <span className={`text-sm font-medium ${monthlyPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {formatCurrency(monthlyPnL)}
                        </span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{tradingDays} days</span>
                    <div className="hidden items-center gap-1 sm:flex">
                        <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                            <Settings size={14} className="text-[var(--text-tertiary)]" />
                        </button>
                        <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                            <Camera size={14} className="text-[var(--text-tertiary)]" />
                        </button>
                        <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
                            <Info size={14} className="text-[var(--text-tertiary)]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-2 flex-1 flex flex-col min-w-0 sm:p-3">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[10px] text-[var(--text-tertiary)] py-1 sm:text-xs">
                            <span className="sm:hidden">{day[0]}</span>
                            <span className="hidden sm:inline">{day}</span>
                        </div>
                    ))}
                </div>

                {/* Calendar days - expands to fill available space */}
                <div className="grid grid-cols-7 gap-1 sm:flex-1 sm:[grid-template-rows:repeat(6,minmax(5.5rem,1fr))]">
                    {calendarDays.map((day, index) => {
                        const isToday = day.date === today;

                        return (
                            <button
                                key={index}
                                onClick={() => day.isCurrentMonth && day.tradeCount > 0 && onDayClick(day.date, day.trades)}
                                disabled={!day.isCurrentMonth || day.tradeCount === 0}
                                className={`
                                    relative min-h-[3.75rem] overflow-hidden rounded-lg border px-1 py-1 transition-all sm:min-h-[5.5rem] sm:p-2
                                    ${day.isCurrentMonth ? 'cursor-pointer hover:brightness-110' : 'opacity-30 cursor-default'}
                                    ${day.tradeCount > 0 ? 'border-l-2' : ''}
                                `}
                                style={{
                                    backgroundColor: getDayBgColor(day),
                                    borderColor: day.tradeCount > 0 ? 'transparent' : 'var(--border)',
                                    borderLeftColor: getDayBorderColor(day),
                                }}
                            >
                                {/* Day number */}
                                <div className={`
                                    absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] sm:w-6 sm:h-6 sm:text-xs
                                    ${isToday ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}
                                `}>
                                    {day.dayOfMonth}
                                </div>

                                {/* P&L and win rate */}
                                {day.isCurrentMonth && day.tradeCount > 0 && (
                                    <div className="absolute bottom-1 left-1 right-1 min-w-0 text-center sm:bottom-2 sm:left-2 sm:right-2 sm:text-left">
                                        <div className={`truncate text-[11px] font-semibold leading-tight sm:text-sm ${day.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {formatCurrency(day.pnl)}
                                        </div>
                                        <div className="truncate text-[9px] leading-tight text-[var(--text-tertiary)] sm:text-[10px]">
                                            {day.winRate.toFixed(day.winRate % 1 === 0 ? 0 : 1)}%
                                        </div>
                                    </div>
                                )}

                                {/* Breakeven indicator */}
                                {day.isCurrentMonth && day.tradeCount > 0 && day.pnl === 0 && (
                                    <div className="absolute bottom-1 left-1 right-1 text-center sm:bottom-2 sm:left-2 sm:right-2 sm:text-left">
                                        <div className="text-[11px] font-semibold text-[rgb(96,165,250)] sm:text-sm">$0</div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MonthlyCalendarV2;
