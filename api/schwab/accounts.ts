import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SchwabAccountNumber {
    accountNumber?: string;
    hashValue?: string;
}

interface SchwabAccountResponse {
    securitiesAccount?: {
        type?: string;
        accountNumber?: string;
        currentBalances?: Record<string, unknown>;
        initialBalances?: Record<string, unknown>;
        positions?: unknown[];
    };
}

const maskAccountNumber = (value?: string) => {
    if (!value) return undefined;
    return value.length > 4 ? `...${value.slice(-4)}` : value;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const accessToken = authHeader.substring(7);

    try {
        const accountNumbersResponse = await fetch('https://api.schwabapi.com/trader/v1/accounts/accountNumbers', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });

        if (!accountNumbersResponse.ok) {
            if (accountNumbersResponse.status === 401) {
                return res.status(401).json({
                    error: 'Access token expired',
                    requiresRefresh: true,
                });
            }
            throw new Error(`Failed to fetch Schwab account numbers: ${accountNumbersResponse.status}`);
        }

        const accountNumbers = await accountNumbersResponse.json() as SchwabAccountNumber[] | SchwabAccountNumber;
        const accountsList = Array.isArray(accountNumbers) ? accountNumbers : [accountNumbers];
        const processedAccounts = new Set<string>();
        const accounts = [];

        for (const account of accountsList) {
            const accountHash = account.hashValue;
            if (!accountHash || processedAccounts.has(accountHash)) {
                continue;
            }
            processedAccounts.add(accountHash);

            const accountResponse = await fetch(`https://api.schwabapi.com/trader/v1/accounts/${accountHash}?fields=positions`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
            });

            if (!accountResponse.ok) {
                if (accountResponse.status === 401) {
                    return res.status(401).json({
                        error: 'Access token expired',
                        requiresRefresh: true,
                    });
                }
                accounts.push({
                    accountHash,
                    accountNumber: maskAccountNumber(account.accountNumber),
                    error: `Failed to fetch account details: ${accountResponse.status}`,
                });
                continue;
            }

            const accountData = await accountResponse.json() as SchwabAccountResponse;
            const securitiesAccount = accountData.securitiesAccount;

            accounts.push({
                accountHash,
                accountNumber: maskAccountNumber(securitiesAccount?.accountNumber || account.accountNumber),
                type: securitiesAccount?.type,
                currentBalances: securitiesAccount?.currentBalances || {},
                initialBalances: securitiesAccount?.initialBalances || {},
                positionsCount: securitiesAccount?.positions?.length || 0,
            });
        }

        return res.status(200).json({
            accounts,
            fetchedAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        console.error('Schwab accounts error:', error);
        return res.status(500).json({
            error: 'Failed to fetch Schwab accounts',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
