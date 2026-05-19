import { useContext } from 'react';
import { StrategyContext } from './strategy-context';

export const useStrategies = () => {
    const context = useContext(StrategyContext);
    if (context === undefined) {
        throw new Error('useStrategies must be used within a StrategyProvider');
    }
    return context;
};
