import { supabase } from './client';

/**
 * Fetch all API credentials for the current user
 */
export const fetchAPICredentials = async (): Promise<Record<string, { key: string; secret: string }>> => {
    const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching API credentials:', error);
        throw error;
    }

    // Convert to Record format
    const credentials: Record<string, { key: string; secret: string }> = {};
    data?.forEach((cred: any) => {
        credentials[cred.exchange] = {
            key: cred.api_key,
            secret: cred.api_secret
        };
    });

    return credentials;
};

/**
 * Save or update API credentials for an exchange
 */
export const saveAPICredentials = async (exchange: string, apiKey: string, apiSecret: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upsert (insert or update)
    const { error } = await supabase
        .from('api_credentials')
        .upsert({
            user_id: user.id,
            exchange,
            api_key: apiKey,
            api_secret: apiSecret,
            is_active: true
        } as any, {
            onConflict: 'user_id,exchange'
        });

    if (error) {
        console.error('Error saving API credentials:', error);
        throw error;
    }
};

/**
 * Delete API credentials for an exchange
 */
export const deleteAPICredentials = async (exchange: string): Promise<void> => {
    const { error } = await supabase
        .from('api_credentials')
        .delete()
        .eq('exchange', exchange);

    if (error) {
        console.error('Error deleting API credentials:', error);
        throw error;
    }
};

/**
 * Get specific exchange credentials
 */
export const getExchangeCredentials = async (exchange: string): Promise<{ key: string; secret: string } | null> => {
    const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('exchange', exchange)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching exchange credentials:', error);
        throw error;
    }

    return {
        key: (data as any).api_key,
        secret: (data as any).api_secret
    };
};
