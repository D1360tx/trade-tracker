import type { SchwabAccountSnapshot } from './schwabAuth';

const BALANCE_PRIORITY = [
    'liquidationValue',
    'accountValue',
    'totalAccountValue',
    'cashBalance',
    'availableFunds',
];

export const getBalanceValue = (balances: Record<string, unknown>, keys = BALANCE_PRIORITY): number | null => {
    for (const key of keys) {
        const value = balances[key];
        const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};

export const getTotalSchwabAccountBalance = (snapshot: SchwabAccountSnapshot | null): number | null => {
    if (!snapshot || snapshot.accounts.length === 0) return null;

    const balances = snapshot.accounts
        .map(account => getBalanceValue(account.currentBalances))
        .filter((value): value is number => value !== null);

    if (balances.length === 0) return null;
    return balances.reduce((sum, value) => sum + value, 0);
};

export const getTotalSchwabCashBalance = (snapshot: SchwabAccountSnapshot | null): number | null => {
    if (!snapshot || snapshot.accounts.length === 0) return null;

    const balances = snapshot.accounts
        .map(account => getBalanceValue(account.currentBalances, ['cashBalance', 'availableFunds']))
        .filter((value): value is number => value !== null);

    if (balances.length === 0) return null;
    return balances.reduce((sum, value) => sum + value, 0);
};
