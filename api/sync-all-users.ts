import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Scheduled Sync Endpoint
 * 
 * Runs on a schedule to sync all users' trades from their connected exchanges
 * 
 * Schedule (EST):
 * - Monday 8:31 AM (weekend catchup)
 * - Every hour 9 AM - 3 PM weekdays
 * - 3:30 PM weekdays (market close)
 * 
 * Security: Protected by CRON_SECRET environment variable
 * 
 * Last updated: 2026-01-14 16:11 CST
 */

interface SyncResult {
    userId: string;
    email: string;
    exchanges: {
        name: string;
        success: boolean;
        tradesAdded: number;
        error?: string;
    }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Security: Verify cron secret
    const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('[Cron] CRON_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (cronSecret !== expectedSecret) {
        console.warn('[Cron] Unauthorized sync attempt');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Cron] Starting scheduled sync at', new Date().toISOString());

    try {
        // Import Supabase client
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role for admin access

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get all users
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

        if (usersError) {
            throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        console.log(`[Cron] Found ${users.users.length} users to sync`);

        const results: SyncResult[] = [];
        let totalTradesAdded = 0;

        // Sync each user
        for (const user of users.users) {
            const userId = user.id;
            const email = user.email || 'unknown';

            console.log(`[Cron] Syncing user: ${email}`);

            const userResult: SyncResult = {
                userId,
                email,
                exchanges: []
            };

            // Check which exchanges this user has configured
            const { data: credentials } = await supabase
                .from('api_credentials')
                .select('exchange, api_key, api_secret')
                .eq('user_id', userId);

            // Also check for Schwab OAuth tokens
            const { data: schwabTokens } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('user_id', userId)
                .eq('provider', 'schwab')
                .single();

            // Sync Schwab if OAuth tokens exist
            if (schwabTokens) {
                try {
                    const schwabResult = await syncSchwab(userId, schwabTokens, supabase);
                    userResult.exchanges.push({
                        name: 'Schwab',
                        success: true,
                        tradesAdded: schwabResult.tradesAdded
                    });
                    totalTradesAdded += schwabResult.tradesAdded;
                } catch (error: any) {
                    console.error(`[Cron] Schwab sync failed for ${email}:`, error.message);
                    userResult.exchanges.push({
                        name: 'Schwab',
                        success: false,
                        tradesAdded: 0,
                        error: error.message
                    });
                }
            }

            // Sync MEXC if credentials exist
            const mexcCreds = credentials?.find(c => c.exchange === 'MEXC');
            if (mexcCreds?.api_key && mexcCreds?.api_secret) {
                try {
                    const mexcResult = await syncMEXC(userId, mexcCreds, supabase);
                    userResult.exchanges.push({
                        name: 'MEXC',
                        success: true,
                        tradesAdded: mexcResult.tradesAdded
                    });
                    totalTradesAdded += mexcResult.tradesAdded;
                } catch (error: any) {
                    console.error(`[Cron] MEXC sync failed for ${email}:`, error.message);
                    userResult.exchanges.push({
                        name: 'MEXC',
                        success: false,
                        tradesAdded: 0,
                        error: error.message
                    });
                }
            }

            // Add ByBit sync here if needed in the future

            if (userResult.exchanges.length > 0) {
                results.push(userResult);
            }
        }

        const summary = {
            timestamp: new Date().toISOString(),
            usersProcessed: results.length,
            totalTradesAdded,
            results
        };

        console.log('[Cron] Sync complete:', summary);

        return res.status(200).json(summary);

    } catch (error: any) {
        console.error('[Cron] Sync failed:', error);
        return res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Sync Schwab trades for a user
async function syncSchwab(userId: string, tokens: any, supabase: any) {
    // Call Schwab API to get transactions
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/schwab/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
        })
    });

    if (!response.ok) {
        throw new Error(`Schwab API error: ${response.statusText}`);
    }

    const data = await response.json();
    const trades = data.trades || [];

    // Store trades in database
    if (trades.length > 0) {
        const { error } = await supabase
            .from('trades')
            .upsert(trades.map((t: any) => ({ ...t, user_id: userId })), {
                onConflict: 'id'
            });

        if (error) {
            throw new Error(`Failed to store Schwab trades: ${error.message}`);
        }
    }

    return { tradesAdded: trades.length };
}

// Sync MEXC trades for a user
async function syncMEXC(userId: string, credentials: any, supabase: any) {
    let totalTrades = 0;

    // Sync Futures
    try {
        const futuresResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/mexc-futures`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: credentials.api_key,
                apiSecret: credentials.api_secret
            })
        });

        if (futuresResponse.ok) {
            const futuresData = await futuresResponse.json();
            const futuresTrades = futuresData.trades || [];

            if (futuresTrades.length > 0) {
                await supabase.from('trades').upsert(
                    futuresTrades.map((t: any) => ({ ...t, user_id: userId })),
                    { onConflict: 'id' }
                );
                totalTrades += futuresTrades.length;
            }
        }
    } catch (error) {
        console.error('[Cron] MEXC Futures sync error:', error);
    }

    // Sync Spot
    try {
        const spotResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/mexc-spot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: credentials.api_key,
                apiSecret: credentials.api_secret
            })
        });

        if (spotResponse.ok) {
            const spotData = await spotResponse.json();
            const spotTrades = spotData.trades || [];

            if (spotTrades.length > 0) {
                await supabase.from('trades').upsert(
                    spotTrades.map((t: any) => ({ ...t, user_id: userId })),
                    { onConflict: 'id' }
                );
                totalTrades += spotTrades.length;
            }
        }
    } catch (error) {
        console.error('[Cron] MEXC Spot sync error:', error);
    }

    return { tradesAdded: totalTrades };
}
