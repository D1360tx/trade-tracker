import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Strategy } from '../types';
import { fetchStrategies, insertStrategy as dbInsertStrategy, updateStrategy as dbUpdateStrategy, deleteStrategy as dbDeleteStrategy } from '../lib/supabase/strategies';
import { useAuth } from './AuthContext';

interface StrategyContextType {
    strategies: Strategy[];
    addStrategy: (strategy: Omit<Strategy, 'id'>) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    getStrategy: (id: string) => Strategy | undefined;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

export const StrategyProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [strategies, setStrategies] = useState<Strategy[]>([]);

    // Load strategies from Supabase
    useEffect(() => {
        if (!user) {
            setStrategies([]);
            return;
        }

        const loadStrategies = async () => {
            try {
                const cloudStrategies = await fetchStrategies();

                // Add default strategies if user has none
                if (cloudStrategies.length === 0) {
                    const defaults = [
                        { name: 'Breakout', color: 'bg-green-500', description: 'Price breaks key level' },
                        { name: 'Reversal', color: 'bg-blue-500', description: 'Price reverses at key level' },
                        { name: 'Trend Following', color: 'bg-purple-500', description: 'Riding the trend' },
                        { name: 'Scalping', color: 'bg-orange-500', description: 'Quick small profits' }
                    ];

                    for (const def of defaults) {
                        await dbInsertStrategy(def);
                    }

                    // Reload after adding defaults
                    const updatedStrategies = await fetchStrategies();
                    setStrategies(updatedStrategies);
                } else {
                    setStrategies(cloudStrategies);
                }
            } catch (error) {
                console.error('Error loading strategies:', error);
            }
        };

        loadStrategies();
    }, [user]);

    const addStrategy = (strategy: Omit<Strategy, 'id'>) => {
        // Optimistic update
        const tempId = Math.random().toString(36).substr(2, 9);
        const newStrategy: Strategy = { ...strategy, id: tempId };
        setStrategies(prev => [...prev, newStrategy]);

        // Sync to Supabase
        dbInsertStrategy(strategy).then(created => {
            setStrategies(prev => prev.map(s => s.id === tempId ? created : s));
        }).catch(error => {
            console.error('Error adding strategy:', error);
            setStrategies(prev => prev.filter(s => s.id !== tempId));
        });
    };

    const updateStrategy = (id: string, updates: Partial<Strategy>) => {
        // Optimistic update
        setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

        // Sync to Supabase
        dbUpdateStrategy(id, updates).catch(error => {
            console.error('Error updating strategy:', error);
        });
    };

    const deleteStrategy = (id: string) => {
        // Optimistic update
        setStrategies(prev => prev.filter(s => s.id !== id));

        // Sync to Supabase
        dbDeleteStrategy(id).catch(error => {
            console.error('Error deleting strategy:', error);
        });
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
