import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import { Link } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Search, Filter, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, X, Plus, Image as ImageIcon, RefreshCw } from 'lucide-react';
import TradeDetailsModal from '../components/TradeDetailsModal';
import ExchangeFilter from '../components/ExchangeFilter';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';
import type { Trade } from '../types';

const Journal = () => {
    const { trades, updateTrade, fetchTradesFromAPI, isLoading } = useTrades();
    const { strategies } = useStrategies();
    const { mistakes } = useMistakes();
    const [filterTicker, setFilterTicker] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeMistakeDropdown, setActiveMistakeDropdown] = useState<string | null>(null);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

    // Advanced Filters State
    const [filterType, setFilterType] = useState('ALL'); // ALL, CRYPTO, STOCK, OPTION
    const [filterDirection, setFilterDirection] = useState('ALL'); // ALL, LONG, SHORT
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]); // Multi-select exchanges
    const [filterStrategy, setFilterStrategy] = useState(''); // Strategy ID
    const [filterMistake, setFilterMistake] = useState(''); // Mistake ID
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'exitDate', direction: 'desc' });

    const filteredTrades = useMemo(() => {
        return trades.filter(t => {
            const matchesTicker = (t.ticker || 'UNKNOWN').toLowerCase().includes(filterTicker.toLowerCase());

            // Only show CLOSED trades or non-zero PnL
            const isClosed = t.status === 'CLOSED' || t.pnl !== 0;

            const matchesType = filterType === 'ALL' || t.type === filterType;
            const matchesDirection = filterDirection === 'ALL' || t.direction === filterDirection;
            const matchesExchange = selectedExchanges.length === 0 || selectedExchanges.includes(t.exchange);

            // Time range filter
            let matchesDate = true;
            if (timeRange !== 'all') {
                const now = new Date();
                let dateRange: { start: Date; end: Date };

                if (timeRange === 'custom' && customStart) {
                    dateRange = {
                        start: startOfDay(parseISO(customStart)),
                        end: customEnd ? endOfDay(parseISO(customEnd)) : now
                    };
                } else {
                    dateRange = getDateRangeForFilter(timeRange);
                }

                const tradeDate = parseISO(t.exitDate);
                matchesDate = isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
            }

            const matchesStrategy = !filterStrategy || t.strategyId === filterStrategy;
            const matchesMistake = !filterMistake || (t.mistakes && t.mistakes.includes(filterMistake));

            return matchesTicker && isClosed && matchesType && matchesDirection && matchesExchange && matchesDate && matchesStrategy && matchesMistake;
        });
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

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
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
                                const apiKey = localStorage.getItem(`${ex.toLowerCase()}_api_key`);
                                const apiSecret = localStorage.getItem(`${ex.toLowerCase()}_api_secret`);
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
                        className={`relative z-10 flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showFilters ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--text-tertiary)]'}`}
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
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[var(--bg-tertiary)] text-left">
                                    <th onClick={() => handleSort('exitDate')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm transition-colors relative z-10 w-[15%]">
                                        <div className="flex items-center">Date <SortIcon columnKey="exitDate" /></div>
                                    </th>
                                    <th onClick={() => handleSort('ticker')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center">Symbol <SortIcon columnKey="ticker" /></div>
                                    </th>
                                    <th onClick={() => handleSort('type')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center">Type <SortIcon columnKey="type" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[var(--text-secondary)] font-medium text-sm w-[5%] relative z-10">
                                        Media
                                    </th>
                                    <th className="px-6 py-4 text-[var(--text-secondary)] font-medium text-sm w-[15%] relative z-10">
                                        Strategy
                                    </th>
                                    <th className="px-6 py-4 text-[var(--text-secondary)] font-medium text-sm w-[15%] relative z-10">
                                        Mistakes
                                    </th>
                                    <th onClick={() => handleSort('direction')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center">Direction <SortIcon columnKey="direction" /></div>
                                    </th>
                                    <th onClick={() => handleSort('quantity')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right transition-colors relative z-10 w-[8%]">
                                        <div className="flex items-center justify-end">Size <SortIcon columnKey="quantity" /></div>
                                    </th>
                                    <th onClick={() => handleSort('entryPrice')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center justify-end">Entry <SortIcon columnKey="entryPrice" /></div>
                                    </th>
                                    <th onClick={() => handleSort('exitPrice')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center justify-end">Exit <SortIcon columnKey="exitPrice" /></div>
                                    </th>
                                    <th onClick={() => handleSort('pnl')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center justify-end">P&L <SortIcon columnKey="pnl" /></div>
                                    </th>
                                    <th onClick={() => handleSort('pnlPercentage')} className="cursor-pointer hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right transition-colors relative z-10 w-[10%]">
                                        <div className="flex items-center justify-end">Net ROI <SortIcon columnKey="pnlPercentage" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right relative z-10 w-[8%]">
                                        Risk
                                    </th>
                                    <th className="px-6 py-4 text-[var(--text-secondary)] font-medium text-sm text-right relative z-10 w-[6%]">
                                        R
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {sortedTrades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                                        <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                                            {format(parseISO(trade.exitDate), 'MMM dd, yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">
                                            <button
                                                onClick={() => setSelectedTrade(trade)}
                                                className="text-left hover:text-[var(--accent-primary)] transition-colors flex items-center gap-2"
                                            >
                                                {trade.ticker}
                                                <span className="text-xs font-normal text-[var(--text-tertiary)] px-1.5 py-0.5 border border-[var(--border)] rounded">{trade.exchange}</span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">{trade.type}</td>
                                        <td className="px-6 py-4">
                                            {(trade.screenshotIds?.length || 0) > 0 && (
                                                <div className="flex items-center gap-1 text-[var(--text-secondary)]" title={`${trade.screenshotIds?.length} screenshots`}>
                                                    <ImageIcon size={14} />
                                                    <span className="text-xs">{trade.screenshotIds?.length}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={trade.strategyId || ''}
                                                onChange={(e) => updateTrade(trade.id, { strategyId: e.target.value })}
                                                className={`
                                                    bg-transparent border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent-primary)]
                                                    ${trade.strategyId ? strategies.find(s => s.id === trade.strategyId)?.color.replace('bg-', 'text-') : 'text-[var(--text-tertiary)]'}
                                                `}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="">- No Strategy -</option>
                                                {strategies.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 relative">
                                            <div className="flex flex-wrap gap-1 items-center">
                                                {(trade.mistakes || []).length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {trade.mistakes?.map(mid => {
                                                            const m = mistakes.find(mk => mk.id === mid);
                                                            if (!m) return null;
                                                            return (
                                                                <span key={mid} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${m.color}`}
                                                                    title={m.name}>
                                                                    {m.name.slice(0, 1)}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newMistakes = trade.mistakes?.filter(id => id !== mid) || [];
                                                                            updateTrade(trade.id, { mistakes: newMistakes });
                                                                        }}
                                                                        className="hover:text-black/50"
                                                                    >
                                                                        <X size={10} />
                                                                    </button>
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMistakeDropdown(activeMistakeDropdown === trade.id ? null : trade.id);
                                                    }}
                                                    className={`p-1 rounded hover:bg-[var(--bg-tertiary)] ${activeMistakeDropdown === trade.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            {/* Mistake Dropdown */}
                                            {activeMistakeDropdown === trade.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setActiveMistakeDropdown(null)}></div>
                                                    <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95 duration-100">
                                                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 px-2">Tag Mistakes</p>
                                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                                            {mistakes.length === 0 ? (
                                                                <p className="text-xs text-[var(--text-tertiary)] px-2 py-1">No mistakes defined.</p>
                                                            ) : (
                                                                mistakes.map(m => {
                                                                    const isSelected = (trade.mistakes || []).includes(m.id);
                                                                    return (
                                                                        <button
                                                                            key={m.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const current = trade.mistakes || [];
                                                                                const newMistakes = isSelected
                                                                                    ? current.filter(id => id !== m.id)
                                                                                    : [...current, m.id];
                                                                                updateTrade(trade.id, { mistakes: newMistakes });
                                                                            }}
                                                                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${isSelected ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`w-2 h-2 rounded-full ${m.color}`}></div>
                                                                                <span>{m.name}</span>
                                                                            </div>
                                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"></div>}
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-[var(--border)]">
                                                            <Link to="/playbook" className="text-[10px] text-[var(--accent-primary)] hover:underline px-2 block text-center">Manage Mistakes</Link>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`text-xs font-medium px-2 py-1 rounded-full ${trade.direction === 'LONG'
                                                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                                    : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                                    }`}
                                            >
                                                {trade.direction}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-[var(--text-secondary)]">
                                            {trade.type === 'FUTURES' && trade.margin
                                                ? `$${trade.margin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : trade.type === 'FOREX'
                                                    ? trade.quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : trade.type === 'CRYPTO' || trade.type === 'FUTURES' || trade.type === 'SPOT'
                                                        ? trade.quantity.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                                        : trade.quantity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">${trade.entryPrice.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right text-sm">${trade.exitPrice.toFixed(2)}</td>
                                        <td className={`px-6 py-4 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            ${trade.pnl.toFixed(2)}
                                        </td>
                                        <td className={`px-6 py-4 text-right ${trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {trade.pnlPercentage >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                {Math.abs(trade.pnlPercentage).toFixed(2)}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <input
                                                type="number"
                                                value={trade.initialRisk || ''}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    updateTrade(trade.id, { initialRisk: isNaN(val) ? undefined : val });
                                                }}
                                                placeholder="-"
                                                className="w-16 bg-transparent border border-[var(--border)] rounded px-2 py-1 text-right text-sm outline-none focus:border-[var(--accent-primary)] placeholder-[var(--text-tertiary)]"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-[var(--text-secondary)]">
                                            {trade.initialRisk && trade.initialRisk > 0
                                                ? `${(trade.pnl / trade.initialRisk).toFixed(2)}R`
                                                : '-'
                                            }
                                        </td>
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
                    onClose={() => setSelectedTrade(null)}
                    onUpdate={(updates) => {
                        updateTrade(selectedTrade.id, updates);
                        setSelectedTrade(prev => prev ? { ...prev, ...updates } : null);
                    }}
                />
            )}
        </div>
    );
};

export default Journal;
