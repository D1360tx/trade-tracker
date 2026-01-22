/**
 * Schwab OAuth Authentication Utilities
 * 
 * Handles token storage, refresh, and API communication
 * Tokens are stored in Supabase for persistence, with localStorage as cache
 */

import { supabase } from '../lib/supabase/client';

export interface SchwabTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    tokenType?: string;
    scope?: string;
}

const STORAGE_KEY = 'schwab_tokens';

/**
 * Check if user is connected to Schwab
 */
export const isConnectedToSchwab = (): boolean => {
    const tokens = getSchwabTokensFromCache();
    return tokens !== null && tokens.refreshToken !== undefined;
};

/**
 * Get stored tokens from localStorage cache
 */
export const getSchwabTokensFromCache = (): SchwabTokens | null => {
    try {
        const encoded = localStorage.getItem(STORAGE_KEY);
        if (!encoded) return null;
        return JSON.parse(atob(encoded));
    } catch {
        return null;
    }
};

/**
 * Get stored tokens (checks cache first, then Supabase)
 */
export const getSchwabTokens = (): SchwabTokens | null => {
    // First check localStorage cache
    return getSchwabTokensFromCache();
};

/**
 * Load Schwab tokens from Supabase and cache locally
 * Call this on app startup
 */
export const loadSchwabTokensFromCloud = async (): Promise<SchwabTokens | null> => {
    try {
        const { data, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('exchange', 'Schwab')
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return null;
        }

        // Reconstruct tokens from stored data
        const cred = data as { api_key: string; api_secret: string; expires_at?: string };
        const tokens: SchwabTokens = {
            accessToken: cred.api_key, // We store access token in api_key field
            refreshToken: cred.api_secret, // We store refresh token in api_secret field
            expiresAt: cred.expires_at ? new Date(cred.expires_at).getTime() : Date.now() + 1800000,
            tokenType: 'Bearer'
        };

        // Cache locally
        const encoded = btoa(JSON.stringify(tokens));
        localStorage.setItem(STORAGE_KEY, encoded);

        return tokens;
    } catch (e) {
        console.error('[Schwab] Failed to load tokens from cloud:', e);
        return null;
    }
};

/**
 * Store tokens (saves to both localStorage and Supabase)
 */
export const saveSchwabTokens = async (tokens: SchwabTokens): Promise<void> => {
    // Save to localStorage immediately (cache)
    const encoded = btoa(JSON.stringify(tokens));
    localStorage.setItem(STORAGE_KEY, encoded);

    // Save to Supabase for persistence
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('[Schwab] No user, tokens saved to localStorage only');
            return;
        }

        const { error } = await supabase
            .from('api_credentials')
            // @ts-expect-error - Supabase type inference issue
            .upsert({
                user_id: user.id,
                exchange: 'Schwab',
                api_key: tokens.accessToken,
                api_secret: tokens.refreshToken,
                expires_at: new Date(tokens.expiresAt).toISOString(),
                is_active: true
            }, {
                onConflict: 'user_id,exchange'
            });

        if (error) {
            console.error('[Schwab] Failed to save tokens to cloud:', error);
        } else {
            console.log('[Schwab] Tokens saved to cloud successfully');
        }
    } catch (e) {
        console.error('[Schwab] Error saving tokens to cloud:', e);
    }
};

/**
 * Clear stored tokens (disconnect)
 */
export const disconnectSchwab = async (): Promise<void> => {
    localStorage.removeItem(STORAGE_KEY);

    // Also remove from Supabase
    try {
        await supabase
            .from('api_credentials')
            .delete()
            .eq('exchange', 'Schwab');
    } catch (e) {
        console.error('[Schwab] Error removing tokens from cloud:', e);
    }
};

/**
 * Check if access token is expired or about to expire
 */
export const isTokenExpired = (): boolean => {
    const tokens = getSchwabTokens();
    if (!tokens) return true;
    // Consider expired if less than 2 minutes remaining
    return Date.now() > tokens.expiresAt - 120000;
};

/**
 * Initiate Schwab OAuth connection
 * Opens a popup window for user to login
 */
export const connectSchwab = async (): Promise<SchwabTokens> => {
    // Get authorization URL from backend
    const response = await fetch('/api/schwab/auth-url');
    const { authUrl, error } = await response.json();

    if (error) {
        throw new Error(error);
    }

    // Open popup for OAuth
    const popup = window.open(
        authUrl,
        'schwab-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
    }

    return new Promise<SchwabTokens>((resolve, reject) => {
        // Listen for message from popup
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SCHWAB_AUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage);
                const tokens = event.data.data as SchwabTokens;
                await saveSchwabTokens(tokens);
                resolve(tokens);
            }
        };

        window.addEventListener('message', handleMessage);

        // Poll for popup close (in case user closes it)
        const pollTimer = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollTimer);
                window.removeEventListener('message', handleMessage);

                // Check if tokens were saved via redirect fallback
                const tokens = getSchwabTokens();
                if (tokens) {
                    resolve(tokens);
                } else {
                    reject(new Error('Authentication cancelled'));
                }
            }
        }, 500);
    });
};

/**
 * Refresh access token if needed
 * Returns valid access token
 */
export const getValidAccessToken = async (): Promise<string> => {
    const tokens = getSchwabTokens();
    if (!tokens) {
        throw new Error('Not connected to Schwab');
    }

    // If token is still valid, return it
    if (!isTokenExpired()) {
        return tokens.accessToken;
    }

    // Refresh the token
    const response = await fetch('/api/schwab/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });

    if (!response.ok) {
        const error = await response.json();
        if (error.requiresReauth) {
            await disconnectSchwab();
            throw new Error('Session expired. Please reconnect to Schwab.');
        }
        throw new Error(error.message || 'Failed to refresh token');
    }

    const newTokens = await response.json() as SchwabTokens;
    await saveSchwabTokens(newTokens);

    return newTokens.accessToken;
};

/**
 * Fetch transactions from Schwab
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchSchwabTransactions = async (startDate?: string, endDate?: string): Promise<any[]> => {
    const accessToken = await getValidAccessToken();

    const url = new URL('/api/schwab/transactions', window.location.origin);
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);

    // Log sync window for debugging
    if (startDate && endDate) {
        const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`[Schwab Sync] Fetching transactions from ${startDate} to ${endDate} (${daysDiff} days)`);
    }

    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const error = await response.json();

        // Log full error details for debugging
        console.error('[Schwab Client] Transaction fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            error: error,
            url: url.toString()
        });

        if (error.requiresRefresh) {
            // Token expired mid-request, try once more
            return fetchSchwabTransactions(startDate, endDate);
        }

        // Include full error details in the thrown error
        const errorMessage = error.message || 'Failed to fetch transactions';
        const fullError = error.accountStructure
            ? `${errorMessage}\n\nAccount structure fields: ${error.accountStructure.join(', ')}`
            : errorMessage;

        throw new Error(fullError);
    }

    const data = await response.json();

    // Log backend debug info for troubleshooting
    if (data.debug) {
        console.log('[Schwab Client] Backend debug info:', data.debug);
        console.log('[Schwab Client] Transaction count:', data.count || 0);
    }

    return data.transactions || [];
};
