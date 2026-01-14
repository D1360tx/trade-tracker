import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ExchangeFilterProps {
    exchanges: string[];
    selectedExchanges: string[];
    onSelectionChange: (selected: string[]) => void;
}

const ExchangeFilter = ({ exchanges, selectedExchanges, onSelectionChange }: ExchangeFilterProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = (exchange: string) => {
        if (selectedExchanges.includes(exchange)) {
            onSelectionChange(selectedExchanges.filter(e => e !== exchange));
        } else {
            onSelectionChange([...selectedExchanges, exchange]);
        }
    };

    const handleSelectAll = () => {
        if (selectedExchanges.length === exchanges.length) {
            // Deselect all
            onSelectionChange([]);
        } else {
            // Select all
            onSelectionChange([...exchanges]);
        }
    };

    const getButtonText = () => {
        if (selectedExchanges.length === 0) {
            return 'All Exchanges';
        } else if (selectedExchanges.length === 1) {
            return selectedExchanges[0];
        } else if (selectedExchanges.length === exchanges.length) {
            return 'All Exchanges';
        } else {
            return `${selectedExchanges.length} Exchanges`;
        }
    };

    const allSelected = selectedExchanges.length === exchanges.length;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg px-4 py-2 text-sm outline-none hover:border-[var(--text-tertiary)] transition-colors"
            >
                <span>{getButtonText()}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto z-50 w-56 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Select All Option */}
                    <button
                        onClick={handleSelectAll}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border)]"
                    >
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </span>
                        {allSelected && (
                            <Check size={16} className="text-[var(--accent-primary)]" />
                        )}
                    </button>

                    {/* Exchange Checkboxes */}
                    <div className="max-h-64 overflow-y-auto">
                        {exchanges.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-[var(--text-tertiary)]">
                                No exchanges found
                            </div>
                        ) : (
                            exchanges.map(exchange => {
                                const isSelected = selectedExchanges.includes(exchange);
                                return (
                                    <button
                                        key={exchange}
                                        onClick={() => handleToggle(exchange)}
                                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors ${isSelected ? 'bg-[var(--bg-tertiary)]/50' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Custom Checkbox */}
                                            <div
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                                                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                                                    : 'border-[var(--border)]'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                )}
                                            </div>
                                            <span className="text-sm text-[var(--text-primary)]">{exchange}</span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExchangeFilter;
