import { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, getDay, addMonths, parseISO, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Calendar as CalendarIcon } from 'lucide-react';
import { useTrades } from '../context/TradeContext';
import ExchangeFilter from '../components/ExchangeFilter';
import type { Trade } from '../types';

const Calendar = () => {
    const { trades } = useTrades();
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Mobile view mode (monthly grid or weekly list)
    const [mobileView, setMobileView] = useState<'monthly' | 'weekly'>(() => {
        const saved = localStorage.getItem('calendar_mobile_view');
        return (saved as 'monthly' | 'weekly') || 'monthly';
    });

    // Desktop view mode (monthly grid or weekly)
    const [desktopView, setDesktopView] = useState<'monthly' | 'weekly'>(() => {
        const saved = localStorage.getItem('calendar_desktop_view');
        return (saved as 'monthly' | 'weekly') || 'monthly';
    });

    // Get unique exchanges for filter dropdown
    const uniqueExchanges = useMemo(() => {
        const exchanges = new Set(trades.map(t => t.exchange));
        return Array.from(exchanges).sort();
    }, [trades]);

    // Get filtered trades
    const filteredTrades = useMemo(() => {
        return trades.filter(t => {
            const isClosed = t.status === 'CLOSED' || t.pnl !== 0;
            const matchesExchange = selectedExchanges.length === 0 || selectedExchanges.includes(t.exchange);
            return isClosed && matchesExchange;
        });
    }, [trades, selectedExchanges]);

    // Aggregation with consistent Local Time parsing and Exchange filtering
    const dailyData = useMemo(() => {
        const map = new Map<string, number>();
        filteredTrades.forEach(t => {
            const dateStr = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            map.set(dateStr, (map.get(dateStr) || 0) + t.pnl);
        });
        return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }));
    }, [filteredTrades]);

    const [currentDate, setCurrentDate] = useState(new Date());

    const handlePrevMonth = () => setCurrentDate(prev => addMonths(prev, -1));
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
    const handlePrevWeek = () => setCurrentDate(prev => addWeeks(prev, -1));
    const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    const blanks = Array(startDay).fill(null);

    // Weekly view data
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const getPnLForDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayData = dailyData.find(d => d.date === dateStr);
        return dayData ? dayData.pnl : 0;
    };

    // Get trades for a specific date
    const getTradesForDate = (date: Date): Trade[] => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return filteredTrades.filter(t => format(parseISO(t.exitDate), 'yyyy-MM-dd') === dateStr);
    };

    // Calculate day stats
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

    const monthlyTotalPnL = useMemo(() => {
        return daysInMonth.reduce((acc, date) => acc + getPnLForDate(date), 0);
    }, [dailyData, currentDate]);

    const { greenDays, redDays } = useMemo(() => {
        let green = 0, red = 0;
        daysInMonth.forEach(date => {
            const pnl = getPnLForDate(date);
            if (pnl > 0) green++;
            else if (pnl < 0) red++;
        });
        return { greenDays: green, redDays: red };
    }, [dailyData, currentDate]);

    // Weekly stats
    const weeklyTotalPnL = useMemo(() => {
        return daysInWeek.reduce((acc, date) => acc + getPnLForDate(date), 0);
    }, [dailyData, currentDate]);

    const { weeklyGreenDays, weeklyRedDays } = useMemo(() => {
        let green = 0, red = 0;
        daysInWeek.forEach(date => {
            const pnl = getPnLForDate(date);
            if (pnl > 0) green++;
            else if (pnl < 0) red++;
        });
        return { weeklyGreenDays: green, weeklyRedDays: red };
    }, [dailyData, currentDate]);

    const getDayClass = (pnl: number) => {
        if (pnl > 0) return 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30';
        if (pnl < 0) return 'bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30';
        return 'bg-[var(--bg-tertiary)]/30 text-[var(--text-tertiary)]';
    };

    const selectedDayStats = selectedDate ? getDayStats(selectedDate) : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">P&L Calendar</h2>
                    {/* Show monthly or weekly stats based on desktop view (on desktop) */}
                    <div className="hidden md:block">
                        {desktopView === 'monthly' ? (
                            <>
                                <p className={`text-sm font-medium mt-1 ${monthlyTotalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    {format(currentDate, 'MMMM')} Total: {monthlyTotalPnL >= 0 ? '+' : ''}${monthlyTotalPnL.toLocaleString()}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-secondary)]">
                                    <span>
                                        <span className="font-medium">Green:</span>{' '}
                                        <span className="font-bold text-[var(--success)]">{greenDays}</span>
                                    </span>
                                    <span>
                                        <span className="font-medium">Red:</span>{' '}
                                        <span className="font-bold text-[var(--danger)]">{redDays}</span>
                                    </span>
                                    {(greenDays + redDays) > 0 && (
                                        <span>
                                            <span className="font-medium">Win Rate:</span>{' '}
                                            <span className={`font-bold ${(greenDays / (greenDays + redDays)) * 100 >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {((greenDays / (greenDays + redDays)) * 100).toFixed(0)}%
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className={`text-sm font-medium mt-1 ${weeklyTotalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    Week of {format(weekStart, 'MMM d')}: {weeklyTotalPnL >= 0 ? '+' : ''}${weeklyTotalPnL.toLocaleString()}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-secondary)]">
                                    <span>
                                        <span className="font-medium">Green:</span>{' '}
                                        <span className="font-bold text-[var(--success)]">{weeklyGreenDays}</span>
                                    </span>
                                    <span>
                                        <span className="font-medium">Red:</span>{' '}
                                        <span className="font-bold text-[var(--danger)]">{weeklyRedDays}</span>
                                    </span>
                                    {(weeklyGreenDays + weeklyRedDays) > 0 && (
                                        <span>
                                            <span className="font-medium">Win Rate:</span>{' '}
                                            <span className={`font-bold ${(weeklyGreenDays / (weeklyGreenDays + weeklyRedDays)) * 100 >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {((weeklyGreenDays / (weeklyGreenDays + weeklyRedDays)) * 100).toFixed(0)}%
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    {/* Mobile always shows monthly stats */}
                    <div className="md:hidden">
                        <p className={`text-sm font-medium mt-1 ${monthlyTotalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {format(currentDate, 'MMMM')} Total: {monthlyTotalPnL >= 0 ? '+' : ''}${monthlyTotalPnL.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-secondary)]">
                            <span>
                                <span className="font-medium">Green:</span>{' '}
                                <span className="font-bold text-[var(--success)]">{greenDays}</span>
                            </span>
                            <span>
                                <span className="font-medium">Red:</span>{' '}
                                <span className="font-bold text-[var(--danger)]">{redDays}</span>
                            </span>
                            {(greenDays + redDays) > 0 && (
                                <span>
                                    <span className="font-medium">Win Rate:</span>{' '}
                                    <span className={`font-bold ${(greenDays / (greenDays + redDays)) * 100 >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {((greenDays / (greenDays + redDays)) * 100).toFixed(0)}%
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Row - Exchange Filter + View Toggle + Navigation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ExchangeFilter
                            exchanges={uniqueExchanges}
                            selectedExchanges={selectedExchanges}
                            onSelectionChange={setSelectedExchanges}
                        />
                        {/* Mobile View Toggle */}
                        <button
                            onClick={() => {
                                const newView = mobileView === 'monthly' ? 'weekly' : 'monthly';
                                setMobileView(newView);
                                localStorage.setItem('calendar_mobile_view', newView);
                            }}
                            className="md:hidden flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
                        >
                            <CalendarIcon size={16} />
                            <span className="text-sm">{mobileView === 'monthly' ? 'Weekly' : 'Monthly'}</span>
                        </button>
                        {/* Desktop View Toggle */}
                        <button
                            onClick={() => {
                                const newView = desktopView === 'monthly' ? 'weekly' : 'monthly';
                                setDesktopView(newView);
                                localStorage.setItem('calendar_desktop_view', newView);
                            }}
                            className="hidden md:flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
                        >
                            <CalendarIcon size={16} />
                            <span className="text-sm">{desktopView === 'monthly' ? 'Weekly View' : 'Monthly View'}</span>
                        </button>
                    </div>
                    {/* Navigation - switches between week/month on desktop */}
                    <div className="flex items-center justify-center gap-4 bg-[var(--bg-secondary)] p-1 rounded-full border border-[var(--border)]">
                        <button
                            onClick={desktopView === 'weekly' ? handlePrevWeek : handlePrevMonth}
                            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium min-w-[140px] text-center select-none">
                            {desktopView === 'weekly'
                                ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
                                : format(currentDate, 'MMMM yyyy')
                            }
                        </span>
                        <button
                            onClick={desktopView === 'weekly' ? handleNextWeek : handleNextMonth}
                            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-3 md:p-6 rounded-xl">
                {/* Mobile Weekly View */}
                {mobileView === 'weekly' ? (
                    <div className="md:hidden">
                        {/* Week Navigation */}
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={handlePrevWeek} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                            <span className="text-sm font-medium">
                                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                            </span>
                            <button onClick={handleNextWeek} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Weekly Cards */}
                        <div className="space-y-3">
                            {daysInWeek.map(date => {
                                const pnl = getPnLForDate(date);
                                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                const dayTrades = getTradesForDate(date);
                                const hasTrades = dayTrades.length > 0;

                                return (
                                    <div
                                        key={date.toISOString()}
                                        onClick={() => hasTrades && setSelectedDate(date)}
                                        className={`
                                            p-4 rounded-xl border transition-all
                                            ${hasTrades ? 'cursor-pointer hover:scale-[1.02]' : ''}
                                            ${getDayClass(pnl)}
                                            ${isToday ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-primary)]' : ''}
                                        `}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-base">{format(date, 'EEEE')}</p>
                                                <p className="text-sm text-[var(--text-secondary)]">{format(date, 'MMM d, yyyy')}</p>
                                                {hasTrades && (
                                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{dayTrades.length} trade{dayTrades.length > 1 ? 's' : ''}</p>
                                                )}
                                            </div>
                                            <div className={`text-right ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                <p className="text-2xl font-bold">
                                                    {pnl !== 0 ? (pnl > 0 ? '+' : '') + '$' + pnl.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {/* Desktop Weekly View - Enhanced */}
                {desktopView === 'weekly' && (
                    <div className="hidden md:block">
                        {/* Weekly Stats Summary */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Total Trades</p>
                                <p className="text-2xl font-bold">{daysInWeek.reduce((sum, d) => sum + getTradesForDate(d).length, 0)}</p>
                            </div>
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Best Day</p>
                                {(() => {
                                    const best = daysInWeek.reduce((best, d) => {
                                        const pnl = getPnLForDate(d);
                                        return pnl > best.pnl ? { date: d, pnl } : best;
                                    }, { date: daysInWeek[0], pnl: -Infinity });
                                    return best.pnl > -Infinity && best.pnl !== 0 ? (
                                        <p className="text-2xl font-bold text-[var(--success)]">
                                            {format(best.date, 'EEE')} +${best.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                    ) : <p className="text-lg text-[var(--text-tertiary)]">—</p>;
                                })()}
                            </div>
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Worst Day</p>
                                {(() => {
                                    const worst = daysInWeek.reduce((worst, d) => {
                                        const pnl = getPnLForDate(d);
                                        return pnl < worst.pnl && pnl !== 0 ? { date: d, pnl } : worst;
                                    }, { date: daysInWeek[0], pnl: Infinity });
                                    return worst.pnl < Infinity && worst.pnl !== 0 ? (
                                        <p className="text-2xl font-bold text-[var(--danger)]">
                                            {format(worst.date, 'EEE')} ${worst.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                    ) : <p className="text-lg text-[var(--text-tertiary)]">—</p>;
                                })()}
                            </div>
                            <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Avg Per Day</p>
                                {(() => {
                                    const tradingDays = daysInWeek.filter(d => getPnLForDate(d) !== 0).length;
                                    const avg = tradingDays > 0 ? weeklyTotalPnL / tradingDays : 0;
                                    return avg !== 0 ? (
                                        <p className={`text-2xl font-bold ${avg >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {avg >= 0 ? '+' : ''}${avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                    ) : <p className="text-lg text-[var(--text-tertiary)]">—</p>;
                                })()}
                            </div>
                        </div>

                        {/* Weekly Day Cards - Larger & More Detailed */}
                        <div className="grid grid-cols-7 gap-3">
                            {daysInWeek.map(date => {
                                const pnl = getPnLForDate(date);
                                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                const dayTrades = getTradesForDate(date);
                                const hasTrades = dayTrades.length > 0;
                                const wins = dayTrades.filter(t => t.pnl > 0).length;
                                const losses = dayTrades.filter(t => t.pnl < 0).length;

                                // Get unique tickers
                                const tickers = [...new Set(dayTrades.map(t => t.ticker))].slice(0, 3);

                                return (
                                    <div
                                        key={date.toISOString()}
                                        onClick={() => hasTrades && setSelectedDate(date)}
                                        className={`
                                            rounded-xl p-4 border transition-all min-h-[220px] flex flex-col
                                            ${hasTrades ? 'cursor-pointer hover:scale-[1.01] hover:shadow-lg' : 'cursor-default opacity-60'}
                                            ${getDayClass(pnl)}
                                            ${isToday ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''}
                                        `}
                                    >
                                        {/* Day Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-sm font-semibold">{format(date, 'EEEE')}</p>
                                                <p className="text-xs text-[var(--text-secondary)]">{format(date, 'MMM d')}</p>
                                            </div>
                                            {isToday && (
                                                <span className="text-[10px] uppercase tracking-wide bg-[var(--accent-primary)] text-white px-2 py-0.5 rounded-full">
                                                    Today
                                                </span>
                                            )}
                                        </div>

                                        {/* P&L Amount */}
                                        <div className="flex-1 flex flex-col items-center justify-center">
                                            {pnl !== 0 ? (
                                                <>
                                                    <p className="text-2xl font-bold">
                                                        {pnl > 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-xs mt-1">
                                                        <span className="text-[var(--success)]">{wins}W</span>
                                                        <span className="mx-1 text-[var(--text-tertiary)]">/</span>
                                                        <span className="text-[var(--danger)]">{losses}L</span>
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-[var(--text-tertiary)] text-lg">No Trades</p>
                                            )}
                                        </div>

                                        {/* Tickers Preview */}
                                        {hasTrades && tickers.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-[var(--border)]/50">
                                                <div className="flex flex-wrap gap-1">
                                                    {tickers.map(ticker => (
                                                        <span key={ticker} className="text-[10px] bg-[var(--bg-secondary)]/50 px-1.5 py-0.5 rounded">
                                                            {ticker}
                                                        </span>
                                                    ))}
                                                    {dayTrades.length > 3 && (
                                                        <span className="text-[10px] text-[var(--text-tertiary)]">
                                                            +{dayTrades.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Monthly Grid (Desktop when monthly mode, Mobile when monthly mode selected) */}
                {desktopView === 'monthly' && (
                    <div className={mobileView === 'weekly' ? 'hidden md:block' : ''}>
                        {/* Day Headers - Show single letter on mobile */}
                        <div className="grid grid-cols-7 mb-2 md:mb-4">
                            {[
                                { full: 'Sunday', short: 'S' },
                                { full: 'Monday', short: 'M' },
                                { full: 'Tuesday', short: 'T' },
                                { full: 'Wednesday', short: 'W' },
                                { full: 'Thursday', short: 'T' },
                                { full: 'Friday', short: 'F' },
                                { full: 'Saturday', short: 'S' }
                            ].map(day => (
                                <div key={day.full} className="text-center text-[var(--text-secondary)] font-medium py-1 md:py-2">
                                    <span className="hidden sm:inline text-sm">{day.full.substring(0, 3)}</span>
                                    <span className="sm:hidden text-xs">{day.short}</span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 md:gap-2 lg:gap-4">
                            {blanks.map((_, i) => (
                                <div key={`blank-${i}`} className="aspect-square"></div>
                            ))}

                            {daysInMonth.map(date => {
                                const pnl = getPnLForDate(date);
                                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                const hasTrades = getTradesForDate(date).length > 0;

                                return (
                                    <div
                                        key={date.toISOString()}
                                        onClick={() => hasTrades && setSelectedDate(date)}
                                        className={`
                                    aspect-square rounded-lg md:rounded-xl p-1 md:p-2 flex flex-col items-center justify-center border transition-all hover:scale-105 relative overflow-hidden
                                    ${hasTrades ? 'cursor-pointer' : 'cursor-default'}
                                    ${getDayClass(pnl)}
                                    ${isToday ? 'ring-1 md:ring-2 ring-[var(--accent-primary)] ring-offset-1 md:ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''}
                                `}
                                    >
                                        <span className="absolute top-0.5 left-0.5 md:top-2 md:left-2 text-[10px] md:text-xs opacity-60 font-medium">
                                            {format(date, 'd')}
                                        </span>

                                        {pnl !== 0 && (
                                            <div className="mt-2 md:mt-4 text-center">
                                                <span className="text-[10px] md:text-sm font-bold block leading-tight">
                                                    {/* Mobile: no decimals, Desktop: 2 decimals */}
                                                    <span className="md:hidden">
                                                        {pnl > 0 ? '+' : ''}${Math.abs(pnl) >= 1000
                                                            ? (Math.abs(pnl) / 1000).toFixed(1) + 'k'
                                                            : Math.round(Math.abs(pnl)).toLocaleString()}
                                                    </span>
                                                    <span className="hidden md:inline">
                                                        {pnl > 0 ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </span>
                                                {pnl > 0 && <div className="absolute inset-0 bg-green-500/5 blur-xl"></div>}
                                                {pnl < 0 && <div className="absolute inset-0 bg-red-500/5 blur-xl"></div>}
                                            </div>
                                        )}

                                        {pnl === 0 && (
                                            <span className="text-[var(--text-tertiary)] text-[10px] md:text-xs mt-2 md:mt-4">-</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Day Detail Modal */}
            {selectedDate && selectedDayStats && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
                    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                            <div>
                                <h3 className="text-xl font-bold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
                                <p className={`text-2xl font-bold mt-1 ${selectedDayStats.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    {selectedDayStats.totalPnL >= 0 ? '+' : ''}${selectedDayStats.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-1">
                                        <Target size={14} />
                                        Win Rate
                                    </div>
                                    <p className={`text-xl font-bold ${selectedDayStats.winRate >= 50 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {selectedDayStats.winRate.toFixed(0)}%
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                        {selectedDayStats.wins}W / {selectedDayStats.losses}L
                                    </p>
                                </div>

                                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-1">
                                        <DollarSign size={14} />
                                        Avg P&L
                                    </div>
                                    <p className={`text-xl font-bold ${selectedDayStats.avgPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {selectedDayStats.avgPnL >= 0 ? '+' : ''}${selectedDayStats.avgPnL.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                        {selectedDayStats.trades.length} trades
                                    </p>
                                </div>

                                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-1">
                                        <BarChart3 size={14} />
                                        Profit Factor
                                    </div>
                                    <p className={`text-xl font-bold ${selectedDayStats.profitFactor >= 1 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        {selectedDayStats.profitFactor === Infinity ? '∞' : selectedDayStats.profitFactor.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                        Avg Win/Loss
                                    </p>
                                </div>

                                <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-1">
                                        <TrendingUp size={14} />
                                        Avg Win/Loss
                                    </div>
                                    <p className="text-sm">
                                        <span className="text-[var(--success)] font-bold">${selectedDayStats.avgWin.toFixed(0)}</span>
                                        <span className="text-[var(--text-tertiary)]"> / </span>
                                        <span className="text-[var(--danger)] font-bold">-${selectedDayStats.avgLoss.toFixed(0)}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Best & Worst Trade */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--success)] text-xs mb-2">
                                        <TrendingUp size={14} />
                                        Best Trade
                                    </div>
                                    <p className="font-bold text-[var(--success)]">
                                        {selectedDayStats.bestTrade.ticker}
                                    </p>
                                    <p className="text-lg font-bold text-[var(--success)]">
                                        +${selectedDayStats.bestTrade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-[var(--danger)] text-xs mb-2">
                                        <TrendingDown size={14} />
                                        Worst Trade
                                    </div>
                                    <p className="font-bold text-[var(--danger)]">
                                        {selectedDayStats.worstTrade.ticker}
                                    </p>
                                    <p className="text-lg font-bold text-[var(--danger)]">
                                        ${selectedDayStats.worstTrade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* P&L by Ticker */}
                            <div className="mb-6">
                                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">P&L by Symbol</h4>
                                <div className="space-y-2">
                                    {selectedDayStats.byTicker.map(([ticker, data]) => (
                                        <div key={ticker} className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded-lg px-4 py-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium">{ticker}</span>
                                                <span className="text-xs text-[var(--text-tertiary)]">
                                                    {data.count} trade{data.count > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <span className={`font-bold ${data.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Trade List */}
                            <div>
                                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">All Trades ({selectedDayStats.trades.length})</h4>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {selectedDayStats.trades.sort((a, b) => b.pnl - a.pnl).map(trade => (
                                        <div key={trade.id} className="flex items-center justify-between bg-[var(--bg-tertiary)] rounded-lg px-4 py-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{trade.ticker}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                        {trade.direction}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${trade.type === 'OPTION' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                        {trade.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                                    {trade.quantity} × ${trade.entryPrice?.toFixed(2) || '0'} → ${trade.exitPrice?.toFixed(2) || '0'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className={`text-xs ${trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                    {trade.pnlPercentage >= 0 ? '+' : ''}{trade.pnlPercentage.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
