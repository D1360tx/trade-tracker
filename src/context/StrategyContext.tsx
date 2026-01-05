import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Strategy } from '../types';

interface StrategyContextType {
    strategies: Strategy[];
    addStrategy: (strategy: Omit<Strategy, 'id'>) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    getStrategy: (id: string) => Strategy | undefined;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

export const StrategyProvider = ({ children }: { children: ReactNode }) => {
    const [strategies, setStrategies] = useState<Strategy[]>(() => {
        const stored = localStorage.getItem('trade_tracker_strategies');
        const currentStrategies = stored ? JSON.parse(stored) : [];

        const defaultStrategies = [
            { id: 's_def_1', name: 'Breakout', color: 'bg-green-500', description: 'Price breaks key level' },
            { id: 's_def_2', name: 'Reversal', color: 'bg-blue-500', description: 'Price reverses at key level' },
            { id: 's_def_3', name: 'Trend Following', color: 'bg-purple-500', description: 'Riding the trend' },
            { id: 's_def_4', name: 'Scalping', color: 'bg-orange-500', description: 'Quick small profits' }
        ];

        // Only add defaults if they don't already exist (by name)
        const missingDefaults = defaultStrategies.filter(
            def => !currentStrategies.some((s: Strategy) => s.name === def.name)
        );

        if (missingDefaults.length > 0) {
            return [...currentStrategies, ...missingDefaults];
        }

        return currentStrategies;
    });

    useEffect(() => {
        localStorage.setItem('trade_tracker_strategies', JSON.stringify(strategies));
    }, [strategies]);

    const addStrategy = (strategy: Omit<Strategy, 'id'>) => {
        const newStrategy: Strategy = {
            ...strategy,
            id: Math.random().toString(36).substr(2, 9)
        };
        setStrategies(prev => [...prev, newStrategy]);
    };

    const updateStrategy = (id: string, updates: Partial<Strategy>) => {
        setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const deleteStrategy = (id: string) => {
        setStrategies(prev => prev.filter(s => s.id !== id));
    };

    const getStrategy = (id: string) => strategies.find(s => s.id === id);

    return (
        <StrategyContext.Provider value={{ strategies, addStrategy, updateStrategy, deleteStrategy, getStrategy }}>
            {children}
        </StrategyContext.Provider>
    );
};

export const useStrategies = () => {
    const context = useContext(StrategyContext);
    if (context === undefined) {
        throw new Error('useStrategies must be used within a StrategyProvider');
    }
    return context;
};
