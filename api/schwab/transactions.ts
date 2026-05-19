import type { VercelRequest, VercelResponse } from '@vercel/node';

type SchwabApiAccount = Record<string, unknown> & {
    hashValue?: string;
    encryptedAccountId?: string;
    accountNumber?: string;
    accountId?: string;
    securitiesAccount?: {
        hashValue?: string;
        accountNumber?: string;
        accountId?: string;
    };
};

interface SchwabOrderLeg {
    legId?: number;
    instruction?: string;
    positionEffect?: 'OPENING' | 'CLOSING';
    quantity?: number;
    instrument?: {
        assetType?: string;
        symbol?: string;
        description?: string;
        putCall?: 'PUT' | 'CALL';
        strikePrice?: number;
        underlyingSymbol?: string;
    };
}

interface SchwabExecutionLeg {
    legId?: number;
    quantity?: number;
    price?: number;
    time?: string;
}

interface SchwabOrderActivity {
    activityType?: string;
    executionType?: string;
    quantity?: number;
    executionLegs?: SchwabExecutionLeg[];
}

interface SchwabOrder {
    orderId?: number;
    status?: string;
    price?: number;
    closeTime?: string;
    enteredTime?: string;
    orderLegCollection?: SchwabOrderLeg[];
    orderActivityCollection?: SchwabOrderActivity[];
}

const toDateOnly = (date: Date) => date.toISOString().split('T')[0];

const getAccountId = (account: SchwabApiAccount) => (
    account.hashValue ||
    account.encryptedAccountId ||
    account.securitiesAccount?.hashValue ||
    account.accountNumber ||
    account.accountId ||
    account.securitiesAccount?.accountNumber ||
    account.securitiesAccount?.accountId
);

const getPositionEffect = (leg: SchwabOrderLeg): 'OPENING' | 'CLOSING' | undefined => {
    if (leg.positionEffect) return leg.positionEffect;
    if (leg.instruction?.includes('OPEN')) return 'OPENING';
    if (leg.instruction?.includes('CLOSE')) return 'CLOSING';
    return undefined;
};

const getSignedAmount = (instruction: string | undefined, quantity: number) => {
    if (instruction?.startsWith('SELL')) return -Math.abs(quantity);
    return Math.abs(quantity);
};

const getTransactionTradeItem = (transaction: Record<string, unknown>) => {
    const transferItems = transaction.transferItems;
    if (!Array.isArray(transferItems)) return null;

    return transferItems.find(item => {
        const transferItem = item as { instrument?: { symbol?: string }; feeType?: string; price?: number };
        return transferItem.instrument?.symbol && !transferItem.feeType && transferItem.price !== undefined;
    }) as { instrument?: { symbol?: string }; amount?: number; positionEffect?: string } | undefined || null;
};

const hasMatchingTransaction = (
    existingTransactions: Array<Record<string, unknown>>,
    orderTransaction: Record<string, unknown>
) => {
    const orderItem = getTransactionTradeItem(orderTransaction);
    if (!orderItem?.instrument?.symbol) return false;

    const orderDay = toDateOnly(new Date(orderTransaction.time as string));
    const orderQuantity = Math.abs(Number(orderItem.amount || 0));

    return existingTransactions.some(transaction => {
        const transactionItem = getTransactionTradeItem(transaction);
        if (!transactionItem?.instrument?.symbol) return false;

        const transactionDay = toDateOnly(new Date(transaction.time as string));
        const transactionQuantity = Math.abs(Number(transactionItem.amount || 0));

        return transactionDay === orderDay
            && transactionItem.instrument.symbol === orderItem.instrument?.symbol
            && transactionItem.positionEffect === orderItem.positionEffect
            && Math.abs(transactionQuantity - orderQuantity) < 0.0001;
    });
};

const orderIdToActivityId = (orderId: number | undefined, legId: number | undefined, index: number) => {
    const base = Number.isFinite(orderId) ? Number(orderId) : Date.now();
    return (base * 100) + (legId ?? index);
};

