/**
 * Schwab OAuth Authentication Utilities
 *
 * OAuth tokens are persisted in Supabase oauth_tokens and cached in localStorage.
 * localStorage is only a browser cache so refreshes can survive page reloads quickly.
 */

import { supabase } from '../lib/supabase/client';

export type SchwabTokenStatus = 'connected' | 'refresh_failed' | 'reauth_required' | 'disconnected';

export interface SchwabTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    refreshExpiresAt?: number;
    lastRefreshedAt?: number;
    lastSuccessfulSyncAt?: number;
    lastError?: string | null;
    status?: SchwabTokenStatus;
    tokenType?: string;
    scope?: string;
}

export interface SchwabConnectionHealth {
    connected: boolean;
    status: SchwabTokenStatus;
    label: string;
    message: string;
    accessExpiresAt?: number;
    refreshExpiresAt?: number;
    lastRefreshedAt?: number;
    lastSuccessfulSyncAt?: number;
    lastError?: string | null;
    needsReconnectSoon: boolean;
}

export interface SchwabAccountSnapshot {
    accounts: Array<{
        accountHash: string;
        accountNumber?: string;
        type?: string;
        currentBalances: Record<string, unknown>;
        initialBalances: Record<string, unknown>;
        positionsCount: number;
        error?: string;
    }>;
    fetchedAt: string;
}

type OAuthTokenRow = {
    access_token: string;
    refresh_token: string;
    access_expires_at: string;
    refresh_expires_at?: string | null;
    last_refreshed_at?: string | null;
    last_successful_sync_at?: string | null;
    last_error?: string | null;
    status?: SchwabTokenStatus | null;
};

type RefreshResponse = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    refreshExpiresAt?: number;
    tokenType?: string;
    requiresReauth?: boolean;
    message?: string;
    error?: string;
};

const STORAGE_KEY = 'schwab_tokens';
const SCHWAB_PROVIDER = 'schwab';
const SCHWAB_AUTH_ENDPOINT = '/api/schwab/auth-url';
const ACCESS_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const REFRESH_RECONNECT_WARNING_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

let refreshPromise: Promise<SchwabTokens> | null = null;

const encodeTokens = (tokens: SchwabTokens) => btoa(JSON.stringify(tokens));
const decodeTokens = (encoded: string): SchwabTokens => JSON.parse(atob(encoded)) as SchwabTokens;
const toIso = (timestamp?: number) => timestamp ? new Date(timestamp).toISOString() : null;
const toTime = (value?: string | null) => value ? new Date(value).getTime() : undefined;

export const shouldRefreshAccessToken = (tokens: Pick<SchwabTokens, 'expiresAt'>, now = Date.now()) => {
    return now > tokens.expiresAt - ACCESS_REFRESH_BUFFER_MS;
};

export const getDefaultRefreshExpiresAt = (now = Date.now()) => now + DEFAULT_REFRESH_LIFETIME_MS;

const getSchwabApiUnavailableMessage = () => {
    const isLocalVite = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5173';
    if (isLocalVite) {
        return 'Could not reach the Schwab OAuth API route. Local Vite dev servers do not run the /api serverless functions; run the app with `vercel dev` or use the deployed Vercel URL to connect Schwab.';
    }
    return 'Could not reach the Schwab OAuth API route. Check that the Vercel deployment is healthy and Schwab environment variables are configured.';
};

const parseApiError = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const body = await response.json().catch(() => null) as { error?: string; message?: string; details?: string } | null;
        return body?.message || body?.error || body?.details;
    }
    const text = await response.text().catch(() => '');
    return text ? text.slice(0, 300) : undefined;
};

const cacheTokens = (tokens: SchwabTokens) => {
    localStorage.setItem(STORAGE_KEY, encodeTokens(tokens));
};

const mapRowToTokens = (row: OAuthTokenRow): SchwabTokens => ({
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.access_expires_at).getTime(),
    refreshExpiresAt: toTime(row.refresh_expires_at),
    lastRefreshedAt: toTime(row.last_refreshed_at),
    lastSuccessfulSyncAt: toTime(row.last_successful_sync_at),
    lastError: row.last_error,
    status: row.status || 'connected',
    tokenType: 'Bearer',
});

