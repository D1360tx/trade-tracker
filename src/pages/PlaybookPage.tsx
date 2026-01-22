import { useState, useMemo } from 'react';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';
import { useTrades } from '../context/TradeContext';
import { Book, Plus, Trash2, Tag, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';


const COLORS = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500',
    'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
];

type Tab = 'strategies' | 'mistakes';

const PlaybookPage = () => {
    const { strategies, addStrategy, deleteStrategy } = useStrategies();
    const { mistakes, addMistake, deleteMistake } = useMistakes();
    const { trades } = useTrades();

    const [activeTab, setActiveTab] = useState<Tab>('strategies');

    // Calculate metrics for strategies
    const strategyMetrics = useMemo(() => {
        const metrics = new Map<string, { count: number; wins: number; totalPnL: number }>();

        strategies.forEach(s => metrics.set(s.id, { count: 0, wins: 0, totalPnL: 0 }));

        trades.forEach(trade => {
            if (trade.strategyId && metrics.has(trade.strategyId)) {
                const metric = metrics.get(trade.strategyId)!;
                metric.count++;
                metric.totalPnL += trade.pnl;
                if (trade.pnl > 0) metric.wins++;
            }
        });

        return metrics;
    }, [trades, strategies]);

    // Calculate metrics for mistakes
    const mistakeMetrics = useMemo(() => {
        const metrics = new Map<string, { count: number; totalLoss: number }>();

        mistakes.forEach(m => metrics.set(m.id, { count: 0, totalLoss: 0 }));

        trades.forEach(trade => {
            if (trade.mistakes && trade.mistakes.length > 0) {
                trade.mistakes.forEach(mistakeId => {
                    if (metrics.has(mistakeId)) {
                        const metric = metrics.get(mistakeId)!;
                        metric.count++;
                        if (trade.pnl < 0) metric.totalLoss += Math.abs(trade.pnl);
                    }
                });
            }
        });

        return metrics;
    }, [trades, mistakes]);

    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState<{ name: string; description: string; color: string }>({
        name: '',
        description: '',
        color: COLORS[0]
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name) return;

        if (activeTab === 'strategies') {
            addStrategy({
                name: newItem.name,
                description: newItem.description,
                color: newItem.color
            });
        } else {
            addMistake({
                name: newItem.name,
                description: newItem.description,
                color: newItem.color
            });
        }

        setNewItem({ name: '', description: '', color: COLORS[0] });
        setIsCreating(false);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[var(--text-primary)]">Playbook & Psychology</h2>
                    <p className="text-[var(--text-secondary)]">Define your edge and identify your leaks.</p>
                </div>
                <div className="flex bg-[var(--bg-tertiary)] p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab('strategies'); setIsCreating(false); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'strategies'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        Strategies
                    </button>
                    <button
                        onClick={() => { setActiveTab('mistakes'); setIsCreating(false); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mistakes'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        Mistakes
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center bg-[var(--bg-secondary)]/50 p-4 rounded-xl border border-[var(--border)]">
                <div className="flex items-center gap-3">
                    {activeTab === 'strategies' ? (
                        <Book className="text-[var(--accent-primary)]" size={24} />
                    ) : (
                        <AlertTriangle className="text-[var(--danger)]" size={24} />
                    )}
                    <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">
                            {activeTab === 'strategies' ? 'Trading Strategies' : 'Trading Mistakes'}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {activeTab === 'strategies'
                                ? 'Setups you want to master.'
                                : 'Behaviors you want to eliminate.'}
                        </p>
                    </div>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors text-sm"
                    >
                        <Plus size={18} />
                        New {activeTab === 'strategies' ? 'Strategy' : 'Mistake'}
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="glass-panel p-6 rounded-xl border border-[var(--border)] animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-lg font-semibold mb-4">Create New {activeTab === 'strategies' ? 'Strategy' : 'Mistake'}</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Name</label>
                            <input
                                type="text"
                                value={newItem.name}
                                onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={activeTab === 'strategies' ? "e.g. Bull Flag" : "e.g. FOMO"}
                                className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
                            <textarea
                                value={newItem.description}
                                onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={activeTab === 'strategies' ? "Criteria for this setup..." : "How does this mistake manifest?"}
                                className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] h-24"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Color Badge</label>
                            <div className="flex gap-2">
                                {COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setNewItem(prev => ({ ...prev, color }))}
                                        className={`w-8 h-8 rounded-full ${color} transition-transform hover:scale-110 ${newItem.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f172a]' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!newItem.name}
                                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(activeTab === 'strategies' ? strategies : mistakes).map(item => (
                    <div key={item.id} className="glass-panel p-6 rounded-xl border border-[var(--border)] hover:border-[var(--text-secondary)] transition-colors group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`px-3 py-1 rounded-full text-xs font-medium text-white ${item.color}`}>
                                {item.name}
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm(`Delete this ${activeTab === 'strategies' ? 'strategy' : 'mistake'}?`)) {
                                        if (activeTab === 'strategies') {
                                            deleteStrategy(item.id);
                                        } else {
                                            deleteMistake(item.id);
                                        }
                                    }
                                }}
                                className="text-[var(--text-tertiary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        {item.description ? (
                            <p className="text-[var(--text-secondary)] text-sm mb-4">{item.description}</p>
                        ) : (
                            <p className="text-[var(--text-tertiary)] text-sm italic mb-4">No description provided.</p>
                        )}
                        <div className="mt-auto pt-4 border-t border-[var(--border)] space-y-2">
                            {activeTab === 'strategies' ? (
                                <>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                                            <Tag size={14} />
                                            Trades:
                                        </span>
                                        <span className="font-bold text-[var(--text-primary)]">
                                            {strategyMetrics.get(item.id)?.count || 0}
                                        </span>
                                    </div>
                                    {(strategyMetrics.get(item.id)?.count || 0) > 0 && (
                                        <>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-[var(--text-tertiary)]">Win Rate:</span>
                                                <span className={`font-bold flex items-center gap-1 ${((strategyMetrics.get(item.id)!.wins / strategyMetrics.get(item.id)!.count) * 100) >= 50
                                                        ? 'text-[var(--success)]'
                                                        : 'text-[var(--danger)]'
                                                    }`}>
                                                    {((strategyMetrics.get(item.id)!.wins / strategyMetrics.get(item.id)!.count) * 100) >= 50
                                                        ? <TrendingUp size={12} />
                                                        : <TrendingDown size={12} />
                                                    }
                                                    {((strategyMetrics.get(item.id)!.wins / strategyMetrics.get(item.id)!.count) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-[var(--text-tertiary)]">Total P&L:</span>
                                                <span className={`font-bold ${(strategyMetrics.get(item.id)?.totalPnL || 0) >= 0
                                                        ? 'text-[var(--success)]'
                                                        : 'text-[var(--danger)]'
                                                    }`}>
                                                    ${(strategyMetrics.get(item.id)?.totalPnL || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                                            <AlertTriangle size={14} />
                                            Occurrences:
                                        </span>
                                        <span className="font-bold text-[var(--text-primary)]">
                                            {mistakeMetrics.get(item.id)?.count || 0}
                                        </span>
                                    </div>
                                    {(mistakeMetrics.get(item.id)?.count || 0) > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[var(--text-tertiary)]">Total Loss:</span>
                                            <span className="font-bold text-[var(--danger)]">
                                                -${(mistakeMetrics.get(item.id)?.totalLoss || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlaybookPage;
