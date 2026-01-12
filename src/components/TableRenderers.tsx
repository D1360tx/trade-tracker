import React from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronUp, ChevronDown, GripVertical, X, Plus, ArrowUpRight, ArrowDownRight, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Trade, Strategy, Mistake } from '../types';
import type { Column, ColumnId } from '../hooks/useColumnOrder';

// --- Table Header Component ---

interface TableHeaderProps {
    column: Column;
    sortConfig: { key: string; direction: 'asc' | 'desc' };
    draggedColumn: ColumnId | null;
    dragOverColumn: ColumnId | null;
    handleSort: (key: string) => void;
    handleDragStart: (columnId: ColumnId) => void;
    handleDragOver: (e: React.DragEvent, columnId: ColumnId) => void;
    handleDragEnd: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
    column,
    sortConfig,
    draggedColumn,
    dragOverColumn,
    handleSort,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
}) => {
    const SortIcon = () => {
        if (!column.sortKey || sortConfig.key !== column.sortKey) return null;
        return sortConfig.direction === 'asc' ?
            <ChevronUp size={14} className="ml-1" /> :
            <ChevronDown size={14} className="ml-1" />;
    };

    const isRightAligned = ['quantity', 'entryPrice', 'exitPrice', 'pnl', 'pnlPercentage', 'risk', 'rMultiple'].includes(column.id);

    return (
        <th
            draggable="true"
            onDragStart={() => handleDragStart(column.id)}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragEnd={handleDragEnd}
            onClick={() => column.sortKey && handleSort(column.sortKey)}
            className={`
                cursor-move hover:text-[var(--text-primary)] px-6 py-4 text-[var(--text-secondary)] 
                font-medium text-sm transition-all relative z-10 ${column.width}
                ${column.sortKey ? 'cursor-pointer' : ''}
                ${isRightAligned ? 'text-right' : ''}
                ${draggedColumn === column.id ? 'opacity-50' : ''}
                ${dragOverColumn === column.id ? 'bg-[var(--accent-primary)]/10' : ''}
            `}
            title={`Drag to reorder${column.sortKey ? ' • Click to sort' : ''}`}
        >
            <div className={`flex items-center ${isRightAligned ? 'justify-end' : ''}`}>
                <GripVertical size={14} className="mr-1 opacity-50" />
                {column.label}
                <SortIcon />
            </div>
        </th>
    );
};

// --- Table Cell Component ---

interface TableCellProps {
    columnId: ColumnId;
    trade: Trade;
    strategies: Strategy[];
    mistakes: Mistake[];
    activeMistakeDropdown: string | null;
    setActiveMistakeDropdown: (id: string | null) => void;
    setSelectedTrade: (trade: Trade) => void;
    updateTrade: (id: string, updates: Partial<Trade>) => void;
}

export const TableCell: React.FC<TableCellProps> = ({
    columnId,
    trade,
    strategies,
    mistakes,
    activeMistakeDropdown,
    setActiveMistakeDropdown,
    setSelectedTrade,
    updateTrade,
}) => {
    switch (columnId) {
        case 'date':
            return (
                <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                    {format(parseISO(trade.exitDate), 'MMM dd, yyyy HH:mm')}
                </td>
            );

        case 'ticker':
            return (
                <td className="px-6 py-4 font-semibold">
                    <button
                        onClick={() => setSelectedTrade(trade)}
                        className="text-left hover:text-[var(--accent-primary)] transition-colors flex items-center gap-2"
                    >
                        {trade.ticker}
                        <span className="text-xs font-normal text-[var(--text-tertiary)] px-1.5 py-0.5 border border-[var(--border)] rounded">
                            {trade.exchange}
                        </span>
                    </button>
                </td>
            );

        case 'type':
            return (
                <td className="px-6 py-4 text-[var(--text-secondary)] text-sm">
                    {trade.type}
                </td>
            );

        case 'screenshots':
            return (
                <td className="px-6 py-4">
                    {(trade.screenshotIds?.length || 0) > 0 && (
                        <div className="flex items-center gap-1 text-[var(--text-secondary)]" title={`${trade.screenshotIds?.length} screenshots`}>
                            <ImageIcon size={14} />
                            <span className="text-xs">{trade.screenshotIds?.length}</span>
                        </div>
                    )}
                </td>
            );

        case 'strategy':
            return (
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
            );

        case 'mistakes':
            return (
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
            );

        case 'direction':
            return (
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
            );

        case 'quantity':
            return (
                <td className="px-6 py-4 text-right text-sm text-[var(--text-secondary)]">
                    {trade.type === 'FUTURES' && trade.margin
                        ? `$${trade.margin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : trade.type === 'FOREX'
                            ? (trade.quantity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : ['CRYPTO', 'FUTURES', 'SPOT'].includes(trade.type)
                                ? (trade.quantity || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                : (trade.quantity || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </td>
            );

        case 'entryPrice':
            return (
                <td className="px-6 py-4 text-right text-sm">
                    ${(trade.entryPrice || 0).toFixed(2)}
                </td>
            );

        case 'exitPrice':
            return (
                <td className="px-6 py-4 text-right text-sm">
                    ${(trade.exitPrice || 0).toFixed(2)}
                </td>
            );

        case 'pnl': {
            const pnl = trade.pnl || 0;
            return (
                <td className={`px-6 py-4 text-right font-medium ${pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    ${pnl.toFixed(2)}
                </td>
            );
        }

        case 'pnlPercentage': {
            const pnlPct = trade.pnlPercentage || 0;
            return (
                <td className={`px-6 py-4 text-right ${pnlPct >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    <div className="flex items-center justify-end gap-1">
                        {pnlPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(pnlPct).toFixed(2)}%
                    </div>
                </td>
            );
        }

        case 'risk':
            return (
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
            );

        case 'rMultiple':
            return (
                <td className="px-6 py-4 text-right text-sm font-medium text-[var(--text-secondary)]">
                    {trade.initialRisk && trade.initialRisk > 0
                        ? `${(trade.pnl / trade.initialRisk).toFixed(2)}R`
                        : '-'
                    }
                </td>
            );

        default:
            return <td className="px-6 py-4"></td>;
    }
};