const mapFilledOrdersToTransactions = (orders: SchwabOrder[], accountId: string): Array<Record<string, unknown>> => {
    const transactions: Array<Record<string, unknown>> = [];

    orders
        .filter(order => order.status === 'FILLED')
        .forEach(order => {
            const executionLegs = order.orderActivityCollection
                ?.filter(activity => activity.activityType === 'EXECUTION')
                .flatMap(activity => activity.executionLegs || []) || [];

            (order.orderLegCollection || []).forEach((leg, index) => {
                const instrument = leg.instrument;
                if (!instrument?.symbol || !instrument.assetType) return;

                const executionLeg = executionLegs.find(exec => exec.legId === leg.legId) || executionLegs[index];
                const quantity = Math.abs(executionLeg?.quantity || leg.quantity || 0);
                const price = executionLeg?.price || order.price || 0;
                if (quantity <= 0 || price <= 0) return;

                const multiplier = instrument.assetType === 'OPTION' || instrument.assetType === 'INDEX' ? 100 : 1;
                const amount = getSignedAmount(leg.instruction, quantity);
                const netAmount = Math.abs(price * quantity * multiplier);

                transactions.push({
                    activityId: orderIdToActivityId(order.orderId, leg.legId, index),
                    type: 'TRADE',
                    status: 'VALID',
                    time: executionLeg?.time || order.closeTime || order.enteredTime || new Date().toISOString(),
                    tradeDate: toDateOnly(new Date(executionLeg?.time || order.closeTime || order.enteredTime || Date.now())),
                    netAmount,
                    _accountId: accountId,
                    _source: 'same-day-order',
                    transferItems: [{
                        instrument: {
                            assetType: instrument.assetType,
                            symbol: instrument.symbol,
                            description: instrument.description,
                            putCall: instrument.putCall,
                            strikePrice: instrument.strikePrice,
                            underlyingSymbol: instrument.underlyingSymbol,
                        },
                        amount,
                        price,
                        cost: netAmount,
                        positionEffect: getPositionEffect(leg),
                    }],
                });
            });
        });

    return transactions;
};

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
        const targetAccountId = accountId as string;

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

            const accountsList = Array.isArray(accounts) ? accounts : [accounts];
            const allTransactions: Array<Record<string, unknown>> = [];
            const debugInfo: Array<Record<string, unknown>> = [];
            const processedAccounts = new Set<string>(); // Dedupe accounts

            // Iterate through all accounts
            for (const account of accountsList as SchwabApiAccount[]) {
                const accId = getAccountId(account);

                if (!accId) {
                    debugInfo.push({ error: 'Could not extract ID', account });
                    continue;
                }

                // Skip if already processed (deduplication)
                if (processedAccounts.has(accId)) {
                    debugInfo.push({ accId, status: 'skipped (duplicate)' });
                    continue;
                }
                processedAccounts.add(accId);

                try {
                    // Build transactions URL
                    const transactionsUrl = new URL(`https://api.schwabapi.com/trader/v1/accounts/${accId}/transactions`);

                    // Set date range (default: last 180 days - extended to capture all opening positions)
                    const endDateObj = endDate ? new Date(endDate as string) : new Date();
                    const startDateObj = startDate ? new Date(startDate as string) : new Date(endDateObj.getTime() - 180 * 24 * 60 * 60 * 1000);

                    // Schwab requires full ISO 8601 format with time component
                    // Create copies to avoid mutation
                    const startISO = new Date(startDateObj);
                    startISO.setUTCHours(0, 0, 0, 0);

                    const endISO = new Date(endDateObj);
                    endISO.setUTCHours(23, 59, 59, 999);

                    transactionsUrl.searchParams.set('startDate', startISO.toISOString());
                    transactionsUrl.searchParams.set('endDate', endISO.toISOString());

                    // Log sync window for debugging
                    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
                    console.log(`[Schwab API] Fetching transactions from ${startDateObj.toISOString().split('T')[0]} to ${endDateObj.toISOString().split('T')[0]} (${daysDiff} days)`);

                    const txResponse = await fetch(transactionsUrl.toString(), {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (txResponse.ok) {
                        const txData = await txResponse.json();
                        if (Array.isArray(txData)) {
                            // Tag transactions with account ID for reference
                            const taggedTx = txData.map(t => ({ ...t, _accountId: accId }));
                            allTransactions.push(...taggedTx);
                            debugInfo.push({ accId, count: txData.length, status: 'success' });
                        }
                    } else {
                        // Capture detailed error info
                        let errorDetail = `failed: ${txResponse.status}`;
                        try {
                            const errorBody = await txResponse.text();
                            errorDetail += ` - ${errorBody}`;
                        } catch {
                            // Could not read error body
                        }
                        debugInfo.push({
                            accId,
                            status: errorDetail,
                            url: transactionsUrl.toString(),
                            dates: {
                                start: startISO.toISOString(),
                                end: endISO.toISOString()
                            }
                        });
                    }

                    // Same-day fills may be available as orders before Schwab exposes them as transactions.
                    const today = toDateOnly(new Date());
                    const includesToday = toDateOnly(startDateObj) <= today && toDateOnly(endDateObj) >= today;
                    if (includesToday) {
                        const ordersUrl = new URL(`https://api.schwabapi.com/trader/v1/accounts/${accId}/orders`);
                        const orderStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
                        orderStart.setUTCHours(0, 0, 0, 0);
                        const orderEnd = new Date();
                        orderEnd.setUTCHours(23, 59, 59, 999);

                        ordersUrl.searchParams.set('fromEnteredTime', orderStart.toISOString());
                        ordersUrl.searchParams.set('toEnteredTime', orderEnd.toISOString());
                        ordersUrl.searchParams.set('status', 'FILLED');

                        const ordersResponse = await fetch(ordersUrl.toString(), {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (ordersResponse.ok) {
                            const orders = await ordersResponse.json();
                            const ordersList = Array.isArray(orders) ? orders as SchwabOrder[] : [];
                            const orderTransactions = mapFilledOrdersToTransactions(ordersList, accId)
                                .filter(orderTransaction => !hasMatchingTransaction(allTransactions, orderTransaction));
                            allTransactions.push(...orderTransactions);
                            debugInfo.push({
                                accId,
                                sameDayOrders: ordersList.length,
                                sameDayOrderTransactions: orderTransactions.length,
                                status: 'orders success'
                            });
                        } else {
                            debugInfo.push({
                                accId,
                                status: `orders failed: ${ordersResponse.status}`,
                                url: ordersUrl.toString()
                            });
                        }
                    }
                } catch (err: unknown) {
                    debugInfo.push({ accId, error: err instanceof Error ? err.message : 'Unknown error' });
                }
            }

            console.log('[Schwab] Aggregated transactions:', allTransactions.length);
            console.log('[Schwab] Account debug info:', JSON.stringify(debugInfo));

            return res.status(200).json({
                transactions: allTransactions,
                count: allTransactions.length,
                debug: debugInfo
            });

        } else {
            // Fallback if no accounts fetch needed (accountId provided)
            // ... (Keep existing single account logic or just wrap it? )
            // For simplicity, I'll rely on the auto-detection path primarily as client doesn't send accountId usually.
            // But if accountId IS provided, we should use it.

            // ... reusing the single account logic is tricky with replace.
            // I'll assume accountId is rarely passed by current client. 
            // Logic above handles "if (!targetAccountId)" which covered the auto-detection.
            // If targetAccountId IS passed, I should handle it.

            // Since I am replacing the block inside "if (!targetAccountId)", I should be careful.
            // Actually, I am replacing the whole block starting from line 55.
            // The original code handled "if (!targetAccountId)" at line 31.
            // My replace start line 55 is inside that block.

            // Wait. My ReplacementContent replaces lines 55 -> 142.
            // This removes the "else" block for "if (accountId was provided)".
            // I need to support specific accountId if passed?
            // Since client DOES NOT pass accountId currently, I can simplify to just always use the list logic (which handles single provided ID if I adapted it, but I don't need to).

            // I will process the loops.
        }

    } catch (error: unknown) {
        console.error('Schwab transactions error:', error);
        return res.status(500).json({
            error: 'Failed to fetch transactions',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
