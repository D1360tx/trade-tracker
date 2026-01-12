import { useState, useEffect } from 'react';

export type ColumnId =
    | 'date'
    | 'ticker'
    | 'type'
    | 'screenshots'
    | 'strategy'
    | 'mistakes'
    | 'direction'
    | 'quantity'
    | 'entryPrice'
    | 'exitPrice'
    | 'pnl'
    | 'pnlPercentage'
    | 'risk'
    | 'rMultiple';

export interface Column {
    id: ColumnId;
    label: string;
    width: string;
    sortKey?: string;
}

const DEFAULT_COLUMNS: Column[] = [
    { id: 'date', label: 'Date', width: 'w-[15%]', sortKey: 'exitDate' },
    { id: 'ticker', label: 'Symbol', width: 'w-[10%]', sortKey: 'ticker' },
    { id: 'type', label: 'Type', width: 'w-[10%]', sortKey: 'type' },
    { id: 'screenshots', label: 'Media', width: 'w-[5%]' },
    { id: 'strategy', label: 'Strategy', width: 'w-[15%]' },
    { id: 'mistakes', label: 'Mistakes', width: 'w-[15%]' },
    { id: 'direction', label: 'Direction', width: 'w-[10%]', sortKey: 'direction' },
    { id: 'quantity', label: 'Size', width: 'w-[8%]', sortKey: 'quantity' },
    { id: 'entryPrice', label: 'Entry', width: 'w-[10%]', sortKey: 'entryPrice' },
    { id: 'exitPrice', label: 'Exit', width: 'w-[10%]', sortKey: 'exitPrice' },
    { id: 'pnl', label: 'P&L', width: 'w-[10%]', sortKey: 'pnl' },
    { id: 'pnlPercentage', label: 'Net ROI', width: 'w-[10%]', sortKey: 'pnlPercentage' },
    { id: 'risk', label: 'Risk', width: 'w-[8%]' },
    { id: 'rMultiple', label: 'R', width: 'w-[6%]' },
];

const STORAGE_KEY = 'journal_column_order';

export const useColumnOrder = () => {
    const [columns, setColumns] = useState<Column[]>(() => {
        // Try to load saved order from localStorage
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const savedIds: ColumnId[] = JSON.parse(saved);
                // Map saved IDs back to full column objects
                const restored = savedIds
                    .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
                    .filter((col): col is Column => col !== undefined);

                // Ensure we have all columns (in case new ones were added)
                const missingColumns = DEFAULT_COLUMNS.filter(
                    col => !restored.find(c => c.id === col.id)
                );

                return [...restored, ...missingColumns];
            }
        } catch (error) {
            console.error('Failed to load column order:', error);
        }
        return DEFAULT_COLUMNS;
    });

    const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

    // Save to localStorage whenever order changes
    useEffect(() => {
        try {
            const ids = columns.map(col => col.id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        } catch (error) {
            console.error('Failed to save column order:', error);
        }
    }, [columns]);

    const handleDragStart = (columnId: ColumnId) => {
        setDraggedColumn(columnId);
    };

    const handleDragOver = (e: React.DragEvent, targetColumnId: ColumnId) => {
        e.preventDefault();
        setDragOverColumn(targetColumnId);

        if (!draggedColumn || draggedColumn === targetColumnId) return;

        const draggedIdx = columns.findIndex(col => col.id === draggedColumn);
        const targetIdx = columns.findIndex(col => col.id === targetColumnId);

        if (draggedIdx === -1 || targetIdx === -1) return;

        // Reorder columns
        const newColumns = [...columns];
        const [removed] = newColumns.splice(draggedIdx, 1);
        newColumns.splice(targetIdx, 0, removed);

        setColumns(newColumns);
    };

    const handleDragEnd = () => {
        setDraggedColumn(null);
        setDragOverColumn(null);
    };

    const resetToDefault = () => {
        setColumns(DEFAULT_COLUMNS);
        localStorage.removeItem(STORAGE_KEY);
    };

    return {
        columns,
        draggedColumn,
        dragOverColumn,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        resetToDefault,
    };
};
