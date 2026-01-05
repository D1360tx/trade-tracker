import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Mistake } from '../types';

interface MistakeContextType {
    mistakes: Mistake[];
    addMistake: (mistake: Omit<Mistake, 'id'>) => void;
    updateMistake: (id: string, updates: Partial<Mistake>) => void;
    deleteMistake: (id: string) => void;
    getMistake: (id: string) => Mistake | undefined;
}

const MistakeContext = createContext<MistakeContextType | undefined>(undefined);

export const MistakeProvider = ({ children }: { children: ReactNode }) => {
    const [mistakes, setMistakes] = useState<Mistake[]>(() => {
        const stored = localStorage.getItem('trade_tracker_mistakes');
        return stored ? JSON.parse(stored) : [
            // Default mistakes to get user started
            { id: 'm1', name: 'FOMO', color: 'bg-red-500', description: 'Chasing price' },
            { id: 'm2', name: 'Revenge Trading', color: 'bg-orange-500', description: 'Trading to make back losses' },
            { id: 'm3', name: 'Early Exit', color: 'bg-yellow-500', description: 'Not trusting the plan' },
            { id: 'm4', name: 'Over Sizing', color: 'bg-purple-500', description: 'Risking too much' }
        ];
    });

    useEffect(() => {
        localStorage.setItem('trade_tracker_mistakes', JSON.stringify(mistakes));
    }, [mistakes]);

    const addMistake = (mistake: Omit<Mistake, 'id'>) => {
        const newMistake: Mistake = {
            ...mistake,
            id: Math.random().toString(36).substr(2, 9)
        };
        setMistakes(prev => [...prev, newMistake]);
    };

    const updateMistake = (id: string, updates: Partial<Mistake>) => {
        setMistakes(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const deleteMistake = (id: string) => {
        setMistakes(prev => prev.filter(m => m.id !== id));
    };

    const getMistake = (id: string) => mistakes.find(m => m.id === id);

    return (
        <MistakeContext.Provider value={{ mistakes, addMistake, updateMistake, deleteMistake, getMistake }}>
            {children}
        </MistakeContext.Provider>
    );
};

export const useMistakes = () => {
    const context = useContext(MistakeContext);
    if (context === undefined) {
        throw new Error('useMistakes must be used within a MistakeProvider');
    }
    return context;
};
