import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { useTrades } from '../../context/TradeContext';
import { useV2Stats } from '../../hooks/v2/useV2Stats';
import TimeRangeFilter, { getDateRangeForFilter } from '../../components/TimeRangeFilter';
import type { TimeRange } from '../../components/TimeRangeFilter';
import ExchangeFilter from '../../components/ExchangeFilter';
import TopStatsBar from '../../components/v2/dashboard/TopStatsBar';
import MonthlyCalendarV2 from '../../components/v2/dashboard/MonthlyCalendarV2';
import WeeklySidebar from '../../components/v2/dashboard/WeeklySidebar';
import YearlyCalendarGrid from '../../components/v2/dashboard/YearlyCalendarGrid';
import BottomStatsCards from '../../components/v2/dashboard/BottomStatsCards';
import DayDetailModalV2 from '../../components/v2/dashboard/DayDetailModalV2';
import type { Trade } from '../../types';

const DashboardV2 = () => {
    const { trades, isLoading } = useTrades();
    const navigate = useNavigate();

    const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [currentCalendarDate] = useState(new Date());

    // Day detail modal state
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
    const [selectedDayTrades, setSelectedDayTrades] = useState<Trade[]>([]);

    // Filter trades
    const filteredTrades = useMemo(() => {
        const now = new Date();
        let filtered = trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0);

        // Filter by exchange
        if (selectedExchanges.length > 0) {
            filtered = filtered.filter(t => selectedExchanges.includes(t.exchange));
        }

        // Filter by date
        if (timeRange === 'all') return filtered;

        let dateRange: { start: Date; end: Date };
        if (timeRange === 'custom' && customStart) {
            dateRange = {
                start: startOfDay(parseISO(customStart)),
                end: customEnd ? endOfDay(parseISO(customEnd)) : now,
            };
        } else {
            dateRange = getDateRangeForFilter(timeRange);
        }

        filtered = filtered.filter(t => {
            const tradeDate = parseISO(t.exitDate);
            return isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
        });

        // Aggregate Schwab options (same logic as V1)
        const groupedByPosition = new Map<string, typeof filtered>();
        const nonAggregatable: typeof filtered = [];

        filtered.forEach(trade => {
            if (trade.exchange === 'Schwab' && trade.type === 'OPTION') {
                const entryMinute = trade.entryDate?.substring(0, 16) || '';
                const exitMinute = trade.exitDate?.substring(0, 16) || '';
                const key = `${trade.ticker}|${entryMinute}|${exitMinute}`;

                if (!groupedByPosition.has(key)) {
                    groupedByPosition.set(key, []);
                }
                groupedByPosition.get(key)!.push(trade);
            } else {
                nonAggregatable.push(trade);
            }
        });

        const aggregated: typeof filtered = [];
        groupedByPosition.forEach(group => {
            if (group.length === 1) {
                aggregated.push(group[0]);
            } else {
                const first = group[0];
                const totalQuantity = group.reduce((sum, t) => sum + t.quantity, 0);
                const totalPnl = group.reduce((sum, t) => sum + t.pnl, 0);
                const totalFees = group.reduce((sum, t) => sum + (t.fees || 0), 0);
                const avgEntryPrice = group.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0) / totalQuantity;
                const avgExitPrice = group.reduce((sum, t) => sum + (t.exitPrice * t.quantity), 0) / totalQuantity;

                aggregated.push({
                    ...first,
                    quantity: totalQuantity,
                    pnl: totalPnl,
                    fees: totalFees,
                    entryPrice: avgEntryPrice,
                    exitPrice: avgExitPrice,
                    pnlPercentage: first.margin ? (totalPnl / (first.margin * group.length)) * 100 : 0,
                });
            }
        });

        return [...aggregated, ...nonAggregatable];
    }, [trades, timeRange, customStart, customEnd, selectedExchanges]);

    const stats = useV2Stats(filteredTrades, trades);

    const handleDayClick = (date: string, dayTrades: Trade[]) => {
        setSelectedDayDate(date);
        setSelectedDayTrades(dayTrades);
    };

    const handleTradeClick = (trade: Trade) => {
        navigate(`/trade-v2/${trade.id}`);
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                    ))}
                </div>
                <div className="h-[500px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">Dashboard V2</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-2 py-1 rounded-lg border border-[var(--border)]">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                            <span className="text-[var(--text-tertiary)]">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                        </div>
                    )}
                    <ExchangeFilter
                        exchanges={[...new Set(trades.map(t => t.exchange))]}
                        selectedExchanges={selectedExchanges}
                        onSelectionChange={setSelectedExchanges}
                    />
                    <TimeRangeFilter selectedRange={timeRange} onRangeChange={setTimeRange} />
                </div>
            </div>

            {/* Top Stats Bar */}
            <TopStatsBar stats={stats} />

            {/* Main Content: Calendar + Sidebar - aligned heights */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                {/* Calendar (3/4 width on lg screens) */}
                <div className="lg:col-span-3 flex">
                    <MonthlyCalendarV2
                        trades={filteredTrades}
                        onDayClick={handleDayClick}
                        initialDate={currentCalendarDate}
                    />
                </div>

                {/* Sidebar (1/4 width on lg screens) */}
                <div className="lg:col-span-1">
                    <WeeklySidebar
                        trades={filteredTrades}
                        year={currentCalendarDate.getFullYear()}
                        month={currentCalendarDate.getMonth()}
                        onTradeClick={handleTradeClick}
                    />
                </div>
            </div>

            {/* Yearly Calendar Grid */}
            <YearlyCalendarGrid trades={filteredTrades} />

            {/* Bottom Stats Cards */}
            <BottomStatsCards trades={filteredTrades} />

            {/* Day Detail Modal */}
            <DayDetailModalV2
                isOpen={selectedDayDate !== null}
                onClose={() => setSelectedDayDate(null)}
                date={selectedDayDate || ''}
                trades={selectedDayTrades}
                onViewDetails={handleTradeClick}
            />
        </div>
    );
};

export default DashboardV2;
