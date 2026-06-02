import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

const localStorageMock = {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
        storage.delete(key);
    }),
};

const upsertMock = vi.fn(async () => ({ error: null }));
const deleteMock = vi.fn(async () => ({ error: null }));

vi.mock('../lib/supabase/client', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: null, error: { message: 'not found' } })),
            upsert: upsertMock,
            delete: vi.fn(() => ({
                eq: deleteMock,
            })),
        })),
    },
}));

const cacheTokens = (tokens: Record<string, unknown>) => {
    storage.set('schwab_tokens', btoa(JSON.stringify(tokens)));
};

const readCachedTokens = () => JSON.parse(atob(storage.get('schwab_tokens') || 'e30=')) as Record<string, unknown>;

const importAuth = async () => {
    vi.resetModules();
    return await import('./schwabAuth');
};

describe('Schwab token manager', () => {
    beforeEach(() => {
        storage.clear();
        vi.clearAllMocks();
        Object.defineProperty(globalThis, 'localStorage', {
            value: localStorageMock,
            configurable: true,
        });
        Object.defineProperty(globalThis, 'window', {
            value: {
                location: {
                    origin: 'https://trade-tracker-eight.vercel.app',
                    hostname: 'trade-tracker-eight.vercel.app',
                    port: '',
                },
            },
            configurable: true,
        });
    });

    it('refreshes near-expired access tokens with a single in-flight request', async () => {
        const { getValidAccessToken } = await importAuth();
        cacheTokens({
            accessToken: 'old-access',
            refreshToken: 'refresh-1',
            expiresAt: Date.now() + 60_000,
            refreshExpiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
            status: 'connected',
        });
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            accessToken: 'new-access',
            refreshToken: 'refresh-2',
            expiresAt: Date.now() + 30 * 60 * 1000,
            refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            tokenType: 'Bearer',
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const [first, second] = await Promise.all([
            getValidAccessToken(),
            getValidAccessToken(),
        ]);

        expect(first).toBe('new-access');
        expect(second).toBe('new-access');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(readCachedTokens().refreshToken).toBe('refresh-2');
    });

    it('does not delete tokens on transient refresh failure', async () => {
        const { getValidAccessToken, getCachedSchwabConnectionHealth } = await importAuth();
        cacheTokens({
            accessToken: 'old-access',
            refreshToken: 'refresh-1',
            expiresAt: Date.now() - 1,
            status: 'connected',
        });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            error: 'Token refresh failed',
            message: 'Temporary Schwab outage',
            requiresReauth: false,
        }), { status: 503, headers: { 'content-type': 'application/json' } })));

        await expect(getValidAccessToken()).rejects.toThrow('Temporary Schwab outage');

        expect(storage.has('schwab_tokens')).toBe(true);
        expect(getCachedSchwabConnectionHealth()).toMatchObject({
            connected: true,
            status: 'refresh_failed',
        });
    });

    it('marks clear invalid refresh tokens as reconnect required', async () => {
        const { getValidAccessToken, getCachedSchwabConnectionHealth } = await importAuth();
        cacheTokens({
            accessToken: 'old-access',
            refreshToken: 'refresh-1',
            expiresAt: Date.now() - 1,
            status: 'connected',
        });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            error: 'Refresh token expired',
            message: 'Schwab requires reconnect before syncing again.',
            requiresReauth: true,
        }), { status: 401, headers: { 'content-type': 'application/json' } })));

        await expect(getValidAccessToken()).rejects.toThrow('Session expired');

        expect(getCachedSchwabConnectionHealth()).toMatchObject({
            connected: false,
            status: 'reauth_required',
        });
    });

    it('retries Schwab transaction fetch once after access-token 401', async () => {
        const { fetchSchwabTransactions } = await importAuth();
        cacheTokens({
            accessToken: 'valid-but-rejected',
            refreshToken: 'refresh-1',
            expiresAt: Date.now() + 30 * 60 * 1000,
            status: 'connected',
        });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ requiresRefresh: true }), {
                status: 401,
                headers: { 'content-type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                accessToken: 'new-access',
                refreshToken: 'refresh-2',
                expiresAt: Date.now() + 30 * 60 * 1000,
                refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                transactions: [{ activityId: 1 }],
            }), { status: 200, headers: { 'content-type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const transactions = await fetchSchwabTransactions('2026-05-01', '2026-05-31');

        expect(transactions).toEqual([{ activityId: 1 }]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(readCachedTokens().accessToken).toBe('new-access');
    });
});