const buildHealthFromTokens = (tokens: SchwabTokens | null): SchwabConnectionHealth => {
    if (!tokens?.refreshToken) {
        return {
            connected: false,
            status: 'disconnected',
            label: 'Not connected',
            message: 'Connect Schwab to sync trades and balances.',
            needsReconnectSoon: false,
        };
    }

    const status = tokens.status || 'connected';
    const refreshExpiresAt = tokens.refreshExpiresAt;
    const needsReconnectSoon = !!refreshExpiresAt && refreshExpiresAt - Date.now() <= REFRESH_RECONNECT_WARNING_MS;

    if (status === 'reauth_required') {
        return {
            connected: false,
            status,
            label: 'Reconnect required',
            message: tokens.lastError || 'Schwab requires a fresh login before syncing again.',
            accessExpiresAt: tokens.expiresAt,
            refreshExpiresAt,
            lastRefreshedAt: tokens.lastRefreshedAt,
            lastSuccessfulSyncAt: tokens.lastSuccessfulSyncAt,
            lastError: tokens.lastError,
            needsReconnectSoon: false,
        };
    }

    if (needsReconnectSoon) {
        return {
            connected: true,
            status,
            label: 'Reconnect soon',
            message: 'Schwab refresh access is close to expiring. Reconnect within 24 hours to avoid a sync interruption.',
            accessExpiresAt: tokens.expiresAt,
            refreshExpiresAt,
            lastRefreshedAt: tokens.lastRefreshedAt,
            lastSuccessfulSyncAt: tokens.lastSuccessfulSyncAt,
            lastError: tokens.lastError,
            needsReconnectSoon: true,
        };
    }

    if (status === 'refresh_failed') {
        return {
            connected: true,
            status,
            label: 'Refresh issue',
            message: tokens.lastError || 'The last refresh failed, but the connection has not been cleared.',
            accessExpiresAt: tokens.expiresAt,
            refreshExpiresAt,
            lastRefreshedAt: tokens.lastRefreshedAt,
            lastSuccessfulSyncAt: tokens.lastSuccessfulSyncAt,
            lastError: tokens.lastError,
            needsReconnectSoon: false,
        };
    }

    return {
        connected: true,
        status: 'connected',
        label: 'Connected',
        message: 'Schwab OAuth is connected and ready to sync.',
        accessExpiresAt: tokens.expiresAt,
        refreshExpiresAt,
        lastRefreshedAt: tokens.lastRefreshedAt,
        lastSuccessfulSyncAt: tokens.lastSuccessfulSyncAt,
        lastError: tokens.lastError,
        needsReconnectSoon: false,
    };
};

export const getSchwabTokensFromCache = (): SchwabTokens | null => {
    try {
        const encoded = localStorage.getItem(STORAGE_KEY);
        return encoded ? decodeTokens(encoded) : null;
    } catch {
        return null;
    }
};

export const getSchwabTokens = (): SchwabTokens | null => getSchwabTokensFromCache();

export const getCachedSchwabConnectionHealth = (): SchwabConnectionHealth => {
    return buildHealthFromTokens(getSchwabTokensFromCache());
};

export const isConnectedToSchwab = (): boolean => getCachedSchwabConnectionHealth().connected;

export const loadSchwabTokensFromCloud = async (): Promise<SchwabTokens | null> => {
    try {
        const { data, error } = await supabase
            .from('oauth_tokens')
            .select('*')
            .eq('provider', SCHWAB_PROVIDER)
            .single();

        if (!error && data) {
            const tokens = mapRowToTokens(data as OAuthTokenRow);
            cacheTokens(tokens);
            return tokens;
        }

        return await migrateLegacySchwabTokens();
    } catch (error) {
        console.error('[Schwab] Failed to load OAuth tokens:', error);
        return getSchwabTokensFromCache();
    }
};

