import { set, get, del } from 'idb-keyval';

export const saveImage = async (file: File): Promise<string> => {
    // Generate a unique ID
    const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert to Blob (File is already a Blob, but good to be explicit for storage)
    // We intentionally strip metadata if needed, but storing File directly is usually fine.
    await set(id, file);

    return id;
};

export const getImage = async (id: string): Promise<string | null> => {
    try {
        const blob = await get(id);
        if (!blob) return null;
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error('Failed to load image', id, e);
        return null;
    }
};

export const deleteImage = async (id: string): Promise<void> => {
    await del(id);
};
