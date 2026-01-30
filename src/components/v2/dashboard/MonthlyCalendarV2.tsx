import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings, Camera, Info } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useCalendarDays, type CalendarDayData } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface MonthlyCalendarV2Props {
    trades: Trade[];
    onDayClick: (date: string, trades: Trade[]) => void;
    initialDate?: Date;
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

const MonthlyCalendarV2 = ({ trades, onDayClick, initialDate = new Date() }: MonthlyCalendarV2Props) => {
    const [currentDate, setCurrentDate] = useState(initialDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const calendarDays = useCalendarDays(trades, year, month);

    // Calculate monthly stats
    const monthDays = calendarDays.filter(d => d.isCurrentMonth);
    const monthlyPnL = monthDays.reduce((sum, d) => sum + d.pnl, 0);
    const tradingDays = monthDays.filter(d => d.tradeCount > 0).length;

    const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const goToThisMonth = () => setCurrentDate(new Date());

    const today = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="glass-panel rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevMonth}
                        className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    >
                        <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
                    </button>
                    <span className="text-sm font-medium text-[var(--text-primary)] min-w-[120px] text-center">
                        {format(currentDate, 'MMMM yyyy')}
                    </span>
                    <button
                        onClick={goToNextMonth}
                        className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    >
                        <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                    </button>
                    <button
                        onClick={goToThisMonth}
                        className="ml-2 px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    >
                        This month
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-secondary)]">Monthly stats:</span>
                        <span className={`text-sm font-medium ${monthlyPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {formatCurrency(monthlyPnL)}
                        </span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{tradingDays} days</span>
                    <div className="flex items-center gap-1">
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
            <div className="p-3">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-xs text-[var(--text-tertiary)] py-1">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar days - compact grid */}
                <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: 'repeat(6, minmax(48px, 56px))' }}>
                    {calendarDays.map((day, index) => {
                        const isToday = day.date === today;

                        return (
                            <button
                                key={index}
                                onClick={() => day.isCurrentMonth && day.tradeCount > 0 && onDayClick(day.date, day.trades)}
                                disabled={!day.isCurrentMonth || day.tradeCount === 0}
                                className={`
                                    relative p-2 rounded-lg border transition-all
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
                                    absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full text-xs
                                    ${isToday ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}
                                `}>
                                    {day.dayOfMonth}
                                </div>

                                {/* P&L and win rate */}
                                {day.isCurrentMonth && day.tradeCount > 0 && (
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <div className={`text-sm font-semibold ${day.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {formatCurrency(day.pnl)}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">
                                            {day.winRate.toFixed(day.winRate % 1 === 0 ? 0 : 1)}%
                                        </div>
                                    </div>
                                )}

                                {/* Breakeven indicator */}
                                {day.isCurrentMonth && day.tradeCount > 0 && day.pnl === 0 && (
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <div className="text-sm font-semibold text-[rgb(96,165,250)]">$0</div>
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
