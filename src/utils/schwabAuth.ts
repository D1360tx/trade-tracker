/**
 * Schwab OAuth Authentication Utilities
 * 
 * Handles token storage, refresh, and API communication
 */

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
    const tokens = getSchwabTokens();
    return tokens !== null && tokens.refreshToken !== undefined;
};

/**
 * Get stored tokens (decrypted)
 */
export const getSchwabTokens = (): SchwabTokens | null => {
    try {
        const encoded = localStorage.getItem(STORAGE_KEY);
        if (!encoded) return null;
        return JSON.parse(atob(encoded));
    } catch {
        return null;
    }
};

/**
 * Store tokens (encrypted with base64)
 */
export const saveSchwabTokens = (tokens: SchwabTokens): void => {
    const encoded = btoa(JSON.stringify(tokens));
    localStorage.setItem(STORAGE_KEY, encoded);
};

/**
 * Clear stored tokens (disconnect)
 */
export const disconnectSchwab = (): void => {
    localStorage.removeItem(STORAGE_KEY);
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
export const connectSchwab = (): Promise<SchwabTokens> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get authorization URL from backend
            const response = await fetch('/api/schwab/auth-url');
            const { authUrl, error } = await response.json();

            if (error) {
                reject(new Error(error));
                return;
            }

            // Open popup for OAuth
            const popup = window.open(
                authUrl,
                'schwab-auth',
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );

            if (!popup) {
                reject(new Error('Popup blocked. Please allow popups for this site.'));
                return;
            }

            // Listen for message from popup
            const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === 'SCHWAB_AUTH_SUCCESS') {
                    window.removeEventListener('message', handleMessage);
                    const tokens = event.data.data as SchwabTokens;
                    saveSchwabTokens(tokens);
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

        } catch (error) {
            reject(error);
        }
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
            disconnectSchwab();
            throw new Error('Session expired. Please reconnect to Schwab.');
        }
        throw new Error(error.message || 'Failed to refresh token');
    }

    const newTokens = await response.json() as SchwabTokens;
    saveSchwabTokens(newTokens);

    return newTokens.accessToken;
};

/**
 * Fetch transactions from Schwab
 */
export const fetchSchwabTransactions = async (startDate?: string, endDate?: string): Promise<any[]> => {
    const accessToken = await getValidAccessToken();

    const url = new URL('/api/schwab/transactions', window.location.origin);
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);

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
    return data.transactions || [];
};
