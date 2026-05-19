import { useContext } from 'react';
import { TradeContext } from './trade-context';

export const useTrades = () => {
    const context = useContext(TradeContext);
    if (context === undefined) {
        throw new Error('useTrades must be used within a TradeProvider');
    }
    return context;
};
