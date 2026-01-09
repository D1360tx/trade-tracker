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
            // Use accountNumbers endpoint to get hash values
            const accountsResponse = await fetch('https://api.schwabapi.com/trader/v1/accounts/accountNumbers', {
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

            // Log the accounts response for debugging
            console.log('[Schwab] Accounts response:', JSON.stringify(accounts, null, 2));

            if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
                return res.status(404).json({ error: 'No accounts found' });
            }

            // Extract account ID - try multiple possible field names
            const firstAccount = Array.isArray(accounts) ? accounts[0] : accounts;
            console.log('[Schwab] First account structure:', JSON.stringify(firstAccount, null, 2));

            // Schwab API requires hashValue for transaction queries, not raw accountNumber
            targetAccountId =
                firstAccount.hashValue ||
                firstAccount.encryptedAccountId ||
                (firstAccount.securitiesAccount && firstAccount.securitiesAccount.hashValue) ||
                firstAccount.accountNumber ||
                firstAccount.accountId ||
                (firstAccount.securitiesAccount && firstAccount.securitiesAccount.accountNumber) ||
                (firstAccount.securitiesAccount && firstAccount.securitiesAccount.accountId);

            if (!targetAccountId) {
                console.error('[Schwab] Could not extract account ID from:', firstAccount);
                return res.status(400).json({
                    error: 'Could not determine account ID from Schwab response',
                    accountStructure: Object.keys(firstAccount)
                });
            }

            console.log('[Schwab] Using account ID:', targetAccountId);
        }

        // Build transactions URL
        const transactionsUrl = new URL(`https://api.schwabapi.com/trader/v1/accounts/${targetAccountId}/transactions`);

        // Set date range (default: last 30 days)
        const end = endDate ? new Date(endDate as string) : new Date();
        const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Set dates to start/end of day in UTC for ISO 8601 format
        transactionsUrl.searchParams.set('startDate', new Date(start.setHours(0, 0, 0, 0)).toISOString());
        transactionsUrl.searchParams.set('endDate', new Date(end.setHours(23, 59, 59, 999)).toISOString());
        // Note: Not filtering by type to get all transactions (stocks, options, etc.)

        console.log('[Schwab] Requesting transactions from:', transactionsUrl.toString());
        console.log('[Schwab] Account ID being used:', targetAccountId);

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
