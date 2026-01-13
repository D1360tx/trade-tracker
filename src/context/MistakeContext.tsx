import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Mistake } from '../types';
import { fetchMistakes, insertMistake as dbInsertMistake, updateMistake as dbUpdateMistake, deleteMistake as dbDeleteMistake } from '../lib/supabase/mistakes';
import { useAuth } from './AuthContext';

interface MistakeContextType {
    mistakes: Mistake[];
    addMistake: (mistake: Omit<Mistake, 'id'>) => void;
    updateMistake: (id: string, updates: Partial<Mistake>) => void;
    deleteMistake: (id: string) => void;
    getMistake: (id: string) => Mistake | undefined;
}

const MistakeContext = createContext<MistakeContextType | undefined>(undefined);

export const MistakeProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [mistakes, setMistakes] = useState<Mistake[]>([]);

    // Load mistakes from Supabase
    useEffect(() => {
        if (!user) {
            setMistakes([]);
            return;
        }

        const loadMistakes = async () => {
            try {
                const cloudMistakes = await fetchMistakes();

                // Add default mistakes if user has none
                if (cloudMistakes.length === 0) {
                    const defaults = [
                        { name: 'FOMO', color: 'bg-red-500', description: 'Chasing price' },
                        { name: 'Revenge Trading', color: 'bg-orange-500', description: 'Trading to make back losses' },
                        { name: 'Early Exit', color: 'bg-yellow-500', description: 'Not trusting the plan' },
                        { name: 'Over Sizing', color: 'bg-purple-500', description: 'Risking too much' }
                    ];

                    for (const def of defaults) {
                        await dbInsertMistake(def);
                    }

                    // Reload after adding defaults
                    const updatedMistakes = await fetchMistakes();
                    setMistakes(updatedMistakes);
                } else {
                    setMistakes(cloudMistakes);
                }
            } catch (error) {
                console.error('Error loading mistakes:', error);
            }
        };

        loadMistakes();
    }, [user]);

    const addMistake = (mistake: Omit<Mistake, 'id'>) => {
        // Optimistic update
        const tempId = Math.random().toString(36).substr(2, 9);
        const newMistake: Mistake = { ...mistake, id: tempId };
        setMistakes(prev => [...prev, newMistake]);

        // Sync to Supabase
        dbInsertMistake(mistake).then(created => {
            setMistakes(prev => prev.map(m => m.id === tempId ? created : m));
        }).catch(error => {
            console.error('Error adding mistake:', error);
            setMistakes(prev => prev.filter(m => m.id !== tempId));
        });
    };

    const updateMistake = (id: string, updates: Partial<Mistake>) => {
        // Optimistic update
        setMistakes(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

        // Sync to Supabase
        dbUpdateMistake(id, updates).catch(error => {
            console.error('Error updating mistake:', error);
        });
    };

    const deleteMistake = (id: string) => {
        // Optimistic update
        setMistakes(prev => prev.filter(m => m.id !== id));

        // Sync to Supabase
        dbDeleteMistake(id).catch(error => {
            console.error('Error deleting mistake:', error);
        });
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
