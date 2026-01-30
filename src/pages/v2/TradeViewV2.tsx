import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrades } from '../../context/TradeContext';
import { useStrategies } from '../../context/StrategyContext';
import { useMistakes } from '../../context/MistakeContext';
import TradeHeader from '../../components/v2/trade/TradeHeader';
import StatsPanel from '../../components/v2/trade/StatsPanel';
import PriceChart from '../../components/v2/trade/PriceChart';

const TradeViewV2 = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { trades, isLoading } = useTrades();
    const { strategies } = useStrategies();
    const { mistakes } = useMistakes();

    // Find the current trade
    const trade = useMemo(() => {
        return trades.find(t => t.id === id);
    }, [trades, id]);

    // Get sorted trades for navigation
    const sortedTrades = useMemo(() => {
        return [...trades]
            .filter(t => t.status === 'CLOSED')
            .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());
    }, [trades]);

    // Find current index for prev/next navigation
    const currentIndex = useMemo(() => {
        return sortedTrades.findIndex(t => t.id === id);
    }, [sortedTrades, id]);

    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < sortedTrades.length - 1 && currentIndex !== -1;

    const handlePrevious = () => {
        if (hasPrevious) {
            navigate(`/trade-v2/${sortedTrades[currentIndex - 1].id}`);
        }
    };

    const handleNext = () => {
        if (hasNext) {
            navigate(`/trade-v2/${sortedTrades[currentIndex + 1].id}`);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                <div className="flex gap-6">
                    <div className="w-80 h-[600px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                    <div className="flex-1 h-[600px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl" />
                </div>
            </div>
        );
    }

    if (!trade) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] glass-panel rounded-xl">
                <h2 className="text-xl font-medium text-[var(--text-primary)] mb-2">Trade Not Found</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                    The trade you're looking for doesn't exist or has been deleted.
                </p>
                <button
                    onClick={() => navigate('/journal')}
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                    Back to Journal
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <TradeHeader
                trade={trade}
                onPrevious={handlePrevious}
                onNext={handleNext}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
            />

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Stats Panel */}
                <StatsPanel
                    trade={trade}
                    strategies={strategies}
                    mistakes={mistakes}
                />

                {/* Price Chart */}
                <PriceChart trade={trade} />
            </div>
        </div>
    );
};

export default TradeViewV2;
