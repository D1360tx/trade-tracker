
import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import { Link } from 'react-router-dom';
import { isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Search, Filter, RotateCcw, GripVertical, Grid, List } from 'lucide-react';
import TradeDetailsModal from '../components/TradeDetailsModal';
import ExchangeFilter from '../components/ExchangeFilter';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import type { Trade } from '../types';
import { useColumnOrder } from '../hooks/useColumnOrder';
import { TableHeader, TableCell } from '../components/TableRenderers';

const Journal = () => {
    const { trades, updateTrade, isLoading } = useTrades();
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

    // View Mode State (table vs card view for mobile)
    const [viewMode, setViewMode] = useState<'table' | 'card'>(() => {
        const saved = localStorage.getItem('journal_view_mode');
        return (saved as 'table' | 'card') || (window.innerWidth < 768 ? 'card' : 'table');
    });

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

        // Aggregate Schwab options that are multiple contracts of same position
        // This handles existing data that was imported before aggregation was added
        const groupedByPosition = new Map<string, typeof result>();
        const nonAggregatable: typeof result = [];

        result.forEach(trade => {
            // Only aggregate Schwab options
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

        // Aggregate grouped trades
        const aggregated: typeof result = [];
        groupedByPosition.forEach(group => {
            if (group.length === 1) {
                aggregated.push(group[0]);
            } else {
                // Combine multiple contracts
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
                    pnlPercentage: first.margin ? (totalPnl / (first.margin * group.length)) * 100 : 0
                });
            }
        });

        return [...aggregated, ...nonAggregatable];
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




    // Show loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex justify-between items-center">
                    <div className="h-10 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                    <div className="flex gap-4">
                        <div className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg" />
                        <div className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg" />
                        <div className="h-10 w-64 bg-[var(--bg-tertiary)] rounded-lg" />
                        <div className="h-10 w-24 bg-[var(--bg-tertiary)] rounded-lg" />
                    </div>
                </div>
                <div className="glass-panel rounded-xl p-6">
                    <div className="space-y-4">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="h-6 flex-1 bg-[var(--bg-tertiary)] rounded" />
                                <div className="h-6 flex-1 bg-[var(--bg-tertiary)] rounded" />
                                <div className="h-6 flex-1 bg-[var(--bg-tertiary)] rounded" />
                                <div className="h-6 flex-1 bg-[var(--bg-tertiary)] rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold">Trade Journal</h2>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={resetToDefault}
                        className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
                        title="Reset column order to default"
                    >
                        <RotateCcw size={18} />
                        <span className="hidden md:inline">Reset Columns</span>
                    </button>
                    <div className="relative flex-1 min-w-[200px] md:flex-none">
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
                        className={"relative z-10 flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors whitespace-nowrap " + (showFilters ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white" : "bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--text-tertiary)]")}
                    >
                        <Filter size={18} />
                        <span className="hidden sm:inline">Filters</span>
                    </button>
                    <button
                        onClick={() => {
                            const newMode = viewMode === 'table' ? 'card' : 'table';
                            setViewMode(newMode);
                            localStorage.setItem('journal_view_mode', newMode);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors whitespace-nowrap"
                        title={viewMode === 'table' ? 'Card View' : 'Table View'}
                    >
                        {viewMode === 'table' ? <Grid size={18} /> : <List size={18} />}
                        <span className="hidden sm:inline">{viewMode === 'table' ? 'Card View' : 'Table View'}</span>
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

            {(!isLoading && trades.length === 0) ? (
                <div className="glass-panel p-12 text-center rounded-xl">
                    <p className="text-[var(--text-secondary)] mb-4">No trades imported yet.</p>
                    <Link to="/import" className="text-[var(--accent-primary)] hover:underline">Go to Import Page</Link>
                </div>
            ) : (
                <div className="glass-panel rounded-xl overflow-hidden">
                    {viewMode === 'table' ? (
                        <>
                            {/* Table View */}
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
                        </>
                    ) : (
                        /* Card View for Mobile */
                        <div className="p-4 space-y-4">
                            {sortedTrades.map(trade => (
                                <div
                                    key={trade.id}
                                    onClick={() => setSelectedTrade(trade)}
                                    className="bg-[var(--bg-tertiary)] rounded-lg p-4 cursor-pointer hover:bg-[var(--bg-tertiary)]/80 transition-colors border border-[var(--border)]"
                                >
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-lg">{trade.ticker}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                    {trade.direction}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${trade.type === 'OPTION' ? 'bg-amber-500/20 text-amber-400' : trade.type === 'CRYPTO' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                    {trade.type}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--text-tertiary)]">
                                                {new Date(trade.exitDate).toLocaleDateString()} • {trade.exchange}
                                            </p>
                                        </div>
                                        <div className={`text-right font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            <p className="text-xl">{trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()}</p>
                                            <p className="text-sm">{trade.pnlPercentage >= 0 ? '+' : ''}{trade.pnlPercentage.toFixed(1)}%</p>
                                        </div>
                                    </div>

                                    {/* Trade Details Grid */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-[var(--text-tertiary)] text-xs">Entry</p>
                                            <p className="font-medium">${trade.entryPrice?.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[var(--text-tertiary)] text-xs">Exit</p>
                                            <p className="font-medium">${trade.exitPrice?.toFixed(2)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[var(--text-tertiary)] text-xs">Quantity</p>
                                            <p className="font-medium">{trade.quantity}</p>
                                        </div>
                                        <div>
                                            <p className="text-[var(--text-tertiary)] text-xs">Fees</p>
                                            <p className="font-medium">${trade.fees?.toFixed(2) || '0.00'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
