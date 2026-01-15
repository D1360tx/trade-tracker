import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Scheduled Sync Endpoint
 * 
 * Runs daily at 3:30 PM EST (market close) to sync all users' trades
 * from their connected exchanges (Schwab, MEXC)
 * 
 * Security: Protected by CRON_SECRET environment variable
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Security: Verify cron secret
    const cronSecret = req.headers['x-vercel-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('[Cron] CRON_SECRET not configured');
        return res.status(500).json({ error: 'CRON_SECRET not configured' });
    }

    if (cronSecret !== expectedSecret) {
        console.warn('[Cron] Unauthorized sync attempt');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Cron] Starting scheduled sync at', new Date().toISOString());

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get all users
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw new Error(`Failed to list users: ${usersError.message}`);

        console.log(`[Cron] Found ${usersData.users.length} users to sync`);

        const results: any[] = [];
        let totalTradesAdded = 0;

        // Get the host for API calls
        const host = req.headers.host || 'trade-tracker-eight.vercel.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Sync each user
        for (const user of usersData.users) {
            const userId = user.id;
            const email = user.email || 'unknown';

            console.log(`[Cron] Syncing user: ${email}`);

            const userResult: any = {
                email,
                schwab: 0,
                mexc: 0,
                errors: []
            };

            // Check for Schwab OAuth tokens
            const { data: schwabTokens } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('user_id', userId)
                .eq('provider', 'schwab')
                .single();

            // Sync Schwab if tokens exist
            if (schwabTokens?.access_token) {
                try {
                    console.log(`[Cron] Syncing Schwab for ${email}`);
                    const schwabRes = await fetch(`${baseUrl}/api/schwab/transactions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId,
                            accessToken: schwabTokens.access_token,
                            refreshToken: schwabTokens.refresh_token
                        })
                    });

                    if (schwabRes.ok) {
                        const data = await schwabRes.json();
                        const trades = data.trades || [];

                        if (trades.length > 0) {
                            // Upsert trades to database
                            const { error: upsertError } = await supabase
                                .from('trades')
                                .upsert(
                                    trades.map((t: any) => ({ ...t, user_id: userId })),
                                    { onConflict: 'id' }
                                );

                            if (upsertError) {
                                console.error(`[Cron] Schwab upsert error for ${email}:`, upsertError.message);
                                userResult.errors.push(`Schwab upsert: ${upsertError.message}`);
                            } else {
                                userResult.schwab = trades.length;
                                totalTradesAdded += trades.length;
                            }
                        }
                    } else {
                        const errorText = await schwabRes.text();
                        console.error(`[Cron] Schwab API error for ${email}:`, errorText);
                        userResult.errors.push(`Schwab API: ${schwabRes.status}`);
                    }
                } catch (err: any) {
                    console.error(`[Cron] Schwab sync failed for ${email}:`, err.message);
                    userResult.errors.push(`Schwab: ${err.message}`);
                }
            }

            // Check for MEXC credentials
            const { data: mexcCreds } = await supabase
                .from('api_credentials')
                .select('*')
                .eq('user_id', userId)
                .eq('exchange', 'MEXC')
                .single();

            // Sync MEXC if credentials exist
            if (mexcCreds?.api_key && mexcCreds?.api_secret) {
                try {
                    console.log(`[Cron] Syncing MEXC for ${email}`);
                    let mexcTrades = 0;

                    // Sync Futures
                    const futuresRes = await fetch(`${baseUrl}/api/mexc-futures`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            apiKey: mexcCreds.api_key,
                            apiSecret: mexcCreds.api_secret
                        })
                    });

                    if (futuresRes.ok) {
                        const data = await futuresRes.json();
                        const trades = data.trades || [];

                        if (trades.length > 0) {
                            await supabase.from('trades').upsert(
                                trades.map((t: any) => ({ ...t, user_id: userId })),
                                { onConflict: 'id' }
                            );
                            mexcTrades += trades.length;
                        }
                    }

                    // Sync Spot
                    const spotRes = await fetch(`${baseUrl}/api/mexc-spot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            apiKey: mexcCreds.api_key,
                            apiSecret: mexcCreds.api_secret
                        })
                    });

                    if (spotRes.ok) {
                        const data = await spotRes.json();
                        const trades = data.trades || [];

                        if (trades.length > 0) {
                            await supabase.from('trades').upsert(
                                trades.map((t: any) => ({ ...t, user_id: userId })),
                                { onConflict: 'id' }
                            );
                            mexcTrades += trades.length;
                        }
                    }

                    userResult.mexc = mexcTrades;
                    totalTradesAdded += mexcTrades;

                } catch (err: any) {
                    console.error(`[Cron] MEXC sync failed for ${email}:`, err.message);
                    userResult.errors.push(`MEXC: ${err.message}`);
                }
            }

            // Only add to results if user had any configured exchanges
            if (schwabTokens || mexcCreds) {
                results.push(userResult);
            }
        }

        const summary = {
            success: true,
            timestamp: new Date().toISOString(),
            usersProcessed: results.length,
            totalTradesAdded,
            results
        };

        console.log('[Cron] Sync complete:', JSON.stringify(summary, null, 2));

        return res.status(200).json(summary);

    } catch (error: any) {
        console.error('[Cron] Sync failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
