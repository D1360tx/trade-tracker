import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Security: Verify cron secret
    const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        return res.status(500).json({ error: 'CRON_SECRET not configured' });
    }

    if (cronSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Cron] Starting sync at', new Date().toISOString());

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get all users
        const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw usersError;

        const results = [];
        let totalTrades = 0;

        // Sync each user
        for (const user of usersData.users) {
            const userId = user.id;
            const email = user.email || 'unknown';

            console.log(`[Cron] Syncing user: ${email}`);

            // Check for Schwab tokens
            const { data: schwabTokens } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('user_id', userId)
                .eq('provider', 'schwab')
                .single();

            // Sync Schwab
            if (schwabTokens) {
                try {
                    const schwabUrl = `https://${req.headers.host}/api/schwab/transactions`;
                    const schwabRes = await fetch(schwabUrl, {
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
                            await supabase.from('trades').upsert(
                                trades.map((t: any) => ({ ...t, user_id: userId })),
                                { onConflict: 'id' }
                            );
                            totalTrades += trades.length;
                        }

                        results.push({ email, schwab: trades.length });
                    }
                } catch (err: any) {
                    console.error(`Schwab sync failed for ${email}:`, err.message);
                    results.push({ email, schwab: 0, error: err.message });
                }
            }

            // Check for MEXC credentials
            const { data: mexcCreds } = await supabase
                .from('api_credentials')
                .select('*')
                .eq('user_id', userId)
                .eq('exchange', 'MEXC')
                .single();

            // Sync MEXC
            if (mexcCreds?.api_key && mexcCreds?.api_secret) {
                try {
                    // Sync Futures
                    const futuresUrl = `https://${req.headers.host}/api/mexc-futures`;
                    const futuresRes = await fetch(futuresUrl, {
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
                            totalTrades += trades.length;
                        }
                    }

                    // Sync Spot
                    const spotUrl = `https://${req.headers.host}/api/mexc-spot`;
                    const spotRes = await fetch(spotUrl, {
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
                            totalTrades += trades.length;
                        }
                    }
                } catch (err: any) {
                    console.error(`MEXC sync failed for ${email}:`, err.message);
                }
            }
        }

        return res.status(200).json({
            timestamp: new Date().toISOString(),
            usersProcessed: usersData.users.length,
            totalTradesAdded: totalTrades,
            results
        });

    } catch (error: any) {
        console.error('[Cron] Sync failed:', error);
        return res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
