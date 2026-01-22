import { supabase } from './client';
import type { Database } from './database.types';
import type { Strategy } from '../../types';

type StrategyRow = Database['public']['Tables']['strategies']['Row'];

export const fetchStrategies = async (): Promise<Strategy[]> => {
    const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching strategies:', error);
        throw error;
    }

    return (data || []).map(mapDbToApp);
};

export const insertStrategy = async (strategy: Omit<Strategy, 'id'>): Promise<Strategy> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('strategies')
        // @ts-expect-error - Supabase type inference issue
        .insert({
            user_id: user.id,
            name: strategy.name,
            description: strategy.description || null,
            color: strategy.color
        })
        .select()
        .single();

    if (error) {
        console.error('Error inserting strategy:', error);
        throw error;
    }

    return mapDbToApp(data);
};

export const updateStrategy = async (id: string, updates: Partial<Strategy>): Promise<Strategy> => {
    const dbUpdates: Partial<{ name: string; description: string | null; color: string }> = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.color) dbUpdates.color = updates.color;

    const { data, error } = await supabase
        .from('strategies')
        // @ts-expect-error - Supabase type inference issue
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating strategy:', error);
        throw error;
    }

    return mapDbToApp(data);
};

export const deleteStrategy = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting strategy:', error);
        throw error;
    }
};

function mapDbToApp(row: StrategyRow): Strategy {
    return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        color: row.color
    };
}