const migrateLegacySchwabTokens = async (): Promise<SchwabTokens | null> => {
    try {
        const { data, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('exchange', 'Schwab')
            .eq('is_active', true)
            .single();

        if (error || !data) return null;

        const legacy = data as { api_key: string; api_secret: string; expires_at?: string | null };
        const tokens: SchwabTokens = {
            accessToken: legacy.api_key,
            refreshToken: legacy.api_secret,
            expiresAt: legacy.expires_at ? new Date(legacy.expires_at).getTime() : Date.now() + 30 * 60 * 1000,
            refreshExpiresAt: getDefaultRefreshExpiresAt(),
            lastRefreshedAt: Date.now(),
            status: 'connected',
            tokenType: 'Bearer',
        };

        await saveSchwabTokens(tokens);
        return tokens;
    } catch {
        return null;
    }
};

export const getSchwabConnectionHealth = async (): Promise<SchwabConnectionHealth> => {
    const tokens = getSchwabTokensFromCache() || await loadSchwabTokensFromCloud();
    return buildHealthFromTokens(tokens);
};

export const saveSchwabTokens = async (tokens: SchwabTokens): Promise<void> => {
    const nextTokens: SchwabTokens = {
        ...tokens,
        refreshExpiresAt: tokens.refreshExpiresAt || getDefaultRefreshExpiresAt(),
        status: tokens.status || 'connected',
        lastError: tokens.lastError ?? null,
    };

    cacheTokens(nextTokens);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tokenRow = {
            user_id: user.id,
            provider: SCHWAB_PROVIDER,
            access_token: nextTokens.accessToken,
            refresh_token: nextTokens.refreshToken,
            access_expires_at: new Date(nextTokens.expiresAt).toISOString(),
            refresh_expires_at: toIso(nextTokens.refreshExpiresAt),
            last_refreshed_at: toIso(nextTokens.lastRefreshedAt),
            last_successful_sync_at: toIso(nextTokens.lastSuccessfulSyncAt),
            last_error: nextTokens.lastError || null,
            status: nextTokens.status || 'connected',
        };

        const { error } = await supabase
            .from('oauth_tokens')
            // @ts-expect-error - Supabase type inference issue for newly added oauth_tokens table
            .upsert(tokenRow, {
                onConflict: 'user_id,provider'
            });

        if (error) {
            console.error('[Schwab] Failed to save OAuth tokens:', error);
        }
    } catch (error) {
        console.error('[Schwab] Error saving OAuth tokens:', error);
    }
};

export const updateSchwabTokenHealth = async (
    updates: Partial<Pick<SchwabTokens, 'status' | 'lastError' | 'lastSuccessfulSyncAt' | 'lastRefreshedAt'>>
): Promise<void> => {
    const existing = getSchwabTokensFromCache() || await loadSchwabTokensFromCloud();
    if (!existing) return;
    await saveSchwabTokens({ ...existing, ...updates });
};

export const markSchwabSyncSuccess = async (): Promise<void> => {
    await updateSchwabTokenHealth({
        status: 'connected',
        lastError: null,
        lastSuccessfulSyncAt: Date.now(),
    });
};

export const disconnectSchwab = async (): Promise<void> => {
    localStorage.removeItem(STORAGE_KEY);

    try {
        await supabase
            .from('oauth_tokens')
            .delete()
            .eq('provider', SCHWAB_PROVIDER);

        // Clean legacy storage if it still exists.
        await supabase
            .from('api_credentials')
            .delete()
            .eq('exchange', 'Schwab');
    } catch (error) {
        console.error('[Schwab] Error removing OAuth tokens:', error);
    }
};

export const isTokenExpired = (): boolean => {
    const tokens = getSchwabTokens();
    if (!tokens) return true;
    return shouldRefreshAccessToken(tokens);
};

