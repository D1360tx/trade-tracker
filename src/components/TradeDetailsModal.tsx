import { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Plus, Maximize2 } from 'lucide-react';
import type { Trade } from '../types';
import { saveImage, getImage, deleteImage } from '../utils/imageStorage';
import { format, parseISO } from 'date-fns';

interface TradeDetailsModalProps {
    trade: Trade;
    onClose: () => void;
    onUpdate: (updates: Partial<Trade>) => void;
}

const TradeDetailsModal = ({ trade, onClose, onUpdate }: TradeDetailsModalProps) => {
    const [images, setImages] = useState<{ id: string; url: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load images on mount
    useEffect(() => {
        const loadImages = async () => {
            if (!trade.screenshotIds || trade.screenshotIds.length === 0) {
                setImages([]);
                return;
            }

            const loaded: { id: string; url: string }[] = [];
            for (const id of trade.screenshotIds) {
                const url = await getImage(id);
                if (url) {
                    loaded.push({ id, url });
                }
            }
            setImages(loaded);
        };

        loadImages();
    }, [trade.screenshotIds]);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files) return;

        const newIds: string[] = [];
        const newImages: { id: string; url: string }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            try {
                const id = await saveImage(file);
                const url = await getImage(id); // Get URL immediately for display
                if (url) {
                    newIds.push(id);
                    newImages.push({ id, url });
                }
            } catch (e) {
                console.error('Failed to save image', e);
            }
        }

        if (newIds.length > 0) {
            const currentIds = trade.screenshotIds || [];
            onUpdate({ screenshotIds: [...currentIds, ...newIds] });
            setImages(prev => [...prev, ...newImages]);
        }
    };

    const handleDeleteImage = async (id: string) => {
        if (!confirm('Are you sure you want to delete this screenshot?')) return;

        await deleteImage(id);
        const newIds = (trade.screenshotIds || []).filter(sid => sid !== id);
        onUpdate({ screenshotIds: newIds });
        setImages(prev => prev.filter(img => img.id !== id));
        if (fullScreenImage === id) setFullScreenImage(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            {trade.ticker}
                            <span className={`text-xs px-2 py-0.5 rounded border ${trade.direction === 'LONG' ? 'border-[var(--success)] text-[var(--success)]' : 'border-[var(--danger)] text-[var(--danger)]'}`}>
                                {trade.direction}
                            </span>
                        </h2>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {format(parseISO(trade.exitDate), 'MMM dd, yyyy HH:mm')} • {trade.exchange}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-tertiary)]">P&L</p>
                            <p className={`text-xl font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${trade.pnl.toFixed(2)}
                            </p>
                        </div>
                        <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-tertiary)]">ROI</p>
                            <p className={`text-xl font-bold ${trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                {trade.pnlPercentage.toFixed(2)}%
                            </p>
                        </div>
                        <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-tertiary)]">Risk</p>
                            <p className="text-xl font-bold text-[var(--text-secondary)]">
                                {trade.initialRisk ? `$${trade.initialRisk}` : '-'}
                            </p>
                        </div>
                        <div className="p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
                            <p className="text-xs text-[var(--text-tertiary)]">R-Multiple</p>
                            <p className="text-xl font-bold text-[var(--text-secondary)]">
                                {trade.initialRisk && trade.initialRisk > 0 ? `${(trade.pnl / trade.initialRisk).toFixed(2)}R` : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm border-t border-b border-[var(--border)] py-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[var(--text-secondary)]">Entry Date</span>
                            <input
                                type="datetime-local"
                                className="bg-transparent text-right font-medium focus:outline-none focus:border-b border-[var(--accent-primary)] text-[var(--text-primary)]"
                                value={trade.entryDate ? new Date(trade.entryDate).toISOString().slice(0, 16) : ''}
                                onChange={(e) => onUpdate({ entryDate: new Date(e.target.value).toISOString() })}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[var(--text-secondary)]">Exit Date</span>
                            <input
                                type="datetime-local"
                                className="bg-transparent text-right font-medium focus:outline-none focus:border-b border-[var(--accent-primary)] text-[var(--text-primary)]"
                                value={trade.exitDate ? new Date(trade.exitDate).toISOString().slice(0, 16) : ''}
                                onChange={(e) => onUpdate({ exitDate: new Date(e.target.value).toISOString() })}
                            />
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Duration</span>
                            <span className="font-medium">
                                {(() => {
                                    const start = new Date(trade.entryDate).getTime();
                                    const end = new Date(trade.exitDate).getTime();
                                    const diff = end - start;
                                    const seconds = Math.floor(diff / 1000);
                                    if (seconds < 60) return `${seconds}s`;
                                    const minutes = Math.floor(seconds / 60);
                                    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
                                    const hours = Math.floor(minutes / 60);
                                    return `${hours}h ${minutes % 60}m`;
                                })()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Quantity</span>
                            <span className="font-medium">{trade.quantity}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Leverage</span>
                            <span className="font-medium">{trade.leverage ? `${trade.leverage}x` : '1x'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Entry Price</span>
                            <span className="font-medium font-mono">${trade.entryPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Exit Price</span>
                            <span className="font-medium font-mono">${trade.exitPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Fees</span>
                            <span className="font-medium text-[var(--danger)]">-${trade.fees?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-secondary)]">Net P&L</span>
                            <span className={`font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${trade.pnl.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Screenshot Gallery */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ImageIcon size={18} className="text-[var(--accent-primary)]" />
                                Screenshots
                            </h3>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                            >
                                <Plus size={14} /> Add Image
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => handleFileUpload(e.target.files)}
                                className="hidden"
                                multiple
                                accept="image/*"
                            />
                        </div>

                        {images.length === 0 ? (
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors
                                    ${isDragging ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]/30'}
                                `}
                            >
                                <Upload className="text-[var(--text-tertiary)] mb-2" size={32} />
                                <p className="text-sm text-[var(--text-secondary)]">Drop screenshots here or click to upload</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {images.map(img => (
                                    <div key={img.id} className="group relative aspect-video bg-black/20 rounded-lg overflow-hidden border border-[var(--border)]">
                                        <img src={img.url} alt="Trade Screenshot" className="w-full h-full object-cover" />

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setFullScreenImage(img.url)}
                                                className="p-2 bg-[var(--bg-secondary)] rounded-full hover:text-[var(--accent-primary)] transition-colors"
                                                title="View Fullscreen"
                                            >
                                                <Maximize2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteImage(img.id)}
                                                className="p-2 bg-[var(--bg-secondary)] rounded-full hover:text-[var(--danger)] transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Mini Drop Zone */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors
                                        ${isDragging ? 'border-[var(--accent-primary)]' : 'border-[var(--border)] hover:border-[var(--text-tertiary)]'}
                                    `}
                                >
                                    <Plus className="text-[var(--text-tertiary)]" />
                                    <span className="text-xs text-[var(--text-tertiary)] mt-1">Add details</span>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Notes */}
                    <div>
                        <h3 className="font-semibold mb-2">Notes</h3>
                        <textarea
                            value={trade.notes || ''}
                            onChange={(e) => onUpdate({ notes: e.target.value })}
                            placeholder="Add trade notes here..."
                            className="w-full h-32 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg p-3 text-sm focus:border-[var(--accent-primary)] outline-none resize-none"
                        />
                    </div>

                </div>
            </div>

            {/* Full Screen Image Modal */}
            {fullScreenImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setFullScreenImage(null)}
                >
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                        <X size={32} />
                    </button>
                    <img
                        src={fullScreenImage}
                        alt="Full Screen"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default TradeDetailsModal;
