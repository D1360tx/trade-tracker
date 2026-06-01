import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrades } from '../../context/useTrades';
import { useV2Stats } from '../../hooks/v2/useV2Stats';
import TimeRangeFilter from '../../components/TimeRangeFilter';
import {
    getCalendarAnchorDateForRange,
    getCustomDateRangeForFilter,
    getDateRangeForFilter,
    type TimeRange
} from '../../utils/timeRanges';
import { filterTradesForAnalysis } from '../../utils/tradeAnalytics';
import ExchangeFilter from '../../components/ExchangeFilter';
import TopStatsBar from '../../components/v2/dashboard/TopStatsBar';
import { getTotalSchwabAccountBalance } from '../../utils/schwabAccount';
import MonthlyCalendarV2 from '../../components/v2/dashboard/MonthlyCalendarV2';
import WeeklySidebar from '../../components/v2/dashboard/WeeklySidebar';
import YearlyCalendarGrid from '../../components/v2/dashboard/YearlyCalendarGrid';
import BottomStatsCards from '../../components/v2/dashboard/BottomStatsCards';
import DayDetailModalV2 from '../../components/v2/dashboard/DayDetailModalV2';
import type { Trade } from '../../types';

const DashboardV2 = () => {
    const { trades, isLoading, schwabAccountSnapshot, schwabBalanceUpdatedAt } = useTrades();
    const navigate = useNavigate();

    const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [currentCalendarDate, setCurrentCalendarDate] = useState(() =>
        getCalendarAnchorDateForRange('this_month')
    );

    // Day detail modal state
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
    const [selectedDayTrades, setSelectedDayTrades] = useState<Trade[]>([]);

    const selectedDateRange = useMemo(() => {
        if (timeRange === 'all') return undefined;
        if (timeRange === 'custom') {
            return getCustomDateRangeForFilter(customStart, customEnd);
        }

        return getDateRangeForFilter(timeRange);
    }, [timeRange, customStart, customEnd]);

    const filteredTrades = useMemo(() => {
        return filterTradesForAnalysis(trades, { selectedExchanges, dateRange: selectedDateRange });
    }, [trades, selectedExchanges, selectedDateRange]);

    const calendarTrades = filteredTrades;

    const stats = useV2Stats(filteredTrades, trades);
    const accountBalance = useMemo(
        () => getTotalSchwabAccountBalance(schwabAccountSnapshot),
        [schwabAccountSnapshot]
    );

    const handleDayClick = (date: string, dayTrades: Trade[]) => {
        setSelectedDayDate(date);
        setSelectedDayTrades(dayTrades);
    };

    const handleTradeClick = (trade: Trade) => {
        navigate(`/trade-v2/${trade.id}`);
    };

    const handleTimeRangeChange = (range: TimeRange) => {
        setTimeRange(range);
        setCurrentCalendarDate(getCalendarAnchorDateForRange(range, { customStart, customEnd }));
    };

    const handleCustomStartChange = (value: string) => {
        setCustomStart(value);
        if (timeRange === 'custom') {
            setCurrentCalendarDate(getCalendarAnchorDateForRange('custom', { customStart: value, customEnd }));
        }
    };

    const handleCustomEndChange = (value: string) => {
        setCustomEnd(value);
        if (timeRange === 'custom') {
            setCurrentCalendarDate(getCalendarAnchorDateForRange('custom', { customStart, customEnd: value }));
        }
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
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-2 py-1 rounded-lg border border-[var(--border)]">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => handleCustomStartChange(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                            <span className="text-[var(--text-tertiary)]">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => handleCustomEndChange(e.target.value)}
                                className="bg-transparent text-sm outline-none text-[var(--text-secondary)] [color-scheme:dark]"
                            />
                        </div>
                    )}
                    <ExchangeFilter
                        exchanges={[...new Set(trades.map(t => t.exchange))]}
                        selectedExchanges={selectedExchanges}
                        onSelectionChange={setSelectedExchanges}
                    />
                    <TimeRangeFilter selectedRange={timeRange} onRangeChange={handleTimeRangeChange} />
                </div>
            </div>

            {/* Top Stats Bar */}
            <TopStatsBar stats={stats} accountBalance={accountBalance} balanceUpdatedAt={schwabBalanceUpdatedAt} />

            {/* Main Content: Calendar + Sidebar - aligned heights */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                {/* Calendar (3/4 width on lg screens) */}
                <div className="lg:col-span-3 flex">
                    <MonthlyCalendarV2
                        trades={calendarTrades}
                        onDayClick={handleDayClick}
                        currentDate={currentCalendarDate}
                        onCurrentDateChange={setCurrentCalendarDate}
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
            <YearlyCalendarGrid trades={calendarTrades} />

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
