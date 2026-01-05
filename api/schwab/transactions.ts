import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Fetch Transaction History from Schwab
 * 
 * GET /api/schwab/transactions
 * Headers: Authorization: Bearer <accessToken>
 * Query: startDate, endDate (optional)
 * 
 * Returns transaction history from Schwab account
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const accessToken = authHeader.substring(7);

    // Optional date filters
    const { startDate, endDate, accountId } = req.query;

    try {
        // First, get list of accounts if no accountId specified
        let targetAccountId = accountId as string;

        if (!targetAccountId) {
            const accountsResponse = await fetch('https://api.schwabapi.com/trader/v1/accounts', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!accountsResponse.ok) {
                if (accountsResponse.status === 401) {
                    return res.status(401).json({
                        error: 'Access token expired',
                        requiresRefresh: true
                    });
                }
                throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
            }

            const accounts = await accountsResponse.json();
            if (!accounts || accounts.length === 0) {
                return res.status(404).json({ error: 'No accounts found' });
            }

            // Use first account
            targetAccountId = accounts[0].accountNumber || accounts[0].hashValue;
        }

        // Build transactions URL
        const transactionsUrl = new URL(`https://api.schwabapi.com/trader/v1/accounts/${targetAccountId}/transactions`);

        // Set date range (default: last 30 days)
        const end = endDate ? new Date(endDate as string) : new Date();
        const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        transactionsUrl.searchParams.set('startDate', start.toISOString().split('T')[0]);
        transactionsUrl.searchParams.set('endDate', end.toISOString().split('T')[0]);
        transactionsUrl.searchParams.set('types', 'TRADE'); // Only get trade transactions

        const transactionsResponse = await fetch(transactionsUrl.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!transactionsResponse.ok) {
            if (transactionsResponse.status === 401) {
                return res.status(401).json({
                    error: 'Access token expired',
                    requiresRefresh: true
                });
            }
            const errorText = await transactionsResponse.text();
            throw new Error(`Failed to fetch transactions: ${transactionsResponse.status} - ${errorText}`);
        }

        const transactions = await transactionsResponse.json();

        return res.status(200).json({
            accountId: targetAccountId,
            transactions: transactions,
            count: Array.isArray(transactions) ? transactions.length : 0,
            dateRange: {
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0]
            }
        });

    } catch (error: any) {
        console.error('Schwab transactions error:', error);
        return res.status(500).json({
            error: 'Failed to fetch transactions',
            message: error.message
        });
    }
}
