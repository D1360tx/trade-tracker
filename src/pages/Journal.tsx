
import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import { Link } from 'react-router-dom';
import { isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Search, Filter, RefreshCw, RotateCcw, GripVertical } from 'lucide-react';
import TradeDetailsModal from '../components/TradeDetailsModal';
import ExchangeFilter from '../components/ExchangeFilter';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import type { Trade } from '../types';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { TableHeader, TableCell } from '../components/TableRenderers';

const Journal = () => {
    const { trades, updateTrade, fetchTradesFromAPI, isLoading } = useTrades();
    const { strategies } = useStrategies();
    const { mistakes } = useMistakes();
    const [filterTicker, setFilterTicker] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeMistakeDropdown, setActiveMistakeDropdown] = useState<string | null>(null);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

    // Column ordering
    const { columns, draggedColumn, dragOverColumn, handleDragStart, handleDragOver, handleDragEnd, resetToDefault } = useColumnOrder();

    // Advanced Filters State
    const [filterType, setFilterType] = useState('ALL'); // ALL, CRYPTO, STOCK, OPTION
    const [filterDirection, setFilterDirection] = useState('ALL'); // ALL, LONG, SHORT
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]); // Multi-select exchanges
    const [filterStrategy, setFilterStrategy] = useState(''); // Strategy ID
    const [filterMistake, setFilterMistake] = useState(''); // Mistake ID
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'exitDate', direction: 'desc' });

    const filteredTrades = useMemo(() => {
        // Only show CLOSED trades in the Journal (OPEN positions will have a separate tab)
        let result = trades.filter(t => t.status === 'CLOSED');

        // Filter by Ticker
        if (filterTicker) {
            result = result.filter(t => t.ticker.toLowerCase().includes(filterTicker.toLowerCase()));
        }

        // Filter by Type
        if (filterType !== 'ALL') {
            result = result.filter(t => t.type === filterType);
        }

        // Filter by Direction
        if (filterDirection !== 'ALL') {
            result = result.filter(t => t.direction === filterDirection);
        }

        // Filter by Exchange
        if (selectedExchanges.length > 0) {
            result = result.filter(t => selectedExchanges.includes(t.exchange));
        }

        // Filter by Time Range
        if (timeRange !== 'all') {
            let dateRange;
            if (timeRange === 'custom' && customStart) {
                const now = new Date();
                dateRange = {
                    start: startOfDay(new Date(customStart)),
                    end: customEnd ? endOfDay(new Date(customEnd)) : now
                };
            } else {
                dateRange = getDateRangeForFilter(timeRange);
            }

            const { start, end } = dateRange;
            if (start) result = result.filter(t => isAfter(new Date(t.exitDate), start));
            if (end) result = result.filter(t => isBefore(new Date(t.exitDate), end));
        }

        // Filter by Strategy
        if (filterStrategy) {
            result = result.filter(t => t.strategyId === filterStrategy);
        }

        // Filter by Mistake
        if (filterMistake) {
            result = result.filter(t => t.mistakes && t.mistakes.includes(filterMistake));
        }

        return result;
    }, [trades, filterTicker, filterType, filterDirection, selectedExchanges, timeRange, customStart, customEnd, filterStrategy, filterMistake]);

    const sortedTrades = useMemo(() => {
        const sorted = [...filteredTrades];
        sorted.sort((a, b) => {
            const aValue = a[sortConfig.key as keyof typeof a];
            const bValue = b[sortConfig.key as keyof typeof b];

            if (aValue === bValue) return 0;

            // Handle null/undefined just in case
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else if (sortConfig.key === 'exitDate') {
                const dateA = new Date(aValue as string).getTime();
                const dateB = new Date(bValue as string).getTime();
                comparison = dateA - dateB;
            } else {
                comparison = String(aValue).localeCompare(String(bValue));
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredTrades, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }

            // Default directions based on user preference
            // PnL, ROI, Direction -> Default Descending (Biggest/Shorts first)
            // Dates, Prices, Ticker -> Default Ascending (Earliest/Lowest/A-Z first)
            let direction: 'asc' | 'desc' = 'asc';
            if (['pnl', 'pnlPercentage', 'direction'].includes(key)) {
                direction = 'desc';
            }

            return { key, direction };
        });
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">Trade Journal</h2>

                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            // Smart sync: only sync exchanges with API keys configured
                            const exchanges: Array<'MEXC' | 'ByBit'> = ['MEXC', 'ByBit'];
                            const toSync = exchanges.filter(ex => {
                                const apiKey = localStorage.getItem(ex.toLowerCase() + "_api_key");
                                const apiSecret = localStorage.getItem(ex.toLowerCase() + "_api_secret");
                                return apiKey && apiSecret;
                            });

                            if (toSync.length === 0) {
                                alert('No exchange API keys configured. Please add API keys in Settings first.');
                                return;
                            }

                            await Promise.all(toSync.map(ex => fetchTradesFromAPI(ex)));
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                        <span>{isLoading ? 'Syncing...' : 'Sync Exchanges'}</span>
                    </button>
                    <button
                        onClick={resetToDefault}
                        className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                        title="Reset column order to default"
                    >
                        <RotateCcw size={18} />
                        <span>Reset Columns</span>
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                        <input
                            type="text"
                            placeholder="Search ticker..."
                            value={filterTicker}
                            onChange={(e) => setFilterTicker(e.target.value)}
                            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] w-full md:w-64"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={"relative z-10 flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors " + (showFilters ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--text-tertiary)]")}
                    >
                        <Filter size={18} />
                        <span>Filters</span>
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="glass-panel p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 transition-all duration-300 overflow-visible relative z-20">
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Asset Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] relative z-10"
                        >
                            <option value="ALL">All Assets</option>
                            <option value="CRYPTO">Crypto</option>
                            <option value="STOCK">Stocks</option>
                            <option value="OPTION">Options</option>
                            <option value="FOREX">Forex</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Exchange/Broker</label>
                        <ExchangeFilter
                            exchanges={Array.from(new Set(trades.map(t => t.exchange))).sort()}
                            selectedExchanges={selectedExchanges}
                            onSelectionChange={setSelectedExchanges}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Direction</label>
                        <select
                            value={filterDirection}
                            onChange={(e) => setFilterDirection(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] relative z-10"
                        >
                            <option value="ALL">All Directions</option>
                            <option value="LONG">Long</option>
                            <option value="SHORT">Short</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Strategy</label>
                        <select
                            value={filterStrategy}
                            onChange={(e) => setFilterStrategy(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] relative z-10"
                        >
                            <option value="">All Strategies</option>
                            {strategies.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Mistake</label>
                        <select
                            value={filterMistake}
                            onChange={(e) => setFilterMistake(e.target.value)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)] relative z-10"
                        >
                            <option value="">All Mistakes</option>
                            {mistakes.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Date Range</label>
                        <TimeRangeFilter
                            selectedRange={timeRange}
                            onRangeChange={(range) => {
                                setTimeRange(range);
                                if (range !== 'custom') {
                                    setCustomStart('');
                                    setCustomEnd('');
                                }
                            }}
                            customStartDate={customStart}
                            customEndDate={customEnd}
                            onCustomDateChange={(start, end) => {
                                setCustomStart(start);
                                setCustomEnd(end);
                            }}
                        />
                    </div>
                </div>
            )}

            {trades.length === 0 ? (
                <div className="glass-panel p-12 text-center rounded-xl">
                    <p className="text-[var(--text-secondary)] mb-4">No trades imported yet.</p>
                    <Link to="/import" className="text-[var(--accent-primary)] hover:underline">Go to Import Page</Link>
                </div>
            ) : (
                <div className="glass-panel rounded-xl overflow-hidden">
                    {/* Column reorder info */}
                    <div className="px-6 py-3 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border)] flex items-center justify-between">
                        <p className="text-xs text-[var(--text-secondary)]">
                            <GripVertical size={14} className="inline mr-1" />
                            Drag column headers to reorder • <button onClick={resetToDefault} className="text-[var(--accent-primary)] hover:underline">Reset to default</button>
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[var(--bg-tertiary)] text-left">
                                    {columns.map(column => (
                                        <TableHeader
                                            key={column.id}
                                            column={column}
                                            sortConfig={sortConfig}
                                            draggedColumn={draggedColumn}
                                            dragOverColumn={dragOverColumn}
                                            handleSort={handleSort}
                                            handleDragStart={handleDragStart}
                                            handleDragOver={handleDragOver}
                                            handleDragEnd={handleDragEnd}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {sortedTrades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                                        {columns.map(column => (
                                            <TableCell
                                                key={column.id}
                                                columnId={column.id}
                                                trade={trade}
                                                strategies={strategies}
                                                mistakes={mistakes}
                                                activeMistakeDropdown={activeMistakeDropdown}
                                                setActiveMistakeDropdown={setActiveMistakeDropdown}
                                                setSelectedTrade={setSelectedTrade}
                                                updateTrade={updateTrade}
                                            />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {selectedTrade && (
                <TradeDetailsModal
                    trade={selectedTrade}
                    allTrades={sortedTrades}
                    onClose={() => setSelectedTrade(null)}
                    onUpdate={(updates) => {
                        updateTrade(selectedTrade.id, updates);
                        setSelectedTrade(prev => prev ? { ...prev, ...updates } : null);
                    }}
                    onNavigate={(direction) => {
                        const currentIndex = sortedTrades.findIndex(t => t.id === selectedTrade.id);
                        if (direction === 'prev' && currentIndex > 0) {
                            setSelectedTrade(sortedTrades[currentIndex - 1]);
                        } else if (direction === 'next' && currentIndex < sortedTrades.length - 1) {
                            setSelectedTrade(sortedTrades[currentIndex + 1]);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Journal;
