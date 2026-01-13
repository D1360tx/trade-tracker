import { supabase } from './client';
import type { Database } from './database.types';
import type { Mistake } from '../../types';

type MistakeRow = Database['public']['Tables']['mistakes']['Row'];

export const fetchMistakes = async (): Promise<Mistake[]> => {
    const { data, error } = await supabase
        .from('mistakes')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching mistakes:', error);
        throw error;
    }

    return (data || []).map(mapDbToApp);
};

export const insertMistake = async (mistake: Omit<Mistake, 'id'>): Promise<Mistake> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('mistakes')
        .insert({
            user_id: user.id,
            name: mistake.name,
            description: mistake.description || null,
            color: mistake.color
        })
        .select()
        .single();

    if (error) {
        console.error('Error inserting mistake:', error);
        throw error;
    }

    return mapDbToApp(data);
};

export const updateMistake = async (id: string, updates: Partial<Mistake>): Promise<Mistake> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.color) dbUpdates.color = updates.color;

    const { data, error } = await supabase
        .from('mistakes')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating mistake:', error);
        throw error;
    }

    return mapDbToApp(data);
};

export const deleteMistake = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('mistakes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting mistake:', error);
        throw error;
    }
};

function mapDbToApp(row: MistakeRow): Mistake {
    return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        color: row.color
    };
}