export const connectSchwab = async (): Promise<SchwabTokens> => {
    let response: Response;
    try {
        response = await fetch(SCHWAB_AUTH_ENDPOINT, {
            headers: { Accept: 'application/json' },
        });
    } catch {
        throw new Error(getSchwabApiUnavailableMessage());
    }

    if (!response.ok) {
        const apiMessage = await parseApiError(response);
        throw new Error(apiMessage || `Schwab auth URL request failed with HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error(getSchwabApiUnavailableMessage());
    }

    const { authUrl, error, message } = await response.json();

    if (error) throw new Error(message || error);
    if (!authUrl) throw new Error('Schwab auth URL response was missing authUrl.');

    const popup = window.open(authUrl, 'schwab-auth', 'width=600,height=700,scrollbars=yes,resizable=yes');
    if (!popup) throw new Error('Popup blocked. Please allow popups for this site.');

    return new Promise<SchwabTokens>((resolve, reject) => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SCHWAB_AUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage);
                const tokens = event.data.data as SchwabTokens;
                const connectedTokens: SchwabTokens = {
                    ...tokens,
                    refreshExpiresAt: tokens.refreshExpiresAt || getDefaultRefreshExpiresAt(),
                    lastRefreshedAt: Date.now(),
                    status: 'connected',
                    lastError: null,
                };
                await saveSchwabTokens(connectedTokens);
                resolve(connectedTokens);
            }
        };

        window.addEventListener('message', handleMessage);

        const pollTimer = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollTimer);
                window.removeEventListener('message', handleMessage);

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

const refreshSchwabTokens = async (force = false): Promise<SchwabTokens> => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const tokens = getSchwabTokensFromCache() || await loadSchwabTokensFromCloud();
        if (!tokens) throw new Error('Not connected to Schwab');
        if (tokens.status === 'reauth_required') {
            throw new Error('Session expired. Please reconnect to Schwab.');
        }

        if (!force && !shouldRefreshAccessToken(tokens)) {
            return tokens;
        }

        // Track attempts for backoff / observability (stored in health)
        const attemptCount = ((tokens as any).refreshAttemptCount || 0) + 1;
        await updateSchwabTokenHealth({ lastError: `refresh attempt #${attemptCount}` } as any);

        const response = await fetch('/api/schwab/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: tokens.refreshToken })
        });

        const body = await response.json().catch(() => ({})) as RefreshResponse;

        if (!response.ok) {
            const message = body.message || body.error || 'Failed to refresh Schwab token';
            if (body.requiresReauth) {
                await updateSchwabTokenHealth({ status: 'reauth_required', lastError: message });
                throw new Error('Session expired. Please reconnect to Schwab.');
            }

            // Transient failure: update health but attempt graceful fallback
            await updateSchwabTokenHealth({ status: 'refresh_failed', lastError: `attempt #${attemptCount}: ${message}` });

            // Fallback: if the existing access token is still usable (not past buffer), return it
            if (!shouldRefreshAccessToken(tokens)) {
                console.warn('[Schwab] Transient refresh failure; falling back to cached access token:', message);
                return tokens;
            }

            throw new Error(message);
        }

        const refreshed: SchwabTokens = {
            ...tokens,
            accessToken: body.accessToken,
            refreshToken: body.refreshToken || tokens.refreshToken,
            expiresAt: body.expiresAt,
            refreshExpiresAt: body.refreshToken
                ? (body.refreshExpiresAt || getDefaultRefreshExpiresAt())
                : tokens.refreshExpiresAt,
            lastRefreshedAt: Date.now(),
            lastError: null,
            status: 'connected',
            tokenType: body.tokenType || tokens.tokenType,
        } as any;

        // reset attempt counter implicitly by clearing lastError
        await saveSchwabTokens(refreshed);
        return refreshed;
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
};

export const getValidAccessToken = async (forceRefresh = false): Promise<string> => {
    const tokens = await refreshSchwabTokens(forceRefresh);
    return tokens.accessToken;
};

const fetchWithSchwabAuth = async (
    url: URL,
    options: RequestInit = {},
    retry = true
): Promise<Response> => {
    const accessToken = await getValidAccessToken(!retry);
    const response = await fetch(url.toString(), {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        },
    });

    if (!response.ok && retry) {
        const body = await response.clone().json().catch(() => ({})) as { requiresRefresh?: boolean };
        if (body.requiresRefresh || response.status === 401) {
            // Force a fresh token; if transient failure occurred upstream, getValid will fallback
            const refreshedAccessToken = await getValidAccessToken(true);
            return fetch(url.toString(), {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${refreshedAccessToken}`,
                    Accept: 'application/json',
                },
            });
        }
    }

    return response;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchSchwabTransactions = async (startDate?: string, endDate?: string): Promise<any[]> => {
    const url = new URL('/api/schwab/transactions', window.location.origin);
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);

    const response = await fetchWithSchwabAuth(url);

    if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string; error?: string; accountStructure?: string[] };
        const errorMessage = error.message || error.error || 'Failed to fetch transactions';
        const fullError = error.accountStructure
            ? `${errorMessage}\n\nAccount structure fields: ${error.accountStructure.join(', ')}`
            : errorMessage;
        throw new Error(fullError);
    }

    const data = await response.json();
    await markSchwabSyncSuccess();
    return data.transactions || [];
};

export const fetchSchwabAccountSnapshot = async (): Promise<SchwabAccountSnapshot> => {
    const url = new URL('/api/schwab/accounts', window.location.origin);
    const response = await fetchWithSchwabAuth(url);

    if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(error.message || error.error || 'Failed to fetch Schwab account balances');
    }

    return await response.json() as SchwabAccountSnapshot;
};
