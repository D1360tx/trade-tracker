import type { ReactNode } from 'react';

interface V2PanelProps {
    title?: string;
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
}

const V2Panel = ({ title, subtitle, actions, children, className = '', noPadding = false }: V2PanelProps) => {
    return (
        <div className={`glass-panel rounded-xl ${className}`}>
            {(title || subtitle || actions) && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <div>
                        {title && (
                            <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={noPadding ? '' : 'p-4'}>{children}</div>
        </div>
    );
};

export default V2Panel;
