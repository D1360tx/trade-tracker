import { createContext } from 'react';
import type { Strategy } from '../types';

export interface StrategyContextType {
    strategies: Strategy[];
    addStrategy: (strategy: Omit<Strategy, 'id'>) => void;
    updateStrategy: (id: string, updates: Partial<Strategy>) => void;
    deleteStrategy: (id: string) => void;
    getStrategy: (id: string) => Strategy | undefined;
}

export const StrategyContext = createContext<StrategyContextType | undefined>(undefined);
