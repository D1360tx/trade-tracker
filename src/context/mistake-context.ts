import { createContext } from 'react';
import type { Mistake } from '../types';

export interface MistakeContextType {
    mistakes: Mistake[];
    addMistake: (mistake: Omit<Mistake, 'id'>) => void;
    updateMistake: (id: string, updates: Partial<Mistake>) => void;
    deleteMistake: (id: string) => void;
    getMistake: (id: string) => Mistake | undefined;
}

export const MistakeContext = createContext<MistakeContextType | undefined>(undefined);
