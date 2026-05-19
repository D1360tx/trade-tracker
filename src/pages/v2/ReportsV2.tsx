import { useState, useMemo } from 'react';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { useTrades } from '../../context/useTrades';
import { useV2Stats } from '../../hooks/v2/useV2Stats';
import TimeRangeFilter from '../../components/TimeRangeFilter';
import { getDateRangeForFilter, type TimeRange } from '../../utils/timeRanges';
import { filterTradesForAnalysis } from '../../utils/tradeAnalytics';
import ExchangeFilter from '../../components/ExchangeFilter';
import YourStatsHeader from '../../components/v2/reports/YourStatsHeader';
import ComprehensiveStats from '../../components/v2/reports/ComprehensiveStats';
import CumulativePnLChart from '../../components/v2/reports/CumulativePnLChart';
import DailyPnLBarChart from '../../components/v2/reports/DailyPnLBarChart';

const ReportsV2 = () => {
    const { trades, isLoading } = useTrades();

    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [pnlShowing, setPnlShowing] = useState<'net' | 'gross'>('net');

    // Filter trades
    const filteredTrades = useMemo(() => {
        const now = new Date();
        const dateRange = timeRange === 'all'
            ? undefined
            : timeRange === 'custom' && customStart
                ? { start: startOfDay(parseISO(customStart)), end: customEnd ? endOfDay(parseISO(customEnd)) : now }
                : getDateRangeForFilter(timeRange);

        return filterTradesForAnalysis(trades, { selectedExchanges, dateRange });
    }, [trades, timeRange, customStart, customEnd, selectedExchanges]);

    const stats = useV2Stats(filteredTrades, trades);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                <div className="h-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                <div className="h-[500px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold">Reports</h2>
                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg">
                            Overview
                        </button>
                    </div>
                </div>
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

            {/* P&L Showing Toggle */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">P&L SHOWING</span>
                <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-0.5">
                    <button
                        onClick={() => setPnlShowing('net')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            pnlShowing === 'net'
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        NET P&L
                    </button>
                    <button
                        onClick={() => setPnlShowing('gross')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            pnlShowing === 'gross'
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        GROSS P&L
                    </button>
                </div>
            </div>

            {/* Your Stats Header */}
            <YourStatsHeader trades={filteredTrades} />

            {/* Comprehensive Stats Table */}
            <ComprehensiveStats stats={stats} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CumulativePnLChart trades={filteredTrades} />
                <DailyPnLBarChart trades={filteredTrades} />
            </div>
        </div>
    );
};

export default ReportsV2;
