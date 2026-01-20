import React, { useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { useAuth } from '../context/AuthContext';
import {
    generateCompleteDemoAccount,
    generateDemoTrades,
    generateMEXCDemoTrades,
    generateForexDemoTrades,
    generateProfitableTraderData,
    generateLearningTraderData,
    generateAggressiveOptionsTraderData,
} from '../utils/demoDataGenerator';
import { Database, Trash2, TrendingUp, TrendingDown, Zap } from 'lucide-react';

/**
 * Demo Account Seeder Component
 * Only visible and functional for demo accounts
 * Allows quick population of realistic demo data
 */
const DemoAccountSeeder: React.FC = () => {
    const { user } = useAuth();
    const { addTrades, clearTrades, trades } = useTrades();
    const [isSeeding, setIsSeeding] = useState(false);

    // Only show for demo account
    // DEV MODE: Set this to true to test the seeder without logging in as demo account
    const DEV_MODE = false; // Set to true only for local testing

    // Extra safety: Also check we're not in production if you want to be extra cautious
    // Uncomment the line below to ONLY allow in development:
    // const isProduction = window.location.hostname !== 'localhost';
    // const isDemoAccount = !isProduction && (DEV_MODE || user?.email === 'demo@tradetracker.app');

    const isDemoAccount = DEV_MODE || user?.email === 'demo@tradetracker.app';

    // Debug logging
    console.log('[DemoAccountSeeder] Current user:', user?.email);
    console.log('[DemoAccountSeeder] Is demo account:', isDemoAccount);
    console.log('[DemoAccountSeeder] DEV_MODE:', DEV_MODE);

    if (!isDemoAccount) {
        return null;
    }

    const handleSeed = async (seedFunction: () => any, description: string) => {
        if (isSeeding) return;

        const confirmed = confirm(
            `This will add ${description} to your demo account.\n\nCurrent trades: ${trades.length}\n\nContinue?`
        );

        if (!confirmed) return;

        setIsSeeding(true);
        try {
            const demoTrades = seedFunction();
            await addTrades(demoTrades);
            alert(`✅ Successfully added ${demoTrades.length} demo trades!`);
        } catch (error: any) {
            alert(`❌ Error seeding data: ${error.message}`);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleClearAll = async () => {
        const confirmed = confirm(
            '⚠️ This will DELETE ALL trades from your demo account.\n\nThis action cannot be undone.\n\nAre you sure?'
        );

        if (!confirmed) return;

        setIsSeeding(true);
        try {
            await clearTrades();
            alert('✅ All demo data cleared!');
        } catch (error: any) {
            alert(`❌ Error clearing data: ${error.message}`);
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="glass-panel p-6 rounded-xl space-y-4 border-2 border-purple-500/30 bg-purple-500/5">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-purple-500/20">
                <Database className="text-purple-500" size={24} />
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-purple-400">Demo Data Generator</h3>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        Populate demo account with realistic trading data
                    </p>
                </div>
                <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded">
                    DEMO ONLY
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <span className="text-sm text-[var(--text-secondary)]">Current Trades</span>
                <span className="text-xl font-bold text-[var(--accent-primary)]">{trades.length}</span>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Quick Presets
                </h4>

                <button
                    onClick={() => handleSeed(generateCompleteDemoAccount, '~220 trades (mixed exchanges)')}
                    disabled={isSeeding}
                    className="w-full flex items-center gap-3 p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors disabled:opacity-50"
                >
                    <Zap size={20} className="text-[var(--accent-primary)]" />
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Complete Portfolio</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                            120 Schwab options + 60 MEXC futures + 40 Forex (~6 months)
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => handleSeed(generateProfitableTraderData, '150 profitable Schwab trades')}
                    disabled={isSeeding}
                    className="w-full flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                    <TrendingUp size={20} className="text-green-500" />
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Profitable Trader</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                            58% win rate, +$3K to +$8K P&L, 80% options
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => handleSeed(generateLearningTraderData, '80 learning Schwab trades')}
                    disabled={isSeeding}
                    className="w-full flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                >
                    <TrendingDown size={20} className="text-yellow-500" />
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Learning Trader</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                            48% win rate, ~breakeven, 70% options
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => handleSeed(generateAggressiveOptionsTraderData, '200 aggressive option trades')}
                    disabled={isSeeding}
                    className="w-full flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                >
                    <Zap size={20} className="text-orange-500" />
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Aggressive Options</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                            45% win rate, high volatility, 95% options
                        </div>
                    </div>
                </button>
            </div>

            {/* Exchange-Specific */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Exchange-Specific
                </h4>

                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => handleSeed(
                            () => generateDemoTrades({ count: 50 }),
                            '50 Schwab trades'
                        )}
                        disabled={isSeeding}
                        className="p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        +50 Schwab
                    </button>
                    <button
                        onClick={() => handleSeed(
                            () => generateMEXCDemoTrades(50),
                            '50 MEXC futures trades'
                        )}
                        disabled={isSeeding}
                        className="p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        +50 MEXC
                    </button>
                    <button
                        onClick={() => handleSeed(
                            () => generateForexDemoTrades(50),
                            '50 HeroFX trades'
                        )}
                        disabled={isSeeding}
                        className="p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-xs font-medium disabled:opacity-50"
                    >
                        +50 Forex
                    </button>
                </div>
            </div>

            {/* Clear All */}
            <div className="pt-3 border-t border-[var(--border)]">
                <button
                    onClick={handleClearAll}
                    disabled={isSeeding}
                    className="w-full flex items-center justify-center gap-2 p-3 border border-[var(--danger)]/50 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    <Trash2 size={18} />
                    Clear All Demo Data
                </button>
            </div>

            {/* Info */}
            <div className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] p-3 rounded-lg">
                <strong>Note:</strong> Demo data is randomly generated with realistic patterns based on
                actual Schwab CSV structure. All values (prices, P&L, dates) are randomized for privacy.
            </div>
        </div>
    );
};

export default DemoAccountSeeder;
